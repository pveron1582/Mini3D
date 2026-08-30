import * as THREE from 'three';
import { renderer } from '../core.js';
import { subtitlesHiddenAt } from '../cinema/quizTrack.js';

// ==========================================
// SUBTÍTULOS SOBRE EL CANVAS 3D
// ==========================================
// Los subtítulos se dibujan DENTRO del canvas WebGL (pase ortográfico encima
// del render), porque canvas.captureStream solo captura el contenido del
// canvas: un <div> HTML por encima NO saldría en el video grabado.
//
// Pista de subtítulos: lista de cues { start, end, text, font?, size?, color? }
// font/size/color son opcionales (se usan valores por defecto al dibujar).
export const subtitleTrack = [];

export function setSubtitles(cues) {
  subtitleTrack.length = 0;
  (cues || []).forEach(c => {
    if (c && c.text && c.end > c.start) subtitleTrack.push({ ...c });
  });
  subtitleTrack.sort((a, b) => a.start - b.start);
  refreshSubtitles();
}

export function clearSubtitles() {
  subtitleTrack.length = 0;
}

function cueAt(t) {
  for (let i = 0; i < subtitleTrack.length; i++) {
    const c = subtitleTrack[i];
    if (t >= c.start && t < c.end) return c;
  }
  return null;
}

// ---------- Overlay: lienzo 2D + pase ortográfico ----------
// El lienzo representa la PANTALLA COMPLETA (proporción 16:9); la franja de
// subtítulos ocupa solo una banda baja con texto de ~5% de la altura de
// pantalla, como en una película/serie. El plano cubre toda la pantalla, así
// no hace falta recalcular nada al redimensionar la vista.
const SUB_W = 1024, SUB_H = 576;
const subCanvas = document.createElement('canvas');
subCanvas.width = SUB_W;
subCanvas.height = SUB_H;
const sctx = subCanvas.getContext('2d');

const subTex = new THREE.CanvasTexture(subCanvas);
subTex.colorSpace = THREE.SRGBColorSpace;

const orthoScene = new THREE.Scene();
const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
// Plano pantalla-completa: la franja de subtítulos ocupa solo la parte baja
// del lienzo, así no hace falta recalcular nada al redimensionar la vista.
const quad = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.MeshBasicMaterial({ map: subTex, transparent: true, depthTest: false, depthWrite: false })
);
quad.frustumCulled = false;
quad.renderOrder = 999;
orthoScene.add(quad);

let lastText = null;

function drawCue(cue) {
  sctx.clearRect(0, 0, SUB_W, SUB_H);
  if (!cue || !cue.text) return;
  const text = cue.text;
  const font = cue.font || '"Segoe UI", Arial, sans-serif';
  const fontSize = cue.size || 30;
  const color = cue.color || '#ffffff';

  // Tamaño tipográfico configurable por subtítulo (por defecto ~5% alto)
  sctx.font = 'bold ' + fontSize + 'px ' + font;
  sctx.textAlign = 'center';
  sctx.textBaseline = 'middle';

  // Partir en líneas de a lo sumo ~860px
  const words = text.split(' ');
  const lines = [];
  let line = '';
  words.forEach(w => {
    const test = line ? line + ' ' + w : w;
    if (sctx.measureText(test).width > 860 && line) { lines.push(line); line = w; }
    else line = test;
  });
  if (line) lines.push(line);

  const lineH = Math.round(fontSize * 1.27);
  const boxH = lines.length * lineH + 18;
  const boxW = Math.min(SUB_W - 40, Math.max(...lines.map(l => sctx.measureText(l).width)) + 44);
  const bx = (SUB_W - boxW) / 2;
  const by = SUB_H - boxH - 14;

  // Fondo semi-transparente redondeado
  sctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  sctx.beginPath();
  sctx.roundRect(bx, by, boxW, boxH, 8);
  sctx.fill();

  // Texto con borde negro fino (color elegible por subtítulo)
  lines.forEach((l, i) => {
    const ty = by + 9 + lineH / 2 + i * lineH;
    sctx.lineWidth = 5;
    sctx.strokeStyle = '#000';
    sctx.strokeText(l, SUB_W / 2, ty);
    sctx.fillStyle = color;
    sctx.fillText(l, SUB_W / 2, ty);
  });
}

// Llamar DESPUÉS de renderer.render() principal. time < 0 oculta los subtítulos.
export function renderSubtitleOverlay(time) {
  // Coexistencia con los carteles de pregunta (pista 📋 QUIZ): mientras un
  // cartel está en pantalla, los subtítulos de ese tramo NO se dibujan
  // (el cartel los tapa). Es uno u otro, nunca los dos a la vez.
  let cue = time >= 0 ? cueAt(time) : null;
  if (cue && subtitlesHiddenAt(time)) cue = null;
  // La firma incluye el estilo: si cambia fuente/tamaño/color se redibuja
  const sig = cue ? [cue.start, cue.end, cue.text, cue.font, cue.size, cue.color].join('|') : null;
  if (sig !== lastText) {
    drawCue(cue);
    subTex.needsUpdate = true;
    lastText = sig;
  }
  quad.visible = !!cue;
  if (!cue) return;
  const prevAuto = renderer.autoClear;
  renderer.autoClear = false;
  renderer.render(orthoScene, orthoCam);
  renderer.autoClear = prevAuto;
}

// Fuerza el redibujado del overlay al próximo frame (tras editar un cue)
export function refreshSubtitles() {
  lastText = null;
}
