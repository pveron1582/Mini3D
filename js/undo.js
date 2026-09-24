import { byId, qs, qsa } from './dom.js';
import { setStatus } from './media/recorder.js';
import { sessionDirty } from './state.js';

// ==========================================
// UNDO / REDO (historial de escena)
// ==========================================
// Cada cambio confirmado guarda una foto completa de la escena (JSON).
// Deshacer/Rehacer restaura esa foto. Botones en la barra superior y
// atajos Ctrl+Z / Ctrl+Y (o Ctrl+Shift+Z).
//
// Fase 3: este módulo ya NO importa projectFiles.js (rompía el último ciclo
// projectFiles → catalog → undo → projectFiles). Las funciones de
// serialización/aplicación se INYECTAN desde main.js (initUndo), que conoce
// ambos lados sin crear dependencia circular.

const MAX_HISTORY = 60;
let history = [];
let index = -1;
let restoring = false;

// Funciones inyectadas (llegan en initUndo). Antes de inicializar, el undo
// es un no-op seguro: solo registrarían snapshots vacíos.
let serializeScene = () => ({});
let applyScene = () => {};

const undoBtn = byId('undoBtn');
const redoBtn = byId('redoBtn');

function updateButtons() {
  if (undoBtn) undoBtn.disabled = index <= 0;
  if (redoBtn) redoBtn.disabled = index >= history.length - 1;
}

// Guardar el estado actual. Llamar al confirmar cada cambio.
export function pushHistory() {
  if (restoring) return;
  sessionDirty.value = true; // hay cambios sin guardar
  const snap = JSON.stringify(serializeScene());
  if (index >= 0 && history[index] === snap) return; // sin cambios
  history = history.slice(0, index + 1);
  history.push(snap);
  if (history.length > MAX_HISTORY) history.shift();
  index = history.length - 1;
  updateButtons();
}

// Reinicia el historial dejando SOLO el estado actual como punto de partida.
// Se usa al cargar/crear un proyecto: el primer Undo debe volver a ESTE
// estado, no al arranque del editor (si no, abrir un archivo y deshacer
// borraba la escena entera). No marca "sin guardar" (cargar no es una edición)
// y, si la llamada llega durante un Undo/Redo en curso (restoring), no toca
// la pila para no perder el Redo.
export function resetHistory() {
  if (restoring) return;
  history = [];
  index = -1;
  history.push(JSON.stringify(serializeScene()));
  index = 0;
  updateButtons();
}

export function undo() {
  if (index <= 0) { setStatus('Nada que deshacer.'); return; }
  index--;
  restore();
  setStatus('Cambio deshecho.');
}

export function redo() {
  if (index >= history.length - 1) { setStatus('Nada que rehacer.'); return; }
  index++;
  restore();
  setStatus('Cambio rehecho.');
}

function restore() {
  restoring = true;
  try {
    applyScene(JSON.parse(history[index]));
  } finally {
    restoring = false;
  }
  updateButtons();
}

// Historial inicial (estado de arranque de la escena).
// `hooks`: { serialize, apply } — inyectados por main.js para romper el ciclo
// de imports con projectFiles.js (ver comentario arriba).
export function initUndo(hooks = {}) {
  if (typeof hooks.serialize === 'function') serializeScene = hooks.serialize;
  if (typeof hooks.apply === 'function') applyScene = hooks.apply;
  history = [];
  index = -1;
  pushHistory();
}

undoBtn?.addEventListener('click', undo);
redoBtn?.addEventListener('click', redo);

document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
});