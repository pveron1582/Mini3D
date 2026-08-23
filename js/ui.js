import * as THREE from 'three';
import { camera, canvas, controls } from './core.js';
import { store, cinema, view, playbackInstances, interactiveRegistry } from './state.js';
import { getActiveEntry, getActiveObject, setActiveTarget, updateSelectionRing } from './selection.js';
import { updateGizmoPosition } from './gizmo.js';
import {
  setCamView, cinemaDeactivate, startAllPlaybacks, stopAllPlaybacks
} from './cinematics.js';
import { setEnvironment } from './environment.js';
import { setStatus } from './recorder.js';
import { pushHistory } from './undo.js';
import { getWallTexture, wallTextureNames } from './office.js';

// ==========================================
// OUTLINER / JERARQUÍA COMPLETA
// ==========================================
export function populateOutliner() {
  const tree = document.getElementById('outlinerTree');
  if (!tree) return;
  tree.innerHTML = '';

  const categories = [
    { title: '🧍 PERSONAJES', type: ['human', 'pet'] },
    { title: '💻 EQUIPOS IT & HARDWARE', type: ['prop'] },
    { title: '🏢 MOBILIARIO DE OFICINA', type: ['furniture'] }
  ];

  categories.forEach(cat => {
    const header = document.createElement('li');
    header.className = 'outliner-category-header';
    header.textContent = cat.title;
    tree.appendChild(header);

    interactiveRegistry.forEach(entry => {
      if (cat.type.includes(entry.type)) {
        const item = document.createElement('li');
        item.className = 'outliner-item' + (entry.id === store.activeTarget ? ' selected' : '');
        item.setAttribute('data-id', entry.id);

        let icon = '📦';
        if (entry.type === 'human') icon = '🧍';
        else if (entry.type === 'pet') icon = '🐾';
        else if (entry.type === 'prop') icon = '💻';

        item.innerHTML = `<span>${icon} ${entry.name}</span><span>👁️</span>`;
        item.addEventListener('click', () => setActiveTarget(entry.id));
        tree.appendChild(item);
      }
    });
  });
}

// ==========================================
// CONTROLS, ACTIONS & SLIDERS
// ==========================================
export function updateActionButtonsState(currentAction) {
  const container = document.querySelector('.action-grid:not([style*="display: none"])');
  if (!container) return;
  container.querySelectorAll('.action-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-action') === currentAction);
  });
}

// Bind Action Buttons Click
document.addEventListener('click', (e) => {
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
const sliderX = document.getElementById('sliderX');
const numX = document.getElementById('numX');
const sliderY = document.getElementById('sliderY');
const numY = document.getElementById('numY');
const sliderZ = document.getElementById('sliderZ');
const numZ = document.getElementById('numZ');
const sliderRotY = document.getElementById('sliderRotY');
const numRotY = document.getElementById('numRotY');

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
  updateSelectionRing();
}

function applySlidersToTarget() {
  const obj = getActiveObject();
  if (!obj) return;

  obj.position.x = parseFloat(sliderX.value) || 0;
  obj.position.y = parseFloat(sliderY.value) || 0;
  obj.position.z = parseFloat(sliderZ.value) || 0;
  obj.rotation.y = THREE.MathUtils.degToRad(parseFloat(sliderRotY.value) || 0);

  // Límite de altura del piso (Y >= 0, o el piso propio del personaje)
  const entry = getActiveEntry();
  const minY = entry && entry.rig && entry.rig.groundY ? entry.rig.groundY : 0;
  if (obj.position.y < minY) obj.position.y = minY;

  numX.value = obj.position.x.toFixed(2);
  numY.value = obj.position.y.toFixed(2);
  numZ.value = obj.position.z.toFixed(2);
  numRotY.value = Math.round(parseFloat(sliderRotY.value) || 0);

  updateSelectionRing();
  updateGizmoPosition();
}

sliderX.addEventListener('input', applySlidersToTarget);
sliderY.addEventListener('input', applySlidersToTarget);
sliderZ.addEventListener('input', applySlidersToTarget);
sliderRotY.addEventListener('input', applySlidersToTarget);

numX.addEventListener('input', () => { sliderX.value = numX.value; applySlidersToTarget(); });
numY.addEventListener('input', () => { sliderY.value = numY.value; applySlidersToTarget(); });
numZ.addEventListener('input', () => { sliderZ.value = numZ.value; applySlidersToTarget(); });
numRotY.addEventListener('input', () => { sliderRotY.value = numRotY.value; applySlidersToTarget(); });

// Confirmar cambios de transformación en el historial (al soltar el slider)
[sliderX, sliderY, sliderZ, sliderRotY, numX, numY, numZ, numRotY].forEach(inp => {
  inp.addEventListener('change', pushHistory);
});

document.getElementById('btnResetTargetPos')?.addEventListener('click', () => {
  const obj = getActiveObject();
  if (obj) {
    obj.position.set(0, 0, 0);
    obj.rotation.set(0, 0, 0);
    syncSlidersFromTarget();
    pushHistory();
  }
});

document.getElementById('btnFaceCamera')?.addEventListener('click', () => {
  const obj = getActiveObject();
  if (obj) {
    obj.lookAt(camera.position.x, obj.position.y, camera.position.z);
    syncSlidersFromTarget();
    pushHistory();
  }
});

// Modo "Editar Objetos": los muebles/objetos solo se pueden seleccionar y
// mover con este modo activado. Los personajes siempre.
store.editObjects = false;

const btnEditObjects = document.getElementById('btnEditObjects');
btnEditObjects?.addEventListener('click', () => {
  store.editObjects = !store.editObjects;
  btnEditObjects.textContent = store.editObjects ? '✏️ Editar Objetos: ON' : '✏️ Editar Objetos: OFF';
  btnEditObjects.classList.toggle('primary', store.editObjects);
});

const CHARACTER_TARGETS = ['human1', 'human2', 'human3', 'dog', 'cat'];
document.querySelectorAll('.target-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-target');
    if (!CHARACTER_TARGETS.includes(target) && !store.editObjects) return;
    setActiveTarget(target);
  });
});


// ==========================================
// EDITOR DE PARED (largo / alto / espesor / textura)
// ==========================================
const wallSection = document.getElementById('section-wall');
const wallLen = document.getElementById('wallLen');
const wallLenNum = document.getElementById('wallLenNum');
const wallHeight = document.getElementById('wallHeight');
const wallHeightNum = document.getElementById('wallHeightNum');
const wallThick = document.getElementById('wallThick');
const wallThickNum = document.getElementById('wallThickNum');
const wallTextureSel = document.getElementById('wallTexture');

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
  if (wallSection) wallSection.style.display = wd ? 'block' : 'none';
  if (!wd) return;
  if (wallLen) wallLen.value = wd.w; if (wallLenNum) wallLenNum.value = wd.w.toFixed(2);
  if (wallHeight) wallHeight.value = wd.h; if (wallHeightNum) wallHeightNum.value = wd.h.toFixed(2);
  if (wallThick) wallThick.value = wd.d; if (wallThickNum) wallThickNum.value = wd.d.toFixed(2);
  if (wallTextureSel && obj.userData.wallMesh) {
    const cur = wallTextureNames.find(n => getWallTexture(n) === obj.userData.wallMesh.material.map);
    wallTextureSel.value = cur || wallTextureNames[0];
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

// --- Botones del sistema de Cinemática ---
document.getElementById('btnCinemaExit')?.addEventListener('click', () => {
  cinemaDeactivate();
});

document.getElementById('btnCinemaPlayAll')?.addEventListener('click', () => {
  if (playbackInstances.size > 0) {
    stopAllPlaybacks();
    setStatus('Se detuvieron todas las cinemáticas.');
  } else {
    if (!startAllPlaybacks()) setStatus('No hay recorridos configurados todavía.');
    else setStatus('Reproduciendo TODAS las cinemáticas configuradas...');
  }
});

document.getElementById('btnCinemaReverse')?.addEventListener('click', () => {
  cinema.reversed = !cinema.reversed;
  const btn = document.getElementById('btnCinemaReverse');
  if (btn) btn.classList.toggle('primary', cinema.reversed);
  setStatus(cinema.reversed ? 'Sentido invertido (Final → Inicio).' : 'Sentido normal (Inicio → Final).');
});

const cinemaSpeedInput = document.getElementById('cinemaSpeed');
const cinemaSpeedVal = document.getElementById('cinemaSpeedVal');
cinemaSpeedInput?.addEventListener('input', () => {
  cinema.speed = parseFloat(cinemaSpeedInput.value) || 2;
  if (cinemaSpeedVal) cinemaSpeedVal.textContent = cinema.speed.toFixed(1);
});

document.getElementById('cinemaLoop')?.addEventListener('change', (e) => {
  cinema.loop = e.target.checked;
});

// --- Vistas de cámara (1ª persona, 3ª, persecución, cine fijo) ---
document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const v = btn.getAttribute('data-view');
    setCamView(v === view.mode ? 'orbit' : v);
  });
});
