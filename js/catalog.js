// js/catalog.js — Catálogo de piezas para armar escenas (P7, ver mejoras_glm.md).
// Cada entrada del catálogo instancia un objeto nuevo con ID autogenerado,
// lo registra como seleccionable y lo integra con undo (pushHistory) y con la
// serialización de proyectos (serializeProject/applyProject via syncSpawned).
import { viewCenterGround } from './core.js';
import { interactiveRegistry, store } from './state.js';
import { getActiveEntry, setActiveTarget, clearActiveTarget } from './ui/selection.js';
import {
  createDesk, createChair, createSofa, createPlant, createFileCabinet,
  createCopier, createEmptyTable, createPCTower, createLaptop
} from './office/furniture.js';
import { createSceneCamera, setSceneCameraFov } from './office/sceneCameras.js';
import { pushHistory } from './undo.js';
import { setStatus } from './media/recorder.js';
import { attachOpeningToWall } from './construction.js';

// ==========================================
// CATÁLOGO DE PIEZAS
// ==========================================
// { id, label, cat, spawn(id, name, x, z, rotY) -> THREE.Group }
// Las fábricas de furniture.js se adaptan directo; las de serverRoom.js se
// registran desde buildServerRoom() (viven como funciones internas suyas).
export const CATALOG = [];

export function registerCatalogEntry(entry) {
  if (!CATALOG.some(c => c.id === entry.id)) CATALOG.push(entry);
}

// --- adaptadores para fábricas que ahora reciben id, nombre, x, y, z, rotY ---
// (la fábrica ya registra el objeto; el adaptador solo la delega al catálogo)
const spawnPCTower = (id, name, x, z, rotY) => createPCTower(id, name, x, 0, z, rotY);
const spawnLaptop = (id, name, x, z, rotY) => createLaptop(id, name, x, 0, z, rotY);

registerCatalogEntry({ id: 'desk', label: '🖥️ Escritorio', cat: '🪑 Mobiliario', spawn: (id, name, x, z, rotY) => createDesk(id, name, x, z, rotY) });
registerCatalogEntry({ id: 'chair', label: '🪑 Silla', cat: '🪑 Mobiliario', spawn: (id, name, x, z, rotY) => createChair(id, name, x, z, rotY) });
registerCatalogEntry({ id: 'sofa', label: '🛋️ Sillón', cat: '🪑 Mobiliario', spawn: (id, name, x, z, rotY) => createSofa(id, name, x, z, rotY) });
registerCatalogEntry({ id: 'plant', label: '🪴 Planta', cat: '🪑 Mobiliario', spawn: (id, name, x, z) => createPlant(id, name, x, z) });
registerCatalogEntry({ id: 'fileCabinet', label: '🗄️ Archivero', cat: '🪑 Mobiliario', spawn: (id, name, x, z, rotY) => createFileCabinet(id, name, x, z, rotY) });
registerCatalogEntry({ id: 'copier', label: '🖨️ Fotocopiadora', cat: '🪑 Mobiliario', spawn: (id, name, x, z, rotY) => createCopier(id, name, x, z, rotY) });
registerCatalogEntry({ id: 'emptyTable', label: '🛠️ Mesa Multiuso', cat: '🪑 Mobiliario', spawn: (id, name, x, z, rotY) => createEmptyTable(id, name, x, z, rotY) });

registerCatalogEntry({ id: 'pcTower', label: '💻 Torre PC', cat: '💻 Equipamiento IT', spawn: spawnPCTower });
registerCatalogEntry({ id: 'laptop', label: '💻 Laptop', cat: '💻 Equipamiento IT', spawn: spawnLaptop });

// Cámaras colocables (GLM #3): prop con posición/orientación/FOV propios que
// las tomas pueden usar como vista ("Cámara puesta"). `rebuild` restaura el
// FOV guardado en el JSON (la posición/rotación las aplica syncSpawned).
registerCatalogEntry({
  id: 'sceneCamera',
  label: '📷 Cámara',
  cat: '📡 Red',
  spawn: (id, name, x, z, rotY) => createSceneCamera(id, name, x, z, rotY),
  rebuild: (s) => {
    const g = createSceneCamera(s.id, s.name, s.pos[0], s.pos[2], s.rotY || 0);
    if (g && s.data && typeof s.data.fov === 'number') setSceneCameraFov(g, s.data.fov);
    return g;
  }
});

// ==========================================
// SPAWN / DELETE / DUPLICATE
// ==========================================
const spawnCounts = {};

function bumpCounterFromId(catId, id) {
  const m = /(\d+)$/.exec(id || '');
  if (m) spawnCounts[catId] = Math.max(spawnCounts[catId] || 0, parseInt(m[1], 10));
}

// Punto libre en el centro de la vista (donde mira la cámara ahora),
// en grilla de 0.5m
function findFreeSpot() {
  const c = viewCenterGround();
  const bx = Math.round(c.x * 2) / 2, bz = Math.round(c.z * 2) / 2;
  const offsets = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]];
  for (const [dx, dz] of offsets) {
    const x = bx + dx, z = bz + dz;
    let free = true;
    interactiveRegistry.forEach(e => {
      if (!e.group || e.deleted) return;
      if (Math.hypot(e.group.position.x - x, e.group.position.z - z) < 0.9) free = false;
    });
    if (free) return [x, undefined, z];
  }
  return [bx, undefined, bz];
}

// Instanciar una pieza del catálogo. opts: { pos, rotY, scale, id, name, silent }
export function spawnCatalogItem(catId, opts = {}) {
  const entry = CATALOG.find(c => c.id === catId);
  if (!entry) { setStatus(`Pieza "${catId}" no encontrada en el catálogo.`); return null; }
  const n = (spawnCounts[catId] || 0) + 1;
  spawnCounts[catId] = n;
  const id = opts.id || `${catId}_spawn${n}`;
  const name = opts.name || `${entry.label} ${n}`;
  const pos = opts.pos || findFreeSpot();
  const rotY = opts.rotY || 0;
  const g = entry.spawn(id, name, pos[0], pos[2], rotY);
  if (!g) return null;
  g.position.set(pos[0], pos[1] ?? entry.baseY ?? 0, pos[2]);
  // Aplicar rotación/rotación que el llamador pidió explícitamente (algunas
  // fábricas, ej. las de serverRoom.js, no reciben rotY como parámetro).
  if (opts.rotY !== undefined) g.rotation.y = rotY;
  if (opts.scale) g.scale.setScalar(opts.scale);
  g.userData.catalogId = catId;
  g.userData.spawned = true;
  const regEntry = interactiveRegistry.get(id);
  if (regEntry) regEntry.spawned = true;
  if (!opts.silent) {
    setActiveTarget(id);
    pushHistory();
    setStatus(`${entry.label} agregado a la escena.`);
  }
  return g;
}

const NON_DELETABLE = ['human', 'pet', 'wall', 'door'];

// Borrado suave: el objeto queda oculto y marcado `deleted`. Así el undo
// (snapshots JSON) puede restaurarlo sin recrear geometría.
export function deleteActiveObject() {
  const entry = getActiveEntry();
  if (!entry) { setStatus('Seleccioná un objeto para borrar.'); return false; }
  if (NON_DELETABLE.includes(entry.type)) {
    setStatus('Los personajes y las paredes/puertas no se borran desde acá.');
    return false;
  }
  entry.deleted = true;
  entry.group.visible = false;
  // Si era una abertura pegada a una pared, cerrar su hueco y soltarla
  if ((entry.type === 'window' || entry.type === 'door') && entry.group.userData._attachedWall) {
    attachOpeningToWall(entry.group, null);
  }
  if (store.activeTarget === entry.id) clearActiveTarget();
  pushHistory();
  setStatus(`${entry.name} eliminado (Ctrl+Z para deshacer).`);
  return true;
}

// Prefijos de IDs de los objetos originales de la escena -> catálogo
const PREFIX_MAP = [
  ['desk', 'desk'], ['chair', 'chair'], ['sofa', 'sofa'], ['plant', 'plant'],
  ['cabinet', 'fileCabinet'], ['filecabinet', 'fileCabinet'], ['copier', 'copier'],
  ['kitchen', 'kitchenCounter'], ['fridge', 'fridge'], ['dispenser', 'dispenser'],
  ['vending', 'vendingMachine'], ['lunchtable', 'lunchTable'],
  ['conftable', 'confTable'], ['bosssofa', 'chesterfield'], ['chester', 'chesterfield'],
  ['bosstable', 'bossTable'], ['bossbar', 'bar'], ['execdesk', 'execDesk'],
  ['execchair', 'execChair'], ['guestchair', 'guestChair'], ['bossart', 'painting'],
  ['bossclock', 'wallClock'], ['clock', 'wallClock'],
  ['table', 'emptyTable'], ['rack', 'serverRack'], ['firewall', 'firewall'],
  ['kvm', 'kvmCart'], ['shelf', 'shelfUnit'],
  ['ap', 'wallAP'], ['elecpanel', 'elecPanel'], ['flooroutlet', 'floorOutlet'],
  ['minirack', 'miniRack']
];

export function inferCatalogId(id) {
  const hit = PREFIX_MAP.find(([p]) => id.toLowerCase().startsWith(p));
  return hit ? hit[1] : null;
}

export function duplicateActiveObject() {
  const entry = getActiveEntry();
  if (!entry) { setStatus('Seleccioná un objeto para duplicar.'); return false; }
  if (NON_DELETABLE.includes(entry.type)) {
    setStatus('Los personajes y las paredes/puertas no se duplican desde acá.');
    return false;
  }
  const catId = entry.group.userData.catalogId || inferCatalogId(entry.id);
  if (!catId || !CATALOG.some(c => c.id === catId)) {
    setStatus('Este objeto no está en el catálogo: no se puede duplicar.');
    return false;
  }
  const src = entry.group;
  const g = spawnCatalogItem(catId, {
    pos: [src.position.x + 0.6, src.position.y, src.position.z + 0.6],
    rotY: src.rotation.y,
    scale: src.scale.x
  });
  if (g) setStatus(`${entry.name} duplicado.`);
  return !!g;
}

// ==========================================
// SINCRONIZACIÓN CON LA SERIALIZACIÓN DE PROYECTOS
// ==========================================
// Llamado desde applyProject (projectFiles.js) ANTES de aplicar transformaciones:
// - los objetos spawneados que ya no están en el snapshot quedan ocultos (undo)
// - los del snapshot que faltan se crean (carga de archivo guardado)
export function syncSpawned(list = []) {
  const wanted = new Set(list.map(s => s.id));
  interactiveRegistry.forEach((entry, id) => {
    if (entry.group.userData.spawned && !wanted.has(id)) {
      entry.deleted = true;
      entry.group.visible = false;
    }
  });
  list.forEach(s => {
    const existing = interactiveRegistry.get(s.id);
    if (existing) {
      existing.deleted = false;
      existing.group.visible = true;
      return;
    }
    const entry = CATALOG.find(c => c.id === s.catalog);
    if (!entry) return;
    // Algunas piezas (ej. canaleta dibujada punto a punto) guardan datos extra
    // y se recrean con `rebuild`; el resto usa el `spawn` estándar.
    let g = entry.rebuild ? entry.rebuild(s) : null;
    if (!g) g = entry.spawn(s.id, s.name, s.pos[0], s.pos[2], s.rotY || 0);
    if (!g) return;
    g.position.set(s.pos[0], s.pos[1] ?? 0, s.pos[2]);
    if (s.rotY) g.rotation.y = s.rotY;
    if (s.scale) g.scale.setScalar(s.scale);
    g.userData.catalogId = s.catalog;
    g.userData.spawned = true;
    const regEntry = interactiveRegistry.get(s.id);
    if (regEntry) regEntry.spawned = true;
    bumpCounterFromId(s.catalog, s.id);
  });
}

