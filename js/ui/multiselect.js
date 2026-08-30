// js/multiselect.js — Selección múltiple / mover en bloque (P7).
// Permite Ctrl+clico, marquesina con rectángulo y mover el bloque seleccionado
// juntos; Supr/Borrar borra toda la selección.
import * as THREE from 'three';
import { scene, camera, canvas } from '../core.js';
import { interactiveRegistry } from '../state.js';
import { setActiveTarget, clearActiveTarget } from './selection.js';
import { pushHistory } from '../undo.js';

export const multi = {
  ids: new Set(),
  dragging: false,
  dragTargets: [],      // [{ obj, startX, startZ }]
  dragPlaneY: 0,
  dragLastPoint: null,
  marqueeActive: false,
  marqueeStart: null,   // {x, y} pantalla
  marqueeRect: null     // div del rectángulo
};

export function hasMulti() { return multi.ids.size >= 1; }
export function multiCount() { return multi.ids.size; }
export function isInMulti(id) { return multi.ids.has(id); }

export function clearMulti() {
  multi.ids.clear();
  updateGroupBox();
  return false;
}

export function toggleInMulti(id) {
  if (interactiveRegistry.get(id)?.deleted) return;
  if (multi.ids.has(id)) multi.ids.delete(id);
  else multi.ids.add(id);
  updateGroupBox();
  return true;
}

function getMultiObjects() {
  const out = [];
  multi.ids.forEach(id => {
    const e = interactiveRegistry.get(id);
    if (e && e.group && !e.deleted) out.push(e.group);
  });
  return out;
}

// ==========================================
// CAJA VISUAL ALREDEDOR DE LA SELECCIÓN
// ==========================================
const boxMat = new THREE.LineBasicMaterial({ color: 0x4f9dff, depthTest: false, transparent: true, opacity: 0.9 });
const groupBox = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), boxMat
);
groupBox.renderOrder = 1000;
groupBox.visible = false;
scene.add(groupBox);

const _box3 = new THREE.Box3();
const _v3 = new THREE.Vector3();
const _v3b = new THREE.Vector3();

function updateGroupBox() {
  const objs = getMultiObjects();
  if (objs.length < 2) { groupBox.visible = false; return; }
  _box3.makeEmpty();
  objs.forEach(o => _box3.expandByObject(o));
  _box3.getCenter(_v3);
  _box3.getSize(_v3b);
  groupBox.visible = true;
  groupBox.position.copy(_v3);
  groupBox.scale.set(Math.max(_v3b.x, 0.3), Math.max(_v3b.y, 0.3), Math.max(_v3b.z, 0.3));
}

// ==========================================
// MOVER EL BLOQUE JUNTOS
// ==========================================
export function beginGroupDrag(e, hitId) {
  if (!multi.ids.has(hitId)) multi.ids.add(hitId);
  const objs = getMultiObjects();
  if (objs.length < 2) return false;
  multi.dragPlaneY = objs[0].position.y;
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, multi.dragPlaneY, 0)
  );
  const hit = new THREE.Vector3();
  projectPointerToPlane(e, plane, hit);
  multi.dragging = true;
  multi.dragTargets = objs.map(o => ({ obj: o, startX: o.position.x, startZ: o.position.z }));
  multi.dragLastPoint = { x: hit.x, z: hit.z };
  updateGroupBox();
  return true;
}

function projectPointerToPlane(e, plane, out) {
  const rect = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const t = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(plane, t)) { out.copy(t); return true; }
  return false;
}

export function updateGroupDrag(e) {
  if (!multi.dragging) return;
  const hit = new THREE.Vector3();
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, multi.dragPlaneY, 0)
  );
  if (!projectPointerToPlane(e, plane, hit)) return;
  const dx = hit.x - multi.dragLastPoint.x;
  const dz = hit.z - multi.dragLastPoint.z;
  multi.dragLastPoint = { x: hit.x, z: hit.z };
  multi.dragTargets.forEach(({ obj }) => {
    obj.position.x += dx;
    obj.position.z += dz;
  });
  updateGroupBox();
}

export function endGroupDrag() {
  if (!multi.dragging) return;
  multi.dragging = false;
  multi.dragTargets = [];
  pushHistory(); // un solo paso de undo para todo el bloque
}

// ==========================================
// MARQUESINA (selección por rectángulo)
// ==========================================
function ensureMarqueeRect() {
  if (multi.marqueeRect) return multi.marqueeRect;
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;border:1px solid #4f9dff;background:rgba(79,157,255,0.15);'
    + 'z-index:9999;pointer-events:none;display:none;';
  document.body.appendChild(div);
  multi.marqueeRect = div;
  return div;
}

export function beginMarquee(e) {
  const div = ensureMarqueeRect();
  div.style.display = 'block';
  multi.marqueeActive = true;
  multi.marqueeStart = { x: e.clientX, y: e.clientY };
  div.style.left = e.clientX + 'px';
  div.style.top = e.clientY + 'px';
  div.style.width = '0px';
  div.style.height = '0px';
}

export function updateMarquee(e) {
  if (!multi.marqueeActive) return;
  const rect = multi.marqueeRect;
  if (!rect) return;
  const x1 = Math.min(multi.marqueeStart.x, e.clientX);
  const y1 = Math.min(multi.marqueeStart.y, e.clientY);
  const w = Math.abs(e.clientX - multi.marqueeStart.x);
  const h = Math.abs(e.clientY - multi.marqueeStart.y);
  rect.style.left = x1 + 'px';
  rect.style.top = y1 + 'px';
  rect.style.width = w + 'px';
  rect.style.height = h + 'px';
}

function screenPointOf(obj, rect) {
  _v3.setFromMatrixPosition(obj.matrixWorld);
  _v3.project(camera);
  return {
    x: ( _v3.x + 1 ) / 2 * rect.width + rect.left,
    y: ( -_v3.y + 1 ) / 2 * rect.height + rect.top
  };
}

export function endMarquee(e) {
  if (!multi.marqueeActive) return;
  multi.marqueeActive = false;
  const el = multi.marqueeRect;
  if (el) el.style.display = 'none';
  if (Math.abs(e.clientX - multi.marqueeStart.x) < 6 && Math.abs(e.clientY - multi.marqueeStart.y) < 6) {
    return;
  }
  const canvasRect = canvas.getBoundingClientRect();
  const x1 = Math.min(multi.marqueeStart.x, e.clientX);
  const y1 = Math.min(multi.marqueeStart.y, e.clientY);
  const x2 = Math.max(multi.marqueeStart.x, e.clientX);
  const y2 = Math.max(multi.marqueeStart.y, e.clientY);

  interactiveRegistry.forEach((entry, id) => {
    if (entry.deleted || !entry.group || !entry.group.visible) return;
    const p = screenPointOf(entry.group, canvasRect);
    if (p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2) multi.ids.add(id);
  });
  multi.marqueeStart = null;
  updateGroupBox();
}

// ==========================================
// BORRAR / SELECCIÓN (grupo)
// ==========================================
export function deleteMultiSelection() {
  if (multi.ids.size === 0) return 0;
  const toDelete = [];
  multi.ids.forEach(id => {
    const e = interactiveRegistry.get(id);
    if (!e || e.deleted) return;
    if (e.type === 'human' || e.type === 'pet' || e.type === 'wall' || e.type === 'door' || e.type === 'window' || e.type === 'floor') return;
    toDelete.push(e);
  });
  let n = 0;
  toDelete.forEach(e => {
    e.deleted = true;
    e.group.visible = false;
    n++;
  });
  if (n > 0) {
    onMultiChanged();
    pushHistory();
  }
  return n;
}

// Notifica que cambió la selección: reenfoca el primer objeto para el gizmo
function onMultiChanged() {
  updateGroupBox();
  const first = multi.ids.values().next();
  if (!first.done && first.value) setActiveTarget(first.value);
  else if (multi.ids.size === 0) clearActiveTarget();
}