// js/cinema/blockBar.js — Barra de bloques de la timeline (🎬 ↻ ⧉ 🗑 ✕ 📌).
//
// Los bloques ya NO llevan iconos adentro: un clic los selecciona (borde
// blanco), otro clic afuera suelta el foco, doble clic o 📌 los fija en rojo
// (no se puede elegir otro ni cambiar de modo hasta soltarlo). Sin selección,
// los botones se ven semioscuros (deshabilitados) y no hacen nada.
// Cada pista conserva su lógica; acá solo se orquesta sobre el bloque vigente.

import { timeline, interactiveRegistry, blockPin, pinMatches, togglePinBlock, blockBus, charLaneBus, timelineBus } from '../state.js';
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
  renderCharBlocks
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
function blockGo(sel) {
  if (sel.kind === 'shot') {
    scrubTo(sel.ref.start);
    cutCameraToShot(sel.ref.camMode, sel.ref.subjectId, sel.ref);
    setStatus('Toma: aguja al inicio y cámara del plano.');
  } else if (sel.kind === 'char') {
    const solo = Object.keys(sel.ref.actions || {})[0];
    if (solo && interactiveRegistry.has(solo)) setActiveTarget(solo);
    scrubTo(sel.ref.start);
    setStatus('Cuadro: aguja al inicio.');
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
  if (blockBus.refreshBar) blockBus.refreshBar();
}

// 📌 Fijar/soltar el pin del bloque vigente.
function blockPinToggle() {
  const sel = needSel();
  if (!sel) return;
  const pinned = togglePinBlock(sel.kind, sel.ref);
  renderAllLanes();
  if (blockBus.refreshBar) blockBus.refreshBar();
  setStatus(pinned ? 'Bloque fijado en rojo: doble clic o 📌 para soltarlo.' : 'Pin soltado.');
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
