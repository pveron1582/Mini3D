import { camera, controls, renderer } from './core.js';
import { gridHelper, subGrid, axesGroup, cursor3D } from './lights.js';
import { setEnvironment } from './environment.js';

// ==========================================
// DOM & VIEWPORT CONTROLS
// ==========================================
const toggleGridBtn = document.getElementById('toggleGridBtn');
const toggleAxesBtn = document.getElementById('toggleAxesBtn');
const resetCamBtn = document.getElementById('resetCamBtn');
const snapViewFront = document.getElementById('snapViewFront');
const snapViewTop = document.getElementById('snapViewTop');
const snapViewSide = document.getElementById('snapViewSide');

document.querySelectorAll('.section-header').forEach(header => {
  header.addEventListener('click', () => {
    header.parentElement.classList.toggle('collapsed');
  });
});

document.querySelectorAll('.env-btn').forEach(btn => {
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
  const container = document.getElementById('viewport-container');
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
