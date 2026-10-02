import * as THREE from 'three';
import { byId } from '../dom.js';
import { canvas, renderer, camera, output } from '../core.js';
import { store, recorderState, audioBus } from '../state.js';

// ==========================================
// VIDEO RECORDER & EXPORT
// ==========================================
// El botón ⬇ Exportar genera el video de la película completa (la escena se
// reproduce desde el inicio mientras se graba). Formato: 1080p (1920×1080) fijo
// y 60 fps; MP4 (H.264) si el navegador lo soporta, si no WebM (VP9/VP8).
const EXPORT_W = 1920;
const EXPORT_H = 1080;
const EXPORT_FPS = 60;
// Proporción del video (16:9): la usa el viewport de edición para que el
// canvas SIEMPRE tenga el mismo encuadre que el video exportado.
export const EXPORT_ASPECT = EXPORT_W / EXPORT_H;

let mediaRecorder = null;
let recordedChunks = [];
let savedSize = null;       // tamaño del viewport antes de exportar
let savedPixelRatio = 1;
let offscreen = null;       // { renderer, canvas } reutilizado entre exportaciones
let exportOverlay = null;   // canvas offscreen mostrado sobre el viewport

const exportBtn = byId('exportBtn');
const statusEl = byId('status');

export function setStatus(s) { if (statusEl) statusEl.textContent = s; }

// ==========================================
// FORMATO DEL VIDEO (#1: MP4 primero, WebM como respaldo)
// ==========================================
// MP4 (H.264) es el formato cómodo para editar/subir; los navegadores que lo
// soportan en MediaRecorder lo anuncian por isTypeSupported (Chrome/Edge y
// Safari). Si ninguno está disponible se cae a WebM (VP9 → VP8), que funciona
// en todos. `pref` permite forzar 'webm' desde el selector de la barra.
const MP4_MIMES = [
  'video/mp4;codecs=avc1.64003E,mp4a.40.2',
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4;codecs=avc1.64003E',
  'video/mp4'
];
const WEBM_MIMES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

export function exportFormatOptions() {
  if (typeof window === 'undefined' || !window.MediaRecorder) return { mp4: false, webm: false };
  return {
    mp4: MP4_MIMES.some(t => MediaRecorder.isTypeSupported(t)),
    webm: WEBM_MIMES.some(t => MediaRecorder.isTypeSupported(t))
  };
}

// Elección del contenedor (pura y testeable): con `pref = 'webm'` se fuerza
// WebM; con 'auto' se prefiere MP4 y se cae a WebM. Devuelve { mime, ext };
// mime '' cuando no hay ningún formato disponible.
export function pickExportMime(pref = 'auto', isSupported = defaultIsTypeSupported) {
  const order = pref === 'webm' ? WEBM_MIMES : MP4_MIMES.concat(WEBM_MIMES);
  for (const t of order) {
    if (isSupported(t)) return { mime: t, ext: t.startsWith('video/mp4') ? 'mp4' : 'webm' };
  }
  return { mime: '', ext: 'webm' };
}

function defaultIsTypeSupported(t) {
  return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t);
}

// ==========================================
// RELOJ FIJO DE EXPORTACIÓN (backlog #7)
// ==========================================
// Durante la grabación la simulación avanza por pasos fijos de 1/30 s
// acumulados sobre el reloj real (en vez del dt crudo de cada frame): el
// movimiento queda muestreado en una grilla temporal estable — sin saltos
// por drops y con la misma trayectoria en cada exportación. El audio
// (WebAudio, continuo) sigue en tiempo real, igual que el corte del video.
export const SIM_STEP = 1 / 30;
export const simClock = { acc: 0 };

// Suma dt real (escalado por rate) y devuelve cuántos pasos fijos toca
// simular este frame. Con pausa devuelve 0. Tope anti-espiral: si la máquina
// no llega, se suelta lastre en vez de frenar la escena.
export function consumeSimTime(rawDt, rate, paused) {
  if (paused) return 0;
  simClock.acc += Math.min(rawDt, 0.25) * (rate || 1);
  let n = 0;
  while (simClock.acc >= SIM_STEP && n < 4) {
    simClock.acc -= SIM_STEP;
    n++;
  }
  if (n === 4) simClock.acc = 0;
  return n;
}

// ==========================================
// SALIDA 1080p FIJA Y OFFLINE (#2)
// ==========================================
// El video se renderiza en un canvas/renderer PROPIOS de 1920×1080 (fuera del
// viewport de edición): la resolución del video ya no depende del tamaño de la
// ventana ni se toca el canvas de edición durante la grabación. El canvas
// offscreen se muestra encima del viewport (mismas medidas) para que igual se
// vea la exportación en vivo; el renderer de salida (core.output) apunta a él
// mientras dura la grabación, así subtítulos y quiz también salen en el video.
// El renderer offscreen se crea en la PRIMERA exportación y se reutiliza
// después: quien no exporta no paga un segundo contexto WebGL.
function ensureOffscreen() {
  if (offscreen) return offscreen;
  const c = document.createElement('canvas');
  c.width = EXPORT_W;
  c.height = EXPORT_H;
  const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, preserveDrawingBuffer: true, alpha: true });
  r.setPixelRatio(1);
  r.setSize(EXPORT_W, EXPORT_H, false);
  // Mismo look que el viewport: tone mapping y espacio de color idénticos.
  r.toneMapping = renderer.toneMapping;
  r.toneMappingExposure = renderer.toneMappingExposure;
  r.outputColorSpace = renderer.outputColorSpace;
  r.shadowMap.enabled = renderer.shadowMap.enabled;
  r.shadowMap.type = renderer.shadowMap.type;
  offscreen = { renderer: r, canvas: c };
  return offscreen;
}

function enterExportResolution() {
  let off = null;
  try { off = ensureOffscreen(); } catch (err) { off = null; }
  if (!off) {
    // Respaldo (sin segundo contexto WebGL): el comportamiento anterior —
    // se estira el renderer de la ventana a 1080p igual que antes.
    savedSize = renderer.getSize(new THREE.Vector2());
    savedPixelRatio = renderer.getPixelRatio();
    renderer.setPixelRatio(1);
    renderer.setSize(EXPORT_W, EXPORT_H, false);
    camera.aspect = EXPORT_ASPECT;
    camera.updateProjectionMatrix();
    output.renderer = renderer;
    return canvas;
  }
  output.renderer = off.renderer;
  // Mostrar el canvas offscreen sobre el viewport respetando el letterbox 16:9
  // que ya calculó viewport.js (mismas left/top/width/height que el canvas WebGL).
  const st = canvas.style;
  const o = off.canvas.style;
  o.position = 'absolute';
  o.left = st.left || '0';
  o.top = st.top || '0';
  o.width = st.width || '100%';
  o.height = st.height || '100%';
  o.pointerEvents = 'none';
  o.zIndex = '5';
  if (!exportOverlay) {
    exportOverlay = off.canvas;
    canvas.parentNode?.appendChild(exportOverlay);
  }
  exportOverlay.style.display = 'block';
  camera.aspect = EXPORT_ASPECT;
  camera.updateProjectionMatrix();
  return off.canvas;
}

function exitExportResolution() {
  if (exportOverlay) exportOverlay.style.display = 'none';
  output.renderer = renderer;
  if (!savedSize) return;
  renderer.setPixelRatio(savedPixelRatio);
  renderer.setSize(savedSize.x, savedSize.y, false);
  camera.aspect = savedSize.x / savedSize.y;
  camera.updateProjectionMatrix();
  savedSize = null;
  // El viewport recalcula su encuadre 16:9 (el canvas vuelve al letterbox)
  window.dispatchEvent(new Event('recorder-exited'));
}

export function startRecording(durationOverride, fileName, formatPref = 'auto') {
  recordedChunks = [];
  recorderState.recordTime = 0;
  recorderState.recordDuration = durationOverride !== undefined ? durationOverride : 5;
  simClock.acc = 0;   // la exportación arranca en fase cero: trayectoria idéntica siempre
  const exportCanvas = enterExportResolution();
  const { mime, ext } = pickExportMime(formatPref);
  // Nombre sin extensión (el llamador no la conoce: depende del contenedor)
  const base = (fileName || ('pelicula_' + store.currentEnv)).replace(/\.(webm|mp4)$/i, '');

  const stream = exportCanvas.captureStream(EXPORT_FPS);
  // Pistas de audio de la escena (audio.js, vía bus para no ciclar imports):
  // entran al mismo MediaRecorder — el archivo sale con video + audio en una
  // sola pasada. Sin pistas, el video sale mudo como siempre.
  try {
    audioBus.getExportTracks().forEach(t => stream.addTrack(t));
  } catch (err) { /* audio no disponible: sigue solo video */ }
  mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = () => {
    exitExportResolution();
    const blob = new Blob(recordedChunks, { type: mime || 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = base + '.' + ext;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`Video exportado: ${a.download} (1080p ${EXPORT_FPS} fps, .${ext}).`);
    exportBtn.textContent = '⬇ Exportar';
    exportBtn.classList.remove('danger');
    exportBtn.classList.add('primary');
    recorderState.isRecording = false;
  };

  mediaRecorder.start();
  recorderState.isRecording = true;
  exportBtn.textContent = '⏹ Exportando...';
  exportBtn.classList.remove('primary');
  exportBtn.classList.add('danger');
  setStatus(`Exportando video (${recorderState.recordDuration.toFixed(1)}s a 1080p ${EXPORT_FPS} fps, .${ext})...`);
}

export { mediaRecorder };