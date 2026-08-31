// js/quizTrack.js — Pista 📋 QUIZ: carteles de pregunta (quiz) de la escena.
// Bloques posicionables en la línea de tiempo (varios, intercalados con los
// subtítulos), editor en el modo 📝 Textos (pregunta, 3 opciones, correcta,
// tiempo y tramo inicio/fin), disparo por tramo (no por toma) y coexistencia:
// mientras un cartel está en pantalla, los subtítulos de ese tramo no se
// dibujan (el cartel los tapa — se resuelven en drawQuizAt/ocultaSubsAt).
// Compatibilidad: los proyectos viejos traían shot.quiz anclado a una toma;
// al abrirlos, projectFiles.js lo migra a esta pista.

import { quizTrack, timeline } from '../state.js';
import { byId } from '../dom.js';
import { showQuiz, resetQuiz, quizIsActive } from '../media/quiz.js';
import { pushHistory } from '../undo.js';
import { setStatus } from '../media/recorder.js';

let quizCounter = 0;
export function bumpQuizCounter(n) { quizCounter = Math.max(quizCounter, n); }

// ---------- Bloques de la pista ----------
const LANE_LABEL_W = 110; // mismo ancho del rótulo que las otras pistas

function pxPerSec() {
  // La escala la marca la pista de tomas: misma duración, mismo ancho.
  const track = byId('timelineTrack');
  if (!track) return 40;
  const w = track.clientWidth - LANE_LABEL_W - 24;
  return Math.max(10, w / Math.max(1, timeline.duration || 10));
}

let selectedQuiz = null;

export function quizSelection() { return selectedQuiz; }
export function clearQuizSelection() {
  if (selectedQuiz) {
    selectedQuiz = null;
    setQuizFieldsEnabled(false);
    renderQuizLane();
  }
}

function setQuizFieldsEnabled(on) {
  ['quizEditQuestion', 'quizEditOptA', 'quizEditOptB', 'quizEditOptC',
   'quizEditCorrect', 'quizEditDuration', 'quizEditStart', 'quizEditEnd'].forEach(id => {
    const el = byId(id);
    if (el) el.disabled = !on;
  });
  const del = byId('quizEditDelete');
  if (del) del.disabled = !on;
}

function openQuizEditor(q) {
  if (!q || !quizTrack.includes(q)) return;
  // Exclusividad: elegir un cartel libera la toma y el subtítulo en edición.
  // Se avisa por evento (la timeline escucha y limpia) para no crear un ciclo
  // de imports quizTrack ↔ timeline.
  window.dispatchEvent(new CustomEvent('quiz-block-selected'));
  selectedQuiz = q;
  const set = (id, v) => { const el = byId(id); if (el) el.value = v; };
  set('quizEditQuestion', q.question || '');
  const opts = q.options || [];
  set('quizEditOptA', opts[0] || '');
  set('quizEditOptB', opts[1] || '');
  set('quizEditOptC', opts[2] || '');
  set('quizEditCorrect', String(q.correct ?? 0));
  set('quizEditDuration', String(q.duration ?? 10));
  set('quizEditStart', (q.start ?? 0).toFixed(1));
  set('quizEditEnd', (q.end ?? 2).toFixed(1));
  setQuizFieldsEnabled(true);
  renderQuizLane();
}

export function renderQuizLane() {
  const lane = byId('quizLane');
  if (!lane) return;
  // Preserva el rótulo "📋 QUIZ": solo se quitan los bloques.
  lane.querySelectorAll('.tl-quiz').forEach(el => el.remove());
  const pps = pxPerSec();
  quizTrack.forEach(q => {
    const el = document.createElement('div');
    el.className = 'tl-sub tl-quiz' + (q === selectedQuiz ? ' selected' : '');
    el.style.left = (LANE_LABEL_W + q.start * pps) + 'px';
    el.style.width = Math.max(18, (q.end - q.start) * pps) + 'px';

    const label = document.createElement('span');
    label.className = 'tl-shot-label';
    label.textContent = '📋 ' + (q.question || 'Pregunta');
    el.appendChild(label);

    const left = document.createElement('div');
    left.className = 'tl-handle tl-handle-l';
    const right = document.createElement('div');
    right.className = 'tl-handle tl-handle-r';
    el.appendChild(left);
    el.appendChild(right);

    // ✕ solo en el bloque seleccionado: termina su edición (y guarda).
    if (q === selectedQuiz) {
      const closeQuiz = document.createElement('div');
      closeQuiz.className = 'tl-shot-close';
      closeQuiz.textContent = '✕';
      closeQuiz.title = 'Terminar edición del cartel (guarda)';
      closeQuiz.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); });
      closeQuiz.addEventListener('click', (ev) => {
        ev.stopPropagation();
        clearQuizSelection();
        pushHistory();
      });
      el.appendChild(closeQuiz);
    }

    el.title = `${q.start.toFixed(1)}s → ${q.end.toFixed(1)}s: ${q.question || 'Pregunta'} (click para editar; arrastrá bordes para ajustar)`;
    el.addEventListener('pointerdown', (e) => beginQuizDrag(e, q, el));
    el.addEventListener('click', () => {
      if (el.dataset.dragged === '1') { el.dataset.dragged = ''; return; }
      openQuizEditor(q);
    });
    lane.appendChild(el);
  });
}

// ---------- Arrastre (mover / estirar bordes) ----------
let quizDragState = null;

function beginQuizDrag(e, q, el) {
  if (timeline.playing) return;
  e.preventDefault();
  e.stopPropagation();
  const rect = el.getBoundingClientRect();
  const edge = 8;
  const mode = (e.clientX - rect.left <= edge) ? 'l'
    : (rect.right - e.clientX <= edge) ? 'r'
    : 'move';
  quizDragState = { q, mode, startX: e.clientX, origStart: q.start, origDur: q.end - q.start, moved: false };
  const pps = pxPerSec();
  const onMove = (ev) => {
    if (!quizDragState) return;
    if (!quizDragState.moved) {
      if (Math.abs(ev.clientX - quizDragState.startX) <= 3) return;
      quizDragState.moved = true;
      el.dataset.dragged = '1';
    }
    const dSec = (ev.clientX - quizDragState.startX) / pps;
    const ds = Math.round(dSec * 10) / 10;
    if (quizDragState.mode === 'move') {
      q.start = Math.max(0, quizDragState.origStart + ds);
      q.end = q.start + quizDragState.origDur;
    } else if (quizDragState.mode === 'l') {
      q.start = Math.min(Math.max(0, quizDragState.origStart + ds), quizDragState.origStart + quizDragState.origDur - 0.5);
    } else {
      q.end = Math.max(quizDragState.origStart + 0.5, quizDragState.origStart + quizDragState.origDur + ds);
    }
    q.start = Math.round(q.start * 10) / 10;
    q.end = Math.round(q.end * 10) / 10;
    renderQuizLane();
    syncQuizFields(q);
  };
  const onUp = () => {
    if (quizDragState && quizDragState.moved) pushHistory();
    quizDragState = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function syncQuizFields(q) {
  if (selectedQuiz !== q) return;
  const s = byId('quizEditStart'), e2 = byId('quizEditEnd');
  if (s) s.value = q.start.toFixed(1);
  if (e2) e2.value = q.end.toFixed(1);
}

// ---------- Edición en vivo (todo se guarda mientras se escribe) ----------
function quizValid() {
  return !!selectedQuiz && quizTrack.includes(selectedQuiz);
}

function bindQuizField(id, apply) {
  const el = byId(id);
  el?.addEventListener('input', () => {
    if (!quizValid()) return;
    apply(selectedQuiz, el.value);
    renderQuizLane();
  });
  el?.addEventListener('change', pushHistory);
}

bindQuizField('quizEditQuestion', (q, v) => { q.question = v; });
bindQuizField('quizEditOptA', (q, v) => { q.options[0] = v; });
bindQuizField('quizEditOptB', (q, v) => { q.options[1] = v; });
bindQuizField('quizEditOptC', (q, v) => { q.options[2] = v; });
bindQuizField('quizEditCorrect', (q, v) => { q.correct = parseInt(v, 10) || 0; });
bindQuizField('quizEditDuration', (q, v) => { q.duration = Math.max(1, parseInt(v, 10) || 10); });
bindQuizField('quizEditStart', (q, v) => {
  const s = Math.max(0, parseFloat(v) || 0);
  q.start = Math.min(s, q.end - 0.5);
});
bindQuizField('quizEditEnd', (q, v) => {
  const e2 = Math.max(q.start + 0.5, parseFloat(v) || q.start + 0.5);
  q.end = e2;
});

// Borrar el cartel seleccionado
byId('quizEditDelete')?.addEventListener('click', () => {
  if (!quizValid()) return;
  const i = quizTrack.indexOf(selectedQuiz);
  if (i >= 0) quizTrack.splice(i, 1);
  selectedQuiz = null;
  setQuizFieldsEnabled(false);
  renderQuizLane();
  pushHistory();
  setStatus('Cartel de pregunta eliminado.');
});

// Nuevo cartel en el cabezal de reproducción
byId('quizEditNew')?.addEventListener('click', () => {
  const start = Math.max(0, Math.round(timeline.time * 10) / 10);
  const q = {
    id: 'quiz' + (++quizCounter),
    question: '¿Pregunta?',
    options: ['Opción A', 'Opción B', 'Opción C'],
    correct: 0,
    duration: 10,
    start,
    end: start + 10
  };
  quizTrack.push(q);
  quizTrack.sort((a, b) => a.start - b.start);
  openQuizEditor(q);
  pushHistory();
  setStatus('Cartel de pregunta creado: editá la pregunta y sus opciones.');
});

// ---------- Disparo y coexistencia con subtítulos ----------
// El cartel activo por tiempo (el de la pista cuyo tramo contiene t), o null.
export function quizAt(t) {
  return quizTrack.find(q => t >= q.start && t < q.end) || null;
}

// ¿Los subtítulos deben dibujarse en t? No si hay un cartel en pantalla:
// mientras el cartel está activo, los subtítulos de ese tramo no se ven.
// Si el reloj del cartel ya terminó (cartel oculto dentro del mismo tramo),
// los subtítulos vuelven: es "uno u otro en pantalla", no por tramo completo.
export function subtitlesHiddenAt(t) {
  return quizAt(t) ? quizIsActive() : false;
}

// Arranca/reinicia el cartel según el tiempo de la escena (lo llama la
// timeline cada frame). Devuelve true si hay cartel activo.
export function quizPlayTick(dt) {
  const q = quizAt(timeline.time);
  if (q) {
    if (!quizShown || quizShown !== q) {
      quizShown = q;
      showQuiz(q);
    }
    return true;
  }
  if (quizShown) {
    quizShown = null;
    resetQuiz();
  }
  return false;
}
let quizShown = null;

// Pausa de simulación: el reloj del cartel sigue con el de la escena (quiz.js).
export { resetQuiz };
