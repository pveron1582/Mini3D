import * as THREE from 'three';
import { output } from '../core.js';

// ==========================================
// QUIZ DE CIERRE (cartel con pregunta y opciones)
// ==========================================
// Se dibuja DENTRO del canvas WebGL (pase ortográfico encima del render),
// igual que los subtítulos, para que salga en el video grabado.
// Muestra una pregunta, 3 opciones y un reloj de cuenta regresiva; al
// agotarse el tiempo marca la opción correcta en verde con un check.

// Dimensiones del canvas del quiz y duración por defecto de la cuenta regresiva.
const QUIZ_WIDTH = 1024;
const QUIZ_HEIGHT = 576;
const QUIZ_DURATION_SECONDS = 10;

const qCanvas = document.createElement('canvas');
qCanvas.width = QUIZ_WIDTH;
qCanvas.height = QUIZ_HEIGHT;
const qctx = qCanvas.getContext('2d');

const qTex = new THREE.CanvasTexture(qCanvas);
qTex.colorSpace = THREE.SRGBColorSpace;

const qScene = new THREE.Scene();
const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const qQuad = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.MeshBasicMaterial({ map: qTex, transparent: true, depthTest: false, depthWrite: false })
);
qQuad.frustumCulled = false;
qQuad.renderOrder = 998;
qScene.add(qQuad);

const state = {
  active: false,
  startTime: 0,
  question: '',
  options: [],
  correct: 0,
  duration: QUIZ_DURATION_SECONDS,
  marked: false
};

// Activar el cartel. El reloj avanza con los ticks de la escena (ver quizTick),
// así no depende de timeline.time (que se reinicia al terminar la escena).
export function showQuiz(cfg) {
  state.active = true;
  state.elapsed = 0;
  state.question = (cfg && cfg.question) || '';
  state.options = (cfg && Array.isArray(cfg.options)) ? cfg.options : [];
  state.correct = (cfg && typeof cfg.correct === 'number') ? cfg.correct : 0;
  state.duration = Math.max(1, (cfg && cfg.duration) || QUIZ_DURATION_SECONDS);
  state.marked = false;
}

export function resetQuiz() {
  state.active = false;
  state.marked = false;
  qQuad.visible = false;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLines(ctx, text, maxW) {
  const lines = [];
  let line = '';
  text.split(' ').forEach(w => {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  });
  if (line) lines.push(line);
  return lines;
}

function draw() {
  qctx.clearRect(0, 0, QUIZ_WIDTH, QUIZ_HEIGHT);

  // Encendido ligeramente oscurecido detrás del cartel
  qctx.fillStyle = 'rgba(5, 8, 14, 0.55)';
  qctx.fillRect(0, 0, QUIZ_WIDTH, QUIZ_HEIGHT);

  // Panel principal
  const pw = 820, ph = 430, px = (QUIZ_WIDTH - pw) / 2, py = (QUIZ_HEIGHT - ph) / 2;
  qctx.fillStyle = 'rgba(18, 23, 34, 0.96)';
  roundRect(qctx, px, py, pw, ph, 18);
  qctx.fill();
  qctx.lineWidth = 3;
  qctx.strokeStyle = '#5685cf';
  roundRect(qctx, px, py, pw, ph, 18);
  qctx.stroke();

  // Título
  qctx.textAlign = 'center';
  qctx.textBaseline = 'middle';
  qctx.fillStyle = '#ffd35c';
  qctx.font = 'bold 34px "Segoe UI", Arial, sans-serif';
  qctx.fillText('🔒 ¿QUÉ HACER AHORA?', QUIZ_WIDTH / 2, py + 42);

  // Pregunta (centrada, con wrap)
  qctx.fillStyle = '#ffffff';
  qctx.font = 'bold 26px "Segoe UI", Arial, sans-serif';
  const qLines = wrapLines(qctx, state.question, pw - 120);
  const qTop = py + 108;
  qLines.forEach((l, i) => qctx.fillText(l, QUIZ_WIDTH / 2, qTop + i * 34));

  // Opciones (A/B/C)
  const opts = state.options.slice(0, 3);
  const optH = 62, optGap = 16, optW = pw - 160;
  const optLeft = (QUIZ_WIDTH - optW) / 2;
  const letters = ['A', 'B', 'C'];
  opts.forEach((opt, i) => {
    const oy = qTop + qLines.length * 36 + 12 + i * (optH + optGap);
    const isCorrect = state.marked && i === state.correct;
    const isWrong = state.marked && i !== state.correct;

    qctx.fillStyle = isCorrect ? 'rgba(50, 200, 100, 0.90)'
      : isWrong ? 'rgba(200, 60, 60, 0.55)'
      : 'rgba(42, 50, 68, 0.95)';
    roundRect(qctx, optLeft, oy, optW, optH, 10);
    qctx.fill();
    qctx.lineWidth = 2;
    qctx.strokeStyle = isCorrect ? '#2ecc71' : (isWrong ? '#e74c3c' : 'rgba(120, 140, 175, 0.6)');
    roundRect(qctx, optLeft, oy, optW, optH, 10);
    qctx.stroke();

    qctx.textAlign = 'center';
    qctx.fillStyle = isCorrect ? '#ffffff' : '#5685cf';
    qctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
    qctx.fillText(letters[i], optLeft + 36, oy + optH / 2);

    qctx.textAlign = 'left';
    qctx.fillStyle = '#ffffff';
    qctx.font = '20px "Segoe UI", Arial, sans-serif';
    qctx.fillText(opt, optLeft + 60, oy + optH / 2);

    if (state.marked && isCorrect) {
      qctx.textAlign = 'right';
      qctx.font = 'bold 26px "Segoe UI", Arial, sans-serif';
      qctx.fillStyle = '#ffffff';
      qctx.fillText('✔', optLeft + optW - 22, oy + optH / 2);
    }
  });

  // Reloj de cuenta regresiva (inferior derecha del panel)
  const remain = Math.max(0, state.duration - (state.elapsed || 0));
  const secs = Math.ceil(remain);
  const cx = px + pw - 70, cy = py + ph - 62, cr = 36;
  qctx.beginPath();
  qctx.arc(cx, cy, cr, 0, Math.PI * 2);
  qctx.fillStyle = 'rgba(0,0,0,0.4)';
  qctx.fill();
  qctx.lineWidth = 6;
  qctx.strokeStyle = state.marked ? '#2ecc71' : '#ffb347';
  qctx.beginPath();
  qctx.arc(cx, cy, cr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (remain / state.duration));
  qctx.stroke();
  qctx.textAlign = 'center';
  qctx.fillStyle = state.marked ? '#2ecc71' : '#ffffff';
  qctx.font = 'bold 30px "Segoe UI", Arial, sans-serif';
  qctx.fillText(state.marked ? '✓' : secs, cx, cy + 2);
}

// Avanza el reloj del cartel con el dt de la simulación. Al agotarse los
// segundos marca la correcta y se mantiene unos segundos más antes de ocultarse.
export function quizTick(dt) {
  if (!state.active) return;
  state.elapsed += dt;
  if (state.elapsed >= state.duration && !state.marked) state.marked = true;
  // Tras marcar, mantener 3 s más para que se lea la respuesta y cerrar
  if (state.marked && state.elapsed >= state.duration + 3) resetQuiz();
}

// ¿Hay un cartel en pantalla ahora? (Lo usan los subtítulos para ocultarse
// mientras el cartel está activo; cuando el cartel termina su reloj, vuelven.)
export function quizIsActive() { return state.active; }

// Dibuja (y compone sobre el render principal) el cartel si está activo.
export function renderQuizOverlay() {
  if (!state.active) { qQuad.visible = false; return; }
  draw();
  qTex.needsUpdate = true;
  qQuad.visible = true;
  const prevAuto = output.renderer.autoClear;
  output.renderer.autoClear = false;
  output.renderer.render(qScene, qCam);
  output.renderer.autoClear = prevAuto;
}
