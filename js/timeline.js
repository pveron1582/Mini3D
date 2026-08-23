import { timeline, cinema, cinemaPaths, interactiveRegistry, recorderState } from './state.js';
import { startPlayback, stopAllPlaybacks, cutCameraToShot, setCamView, cinemaStorePath } from './cinematics.js';
import { startRecording, mediaRecorder, setStatus } from './recorder.js';
import { pushHistory } from './undo.js';

// ==========================================
// SECUENCIADOR DE ESCENAS (LÍNEA DE TIEMPO DE TOMAS)
// ==========================================
// Una "escena" es una lista de tomas de cámara sobre una línea de tiempo
// global: en cada momento se define a quién se ve y desde qué ángulo.
// Al reproducir la escena se reinician todos los recorridos cinemáticos
// (sin bucle) y las tomas van cortando la cámara.

const CAM_NAMES = {
  free: 'Vista Libre', fpv: '1ª Persona', third: '3ª Persona', top: 'Perseguir',
  cine1: 'Cine 1', cine2: 'Cine 2', cine3: 'Cine 3', orbit: 'Libre'
};
const SHOT_COLORS = ['#4772b3', '#3f9d6f', '#b3772e', '#8e5bb3', '#b3455c', '#4aa5a0'];

let shotCounter = 0;

function subjectName(id) {
  const e = interactiveRegistry.get(id);
  return e ? e.name : '';
}

export function sceneDuration() {
  return timeline.shots.reduce((m, s) => Math.max(m, s.start + s.duration), 0);
}

function refreshDuration() {
  timeline.duration = sceneDuration();
}

// ---------- Motor (llamado desde render.js cada frame) ----------
function currentShot(t) {
  let found = null;
  timeline.shots.forEach(s => {
    if (t >= s.start && t < s.start + s.duration) found = s;
  });
  return found;
}

export function updateTimeline(dt) {
  if (!timeline.playing) return;
  timeline.time += dt;

  const shot = currentShot(timeline.time);
  if (shot && shot.id !== timeline.activeShotId) {
    timeline.activeShotId = shot.id;
    cutCameraToShot(shot.camMode, shot.subjectId);
  }

  updatePlayheadUI();

  if (timeline.time >= timeline.duration) {
    finishScene();
  }
}

export function playScene() {
  // Guardar el recorrido en edición antes de reproducir
  if (cinema.active && cinema.targetId) cinemaStorePath(cinema.targetId);

  const playable = [];
  cinemaPaths.forEach((stored, id) => {
    if (stored.waypoints && stored.waypoints.length >= 2) playable.push(id);
  });
  if (playable.length === 0) {
    setStatus('No hay recorridos configurados: marca al menos un camino para armar la escena.');
    return false;
  }
  refreshDuration();
  if (timeline.shots.length === 0) {
    setStatus('No hay tomas en la línea de tiempo: agrega tomas con "＋ Nueva toma".');
    return false;
  }

  stopAllPlaybacks();
  playable.forEach(id => startPlayback(id, { loop: false }));

  timeline.time = 0;
  timeline.activeShotId = null;
  timeline.playing = true;
  const first = currentShot(0);
  if (first) {
    timeline.activeShotId = first.id;
    cutCameraToShot(first.camMode, first.subjectId);
  }
  updatePlayheadUI();
  setStatus(`Reproduciendo escena (${timeline.duration.toFixed(1)}s, ${playable.length} recorridos)...`);
  updateTransportUI();
  return true;
}

export function recordScene() {
  if (!playScene()) return;
  timeline.recording = true;
  startRecording(timeline.duration + 0.05);
  setStatus(`Grabando escena completa (${timeline.duration.toFixed(1)}s)...`);
}

export function stopScene() {
  if (!timeline.playing && !timeline.recording) return;
  timeline.playing = false;
  timeline.recording = false;
  stopAllPlaybacks();
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  setCamView('orbit');
  updatePlayheadUI();
  updateTransportUI();
  setStatus('Escena detenida.');
}

function finishScene() {
  timeline.playing = false;
  stopAllPlaybacks();
  if (timeline.recording) {
    timeline.recording = false;
    // el MediaRecorder lo detiene render.js al llegar a recordDuration
  } else {
    setCamView('orbit');
    setStatus('Escena terminada.');
  }
  updateTransportUI();
}

// ---------- UI: línea de tiempo ----------
const track = document.getElementById('timelineTrack');
const rulerEl = document.getElementById('timelineRuler');
const clockEl = document.getElementById('timelineClock');
const playSceneBtn = document.getElementById('btnPlayScene');
const recordSceneBtn = btnSafe('btnRecordScene');
const stopSceneBtn = btnSafe('btnStopScene');
const addShotBtn = btnSafe('btnAddShot');

function btnSafe(id) { return document.getElementById(id); }

function pxPerSec() {
  if (!track) return 40;
  const viewSpan = Math.max(timeline.duration, 20);
  return track.clientWidth / viewSpan;
}

function fmt(t) { return t.toFixed(1) + 's'; }

function renderShots() {
  if (!track) return;
  track.querySelectorAll('.tl-shot').forEach(el => el.remove());
  const pps = pxPerSec();
  timeline.shots.forEach(shot => {
    const el = document.createElement('div');
    el.className = 'tl-shot' + (shot.id === selectedShotId ? ' selected' : '');
    el.style.left = (shot.start * pps) + 'px';
    el.style.width = Math.max(18, shot.duration * pps) + 'px';
    el.style.background = shot.color;
    el.dataset.id = shot.id;

    const label = document.createElement('span');
    label.className = 'tl-shot-label';
    label.textContent = shot.camMode === 'free'
      ? 'Vista Libre'
      : `${CAM_NAMES[shot.camMode] || shot.camMode}${shot.subjectId ? ' · ' + subjectName(shot.subjectId) : ''}`;
    el.appendChild(label);

    const left = document.createElement('div');
    left.className = 'tl-handle tl-handle-l';
    const right = document.createElement('div');
    right.className = 'tl-handle tl-handle-r';
    el.appendChild(left);
    el.appendChild(right);

    el.addEventListener('pointerdown', (e) => beginShotDrag(e, shot, el));
    el.addEventListener('click', (e) => {
      if (el.dataset.dragged === '1') { el.dataset.dragged = ''; return; }
      selectShot(shot.id);
    });
    track.appendChild(el);
  });
  renderRuler();
}

function renderRuler() {
  if (!rulerEl) return;
  rulerEl.innerHTML = '';
  const pps = pxPerSec();
  const step = pps > 80 ? 1 : (pps > 35 ? 2 : 5);
  const total = Math.max(timeline.duration, 20);
  for (let s = 0; s <= total; s += step) {
    const tick = document.createElement('div');
    tick.className = 'tl-tick';
    tick.style.left = (s * pps) + 'px';
    tick.textContent = s + 's';
    rulerEl.appendChild(tick);
  }
}

function updatePlayheadUI() {
  const ph = document.getElementById('tlPlayhead');
  if (ph) {
    ph.style.display = (timeline.playing || timeline.time > 0) ? 'block' : 'none';
    ph.style.left = (timeline.time * pxPerSec()) + 'px';
  }
  if (clockEl) clockEl.textContent = fmt(timeline.time) + ' / ' + fmt(timeline.duration);
}

// Click en la regla (o fondo de la pista) → mover la línea de tiempo a ese
// punto exacto. Independiente de la reproducción.
function scrubFromEvent(e) {
  if (timeline.playing || !track) return;
  const rect = track.getBoundingClientRect();
  const t = Math.max(0, Math.min(timeline.duration, (e.clientX - rect.left) / pxPerSec()));
  timeline.time = Math.round(t * 10) / 10;
  updatePlayheadUI();
}
rulerEl?.addEventListener('pointerdown', scrubFromEvent);
track?.addEventListener('pointerdown', (e) => {
  if (e.target === track) scrubFromEvent(e);
});

function updateTransportUI() {
  if (playSceneBtn) playSceneBtn.disabled = timeline.playing;
  if (recordSceneBtn) recordSceneBtn.disabled = timeline.playing;
  if (stopSceneBtn) stopSceneBtn.disabled = !timeline.playing;
  renderShots();
  updatePlayheadUI();
}

// ---------- Selección y edición de tomas ----------
let selectedShotId = null;
const editorEl = document.getElementById('shotEditor');

function selectedShot() {
  return timeline.shots.find(s => s.id === selectedShotId) || null;
}

function selectShot(id) {
  selectedShotId = id;
  renderShots();
  renderEditor();
}

function renderEditor() {
  if (!editorEl) return;
  const shot = selectedShot();
  editorEl.style.display = shot ? 'flex' : 'none';
  if (!shot) return;

  editorEl.innerHTML = '';

  const camWrap = document.createElement('label');
  camWrap.className = 'inline-label';
  camWrap.textContent = 'Cámara ';
  const camSel = document.createElement('select');
  camSel.className = 'tl-input';
  Object.keys(CAM_NAMES).forEach(m => {
    if (m === 'orbit') return;
    const o = document.createElement('option');
    o.value = m;
    o.textContent = CAM_NAMES[m];
    camSel.appendChild(o);
  });
  camSel.value = shot.camMode;
  camSel.addEventListener('change', () => {
    shot.camMode = camSel.value;
    renderShots();
    // Vista previa inmediata de la cámara de esta toma
    if (!timeline.playing) cutCameraToShot(shot.camMode, shot.subjectId);
  });
  camWrap.appendChild(camSel);

  const subjWrap = document.createElement('label');
  subjWrap.className = 'inline-label';
  subjWrap.textContent = 'Personaje ';
  const subjSel = document.createElement('select');
  subjSel.className = 'tl-input';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = '— sin personaje —';
  subjSel.appendChild(none);
  interactiveRegistry.forEach(entry => {
    if (entry.type === 'human' || entry.type === 'pet') {
      const o = document.createElement('option');
      o.value = entry.id;
      o.textContent = entry.name;
      subjSel.appendChild(o);
    }
  });
  subjSel.value = shot.subjectId || '';
  subjSel.addEventListener('change', () => {
    shot.subjectId = subjSel.value || null;
    renderShots();
    if (!timeline.playing && shot.camMode !== 'free') cutCameraToShot(shot.camMode, shot.subjectId);
  });
  subjWrap.appendChild(subjSel);

  const startIn = shotNumberInput('Inicio', shot.start);
  startIn.addEventListener('change', () => {
    shot.start = Math.max(0, parseFloat(startIn.querySelector('input').value) || 0);
    commitEdit();
  });
  const durIn = shotNumberInput('Duración', shot.duration);
  durIn.addEventListener('change', () => {
    shot.duration = Math.max(0.5, parseFloat(durIn.querySelector('input').value) || 0.5);
    commitEdit();
  });
  const dup = document.createElement('button');
  dup.className = 'blender-btn';
  dup.textContent = '⧉ Duplicar';
  dup.addEventListener('click', () => {
    addShot(shot.start + shot.duration, shot.duration, shot.camMode, shot.subjectId);
  });

  const del = document.createElement('button');
  del.className = 'blender-btn danger';
  del.textContent = '🗑 Borrar';
  del.addEventListener('click', () => {
    timeline.shots = timeline.shots.filter(s => s.id !== shot.id);
    selectedShotId = null;
    commitEdit();
  });

  editorEl.append(camWrap, subjWrap, startIn, durIn, dup, del);
}

function shotNumberInput(title, value) {
  const wrap = document.createElement('label');
  wrap.className = 'inline-label';
  wrap.textContent = title + ' ';
  const inp = document.createElement('input');
  inp.type = 'number';
  inp.className = 'tl-input';
  inp.value = value;
  inp.min = 0;
  inp.step = 0.1;
  wrap.appendChild(inp);
  return wrap;
}

function commitEdit() {
  refreshDuration();
  timeline.shots.sort((a, b) => a.start - b.start);
  renderShots();
  renderEditor();
  pushHistory();
}

function addShot(start, duration, camMode, subjectId) {
  const shot = {
    id: 'shot' + (++shotCounter),
    start: start !== undefined ? start : sceneDuration(),
    duration: duration !== undefined ? duration : 3,
    camMode: camMode || 'third',
    subjectId: subjectId !== undefined ? subjectId : (interactiveRegistry.has('human1') ? 'human1' : null),
    color: SHOT_COLORS[shotCounter % SHOT_COLORS.length]
  };
  timeline.shots.push(shot);
  selectedShotId = shot.id;
  refreshDuration();
  renderShots();
  renderEditor();
  pushHistory();
}

// ---------- Arrastre de bloques ----------
let dragState = null; // { shot, mode: 'move'|'l'|'r', startX, origStart, origDur }

function beginShotDrag(e, shot, el) {
  if (timeline.playing) return;
  e.preventDefault();
  e.stopPropagation();
  const rect = el.getBoundingClientRect();
  const edge = 8;
  const mode = (e.clientX - rect.left <= edge) ? 'l'
    : (rect.right - e.clientX <= edge) ? 'r'
    : 'move';
  dragState = { shot, mode, startX: e.clientX, origStart: shot.start, origDur: shot.duration };
  const pps = pxPerSec();
  const onMove = (ev) => {
    if (!dragState) return;
    const dSec = (ev.clientX - dragState.startX) / pps;
    const ds = Math.round(dSec * 10) / 10;
    if (dragState.mode === 'move') {
      shot.start = Math.max(0, dragState.origStart + ds);
    } else if (dragState.mode === 'l') {
      const ns = Math.min(dragState.origStart + ds, dragState.origStart + dragState.origDur - 0.5);
      shot.start = Math.max(0, ns);
      shot.duration = Math.round((dragState.origStart + dragState.origDur - shot.start) * 10) / 10;
    } else {
      shot.duration = Math.max(0.5, Math.round((dragState.origDur + ds) * 10) / 10);
    }
    el.style.left = (shot.start * pps) + 'px';
    el.style.width = Math.max(18, shot.duration * pps) + 'px';
    el.dataset.dragged = '1';
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (dragState) {
      dragState = null;
      commitEdit();
    }
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

// ---------- Botones de transporte ----------
playSceneBtn?.addEventListener('click', () => {
  if (!timeline.playing) playScene();
});
recordSceneBtn?.addEventListener('click', () => {
  if (!timeline.playing) recordScene();
});
stopSceneBtn?.addEventListener('click', stopScene);
addShotBtn?.addEventListener('click', () => {
  if (!timeline.playing) addShot();
});

window.addEventListener('resize', () => renderShots());

// ---------- Panel de eventos de waypoint ----------
// cinematics.js dispara 'cinema-waypoint-edit' al hacer doble click en un
// punto del recorrido (modo edición). Aquí se edita la acción al llegar y
// los segundos de espera.
const evPanel = document.getElementById('waypointEventPanel');
const evTitle = document.getElementById('waypointEventTitle');
const evAction = document.getElementById('waypointEventAction');
const evWait = document.getElementById('waypointEventWait');
const evApply = document.getElementById('waypointEventApply');
const evRemove = document.getElementById('waypointEventRemove');
const evClose = document.getElementById('waypointEventClose');
let evWaypointIndex = -1;

window.addEventListener('cinema-waypoint-edit', (e) => {
  evWaypointIndex = e.detail.index;
  if (evTitle) evTitle.textContent = `Punto #${evWaypointIndex}`;
  const existing = cinema.events[evWaypointIndex] || {};
  if (evAction) evAction.value = existing.action || '';
  if (evWait) evWait.value = existing.wait || 0;
  if (evPanel) evPanel.style.display = 'block';
});

function applyWaypointEvent() {
  if (evWaypointIndex < 0) return;
  const action = evAction ? evAction.value : '';
  const wait = parseFloat(evWait ? evWait.value : 0) || 0;
  if (!action && !(wait > 0)) delete cinema.events[evWaypointIndex];
  else cinema.events[evWaypointIndex] = { action: action || null, wait: wait };
  cinemaStorePath(cinema.targetId);
  pushHistory();
  setStatus(action
    ? `Evento en punto #${evWaypointIndex}: ${action}${wait > 0 ? ' + ' + wait + 's de espera' : ''}`
    : 'Evento quitado.');
}

evApply?.addEventListener('click', () => { applyWaypointEvent(); closeWaypointPanel(); });
evRemove?.addEventListener('click', () => {
  if (evWaypointIndex >= 0) delete cinema.events[evWaypointIndex];
  cinemaStorePath(cinema.targetId);
  closeWaypointPanel();
  setStatus('Evento quitado del punto.');
});
evClose?.addEventListener('click', closeWaypointPanel);

function closeWaypointPanel() {
  if (evPanel) evPanel.style.display = 'none';
  evWaypointIndex = -1;
}

// ---------- Init ----------
updateTransportUI();

// Refresco completo (usado al abrir un proyecto guardado)
export function refreshTimelineUI() {
  refreshDuration();
  selectedShotId = null;
  renderShots();
  renderEditor();
  updateTransportUI();
}

// Al cargar un proyecto, sincronizar el contador de tomas
export function setShotCounter(n) {
  shotCounter = Math.max(shotCounter, n);
}
