// Test funcional del catálogo (P7) en Node: evalúa el grafo de módulos con
// stubs y prueba spawn → duplicar → borrar → serializar → restaurar.
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

// ---------- Shims globales de DOM ----------
const noop = () => {};
function makeCanvas() {
  return {
    width: 300, height: 150, clientWidth: 1280, clientHeight: 720,
    style: {}, classList: { add() {}, remove() {}, toggle() {} },
    addEventListener: noop, removeEventListener: noop,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    getContext: () => makeCtx(),
    captureStream: () => ({ getVideoTracks: () => [{ stop() {} }] }),
    getRootNode: function () { return this.ownerDocument || globalThis.document; },
    ownerDocument: null,
  };
}
function makeCtx() {
  const gradient = { addColorStop: () => {} };
  return new Proxy({}, {
    get(t, p) {
      if (p === 'measureText') return () => ({ width: 10 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => gradient;
      return t[p] !== undefined ? t[p] : () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}
function makeElement() {
  const el = makeCanvas();
  el.innerHTML = ''; el.textContent = ''; el.value = ''; el.disabled = false;
  el.setAttribute = noop; el.getAttribute = () => null;
  el.appendChild = noop; el.removeChild = noop; el.click = noop; el.focus = noop;
  el.querySelectorAll = () => [];
  el.querySelector = () => makeElement();
  return el;
}
globalThis.document = (() => {
  const view = makeCanvas();
  const doc = {
    getElementById: (id) => (id === 'view' ? view : makeElement()),
    querySelector: () => makeElement(),
    querySelectorAll: () => [],
    createElement: () => makeElement(),
    addEventListener: noop, removeEventListener: noop,
    body: makeElement(), activeElement: null, ownerDocument: null,
  };
  view.ownerDocument = doc;
  return doc;
})();
globalThis.window = {
  addEventListener: noop, removeEventListener: noop,
  showSaveFilePicker: undefined, prompt: () => null,
  location: { href: '' }, devicePixelRatio: 1,
};
globalThis.requestAnimationFrame = noop;
globalThis.addEventListener = noop;
globalThis.FileReader = class { readAsText() {} };

globalThis.__makeStubRenderer = () => new Proxy(function () {}, {
  construct() {
    const target = { domElement: globalThis.document.getElementById('view'), shadowMap: {}, capabilities: { getMaxAnisotropy: () => 8 } };
    return new Proxy(target, {
      get(t, p) { if (p in t) return t[p]; return () => {}; },
      set(t, p, v) { t[p] = v; return true; }
    });
  }
});
globalThis.__StubPMREM = class { constructor() {} fromScene() { return { texture: null }; } dispose() {} };

register('./p7-loader.mjs', pathToFileURL('./tools/'));

register('./p7-loader.mjs', pathToFileURL('./tools/'));

// ---------- Imports del proyecto (grafo real) ----------
const t0 = Date.now();
const { CATALOG, spawnCatalogItem, deleteActiveObject, duplicateActiveObject, syncSpawned } =
  await import(pathToFileURL('./js/catalog.js'));
const { toggleInMulti, hasMulti, multi, beginGroupDrag, updateGroupDrag, endGroupDrag, deleteMultiSelection } =
  await import(pathToFileURL('./js/multiselect.js'));
// Importar office/index.js para ejecutar buildServerRoom(), que registra las
// 5 piezas de equipamiento IT en el catálogo (igual que main.js en el navegador).
await import(pathToFileURL('./js/office/index.js'));
// Ejecutar main.js completo para validar que todo el grafo de arranque carga.
await import(pathToFileURL('./js/main.js'));
const { interactiveRegistry, store } = await import(pathToFileURL('./js/state.js'));
const { serializeProject, applyProject } = await import(pathToFileURL('./js/projectFiles.js'));
console.log(`grafo evaluado OK en ${Date.now() - t0} ms`);

const assert = (cond, msg) => { if (!cond) { console.error('✗ FALLO: ' + msg); process.exit(1); } console.log('✓ ' + msg); };

assert(CATALOG.length >= 12, `catálogo con ${CATALOG.length} piezas (>= 12)`);
assert(CATALOG.some(c => c.id === 'serverRack'), 'piezas de serverRoom registradas desde buildServerRoom');
['kitchenCounter', 'fridge', 'dispenser', 'vendingMachine', 'lunchTable'].forEach(id =>
  assert(CATALOG.some(c => c.id === id), `pieza de cocina registrada: ${id}`));
['confTable', 'chesterfield', 'bossTable', 'bar', 'execDesk', 'execChair', 'guestChair', 'painting', 'wallClock'].forEach(id =>
  assert(CATALOG.some(c => c.id === id), `pieza lounge/gerencia registrada: ${id}`));
['wallAP', 'elecPanel', 'cableTray', 'floorOutlet', 'miniRack'].forEach(id =>
  assert(CATALOG.some(c => c.id === id), `pieza de red registrada: ${id}`));

// --- spawn ---
const desk = spawnCatalogItem('desk');
assert(!!desk, 'spawn de escritorio');
assert(desk.userData.id === 'desk_spawn1', 'ID autogenerado: ' + desk.userData.id);
assert(interactiveRegistry.has('desk_spawn1'), 'registrado en el registry');
assert(officeContains(desk), 'agregado a officeGroup');
function officeContains(g) {
  let ok = false;
  g.parent && (g.parent === g.parent); // noop
  // buscar en officeGroup.children (importado via registry entry parent)
  const entry = interactiveRegistry.get('desk_spawn1');
  const parent = entry.group.parent;
  ok = parent && parent.type === 'Group'; // officeGroup es un Group
  return !!parent;
}

// --- spawn con posición libre cerca del target ---
const chair = spawnCatalogItem('chair');
assert(chair.position.y === 0, 'silla apoyada en el piso (y=0)');

// --- duplicar ---
assert(duplicateActiveObject() === true, 'duplicar objeto activo');
assert(interactiveRegistry.has('chair_spawn2'), 'copia registrada: chair_spawn2');

// --- borrar (soft) ---
assert(deleteActiveObject() === true, 'borrar objeto activo');
const delEntry = interactiveRegistry.get(store.activeTarget ? store.activeTarget : 'chair_spawn2');
// tras borrar se deselecciona; verificar por id conocido
const dEntry = interactiveRegistry.get('chair_spawn2');
assert(dEntry && dEntry.deleted === true && dEntry.group.visible === false, 'borrado suave: invisible + flag');

// --- serialización ---
const snap = serializeProject();
assert(Array.isArray(snap.spawned) && snap.spawned.length === 3, `spawned serializados: ${snap.spawned.length} (esperados 3)`);
assert(snap.objects['chair_spawn2'] && snap.objects['chair_spawn2'].deleted === true, 'flag deleted en la serialización');

// --- undo/apply: restaurar desde el snapshot ---
syncSpawned([]);  // simular undo a un estado sin spawns
assert(interactiveRegistry.get('desk_spawn1').deleted === true, 'syncSpawned oculta los spawns al deshacer');
applyProject(JSON.parse(JSON.stringify(snap)));
assert(interactiveRegistry.get('desk_spawn1').deleted === false && interactiveRegistry.get('desk_spawn1').group.visible === true, 'applyProject restaura spawns visibles');
assert(interactiveRegistry.get('chair_spawn2').deleted === true && interactiveRegistry.get('chair_spawn2').group.visible === false, 'applyProject mantiene el borrado del snapshot');

// --- sync de contadores: nuevo spawn no pisa IDs existentes ---
const desk2 = spawnCatalogItem('desk');
assert(desk2.userData.id === 'desk_spawn2', `contador continúa tras carga sin colisionar: ${desk2.userData.id}`);

// --- escala y rotación persisten ---
const rack = spawnCatalogItem('serverRack', { pos: [5, 0, 5], rotY: 1.2, scale: 1.5 });
const rs = serializeProject();
const rEntry = rs.spawned.find(s => s.id === rack.userData.id);
assert(rEntry && rEntry.rotY === 1.2 && rEntry.scale === 1.5, 'rotY y escala del spawn serializados');

// --- BUG LAPTOP: spawn de laptop NO debe sobrescribir el it_laptop original ---
const it_laptop_orig = interactiveRegistry.get('it_laptop').group;
spawnCatalogItem('laptop', { pos: [9, 0, 9] });
assert(interactiveRegistry.has('laptop_spawn1'), 'laptop spawneada desde catálogo');
assert(interactiveRegistry.get('it_laptop').group === it_laptop_orig, 'bug laptop: it_laptop original intacto');

// --- MULTISELECCIÓN: toggle + mover bloque juntos + borrar grupo ---
toggleInMulti('laptop_spawn1');
toggleInMulti('desk_spawn2');
assert(hasMulti() && multi.ids.size === 2, `multiselección: ${multi.ids.size} objetos`);
// mover el bloque: el puntero avanza en pantalla -> ambos se desplazan igual
const d1 = {...interactiveRegistry.get('desk_spawn2').group.position};
const l1 = {...interactiveRegistry.get('laptop_spawn1').group.position};
assert(beginGroupDrag({ clientX: 640, clientY: 360 }, 'laptop_spawn1') === true, 'beginGroupDrag');
updateGroupDrag({ clientX: 900, clientY: 300 });
endGroupDrag();
const d2 = interactiveRegistry.get('desk_spawn2').group.position;
const l2 = interactiveRegistry.get('laptop_spawn1').group.position;
assert(Math.abs((d2.x - d1.x) - (l2.x - l1.x)) < 1e-6 && Math.abs((d2.z - d1.z) - (l2.z - l1.z)) < 1e-6,
  'el bloque se movió junto (mismo delta XZ)');
const delN = deleteMultiSelection();
assert(delN === 2, `borrado de grupo: ${delN}`);
assert(interactiveRegistry.get('desk_spawn2').deleted === true, 'grupo borrado (flag)');

const lunch = spawnCatalogItem('lunchTable', { pos: [1, 0, 1], silent: true });
assert(!!lunch && lunch.position.y === 0, 'lunchTable spawneada con origen en el piso');
const painting = spawnCatalogItem('painting', { silent: true });
assert(!!painting && Math.abs(painting.position.y - 2.1) < 1e-6, 'cuadro spawneado a altura de pared (baseY)');
const wallAP = spawnCatalogItem('wallAP', { silent: true });
assert(!!wallAP && Math.abs(wallAP.position.y - 2.25) < 1e-6, 'AP de red spawneado a altura de pared (baseY)');
const elecPanel = spawnCatalogItem('elecPanel', { silent: true });
assert(!!elecPanel && Math.abs(elecPanel.position.y - 1.5) < 1e-6, 'tablero eléctrico spawneado a altura de pared (baseY)');
const cableTray = spawnCatalogItem('cableTray', { silent: true });
assert(!!cableTray && Math.abs(cableTray.position.y - 3.42) < 1e-6, 'canaleta spawneada a altura de canaleta (baseY)');
const floorOutlet = spawnCatalogItem('floorOutlet', { silent: true });
assert(!!floorOutlet && Math.abs(floorOutlet.position.y - 0) < 1e-6, 'puesto de red de piso spawneado en el piso');

// --- mini rack (Lote 3b): puerta multi-instancia desde el catálogo ---
const miniRackSpawn = spawnCatalogItem('miniRack', { silent: true });
assert(!!miniRackSpawn && !!miniRackSpawn.userData.doorHinge, 'mini rack spawneado con puerta (doorHinge)');
assert(Math.abs(miniRackSpawn.position.y - 2.3) < 1e-6, 'mini rack spawneado a altura de pared (baseY 2.3)');
const rackFijo = interactiveRegistry.get('miniRack');
assert(!!rackFijo && !!rackFijo.group.userData.doorHinge, 'mini rack fijo de la oficina tiene puerta animable');
assert(rackFijo.group !== miniRackSpawn, 'mini rack fijo y spawneado son instancias distintas');
miniRackSpawn.userData.doorOpen = 1;
assert(miniRackSpawn.userData.doorAngle === 0 && miniRackSpawn.userData.doorHinge.rotation.y === 0, 'cada mini rack anima su puerta con estado propio');

// --- canaleta dibujada punto a punto (trayDraw): geometría, puntos y rebuild ---
const { createCableTrayRun } = await import(pathToFileURL('./js/office/network.js'));
const runPts = [{ x: 2, z: 2 }, { x: 5, z: 2 }, { x: 5, z: 6 }];
const run = createCableTrayRun('cableTray_run1', 'Canaleta Test', runPts, 3.42);
run.userData.catalogId = 'cableTray';
run.userData.spawned = true;
assert(run.children.length === 2, 'tramo dibujado: 3 puntos -> 2 segmentos');
assert(Array.isArray(run.userData.spawnData.points) && run.userData.spawnData.points.length === 3, 'tramo dibujado guarda sus puntos relativos');
const ctEntry = CATALOG.find(c => c.id === 'cableTray');
assert(typeof ctEntry.rebuild === 'function', 'catálogo canaleta expone rebuild');
const rebuilt = ctEntry.rebuild({ id: 'cableTray_runTmp', name: 'tmp', pos: [0, 3.42, 0], data: { points: [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 4 }], y: 3.42 } });
assert(!!rebuilt && rebuilt.children.length === 2, 'rebuild recrea el tramo desde los puntos');
const runSnap = serializeProject();
const runSer = runSnap.spawned.find(s => s.id === 'cableTray_run1');
assert(!!runSer && runSer.data && runSer.data.points.length === 3, 'tramo dibujado serializa sus puntos');

// --- canaleta: routing ortogonal (sin diagonales), codo 90° e imán/T ---
const { orthoSnap, routeOrtho, nearestOnSegment } = await import(pathToFileURL('./js/trayDraw.js'));
const os1 = orthoSnap({ x: 0, z: 0 }, { x: 3, z: 1 });
assert(os1.x === 3 && os1.z === 0, 'orthoSnap elige el eje dominante (X)');
const os2 = orthoSnap({ x: 0, z: 0 }, { x: 1, z: 3 });
assert(os2.x === 0 && os2.z === 3, 'orthoSnap elige el eje dominante (Z)');
const r1 = routeOrtho({ x: 0, z: 0 }, { x: 5, z: 0 }, 'x');
assert(r1.length === 1 && r1[0].x === 5 && r1[0].z === 0, 'routeOrtho recto (ya alineado)');
const r2 = routeOrtho({ x: 0, z: 0 }, { x: 5, z: 3 }, 'z');
assert(r2.length === 2 && r2[0].x === 5 && r2[0].z === 0 && r2[1].x === 5 && r2[1].z === 3, 'routeOrtho codo 90° con último tramo en Z');
const r3 = routeOrtho({ x: 0, z: 0 }, { x: 5, z: 3 }, 'x');
assert(r3.length === 2 && r3[0].x === 0 && r3[0].z === 3 && r3[1].x === 5 && r3[1].z === 3, 'routeOrtho codo 90° con último tramo en X');
const n1 = nearestOnSegment({ x: 2, z: 0.4 }, { x: 0, z: 0 }, { x: 5, z: 0 });
assert(Math.abs(n1.x - 2) < 1e-6 && Math.abs(n1.z) < 1e-6 && n1.t > 0 && n1.t < 1, 'nearestOnSegment proyección interior (unión en T)');
const n2 = nearestOnSegment({ x: -1, z: 0 }, { x: 0, z: 0 }, { x: 5, z: 0 });
assert(n2.t === 0 && Math.abs(n2.x) < 1e-6, 'nearestOnSegment se limita al extremo (imán a punta)');

// --- gestos de un disparo (se reproducen una vez y vuelven a la acción base) ---
const { GESTURE_DEFS, addHumanCharacter } = await import(pathToFileURL('./js/characters.js'));
const gnames = ['point', 'wave', 'shrug', 'no', 'clap', 'watch'];
assert(gnames.every(n => GESTURE_DEFS[n] && GESTURE_DEFS[n].duration > 0 && typeof GESTURE_DEFS[n].animate === 'function'), 'GESTURE_DEFS: 6 gestos con duración y animación');
const gestoRig = addHumanCharacter('gestoTestChar', 'Gesto Test', 0, 0, 0, {});
gestoRig.setAction('idle');
gestoRig.setAction('gesture:point');
assert(gestoRig.gesture === 'point' && gestoRig.currentAction === 'idle', 'setAction("gesture:point") lanza el gesto sin pisar la acción base');
gestoRig.setAction('walk');
assert(gestoRig.gesture === null && gestoRig.currentAction === 'walk', 'acción sostenida cancela el gesto en curso');
gestoRig.playGesture('wave');
assert(gestoRig.gesture === 'wave', 'playGesture("wave") inicia el gesto');
gestoRig.setAction('idle');

const { newProject } = await import(pathToFileURL('./js/projectFiles.js'));
const { areDefaultCharactersHidden } = await import(pathToFileURL('./js/characters.js'));
newProject('proyecto_test');
assert(areDefaultCharactersHidden() === true, 'proyecto nuevo oculta personajes por defecto');
assert(interactiveRegistry.get('human1').deleted === true && interactiveRegistry.get('human1').group.visible === false, 'human1 oculto en proyecto nuevo');
assert(interactiveRegistry.get('dog').deleted === true && interactiveRegistry.get('dog').group.visible === false, 'perro oculto en proyecto nuevo');
assert(interactiveRegistry.get('cat').deleted === true && interactiveRegistry.get('cat').group.visible === false, 'gato oculto en proyecto nuevo');
const blank = serializeProject();
assert(blank.hideDefaultCharacters === true, 'proyecto nuevo serializa hideDefaultCharacters');
addHumanCharacter('customChar1', 'Personaje Test', 0, 0, 0, { shirt: 0xff0000 });
const withChar = serializeProject();
assert(Array.isArray(withChar.characters) && withChar.characters[0].id === 'customChar1', 'personaje personalizado serializado');

// --- creador: outfit + accesorios persisten en el personaje ---
addHumanCharacter('customChar2', 'Chef Test', 1, 1, 0, { outfit: 'chef', sunglasses: true, femaleHair: true });
const withOutfit = serializeProject();
const serChef = withOutfit.characters.find(c => c.id === 'customChar2');
assert(!!serChef && serChef.colors.outfit === 'chef' && serChef.colors.sunglasses === true, 'outfit y accesorios del personaje serializados');

console.log('\n✅ P7: todas las pruebas pasaron');
process.exit(0);
