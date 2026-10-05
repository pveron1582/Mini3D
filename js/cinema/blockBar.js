// js/cinema/blockBar.js — Barra de bloques de la timeline (🎬 ↻ ⧉ 🗑 ✕ 📌).
//
// Los bloques ya NO llevan iconos adentro: un clic los selecciona (borde
// blanco), otro clic afuera suelta el foco, doble clic o 📌 los fija en rojo
// (no se puede elegir otro ni cambiar de modo hasta soltarlo). Sin selección,
// los botones se ven semioscuros (deshabilitados) y no hacen nada.
// Cada pista conserva su lógica; acá solo se orquesta sobre el bloque vigente.
//
// RF-20 (2026-10-04): modo EDICIÓN DE CAMINO. Con un bloque de movimiento
// vigente, 🎬 entra en modo edición de camino: el icono se pone azul, aparece
// un botón ⦿⦿ (dos círculos: muestra/oculta los puntos), un desplegable de
// acción (caminar/correr) y un desplegable de velocidad (×0.25…×8); la 🎬 se
// vuelve ✕ roja que cierra el modo. Todo vive en ESTA barra — el panel
// izquierdo no cambia (criterio de estabilidad de RF-20).

import { timeline, interactiveRegistry, blockPin, pinMatches, togglePinBlock, blockBus, charLaneBus, timelineBus, laneVis } from '../state.js';
// RF-20: MOVE_ACTIONS/SPEED_MULTS viven en charTrack.js (blockBar ya depende
// de charTrack — mismo sentido, sin ciclo).
import { byId } from '../dom.js';
import { setStatus } from '../media/recorder.js';
import { pushHistory } from '../undo.js';
import { setActiveTarget } from '../ui/selection.js';
import {
  getSelectedShot, scrubTo, resetShotToSnapshot, duplicateShot, deleteShot,
  clearSelection, subSelection, resetSubToSnapshot, duplicateSub, deleteSub,
  clearSubSelection
} from './timeline.js';
import {
  charBlockSelection, clearCharBlockSelection, resetCharBlock, deleteCharBlock,
  captureBlockPose, duplicateCharBlock, charBaseSelection, clearBaseSelection,
  resetCharBase, deleteCharBase, commitCharBase, caminoSelection, clearCaminoSelection,
  renderCharBlocks, togglePathEditMode, editingMoveInfo, setEditingMoveAction,
  setEditingMoveSpeedMult, moveMarkersVisible, toggleMoveMarkers, exitPathEditMode,
  MOVE_ACTIONS, SPEED_MULTS
} from './charTrack.js';
import {
  quizSelection, clearQuizSelection, resetQuizBlock, duplicateQuizBlock, deleteQuizBlock,
  renderQuizLane
} from './quizTrack.js';
import { cutCameraToShot } from './cinematics.js';

// Bloque vigente (uno solo a la vez en toda la línea) o null.
export function getSelectedBlock() {
  const shot = getSelectedShot();
  if (shot) return { kind: 'shot', ref: shot };
  const cb = charBlockSelection();
  if (cb) return { kind: 'char', ref: cb };
  const base = charBaseSelection();
  if (base && interactiveRegistry.has(base)) return { kind: 'charbase', ref: base };
  const cam = caminoSelection();
  if (cam) return { kind: 'camino', ref: cam.charId };
  const sub = subSelection();
  if (sub) return { kind: 'sub', ref: sub };
  const quiz = quizSelection();
  if (quiz) return { kind: 'quiz', ref: quiz };
  return null;
}

const BAR_BTNS = ['btnBlockCine', 'btnBlockReset', 'btnBlockDup', 'btnBlockDel', 'btnBlockClose', 'btnBlockPin'];

// ---------- Modo EDICIÓN DE CAMINO (RF-20, 2026-10-04) ----------
// Con un bloque de movimiento vigente, 🎬 entra en modo edición: el botón se
// pone azul, aparecen ⦿⦿ (mostrar/ocultar puntos) + 2 desplegables (acción y
// velocidad), y la 🎬 se vuelve ✕ roja que cierra el modo. El estado vive acá
// (UI de ESTA barra) y el editor 3D en charTrack.js (pathEdit); ambos se
// encienden/apagan juntos.
let pathBarEditing = false;

// ¿La barra está en modo edición de camino? (para tests y refrescos).
export function isPathBarEditing() { return pathBarEditing; }

// Sale del modo edición (restaura los botones normales). No toca el pin.
export function exitPathBarEdit() {
  if (!pathBarEditing) return;
  pathBarEditing = false;
  ensurePathBarControls(false);
  renderPathBarEdit();
  if (blockBus.refreshBar) blockBus.refreshBar();
}

// Crea (una vez) los controles del modo edición dentro del grupo de la barra.
function ensurePathBarControls(on) {
  const cine = byId('btnBlockCine');
  const group = cine ? cine.parentElement : null;
  if (!group) return;
  let dots = byId('btnPathDots');
  let actSel = byId('selPathAction');
  let spdSel = byId('selPathSpeed');
  if (on && !dots) {
    dots = document.createElement('button');
    dots.className = 'blender-btn';
    dots.id = 'btnPathDots';
    dots.title = 'Mostrar/ocultar los puntos del camino (verde/rojo/amarillos)';
    dots.textContent = '⦿⦿';
    dots.addEventListener('click', () => {
      const vis = toggleMoveMarkers();
      dots.classList.toggle('primary', vis);
      const info = editingMoveInfo();
      setStatus(vis ? 'Puntos del camino visibles.' : 'Puntos del camino ocultos (el camino sigue ahí).');
      if (info) setStatus((vis ? 'Puntos visibles' : 'Puntos ocultos') + ` · ${info.block.duration.toFixed(1)}s.`);
    });
    actSel = document.createElement('select');
    actSel.className = 'tl-input';
    actSel.id = 'selPathAction';
    actSel.title = 'Acción de movimiento del personaje';
    actSel.style.cssText = 'max-width:110px;';
    actSel.addEventListener('change', () => {
      if (setEditingMoveAction(actSel.value || null)) {
        renderPathBarEdit();
        setStatus(actSel.value ? `Camino: el personaje ${actSel.value === 'run' ? 'corre' : 'camina'}.` : 'Camino: sin animación de movimiento.');
      }
    });
    spdSel = document.createElement('select');
    spdSel.className = 'tl-input';
    spdSel.id = 'selPathSpeed';
    spdSel.title = 'Velocidad del recorrido (multiplica la base; la duración se recalcula)';
    spdSel.style.cssText = 'max-width:70px;';
    spdSel.addEventListener('change', () => {
      const mult = parseFloat(spdSel.value) || 1;
      if (setEditingMoveSpeedMult(mult)) {
        const info = editingMoveInfo();
        setStatus(`Camino a ×${mult}: ${info ? info.block.duration.toFixed(1) + 's' : ''} (piernas sincronizadas).`);
      }
    });
    group.insertBefore(dots, cine.nextSibling);
    group.insertBefore(actSel, dots.nextSibling);
    group.insertBefore(spdSel, actSel.nextSibling);
  }
  if (dots) dots.style.display = on ? '' : 'none';
  if (actSel) actSel.style.display = on ? '' : 'none';
  if (spdSel) spdSel.style.display = on ? '' : 'none';
}

// Sincroniza el modo edición con el estado real: icono azul, ⦿⦿, desplegables
// con los valores vigentes, y 🎬 convertida en ✕ roja que cierra el modo.
function renderPathBarEdit() {
  const cine = byId('btnBlockCine');
  if (!cine) return;
  const info = editingMoveInfo();
  // Si el editor 3D se cerró por otro lado, el modo de la barra se apaga solo.
  if (pathBarEditing && !info) {
    pathBarEditing = false;
    ensurePathBarControls(false);
  }
  cine.classList.toggle('primary', pathBarEditing);
  cine.textContent = pathBarEditing ? '✕' : '🎬';
  cine.style.color = pathBarEditing ? '#ff6b6b' : '';
  cine.title = pathBarEditing
    ? 'Cerrar el editor del camino (restaura los botones)'
    : 'Ir al bloque: aguja al inicio + abrir su editor';
  if (!pathBarEditing) return;
  ensurePathBarControls(true);
  const dots = byId('btnPathDots');
  if (dots) dots.classList.toggle('primary', moveMarkersVisible());
  const actSel = byId('selPathAction');
  if (actSel && actSel.options.length === 0) {
    MOVE_ACTIONS.forEach(m => {
      const o = document.createElement('option');
      o.value = m.id; o.textContent = m.label;
      actSel.appendChild(o);
    });
  }
  if (actSel && info) actSel.value = info.block.actions[info.charId].action || MOVE_ACTIONS[0].id;
  const spdSel = byId('selPathSpeed');
  if (spdSel && spdSel.options.length === 0) {
    SPEED_MULTS.forEach(m => {
      const o = document.createElement('option');
      o.value = String(m); o.textContent = '×' + m;
      spdSel.appendChild(o);
    });
  }
  if (spdSel && info) spdSel.value = String(info.move.speedMult || 1);
}

// Entra al modo edición de camino para el bloque de movimiento dado.
function enterPathBarEdit(block, charId) {
  togglePathEditMode(block, charId);
  if (!editingMoveInfo()) return;
  pathBarEditing = true;
  ensurePathBarControls(true);
  renderPathBarEdit();
  scrubTo(block.start);
  if (blockBus.refreshBar) blockBus.refreshBar();
  setStatus('Editando camino: ⦿⦿ muestra/oculta puntos · desplegables de acción y velocidad · ✕ cierra.');
}

// Habilitado/deshabilitado según haya bloque vigente (⧉ no vale para la base).
export function refreshBlockBar() {
  const sel = getSelectedBlock();
  BAR_BTNS.forEach(id => {
    const b = byId(id);
    if (!b) return;
    b.disabled = !sel || (id === 'btnBlockDup' && sel.kind === 'charbase');
  });
  const pin = byId('btnBlockPin');
  if (pin) pin.classList.toggle('primary', !!(sel && pinMatches(sel.kind, sel.ref)));
  // RF-20 (2026-10-04): el modo edición del camino se sincroniza en cada
  // refresco (si el editor 3D se cerró por otro lado, la barra se apaga sola).
  renderPathBarEdit();
}

function needSel() {
  const sel = getSelectedBlock();
  if (!sel) setStatus('Elegí un bloque primero (click para editar, doble clic para fijar).');
  return sel;
}

// Deseleccionar todo (click afuera; respeta el pin).
export function deselectAllBlocks() {
  if (blockPin.kind) {
    setStatus('Bloque fijado con 📌: soltalo (doble clic o 📌).');
    return;
  }
  clearSelection();
  clearCharBlockSelection();
  clearSubSelection();
  clearQuizSelection();
  if (blockBus.refreshBar) blockBus.refreshBar();
}

function renderAllLanes() {
  if (timelineBus.renderShots) timelineBus.renderShots();
  renderCharBlocks();
  renderQuizLane();
}

// ---------- Acciones (una por botón, según el bloque vigente) ----------

// 🎬 Ir al bloque: aguja al inicio + abrir su editor.
// RF-20 (2026-10-04): en modo edición de camino la 🎬 es una ✕ roja que
// cierra el modo (restaura los botones). Con bloque de movimiento vigente
// entra al modo edición (icono azul + ⦿⦿ + desplegables).
function blockGo(sel) {
  if (pathBarEditing) {
    exitPathEditMode();
    exitPathBarEdit();
    renderAllLanes();
    setStatus('Editor del camino cerrado.');
    return;
  }
  if (sel.kind === 'shot') {
    scrubTo(sel.ref.start);
    if (laneVis.camera !== false) cutCameraToShot(sel.ref.camMode, sel.ref.subjectId, sel.ref);
    setStatus('Toma: aguja al inicio' + (laneVis.camera !== false ? ' y cámara del plano.' : ' (cámara libre: no se mueve).'));
  } else if (sel.kind === 'char') {
    const solo = Object.keys(sel.ref.actions || {})[0];
    const a = solo && sel.ref.actions[solo];
    if (solo && a && a.move) {
      // Bloque de movimiento: 🎬 entra al modo edición del camino
      // (icono azul + ⦿⦿ + desplegables de acción y velocidad — RF-20).
      if (interactiveRegistry.has(solo)) setActiveTarget(solo);
      enterPathBarEdit(sel.ref, solo);
    } else {
      if (solo && interactiveRegistry.has(solo)) setActiveTarget(solo);
      scrubTo(sel.ref.start);
      setStatus('Cuadro: aguja al inicio.');
    }
  } else if (sel.kind === 'charbase') {
    scrubTo(0);
    setStatus('Base: aguja al inicio de la escena.');
  } else if (sel.kind === 'camino') {
    if (!charLaneBus.isEditing(sel.ref)) charLaneBus.toggleEditor(sel.ref);
    scrubTo(0);
    setStatus('Camino: editor abierto desde el inicio.');
  } else if (sel.kind === 'sub') {
    scrubTo(sel.ref.start);
    setStatus('Subtítulo: aguja al inicio.');
  } else if (sel.kind === 'quiz') {
    scrubTo(sel.ref.start);
    setStatus('Cartel: aguja al inicio.');
  }
  if (blockBus.refreshBar) blockBus.refreshBar();
}

// ↻ Restablecer: descarta cambios, sigue editando.
function blockReset(sel) {
  if (sel.kind === 'shot') resetShotToSnapshot();
  else if (sel.kind === 'char') resetCharBlock();
  else if (sel.kind === 'charbase') resetCharBase();
  else if (sel.kind === 'camino') {
    charLaneBus.discardPathDraft();
    setStatus('Recorrido restablecido (se sigue editando).');
    renderCharBlocks();
  }
  else if (sel.kind === 'sub') resetSubToSnapshot();
  else if (sel.kind === 'quiz') resetQuizBlock();
  if (blockBus.refreshBar) blockBus.refreshBar();
}

// ⧉ Duplicar al final (la base no se duplica).
function blockDup(sel) {
  if (sel.kind === 'shot') duplicateShot();
  else if (sel.kind === 'char') {
    const solo = Object.keys(sel.ref.actions || {})[0];
    const entry = solo ? interactiveRegistry.get(solo) : null;
    if (!entry) return;
    const copy = duplicateCharBlock(sel.ref, entry.id);
    if (!copy) return;
    pushHistory();
    if (timelineBus.refreshDuration) timelineBus.refreshDuration();
    setStatus(`Bloque de ${entry.name} duplicado al final (${copy.start.toFixed(1)}s).`);
  }
  else if (sel.kind === 'charbase') setStatus('La base (toda la escena) no se duplica.');
  else if (sel.kind === 'camino') {
    if (charLaneBus.duplicatePath(sel.ref)) {
      setStatus('Recorrido duplicado: lo camina dos veces.');
    } else {
      setStatus('Sin recorrido para duplicar.');
    }
  }
  else if (sel.kind === 'sub') duplicateSub();
  else if (sel.kind === 'quiz') duplicateQuizBlock();
  if (blockBus.refreshBar) blockBus.refreshBar();
}

// 🗑 Borrar el bloque vigente.
function blockDel(sel) {
  if (sel.kind === 'shot') deleteShot();
  else if (sel.kind === 'char') deleteCharBlock();
  else if (sel.kind === 'charbase') deleteCharBase();
  else if (sel.kind === 'camino') {
    charLaneBus.deletePath(sel.ref);
    clearCaminoSelection();
    renderCharBlocks();
    setStatus('Recorrido eliminado.');
  }
  else if (sel.kind === 'sub') deleteSub();
  else if (sel.kind === 'quiz') deleteQuizBlock();
  if (blockBus.refreshBar) blockBus.refreshBar();
}

// ✕ Cerrar: termina la edición quedándose con lo hecho.
function blockClose(sel) {
  if (sel.kind === 'shot') clearSelection();
  else if (sel.kind === 'char') {
    captureBlockPose(sel.ref);
    clearCharBlockSelection();
    pushHistory();
    setStatus('Cuadro cerrado.');
  }
  else if (sel.kind === 'charbase') {
    commitCharBase();
    clearBaseSelection();
  }
  else if (sel.kind === 'camino') {
    if (charLaneBus.isEditing(sel.ref)) charLaneBus.toggleEditor(sel.ref);
    clearCaminoSelection();
    renderCharBlocks();
    pushHistory();
    setStatus('Recorrido cerrado.');
  }
  else if (sel.kind === 'sub') clearSubSelection();
  else if (sel.kind === 'quiz') clearQuizSelection();
  // RF-20 (2026-10-04): cerrar cualquier bloque apaga el modo edición del
  // camino (la ✕ roja vuelve a ser 🎬, puntos fantasma fuera).
  if (pathBarEditing) exitPathBarEdit();
  // RF-53 (fix 2026-10-03): cerrar con ✕ también suelta la fijación del bloque.
  if (pinMatches(sel.kind, sel.ref)) {
    blockPin.kind = null;
    blockPin.ref = null;
  }
  if (blockBus.refreshBar) blockBus.refreshBar();
}

// 📌 Fijar/soltar el pin del bloque vigente.
// RF-53 (fix 2026-10-03): si hay CUALQUIER pin activo, el primer clic lo
// suelta — incluso si el bloque ya no está vigente (p. ej. un camino cuyo
// editor se cerró: getSelectedBlock() devuelve null y antes el pin quedaba
// huérfano, imposible de soltar).
export function blockPinToggle() {
  if (blockPin.kind) {
    togglePinBlock(blockPin.kind, blockPin.ref);
    renderAllLanes();
    if (blockBus.refreshBar) blockBus.refreshBar();
    setStatus('Pin soltado.');
    return;
  }
  const sel = needSel();
  if (!sel) return;
  togglePinBlock(sel.kind, sel.ref);
  renderAllLanes();
  if (blockBus.refreshBar) blockBus.refreshBar();
  setStatus('Bloque fijado en rojo: doble clic o 📌 para soltarlo.');
}

function wireBar() {
  const on = (id, fn) => byId(id)?.addEventListener('click', fn);
  on('btnBlockCine', () => { const s = needSel(); if (s) blockGo(s); });
  on('btnBlockReset', () => { const s = needSel(); if (s) blockReset(s); });
  on('btnBlockDup', () => { const s = needSel(); if (s) blockDup(s); });
  on('btnBlockDel', () => { const s = needSel(); if (s) blockDel(s); });
  on('btnBlockClose', () => { const s = needSel(); if (s) blockClose(s); });
  on('btnBlockPin', blockPinToggle);
}

wireBar();
blockBus.deselectAll = deselectAllBlocks;
blockBus.refreshBar = refreshBlockBar;
refreshBlockBar();
