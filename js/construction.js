// js/construction.js — Capa de construcción (Fase 1-2 del editor de escenas).
// Grupo INDEPENDIENTE de la oficina: el usuario arranca en el terreno con
// césped (js/terrain.js) y edifica acá (pisos, paredes, puertas, ventanas).
// Reutiliza las fábricas de js/office/walls.js y las texturas de floor.js,
// pero destina todo a constructionGroup. Lo que se edifica se guarda en el
// JSON del proyecto (campo construction[]) y se recrea al abrir.
import * as THREE from 'three';
import { scene } from './core.js';
import { store } from './state.js';
import { registerSelectable, unregisterSelectable } from './selection.js';
import {
  addWall, addDoor, createWindow, getWallTexture, setDoorState,
  wallGroups, doorGroups, windowGroups, wallTextureNames
} from './office/walls.js';
import { getFloorTexture, floorTextureNames } from './office/floor.js';

export const constructionGroup = new THREE.Group();
constructionGroup.name = 'constructionGroup';
scene.add(constructionGroup);

// Metros por baldosa: el texturado del piso NO se estira al redimensionar,
// se repite a tamaño constante (Fase 3 amplía por bordes).
const FLOOR_TILE = 2;

// Piezas de la capa (para serializar / limpiar al cargar otro proyecto).
const constructionItems = [];

let conFloorCounter = 0;
let conWallCounter = 0;
let conDoorCounter = 0;
let conWindowCounter = 0;

function track(g) { constructionItems.push(g); return g; }
function removeFromArray(arr, g) { const i = arr.indexOf(g); if (i >= 0) arr.splice(i, 1); }

// La capa se ve cuando el ambiente activo es el terreno, o cuando el Modo
// Construcción está encendido en cualquier ambiente.
export function updateConstructionVisibility() {
  constructionGroup.visible = !!store.editBuilding || store.currentEnv === 'terrain';
}

// ---------- PISO ----------
export function addConFloor(x, z, w = 6, d = 6, texName = floorTextureNames[0], id = null, name = null) {
  const fid = id || ('conFloor' + (++conFloorCounter));
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const mesh = makeFloorMesh(w, d, texName);
  g.add(mesh);
  constructionGroup.add(g);
  registerSelectable(fid, name || ('Piso ' + fid.slice(8)), g, 'floor', null);
  g.userData.conType = 'floor';
  g.userData.conId = fid;
  g.userData.floorData = { w, d, tex: texName };
  g.userData.floorMesh = mesh;
  return track(g);
}

function makeFloorMesh(w, d, texName) {
  const tex = getFloorTexture(texName).clone();
  tex.repeat.set(Math.max(1, w / FLOOR_TILE), Math.max(1, d / FLOOR_TILE));
  tex.needsUpdate = true;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.1 })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;   // apenas sobre el césped para evitar z-fighting
  mesh.receiveShadow = true;
  return mesh;
}

// Cambia el tipo de piso de una losa de construcción ya existente.
export function setConFloorTexture(g, texName) {
  const fd = g && g.userData.floorData;
  const mesh = g && g.userData.floorMesh;
  if (!fd || !mesh) return;
  fd.tex = texName;
  const tex = getFloorTexture(texName).clone();
  tex.repeat.set(Math.max(1, fd.w / FLOOR_TILE), Math.max(1, fd.d / FLOOR_TILE));
  tex.needsUpdate = true;
  mesh.material.map = tex;
  mesh.material.needsUpdate = true;
}

// ---------- PARED ----------
export function addConWall(x, z, rotY = 0, w = 4, h = 3, d = 0.15, kind = 'solid', texName = null, id = null, name = null) {
  const wid = id || ('conWall' + (++conWallCounter));
  const g = addWall(w, h, d, x, z, kind, constructionGroup, wid, name || ('Pared ' + wid.slice(7)));
  g.rotation.y = rotY;
  if (kind === 'solid' && texName) {
    g.userData.wallMesh.material.map = getWallTexture(texName);
    g.userData.wallMesh.material.needsUpdate = true;
  }
  g.userData.conType = 'wall';
  g.userData.conId = wid;
  g.userData.conTex = texName;
  return track(g);
}

// ---------- PUERTA ----------
export function addConDoor(x, z, rotY = 0, width = 1.4, id = null, name = null) {
  const did = id || ('conDoor' + (++conDoorCounter));
  const g = addDoor(did, name || ('Puerta ' + did.slice(7)), x, z, rotY, width, constructionGroup);
  g.userData.conType = 'door';
  g.userData.conId = did;
  return track(g);
}

// ---------- VENTANA ----------
export function addConWindow(x, z, rotY = 0, w = 2, h = 1.6, id = null, name = null) {
  const nid = id || ('conWindow' + (++conWindowCounter));
  const y = 0.9 + h / 2;   // alféizar a 0.9 m del piso
  const g = createWindow(nid, name || ('Ventana ' + nid.slice(9)), x, y, z, rotY, w, h, constructionGroup);
  g.userData.conType = 'window';
  g.userData.conId = nid;
  return track(g);
}

// ---------- PERSISTENCIA ----------
function round2(n) { return Math.round(n * 100) / 100; }

export function serializeConstruction() {
  return constructionItems.map(g => {
    const t = g.userData.conType;
    const base = {
      type: t,
      id: g.userData.conId,
      name: g.userData.name,
      pos: [round2(g.position.x), round2(g.position.y), round2(g.position.z)],
      rotY: round2(g.rotation.y)
    };
    if (t === 'floor') {
      const fd = g.userData.floorData;
      return { ...base, w: round2(fd.w), d: round2(fd.d), tex: fd.tex };
    }
    if (t === 'wall') {
      const wd = g.userData.wallData;
      // La textura se deriva del material (como en projectFiles), así recoge
      // los cambios hechos con el editor de pared, no solo la inicial.
      const mesh = g.userData.wallMesh;
      const tex = wallTextureNames.find(n => mesh && mesh.material.map === getWallTexture(n)) || g.userData.conTex;
      return { ...base, w: round2(wd.w), h: round2(wd.h), d: round2(wd.d), kind: wd.kind, tex: tex || undefined };
    }
    if (t === 'door') {
      return { ...base, width: round2(g.userData.doorData.w), state: g.userData.doorState };
    }
    if (t === 'window') {
      const wnd = g.userData.windowData;
      return { ...base, w: round2(wnd.w), h: round2(wnd.h) };
    }
    return base;
  });
}

// Recrea la capa desde el snapshot del proyecto (al abrir / aplicar).
export function syncConstruction(list = []) {
  clearConstruction();
  list.forEach(it => {
    let g = null;
    if (it.type === 'floor') g = addConFloor(it.pos[0], it.pos[2], it.w, it.d, it.tex, it.id, it.name);
    else if (it.type === 'wall') g = addConWall(it.pos[0], it.pos[2], it.rotY || 0, it.w, it.h, it.d, it.kind, it.tex, it.id, it.name);
    else if (it.type === 'door') g = addConDoor(it.pos[0], it.pos[2], it.rotY || 0, it.width, it.id, it.name);
    else if (it.type === 'window') g = addConWindow(it.pos[0], it.pos[2], it.rotY || 0, it.w, it.h, it.id, it.name);
    if (!g) return;
    g.position.set(it.pos[0], it.pos[1], it.pos[2]);
    g.rotation.y = it.rotY || 0;
    // Restaurar el estado de la hoja de la puerta (cerrado / entreabierto / abierto)
    if (it.type === 'door' && it.state) setDoorState(g, it.state);
  });
  updateConstructionVisibility();
}

// Vacía la capa (proyecto nuevo / antes de recrear desde el JSON).
export function clearConstruction() {
  constructionItems.forEach(g => {
    unregisterSelectable(g.userData.conId);
    removeFromArray(wallGroups, g);
    removeFromArray(doorGroups, g);
    removeFromArray(windowGroups, g);
    g.traverse(child => { if (child.isMesh && child.geometry) child.geometry.dispose(); });
    if (g.parent) g.parent.remove(g);
  });
  constructionItems.length = 0;
}
