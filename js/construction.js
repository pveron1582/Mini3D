// js/construction.js — Capa de construcción (Fase 1-2 del editor de escenas).
// Grupo INDEPENDIENTE de la oficina: el usuario arranca en el terreno con
// césped (js/terrain.js) y edifica acá (pisos, paredes, puertas, ventanas).
// Reutiliza las fábricas de js/office/walls.js y las texturas de floor.js,
// pero destina todo a constructionGroup. Lo que se edifica se guarda en el
// JSON del proyecto (campo construction[]) y se recrea al abrir.
import * as THREE from 'three';
import * as geo from './office/geoCache.js';
import { scene } from './core.js';
import { store } from './state.js';
import { registerSelectable, unregisterSelectable } from './ui/selection.js';
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
// Baldosas por metro en paredes (densidad de la textura compartida: repeat
// 6×1.5 sobre la pared 4×3 por defecto). Al redimensionar se agregan
// baldosas en vez de estirar.
const WALL_TILE_X = 1.5;
const WALL_TILE_Y = 0.5;

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

// Cambia w/d RECONSTRUYENDO el plano (Fase 3: el borde arrastrado mueve solo
// ese lado; el texturado se repite por baldosas, nunca se estira).
export function setConFloorSize(g, w, d) {
  const fd = g && g.userData.floorData;
  if (!fd) return;
  fd.w = Math.max(1, Math.min(40, w));
  fd.d = Math.max(1, Math.min(40, d));
  const old = g.userData.floorMesh;
  const mesh = makeFloorMesh(fd.w, fd.d, fd.tex);
  if (old) {
    g.remove(old);
    if (old.geometry) old.geometry.dispose();
    if (old.material) {
      if (old.material.map) old.material.map.dispose();
      old.material.dispose();
    }
  }
  g.add(mesh);
  g.userData.floorMesh = mesh;
}

// Resize completo por bordes: tamaño nuevo + centro nuevo (el lado opuesto
// queda fijo). Lo usa el arrastre de bordes del gizmo.
export function resizeConFloor(g, w, d, cx, cz) {
  if (!g || !g.userData.floorData) return;
  setConFloorSize(g, w, d);
  g.position.x = cx;
  g.position.z = cz;
}

// ---------- PARED ----------
export function addConWall(x, z, rotY = 0, w = 4, h = 3, d = 0.15, kind = 'solid', texName = null, id = null, name = null) {
  const wid = id || ('conWall' + (++conWallCounter));
  const g = addWall(w, h, d, x, z, kind, constructionGroup, wid, name || ('Pared ' + wid.slice(7)));
  g.rotation.y = rotY;
  g.userData.conType = 'wall';
  g.userData.conId = wid;
  g.userData.conTex = texName;
  if (kind === 'solid' && texName) setConWallTexture(g, texName);
  else retileConWall(g);
  return track(g);
}

// Textura de una pared de construcción: clon propio con repeat según tamaño
// (baldosas, no estirado). La compartida no se toca (la usan las demás).
export function setConWallTexture(g, texName) {
  const wd = g && g.userData.wallData;
  const mesh = g && g.userData.wallMesh;
  if (!wd || !mesh || wd.kind !== 'solid') return;
  resetConWallTile(g);
  mesh.material.map = getWallTexture(texName);
  mesh.material.needsUpdate = true;
  g.userData.conTex = texName;
  retileConWall(g);
}

// Ajusta el repeat al tamaño (clona la textura UNA vez; después solo cambia
// el repeat). Llamar al crear, redimensionar o cambiar dims por sliders.
// Solo capa de construcción: la oficina conserva su texturado original.
export function retileConWall(g) {
  if (!g || g.userData.conType !== 'wall') return;
  const wd = g.userData.wallData;
  const mesh = g && g.userData.wallMesh;
  if (!wd || !mesh || !mesh.material) return;
  if (wd.kind !== 'solid' || !mesh.material.map) return;
  if (!g.userData._wallTexOwn) {
    const prev = mesh.material.map;
    const tex = prev.clone();
    tex.needsUpdate = true;
    mesh.material.map = tex;
    mesh.material.needsUpdate = true;
    g.userData._wallTexOwn = true;
    if (!g.userData.conTex) {
      g.userData.conTex = wallTextureNames.find(n => getWallTexture(n) === prev) || 'Paneles claros';
    }
  }
  const tex = mesh.material.map;
  tex.repeat.set(Math.max(1, wd.w * WALL_TILE_X), Math.max(1, wd.h * WALL_TILE_Y));
  tex.needsUpdate = true;
}

// Libera el clon propio (antes de cambiar de material/textura base).
function resetConWallTile(g) {
  const mesh = g && g.userData.wallMesh;
  if (g && g.userData._wallTexOwn && mesh && mesh.material.map) {
    mesh.material.map.dispose();
  }
  if (g) g.userData._wallTexOwn = false;
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
      return { ...base, width: round2(g.userData.doorData.w), state: g.userData.doorState, wall: wallRefOf(g) };
    }
    if (t === 'window') {
      const wnd = g.userData.windowData;
      return { ...base, w: round2(wnd.w), h: round2(wnd.h), wall: wallRefOf(g) };
    }
    return base;
  });
}

// Pared a la que está pegada una abertura (por conId, o undefined si libre).
function wallRefOf(g) {
  const w = g.userData._attachedWall;
  return (w && w.userData.conId) || undefined;
}

// Recrea la capa desde el snapshot del proyecto (al abrir / aplicar).
export function syncConstruction(list = []) {
  clearConstruction();
  const pendingWalls = []; // aberturas pegadas: se re-adhieren al final (pared ya creada)
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
    if ((it.type === 'door' || it.type === 'window') && it.wall) {
      pendingWalls.push({ g, wallId: it.wall });
    }
  });
  // Re-pegar aberturas (reabre sus huecos con las posiciones ya cargadas)
  pendingWalls.forEach(({ g, wallId }) => {
    const wall = constructionItems.find(c => c.userData.conId === wallId);
    if (wall) attachOpeningToWall(g, wall);
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

// ---------- ABERTURAS EN PARED SÓLIDA (ventanas y puertas) ----------
// Al pegar una abertura contra una pared de construcción SÓLIDA se abre un
// hueco real dividiendo el panel en cajas alrededor. Al retirarla se restaura
// la pared sólida. Paredes axis-aligned (rotY ≈ 0 o ±π/2).
function cutWallOpening(wallGroup, along, halfW, y0, y1) {
  const wd = wallGroup.userData.wallData;
  const swap = Math.abs(Math.sin(wallGroup.rotation.y)) > 0.5;
  const wL = swap ? wd.d : wd.w;
  const wT = swap ? wd.w : wd.d;
  const hH = wd.h / 2;

  clearWallHole(wallGroup);       // restaurar estado previo
  // El hueco no puede salirse de la pared; sin lugar, queda sólida.
  y0 = Math.max(y0, -hH);
  y1 = Math.min(y1, hH);
  if (y1 - y0 < 0.01 || halfW <= 0) return;
  // La caja original se oculta; se añaden segmentos con el mismo material.
  const mesh = wallGroup.userData.wallMesh;
  mesh.visible = false;

  const specs = [];
  const halfLen = wL / 2;
  // Franja superior/inferior (a todo el largo)
  const topH = hH - y1;
  if (topH > 0.01) specs.push({ c: 0, y: y1 + topH / 2, s: wL, sh: topH });
  const botH = y0 - (-hH);
  if (botH > 0.01) specs.push({ c: 0, y: -hH + botH / 2, s: wL, sh: botH });
  // Laterales (entre y0 e y1), a ambos lados del hueco
  const sideS = halfLen - (Math.abs(along) + halfW);   // ancho de cada lateral
  if (sideS > 0.01) {
    const leftC = -halfLen + sideS / 2;              // tramo desde el extremo -L
    const rightC = halfLen - sideS / 2;              // tramo desde el extremo +L
    specs.push({ c: leftC, y: (y0 + y1) / 2, s: sideS, sh: y1 - y0 });
    specs.push({ c: rightC, y: (y0 + y1) / 2, s: sideS, sh: y1 - y0 });
  }

  const made = [];
  specs.forEach(sg => {
    const seg = new THREE.Mesh(geo.box(swap ? wT : sg.s, sg.sh, swap ? sg.s : wT), mesh.material);
    seg.castShadow = true;
    seg.receiveShadow = true;
    if (swap) seg.position.set(0, sg.y, sg.c);
    else seg.position.set(sg.c, sg.y, 0);
    wallGroup.add(seg);
    made.push(seg);
  });

  wallGroup.userData._wallHoleSegments = made;
  wallGroup.userData._wallMeshOrig = mesh;
}

// Al pegar una ventana contra una pared SÓLIDA se abre su hueco; con null
// (ventana retirada) se restaura la pared sólida.
export function setWallWindowHole(wallGroup, windowGroup) {
  if (!wallGroup || !wallGroup.userData.wallData) return;
  const wd = wallGroup.userData.wallData;
  if (wd.kind !== 'solid') return;
  if (!windowGroup) { clearWallHole(wallGroup); return; }

  const wn = windowGroup.userData.windowData;
  const swap = Math.abs(Math.sin(wallGroup.rotation.y)) > 0.5;
  // Centro del hueco en LOCAL de la pared (grupo centrado, y = h/2 en mundo):
  const along = swap
    ? (windowGroup.position.z - wallGroup.position.z)
    : (windowGroup.position.x - wallGroup.position.x);
  const holeY = windowGroup.position.y - wallGroup.position.y;
  cutWallOpening(wallGroup, along, wn.w / 2, holeY - wn.h / 2, holeY + wn.h / 2);
}

// Puerta sobre pared SÓLIDA: hueco del piso al dintel (ancho de hoja + marco).
export function setWallDoorHole(wallGroup, doorGroup) {
  if (!wallGroup || !wallGroup.userData.wallData) return;
  const wd = wallGroup.userData.wallData;
  if (wd.kind !== 'solid') return;
  if (!doorGroup) { clearWallHole(wallGroup); return; }

  const dd = doorGroup.userData.doorData || { w: 1.4, h: 2.2 };
  const swap = Math.abs(Math.sin(wallGroup.rotation.y)) > 0.5;
  const along = swap
    ? (doorGroup.position.z - wallGroup.position.z)
    : (doorGroup.position.x - wallGroup.position.x);
  const hH = wd.h / 2;
  cutWallOpening(wallGroup, along, dd.w / 2 + 0.06, -hH, -hH + (dd.h || 2.2));
}

// Cambia la pared a la que está pegada una abertura (puerta o ventana),
// abriendo/cerrando huecos. null = soltar.
export function attachOpeningToWall(obj, wall) {
  if (!obj) return;
  const old = obj.userData._attachedWall;
  if (old === (wall || null)) return;
  const isDoor = !!obj.userData.doorData;
  if (old && old.userData.conType === 'wall') {
    if (isDoor) setWallDoorHole(old, null);
    else setWallWindowHole(old, null);
  }
  if (wall && wall.userData.conType === 'wall') {
    if (isDoor) setWallDoorHole(wall, obj);
    else setWallWindowHole(wall, obj);
  }
  obj.userData._attachedWall = wall || null;
}

// Quita los segmentos generados y restaura el box original de la pared.
function clearWallHole(wallGroup) {
  if (!wallGroup) return;
  const segs = wallGroup.userData._wallHoleSegments;
  if (segs) {
    segs.forEach(s => {
      if (s.parent) s.parent.remove(s);
      if (s.geometry) s.geometry.dispose();
    });
  }
  wallGroup.userData._wallHoleSegments = null;
  const mesh = wallGroup.userData._wallMeshOrig || wallGroup.userData.wallMesh;
  if (mesh) mesh.visible = true;
}

export function clearWallHoleFor(wallGroup) {
  clearWallHole(wallGroup);
}
