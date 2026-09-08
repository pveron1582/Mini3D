import { camera, controls, renderer, canvas } from '../core.js';
import { byId, qs, qsa } from '../dom.js';
import { gridHelper, subGrid, axesGroup, cursor3D } from '../lights.js';
import { setEnvironment } from '../environment.js';
import { recorderState, interactiveRegistry } from '../state.js';
import { updateCameraViewVisibility, setCamView } from '../cinema/cinematics.js';

// ==========================================
// DOM & VIEWPORT CONTROLS
// ==========================================
const toggleGridBtn = byId('toggleGridBtn');
const toggleAxesBtn = byId('toggleAxesBtn');
const resetCamBtn = byId('resetCamBtn');
const snapViewFront = byId('snapViewFront');
const snapViewTop = byId('snapViewTop');
const snapViewSide = byId('snapViewSide');

// ==========================================
// VUELO DE CÁMARA AL OBJETIVO (focus + zoom intermedio)
// ==========================================
// Lleva la cámara hasta un objeto/personaje con un vuelo suave y la deja a
// una distancia intermedia (ni primer plano ni general). La usa la lista de
// personajes y la de objetos: elegir uno = ir hasta él.
const FLY_DIST = 4.5;   // distancia final al objetivo (m) — acercamiento medio
const FLY_TIME = 0.85;   // duración del vuelo (s)
let flyAnim = null;

export function flyToTarget(id) {
  const entry = interactiveRegistry.get(id);
  if (!entry || !entry.group) return;
  const p = entry.group.position;
  const focusY = (entry.type === 'human' || entry.type === 'pet') ? p.y + 0.9 : p.y + 0.4;
  const focus = { x: p.x, y: focusY, z: p.z };
  const fromCam = camera.position.clone();
  const fromTgt = controls.target.clone();
  flyAnim = {
    t0: performance.now(),
    fromCam, fromTgt,
    toCam: { x: focus.x, y: focus.y + 1.3, z: focus.z + FLY_DIST },
    toTgt: focus
  };
  setCamView('orbit');
}

function flyEase(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

export function updateFlyTo(now) {
  if (!flyAnim) return;
  const t = Math.min(1, (now - flyAnim.t0) / (FLY_TIME * 1000));
  const k = flyEase(t);
  camera.position.set(
    flyAnim.fromCam.x + (flyAnim.toCam.x - flyAnim.fromCam.x) * k,
    flyAnim.fromCam.y + (flyAnim.toCam.y - flyAnim.fromCam.y) * k,
    flyAnim.fromCam.z + (flyAnim.toCam.z - flyAnim.fromCam.z) * k
  );
  controls.target.set(
    flyAnim.fromTgt.x + (flyAnim.toTgt.x - flyAnim.fromTgt.x) * k,
    flyAnim.fromTgt.y + (flyAnim.toTgt.y - flyAnim.fromTgt.y) * k,
    flyAnim.fromTgt.z + (flyAnim.toTgt.z - flyAnim.fromTgt.z) * k
  );
  if (t >= 1) flyAnim = null;
}

// ==========================================
// SNAPS DE VISTA
// ==========================================
function addSnap(btn, fn) { btn && btn.addEventListener('click', fn); }

addSnap(snapViewFront, () => {
  camera.position.set(0, 1.8, 8.0);
  controls.target.set(0, 1.0, 0);
  setCamView('orbit');
});
addSnap(snapViewTop, () => {
  camera.position.set(0, 16.0, 0.001);
  controls.target.set(0, 0, 0);
  setCamView('top');
});
addSnap(snapViewSide, () => {
  camera.position.set(13.0, 2.5, 0);
  controls.target.set(0, 1.0, 0);
  setCamView('side');
});
toggleGridBtn?.addEventListener('click', () => {
  gridHelper.visible = !gridHelper.visible;
  subGrid.visible = gridHelper.visible;
  toggleGridBtn.classList.toggle('active', gridHelper.visible);
});
toggleAxesBtn?.addEventListener('click', () => {
  axesGroup.visible = !axesGroup.visible;
  cursor3D.visible = axesGroup.visible;
  toggleAxesBtn.classList.toggle('active', axesGroup.visible);
});
resetCamBtn?.addEventListener('click', () => {
  camera.position.set(0, 13, 9);
  controls.target.set(0, 0.5, 0);
});

// Proporción del video: la MISMA que la exportación (1920×1080). El canvas
// de edición siempre respeta esta proporción — el área sobrante del
// contenedor queda como franja vacía (letterbox), así lo que ves al editar
// es exactamente el encuadre que saldrá en el video.
import { EXPORT_ASPECT } from '../media/recorder.js';

function onResize() {
  if (recorderState.isRecording) return;
  const container = byId('viewport-container');
  if (!container) return;
  const cw = container.clientWidth;
  const ch = container.clientHeight;
  // Tamaño máximo que mantiene la proporción dentro del contenedor
  let w = cw, h = cw / EXPORT_ASPECT;
  if (h > ch) { h = ch; w = ch * EXPORT_ASPECT; }
  const x = (cw - w) / 2;
  const y = (ch - h) / 2;
  const st = canvas.style;
  st.left = x + 'px';
  st.top = y + 'px';
  st.width = w + 'px';
  st.height = h + 'px';
  camera.aspect = EXPORT_ASPECT;
  camera.updateProjectionMatrix();
  controls.update();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', onResize);
setTimeout(onResize, 0);
setTimeout(onResize, 100);
setTimeout(onResize, 500);
// Al terminar una exportación, recalcular (recorder restaura el tamaño)
window.addEventListener('recorder-exited', onResize);
