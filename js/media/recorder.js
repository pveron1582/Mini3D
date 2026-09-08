import * as THREE from 'three';
import { byId, qs, qsa } from '../dom.js';
import { canvas, renderer, camera } from '../core.js';
import { store, recorderState } from '../state.js';

// ==========================================
// VIDEO RECORDER & EXPORT
// ==========================================
// El botón ⬇ Exportar genera el video de la película completa (la escena se
// reproduce desde el inicio mientras se graba). Formato único por ahora:
// 1080p (1920×1080) a 60 fps; más adelante se agregarán opciones.
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

const exportBtn = byId('exportBtn');
const statusEl = byId('status');

export function setStatus(s) { if (statusEl) statusEl.textContent = s; }

function pickMime() {
  const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for (const t of types) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

// Durante la exportación el canvas se fuerza a 1920×1080 para que el video
// salga siempre en 1080p, sin importar el tamaño de la ventana. Al terminar
// se restaura el tamaño original del viewport.
function enterExportResolution() {
  savedSize = renderer.getSize(new THREE.Vector2());
  savedPixelRatio = renderer.getPixelRatio();
  renderer.setPixelRatio(1);
  renderer.setSize(EXPORT_W, EXPORT_H, false);
  camera.aspect = EXPORT_W / EXPORT_H;
  camera.updateProjectionMatrix();
}

function exitExportResolution() {
  if (!savedSize) return;
  renderer.setPixelRatio(savedPixelRatio);
  renderer.setSize(savedSize.x, savedSize.y, false);
  camera.aspect = savedSize.x / savedSize.y;
  camera.updateProjectionMatrix();
  savedSize = null;
  // El viewport recalcula su encuadre 16:9 (el canvas vuelve al letterbox)
  window.dispatchEvent(new Event('recorder-exited'));
}

export function startRecording(durationOverride, fileName) {
  recordedChunks = [];
  recorderState.recordTime = 0;
  recorderState.recordDuration = durationOverride !== undefined ? durationOverride : 5;
  enterExportResolution();

  const stream = canvas.captureStream(EXPORT_FPS);
  const mime = pickMime();
  mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = () => {
    exitExportResolution();
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || ('pelicula_' + store.currentEnv + '.webm');
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`Video exportado: ${a.download} (1080p ${EXPORT_FPS} fps).`);
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
  setStatus(`Exportando video (${recorderState.recordDuration.toFixed(1)}s a 1080p ${EXPORT_FPS} fps)...`);
}

export { mediaRecorder };