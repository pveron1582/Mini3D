// js/trayDraw.js — Herramienta de dibujo de canaletas punto a punto (Lote 3).
// Al elegir "Canaleta de Cables" en el catálogo, en vez de spawnear una pieza
// fija se entra en modo dibujo: el primer click marca el inicio, cada click
// siguiente agrega un tramo (con un ghost transparente que sigue al mouse), y
// ESC o click derecho termina. El resultado es UN único objeto seleccionable,
// movible con el gizmo y serializable (guarda sus puntos en spawnData).
//
// Routing ORTOGONAL: los tramos siempre son rectos (eje X o Z). Nunca se dibuja
// una diagonal: el ghost se ajusta al punto recto más cercano según la dirección
// dominante del mouse.
//
// IMÁN a la red existente: si el mouse se acerca a un extremo o a un tramo de una
// canaleta ya creada (instalación fija u otro tramo dibujado, a la misma altura),
// el ghost se "pega" a ese punto y resuelve la conexión de forma ortogonal:
//   - continuación recta,  - esquina en 90°,  - unión en "T" a un tramo recto.
//
// Interacción (no pelea con la cámara):
//   click izquierdo sin arrastrar  -> coloca un punto
//   arrastrar izquierdo            -> orbita la cámara (OrbitControls, intacto)
//   click derecho sin arrastrar    -> termina y crea el tramo
//   arrastrar derecho              -> vuela/panea (core.js, intacto)
//   ESC                            -> termina (crea si hay 2+ puntos, si no cancela)
import * as THREE from 'three';
import { scene, camera, renderer } from './core.js';
import { createCableTrayRun, getFixedTraySegments } from './office/network.js';
import { interactiveRegistry, store } from './state.js';
import { setActiveTarget } from './selection.js';
import { pushHistory } from './undo.js';
import { setStatus } from './recorder.js';
import { CATALOG } from './catalog.js';

const canvas = renderer.domElement;

const MAGNET_DIST = 0.5;   // distancia (m) a la que el imán engancha un destino
const HEIGHT_TOL = 0.25;   // tolerancia de altura para conectar (m)
const COL_NORMAL = 0x38c6e0;
const COL_MAGNET = 0x4ade80;

// Altura del plano de dibujo: la declarada en el catálogo para la canaleta.
function trayHeight() {
  const e = CATALOG.find(c => c.id === 'cableTray');
  return (e && e.baseY !== undefined) ? e.baseY : 3.42;
}

// Materiales del ghost (transparente, siempre visible encima de la escena).
const ghostTrayMat = new THREE.MeshStandardMaterial({ color: COL_NORMAL, transparent: true, opacity: 0.35, depthTest: false });
const ghostCableMat = new THREE.MeshBasicMaterial({ color: COL_NORMAL, transparent: true, opacity: 0.5, depthTest: false });
const ghostMagnetMat = new THREE.MeshBasicMaterial({ color: COL_MAGNET, transparent: true, opacity: 0.95, depthTest: false });

let active = false;
let points = [];          // puntos ya colocados [{x, z}]
let ghost = null;         // grupo ghost
let ghostMarker = null;   // marcador del primer punto
let ghostSegA = null;     // segmento ghost 1 (longitud 1, se escala)
let ghostSegB = null;     // segmento ghost 2 (para el codo del routing)
let ghostMagnet = null;   // resaltado del punto imán
let downPos = null;       // posición del pointerdown (para click vs arrastre)
let downButton = -1;

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const plane = new THREE.Plane();
const hit = new THREE.Vector3();

// Listeners que se notifican al crear un tramo (ui.js refresca el outliner).
const createdListeners = [];
export function onTrayCreated(cb) { createdListeners.push(cb); }

export function isTrayDrawing() { return active; }

// ---------- geometría de routing ortogonal ----------

// Punto recto más cercano al mouse respecto del último punto colocado.
export function orthoSnap(last, p) {
  const dx = Math.abs(p.x - last.x), dz = Math.abs(p.z - last.z);
  return dx >= dz ? { x: p.x, z: last.z } : { x: last.x, z: p.z };
}

function dominantAxis(last, p) {
  return Math.abs(p.x - last.x) >= Math.abs(p.z - last.z) ? 'x' : 'z';
}

// Punto más cercano de un segmento (a->b) al punto p, con parámetro t y distancia.
export function nearestOnSegment(p, a, b) {
  const abx = b.x - a.x, abz = b.z - a.z;
  const len2 = abx * abx + abz * abz;
  if (len2 < 1e-9) return { x: a.x, z: a.z, t: 0, dist: Math.hypot(p.x - a.x, p.z - a.z) };
  let t = ((p.x - a.x) * abx + (p.z - a.z) * abz) / len2;
  t = Math.max(0, Math.min(1, t));
  const qx = a.x + t * abx, qz = a.z + t * abz;
  return { x: qx, z: qz, t, dist: Math.hypot(p.x - qx, p.z - qz) };
}

// Recorre `last -> target` solo con tramos rectos. Devuelve los puntos a AGREGAR
// (sin incluir `last`). `finalAxis` orienta el último tramo (para uniones en T).
export function routeOrtho(last, target, finalAxis) {
  const dx = Math.abs(target.x - last.x), dz = Math.abs(target.z - last.z);
  if (dx < 0.01 && dz < 0.01) return [];
  if (dx < 0.01 || dz < 0.01) return [{ x: target.x, z: target.z }];
  if (finalAxis === 'z') return [{ x: target.x, z: last.z }, { x: target.x, z: target.z }];
  return [{ x: last.x, z: target.z }, { x: target.x, z: target.z }];
}

// ---------- destinos del imán (red existente) ----------

// Todos los tramos de canaleta conectables: instalación fija + tramos dibujados.
function collectTargetSegments() {
  const segs = [];
  for (const s of getFixedTraySegments()) segs.push(s);
  interactiveRegistry.forEach(entry => {
    const g = entry.group;
    if (!g || !g.userData || g.userData.catalogId !== 'cableTray') return;
    if (entry.deleted) return;
    const sd = g.userData.spawnData;
    if (!sd || !Array.isArray(sd.points) || sd.points.length < 2) return;
    const ox = g.position.x, oz = g.position.z;
    const y = sd.y !== undefined ? sd.y : g.position.y;
    for (let i = 0; i < sd.points.length - 1; i++) {
      const a = sd.points[i], b = sd.points[i + 1];
      segs.push({ x1: ox + a.x, z1: oz + a.z, x2: ox + b.x, z2: oz + b.z, y });
    }
  });
  return segs;
}

// Busca el destino de imán más cercano al mouse (a la altura de dibujo).
function findMagnet(p, drawHeight) {
  let best = null;
  for (const s of collectTargetSegments()) {
    if (Math.abs(s.y - drawHeight) >= HEIGHT_TOL) continue;
    const a = { x: s.x1, z: s.z1 }, b = { x: s.x2, z: s.z2 };
    const n = nearestOnSegment(p, a, b);
    if (n.dist > MAGNET_DIST) continue;
    if (!best || n.dist < best.dist) {
      const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.z - a.z);
      best = { x: n.x, z: n.z, dist: n.dist, horizontal, isEndpoint: n.t < 0.02 || n.t > 0.98 };
    }
  }
  return best;
}

// Candidato a colocar: imán si engancha, si no routing ortogonal libre.
// Devuelve { route:[{x,z}...], magnet, first }.
function computeCandidate(mousePt) {
  const y = trayHeight();
  const m = findMagnet(mousePt, y);
  if (points.length === 0) {
    const pt = m ? { x: m.x, z: m.z } : mousePt;
    return { route: [pt], magnet: m, first: true };
  }
  const last = points[points.length - 1];
  if (m) {
    // Conexión a red existente: si es un extremo se orienta por el mouse; si es
    // el interior de un tramo (T) se llega perpendicular a ese tramo.
    const finalAxis = m.isEndpoint ? dominantAxis(last, mousePt) : (m.horizontal ? 'z' : 'x');
    return { route: routeOrtho(last, { x: m.x, z: m.z }, finalAxis), magnet: m, first: false };
  }
  return { route: [orthoSnap(last, mousePt)], magnet: null, first: false };
}

// ---------- ghost ----------

function buildGhostSeg() {
  const grp = new THREE.Group();
  const tray = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 0.16), ghostTrayMat);
  tray.renderOrder = 999;
  grp.add(tray);
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(1, 0.02, 0.02), ghostCableMat);
    c.position.set(0, 0.04, -0.05 + i * 0.05);
    c.renderOrder = 999;
    grp.add(c);
  }
  return grp;
}

function ensureGhost() {
  if (ghost) return;
  ghost = new THREE.Group();
  ghostMarker = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 16), ghostTrayMat);
  ghostMarker.renderOrder = 999;
  ghost.add(ghostMarker);
  ghostSegA = buildGhostSeg(); ghostSegA.visible = false; ghost.add(ghostSegA);
  ghostSegB = buildGhostSeg(); ghostSegB.visible = false; ghost.add(ghostSegB);
  ghostMagnet = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), ghostMagnetMat);
  ghostMagnet.renderOrder = 1000;
  ghostMagnet.visible = false;
  ghost.add(ghostMagnet);
  ghost.visible = false;
  scene.add(ghost);
}

function removeGhost() {
  if (!ghost) return;
  scene.remove(ghost);
  ghost = null; ghostMarker = null; ghostSegA = null; ghostSegB = null; ghostMagnet = null;
}

function placeGhostSeg(seg, a, b, y) {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  if (len < 0.02) { seg.visible = false; return; }
  seg.visible = true;
  seg.scale.set(len, 1, 1);
  seg.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2);
  seg.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
}

// Proyecta el mouse sobre el plano horizontal a la altura de la canaleta.
function mouseToPlane(e) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  plane.set(new THREE.Vector3(0, 1, 0), -trayHeight());
  return raycaster.ray.intersectPlane(plane, hit) ? { x: hit.x, z: hit.z } : null;
}

function updateGhost(mousePt) {
  if (!ghost) return;
  if (!mousePt) { ghost.visible = false; return; }
  ghost.visible = true;
  const y = trayHeight();
  const cand = computeCandidate(mousePt);
  const col = cand.magnet ? COL_MAGNET : COL_NORMAL;
  ghostTrayMat.color.setHex(col);
  ghostCableMat.color.setHex(col);
  if (cand.magnet) {
    ghostMagnet.visible = true;
    ghostMagnet.position.set(cand.magnet.x, y, cand.magnet.z);
  } else {
    ghostMagnet.visible = false;
  }
  ghostMarker.visible = false; ghostSegA.visible = false; ghostSegB.visible = false;
  if (cand.first) {
    ghostMarker.visible = true;
    ghostMarker.position.set(cand.route[0].x, y, cand.route[0].z);
    return;
  }
  const seq = [points[points.length - 1], ...cand.route];
  if (seq.length >= 2) placeGhostSeg(ghostSegA, seq[0], seq[1], y);
  if (seq.length >= 3) placeGhostSeg(ghostSegB, seq[1], seq[2], y);
}

// ---------- ciclo de la herramienta ----------

function nextRunNumber() {
  let n = 1;
  while (interactiveRegistry.has('cableTray_run' + n)) n++;
  return n;
}

export function startTrayDraw() {
  if (active) return;
  active = true;
  store.trayDrawing = true;
  points = [];
  ensureGhost();
  setStatus('🔗 Canaleta: click marca el inicio y cada click agrega un tramo recto. Se pega a la red existente. ESC o click derecho termina.');
}

function finishTrayDraw(commit) {
  if (!active) return;
  active = false;
  store.trayDrawing = false;
  removeGhost();
  const pts = points;
  points = [];
  downPos = null;
  downButton = -1;
  if (commit && pts.length >= 2) {
    const n = nextRunNumber();
    const id = 'cableTray_run' + n;
    const g = createCableTrayRun(id, '🔗 Canaleta ' + n, pts, trayHeight());
    g.userData.catalogId = 'cableTray';
    g.userData.spawned = true;
    const reg = interactiveRegistry.get(id);
    if (reg) reg.spawned = true;
    setActiveTarget(id);
    pushHistory();
    createdListeners.forEach(cb => cb(id));
    setStatus(`🔗 Canaleta creada (${pts.length - 1} tramo/s). Podés moverla con el gizmo.`);
  } else {
    setStatus('Dibujo de canaleta cancelado.');
  }
}

// --- eventos (actúan solo mientras `active`) ---
canvas.addEventListener('pointerdown', (e) => {
  if (!active) return;
  downPos = { x: e.clientX, y: e.clientY };
  downButton = e.button;
});

window.addEventListener('pointermove', (e) => {
  if (!active) return;
  updateGhost(mouseToPlane(e));
});

window.addEventListener('pointerup', (e) => {
  if (!active || !downPos) return;
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
  const btn = downButton;
  downPos = null;
  downButton = -1;
  if (moved > 6) return;           // fue un arrastre (cámara), no un click
  if (btn === 0) {
    const pt = mouseToPlane(e);
    if (!pt) return;
    const cand = computeCandidate(pt);
    for (const rp of cand.route) points.push({ x: rp.x, z: rp.z });
    updateGhost(pt);
  } else if (btn === 2) {
    finishTrayDraw(true);
  }
});

window.addEventListener('keydown', (e) => {
  if (!active) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    finishTrayDraw(points.length >= 2);
  }
});
