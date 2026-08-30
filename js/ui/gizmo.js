import * as THREE from 'three';
import { byId, qs, qsa } from '../dom.js';
import { scene, camera, canvas, controls } from '../core.js';
import { cinema, view, interactiveRegistry, store } from '../state.js';
import { getActiveObject, getActiveEntry, setActiveTarget, updateSelectionRing, selectionRing, clearActiveTarget, onTargetSelected } from './selection.js';
import { syncSlidersFromTarget, refreshWallPanel } from './ui.js';
import { pushHistory } from '../undo.js';
import { getWallColliders } from '../office/walls.js';
import { officeGroup } from '../office/group.js';
import { entryRadius, resolveDropAfterDrag } from '../collision.js';
import { multi, toggleInMulti, hasMulti, isInMulti, multiCount, clearMulti, beginGroupDrag, updateGroupDrag, endGroupDrag, beginMarquee, updateMarquee, endMarquee } from './multiselect.js';

// ==========================================
// GIZMO DE TRANSFORMACIÓN (Flechas XYZ estilo Blender)
// ==========================================
export const raycaster = new THREE.Raycaster();
export const mouse = new THREE.Vector2();

// Estado del gizmo y arrastre
export const gizmoState = {
  group: null,
  arrows: [],       // { axis: 'x'|'y'|'z', mesh, cone, line }
  rings: [],        // { axis, mesh } anillos de rotación (doble click en flecha)
  activeAxis: null, // eje actualmente arrastrado
  isDragging: false,
  isFreeDrag: false,
  isRingRotation: false,   // girando con anillo de rotación del gizmo
  isAirDrag: false,        // movimiento libre por el aire (anillo azul)
  isScaleDrag: false,      // escalado con la banda del anillo azul
  scaleStartDist: 0,
  scaleStartVal: 1,
  ringLastAngle: 0,
  dragPlane: new THREE.Plane(),
  dragOffset: new THREE.Vector3(),
  dragStart: new THREE.Vector3(),
  dragStartPos: new THREE.Vector3(),
  pointerDownTime: 0,
  pointerDownPos: { x: 0, y: 0 },
  pendingDeselect: false,   // click en vacío del viewport: deseleccionar objeto
  freeDragStarted: false,
  freeDragPlaneY: 0,
  freeDragOffset: new THREE.Vector3(),
  lastPointer: { x: 0, y: 0 }
};

function axisVector(axis) {
  return axis === 'x' ? new THREE.Vector3(1, 0, 0)
    : axis === 'y' ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(0, 0, 1);
}

function createGizmoArrow(axis, colorHex) {
  const arrowGroup = new THREE.Group();
  const dir = axis === 'x' ? new THREE.Vector3(1, 0, 0) : axis === 'y' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);

  // Línea del eje
  const lineLen = 1.4;
  const lineGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    dir.clone().multiplyScalar(lineLen)
  ]);
  const lineMat = new THREE.LineBasicMaterial({ color: colorHex, linewidth: 2 });
  const line = new THREE.Line(lineGeom, lineMat);
  arrowGroup.add(line);

  // Cilindro más grueso para mejor click
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, lineLen, 8),
    new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.35 })
  );
  shaft.position.copy(dir.clone().multiplyScalar(lineLen / 2));
  if (axis === 'x') shaft.rotation.z = -Math.PI / 2;
  else if (axis === 'z') shaft.rotation.x = Math.PI / 2;
  arrowGroup.add(shaft);

  // Cono (punta de flecha)
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.28, 12),
    new THREE.MeshBasicMaterial({ color: colorHex })
  );
  cone.position.copy(dir.clone().multiplyScalar(lineLen + 0.14));
  if (axis === 'x') cone.rotation.z = -Math.PI / 2;
  else if (axis === 'z') cone.rotation.x = Math.PI / 2;
  arrowGroup.add(cone);

  // Esfera central
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  arrowGroup.add(sphere);

  arrowGroup.userData = { axis, isGizmo: true };
  arrowGroup.traverse((child) => {
    child.userData = { axis, isGizmo: true, gizmoRoot: arrowGroup };
  });

  return arrowGroup;
}

// Anillo de rotación para un eje (torus perpendicular al eje)
function createRotationRing(axis, colorHex) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.035, 10, 48),
    new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.85, depthTest: false })
  );
  ring.renderOrder = 999;
  // El torus rodea el eje Z por defecto: orientarlo según el eje
  if (axis === 'y') ring.rotation.x = Math.PI / 2;
  else if (axis === 'x') ring.rotation.y = Math.PI / 2;
  ring.visible = false;
  ring.traverse && ring.traverse((c) => { c.userData = { rotRingAxis: axis, isGizmo: true }; });
  ring.userData = { rotRingAxis: axis, isGizmo: true };
  return ring;
}

export function createTransformGizmo() {
  const g = new THREE.Group();
  g.visible = false;

  const arrowX = createGizmoArrow('x', 0xe04d4d);
  const arrowY = createGizmoArrow('y', 0x48bb78);
  const arrowZ = createGizmoArrow('z', 0x437ee8);

  g.add(arrowX);
  g.add(arrowY);
  g.add(arrowZ);

  gizmoState.arrows = [
    { axis: 'x', group: arrowX },
    { axis: 'y', group: arrowY },
    { axis: 'z', group: arrowZ }
  ];

  // Anillos de rotación (ocultos; doble click en una flecha los muestra)
  const ringX = createRotationRing('x', 0xe04d4d);
  const ringY = createRotationRing('y', 0x48bb78);
  const ringZ = createRotationRing('z', 0x437ee8);
  g.add(ringX);
  g.add(ringY);
  g.add(ringZ);
  gizmoState.rings = [
    { axis: 'x', mesh: ringX },
    { axis: 'y', mesh: ringY },
    { axis: 'z', mesh: ringZ }
  ];

  scene.add(g);
  gizmoState.group = g;
  return g;
}

export const transformGizmo = createTransformGizmo();

export function updateGizmoPosition() {
  const entry = getActiveEntry();
  if (!entry || !entry.group || !entry.group.parent) {
    transformGizmo.visible = false;
    return;
  }
  transformGizmo.visible = true;
  transformGizmo.position.copy(entry.group.position);
  transformGizmo.rotation.set(0, 0, 0);
}

// P5: el gizmo se auto-posiciona cuando cambia la selección, en vez de que
// selection.js lo llame (rompe el ciclo selection → gizmo). selection.js solo
// notifica el cambio vía onTargetSelected.
// Se difiere el registro con queueMicrotask: al evaluarse este módulo durante la
// carga (hay ciclo selection→cinematics→gizmo→selection), llamar onTargetSelected()
// en línea top-level dispara el TDZ de `targetListeners` en selection.js. El microtask
// corre tras terminar de evaluar todo el grafo de módulos, cuando ya está inicializado.
// (render.js además re-posiciona el gizmo cada frame, así que no hay regresión.)
queueMicrotask(() => onTargetSelected(() => updateGizmoPosition()));

export function setGizmoAxisHighlight(axis) {
  gizmoState.arrows.forEach(({ axis: a, group }) => {
    const isActive = a === axis;
    group.traverse((child) => {
      if (child.isMesh && child.material) {
        if (child.material.opacity !== undefined) {
          child.material.opacity = isActive ? 0.8 : 0.35;
        }
        if (isActive) {
          child.material.color.setHex(0xffffff);
        } else {
          const baseColor = a === 'x' ? 0xe04d4d : a === 'y' ? 0x48bb78 : 0x437ee8;
          child.material.color.setHex(baseColor);
        }
      }
    });
  });
}

// ==========================================
// SISTEMA DE SELECCIÓN Y ARRASTRE
// ==========================================
export function getPointerNDC(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
    y: -((e.clientY - rect.top) / rect.height) * 2 + 1
  };
}

export function getIntersectedGizmoAxis(e) {
  const ndc = getPointerNDC(e);
  raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  const gizmoMeshes = [];
  gizmoState.arrows.forEach(({ group }) => {
    group.traverse((child) => {
      if (child.isMesh) gizmoMeshes.push(child);
    });
  });
  const hits = raycaster.intersectObjects(gizmoMeshes, false);
  if (hits.length > 0) {
    let curr = hits[0].object;
    while (curr) {
      if (curr.userData && curr.userData.axis) return curr.userData.axis;
      curr = curr.parent;
    }
  }
  return null;
}

export function getIntersectedObjectId(e) {
  const ndc = getPointerNDC(e);
  raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);

  const testList = [];
  interactiveRegistry.forEach((entry) => {
    if (!entry.group || !entry.group.visible) return;
    // Personajes siempre clickeables.
    const isChar = entry.type === 'human' || entry.type === 'pet';
    // Paredes, puertas y ventanas SOLO en modo "Editar Edificio".
    const isBuilding = entry.type === 'wall' || entry.type === 'door' || entry.type === 'window' || entry.type === 'floor';
    if (isBuilding && !store.editBuilding) return;
    // El resto del mobiliario/equipos solo con "Editar Objetos" ON.
    if (!isChar && !isBuilding && !store.editObjects) return;
    testList.push(entry.group);
  });

  const hits = raycaster.intersectObjects(testList, true);
  if (hits.length > 0) {
    let curr = hits[0].object;
    while (curr) {
      if (curr.userData && curr.userData.id) {
        return curr.userData.id;
      }
      curr = curr.parent;
    }
  }
  return null;
}

// Hit sobre un anillo de rotación visible del gizmo
function getIntersectedRotRing(e) {
  const ndc = getPointerNDC(e);
  raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  const meshes = gizmoState.rings.filter(r => r.mesh.visible).map(r => r.mesh);
  if (!meshes.length) return null;
  const hits = raycaster.intersectObjects(meshes, false);
  return hits.length ? hits[0].object.userData.rotRingAxis : null;
}

// Hit sobre el anillo azul de selección: 'band' (banda = escalar) | 'inner' (interior = mover)
function getSelectionRingHit(e) {
  if (!selectionRing || !selectionRing.visible) return null;
  const ndc = getPointerNDC(e);
  raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  const hits = raycaster.intersectObjects(selectionRing.children, false);
  if (!hits.length) return null;
  // children[0] = banda del anillo, children[1] = círculo interior
  return hits[0].object === selectionRing.children[0] ? 'band' : 'inner';
}

// Mostrar/ocultar anillos de rotación (uno a la vez)
function setRotationRingVisible(axis) {
  gizmoState.rings.forEach(r => { r.mesh.visible = r.axis === axis; });
}

// Normalizar un ángulo al rango [-PI, PI]
function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Base ortonormal (u, v) del plano perpendicular al eje, con u×v = eje
function ringBasis(axis) {
  if (axis === 'x') return { u: new THREE.Vector3(0, 1, 0), v: new THREE.Vector3(0, 0, 1) };
  if (axis === 'y') return { u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 0, -1) };
  return { u: new THREE.Vector3(1, 0, 0), v: new THREE.Vector3(0, 1, 0) };
}

// Ángulo del puntero alrededor del objeto en el plano del eje dado
function pointerAxisAngle(e, obj, axis) {
  const axisVec = axisVector(axis);
  gizmoState.dragPlane.setFromNormalAndCoplanarPoint(axisVec, obj.position);
  const hit = new THREE.Vector3();
  if (!projectPointerToPlane(e, gizmoState.dragPlane, hit)) return null;
  const d = hit.sub(obj.position);
  const { u, v } = ringBasis(axis);
  return Math.atan2(d.dot(v), d.dot(u));
}

// --- Rotación con anillo del gizmo (eje X, Y o Z según la flecha) ---
function startGizmoRingRotation(e, axis) {
  const obj = getActiveObject();
  if (!obj) return;
  const a = pointerAxisAngle(e, obj, axis);
  if (a === null) return;
  gizmoState.isRingRotation = true;
  gizmoState.isDragging = true;
  gizmoState.activeAxis = axis;
  gizmoState.ringLastAngle = a;
  controls.enabled = false;
  canvas.style.cursor = 'grabbing';
}

function updateGizmoRingRotation(e) {
  const obj = getActiveObject();
  if (!obj) return;
  const a = pointerAxisAngle(e, obj, gizmoState.activeAxis);
  if (a === null) return;
  const delta = normalizeAngle(a - gizmoState.ringLastAngle);
  gizmoState.ringLastAngle = a;
  const raw = obj.rotation[gizmoState.activeAxis] + delta;
  const snapped = snapRotation(raw);
  obj.rotation[gizmoState.activeAxis] = snapped;
  if (snapped !== raw) {
    const deg = Math.round(THREE.MathUtils.radToDeg(snapped) % 360);
    showSnapBadge(deg + '°');
  } else {
    hideSnapBadge();
  }
  syncSlidersFromTarget();
}

// --- Movimiento libre por el aire (anillo azul de selección) ---
function startAirDrag(e) {
  const obj = getActiveObject();
  if (!obj) return;
  // Marcar el arrastre: collision.js no lo empuja contra paredes mientras se
  // mueve (se puede cruzar de un lado al otro); al soltar se resuelve.
  store.dragTargetId = obj.userData.id;
  gizmoState.isAirDrag = true;
  gizmoState.isDragging = true;
  gizmoState.activeAxis = null;
  // Plano HORIZONTAL a la altura del objeto: el anillo azul se comporta como
  // el "piso" del objeto — arrastrarlo lo mueve por el suelo (X/Z) sin perder
  // su altura de apoyo (personajes siguen con su groundY, objetos con la suya).
  gizmoState.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), obj.position);
  const hit = new THREE.Vector3();
  if (projectPointerToPlane(e, gizmoState.dragPlane, hit)) {
    gizmoState.dragOffset.copy(hit).sub(obj.position);
    gizmoState.dragOffset.y = 0;   // solo desplazamiento lateral
  }
  controls.enabled = false;
  canvas.style.cursor = 'grabbing';
}

function updateAirDrag(e) {
  const obj = getActiveObject();
  if (!obj) return;
  const hit = new THREE.Vector3();
  if (!projectPointerToPlane(e, gizmoState.dragPlane, hit)) return;
  const newPos = hit.sub(gizmoState.dragOffset);

  // Personajes: se mantienen APOYADOS — piso, o encima del mueble que quede
  // debajo (mesa/silla/sillón). No vuelan: el drag mueve en XZ y la altura
  // se resuelve sola según lo que hay debajo. Objetos: conservan su Y.
  const entry = getActiveEntry();
  if (entry && entry.rig) {
    const seated = (entry.rig.currentAction || '').startsWith('sit') || entry.rig.currentAction === 'lay';
    if (!seated) {
      newPos.y = supportHeightAt(newPos.x, newPos.z, obj) + (entry.rig.groundY || 0.17);
    } else {
      newPos.y = obj.position.y;
    }
  } else {
    newPos.y = obj.position.y;
  }

  applySnapXZ(newPos, obj);
  obj.position.copy(newPos);
  updateSelectionRing();
  updateGizmoPosition();
  syncSlidersFromTarget();
}

// Altura de apoyo para un personaje en (x,z): la tapa del mueble más alto
// que quede debajo de él (mesa/silla/sillón/estante). Busca el objeto cuyo
// XZ contenga al personaje y devuelve la Y de su "tapa"; 0 si es el piso.
// Los personajes no se apoyan en otros personajes ni en cosas montadas en
// pared (APs, mini rack): esas van a altura de persona y no son "muebles".
function supportHeightAt(x, z, selfObj) {
  let best = 0;
  interactiveRegistry.forEach(entry => {
    if (!entry.group || entry.deleted || entry.rig) return;          // solo muebles/objetos
    if (entry.group === selfObj) return;
    if (entry.type === 'wall' || entry.type === 'door' || entry.type === 'window' || entry.type === 'floor') return;
    const p = entry.group.position;
    if (p.y > 1.0) return;                                           // montado en pared: no es apoyo
    const he = entryHalfExtents(entry);
    if (Math.abs(x - p.x) > he.hx + 0.15 || Math.abs(z - p.z) > he.hz + 0.15) return;
    // "Tapa" aproximada del mueble: su Y + radio*escala (mesa ≈0.76, silla ≈0.5)
    const top = p.y + entryRadius(entry) * (entry.group.scale.x || 1);
    if (top > best && top < 1.35) best = top;
  });
  return best;
}

// --- Escalado con la banda del anillo azul ---
// Arrastrar el anillo hacia afuera agranda la figura; hacia adentro la achica
function startScaleDrag(e) {
  const obj = getActiveObject();
  if (!obj) return;
  gizmoState.isScaleDrag = true;
  gizmoState.isDragging = true;
  gizmoState.activeAxis = null;
  // Plano perpendicular a la cámara por el objeto: la distancia del puntero
  // al centro define el factor de escala
  const camDir = camera.getWorldDirection(new THREE.Vector3());
  gizmoState.dragPlane.setFromNormalAndCoplanarPoint(camDir, obj.position);
  const hit = new THREE.Vector3();
  if (!projectPointerToPlane(e, gizmoState.dragPlane, hit)) { gizmoState.isScaleDrag = false; return; }
  gizmoState.scaleStartDist = Math.max(0.05, hit.distanceTo(obj.position));
  gizmoState.scaleStartVal = obj.scale.x;
  controls.enabled = false;
  canvas.style.cursor = 'grabbing';
}

function updateScaleDrag(e) {
  const obj = getActiveObject();
  if (!obj) return;
  const hit = new THREE.Vector3();
  if (!projectPointerToPlane(e, gizmoState.dragPlane, hit)) return;
  const dist = Math.max(0.05, hit.distanceTo(obj.position));
  const rawS = THREE.MathUtils.clamp(gizmoState.scaleStartVal * (dist / gizmoState.scaleStartDist), 0.2, 4);
  const s = snapScale(rawS);
  if (s !== rawS) showSnapBadge(s.toFixed(2).replace(/\.?0+$/, '') + 'x');
  else hideSnapBadge();
  obj.scale.set(s, s, s);
  updateSelectionRing();
  updateGizmoPosition();
}


// Piso mínimo del objeto activo (los personajes tienen su propio nivel)
function groundMinY() {
  const entry = getActiveEntry();
  const act = entry && entry.rig ? (entry.rig.currentAction || '') : '';
  const seated = act.startsWith('sit') || act === 'lay';
  return entry && entry.rig && entry.rig.groundY && !seated ? entry.rig.groundY : 0;
}

// Proyectar punto del mouse a un plano
export function projectPointerToPlane(e, plane, outVec) {
  const ndc = getPointerNDC(e);
  raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  const target = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, target);
  if (target) outVec.copy(target);
  return target ? true : false;
}

// Arrastre a lo largo de un eje
function startAxisDrag(e, axis) {
  const obj = getActiveObject();
  if (!obj) return;

  // Marcar el arrastre (collision.js no lo empuja contra paredes mientras
  // arrastra; al soltar se resuelve al lado más cercano).
  store.dragTargetId = obj.userData.id;
  gizmoState.activeAxis = axis;
  gizmoState.isDragging = true;
  gizmoState.isFreeDrag = false;
  gizmoState.dragStart.copy(obj.position);
  gizmoState.dragStartPos.copy(obj.position);

  // Plano perpendicular al eje de la cámara (para proyectar el mouse)
  const camDir = camera.getWorldDirection(new THREE.Vector3());
  const axisVec = axisVector(axis);
  const planeNormal = new THREE.Vector3().crossVectors(camDir, axisVec).normalize();
  if (planeNormal.lengthSq() < 0.01) {
    planeNormal.set(0, 1, 0);
  }
  gizmoState.dragPlane.setFromNormalAndCoplanarPoint(planeNormal, obj.position);

  const hitPoint = new THREE.Vector3();
  if (projectPointerToPlane(e, gizmoState.dragPlane, hitPoint)) {
    gizmoState.dragOffset.copy(hitPoint).sub(obj.position);
  }

  setGizmoAxisHighlight(axis);
  controls.enabled = false;
  canvas.style.cursor = 'grabbing';
}

function updateAxisDrag(e) {
  const obj = getActiveObject();
  if (!obj || !gizmoState.activeAxis) return;

  const hitPoint = new THREE.Vector3();
  if (!projectPointerToPlane(e, gizmoState.dragPlane, hitPoint)) return;

  const axis = gizmoState.activeAxis;
  const axisVec = axisVector(axis);

  const delta = hitPoint.clone().sub(gizmoState.dragOffset);
  const projected = delta.dot(axisVec);

  const newPos = gizmoState.dragStart.clone();
  if (axis === 'x') newPos.x += projected;
  else if (axis === 'y') newPos.y += projected;
  else if (axis === 'z') newPos.z += projected;

  // Límite de altura del piso (Y >= 0)
  const minY = groundMinY();
  if (newPos.y < minY) newPos.y = minY;
  applySnapXZ(newPos, obj);
  applySnapY(newPos, obj);

  obj.position.copy(newPos);
  updateSelectionRing();
  updateGizmoPosition();
  syncSlidersFromTarget();
}

// Arrastre libre (movimiento en plano XZ)
function startFreeDrag(e) {
  const obj = getActiveObject();
  if (!obj) return;

  gizmoState.isFreeDrag = true;
  gizmoState.isDragging = true;
  gizmoState.activeAxis = null;
  gizmoState.freeDragPlaneY = obj.position.y;

  // Plano horizontal a la altura del objeto
  gizmoState.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), obj.position);

  const hitPoint = new THREE.Vector3();
  if (projectPointerToPlane(e, gizmoState.dragPlane, hitPoint)) {
    gizmoState.dragOffset.copy(hitPoint).sub(obj.position);
  }

  setGizmoAxisHighlight(null);
  controls.enabled = false;
  canvas.style.cursor = 'grabbing';
}

function updateFreeDrag(e) {
  const obj = getActiveObject();
  if (!obj) return;

  const hitPoint = new THREE.Vector3();
  if (!projectPointerToPlane(e, gizmoState.dragPlane, hitPoint)) return;

  const newPos = hitPoint.clone().sub(gizmoState.dragOffset);
  newPos.y = obj.position.y; // Mantener altura actual

  // Límite de altura del piso (Y >= 0)
  const minY = groundMinY();
  if (newPos.y < minY) newPos.y = minY;
  applySnapXZ(newPos, obj);

  obj.position.copy(newPos);
  updateSelectionRing();
  updateGizmoPosition();
  syncSlidersFromTarget();
}

function endDrag() {
  gizmoState.isDragging = false;
  gizmoState.isFreeDrag = false;
  gizmoState.isRingRotation = false;
  gizmoState.isAirDrag = false;
  gizmoState.isScaleDrag = false;
  gizmoState.activeAxis = null;
  gizmoState.freeDragStarted = false;
  setGizmoAxisHighlight(null);
  controls.enabled = true;
  canvas.style.cursor = 'default';
  edgeHighlight.visible = false;
  hideSnapGuides();
  hideSnapBadge();
  endWallEdgeDrag();
  // Al soltar: si el personaje/objeto quedó atravesando una pared o puerta,
  // el sistema lo acomoda pegado al lado más cercano (sin quedar a medias).
  resolveDropAfterDrag();
  syncSlidersFromTarget();
  pushHistory();
}

// ==========================================
// SNAP MAGNÉTICO (imán de referencias)
// ==========================================
// Al mover/rotar/escalar, los objetos se pegan a referencias cercanas:
// caras de paredes, centros de otros objetos, alturas comunes, ángulos
// múltiplos de 15° y escalas múltiplos de 0.25.

const SNAP_DIST = 0.12;   // radio del imán en metros
const SNAP_HEIGHTS = [0, 0.45, 0.76]; // piso, altura de asiento, tapa de escritorio
const SNAP_ROT = Math.PI / 12;        // 15 grados
const SNAP_SCALE = 0.25;

function isShown(obj) {
  let o = obj;
  while (o) { if (!o.visible) return false; o = o.parent; }
  return true;
}

// Medias dimensiones de un objeto en XZ (paredes por sus datos, resto por radio)
function entryHalfExtents(entry) {
  const wd = entry.group.userData.wallData;
  if (wd) {
    const swap = Math.abs(Math.sin(entry.group.rotation.y)) > 0.5;
    return { hx: (swap ? wd.d : wd.w) / 2, hz: (swap ? wd.w : wd.d) / 2 };
  }
  const r = Math.min(entryRadius(entry), 3);
  return { hx: r, hz: r };
}

// Valores de referencia para un eje: caras de paredes y centros de objetos
function collectSnapValues(excludeObj, axis) {
  const vals = [];
  if (officeGroup.visible) {
    getWallColliders().forEach(b => {
      if (axis === 'x') { vals.push(b.minX, b.maxX); } else { vals.push(b.minZ, b.maxZ); }
    });
  }
  interactiveRegistry.forEach(e => {
    if (!e.group || e.group === excludeObj || e.group.userData.wallData) return;
    if (!isShown(e.group)) return;
    if (e.group.position.y > 1.0) return; // montado en altura: no referencia
    vals.push(axis === 'x' ? e.group.position.x : e.group.position.z);
  });
  return vals;
}

// Líneas guía finas donde actúa el imán (cian, en el plano del piso)
const snapGuideMat = new THREE.LineBasicMaterial({ color: 0x38c6e0, transparent: true, opacity: 0.6 });
const snapGuides = [0, 1].map(() => {
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    snapGuideMat
  );
  line.visible = false;
  line.renderOrder = 1000;
  scene.add(line);
  return line;
});

function showSnapGuide(i, axis, value, pos) {
  const g = snapGuides[i];
  const A = new THREE.Vector3(), B = new THREE.Vector3();
  if (axis === 'x') { A.set(value, 0.02, pos.z - 12); B.set(value, 0.02, pos.z + 12); }
  else { A.set(pos.x - 12, 0.02, value); B.set(pos.x + 12, 0.02, value); }
  g.geometry.setFromPoints([A, B]);
  g.visible = true;
}

function hideSnapGuides() {
  snapGuides.forEach(g => { g.visible = false; });
}

// Aviso flotante de snap (ángulos rectos / múltiplos de escala)
let snapBadge = null;
function showSnapBadge(text) {
  if (!snapBadge) {
    snapBadge = document.createElement('div');
    snapBadge.className = 'snap-badge';
    const container = byId('viewport-container');
    if (container) container.appendChild(snapBadge);
  }
  snapBadge.textContent = text;
  snapBadge.classList.add('visible');
}
function hideSnapBadge() {
  if (snapBadge) snapBadge.classList.remove('visible');
}

// Ajustar la posición XZ del objeto para pegar caras con referencias cercanas
function applySnapXZ(pos, obj) {
  const entry = interactiveRegistry.get(obj.userData.id);
  if (!entry) return;
  const he = entryHalfExtents(entry);
  hideSnapGuides();
  ['x', 'z'].forEach((axis, i) => {
    const half = axis === 'x' ? he.hx : he.hz;
    const cur = pos[axis];
    const faces = [cur - half, cur + half];
    const refs = collectSnapValues(obj, axis);
    let best = null;
    faces.forEach(f => {
      refs.forEach(r => {
        const d = r - f;
        if (Math.abs(d) <= SNAP_DIST && (best === null || Math.abs(d) < Math.abs(best.d))) best = { d, ref: r };
      });
    });
    if (best) {
      pos[axis] = cur + best.d;
      showSnapGuide(i, axis, best.ref, pos);
    }
  });
}

// Alturas comunes (para objetos, no personajes que apoyan en el piso)
function applySnapY(pos, obj) {
  const entry = interactiveRegistry.get(obj.userData.id);
  if (!entry || entry.rig) return;
  let best = null;
  SNAP_HEIGHTS.forEach(h => {
    const d = h - pos.y;
    if (d >= -0.05 && Math.abs(d) <= 0.1 && (best === null || Math.abs(d) < Math.abs(best))) best = d;
  });
  if (best !== null) pos.y += best;
}

// Rotación: imán a múltiplos de 15°
function snapRotation(angle) {
  const k = Math.round(angle / SNAP_ROT);
  const target = k * SNAP_ROT;
  return Math.abs(angle - target) < 0.06 ? target : angle;
}

// Escala: imán a múltiplos de 0.25
function snapScale(s) {
  const target = Math.round(s / SNAP_SCALE) * SNAP_SCALE;
  return Math.abs(s - target) < 0.03 ? target : s;
}

// ==========================================
// BORDES DE PARED EDITABLES (agarrar y estirar un solo lado)
// ==========================================
const edgeHighlight = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
  new THREE.LineBasicMaterial({ color: 0xffd24d, depthTest: false, transparent: true, opacity: 0.95 })
);
edgeHighlight.renderOrder = 1001;
edgeHighlight.visible = false;
scene.add(edgeHighlight);

let wallEdgeHover = null;
let wallEdgeDrag = null;

function wallEdges(obj) {
  const wd = obj.userData.wallData;
  const swap = Math.abs(Math.sin(obj.rotation.y)) > 0.5;
  const axis = swap ? 'z' : 'x';
  const halfLen = (swap ? wd.d : wd.w) / 2;
  const halfThick = (swap ? wd.w : wd.d) / 2;
  const p = obj.position;
  const y0 = p.y - wd.h / 2, y1 = p.y + wd.h / 2;
  const c = axis === 'x' ? p.x : p.z;
  const t = axis === 'x' ? p.z : p.x;
  const edges = [];
  [-halfThick, halfThick].forEach(off => {
    const A = new THREE.Vector3(), B = new THREE.Vector3();
    if (axis === 'x') { A.set(c - halfLen, y1, t + off); B.set(c + halfLen, y1, t + off); }
    else { A.set(t + off, y1, c - halfLen); B.set(t + off, y1, c + halfLen); }
    edges.push({ kind: 'top', a: A, b: B });
  });
  [-halfLen, halfLen].forEach(off => {
    const A = new THREE.Vector3(), B = new THREE.Vector3();
    if (axis === 'x') { A.set(c + off, y0, t); B.set(c + off, y1, t); }
    else { A.set(t, y0, c + off); B.set(t, y1, c + off); }
    edges.push({
      kind: off < 0 ? 'endA' : 'endB', a: A, b: B,
      endCoord: c + off, fixedCoord: c - off, sign: off < 0 ? -1 : 1
    });
  });
  return { edges, axis };
}

function toScreen(v3, rect) {
  const v = v3.clone().project(camera);
  return { x: (v.x + 1) / 2 * rect.width + rect.left, y: (-v.y + 1) / 2 * rect.height + rect.top };
}

function distToSegment(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq ? ((px - a.x) * dx + (py - a.y) * dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + t * dx, cy = a.y + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// Borde de pared más cercano al puntero (en píxeles)
function findWallEdge(e, obj) {
  if (!obj || !obj.userData.wallData || !obj.visible) return null;
  const rect = canvas.getBoundingClientRect();
  const { edges, axis } = wallEdges(obj);
  let best = null;
  edges.forEach(ed => {
    const a = toScreen(ed.a, rect), b = toScreen(ed.b, rect);
    const d = distToSegment(e.clientX, e.clientY, a, b);
    if (d < 14 && (!best || d < best.d)) best = Object.assign({}, ed, { d, axis });
  });
  return best;
}

function showEdgeHighlight(a, b) {
  edgeHighlight.geometry.setFromPoints([a.clone(), b.clone()]);
  edgeHighlight.visible = true;
}

function startWallEdgeDrag(e) {
  const obj = getActiveObject();
  if (!obj || !wallEdgeHover) return;
  const wd = obj.userData.wallData;
  wallEdgeDrag = {
    obj,
    kind: wallEdgeHover.kind,
    axis: wallEdgeHover.axis,
    fixedCoord: wallEdgeHover.fixedCoord,
    sign: wallEdgeHover.sign || 1,
    bottomY: obj.position.y - wd.h / 2
  };
  gizmoState.isDragging = true;
  const camDir = camera.getWorldDirection(new THREE.Vector3());
  gizmoState.dragPlane.setFromNormalAndCoplanarPoint(camDir, obj.position);
  controls.enabled = false;
  canvas.style.cursor = 'grabbing';
}

function updateWallEdgeDrag(e) {
  const d = wallEdgeDrag;
  if (!d) return;
  const hit = new THREE.Vector3();
  if (!projectPointerToPlane(e, gizmoState.dragPlane, hit)) return;
  const obj = d.obj;
  const wd = obj.userData.wallData;
  const mesh = obj.userData.wallMesh;
  const swap = Math.abs(Math.sin(obj.rotation.y)) > 0.5;

  if (d.kind === 'top') {
    const newH = THREE.MathUtils.clamp(hit.y - d.bottomY, 1, 6);
    wd.h = Math.round(newH * 20) / 20;
    mesh.scale.y = wd.h;
    obj.position.y = d.bottomY + wd.h / 2;
  } else {
    const coord = d.axis === 'x' ? hit.x : hit.z;
    const newLen = THREE.MathUtils.clamp(Math.abs(coord - d.fixedCoord), 0.5, 30);
    const len = Math.round(newLen * 20) / 20;
    const center = d.fixedCoord + d.sign * (len / 2);
    if (d.axis === 'x') obj.position.x = center; else obj.position.z = center;
    if (swap) { wd.d = len; mesh.scale.z = len; } else { wd.w = len; mesh.scale.x = len; }
  }
  // El borde iluminado sigue al borde que se está estirando
  const best = findWallEdge(e, obj);
  if (best) showEdgeHighlight(best.a, best.b);
  syncSlidersFromTarget();
}

function endWallEdgeDrag() {
  if (!wallEdgeDrag) return;
  refreshWallPanel();
  syncSlidersFromTarget();
  pushHistory();
  wallEdgeDrag = null;
}

// Eventos del mouse
canvas.addEventListener('pointerdown', (e) => {
  if (cinema.active && cinema.mode !== 'play') return;
  if (store.trayDrawing) return;   // dibujando canaleta: no seleccionar/deseleccionar
  const now = performance.now();
  gizmoState.pointerDownTime = now;
  gizmoState.pointerDownPos = { x: e.clientX, y: e.clientY };
  gizmoState.lastPointer = { x: e.clientX, y: e.clientY };

  // 1. Primero verificar si se hizo clic en una flecha del gizmo
  const axis = getIntersectedGizmoAxis(e);
  if (axis) {
    startAxisDrag(e, axis);
    return;
  }

  // 2. Clic en un anillo de rotación visible del gizmo
  const rotAxis = getIntersectedRotRing(e);
  if (rotAxis) {
    startGizmoRingRotation(e, rotAxis);
    return;
  }

  // 3. Borde de pared iluminado: agarrarlo estira SOLO ese lado
  if (wallEdgeHover) {
    startWallEdgeDrag(e);
    return;
  }

  // 4. Anillo azul de selección: el círculo interior = mover. La banda exterior
  //    (escalar) está DESHABILITADA: la escala se controla solo desde el
  //    panel izquierdo, para no molestar al mover (se usa poco).
  const selHit = getSelectionRingHit(e);
  if (selHit === 'inner') {
    startAirDrag(e);
    return;
  }

  // 4. Verificar si se hizo clic en un objeto
  const objId = getIntersectedObjectId(e);
  if (objId) {
    // Ctrl+clic: suma/quita de la selección múltiple (no pierde la previa)
    if (e.ctrlKey || e.metaKey) {
      toggleInMulti(objId);
      setActiveTarget(objId);
      updateGizmoPosition();
      return;
    }
    // Con 2+ seleccionados, arrastrar sobre uno de ellos mueve el bloque
    if (hasMulti() && isInMulti(objId) && multiCount() >= 2) {
      if (beginGroupDrag(e, objId)) {
        controls.enabled = false;
        return;
      }
    }
    // Selección normal sobre un objeto: limpia la multiselección
    if (hasMulti()) clearMulti();
    setActiveTarget(objId);
    updateGizmoPosition();
    return;
  }

  // Clic en vacío: con Ctrl (o con selección activa) comienza la marquesina;
  // si no, queda pendiente la deselección (confirmada en pointerup).
  if (e.ctrlKey || e.metaKey) {
    beginMarquee(e);
    controls.enabled = false;
    return;
  }
  if (hasMulti()) clearMulti();
  gizmoState.pendingDeselect = true;
});

// Doble click en una flecha → mostrar/ocultar su anillo de rotación
canvas.addEventListener('dblclick', (e) => {
  if (cinema.active && cinema.mode !== 'play') return;
  const axis = getIntersectedGizmoAxis(e);
  if (!axis) return;
  const ring = gizmoState.rings.find(r => r.axis === axis);
  setRotationRingVisible(ring && ring.mesh.visible ? null : axis);
});

canvas.addEventListener('pointermove', (e) => {
  if (cinema.active && cinema.mode !== 'play') return;
  if (store.trayDrawing) return;   // dibujando canaleta: el ghost lo maneja trayDraw

  // Movimiento del bloque seleccionado (multiselección)
  if (multi.dragging) { updateGroupDrag(e); return; }
  // Marquesina: redimensionar el rectángulo de selección
  if (multi.marqueeActive) { updateMarquee(e); return; }

  // Arrastre de borde de pared
  if (wallEdgeDrag) {
    updateWallEdgeDrag(e);
    return;
  }

  // Hover sobre bordes de la pared seleccionada
  if (!gizmoState.isDragging) {
    const obj = getActiveObject();
    const edge = obj ? findWallEdge(e, obj) : null;
    if (edge) {
      wallEdgeHover = edge;
      showEdgeHighlight(edge.a, edge.b);
      canvas.style.cursor = 'pointer';
    } else if (wallEdgeHover) {
      wallEdgeHover = null;
      edgeHighlight.visible = false;
    }
  }

  // Hover sobre flechas del gizmo
  if (!gizmoState.isDragging) {
    const axis = getIntersectedGizmoAxis(e);
    if (axis) {
      setGizmoAxisHighlight(axis);
      canvas.style.cursor = 'pointer';
    } else {
      setGizmoAxisHighlight(null);
      canvas.style.cursor = 'default';
    }
  }

  // Arrastre de eje
  if (gizmoState.isDragging && gizmoState.activeAxis && !gizmoState.isRingRotation) {
    updateAxisDrag(e);
    return;
  }

  // Rotación con anillo del gizmo
  if (gizmoState.isDragging && gizmoState.isRingRotation) {
    updateGizmoRingRotation(e);
    return;
  }

  // Movimiento libre por el aire (círculo interior)
  if (gizmoState.isDragging && gizmoState.isAirDrag) {
    updateAirDrag(e);
    return;
  }

  // Escalado (banda del anillo azul)
  if (gizmoState.isDragging && gizmoState.isScaleDrag) {
    updateScaleDrag(e);
    return;
  }

  // Arrastre libre con espera
  if (gizmoState.isDragging && gizmoState.isFreeDrag) {
    updateFreeDrag(e);
    return;
  }

  // Detectar inicio de arrastre libre (después de espera de 300ms)
  if (!gizmoState.isDragging && gizmoState.pointerDownTime > 0) {
    const elapsed = performance.now() - gizmoState.pointerDownTime;
    const moved = Math.abs(e.clientX - gizmoState.pointerDownPos.x) + Math.abs(e.clientY - gizmoState.pointerDownPos.y);
    const obj = getActiveObject();
    if (elapsed > 300 && moved < 5 && obj) {
      // El usuario mantuvo presionado sin mover -> iniciar arrastre libre
      startFreeDrag(e);
      gizmoState.pointerDownTime = 0;
    }
  }
});

canvas.addEventListener('pointerup', (e) => {
  if (cinema.active && cinema.mode !== 'play') return;
  if (store.trayDrawing) return;   // dibujando canaleta: el click lo maneja trayDraw
  // Terminar el movimiento del bloque (multiselección)
  if (multi.dragging) {
    updateGroupDrag(e);
    endGroupDrag();
    controls.enabled = true;
    return;
  }
  if (multi.marqueeActive) {
    endMarquee(e);
    controls.enabled = true;
    return;
  }
  if (gizmoState.isDragging) {
    endDrag();
  }
  // Click simple en vacío (sin arrastre de cámara) → deseleccionar el objeto
  if (gizmoState.pendingDeselect && !gizmoState.isDragging) {
    const moved = Math.abs(e.clientX - gizmoState.pointerDownPos.x) + Math.abs(e.clientY - gizmoState.pointerDownPos.y);
    if (moved < 6) clearActiveTarget();
  }
  gizmoState.pendingDeselect = false;
  gizmoState.pointerDownTime = 0;
});