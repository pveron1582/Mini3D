import * as THREE from 'three';
import { byId, qs, qsa } from './dom.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const canvas = byId('view');

export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// Use a minimum size of 1×1; viewport.js will call onResize() to set the correct size
// once the DOM layout is fully calculated.
const _initW = canvas.clientWidth || 1;
const _initH = canvas.clientHeight || 1;
renderer.setSize(_initW, _initH);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1c23);

export const camera = new THREE.PerspectiveCamera(48, _initW / _initH, 0.01, 1000);
// Vista inicial elevada: se ve toda la oficina de un vistazo
camera.position.set(0, 13, 9);

export const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
// Desplazamiento con botón derecho: rápido y en el plano de la pantalla
// (moverse "por el aire" para recorrer la escena a buena velocidad)
controls.screenSpacePanning = true;
controls.panSpeed = 2.2;
// La rueda NO hace zoom: desplaza la cámara adelante/atrás según el punto
// de vista (dolly libre). El zoom de OrbitControls queda desactivado.
controls.enableZoom = false;

// Paso del dolly con la rueda (m por unidad de delta): se achica en modo suave.
let wheelStep = 0.02;

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const step = -Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * wheelStep;
  const dir = camera.getWorldDirection(new THREE.Vector3());
  camera.position.addScaledVector(dir, step);
  controls.target.addScaledVector(dir, step);
}, { passive: false });
controls.rotateSpeed = 1.0;
controls.target.set(0, 0.5, 0);

// ==========================================
// VUELO CON BOTÓN DERECHO (desplazamiento constante)
// ==========================================
// OrbitControls escala el paneo con la distancia al objetivo: al acercarse,
// moverse con botón derecho se vuelve lentísimo. Lo reemplazamos por un
// desplazamiento propio a velocidad constante (~0.02 m por píxel), en el
// plano de la pantalla: un arrastre cruza la oficina entera sin importar
// el nivel de zoom.
let FLY_SPEED = 0.07; // metros por píxel de arrastre (bien ágil para recorrer la escena)

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

let flyDrag = null;
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 2) return;
  flyDrag = { x: e.clientX, y: e.clientY };
  controls.enabled = false;
});

window.addEventListener('pointermove', (e) => {
  if (!flyDrag) return;
  const dx = e.clientX - flyDrag.x;
  const dy = e.clientY - flyDrag.y;
  flyDrag = { x: e.clientX, y: e.clientY };
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
  const delta = right.multiplyScalar(-dx * FLY_SPEED).add(up.multiplyScalar(dy * FLY_SPEED));
  camera.position.add(delta);
  controls.target.add(delta);
});

window.addEventListener('pointerup', (e) => {
  if (e.button === 2 && flyDrag) {
    flyDrag = null;
    controls.enabled = true;
  }
});

// ==========================================
// MODO SUAVE (movimiento preciso con un solo botón)
// ==========================================
// Un solo interruptor (🐢 Suave junto a Frontal/Superior/Lateral) que vuelve
// precisos los 3 movimientos de cámara: dolly con la rueda, vuelo con botón
// derecho y rotación con botón izquierdo. Apagado = velocidades actuales.
export let smoothMove = false;

const MOVE_SPEEDS = {
  normal: { rotate: 1.0, pan: 2.2, fly: 0.07, wheel: 0.02 },
  smooth: { rotate: 0.2, pan: 0.4, fly: 0.012, wheel: 0.0035 }
};

export function setSmoothMove(on) {
  smoothMove = !!on;
  const s = smoothMove ? MOVE_SPEEDS.smooth : MOVE_SPEEDS.normal;
  controls.rotateSpeed = s.rotate;
  controls.panSpeed = s.pan;
  FLY_SPEED = s.fly;
  wheelStep = s.wheel;
}