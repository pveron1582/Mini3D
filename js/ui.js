import * as THREE from 'three';
import { byId, qs, qsa } from './dom.js';
import { camera, canvas, controls } from './core.js';
import { store, cinema, view, playbackInstances, interactiveRegistry } from './state.js';
import { getActiveEntry, getActiveObject, setActiveTarget, updateSelectionRing, clearActiveTarget } from './selection.js';
import {
  setCamView, cinemaDeactivate, startAllPlaybacks, stopAllPlaybacks, refreshCinemaUI
} from './cinematics.js';
import { setEnvironment } from './environment.js';
import { flyToTarget } from './viewport.js';
import { setStatus } from './recorder.js';
import { pushHistory } from './undo.js';
import { applyViewToSelectedShot, clearSubSelection as clearSubtitleSelection, clearSelection as clearShotSelection } from './timeline.js';
import { clearQuizSelection } from './quizTrack.js';
import { getWallTexture, wallTextureNames, setWallKind, addWall, setDoorState, addWindow, addDoor } from './office/walls.js';
import { floorTextureNames, getFloorTextureName, applyFloorTexture } from './office/floor.js';
import { addConFloor, addConWall, addConDoor, addConWindow, setConFloorTexture, updateConstructionVisibility } from './construction.js';
import { onTargetSelected } from './selection.js';
import { CATALOG, spawnCatalogItem, deleteActiveObject, duplicateActiveObject } from './catalog.js';
import { deleteMultiSelection, multiCount } from './multiselect.js';
import { startTrayDraw, onTrayCreated } from './trayDraw.js';

// ==========================================
// OUTLINER / JERARQUÍA COMPLETA
// ==========================================
export function refreshCharacterButtons() {
  qsa('#section-target .target-btn[data-target]').forEach(btn => {
    const entry = interactiveRegistry.get(btn.getAttribute('data-target'));
    const visible = !!entry && !entry.deleted;
    btn.style.display = visible ? '' : 'none';
    btn.classList.toggle('active', visible && entry.id === store.activeTarget);
  });
  const box = byId('customCharBox');
  if (!box) return;
  box.innerHTML = '';
  let any = false;
  interactiveRegistry.forEach(entry => {
    if (entry.type !== 'human' || entry.deleted || !entry.group.userData.customCharacter) return;
    any = true;
    const b = document.createElement('button');
    b.className = 'target-btn' + (entry.id === store.activeTarget ? ' active' : '');
    b.textContent = '🧍 ' + entry.name;
    b.addEventListener('click', () => setActiveTarget(entry.id));
    box.appendChild(b);
  });
  box.style.display = any ? 'grid' : 'none';
}

export function populateOutliner() {
  const tree = byId('outlinerTree');
  if (!tree) return;
  tree.innerHTML = '';

  const categories = [
    { title: '🧍 PERSONAJES', type: ['human', 'pet'] },
    { title: '🏗️ EDIFICIO / CONSTRUCCIÓN', type: ['wall', 'door', 'window', 'floor'] },
    { title: '💻 EQUIPOS IT & HARDWARE', type: ['prop'] },
    { title: '🏢 MOBILIARIO DE OFICINA', type: ['furniture'] }
  ];

  categories.forEach(cat => {
    const header = document.createElement('li');
    header.className = 'outliner-category-header';
    header.textContent = cat.title;
    tree.appendChild(header);

    interactiveRegistry.forEach(entry => {
      if (entry.deleted) return;   // objetos borrados (catálogo): fuera de la lista
      if (cat.type.includes(entry.type)) {
        const item = document.createElement('li');
        item.className = 'outliner-item' + (entry.id === store.activeTarget ? ' selected' : '');
        item.setAttribute('data-id', entry.id);

        let icon = '📦';
        if (entry.type === 'human') icon = '🧍';
        else if (entry.type === 'pet') icon = '🐾';
        else if (entry.type === 'prop') icon = '💻';
        else if (entry.type === 'wall') icon = '🧱';
        else if (entry.type === 'door') icon = '🚪';
        else if (entry.type === 'window') icon = '🪟';
        else if (entry.type === 'floor') icon = '🟫';

        item.innerHTML = `<span>${icon} ${entry.name}</span><span>👁️</span>`;
        item.addEventListener('click', () => setActiveTarget(entry.id));
        tree.appendChild(item);
      }
  });
});

  refreshCharacterButtons();
}

// --- Puerta del mini rack: botón visible al seleccionar CUALQUIER mini rack ---
// (Lote 3b: la puerta es multi-instancia; el fijo y los del catálogo funcionan igual)
const btnMiniRackDoor = byId('btnMiniRackDoor');
queueMicrotask(() => onTargetSelected((id) => {
  const entry = id ? interactiveRegistry.get(id) : null;
  const isRack = !!(entry && entry.group && entry.group.userData && entry.group.userData.doorHinge);
  if (btnMiniRackDoor) btnMiniRackDoor.style.display = isRack ? 'inline-block' : 'none';
}));
btnMiniRackDoor?.addEventListener('click', () => {
  const entry = getActiveEntry();
  const ud = entry && entry.group ? entry.group.userData : null;
  if (!ud || !ud.doorHinge) return;
  ud.doorOpen = ud.doorOpen ? 0 : 1;
  setStatus(ud.doorOpen ? 'Puerta del mini rack: abierta' : 'Puerta del mini rack: cerrada');
});

// P5: selection.js ya no importa ui.js. Los paneles de animación/mood/sliders/muro
// se refrescan aquí, suscritos al cambio de objetivo (rompe el ciclo selection → ui).
function refreshTargetPanels(id) {
  const entry = id ? getActiveEntry() : null;
  const humanActions = byId('humanActionsGrid');
  const petActions = byId('petActionsGrid');
  const propControls = byId('propControlsGrid');
  const moodGrid = byId('humanMoodGrid');
  const actionsTitle = byId('actionsSectionTitle');
  const transformTitle = byId('transformSectionTitle');
  const badge = byId('hudSelectedBadge');

  if (!entry) {
    if (humanActions) humanActions.style.display = 'none';
    if (petActions) petActions.style.display = 'none';
    if (propControls) propControls.style.display = 'none';
    if (moodGrid) moodGrid.style.display = 'none';
    if (actionsTitle) actionsTitle.textContent = 'Animaciones';
    if (transformTitle) transformTitle.textContent = 'Posición 3D';
    if (badge) badge.textContent = '';
    refreshWallPanel();
    return;
  }

  if (entry.type === 'human') {
    if (humanActions) humanActions.style.display = 'grid';
    if (petActions) petActions.style.display = 'none';
    if (propControls) propControls.style.display = 'none';
    if (moodGrid) moodGrid.style.display = 'grid';
    if (actionsTitle) actionsTitle.textContent = `Animaciones (${entry.name})`;
    if (transformTitle) transformTitle.textContent = `Posición 3D (${entry.name})`;
    if (badge) badge.textContent = `🧍 Enfocado: ${entry.name}`;
    updateActionButtonsState(entry.rig ? entry.rig.currentAction : 'idle');
    updateMoodButtonsState(entry.rig ? entry.rig.mood : 'neutral');
  } else if (entry.type === 'pet') {
    if (humanActions) humanActions.style.display = 'none';
    if (petActions) petActions.style.display = 'grid';
    if (propControls) propControls.style.display = 'none';
    if (moodGrid) moodGrid.style.display = 'none';
    if (actionsTitle) actionsTitle.textContent = `Animaciones (${entry.name})`;
    if (transformTitle) transformTitle.textContent = `Posición 3D (${entry.name})`;
    if (badge) badge.textContent = `🐾 Enfocado: ${entry.name}`;
    updateActionButtonsState(entry.rig ? entry.rig.currentAction : 'idle');
  } else {
    if (humanActions) humanActions.style.display = 'none';
    if (petActions) petActions.style.display = 'none';
    if (propControls) propControls.style.display = 'flex';
    if (moodGrid) moodGrid.style.display = 'none';
    if (actionsTitle) actionsTitle.textContent = `Objeto (${entry.name})`;
    if (transformTitle) transformTitle.textContent = `Posición 3D (${entry.name})`;
    if (badge) badge.textContent = `📦 Enfocado: ${entry.name}`;
  }

  syncSlidersFromTarget();
  refreshWallPanel();
}
queueMicrotask(() => onTargetSelected(refreshTargetPanels));

// ==========================================
// DESELECCIÓN GLOBAL DE BLOQUES DE LA LÍNEA DE TIEMPO
// ==========================================
// DES-SELECCIÓN DE BLOQUES (toma / subtítulo)
// ==========================================
// Sin bloqueos ni recuadros: la selección es "pegajosa" solo dentro de su
// sección. Elegir un bloque de toma (cinemática) o de subtítulo habilita su
// edición en vivo; al hacer click en CUALQUIER lado fuera de esa sección de
// edición (paneles, viewport, timeline, otro editor), el bloque se deselecciona
// solo y todo queda libre. Los clicks dentro de la propia sección no la sueltan.
document.addEventListener('pointerdown', (e) => {
  const t = e.target;
  if (!t || !t.closest) return;
  // Pista / regla / subtítulos / quiz de la línea de tiempo: mantener (elegir
  // otro bloque ahí es responsabilidad de la timeline, no de este handler).
  if (t.closest('#timelineTrack') || t.closest('#timelineRuler') || t.closest('#subtitleLane') || t.closest('#quizLane')) return;
  // Dentro de la sección de edición de TEXTOS (subtítulos + quiz): no soltar.
  if (t.closest('#subtitlesPanel')) return;
  // Dentro de la sección de CINEMÁTICA (vistas, edición del recorrido): no
  // soltar la toma seleccionada.
  if (t.closest('#section-cinematic')) return;
  // Click en cualquier otro lado: liberar todas las selecciones de bloque.
  clearSubtitleSelection();
  clearQuizSelection();
  clearShotSelection();
}, true);

// ==========================================
// CONTROLS, ACTIONS & SLIDERS
// ==========================================
export function updateActionButtonsState(currentAction) {
  const container = qs('.action-grid:not([style*="display: none"])');
  if (!container) return;
  container.querySelectorAll('.action-btn').forEach(btn => {
    // Los botones de ánimo no participan del resaltado de acciones
    if (btn.getAttribute('data-mood')) return;
    btn.classList.toggle('active', btn.getAttribute('data-action') === currentAction);
  });
}

// Resalta el botón del estado de ánimo actual
export function updateMoodButtonsState(currentMood) {
  qsa('.mood-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-mood') === currentMood);
  });
}

// Bind Action Buttons Click
document.addEventListener('click', (e) => {
  const moodBtn = e.target.closest('.mood-btn');
  if (moodBtn) {
    const m = moodBtn.getAttribute('data-mood');
    const entry = getActiveEntry();
    if (entry && entry.rig && entry.rig.setMood) {
      entry.rig.setMood(m);
      pushHistory();
    }
    return;
  }
  const actionBtn = e.target.closest('.action-btn');
  if (actionBtn) {
    const act = actionBtn.getAttribute('data-action');
    const entry = getActiveEntry();
    if (entry && entry.rig) {
      entry.rig.setAction(act);
      pushHistory();
    }
  }
});

// Slider Transform Bindings
const sliderX = byId('sliderX');
const numX = byId('numX');
const sliderY = byId('sliderY');
const numY = byId('numY');
const sliderZ = byId('sliderZ');
const numZ = byId('numZ');
const sliderRotY = byId('sliderRotY');
const numRotY = byId('numRotY');
const sliderScale = byId('sliderScale');
const numScale = byId('numScale');

export function syncSlidersFromTarget() {
  const obj = getActiveObject();
  if (!obj) return;

  const posX = obj.position.x;
  const posY = obj.position.y;
  const posZ = obj.position.z;
  const degY = Math.round(THREE.MathUtils.radToDeg(obj.rotation.y));

  if (document.activeElement !== sliderX && document.activeElement !== numX) {
    sliderX.value = posX;
    numX.value = posX.toFixed(2);
  }
  if (document.activeElement !== sliderY && document.activeElement !== numY) {
    sliderY.value = posY;
    numY.value = posY.toFixed(2);
  }
  if (document.activeElement !== sliderZ && document.activeElement !== numZ) {
    sliderZ.value = posZ;
    numZ.value = posZ.toFixed(2);
  }
  if (document.activeElement !== sliderRotY && document.activeElement !== numRotY) {
    sliderRotY.value = (degY % 360 + 360) % 360;
    numRotY.value = Math.round((degY % 360 + 360) % 360);
  }
  // Escala: única vía para escalar (el gizmo ya no escala con la banda).
  if (document.activeElement !== sliderScale && document.activeElement !== numScale) {
    const s = obj.scale.x;
    sliderScale.value = s;
    numScale.value = s.toFixed(2);
  }
  updateSelectionRing();
}

function applySlidersToTarget() {
  const obj = getActiveObject();
  if (!obj) return;

  obj.position.x = parseFloat(sliderX.value) || 0;
  obj.position.y = parseFloat(sliderY.value) || 0;
  obj.position.z = parseFloat(sliderZ.value) || 0;
  obj.rotation.y = THREE.MathUtils.degToRad(parseFloat(sliderRotY.value) || 0);
  // Escala uniforme desde el panel (rango 0.5–2)
  const sc = Math.min(2, Math.max(0.5, parseFloat(sliderScale.value) || 1));
  obj.scale.setScalar(sc);
  numScale.value = sc.toFixed(2);

  // Límite de altura del piso (Y >= 0, o el piso propio del personaje)
  const entry = getActiveEntry();
  const act = entry && entry.rig ? (entry.rig.currentAction || '') : '';
  const seated = act.startsWith('sit') || act === 'lay';
  const minY = entry && entry.rig && entry.rig.groundY && !seated ? entry.rig.groundY : 0;
  if (obj.position.y < minY) obj.position.y = minY;

  numX.value = obj.position.x.toFixed(2);
  numY.value = obj.position.y.toFixed(2);
  numZ.value = obj.position.z.toFixed(2);
  numRotY.value = Math.round(parseFloat(sliderRotY.value) || 0);

  updateSelectionRing();
}

sliderX.addEventListener('input', applySlidersToTarget);
sliderY.addEventListener('input', applySlidersToTarget);
sliderZ.addEventListener('input', applySlidersToTarget);
sliderRotY.addEventListener('input', applySlidersToTarget);
sliderScale?.addEventListener('input', applySlidersToTarget);

numX.addEventListener('input', () => { sliderX.value = numX.value; applySlidersToTarget(); });
numY.addEventListener('input', () => { sliderY.value = numY.value; applySlidersToTarget(); });
numZ.addEventListener('input', () => { sliderZ.value = numZ.value; applySlidersToTarget(); });
numRotY.addEventListener('input', () => { sliderRotY.value = numRotY.value; applySlidersToTarget(); });
numScale?.addEventListener('input', () => { sliderScale.value = numScale.value; applySlidersToTarget(); });

// Confirmar cambios de transformación en el historial (al soltar el slider)
[sliderX, sliderY, sliderZ, sliderRotY, sliderScale, numX, numY, numZ, numRotY, numScale].forEach(inp => {
  inp?.addEventListener('change', pushHistory);
});

byId('btnResetTargetPos')?.addEventListener('click', () => {
  const obj = getActiveObject();
  if (obj) {
    obj.position.set(0, 0, 0);
    obj.rotation.set(0, 0, 0);
    syncSlidersFromTarget();
    pushHistory();
  }
});

byId('btnFaceCamera')?.addEventListener('click', () => {
  const obj = getActiveObject();
  if (obj) {
    obj.lookAt(camera.position.x, obj.position.y, camera.position.z);
    syncSlidersFromTarget();
    pushHistory();
  }
});

// Modo "Editar Objetos" legacy: ahora se controla vía store.editMode.
// Se mantiene store.editObjects para compatibilidad pero sin botón dedicado.
store.editObjects = false;

// ==========================================
// CATÁLOGO DE OBJETOS (P7): panel "➕ Agregar"
// ==========================================
let catalogBuilt = false;
function buildCatalogPanel() {
  if (catalogBuilt) return;
  catalogBuilt = true;
  const grid = byId('catalogGrid');
  if (!grid) return;
  const cats = [...new Set(CATALOG.map(c => c.cat))];
  cats.forEach(catName => {
    const lbl = document.createElement('div');
    lbl.className = 'target-category-label';
    lbl.style.gridColumn = '1 / -1';
    lbl.style.marginTop = '4px';
    lbl.textContent = catName;
    grid.appendChild(lbl);
    CATALOG.filter(c => c.cat === catName).forEach(item => {
      const b = document.createElement('button');
      b.className = 'blender-btn';
      b.style.fontSize = '0.78rem';
      b.style.padding = '4px 2px';
      b.textContent = item.label;
      b.title = `Agregar ${item.label}`;
      b.addEventListener('click', () => {
        if (!store.editObjects) {
          setStatus('Activá "✏️ Editar Objetos" para agregar objetos.');
          return;
        }
        // La canaleta entra en modo dibujo punto a punto (js/trayDraw.js).
        if (item.id === 'cableTray') { startTrayDraw(); return; }
        const g = spawnCatalogItem(item.id);
        if (g) {
          populateOutliner();
          setActiveTarget(g.userData.id);
        }
      });
      grid.appendChild(b);
    });
  });
}

// Al terminar un tramo de canaleta dibujado (trayDraw.js), refrescar el outliner.
// Diferido: trayDraw.js participa del SCC de imports; onTrayCreated hoy es
// function declaration (hoisted, segura), pero el registro se difiere para que
// la invariante de tools/check-scc.js se cumpla sin depender del hoisting.
queueMicrotask(() => onTrayCreated(() => populateOutliner()));

// Borrar con el teclado (Supr / Backspace): objeto activo o toda la selección.
// Se ignora cuando el foco está en un campo de texto (para no borrar caracteres).
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return;
  const el = document.activeElement;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
  // No robar la tecla cuando hay un modal/menú abierto (permitir todo lo demás)
  if (multiCount() >= 2) {
    if (deleteMultiSelection() > 0) populateOutliner();
  } else if (deleteActiveObject()) {
    populateOutliner();
  }
});

// Borrar / duplicar el objeto activo (P7)
byId('btnDeleteObj')?.addEventListener('click', () => {
  if (deleteActiveObject()) populateOutliner();
});
byId('btnDuplicateObj')?.addEventListener('click', () => {
  if (duplicateActiveObject()) populateOutliner();
});
// Borrar toda la selección múltiple
byId('btnDeleteMulti')?.addEventListener('click', () => {
  if (deleteMultiSelection() > 0) populateOutliner();
});

// ==========================================
// MODO CONSTRUCCIÓN (Fase 2 del editor de escenas)
// ==========================================
// Reemplaza el panel izquierdo por herramientas de construcción (piso,
// paredes, puertas, ventanas). La capa vive en js/construction.js, separada
// de la oficina. Al entrar se cambia al ambiente "terrain" (lote con césped).
const NORMAL_SECTIONS = ['section-target', 'section-actions', 'section-transform', 'section-cinematic', 'section-outliner'];

function setConstructionMode(on) {
  store.editBuilding = on;
  NORMAL_SECTIONS.forEach(id => {
    const el = byId(id);
    if (el) el.style.display = on ? 'none' : '';
  });
  const cp = byId('constructionPanel');
  if (cp) cp.style.display = on ? 'block' : 'none';
  const btn = byId('btnConstruction');
  if (btn) {
    btn.textContent = on ? '🏗️ Modo Construcción: ON' : '🏗️ Modo Construcción: OFF';
    btn.classList.toggle('primary', on);
  }
  updateConstructionVisibility();
  if (on) {
    const ws = byId('section-wall');
    if (ws) ws.style.display = 'none';
    setStatus('Modo Construcción: añadí piso, paredes, puertas y ventanas. (Salir al terminar)');
  } else {
    refreshWallPanel();                       // restaura el editor de pared según la selección
    refreshTargetPanels(store.activeTarget);  // restaura el panel del objetivo
    setStatus('Modo Construcción apagado.');
  }
}

byId('btnConExit')?.addEventListener('click', () => setConstructionMode(false));

// ---- Herramientas de construcción ----
// Vista "solo edificio": oculta personajes/mobiliario para ver la construcción
const btnConOnly = byId('btnConOnly');
btnConOnly?.addEventListener('click', () => {
  store.buildingOnly = !store.buildingOnly;
  btnConOnly.textContent = store.buildingOnly ? '👁️ Solo edificio: ON' : '👁️ Solo edificio: OFF';
  btnConOnly.classList.toggle('primary', store.buildingOnly);
  interactiveRegistry.forEach((entry) => {
    if (entry.type === 'wall' || entry.type === 'door' || entry.type === 'window' || entry.type === 'floor') return;
    entry.group.visible = store.buildingOnly ? false : !entry.deleted;
  });
  setStatus(store.buildingOnly ? 'Vista solo edificio.' : 'Vista normal.');
});

// Selector de tipo de piso de construcción: cambia el tipo del piso seleccionado
const conFloorTextureSel = byId('conFloorTexture');
if (conFloorTextureSel) {
  floorTextureNames.forEach(name => {
    const o = document.createElement('option');
    o.value = name;
    o.textContent = name;
    conFloorTextureSel.appendChild(o);
  });
  conFloorTextureSel.addEventListener('change', () => {
    const obj = getActiveObject();
    if (obj && obj.userData.conType === 'floor') {
      setConFloorTexture(obj, conFloorTextureSel.value);
      pushHistory();
      setStatus(`Piso: ${conFloorTextureSel.value}.`);
    } else {
      setStatus('Seleccioná un piso de construcción para cambiar su tipo.');
    }
  });
}
// Al seleccionar un piso de construcción, reflejar su tipo en el selector
queueMicrotask(() => onTargetSelected((id) => {
  if (!conFloorTextureSel) return;
  const entry = id ? interactiveRegistry.get(id) : null;
  if (entry && entry.group.userData.conType === 'floor') {
    conFloorTextureSel.value = entry.group.userData.floorData.tex;
  }
}));

// Posición de spawn: frente a la vista (donde apunta la cámara)
function constructionSpawnPos() {
  const t = controls.target;
  return [Math.round(t.x * 2) / 2, Math.round(t.z * 2) / 2];
}

byId('btnConAddFloor')?.addEventListener('click', () => {
  if (!store.editBuilding) { setStatus('Activá el Modo Construcción.'); return; }
  const [x, z] = constructionSpawnPos();
  const tex = conFloorTextureSel ? conFloorTextureSel.value : floorTextureNames[0];
  const g = addConFloor(x, z, 6, 6, tex);
  if (g) { populateOutliner(); setActiveTarget(g.userData.conId); pushHistory(); setStatus('Piso añadido: movelo con el gizmo.'); }
});
byId('btnConAddWall')?.addEventListener('click', () => {
  if (!store.editBuilding) { setStatus('Activá el Modo Construcción.'); return; }
  const [x, z] = constructionSpawnPos();
  const g = addConWall(x, z, 0, 4, 3, 0.15, 'solid', 'Paneles claros');
  if (g) { populateOutliner(); setActiveTarget(g.userData.conId); pushHistory(); setStatus('Pared añadida: movela y rotala con el gizmo.'); }
});
byId('btnConAddDoor')?.addEventListener('click', () => {
  if (!store.editBuilding) { setStatus('Activá el Modo Construcción.'); return; }
  const [x, z] = constructionSpawnPos();
  const g = addConDoor(x, z);
  if (g) { populateOutliner(); setActiveTarget(g.userData.conId); pushHistory(); setStatus('Puerta añadida: movela con el gizmo para apoyarla en una pared.'); }
});
byId('btnConAddWindow')?.addEventListener('click', () => {
  if (!store.editBuilding) { setStatus('Activá el Modo Construcción.'); return; }
  const [x, z] = constructionSpawnPos();
  const g = addConWindow(x, z);
  if (g) { populateOutliner(); setActiveTarget(g.userData.conId); pushHistory(); setStatus('Ventana añadida: movela con el gizmo para apoyarla en una pared.'); }
});

// ==========================================
// GESTOS: buscador + lista scrollable
// ==========================================
// Filtra la lista mientras se escribe. La coincidencia es por substring,
// insensible a mayúsculas/minúsculas y sin acentos, así "ajo" encuentra
// "Llevar objeto" y "apla" encuentra "Aplaudir".
const gestureSearch = byId('gestureSearch');
const gestureList = byId('humanGesturesGrid');
const sinAcentos = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
gestureSearch?.addEventListener('input', () => {
  const q = sinAcentos(gestureSearch.value.trim());
  gestureList?.querySelectorAll('.action-btn').forEach((btn) => {
    const ok = !q || sinAcentos(btn.textContent).includes(q);
    btn.style.display = ok ? '' : 'none';
  });
});

const CHARACTER_TARGETS = ['human1', 'human2', 'human3', 'human4', 'human5', 'human6', 'human7', 'human8', 'human9', 'dog', 'cat'];

// ==========================================
// MODO OBJETOS: lista de la escena + catálogo con buscador
// ==========================================
// Lista los objetos de la escena (props + mobiliario, sin personajes ni
// construcción) en un cuadro con scroll y buscador, igual que los gestos.
const OBJECT_TYPES = ['prop', 'furniture'];
const objectSearch = byId('objectSearch');
const sceneObjectsList = byId('sceneObjectsList');

export function refreshSceneObjectsList() {
  if (!sceneObjectsList) return;
  const q = objectSearch ? sinAcentos(objectSearch.value.trim()) : '';
  sceneObjectsList.innerHTML = '';
  let any = false;
  interactiveRegistry.forEach(entry => {
    if (entry.deleted) return;
    if (!OBJECT_TYPES.includes(entry.type)) return;
    const label = entry.name || entry.id;
    if (q && !sinAcentos(label).includes(q)) return;
    any = true;
    const b = document.createElement('button');
    b.className = 'action-btn' + (entry.id === store.activeTarget ? ' active' : '');
    b.textContent = (entry.type === 'prop' ? '💻 ' : '🏢 ') + label;
    b.title = 'Seleccionar ' + label;
    b.addEventListener('click', () => {
      setActiveTarget(entry.id);
      // Elegir un objeto de la lista también LLEVA la cámara hasta él
      // (vuelo suave + acercamiento intermedio, js/viewport.js).
      flyToTarget(entry.id);
    });
    sceneObjectsList.appendChild(b);
  });
  if (!any) {
    const p = document.createElement('p');
    p.className = 'cinema-hint';
    p.textContent = q ? 'Sin resultados para la búsqueda.' : 'Todavía no hay objetos en la escena.';
    sceneObjectsList.appendChild(p);
  }
}

objectSearch?.addEventListener('input', refreshSceneObjectsList);

// Al cambiar el objeto activo, refrescar el resaltado de la lista
queueMicrotask(() => onTargetSelected(() => { if (store.editMode === 'objetos') refreshSceneObjectsList(); }));

// --- Modal del catálogo: igual que el creador de personajes, con buscador ---
const objCatalogModal = byId('objectCatalogModal');
const catalogSearch = byId('catalogSearch');
const catalogList = byId('catalogList');

function openObjectCatalog() {
  if (!objCatalogModal) return;
  if (catalogSearch) catalogSearch.value = '';
  renderCatalogList('');
  objCatalogModal.style.display = '';
}

function renderCatalogList(q) {
  if (!catalogList) return;
  catalogList.innerHTML = '';
  let lastCat = null;
  CATALOG.forEach(item => {
    if (q && !sinAcentos(item.label).includes(q) && !sinAcentos(item.cat).includes(q)) return;
    if (item.cat !== lastCat) {
      const lbl = document.createElement('div');
      lbl.className = 'target-category-label';
      lbl.style.marginTop = '4px';
      lbl.textContent = item.cat;
      catalogList.appendChild(lbl);
      lastCat = item.cat;
    }
    const b = document.createElement('button');
    b.className = 'action-btn';
    b.textContent = item.label;
    b.title = `Agregar ${item.label}`;
    b.addEventListener('click', () => {
      // La canaleta entra en modo dibujo punto a punto (js/trayDraw.js).
      if (item.id === 'cableTray') { closeObjectCatalog(); startTrayDraw(); return; }
      const g = spawnCatalogItem(item.id);
      if (g) {
        refreshSceneObjectsList();
        populateOutliner();
        setActiveTarget(g.userData.id);
        closeObjectCatalog();
      }
    });
    catalogList.appendChild(b);
  });
  if (!catalogList.children.length) {
    const p = document.createElement('p');
    p.className = 'cinema-hint';
    p.textContent = 'Sin resultados para la búsqueda.';
    catalogList.appendChild(p);
  }
}

function closeObjectCatalog() {
  if (objCatalogModal) objCatalogModal.style.display = 'none';
}

byId('btnAddObject')?.addEventListener('click', openObjectCatalog);
byId('objCatClose')?.addEventListener('click', closeObjectCatalog);
catalogSearch?.addEventListener('input', () => renderCatalogList(sinAcentos(catalogSearch.value.trim())));
objCatalogModal?.addEventListener('click', (e) => { if (e.target === objCatalogModal) closeObjectCatalog(); });
qsa('.target-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-target');
    if (!CHARACTER_TARGETS.includes(target) && !store.editObjects) return;
    setActiveTarget(target);
    // Elegir un personaje de la lista también LLEVA la cámara hasta él
    // (vuelo suave + acercamiento intermedio, js/viewport.js).
    flyToTarget(target);
  });
});


// ==========================================
// EDITOR DE PARED (largo / alto / espesor / textura)
// ==========================================
const wallSection = byId('section-wall');
const wallLen = byId('wallLen');
const wallLenNum = byId('wallLenNum');
const wallHeight = byId('wallHeight');
const wallHeightNum = byId('wallHeightNum');
const wallThick = byId('wallThick');
const wallThickNum = byId('wallThickNum');
const wallTextureSel = byId('wallTexture');
const wallKindSel = byId('wallKind');
const doorStateSel = byId('doorState');
const btnAddWall = byId('btnAddWall');

// Opciones de textura (diferido: office.js puede no haber terminado de
// evaluarse por el ciclo de imports ui → office → selection → ui)
let wallTexOptionsReady = false;
function populateWallTextures() {
  if (wallTexOptionsReady || !wallTextureSel) return;
  wallTextureNames.forEach(name => {
    const o = document.createElement('option');
    o.value = name;
    o.textContent = name;
    wallTextureSel.appendChild(o);
  });
  wallTexOptionsReady = true;
}

export function refreshWallPanel() {
  populateWallTextures();
  const obj = getActiveObject();
  const wd = obj && obj.userData.wallData;
  const dd = obj && obj.userData.doorData;
  const isDoor = !!dd && !wd;
  const isWall = !!wd;
  if (wallSection) wallSection.style.display = (isWall || isDoor) ? 'block' : 'none';

  // Muestra los controles según el tipo de selección (pared / puerta)
  [wallLen, wallHeight, wallThick, wallTextureSel, wallKindSel].forEach(el => {
    if (el) el.style.display = isWall ? '' : 'none';
  });
  if (doorStateSel) doorStateSel.style.display = isDoor ? '' : 'none';

  if (isWall) {
    if (wallLen) wallLen.value = wd.w; if (wallLenNum) wallLenNum.value = wd.w.toFixed(2);
    if (wallHeight) wallHeight.value = wd.h; if (wallHeightNum) wallHeightNum.value = wd.h.toFixed(2);
    if (wallThick) wallThick.value = wd.d; if (wallThickNum) wallThickNum.value = wd.d.toFixed(2);
    if (wallKindSel) wallKindSel.value = wd.kind || 'glass';
    if (wallTextureSel && obj.userData.wallMesh) {
      const cur = wallTextureNames.find(n => getWallTexture(n) === obj.userData.wallMesh.material.map);
      wallTextureSel.value = cur || wallTextureNames[0];
    }
  } else if (isDoor && doorStateSel) {
    doorStateSel.value = obj.userData.doorState || 'cerrado';
  }
}

function applyWallDims() {
  const obj = getActiveObject();
  const wd = obj && obj.userData.wallData;
  if (!wd) return;
  wd.w = Math.max(0.5, parseFloat(wallLen.value) || 0.5);
  wd.h = Math.max(1, parseFloat(wallHeight.value) || 1);
  wd.d = Math.max(0.05, parseFloat(wallThick.value) || 0.05);
  obj.userData.wallMesh.scale.set(wd.w, wd.h, wd.d);
  // La pared apoya en el piso
  obj.position.y = wd.h / 2;
  if (wallLenNum) wallLenNum.value = wd.w.toFixed(2);
  if (wallHeightNum) wallHeightNum.value = wd.h.toFixed(2);
  if (wallThickNum) wallThickNum.value = wd.d.toFixed(2);
  updateSelectionRing();
}

if (wallLen) {
  wallLen.addEventListener('input', applyWallDims);
  wallHeight.addEventListener('input', applyWallDims);
  wallThick.addEventListener('input', applyWallDims);
  [wallLen, wallHeight, wallThick].forEach(inp => inp.addEventListener('change', pushHistory));
  [[wallLenNum, wallLen], [wallHeightNum, wallHeight], [wallThickNum, wallThick]].forEach(([num, rng]) => {
    num.addEventListener('input', () => { rng.value = num.value; applyWallDims(); });
    num.addEventListener('change', pushHistory);
  });
}
if (wallTextureSel) {
  wallTextureSel.addEventListener('change', () => {
    const obj = getActiveObject();
    if (!obj || !obj.userData.wallMesh) return;
    const mesh = obj.userData.wallMesh;
    mesh.material.map = getWallTexture(wallTextureSel.value);
    mesh.material.needsUpdate = true;
    pushHistory();
  });
}

// Cambiar el tipo de panel de la pared seleccionada (vidrio/sólido)
if (wallKindSel) {
  wallKindSel.addEventListener('change', () => {
    const obj = getActiveObject();
    if (!obj || !obj.userData.wallData) return;
    if (!store.editBuilding) {
      setStatus('Las paredes se cambian solo con "🏢 Editar Edificio".');
      refreshWallPanel();
      return;
    }
    setWallKind(obj, wallKindSel.value === 'solid' ? 'solid' : 'glass');
    refreshWallPanel();
    pushHistory();
  });
}

// Cambiar el estado de la puerta seleccionada (cerrado/entreabierto/abierto)
if (doorStateSel) {
  doorStateSel.addEventListener('change', () => {
    const obj = getActiveObject();
    if (!obj || !obj.userData.doorData) return;
    if (!store.editBuilding) {
      setStatus('Las puertas se cambian solo con "🏢 Editar Edificio".');
      refreshWallPanel();
      return;
    }
    setDoorState(obj, doorStateSel.value);
    setStatus(`Puerta: ${doorStateSel.value} (${obj.userData.doorId})`);
    pushHistory();
  });
}

// Construir una pared nueva (solo en Modo Construcción): va a la capa de
// construcción, frente a la vista.
if (btnAddWall) {
  btnAddWall.addEventListener('click', () => {
    if (!store.editBuilding) {
      setStatus('Activá el Modo Construcción para poder construir paredes.');
      return;
    }
    const [x, z] = constructionSpawnPos();
    const w = addConWall(x, z, 0, 4, 3, 0.15, 'solid', 'Paneles claros');
    populateOutliner();
    setActiveTarget(w.userData.conId);
    refreshWallPanel();
    pushHistory();
    setStatus('Pared añadida: movela y rotala con el gizmo.');
  });
}

// --- Botones del sistema de Cinemática ---
byId('btnCinemaExit')?.addEventListener('click', () => {
  cinemaDeactivate();
});

byId('btnCinemaPlayAll')?.addEventListener('click', () => {
  if (playbackInstances.size > 0) {
    stopAllPlaybacks();
    setStatus('Se detuvieron todas las cinemáticas.');
  } else {
    if (!startAllPlaybacks()) setStatus('No hay recorridos configurados todavía.');
    else setStatus('Reproduciendo TODAS las cinemáticas configuradas...');
  }
});

byId('btnCinemaReverse')?.addEventListener('click', () => {
  cinema.reversed = !cinema.reversed;
  const btn = byId('btnCinemaReverse');
  if (btn) btn.classList.toggle('primary', cinema.reversed);
  setStatus(cinema.reversed ? 'Sentido invertido (Final → Inicio).' : 'Sentido normal (Inicio → Final).');
});

const cinemaSpeedInput = byId('cinemaSpeed');
const cinemaSpeedVal = byId('cinemaSpeedVal');
cinemaSpeedInput?.addEventListener('input', () => {
  cinema.speed = parseFloat(cinemaSpeedInput.value) || 2;
  if (cinemaSpeedVal) cinemaSpeedVal.textContent = cinema.speed.toFixed(1);
});

byId('cinemaLoop')?.addEventListener('change', (e) => {
  cinema.loop = e.target.checked;
});

// --- Vistas de cámara (1ª persona, 3ª, persecución, cine fijo) ---
// Si hay una toma seleccionada en la línea de tiempo, el botón reconfigura
// ESA toma y la deja guardada así; si no, cambia la vista global.
qsa('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const v = btn.getAttribute('data-view');
    if (applyViewToSelectedShot(v)) {
      setStatus(`Cámara de la toma seleccionada: ${v}`);
      return;
    }
    setCamView(v === view.mode ? 'orbit' : v);
  });
});

// ==========================================
// SELECTOR EDITAR: Edificio / Objetos / Personajes / Subtítulos / Cinemática
// ==========================================
const EDIT_MODES = ['edificio', 'objetos', 'personajes', 'subtitulos', 'cinematica'];
const EDIT_LABELS = { edificio: 'Edificio', objetos: 'Objetos', personajes: 'Personajes', subtitulos: 'Subtítulos', cinematica: 'Cinemática' };
const EDIT_MENU_IDS = { edificio: 'mnuEditEdificio', objetos: 'mnuEditObjetos', personajes: 'mnuEditPersonajes', subtitulos: 'mnuEditSubtitulos', cinematica: 'mnuEditCinematica' };

function applyEditMode() {
  const mode = store.editMode;
  const nameEl = byId('editModeName');
  if (nameEl) nameEl.textContent = EDIT_LABELS[mode] || mode;
  const content = byId('editContent');
  if (content) content.style.display = (mode === 'personajes' || mode === 'objetos' || mode === 'subtitulos' || mode === 'cinematica') ? '' : 'none';
  // Paneles por modo. En SUBTÍTULOS solo se ve el editor de subtítulos; en
  // CINEMÁTICA solo la sección de recorridos (vive ahí, ya no en Personajes).
  const objectsPanel = byId('objectsPanel');
  const subtitlesPanel = byId('subtitlesPanel');
  const targetSection = byId('section-target');
  const actionsSection = byId('section-actions');
  const transformSection = byId('section-transform');
  const cinematicSection = byId('section-cinematic');
  const outlinerSection = byId('section-outliner');
  const wallSection = byId('section-wall');
  if (objectsPanel) objectsPanel.style.display = mode === 'objetos' ? '' : 'none';
  if (subtitlesPanel) subtitlesPanel.style.display = mode === 'subtitulos' ? '' : 'none';
  const showChars = mode === 'personajes';
  if (targetSection) targetSection.style.display = showChars ? '' : 'none';
  if (actionsSection) actionsSection.style.display = showChars ? '' : 'none';
  if (transformSection) transformSection.style.display = showChars || mode === 'objetos' ? '' : 'none';
  if (cinematicSection) cinematicSection.style.display = mode === 'cinematica' ? '' : 'none';
  if (outlinerSection) outlinerSection.style.display = showChars ? '' : 'none';
  if (wallSection) wallSection.style.display = 'none';
  if (mode === 'objetos') refreshSceneObjectsList();
  // Al entrar a Cinemática, refrescar la lista de personajes con sus
  // recorridos (activar 🎬 / reproducir ▶ / borrar ✖) al día.
  if (mode === 'cinematica') refreshCinemaUI();
  // Marcar opción activa en el dropdown
  EDIT_MODES.forEach(m => {
    const opt = byId(EDIT_MENU_IDS[m]);
    if (opt) opt.classList.toggle('active', m === mode);
  });
}

export function setEditMode(mode) {
  if (!EDIT_MODES.includes(mode)) return;
  if (store.editMode !== mode) {
    // Al cambiar de editor se sueltan TODAS las selecciones: el objeto activo
    // y las selecciones de bloque (toma de cinemática / subtítulo), así cada
    // modo arranca limpio.
    clearActiveTarget();
    clearSubtitleSelection();
    clearQuizSelection();
    clearShotSelection();
  }
  store.editMode = mode;
  // El modo objetos habilita la selección/movimiento de props (antes era el
  // botón "✏️ Editar Objetos"); los otros modos lo apagan (los personajes
  // siempre se pueden mover).
  store.editObjects = (mode === 'objetos');
  applyEditMode();
  setStatus(`Modo Editar: ${EDIT_LABELS[mode]}`);
}

function cycleEditMode(dir) {
  const idx = EDIT_MODES.indexOf(store.editMode);
  const next = EDIT_MODES[(idx + dir + EDIT_MODES.length) % EDIT_MODES.length];
  setEditMode(next);
}

// Dropdown Editar
const menuEditar = byId('menuEditar');
const dropdownEditar = byId('menuEditarDropdown');
menuEditar?.addEventListener('click', (e) => {
  menuEditar.classList.toggle('open');
  e.stopPropagation();
});
byId('mnuEditEdificio')?.addEventListener('click', () => { setEditMode('edificio'); menuEditar?.classList.remove('open'); });
byId('mnuEditObjetos')?.addEventListener('click', () => { setEditMode('objetos'); menuEditar?.classList.remove('open'); });
byId('mnuEditPersonajes')?.addEventListener('click', () => { setEditMode('personajes'); menuEditar?.classList.remove('open'); });
byId('mnuEditSubtitulos')?.addEventListener('click', () => { setEditMode('subtitulos'); menuEditar?.classList.remove('open'); });
byId('mnuEditCinematica')?.addEventListener('click', () => { setEditMode('cinematica'); menuEditar?.classList.remove('open'); });

// Flechas del selector izquierdo
byId('btnEditModePrev')?.addEventListener('click', () => cycleEditMode(-1));
byId('btnEditModeNext')?.addEventListener('click', () => cycleEditMode(1));

// Cerrar dropdown al click fuera (extiende el handler de Archivo)
document.addEventListener('click', () => menuEditar?.classList.remove('open'));

// Inicializar estado visual
applyEditMode();