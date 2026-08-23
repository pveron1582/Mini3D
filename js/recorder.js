import { canvas } from './core.js';
import { store, recorderState } from './state.js';

// ==========================================
// VIDEO RECORDER & EXPORT
// ==========================================
let mediaRecorder = null;
let recordedChunks = [];

const exportBtn = document.getElementById('exportBtn');
const durationInput = document.getElementById('durationInput');
const fpsInput = document.getElementById('fpsInput');
const statusEl = document.getElementById('status');

export function setStatus(s) { if (statusEl) statusEl.textContent = s; }

function pickMime() {
  const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for (const t of types) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

export function startRecording(durationOverride) {
  recordedChunks = [];
  recorderState.recordTime = 0;
  recorderState.recordDuration = durationOverride !== undefined
    ? durationOverride
    : (parseFloat(durationInput.value) || 5);
  const fps = parseInt(fpsInput.value) || 30;

  const stream = canvas.captureStream(fps);
  const mime = pickMime();
  mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `animacion_${store.currentEnv}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`Video descargado: animacion_${store.currentEnv}.webm`);
    exportBtn.textContent = '⬇ Grabar & Exportar Video';
    exportBtn.classList.remove('danger');
    exportBtn.classList.add('primary');
    recorderState.isRecording = false;
  };

  mediaRecorder.start();
  recorderState.isRecording = true;
  exportBtn.textContent = '⏹ Grabando...';
  exportBtn.classList.remove('primary');
  exportBtn.classList.add('danger');
  setStatus(`Grabando video (${recorderState.recordDuration}s)...`);
}

exportBtn.addEventListener('click', () => {
  if (recorderState.isRecording) {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  } else {
    startRecording();
  }
});

export { mediaRecorder };
