import { camera, controls, renderer } from '../core.js';
import { byId, qs, qsa } from '../dom.js';
import { gridHelper, subGrid, axesGroup, cursor3D } from '../lights.js';
import { setEnvironment } from '../environment.js';
import { recorderState, interactiveRegistry } from '../state.js';
import { setCamView } from '../cinema/cinematics.js';

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
  // Punto de foco: centro aproximado del objeto (personajes: pecho; objetos:
  // su posición + algo de altura si están en el piso).
  const p = entry.group.position;
  const focusY = (entry.type === 'human' || entry.type === 'pet') ? p.y + 0.9 : Math.min(p.y + 0.5, p.y + 1.2);
  const focus = { x: p.x, y: focusY, z: p.z };
  // Mantener la dirección actual de la cámara: volar "hacia" el objetivo
  // por donde ya se lo está mirando, y quedar a distancia intermedia.
  const dir = new (camera.position.constructor)(
    camera.position.x - controls.target.x,
    0,
    camera.position.z - controls.target.z
  );
  if (dir.lengthSq() < 0.001) dir.set(0, 0, 1);
  dir.normalize();
  // Altura final: un poco por encima del foco, mirando levemente hacia abajo
  flyAnim = {
    t0: performance.now(),
    fromCam: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    fromTgt: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
    toCam: { x: focus.x + dir.x * FLY_DIST, y: focus.y + 1.3, z: focus.z + dir.z * FLY_DIST },
    toTgt: focus
  };
  // Asegurar vista libre durante el vuelo (sin seguimientos activos)
  setCamView('orbit');
}

// Easing suave (aceleración y frenado)
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

qsa('.section-header').forEach(header => {
  header.addEventListener('click', () => {
    header.parentElement.classList.toggle('collapsed');
  });
});

qsa('.env-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const env = btn.getAttribute('data-env');
    if (env) setEnvironment(env);
  });
});

toggleGridBtn.addEventListener('click', () => {
  gridHelper.visible = !gridHelper.visible;
  subGrid.visible = gridHelper.visible;
  toggleGridBtn.classList.toggle('active', gridHelper.visible);
});

toggleAxesBtn.addEventListener('click', () => {
  axesGroup.visible = !axesGroup.visible;
  cursor3D.visible = axesGroup.visible;
  toggleAxesBtn.classList.toggle('active', axesGroup.visible);
});

resetCamBtn.addEventListener('click', () => {
  camera.position.set(0, 13, 9);
  controls.target.set(0, 0.5, 0);
});

snapViewFront.addEventListener('click', () => {
  camera.position.set(0, 1.8, 8.0);
  controls.target.set(0, 1.0, 0);
});

snapViewTop.addEventListener('click', () => {
  camera.position.set(0, 16.0, 0.001);
  controls.target.set(0, 0, 0);
});

snapViewSide.addEventListener('click', () => {
  camera.position.set(13.0, 2.5, 0);
  controls.target.set(0, 1.0, 0);
});

function onResize() {
  // Durante la exportación el canvas queda fijo en 1920×1080 (1080p):
  // un resize de la ventana no debe pisar esa resolución.
  if (recorderState.isRecording) return;
  const container = byId('viewport-container');
  if (!container) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  controls.update();
  renderer.setSize(w, h);
}

window.addEventListener('resize', onResize);
// Call onResize at multiple points to handle different layout-ready timings
setTimeout(onResize, 0);
setTimeout(onResize, 100);
setTimeout(onResize, 500);