import { serializeProject, applyProject } from './projectFiles.js';
import { byId, qs, qsa } from './dom.js';
import { setStatus } from './media/recorder.js';
import { sessionDirty } from './state.js';

// ==========================================
// UNDO / REDO (historial de escena)
// ==========================================
// Cada cambio confirmado guarda una foto completa de la escena (JSON).
// Deshacer/Rehacer restaura esa foto. Botones en la barra superior y
// atajos Ctrl+Z / Ctrl+Y (o Ctrl+Shift+Z).

const MAX_HISTORY = 60;
let history = [];
let index = -1;
let restoring = false;

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
  const snap = JSON.stringify(serializeProject());
  if (index >= 0 && history[index] === snap) return; // sin cambios
  history = history.slice(0, index + 1);
  history.push(snap);
  if (history.length > MAX_HISTORY) history.shift();
  index = history.length - 1;
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
    applyProject(JSON.parse(history[index]));
  } finally {
    restoring = false;
  }
  updateButtons();
}

// Historial inicial (estado de arranque de la escena)
export function initUndo() {
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