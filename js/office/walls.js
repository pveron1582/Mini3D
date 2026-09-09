// js/office/walls.js — extraído de office.js (split P1, ver mejoras_glm.md)

import * as THREE from 'three';
import * as geo from './geoCache.js';
import { renderer } from '../core.js';
import { officeGroup } from './group.js';
import { registerSelectable } from '../ui/selection.js';

// Colisionadores AABB de las paredes (derivados de los grupos de pared)
export const wallGroups = [];
export function getWallGroups() { return wallGroups; }
export function getWallColliders() {
  const out = [];
  wallGroups.forEach(g => {
    if (!g.visible) return;
    const wd = g.userData.wallData;
    if (!wd) return;
    // Paredes axis-aligned: si está rotada ~90° se intercambian largo/espesor
    const swap = Math.abs(Math.sin(g.rotation.y)) > 0.5;
    const w = (swap ? wd.d : wd.w) * g.scale.x;
    const d = (swap ? wd.w : wd.d) * g.scale.x;
    out.push({
      minX: g.position.x - w / 2, maxX: g.position.x + w / 2,
      minZ: g.position.z - d / 2, maxZ: g.position.z + d / 2
    });
  });
  return out;
}

// ---------- PUERTAS (con estados cerrado / abierto / entreabierto) ----------
export const doorGroups = [];
export const DOOR_STATE_ANGLES = { cerrado: 0, entreabierto: 0.65, abierto: 1.95 };

// Cambia el estado de la hoja. Solo editable en el modo "Editar Edificio".
export function setDoorState(door, state) {
  if (!door || !DOOR_STATE_ANGLES[state]) return;
  door.userData.doorState = state;
  const angle = DOOR_STATE_ANGLES[state];
  // Doble hoja: abre en espejo; simple: un solo pivote.
  if (Array.isArray(door.userData.doorLeaves)) {
    door.userData.doorLeaves.forEach((pivot, i) => {
      pivot.rotation.y = (i === 0 ? -1 : 1) * angle;
    });
    return;
  }
  const pivot = door.userData.doorGroup;
  if (pivot) pivot.rotation.y = angle;
}

// Colliders AABB de puertas: las cerradas y entreabiertas bloquean el paso;
// las abiertas quedan libres (solo su hoja, que ya sobresale).
export function getDoorColliders() {
  const out = [];
  doorGroups.forEach(d => {
    const st = d.userData.doorState;
    if (st === 'abierto') return;
    const wd = d.userData.doorData;
    if (!wd) return;
    const leafW = st === 'entreabierto' ? wd.w * 0.55 : wd.w;
    const dth = 0.24, rot = d.rotation.y;
    const swap = Math.abs(Math.sin(rot)) > 0.5;
    const w = swap ? dth : leafW;
    const dz = swap ? leafW : dth;
    out.push({
      minX: d.position.x - w / 2, maxX: d.position.x + w / 2,
      minZ: d.position.z - dz / 2, maxZ: d.position.z + dz / 2
    });
  });
  return out;
}

// Cambia el tipo de una pared (vidrio ↔ sólido con textura). Solo editable
// en el modo "Editar Edificio".
export function setWallKind(group, kind) {
  const wd = group && group.userData.wallData;
  if (!wd) return;
  wd.kind = kind;
  const mesh = group.userData.wallMesh;
  if (!mesh) return;
  mesh.material = kind === 'solid' ? solidWallMatBase.clone() : glassWallMat.clone();
  mesh.material.needsUpdate = true;
  mesh.castShadow = kind === 'solid';
}

// Añade una pared nueva (construcción). `parent` permite destinarla a la capa
// de construcción (js/construction.js) en vez de a la oficina; `id`/`name`
// opcionales para piezas persistidas (si no, se numeran automáticamente).
export function addWall(w, h, d, x, z, kind, parent = officeGroup, id = null, name = null) {
  kind = kind || 'glass';
  const g = new THREE.Group();
  g.position.set(x, h / 2, z);
  const mesh = new THREE.Mesh(geo.box(1, 1, 1),
    kind === 'solid' ? solidWallMatBase.clone() : glassWallMat.clone());
  mesh.scale.set(w, h, d);
  mesh.castShadow = kind === 'solid';
  mesh.receiveShadow = true;
  g.add(mesh);
  parent.add(g);
  const n = wallGroups.length + 1;
  registerSelectable(id || ('wall' + n), name || ('Pared ' + n), g, 'wall', null);
  g.userData.wallData = { w, h, d, kind };
  g.userData.wallMesh = mesh;
  wallGroups.push(g);
  return g;
}

// Catálogo de texturas de pared (procedurales, elegibles por el usuario)
function texCanvas(painter) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  painter(c.getContext('2d'));
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 1.5);
  // Colores del lienzo son sRGB: sin esto las paredes se ven lavadas.
  tex.colorSpace = THREE.SRGBColorSpace;
  // Filtrado anisotrópico: sin él, las motas/juntas de la textura parpadean
  // (shimmer tipo "TV sin señal") al mirar paredes sólidas en ángulo rasante.
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}
function noise(ctx, alpha) {
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(150,160,180,${alpha})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
}
const WALL_TEXTURES = {
  'Paneles claros': () => texCanvas(ctx => {
    // Greige elegante con degradado sutil y paneles grandes de juntas finas
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#edeae3');
    grad.addColorStop(1, '#dcd8ce');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#ccc7bb';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 256; i += 85) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, 128); ctx.lineTo(256, 128); ctx.stroke();
    noise(ctx, 0.05);
  }),
  'Cemento': () => texCanvas(ctx => {
    ctx.fillStyle = '#b9bcc2'; ctx.fillRect(0, 0, 256, 256);
    noise(ctx, 0.22);
    ctx.strokeStyle = '#a0a4ac'; ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * 256, Math.random() * 256);
      ctx.lineTo(Math.random() * 256, Math.random() * 256);
      ctx.stroke();
    }
  }),
  'Ladrillo': () => texCanvas(ctx => {
    ctx.fillStyle = '#9c5f4a'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#c9c2b8';
    const bh = 32, bw = 64;
    for (let r = 0; r < 256 / bh; r++) {
      for (let col = -1; col < 256 / bw + 1; col++) {
        const off = (r % 2) * (bw / 2);
        ctx.fillRect(col * bw + off + 2, r * bh + 2, bw - 4, bh - 4);
      }
    }
    noise(ctx, 0.1);
  }),
  'Madera': () => texCanvas(ctx => {
    ctx.fillStyle = '#a4784f'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 30; i++) {
      ctx.strokeStyle = `rgba(90,60,35,${0.15 + Math.random() * 0.2})`;
      ctx.lineWidth = 1 + Math.random() * 2;
      const y = Math.random() * 256;
      ctx.beginPath(); ctx.moveTo(0, y);
      ctx.bezierCurveTo(80, y + 10, 160, y - 10, 256, y + 5);
      ctx.stroke();
    }
  }),
  'Azul corporativo': () => texCanvas(ctx => {
    ctx.fillStyle = '#3d5a80'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#46698f';
    for (let i = 0; i < 256; i += 32) ctx.fillRect(0, i, 256, 16);
    noise(ctx, 0.06);
  }),
  'Rayas grises': () => texCanvas(ctx => {
    ctx.fillStyle = '#cfd4dc'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#aab2bf';
    for (let i = 0; i < 256; i += 32) ctx.fillRect(0, i, 256, 12);
    noise(ctx, 0.05);
  })
};
const wallTextureCache = {};
export function getWallTexture(name) {
  if (!WALL_TEXTURES[name]) name = 'Paneles claros';
  if (!wallTextureCache[name]) wallTextureCache[name] = WALL_TEXTURES[name]();
  return wallTextureCache[name];
}
export const wallTextureNames = Object.keys(WALL_TEXTURES);

export const wallMat = new THREE.MeshStandardMaterial({ map: getWallTexture('Paneles claros'), roughness: 0.9 });
// Material de PARED SÓLIDA con textura (base clonada por pared para poder
// cambiar su textura por separado).
const solidWallMatBase = new THREE.MeshStandardMaterial({ map: getWallTexture('Paneles claros'), roughness: 0.9 });
// Material de PANEL DE VIDRIO (pared translúcida de oficina moderna).
const glassWallMat = new THREE.MeshPhysicalMaterial({
  color: 0xbfe0ea, transparent: true, opacity: 0.34,
  roughness: 0.05, metalness: 0.1,
  // FrontSide + depthWrite:false: evita el parpadeo (z-fighting / reordenado
  // de transparencias) al mover la cámara entre paneles de vidrio.
  side: THREE.FrontSide, depthWrite: false
});
const wallFrameMat = new THREE.MeshStandardMaterial({ color: 0x8a929e, roughness: 0.35, metalness: 0.8 });
// Material de hoja de puerta (perfil + panel que rota sobre la bisagra)
const doorLeafMat = new THREE.MeshStandardMaterial({ color: 0xb8c0c9, roughness: 0.4, metalness: 0.7 });
const doorGlassMat = new THREE.MeshPhysicalMaterial({
  color: 0xbfe0ea, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1,
  side: THREE.FrontSide, depthWrite: false
});
export function buildWalls() {
let wallCounter = 0;
function createWall(w, h, d, x, y, z, kind = 'glass', frame = true) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const mesh = new THREE.Mesh(geo.box(1, 1, 1),
    kind === 'solid' ? solidWallMatBase.clone() : glassWallMat.clone());
  mesh.scale.set(w, h, d);
  mesh.castShadow = kind === 'solid';
  mesh.receiveShadow = true;
  g.add(mesh);
  // Marco de aluminio delgado alrededor del panel (aspecto "panel de vidrio").
  // Sin travesaño central. NINGUNA cara del marco queda coplanar con una cara
  // del panel (z-fighting = ruido tipo "TV sin señal"): el marco sobresale
  // un poco en los 3 ejes y los rieles van ENTRE los montantes, con sus
  // caras internas enterradas en el panel. Sirve para paredes sobre X y sobre Z.
  if (frame) {
    const edge = 0.03; // ancho visible del perfil
    const px = 0.02;   // sobresale del panel en el eje del ancho (x)
    const py = 0.01;   // sobresale del panel en la altura (y)
    const fd = d + 0.14; // profundidad: sobresale del espesor (z) de ambas caras
    [1, -1].forEach(sy => {
      const rail = new THREE.Mesh(geo.box(w - 2 * edge, edge, fd), wallFrameMat);
      rail.position.set(0, sy * (h / 2 - edge / 2 + py), 0);
      rail.castShadow = true;
      g.add(rail);
    });
    [1, -1].forEach(sx => {
      const stile = new THREE.Mesh(geo.box(edge, h + 2 * py, fd), wallFrameMat);
      stile.position.set(sx * (w / 2 + px - edge / 2), 0, 0);
      stile.castShadow = true;
      g.add(stile);
    });
  }
  officeGroup.add(g);
  wallCounter++;
  registerSelectable('wall' + wallCounter, 'Pared ' + wallCounter, g, 'wall', null);
  g.userData.wallData = { w, h, d, kind };
  g.userData.wallMesh = mesh;
  wallGroups.push(g);
  return g;
}

createWall(30, 3.7, 0.2, 0, 1.85, -11);
createWall(30, 3.7, 0.2, 0, 1.85, 11);
createWall(0.2, 3.7, 22, -15, 1.85, 0);
createWall(0.2, 3.7, 22, 15, 1.85, 0);

// Oficinas de esquina más chicas: tabiques en |x| >= 4.5 y |z| >= 4.5,
// dejando un espacio central abierto más grande (9m x 8m)
// Norte (z = -4.5), con puertas
createWall(5.0, 3.5, 0.15, -12.5, 1.75, -4.5);
createWall(4.0, 3.5, 0.15, -6.5, 1.75, -4.5);
createWall(4.0, 3.5, 0.15, 6.5, 1.75, -4.5);
createWall(5.0, 3.5, 0.15, 12.5, 1.75, -4.5);

// Sur (z = +4.5), con puertas
createWall(5.0, 3.5, 0.15, -12.5, 1.75, 4.5);
createWall(4.0, 3.5, 0.15, -6.5, 1.75, 4.5);
createWall(4.0, 3.5, 0.15, 6.5, 1.75, 4.5);
createWall(5.0, 3.5, 0.15, 12.5, 1.75, 4.5);

// Tabiques verticales Este/Oeste del espacio central
createWall(0.15, 3.5, 6.5, -4.5, 1.75, -7.75);
createWall(0.15, 3.5, 6.5, 4.5, 1.75, -7.75);
createWall(0.15, 3.5, 6.5, -4.5, 1.75, 7.75);
createWall(0.15, 3.5, 6.5, 4.5, 1.75, 7.75);

// ---------- PUERTAS (estados: cerrado / abierto / entreabierto) ----------
// Cada puerta es un grupo con una hoja que rota sobre una bisagra
// (pivotDoorGroup). Solo se pueden modificar en modo "Editar Edificio".
let doorCounter = 0;
function createDoor(id, name, x, z, rotY, width, hinge = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const h = 2.2, thick = 0.12;
  // Pivot de la hoja: la bisagra queda a un lado (hinge=+1 der, -1 izq)
  const pivot = new THREE.Group();
  pivot.position.set(hinge * width / 2, 0, 0);
  // Hoja: panel de vidrio completo con manija (puerta de oficina moderna).
  // Sin marco sólido detrás del vidrio: antes el vidrio sobresalía 2.5 mm
  // del panel opaco y sus caras casi coplanares provocaban z-fighting.
  const leaf = new THREE.Mesh(geo.box(width, h, thick), doorGlassMat);
  leaf.position.set(-hinge * width / 2, h / 2, 0);
  pivot.add(leaf);
  // Manija (del lado opuesto a la bisagra)
  const handle = new THREE.Mesh(geo.box(0.12, 0.05, 0.05), doorLeafMat);
  handle.position.set(-hinge * width, h / 2 - 0.12, thick / 2);
  pivot.add(handle);
  // Marco fijo
  const jambMat = wallFrameMat;
  [-hinge].forEach(sx => {
    const jamb2 = new THREE.Mesh(geo.box(0.1, h, thick), jambMat);
    jamb2.position.set(sx * (width / 2 + 0.05), h / 2, 0);
    g.add(jamb2);
  });
  const header = new THREE.Mesh(geo.box(width + 0.2, 0.1, thick), jambMat);
  header.position.set(0, h, 0);
  g.add(header);
  g.add(pivot);
  officeGroup.add(g);
  doorCounter++;
  registerSelectable(id, name, g, 'door', null);
  g.userData.doorData = { w: width, h, rotY };
  g.userData.doorGroup = pivot;
  // Las puertas del edificio nacen ABIERTAS por defecto (tránsito habitual)
  g.userData.doorState = 'abierto';
  g.userData.doorId = id;
  doorGroups.push(g);
  if (pivot) pivot.rotation.y = DOOR_STATE_ANGLES['abierto'];
  return g;
}

// Puertas de los accesos Norte/Sur de las oficinas de esquina
createDoor('door_nw', 'Puerta NO', -9.25, -4.5, 0, 1.4);          // NO
createDoor('door_ne', 'Puerta NE', 9.25, -4.5, 0, 1.4);           // NE
createDoor('door_so', 'Puerta SO', -9.25, 4.5, 0, 1.4);           // SO
createDoor('door_se', 'Puerta SE', 9.25, 4.5, 0, 1.4);            // SE

}

// ---------- VENTANAS (P8: fábrica paramétrica spawneable) ----------
// Ventana realista: marco de aluminio oscuro en 4 piezas (hueco), vidrio
// empotrado con TINTE OSCURO semitransparente que refleja el entorno,
// travesaño central fino y alféizar interior. Va sobre paredes como panel
// montado (sin caras coplanares con el vidrio de la pared).
export const windowGroups = [];
let windowCounter = 0;

// 3 diseños (Fase 5): 'clasica' (marco + travesaño + alféizar), 'panoramica'
// (perfil fino, sin travesaño) y 'persiana' (lamas orientables sobre vidrio).
export const WINDOW_DESIGNS = [
  { id: 'clasica', label: '🪟 Clásica' },
  { id: 'panoramica', label: '🪟 Panorámica' },
  { id: 'persiana', label: '🪟 Persiana' }
];
const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.35, metalness: 0.6 });
const windowSillMat = new THREE.MeshStandardMaterial({ color: 0xb2b6be, roughness: 0.9 });

export function createWindow(id, name, x, y, z, rotY, w, h, parent = officeGroup, design = 'clasica') {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  buildWindowFrame(g, design, w, h);
  parent.add(g);
  windowCounter++;
  const wid = id || ('window' + windowCounter);
  registerSelectable(wid, name || ('Ventana ' + windowCounter), g, 'window', null);
  g.userData.windowData = { w, h, rotY, design };
  g.userData.windowId = wid;
  g.userData.windowName = name;
  windowGroups.push(g);
  return g;
}

function windowGlass(w, h) {
  // Vidrio TINTADO pero bien transparente: se ve nítido lo de afuera, con un
  // leve tinte azulado que le da cuerpo a la superficie (no es un agujero
  // vacío, se percibe que hay vidrio).
  return new THREE.Mesh(
    geo.plane(w, h),
    new THREE.MeshPhysicalMaterial({
      color: 0x9fc6d6,
      transparent: true,
      opacity: 0.16,
      roughness: 0.04,
      metalness: 0.0,
      envMapIntensity: 0.6,
      depthWrite: false,
      side: THREE.DoubleSide
    })
  );
}

// Marco + contenido según diseño (dentro del grupo).
function buildWindowFrame(g, design, w, h) {
  const t = design === 'panoramica' ? 0.06 : 0.09;   // ancho del perfil
  const dep = 0.12; // profundidad del marco
  const top = new THREE.Mesh(geo.box(w, t, dep), windowFrameMat);
  top.position.y = h / 2 - t / 2;
  top.castShadow = true;
  g.add(top);
  const bot = new THREE.Mesh(geo.box(w, t, dep), windowFrameMat);
  bot.position.y = -(h / 2) + t / 2;
  g.add(bot);
  [1, -1].forEach(s => {
    const jamb = new THREE.Mesh(geo.box(t, h - 2 * t, dep), windowFrameMat);
    jamb.position.set(s * (w / 2 - t / 2), 0, 0);
    g.add(jamb);
  });
  const glass = windowGlass(w - 2 * t, h - 2 * t);
  g.add(glass);
  if (design === 'persiana') {
    // Lamas horizontales orientables delante del vidrio
    const n = Math.max(3, Math.floor(h / 0.28));
    for (let i = 0; i < n; i++) {
      const slat = new THREE.Mesh(geo.box(w - 2 * t - 0.04, 0.09, 0.02), windowFrameMat);
      slat.position.set(0, -h / 2 + t + 0.1 + i * ((h - 2 * t - 0.2) / Math.max(1, n - 1)), 0.05);
      slat.rotation.x = 0.6;
      g.add(slat);
    }
  } else if (design !== 'panoramica') {
    // Travesaño fino al centro (clásica)
    const mull = new THREE.Mesh(geo.box(w - 2 * t, 0.035, 0.04), windowFrameMat);
    mull.position.z = 0.03;
    g.add(mull);
  }
  if (design !== 'panoramica') {
    // Alféizar interior
    const sill = new THREE.Mesh(geo.box(w + 0.16, 0.04, 0.2), windowSillMat);
    sill.position.set(0, -(h / 2) - 0.02, 0.08);
    sill.castShadow = true;
    g.add(sill);
  }
}

// Cambiar el diseño de una ventana ya creada (reconstruye marco in situ:
// conserva id, posición, tamaño y pared pegada).
export function setWindowDesign(g, design) {
  const wn = g && g.userData.windowData;
  if (!wn || !WINDOW_DESIGNS.some(d => d.id === design)) return;
  if (wn.design === design) return;
  // Se suelta el marco viejo (materiales propios como el vidrio se liberan;
  // geos y mats compartidos no se tocan).
  [...g.children].forEach(c => {
    g.remove(c);
    c.traverse(o => {
      if (o.isMesh && o.material && o.material !== windowFrameMat && o.material !== windowSillMat) {
        o.material.dispose();
      }
    });
  });
  wn.design = design;
  buildWindowFrame(g, design, wn.w, wn.h);
}

// Ventana spawneable (P8): crea en la posición dada y la deja lista para mover
// con el gizmo. Solo en modo "Editar Edificio". Las spawneadas viajan en el
// JSON de proyecto (campo windows[]) para poder recrearse al abrir.
export function addWindow(id, name, x, z, rotY = 0, w = 2, h = 1.6, design = 'clasica') {
  const g = createWindow(id, name, x, 2.1, z, rotY, w, h, officeGroup, design);
  g.userData.spawnedWindow = true;
  return g;
}

// Sincroniza ventanas spawneadas con el snapshot del proyecto (P8): las que ya
// no están en el snapshot se ocultan (undo) y las que faltan se crean (carga).
// Llamado desde applyProject ANTES de aplicar transformaciones.
export function syncWindows(list = []) {
  const wanted = new Set(list.map(s => s.id));
  windowGroups.forEach(g => {
    if (g.userData.spawnedWindow && !wanted.has(g.userData.windowId)) {
      g.visible = false;
    }
  });
  list.forEach(s => {
    const existing = windowGroups.find(g => g.userData.windowId === s.id);
    if (existing) { existing.visible = true; return; }
    const g = addWindow(s.id, s.name, s.pos[0], s.pos[2], s.rotY || 0, s.w, s.h, s.design);
    g.visible = true;
  });
}

// ---------- PUERTA SPAWNEABLE (P8) ----------
// Equivale a la createDoor interna de buildWalls, pero exportada para poder
// agregar puertas nuevas con el modo "Editar Edificio". Nacen CERRADAS.
// 3 diseños (Fase 5): 'vidrio' (hoja vidriada), 'madera' (hoja maciza con
// picaporte) y 'doble' (dos hojas angostas que abren en espejo).
export const DOOR_DESIGNS = [
  { id: 'vidrio', label: '🚪 Vidrio' },
  { id: 'madera', label: '🚪 Madera' },
  { id: 'doble', label: '🚪🚪 Doble hoja' }
];
let spawnDoorCounter = 0;
export function addDoor(id, name, x, z, rotY = 0, width = 1.4, parent = officeGroup, design = 'vidrio') {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const h = 2.2, thick = 0.12;
  // Marco fijo (jambas + dintel), común a los 3 diseños
  [-1].forEach(sx => {
    const jamb2 = new THREE.Mesh(geo.box(0.1, h, thick), wallFrameMat);
    jamb2.position.set(sx * (width / 2 + 0.05), h / 2, 0);
    g.add(jamb2);
  });
  const header = new THREE.Mesh(geo.box(width + 0.2, 0.1, thick), wallFrameMat);
  header.position.set(0, h, 0);
  g.add(header);
  const built = buildDoorLeaves(g, design, width, h, thick);
  parent.add(g);
  spawnDoorCounter++;
  const did = id || ('door_spawn' + spawnDoorCounter);
  registerSelectable(did, name || ('Puerta ' + spawnDoorCounter), g, 'door', null);
  g.userData.doorData = { w: width, h, rotY, design };
  storeDoorRefs(g, built);
  g.userData.doorState = 'cerrado';
  g.userData.doorId = did;
  g.userData.spawnedDoor = true;
  doorGroups.push(g);
  setDoorState(g, 'cerrado');
  return g;
}

const doorWoodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.7 });
const doorKnobMat = new THREE.MeshStandardMaterial({ color: 0xd9d9d9, roughness: 0.3, metalness: 0.8 });

// Hojas según diseño (dentro del grupo, sobre el marco ya puesto).
// Devuelve { group, leaves }: el llamador los guarda en userData DESPUÉS de
// registerSelectable (que reemplaza userData por { id, name, type }).
function buildDoorLeaves(g, design, width, h, thick) {
  if (design === 'madera') {
    const pivot = new THREE.Group();
    pivot.position.set(width / 2, 0, 0);
    const leaf = new THREE.Mesh(geo.box(width, h, thick), doorWoodMat);
    leaf.position.set(-width / 2, h / 2, 0);
    leaf.castShadow = true;
    pivot.add(leaf);
    [thick / 2 + 0.04, -(thick / 2 + 0.04)].forEach(z => {
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), doorKnobMat);
      knob.position.set(-width + 0.15, h / 2, z);
      pivot.add(knob);
    });
    g.add(pivot);
    return { group: pivot, leaves: null };
  } else if (design === 'doble') {
    const holder = new THREE.Group();
    const leaves = [];
    [-1, 1].forEach(s => {
      const lw = width / 2;
      const pivot = new THREE.Group();
      pivot.position.set(s * width / 2, 0, 0);
      const leaf = new THREE.Mesh(geo.box(lw, h, thick), doorGlassMat);
      leaf.position.set(-s * lw / 2, h / 2, 0);
      leaf.castShadow = true;
      pivot.add(leaf);
      const pull = new THREE.Mesh(geo.box(0.05, 0.5, 0.05), doorLeafMat);
      pull.position.set(-s * 0.12, h / 2, thick / 2 + 0.03);
      pivot.add(pull);
      holder.add(pivot);
      leaves.push(pivot);
    });
    const mull = new THREE.Mesh(geo.box(0.06, h, thick), wallFrameMat);
    mull.position.set(0, h / 2, 0);
    holder.add(mull);
    g.add(holder);
    return { group: holder, leaves };
  } else {
    const pivot = new THREE.Group();
    pivot.position.set(width / 2, 0, 0);
    const leaf = new THREE.Mesh(geo.box(width, h, thick), doorGlassMat);
    leaf.position.set(-width / 2, h / 2, 0);
    pivot.add(leaf);
    const handle = new THREE.Mesh(geo.box(0.12, 0.05, 0.05), doorLeafMat);
    handle.position.set(-width, h / 2 - 0.12, thick / 2);
    pivot.add(handle);
    g.add(pivot);
    return { group: pivot, leaves: null };
  }
}

function storeDoorRefs(g, built) {
  g.userData.doorGroup = built.group;
  if (built.leaves) g.userData.doorLeaves = built.leaves;
  else delete g.userData.doorLeaves;
}

// Cambiar el diseño de una puerta ya creada (reconstruye hojas in situ:
// conserva id, posición, estado y pared pegada).
export function setDoorDesign(g, design) {
  const dd = g && g.userData.doorData;
  if (!dd || !DOOR_DESIGNS.some(d => d.id === design)) return;
  if (dd.design === design) return;
  const drop = [];
  g.children.forEach(c => {
    // El marco se queda; solo salen las hojas/pivotes (geometrías y
    // materiales compartidos: sin dispose; GC se lleva los nodos sueltos).
    if (c === g.userData.doorGroup) drop.push(c);
  });
  drop.forEach(c => g.remove(c));
  dd.design = design;
  const w = dd.w, h = dd.h || 2.2, thick = 0.12;
  storeDoorRefs(g, buildDoorLeaves(g, design, w, h, thick));
  setDoorState(g, g.userData.doorState || 'cerrado');
}

// ---------- IMÁN DE ABERTURA A PARED (ventana o puerta) ----------
// Al arrastrar una abertura, si su centro queda a menos de WALL_SNAP_DIST de
// la cara de una pared, la "prende" ahí: la centra en la pared (a lo largo),
// la pega a la cara (sobresaliendo el marco a ambos lados) y alinea su
// rotación a la perpendicular de la pared. Mientras NO esté pegada, actúa
// libre; si estaba pegada y se aleja más de WALL_SNAP_RELEASE, se libera
// (histéresis). La puerta queda a y=0 (se arrastra en el piso).
export const WALL_SNAP_DIST = 0.35;     // radio de captura (metros)
export const WALL_SNAP_RELEASE = 0.6;   // radio de liberación (histéresis)

export function wallSnap(openingObj, newPos) {
  if (!openingObj || (!openingObj.userData.windowData && !openingObj.userData.doorData)) return null;
  // ¿Estaba pegada? Entonces usar el radio de liberación, sino el de captura.
  const wasAttached = !!openingObj.userData._attachedWall;
  const radius = wasAttached ? WALL_SNAP_RELEASE : WALL_SNAP_DIST;

  let best = null;
  wallGroups.forEach(w => {
    if (!w.visible) return;
    const wd = w.userData.wallData;
    if (!wd) return;
    // La ventana solo se pega a paredes del edificio/oficina (no a paneles de
    // construcción en otra capa). Se ancla contra la cara más cercana.
    const pos = w.position;
    const swap = Math.abs(Math.sin(w.rotation.y)) > 0.5;
    const len = swap ? wd.d : wd.w;      // largo de la pared (eje principal)
    const thick = swap ? wd.w : wd.d;    // espesor
    // Pared "a lo largo de X" si no swap (len en x), "a lo largo de Z" si swap
    const alongAxis = swap ? 'z' : 'x';
    const crossAxis = swap ? 'x' : 'z';
    // Distancia del centro de la ventana al plano de la pared (centro de la
    // línea), y a lo largo dentro del largo
    const cross = crossAxis === 'x' ? newPos.x - pos.x : newPos.z - pos.z;
    const along = alongAxis === 'x' ? newPos.x : newPos.z;
    const wallAlong = alongAxis === 'x' ? pos.x : pos.z;
    // Fuera del tramo de la pared → no pegar
    if (Math.abs(along - wallAlong) > len / 2) return;
    // Distancia a la cara (mitad del espesor + posición)
    const dist = Math.abs(cross) - thick / 2;
    if (dist <= radius && (best === null || dist < best.dist)) {
      best = { w, wd, swap, alongAxis, crossAxis, thick, dist, wallAlong, sign: Math.sign(cross) || 1 };
    }
  });
  if (!best) return { attached: false, pos: newPos };

  const wall = best.w;
  // Rotación: la ventana mira hacia fuera, perpendicular a la cara.
  // Pared a lo largo de X → la cara mira ±z → ventana rot z; a lo largo de Z → cara ±x → rot x.
  const faceRot = best.alongAxis === 'x'
    ? (best.sign > 0 ? Math.PI / 2 : -Math.PI / 2)   // cara +z o -z
    : (best.sign > 0 ? 0 : Math.PI);                   // cara +x o -x

  const out = newPos.clone ? newPos.clone() : { x: newPos.x, y: newPos.y, z: newPos.z };
  // Centrar a lo largo de la pared (la ventana queda donde la soltó el ratón
  // en ese eje, pero se asegura dentro) y PEGAR a la cara.
  const crossAxis = best.crossAxis;
  const faceCoord = (crossAxis === 'x' ? wall.position.x : wall.position.z) + best.sign * (best.thick / 2);
  out[crossAxis] = faceCoord + best.sign * 0.02;  // sobresale un poco del espesor
  // Altura: mantener la que trae (el usuario la baja/sube con el eje Y)
  return { attached: true, pos: out, rotY: faceRot, wall };
}

