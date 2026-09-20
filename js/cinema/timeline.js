import { timeline, cinema, cinemaPaths, interactiveRegistry, recorderState, playback, view, store, blockEdit, charBlocks, charFullRange, quizTrack } from '../state.js';
import { byId, qs, qsa } from '../dom.js';
import { camera, controls } from '../core.js';
import { stepLadder, STEP_LADDER_ORIGIN, openAllRackDoors } from '../office/group.js';
import { setAlarm } from '../office/alarm.js';
import { resetQuiz, quizTick } from '../media/quiz.js';
import { quizPlayTick, renderQuizLane, clearQuizSelection, quizSelection } from './quizTrack.js';
import { renderCharBlocks, charBlockSelection } from './charTrack.js';
import { collectTimelineSnapTimes, snapTimeToRefs, TL_SNAP_PX } from './tlSnap.js';
import { pxPerSec, LANE_LABEL_W } from './tlScale.js';
import { subtitleTrack, refreshSubtitles } from '../media/subtitles.js';
import { audioPlay, audioStop } from '../media/audio.js';
import { stopAllPlaybacks, cutCameraToShot, setCamView, cinemaStorePath, updateCameraViewVisibility, evaluateAllPathsAt, cinemaDeactivate, cinemaClearVisuals, cinemaClearAllVisuals, cinemaSetMode, refreshCharLanes, applyShotDolly } from './cinematics.js';
import { startRecording, mediaRecorder, setStatus, exportFormatOptions } from '../media/recorder.js';
import { pushHistory } from '../undo.js';
import { setActiveTarget } from '../ui/selection.js';
import { getAnchor } from '../characters/anchors.js';

// ==========================================
// SECUENCIADOR DE ESCENAS (LÍNEA DE TIEMPO DE TOMAS)
// ==========================================
// Una "escena" es una lista de tomas de cámara sobre una línea de tiempo
// global: en cada momento se define a quién se ve y desde qué ángulo.
// Al reproducir la escena se reinician todos los recorridos cinemáticos
// (sin bucle) y las tomas van cortando la cámara.

const CAM_NAMES = {
  free: 'Vista Libre', fpv: '1ª Persona', third: '3ª Persona', top: 'Perseguir',
  cine1: 'Cine 1', cine2: 'Cine 2', cine3: 'Cine 3', orbit: 'Vista Libre',
  fixed: 'Fija / Zoom', aerial: 'Aérea', front: 'Frente', profile: 'Perfil'
};
const round2 = (n) => Math.round(n * 100) / 100;

let shotCounter = 0;

function subjectName(id) {
  const e = interactiveRegistry.get(id);
  return e ? e.name : '';
}

// Duración de la escena: el fin del contenido más largo — tomas, bloques de
// personajes, recorridos, subtítulos o carteles. La reproducción siempre
// cubre todo lo que hay en la línea (no solo las tomas).
export function sceneDuration() {
  let m = timeline.shots.reduce((mm, s) => Math.max(mm, s.start + s.duration), 0);
  charBlocks.forEach(b => { m = Math.max(m, b.start + b.duration); });
  cinemaPaths.forEach(stored => { m = Math.max(m, stored._duration || 0); });
  subtitleTrack.forEach(c => { m = Math.max(m, c.end); });
  quizTrack.forEach(q => { m = Math.max(m, q.end); });
  return m;
}

function refreshDuration() {
  refreshCharLanes();   // duraciones de recorridos al día (_duration)
  timeline.duration = sceneDuration();
  // Solo acción base sin nada temporizado: igual se puede reproducir
  if (!(timeline.duration > 0) && Object.keys(charFullRange).length) timeline.duration = 5;
}

// ---------- Motor (llamado desde render.js cada frame) ----------
function currentShot(t) {
  let found = null;
  timeline.shots.forEach(s => {
    if (t >= s.start && t < s.start + s.duration) found = s;
  });
  return found;
}

// Estado de la alarma de emergencia en un instante: queda encendida si la
// última toma con flag `alarm` que ya arrancó dice true, y apagada si dice false.
function computeAlarmAt(t) {
  let on = false;
  let latest = -Infinity;
  timeline.shots.forEach(s => {
    if (typeof s.alarm !== 'boolean') return;
    if (s.start <= t && s.start >= latest) {
      latest = s.start;
      on = s.alarm;
    }
  });
  return on;
}

// Estado de las puertas de mini racks en un instante: abiertas si la última
// toma con flag `openDoor` que ya arrancó lo pide (mismo criterio que la
// alarma). Lo usan el scrub y el arranque de la escena para reflejar el
// estado correcto al volver atrás — no queda "abierto de la pasada anterior".
function computeOpenDoorsAt(t) {
  let open = false;
  let latest = -Infinity;
  timeline.shots.forEach(s => {
    if (!s.openDoor) return;
    if (s.start <= t && s.start >= latest) {
      latest = s.start;
      open = true;
    }
  });
  return open;
}

export function updateTimeline(dt) {
  if (!timeline.playing) return;
  timeline.time += dt;
  // Posición/acción de TODOS los personajes, determinística: como el scrub,
  // la escena se reproduce con la misma previsión (respecta waits y lip-sync).
  evaluateAllPathsAt(timeline.time);
  // Carteles de pregunta (pista 📋 QUIZ): se disparan por su tramo, no por la
  // toma. Mientras uno está en pantalla, los subtítulos no se dibujan.
  const quizActive = quizPlayTick(dt);
  quizTick(dt);   // avanza el reloj del cartel activo (si lo hay)

  const shot = currentShot(timeline.time);

  if (shot && shot.id !== timeline.activeShotId) {
    if (shot.openDoor) openAllRackDoors(true);
    // Alarma de emergencia: sigue el flag `alarm` de las tomas ya iniciadas
    setAlarm(computeAlarmAt(timeline.time));
    timeline.activeShotId = shot.id;
    cutCameraToShot(shot.camMode, shot.subjectId, shot);
  }
  // Dolly dentro de la toma: la cámara viaja inicio→fin mientras dura el plano
  // (toma el control: el usuario no orbita durante ese tramo).
  if (shot && applyShotDolly(shot, timeline.time)) controls.enabled = false;

  updatePlayheadUI();

  if (timeline.time >= timeline.duration) {
    if (timeline.loopPlayback && !timeline.recording && playScene()) return;
    finishScene();
  }
}

export function playScene() {
  // Guardar el recorrido en edición antes de reproducir
  if (cinema.active && cinema.targetId) cinemaStorePath(cinema.targetId);
  // Si hay una toma en Vista Libre seleccionada, guardar su encuadre actual
  const selFree = selectedShot();
  if (selFree && selFree.camMode === 'free') saveFreeCameraToShot(selFree);

  const playable = [];
  cinemaPaths.forEach((stored, id) => {
    if (stored.waypoints && stored.waypoints.length >= 2) playable.push(id);
  });
  // La reproducción funciona con CUALQUIER contenido (no solo tomas):
  // recorridos, bloques/acción base de personajes, subtítulos o carteles.
  const hasChar = charBlocks.length > 0 || Object.keys(charFullRange).length > 0;
  const hasText = subtitleTrack.length > 0 || quizTrack.length > 0;
  if (playable.length === 0 && timeline.shots.length === 0 && !hasChar && !hasText) {
    setStatus('La escena está vacía: agregá un personaje, un camino, una toma o un texto.');
    return false;
  }
  refreshDuration();
  renderRuler();

  stopAllPlaybacks();
  // La escena se reproduce con la previsión determinista `evaluateAllPathsAt`
  // (llamada cada frame desde updateTimeline): respeta los waits de cada
  // waypoint y el lip-sync, igual que al mover la aguja (scrub). No se usan
  // instancias por curva (startPlayback) para evitar que los eventos de
  // recorridos estacionarios se disparen todos de golpe.
  evaluateAllPathsAt(0);

  // Al (re)producir la escena, la escalera vuelve a su punto de origen y a su
  // posición visible por defecto (en la reproducción el personaje la deja en
  // otro lado al soltarla).
  stepLadder.position.set(STEP_LADDER_ORIGIN[0], STEP_LADDER_ORIGIN[1], STEP_LADDER_ORIGIN[2]);
  stepLadder.visible = true;

  // Las puertas de los mini racks CIERRAN al (re)producir: la escena arranca
  // desde su estado inicial (si una toma las abre con `openDoor`, se verá el
  // giro completo en cada pasada, no quedan abiertas de la anterior).
  openAllRackDoors(false);

  // Reiniciar el cartel de cierre para que vuelva a aparecer si se repite
  resetQuiz();
  clearQuizSelection();

  timeline.time = 0;
  timeline.paused = false;
  timeline.activeShotId = null;
  setAlarm(computeAlarmAt(0));   // la alarma arranca apagada
  timeline.playing = true;
  playheadUsed = true;   // tocó Play: la aguja ya es parte de la escena
  audioPlay(0);   // música + efectos desde el inicio (también al exportar)
  const first = currentShot(0);
  if (first) {
    timeline.activeShotId = first.id;
    cutCameraToShot(first.camMode, first.subjectId, first);
  }
  updatePlayheadUI();
  const parts = [];
  if (playable.length) parts.push(`${playable.length} recorridos`);
  if (timeline.shots.length) parts.push(`${timeline.shots.length} tomas`);
  if (charBlocks.length) parts.push(`${charBlocks.length} bloques`);
  setStatus(`Reproduciendo escena (${timeline.duration.toFixed(1)}s${parts.length ? ', ' + parts.join(' + ') : ''})...`);
  updateTransportUI();
  return true;
}

export function recordScene() {
  if (!playScene()) return;
  timeline.recording = true;
  // La exportación dura lo que la escena a la velocidad elegida (+margen)
  const secs = timeline.duration / Math.max(0.1, playback.rate) + 0.05;
  const base = store.projectName || ('pelicula_' + store.currentEnv);
  const pref = byId('exportFormat')?.value || 'auto';
  startRecording(secs, base, pref);
  setStatus(`Exportando película (${(timeline.duration / playback.rate).toFixed(1)}s a 1080p 60 fps)...`);
}

export function stopScene() {
  if (!timeline.playing && !timeline.paused && !(timeline.time > 0)) return;
  timeline.playing = false;
  timeline.paused = false;
  timeline.recording = false;
  timeline.time = 0;            // la línea roja vuelve al comienzo
  timeline.activeShotId = null;
  setAlarm(false);              // la alarma se apaga al detener
  stopAllPlaybacks();
  audioStop();
  // La aguja manda: los personajes quedan como en t=0 (bloques + recorridos),
  // igual que si se moviera la aguja al inicio — no hay "segunda posición".
  evaluateAllPathsAt(0);
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  setCamView('orbit');
  updatePlayheadUI();
  updateTransportUI();
  setStatus('Escena detenida (vuelta al comienzo).');
}

function finishScene() {
  timeline.playing = false;
  timeline.paused = false;
  timeline.time = 0;            // al terminar, la cabeza vuelve al comienzo
  timeline.activeShotId = null;
  audioStop();
  updatePlayheadUI();
  stopAllPlaybacks();
  if (timeline.recording) {
    timeline.recording = false;
    // Detener el MediaRecorder YA: si se espera al reinicio de la escena,
    // el primer frame (t=0) se colaría al final del video exportado.
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  } else {
    setCamView('orbit');
    setStatus('Escena terminada.');
  }
  // La aguja manda: los personajes quedan como en t=0 (bloques + recorridos),
  // coherente con la aguja roja puesta al inicio.
  evaluateAllPathsAt(0);
  updateTransportUI();
}

// ---------- UI: línea de tiempo ----------
const track = byId('timelineTrack');
const rulerEl = byId('timelineRuler');
const clockEl = byId('timelineClock');
const playSceneBtn = byId('btnPlayScene');
const stopSceneBtn = btnSafe('btnStopScene');
const loopSceneBtn = btnSafe('btnLoopScene');

function btnSafe(id) { return byId(id); }

function fmt(t) { return t.toFixed(1) + 's'; }

function renderShots() {
  if (!track) return;
  track.querySelectorAll('.tl-shot').forEach(el => el.remove());
  const pps = pxPerSec();
  timeline.shots.forEach(shot => {
    const el = document.createElement('div');
    el.className = 'tl-shot' + (shot.id === selectedShotId ? ' selected' : '');
    el.style.left = (LANE_LABEL_W + shot.start * pps) + 'px';
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

    const close = document.createElement('div');
    close.className = 'tl-shot-close';
    close.textContent = '✕';
    close.title = 'Descartar cambios de la toma (vuelve al estado previo)';
    close.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); });
    close.addEventListener('click', (ev) => { ev.stopPropagation(); discardSelection(); });

    const save = document.createElement('div');
    save.className = 'tl-shot-save';
    save.textContent = '💾';
    save.title = 'Guardar la edición de la toma (cinemática, cámara, tiempos)';
    save.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); });
    save.addEventListener('click', (ev) => { ev.stopPropagation(); clearSelection(); });
    el.appendChild(save);
    el.appendChild(close);

    el.addEventListener('pointerdown', (e) => beginShotDrag(e, shot, el));
    el.addEventListener('click', (e) => {
      if (el.dataset.dragged === '1') { el.dataset.dragged = ''; return; }
      selectShot(shot.id);
    });
    track.appendChild(el);
  });
  renderSubtitles();
  renderQuizLane();
  renderRuler();
}

// Dibuja los subtítulos como bloques con el MISMO formato que los clips de
// cinemática (mismo tamaño/forma), pero con un solo color fijo. Click en un
// bloque lo selecciona para editarlo; arrastre lo mueve o redimensiona.
function renderSubtitles() {
  const lane = byId('subtitleLane');
  if (!lane) return;
  // No usar innerHTML='': preserva el rótulo "💬 SUBTÍTULOS" de la pista
  lane.querySelectorAll('.tl-sub').forEach(el => el.remove());
  const pps = pxPerSec();
  subtitleTrack.forEach(c => {
    const el = document.createElement('div');
    el.className = 'tl-sub' + (c === selectedCue ? ' selected' : '');
    el.style.left = (LANE_LABEL_W + c.start * pps) + 'px';
    el.style.width = Math.max(18, (c.end - c.start) * pps) + 'px';

    const label = document.createElement('span');
    label.className = 'tl-shot-label';
    label.textContent = '💬 ' + c.text;
    el.appendChild(label);

    const left = document.createElement('div');
    left.className = 'tl-handle tl-handle-l';
    const right = document.createElement('div');
    right.className = 'tl-handle tl-handle-r';
    el.appendChild(left);
    el.appendChild(right);

    // 💾 / ✕ solo en el bloque seleccionado: guardar o descartar su edición.
    if (c === selectedCue) {
      const saveSub = document.createElement('div');
      saveSub.className = 'tl-shot-save';
      saveSub.textContent = '💾';
      saveSub.title = 'Guardar la edición del subtítulo';
      saveSub.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); });
      saveSub.addEventListener('click', (ev) => {
        ev.stopPropagation();
        clearSubSelection();
        pushHistory();
        setStatus('Subtítulo guardado.');
      });
      el.appendChild(saveSub);

      const closeSub = document.createElement('div');
      closeSub.className = 'tl-shot-close';
      closeSub.textContent = '✕';
      closeSub.title = 'Descartar cambios del subtítulo (vuelve al texto previo)';
      closeSub.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); });
      closeSub.addEventListener('click', (ev) => {
        ev.stopPropagation();
        // Restaurar el cue al snapshot tomado al seleccionarlo
        if (subSnapshot && selectedCue) {
          Object.assign(selectedCue, JSON.parse(JSON.stringify(subSnapshot)));
        }
        clearSubSelection();
        refreshSubtitles();
        renderSubtitles();
        setStatus('Cambios del subtítulo descartados.');
      });
      el.appendChild(closeSub);
    }

    el.title = `${c.start.toFixed(1)}s → ${c.end.toFixed(1)}s: ${c.text} (click para editar; arrastrá bordes para ajustar)`;
    el.addEventListener('pointerdown', (e) => beginSubDrag(e, c, el));
    el.addEventListener('click', () => {
      if (el.dataset.dragged === '1') { el.dataset.dragged = ''; return; }
      openSubEditor(c);
    });
    lane.appendChild(el);
  });
}

// Arrastre de bloques de subtítulo: mover, o estirar por los bordes
let subDragState = null;

function beginSubDrag(e, cue, el) {
  if (timeline.playing) return;
  e.preventDefault();
  e.stopPropagation();
  const rect = el.getBoundingClientRect();
  const edge = 8;
  const mode = (e.clientX - rect.left <= edge) ? 'l'
    : (rect.right - e.clientX <= edge) ? 'r'
    : 'move';
  subDragState = { cue, mode, startX: e.clientX, origStart: cue.start, origDur: cue.end - cue.start, moved: false };
  const pps = pxPerSec();
  const onMove = (ev) => {
    if (!subDragState) return;
    if (!subDragState.moved) {
      if (Math.abs(ev.clientX - subDragState.startX) <= 3) return;
      subDragState.moved = true;
      el.dataset.dragged = '1';
    }
    const dSec = (ev.clientX - subDragState.startX) / pps;
    const ds = Math.round(dSec * 10) / 10;
    if (subDragState.mode === 'move') {
      cue.start = Math.max(0, subDragState.origStart + ds);
      cue.end = cue.start + subDragState.origDur;
    } else if (subDragState.mode === 'l') {
      cue.start = Math.min(Math.max(0, subDragState.origStart + ds), subDragState.origStart + subDragState.origDur - 0.5);
      cue.end = subDragState.origStart + subDragState.origDur;
    } else {
      cue.end = Math.max(cue.start + 0.5, subDragState.origStart + subDragState.origDur + ds);
    }
    el.style.left = (LANE_LABEL_W + cue.start * pps) + 'px';
    el.style.width = Math.max(18, (cue.end - cue.start) * pps) + 'px';
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (subDragState) {
      const moved = subDragState.moved;
      subDragState = null;
      if (moved) {
        commitSubtitles(); // ordena + refresca overlay + redibuja
        if (selectedCue === cue && subStart && subEnd) {
          subStart.value = cue.start.toFixed(1);
          subEnd.value = cue.end.toFixed(1);
        }
        pushHistory();
      }
    }
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
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
    tick.style.left = (LANE_LABEL_W + s * pps) + 'px';
    tick.textContent = s + 's';
    rulerEl.appendChild(tick);
  }
}

// La aguja se muestra mientras se reproduce y también una vez que se usó
// (scrub/play): al llevarla al segundo 0 queda VISIBLE haciendo tope ahí — sin
// esto se ocultaba al pasar por 0 y parecía que se metía detrás de las pistas.
let playheadUsed = false;

function updatePlayheadUI() {
  const ph = byId('tlPlayhead');
  if (ph) {
    const show = timeline.playing || playheadUsed || timeline.time > 0;
    ph.style.display = show ? 'block' : 'none';
    // Tope duro en el segundo 0: nunca a la izquierda de la marca 0s.
    ph.style.left = (playheadBaseX() + Math.max(0, timeline.time) * pxPerSec()) + 'px';
    positionPlayheadKnob(ph);
  }
  if (clockEl) clockEl.textContent = fmt(timeline.time) + ' / ' + fmt(timeline.duration);
}

// El cabezal rojo va a la altura de la REGLA (donde se leen los segundos), no
// arriba del panel. OJO: la regla vive dentro de `.tl-body`, que es
// `position: relative` — así que `ruler.offsetTop` se mide contra el CUERPO
// (siempre 0) y no contra el panel de la aguja. Por eso la posición se calcula
// con rectángulos y se acota al área visible del cuerpo.
// La línea arranca en la regla (nada de rojo sobre la botonera) y el
// cuadradito, más chico, queda centrado en ella.
let knobGeo = null;
function positionPlayheadKnob(ph) {
  const knob = ph.firstElementChild;
  const ruler = byId('timelineRuler');
  const sec = ph.offsetParent;
  const body = ruler ? ruler.parentElement : null;
  if (!knob || !ruler || !sec || !body) return;
  if (ph.style.display === 'none') { knobGeo = null; return; }
  const sr = sec.getBoundingClientRect();
  const rr = ruler.getBoundingClientRect();
  const br = body.getBoundingClientRect();
  const kh = knob.offsetHeight || 22;
  // Arriba del área visible, sin invadir la botonera: la regla si se ve,
  // si no el borde superior visible del cuerpo.
  const anchor = Math.max(rr.top, br.top);
  const key = Math.round(anchor - sr.top) + 'x' + Math.round(rr.height);
  if (key === knobGeo) return;
  knobGeo = key;
  ph.style.top = Math.round(anchor - (sr.top + sec.clientTop)) + 'px';
  knob.style.top = Math.round(rr.height / 2 - kh / 2) + 'px';
}

// La aguja vive en #scene-timeline (fuera del cuerpo con scroll) pero sus
// coordenadas son de la pista (#timelineTrack): compensar el desplazamiento
// entre ambas (el padding de la sección), si no la aguja queda a la
// izquierda de la marca 0s y parece que se puede mover "más allá del 0".
// Se cachea (el padding no cambia) y se invalida al redimensionar.
let playheadDx = null;
function playheadBaseX() {
  if (playheadDx === null && track && track.clientWidth > 0) {
    playheadDx = LANE_LABEL_W;
    const sec = byId('scene-timeline');
    if (sec) {
      playheadDx = (track.getBoundingClientRect().left - sec.getBoundingClientRect().left) + LANE_LABEL_W;
    }
  }
  return playheadDx === null ? LANE_LABEL_W : playheadDx;
}
window.addEventListener('resize', () => { playheadDx = null; });

// Click en la regla o la pista (o arrastre del cabezal rojo) → mover la
// cabeza de reproducción. Mientras se arrastra, sigue al mouse a cualquier
// velocidad y va aplicando el corte de cámara del instante.
//
// CON BLOQUE EN EDICIÓN: la aguja queda LIMITADA al tramo del bloque
// seleccionado (toma / subtítulo / cartel / bloque de personajes). No tiene
// sentido irse lejos mientras se edita: el cabezal es la herramienta de
// trabajo de ese tramo. Sin selección, se mueve libre por toda la línea.
function scrubFromEvent(e) {
  if (!track) return;
  const rect = track.getBoundingClientRect();
  let maxT = timeline.duration > 0 ? timeline.duration : 3600;
  let minT = 0;
  const blk = selectedBlockTimeRange();
  if (blk) { minT = blk.start; maxT = blk.end; }
  const t = Math.max(minT, Math.min(maxT, (e.clientX - rect.left - LANE_LABEL_W) / pxPerSec()));
  scrubTo(t);
}

// Tramo del bloque en edición (toma / subtítulo / cartel / personajes), si
// hay alguno seleccionado. La aguja roja queda atrapada dentro de ese tramo.
function selectedBlockTimeRange() {
  const shot = selectedShot();
  if (shot) return { start: shot.start, end: shot.start + shot.duration };
  if (selectedCue) return { start: selectedCue.start, end: selectedCue.end };
  const quiz = quizSelection();
  if (quiz) return { start: quiz.start, end: quiz.end };
  const cb = charBlockSelection();
  if (cb) return { start: cb.start, end: cb.start + cb.duration };
  return null;
}

let scrubDrag = false;
function startScrub(e) {
  if (!track) return;
  playheadUsed = true;   // apenas se agarra el cabezal, la aguja queda visible
  if (timeline.playing) {
    timeline.playing = false;
    timeline.paused = false;
    audioStop();
    stopAllPlaybacks();
    updateTransportUI();
  }
  // La toma seleccionada se mantiene (solo se sale con ✕); aquí solo se
  // libera el subtítulo en edición.
  clearSubSelection();
  scrubDrag = true;
  scrubFromEvent(e);
}
window.addEventListener('pointermove', (e) => {
  if (scrubDrag) scrubFromEvent(e);
});
// La aguja es la FUENTE DE VERDAD de dónde están los personajes: al soltarla
// se quedan donde ella marca (no se restauran a una "segunda posición"). La
// captura de estado inicial no corre durante el scrub (timeline sigue
// pausándose en startScrub), así que la pose visible es la real.
window.addEventListener('pointerup', () => { scrubDrag = false; });
window.addEventListener('pointercancel', () => { scrubDrag = false; });
rulerEl?.addEventListener('pointerdown', startScrub);
track?.addEventListener('pointerdown', (e) => {
  // El fondo de la pista inicia el arrastre; las tomas no
  // (ellas tienen su propio click/drag de edición)
  if (e.target === track) startScrub(e);
});
qs('#tlPlayhead .tl-playhead-knob')?.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  startScrub(e);
});

function updateTransportUI() {
  if (playSceneBtn) {
    playSceneBtn.textContent = timeline.playing ? '⏸' : '▶';
    playSceneBtn.title = timeline.playing ? 'Pausar' : 'Reproducir';
    playSceneBtn.disabled = false;
  }
  if (stopSceneBtn) stopSceneBtn.disabled = !timeline.playing && !timeline.paused && !(timeline.time > 0);
  updateLoopBtnUI();
  renderShots();
  updatePlayheadUI();
}

function updateLoopBtnUI() {
  if (!loopSceneBtn) return;
  loopSceneBtn.classList.toggle('active', timeline.loopPlayback);
  loopSceneBtn.title = timeline.loopPlayback
    ? 'Bucle activado: la escena se repite hasta detener, pausar o desactivar'
    : 'Repetir la escena al terminar';
}

// ---------- Play / Pausa alternado + avance y retroceso ----------
const FRAME_STEP = 1 / 30; // un frame a 30 fps

// Mover la cabeza de la línea de tiempo a un instante dado: el video manda.
// Reconstruye el estado de la escena en ese instante (recorridos, acciones,
// subtítulos y cámara de la toma correspondiente).
function scrubTo(t) {
  const maxT = timeline.duration > 0 ? timeline.duration : Math.max(0, t);
  timeline.time = Math.max(0, Math.min(maxT, t));
  playheadUsed = true;   // la aguja ya se usó: se muestra aunque quede en 0
  if (timeline.playing) {
    timeline.playing = false;
    timeline.paused = false;
    updateTransportUI();
  }
  if (timeline.paused) timeline.paused = false;
  if (cinema.active && cinema.targetId) cinemaStorePath(cinema.targetId);
  stopAllPlaybacks();
  // La aguja es la fuente de verdad: los personajes quedan EXACTAMENTE donde
  // ella marca (bloques de personajes + recorridos), sin restaurar nada.
  evaluateAllPathsAt(timeline.time);
  const shot = currentShot(timeline.time);
  if (shot) cutCameraToShot(shot.camMode, shot.subjectId, shot);
  else setCamView('orbit');
  // Previsualizar el dolly en la aguja (encuadre del instante, sin tomar control)
  if (shot) applyShotDolly(shot, timeline.time);
  // Al previsualizar con la cabeza (sin reproducir), la cámara queda en el
  // encuadre de la toma pero en Vista Libre para poder orbitar desde ahí.
  view.mode = 'orbit';
  view.subjectId = null;
  controls.enabled = true;
  // Estado de las puertas de mini racks en el instante del cabezal: abiertas
  // si alguna toma ya iniciada en t pide `openDoor` (igual que la alarma).
  // Así, al volver atrás también se ven cerradas — no queda "abierta de antes".
  openAllRackDoors(computeOpenDoorsAt(timeline.time));
  // La alarma sigue el instante de la cabeza también al moverla manualmente
  setAlarm(computeAlarmAt(timeline.time));
  // El cartel de pregunta sigue la pista 📋 QUIZ en el scrub (igual que al
  // reproducir): muestra el del tramo del cabezal, o lo resetea.
  quizPlayTick(0);
  updatePlayheadUI();
}

function togglePlayPause() {
  if (timeline.playing) {
    // Pausa: congela la simulación sin reiniciar ni perder la posición
    timeline.playing = false;
    timeline.paused = true;
    audioStop();
    updateTransportUI();
    setStatus('Escena en pausa.');
  } else if (timeline.paused) {
    // Reanudar desde donde estaba
    timeline.paused = false;
    timeline.playing = true;
    audioPlay(timeline.time);
    updateTransportUI();
    setStatus('Escena reanudada.');
  } else {
    playScene();
  }
}

// ---------- Selección y edición de tomas ----------
// Sin fila extra de editor: al seleccionar una toma, las opciones de
// "🎥 Vista de Cámara" del menú izquierdo se ILUMINAN (borde blanco) y el
// resto de la interfaz se bloquea hasta deseleccionar. El largo/inicio se
// sigue editando arrastrando los bloques en la línea.
let selectedShotId = null;

// La selección de una toma NO bloquea nada (se dejó el viejo bloqueo
// "recuadro blanco" cuando la UI era una sola); ahora cada sección de edición
// muestra solo lo suyo, y la des-selección la maneja el click afuera (ui.js).

// Quitar la selección guardando (💾 = commit de la mini-edición). Guarda:
// - el recorrido cinemático que se esté grabando (cinemaDeactivate hace
//   cinemaStorePath: la cinemática grabada de principio a fin queda guardada
//   y se reproducirá durante la escena), y
// - el encuadre de la toma en Vista Libre (para restaurarlo al volver).
// Después libera la selección; el resto de la escena se pudo editar libre.
export function clearSelection() {
  if (!selectedShotId) return;
  // Guardar la cinemática en edición (si hay una activa): su recorrido queda
  // asociado al personaje de la toma y se reproduce con la escena.
  if (cinema.active) cinemaDeactivate();
  const shot = selectedShot();
  if (shot && shot.camMode === 'free') saveFreeCameraToShot(shot);
  selectedShotId = null;
  shotSnapshot = null;
  renderShots();
  syncCameraControlsVisibility(null);
  pushHistory();   // el 💾 confirma los cambios de esta toma
  notifyShotCamSync();
  blockEdit.set(null);
}

// Descartar (✕): restaura el bloque al estado que tenía al seleccionarse
// (snapshot) y suelta la cinemática en edición SIN guardarla. No toca el
// resto de la escena (personajes movidos, etc. quedan como estén).
export function discardSelection() {
  if (!selectedShotId) return;
  const shot = selectedShot();
  if (shot && shotSnapshot) {
    // Restaurar la toma al snapshot de cuando se seleccionó
    Object.assign(shot, JSON.parse(JSON.stringify(shotSnapshot)));
  }
  // Cerrar la cinemática en edición SIN guardar (descarta el recorrido nuevo)
  if (cinema.active) {
    cinema.active = false;
    cinema.playing = false;
    cinema.dragging = -1;
    cinema.waypoints = [];
    cinema.curve = null;
    cinema.length = 0;
    cinemaClearVisuals();
    cinemaClearAllVisuals();
    controls.enabled = true;
    cinemaSetMode('off');
  }
  selectedShotId = null;
  shotSnapshot = null;
  renderShots();
  syncCameraControlsVisibility(null);
  refreshDuration();
  renderRuler();
  notifyShotCamSync();
  blockEdit.set(null);
}

// Snapshot de la toma al seleccionarla (para poder descartar con ✕)
let shotSnapshot = null;
function takeShotSnapshot(shot) {
  shotSnapshot = shot ? JSON.parse(JSON.stringify(shot)) : null;
}

// Guarda el encuadre actual de la cámara en una toma en Vista Libre, para que
// al volver a ella (scrub o reproducción) se restaure exactamente ese encuadre.
function saveFreeCameraToShot(shot) {
  shot.camPos = [camera.position.x, camera.position.y, camera.position.z];
  shot.target = [controls.target.x, controls.target.y, controls.target.z];
}

// ANTI-SUPERPOSICIÓN de tomas: ninguna puede invadir a su vecina. Devuelve
// los límites [minStart, maxStart+duration] que la toma puede ocupar según
// sus vecinas (excluyendo a sí misma). Si no hay vecinos: [0, Infinity).
function shotBounds(shot) {
  let minStart = 0;
  let maxEnd = Infinity;
  timeline.shots.forEach(s => {
    if (s === shot || s.id === shot.id) return;
    if (s.start >= shot.start + shot.duration) {
      // Vecino posterior: mi fin no puede pasarlo
      maxEnd = Math.min(maxEnd, s.start);
    } else if (s.start + s.duration <= shot.start) {
      // Vecino anterior: mi inicio no puede ser menor a su fin
      minStart = Math.max(minStart, s.start + s.duration);
    }
  });
  return { minStart, maxEnd };
}

// Si hay un bloque de cinemática seleccionado (Vista Libre) y el usuario mueve
// la cámara, ese nuevo encuadre pasa a ser el de la toma: queda configurado
// temporalmente (se conserva al Guardar; si no, al recargar vuelve el original).
// 'end' solo se dispara con gestos del usuario, no con cortes de cámara.
let camSaveTimer = null;
controls.addEventListener('end', () => {
  if (camSaveTimer) clearTimeout(camSaveTimer);
  camSaveTimer = setTimeout(() => {
    const shot = selectedShot();
    if (shot && (shot.camMode === 'free' || shot.camMode === 'orbit')) {
      saveFreeCameraToShot(shot);
    }
  }, 400);
});

function selectedShot() {
  return timeline.shots.find(s => s.id === selectedShotId) || null;
}

// Toma seleccionada actualmente (la usan otros módulos, ej. cinematics para
// saber si 1P/3P deben configurar ESA toma o solo la vista en vivo).
export function getSelectedShot() {
  return selectedShot();
}
// Registro en el bus (cinematics.js no puede importarnos: sería un ciclo)
import { timelineBus } from '../state.js';
timelineBus.getSelectedShot = getSelectedShot;
timelineBus.renderShots = () => { renderShots(); renderRuler(); };
// Recalcula la duración (la piden los bloques de personajes al crearse,
// moverse o borrarse: la escena dura lo que dure su contenido).
timelineBus.refreshDuration = () => { refreshDuration(); renderRuler(); };
// Guarda el encuadre actual de la cámara en la toma seleccionada (si es una
// vista que guarda encuadre: free/orbit/fixed). Lo usa projectFiles.js al
// serializar para que el diskete de la escena también persista la cámara.
timelineBus.saveSelectedFrame = () => {
  const shot = selectedShot();
  if (shot && (shot.camMode === 'free' || shot.camMode === 'orbit' || shot.camMode === 'fixed')) {
    saveFreeCameraToShot(shot);
  }
};
// Irradiar el cambio de selección al control de cámara del panel de cinemática
function notifyShotCamSync() {
  if (timelineBus.syncShotCamUI) timelineBus.syncShotCamUI();
}

function selectShot(id) {
  // Exclusividad: elegir una toma libera el subtítulo y el cartel (quiz)
  // en edición (cada bloque selecciona uno a la vez).
  clearSubSelection();
  clearQuizSelection();
  selectedShotId = id;
  takeShotSnapshot(selectedShot());
  renderShots();
  // Si la toma sigue a un personaje, dejarlo marcado en la lista de
  // recorridos para editar su cinemática.
  const shot = selectedShot();
  if (shot && shot.subjectId && interactiveRegistry.has(shot.subjectId)) {
    setActiveTarget(shot.subjectId);
  }
  // Vista previa: mostrar la cámara de esta toma (resaltado del bloque lo
  // hace renderShots vía .selected). Si es fija, usa su camPos/target.
  // Si es VISTA LIBRE, no se mueve la cámara: queda donde el usuario la dejó
  // y los controles quedan habilitados para reencuadrar a gusto.
  // Funciona también durante la reproducción: es un corte de cámara manual
  // que NO interrumpe lo que los personajes están haciendo.
  syncCameraControlsVisibility(shot);
  if (shot) {
    if (shot.camMode === 'free' || shot.camMode === 'orbit') {
      cutCameraToShot('free', shot.subjectId, shot);
    } else {
      cutCameraToShot(shot.camMode, shot.subjectId, shot);
    }
  }
  notifyShotCamSync();
  blockEdit.set('shot');
  window.dispatchEvent(new CustomEvent('shot-selected'));
  window.dispatchEvent(new CustomEvent('edit-mode-request', { detail: { mode: 'cinematica' } }));
}

// El bloque "🎥 Vista de Cámara" del menú izquierdo aparece también cuando
// hay una toma seleccionada (no solo con personajes)
function syncCameraControlsVisibility(shot) {
  if (!shot) {
    // Sin toma seleccionada: cámara LIBRE que el usuario maneja a gusto
    // (1P/3P dejan de estar anclados a un corte).
    view.mode = 'orbit';
    view.subjectId = null;
    controls.enabled = true;
  }
}

// Aplica un modo de cámara (de los botones de vista del panel) a la toma
// seleccionada. Funciona también DURANTE la reproducción: solo cambia la
// cámara, nunca interrumpe los recorridos de los personajes.
// Devuelve false si no hay toma seleccionada.
export function applyViewToSelectedShot(mode) {
  const shot = selectedShot();
  if (!shot) return false;
  // El menú llama "orbit" a la Vista Libre; en las tomas se guarda como free
  const m = mode === 'orbit' ? 'free' : mode;
  shot.camMode = m;
  renderShots();
  cutCameraToShot(m, shot.subjectId, shot);
  pushHistory();
  return true;
}

function commitEdit() {
  refreshDuration();
  timeline.shots.sort((a, b) => a.start - b.start);
  renderShots();
  renderRuler();
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
  dragState = { shot, mode, startX: e.clientX, origStart: shot.start, origDur: shot.duration, moved: false };
  const pps = pxPerSec();
  // IMÁN entre pistas: los bordes de la toma se alinean solos con los bordes
  // de bloques de personajes/subtítulos/cartels si quedan a unos píxeles.
  const snapTol = TL_SNAP_PX / pps;
  const onMove = (ev) => {
    if (!dragState) return;
    // Solo cuenta como arrastre si el mouse se movió de verdad (>3px):
    // así un click con micro-jitter no anula la selección.
    if (!dragState.moved) {
      if (Math.abs(ev.clientX - dragState.startX) <= 3) return;
      dragState.moved = true;
      el.dataset.dragged = '1';
    }
    const dSec = (ev.clientX - dragState.startX) / pps;
    const refs = collectTimelineSnapTimes(shot);
    if (dragState.mode === 'move') {
      // Imán: si el INICIO de la toma queda cerca de una referencia, alinear
      // por el inicio (mantiene la duración); sino redondeo a 0.1s.
      let ns = Math.max(0, dragState.origStart + dSec);
      ns = snapTimeToRefs(ns, snapTol, refs);
      shot.start = ns;
      // Anti-superposición: no puedo arrastrarme encima de un vecino
      const b = shotBounds(shot);
      shot.start = Math.max(b.minStart, Math.min(shot.start, Math.max(0, b.maxEnd - shot.duration)));
    } else if (dragState.mode === 'l') {
      let ns = Math.min(dragState.origStart + dSec, dragState.origStart + dragState.origDur - 0.5);
      ns = Math.max(0, ns);
      ns = snapTimeToRefs(ns, snapTol, refs);
      // Anti-superposición: el borde izquierdo no invade al vecino anterior
      const b = shotBounds(shot);
      shot.start = Math.max(b.minStart, ns);
      shot.duration = Math.round((dragState.origStart + dragState.origDur - shot.start) * 10) / 10;
    } else {
      let nd = Math.max(0.5, dragState.origDur + dSec);
      // Imán sobre el FIN de la toma: alinear el borde derecho con refs
      const end = snapTimeToRefs(dragState.origStart + nd, snapTol, refs);
      nd = Math.max(0.5, end - dragState.origStart);
      shot.duration = Math.round(nd * 10) / 10;
      // Anti-superposición: el borde derecho no invade al vecino posterior
      const b = shotBounds(shot);
      if (shot.start + shot.duration > b.maxEnd) {
        shot.duration = Math.max(0.5, Math.round((b.maxEnd - shot.start) * 10) / 10);
      }
    }
    el.style.left = (LANE_LABEL_W + shot.start * pps) + 'px';
    el.style.width = Math.max(18, shot.duration * pps) + 'px';
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (dragState) {
      const moved = dragState.moved;
      dragState = null;
      if (moved) commitEdit();
    }
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

// ---------- Botones de transporte ----------
playSceneBtn?.addEventListener('click', () => togglePlayPause());
stopSceneBtn?.addEventListener('click', stopScene);
loopSceneBtn?.addEventListener('click', () => {
  timeline.loopPlayback = !timeline.loopPlayback;
  updateLoopBtnUI();
  setStatus(timeline.loopPlayback
    ? 'Bucle de reproducción activado: la escena se repetirá al terminar.'
    : 'Bucle de reproducción desactivado.');
});
// Refleja la disponibilidad real de formatos en el selector (#1: MP4/WebM):
// si el navegador no soporta MP4 en MediaRecorder, "Auto" solo puede dar WebM.
(function initExportFormatUI() {
  const sel = byId('exportFormat');
  if (!sel) return;
  const { mp4, webm } = exportFormatOptions();
  if (mp4) {
    sel.title = 'Auto: MP4 (H.264) en este navegador; WebM como respaldo.';
  } else if (webm) {
    sel.title = 'Este navegador no soporta MP4 en MediaRecorder: Auto graba WebM (VP9/VP8).';
    const autoOpt = sel.querySelector('option[value="auto"]');
    if (autoOpt) autoOpt.textContent = 'Auto (WebM)';
  } else {
    sel.title = 'Sin formatos de grabación disponibles en este navegador.';
    sel.disabled = true;
  }
})();

// ⬇ Exportar: reproduce la película completa desde el inicio y genera el
// video (1080p 60 fps). Si ya se está exportando, el click la detiene.
byId('exportBtn')?.addEventListener('click', () => {
  if (recorderState.isRecording) {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  } else if (!timeline.playing) {
    recordScene();
  }
});
// Saltos con botones: si hay un bloque en edición, la aguja queda limitada a
// su tramo (misma regla que el arrastre de la aguja).
function scrubStep(dt) {
  let t = timeline.time + dt;
  const blk = selectedBlockTimeRange();
  if (blk) t = Math.max(blk.start, Math.min(blk.end, t));
  scrubTo(t);
}
byId('btnBack10')?.addEventListener('click', () => scrubStep(-10));
byId('btnFwd10')?.addEventListener('click', () => scrubStep(10));
byId('btnStepBack')?.addEventListener('click', () => scrubStep(-FRAME_STEP));
byId('btnStepFwd')?.addEventListener('click', () => scrubStep(FRAME_STEP));

window.addEventListener('resize', () => renderShots());

// ---------- Panel de eventos de waypoint ----------
// cinematics.js dispara 'cinema-waypoint-edit' al hacer doble click en un
// punto del recorrido (modo edición). Aquí se edita la acción al llegar y
// los segundos de espera.
const evPanel = byId('waypointEventPanel');
const evTitle = byId('waypointEventTitle');
const evAction = byId('waypointEventAction');
const evSeatRow = byId('waypointEventSeatRow');
const evSeat = byId('waypointEventSeat');
const evWait = byId('waypointEventWait');
const evApply = byId('waypointEventApply');
const evRemove = byId('waypointEventRemove');
const evClose = byId('waypointEventClose');
let evWaypointIndex = -1;

// Poblar el dropdown de asientos con las sillas registradas (anclas seat_<id>).
function fillSeatOptions() {
  if (!evSeat) return;
  const current = evSeat.value;
  evSeat.innerHTML = '';
  const seats = [];
  interactiveRegistry.forEach(entry => {
    if (entry.deleted) return;
    // Las sillas registran su ancla como 'seat_' + id (ver furniture.js)
    const g = entry.group;
    if (!g || entry.type !== 'furniture') return;
    // Solo las que tienen ancla de asiento: se buscan por nombre en anchors
    seats.push({ id: entry.id, name: entry.name });
  });
  // Filtrar las que de verdad tienen ancla registrada
  const withAnchor = seats.filter(s => !!getAnchor('seat_' + s.id));
  if (withAnchor.length === 0) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = '— no hay sillas con asiento —';
    evSeat.appendChild(o);
    return;
  }
  withAnchor.forEach(s => {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = '🪑 ' + s.name;
    evSeat.appendChild(o);
  });
  if (current) evSeat.value = current;
}

// Mostrar el selector de asiento solo para la acción sit_at
function syncSeatRowVisibility() {
  const isSitAt = evAction && evAction.value === 'sit_at';
  if (evSeatRow) evSeatRow.style.display = isSitAt ? '' : 'none';
  if (isSitAt) fillSeatOptions();
}
evAction?.addEventListener('change', syncSeatRowVisibility);

window.addEventListener('cinema-waypoint-edit', (e) => {
  evWaypointIndex = e.detail.index;
  if (evTitle) evTitle.textContent = `Punto #${evWaypointIndex}`;
  const existing = cinema.events[evWaypointIndex] || {};
  if (evAction) evAction.value = existing.action || '';
  if (evSeat) evSeat.value = existing.sitAt || '';
  syncSeatRowVisibility();
  if (evWait) evWait.value = existing.wait || 0;
  if (evPanel) evPanel.style.display = 'block';
});

// Elegir un bloque de QUIZ libera la toma/subtítulo en edición (exclusividad
// de selección entre pistas; quizTrack avisa por este evento para evitar el
// ciclo de imports quizTrack ↔ timeline).
window.addEventListener('quiz-block-selected', () => {
  if (selectedShotId) clearSelection();
  if (selectedCue) clearSubSelection();
});
// Ídem para los bloques de la pista 🧍 PERSONAJES (charTrack).
window.addEventListener('char-block-selected', () => {
  if (selectedShotId) clearSelection();
  if (selectedCue) clearSubSelection();
});

function applyWaypointEvent() {
  if (evWaypointIndex < 0) return;
  const action = evAction ? evAction.value : '';
  const wait = parseFloat(evWait ? evWait.value : 0) || 0;
  const sitAt = (action === 'sit_at' && evSeat) ? evSeat.value : '';
  if (!action && !(wait > 0)) delete cinema.events[evWaypointIndex];
  else if (action === 'sit_at') {
    if (!sitAt) { setStatus('Elegí un asiento para "Sentarse en una silla".'); return; }
    cinema.events[evWaypointIndex] = { action, sitAt, wait: wait };
  }
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

// ---------- Control de velocidad de reproducción ----------
const rateSlider = byId('rateSlider');
const rateVal = byId('rateVal');
rateSlider?.addEventListener('input', () => {
  playback.rate = parseFloat(rateSlider.value) || 1;
  if (rateVal) rateVal.textContent = playback.rate.toFixed(2).replace(/0$/, '') + '×';
});

// ---------- Submenú de subtítulos -------------------------------------------
// Panel del modo Editar→Subtítulos (izquierda). Los campos se habilitan al
// hacer click en un bloque de la pista y TODO se guarda solo mientras se
// escribe o ajusta (no hay botones Aplicar ni Cerrar).
let selectedCue = null;
let subSnapshot = null;   // snapshot del subtítulo al seleccionarlo (✕ descarta)

const subPanel = byId('subtitleEditPanel');
const subText = byId('subEditText');
const subFont = byId('subEditFont');
const subSize = byId('subEditSize');
const subSizeVal = byId('subEditSizeVal');
const subColor = byId('subEditColor');
const subStart = byId('subEditStart');
const subEnd = byId('subEditEnd');

function setSubFieldsEnabled(on) {
  [subText, subFont, subSize, subColor, subStart, subEnd].forEach(f => {
    if (f) f.disabled = !on;
  });
  qsa('.sub-icon-btn').forEach(b => { b.disabled = !on; });
  const del = byId('subEditDelete');
  if (del) del.disabled = !on;
}

// (Sin bloqueo visual: la selección de un subtítulo no oscurece nada; la
// edición es en vivo y se des-selecciona al hacer click fuera de Subtítulos.)

function openSubEditor(cue) {
  if (!cue || !subPanel || !subtitleTrack.includes(cue)) return;
  // Exclusividad con la toma seleccionada y el cartel (quiz): elegir un
  // subtítulo libera los otros bloques en edición.
  if (selectedShotId) clearSelection();
  clearQuizSelection();
  selectedCue = cue;
  // Snapshot para poder DESCARTAR con ✕ (vuelve a este texto/tiempos)
  subSnapshot = JSON.parse(JSON.stringify({ start: cue.start, end: cue.end, text: cue.text, font: cue.font, size: cue.size, color: cue.color }));
  if (subText) subText.value = cue.text;
  if (subFont) subFont.value = cue.font || '"Segoe UI", Arial, sans-serif';
  if (subSize) { subSize.value = cue.size || 30; }
  if (subSizeVal) subSizeVal.textContent = String(cue.size || 30);
  if (subColor) subColor.value = cue.color || '#ffffff';
  if (subStart) subStart.value = cue.start.toFixed(1);
  if (subEnd) subEnd.value = cue.end.toFixed(1);
  setSubFieldsEnabled(true);
  renderSubtitles();
  blockEdit.set('sub');
  window.dispatchEvent(new CustomEvent('sub-selected'));
  window.dispatchEvent(new CustomEvent('edit-mode-request', { detail: { mode: 'subtitulos' } }));
}

export function clearSubSelection() {
  const hadSelection = selectedCue !== null;
  selectedCue = null;
  setSubFieldsEnabled(false);
  if (hadSelection) { renderSubtitles(); blockEdit.set(null); }
}

function cueValid() {
  return !!selectedCue && subtitleTrack.includes(selectedCue);
}

function commitSubtitles(sort = true) {
  if (sort) subtitleTrack.sort((a, b) => a.start - b.start);
  refreshSubtitles();
  renderSubtitles();
}

// Íconos rápidos: insertan el emoji donde está el cursor del texto
qsa('.sub-icon-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!cueValid() || !subText) return;
    const cur = subText.value;
    const at = subText.selectionStart != null ? subText.selectionStart : cur.length;
    const icon = btn.getAttribute('data-icon');
    subText.value = cur.slice(0, at) + icon + cur.slice(at);
    selectedCue.text = subText.value;
    refreshSubtitles();
    renderSubtitles();
    pushHistory();
    subText.focus();
    const np = at + icon.length;
    subText.setSelectionRange(np, np);
  });
});

// --- Edición EN VIVO: cada cambio queda guardado al instante ---
subText?.addEventListener('input', () => {
  if (!cueValid()) return;
  selectedCue.text = subText.value;
  refreshSubtitles();
  renderSubtitles();
});
subText?.addEventListener('change', pushHistory);

subFont?.addEventListener('input', () => {
  if (!cueValid()) return;
  selectedCue.font = subFont.value;
  refreshSubtitles();
  renderSubtitles();
  pushHistory();
});

subSize?.addEventListener('input', () => {
  if (subSizeVal) subSizeVal.textContent = subSize.value;
  if (!cueValid()) return;
  selectedCue.size = parseInt(subSize.value, 10) || 30;
  refreshSubtitles();
  renderSubtitles();
});
subSize?.addEventListener('change', pushHistory);

subColor?.addEventListener('input', () => {
  if (!cueValid()) return;
  selectedCue.color = subColor.value;
  refreshSubtitles();
  renderSubtitles();
});
subColor?.addEventListener('change', pushHistory);

[subStart, subEnd].forEach(inp => {
  inp?.addEventListener('input', () => {
    if (!cueValid()) return;
    const start = Math.max(0, parseFloat(subStart.value) || 0);
    let end = parseFloat(subEnd.value) || 0;
    if (end <= start) end = start + 0.5;
    selectedCue.start = Math.round(start * 10) / 10;
    selectedCue.end = Math.round(end * 10) / 10;
    commitSubtitles(); // ordena + redibuja + refresca overlay
  });
  inp?.addEventListener('change', () => {
    if (!cueValid()) return;
    if (subStart) subStart.value = selectedCue.start.toFixed(1);
    if (subEnd) subEnd.value = selectedCue.end.toFixed(1);
    pushHistory();
  });
});

byId('subEditDelete')?.addEventListener('click', () => {
  if (!cueValid()) return;
  const i = subtitleTrack.indexOf(selectedCue);
  if (i >= 0) subtitleTrack.splice(i, 1);
  selectedCue = null;
  setSubFieldsEnabled(false);
  commitSubtitles();
  pushHistory();
  setStatus('Subtítulo eliminado.');
});

byId('subEditNew')?.addEventListener('click', () => {
  const t = Math.max(0, Math.round(timeline.time * 10) / 10);
  const cue = { start: t, end: t + 2, text: 'Nuevo subtítulo' };
  subtitleTrack.push(cue);
  commitSubtitles();
  openSubEditor(cue);
  pushHistory();
  if (subText) subText.select();
});

// ---------- Botones ＋ de cada pista: crear bloques nuevos ----------
// Toma nueva: VA AL FINAL de la última toma existente (continuación de la
// cinemática), no al cabezal — así nunca se superpone con lo que ya hay y
// sigue el hilo temporal. Seleccionada para editarla en vivo (cámara,
// personaje, duración…). 💾 guarda, ✕ descarta.
byId('btnAddShot')?.addEventListener('pointerdown', (e) => e.stopPropagation());
byId('btnAddShot')?.addEventListener('click', (e) => {
  e.stopPropagation();
  // Fin de la última toma (o el cabezal si no hay ninguna — lo que sea mayor)
  const endOfLast = timeline.shots.reduce((m, s) => Math.max(m, s.start + s.duration), 0);
  const t = Math.max(endOfLast, 0);
  const shot = {
    id: 'shot' + (++shotCounter),
    start: round2(t),
    duration: 2,
    camMode: 'free',
    subjectId: null,
    label: '',
    color: '#5685cf'
  };
  timeline.shots.push(shot);
  timeline.shots.sort((a, b) => a.start - b.start);
  refreshDuration();
  renderShots();
  renderRuler();
  // Llevar el cabezal al inicio de la toma nueva para verla en contexto
  timeline.time = shot.start;
  updatePlayheadUI();
  selectShot(shot.id);
  updateTransportUI();
  setStatus('Toma nueva al final: elegí la vista/cámara y su duración. 💾 guarda, ✕ descarta.');
});

// Subtítulo nuevo: al final del último subtítulo (sin superponerse),
// seleccionado para escribir directo.
byId('btnAddSub')?.addEventListener('pointerdown', (e) => e.stopPropagation());
byId('btnAddSub')?.addEventListener('click', (e) => {
  e.stopPropagation();
  const endOfLast = subtitleTrack.reduce((m, c) => Math.max(m, c.end), 0);
  const t = Math.max(endOfLast, 0);
  const cue = { start: round2(t), end: round2(t + 2), text: 'Nuevo subtítulo' };
  subtitleTrack.push(cue);
  commitSubtitles();
  openSubEditor(cue);
  pushHistory();
  if (subText) subText.select();
  setStatus('Subtítulo nuevo: escribí el texto. 💾 guarda, ✕ descarta.');
});

// ---------- Init ----------
updateTransportUI();

// Refresco completo (usado al abrir un proyecto guardado)
export function refreshTimelineUI() {
  refreshDuration();
  selectedShotId = null;
  renderShots();
  renderRuler();
  clearSubSelection();
  updateTransportUI();
  renderCharBlocks();
}

// Al cargar un proyecto, sincronizar el contador de tomas
export function setShotCounter(n) {
  shotCounter = Math.max(shotCounter, n);
}