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
  el.dataset = {};
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
  addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
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
  await import(pathToFileURL('./js/ui/multiselect.js'));
// Importar office/index.js para ejecutar buildServerRoom(), que registra las
// 5 piezas de equipamiento IT en el catálogo (igual que main.js en el navegador).
await import(pathToFileURL('./js/office/index.js'));
// Ejecutar main.js completo para validar que todo el grafo de arranque carga.
await import(pathToFileURL('./js/main.js'));
const { interactiveRegistry, store, cinemaPaths } = await import(pathToFileURL('./js/state.js'));
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

// --- spawn --- (RF-32)
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

// --- spawn con posición libre cerca del target --- (RF-32)
const chair = spawnCatalogItem('chair');
assert(chair.position.y === 0, 'silla apoyada en el piso (y=0)');

// --- duplicar --- (RF-32)
assert(duplicateActiveObject() === true, 'duplicar objeto activo');
assert(interactiveRegistry.has('chair_spawn2'), 'copia registrada: chair_spawn2');

// --- borrar (soft) --- (RF-32)
assert(deleteActiveObject() === true, 'borrar objeto activo');
const delEntry = interactiveRegistry.get(store.activeTarget ? store.activeTarget : 'chair_spawn2');
// tras borrar se deselecciona; verificar por id conocido
const dEntry = interactiveRegistry.get('chair_spawn2');
assert(dEntry && dEntry.deleted === true && dEntry.group.visible === false, 'borrado suave: invisible + flag');

// --- serialización --- (RF-02)
const snap = serializeProject();
assert(Array.isArray(snap.spawned) && snap.spawned.length === 3, `spawned serializados: ${snap.spawned.length} (esperados 3)`);
assert(snap.objects['chair_spawn2'] && snap.objects['chair_spawn2'].deleted === true, 'flag deleted en la serialización');

// --- undo/apply: restaurar desde el snapshot --- (RF-03)
syncSpawned([]);  // simular undo a un estado sin spawns
assert(interactiveRegistry.get('desk_spawn1').deleted === true, 'syncSpawned oculta los spawns al deshacer');
applyProject(JSON.parse(JSON.stringify(snap)));
assert(interactiveRegistry.get('desk_spawn1').deleted === false && interactiveRegistry.get('desk_spawn1').group.visible === true, 'applyProject restaura spawns visibles');
assert(interactiveRegistry.get('chair_spawn2').deleted === true && interactiveRegistry.get('chair_spawn2').group.visible === false, 'applyProject mantiene el borrado del snapshot');

// --- sync de contadores: nuevo spawn no pisa IDs existentes --- (RF-32)
const desk2 = spawnCatalogItem('desk');
assert(desk2.userData.id === 'desk_spawn2', `contador continúa tras carga sin colisionar: ${desk2.userData.id}`);

// --- escala y rotación persisten --- (RF-32)
const rack = spawnCatalogItem('serverRack', { pos: [5, 0, 5], rotY: 1.2, scale: 1.5 });
const rs = serializeProject();
const rEntry = rs.spawned.find(s => s.id === rack.userData.id);
assert(rEntry && rEntry.rotY === 1.2 && rEntry.scale === 1.5, 'rotY y escala del spawn serializados');

// --- BUG LAPTOP: spawn de laptop NO debe sobrescribir el it_laptop original --- (RF-32)
const it_laptop_orig = interactiveRegistry.get('it_laptop').group;
spawnCatalogItem('laptop', { pos: [9, 0, 9] });
assert(interactiveRegistry.has('laptop_spawn1'), 'laptop spawneada desde catálogo');
assert(interactiveRegistry.get('it_laptop').group === it_laptop_orig, 'bug laptop: it_laptop original intacto');

// --- MULTISELECCIÓN: toggle + mover bloque juntos + borrar grupo --- (RF-04)
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

// --- mini rack (Lote 3b): puerta multi-instancia desde el catálogo --- (RF-37)
const miniRackSpawn = spawnCatalogItem('miniRack', { silent: true });
assert(!!miniRackSpawn && !!miniRackSpawn.userData.doorHinge, 'mini rack spawneado con puerta (doorHinge)');
assert(Math.abs(miniRackSpawn.position.y - 2.3) < 1e-6, 'mini rack spawneado a altura de pared (baseY 2.3)');
const rackFijo = interactiveRegistry.get('miniRack');
assert(!!rackFijo && !!rackFijo.group.userData.doorHinge, 'mini rack fijo de la oficina tiene puerta animable');
assert(rackFijo.group !== miniRackSpawn, 'mini rack fijo y spawneado son instancias distintas');
miniRackSpawn.userData.doorOpen = 1;
assert(miniRackSpawn.userData.doorAngle === 0 && miniRackSpawn.userData.doorHinge.rotation.y === 0, 'cada mini rack anima su puerta con estado propio');

// --- canaleta dibujada punto a punto (trayDraw): geometría, puntos y rebuild --- (RF-33)
const { createCableTrayRun } = await import(pathToFileURL('./js/office/network.js'));
const runPts = [{ x: 2, z: 7 }, { x: 5, z: 7 }, { x: 5, z: 9.5 }];
const run = createCableTrayRun('cableTray_run1', 'Canaleta Test', runPts, 3.42);
run.userData.catalogId = 'cableTray';
run.userData.spawned = true;
// Tramo elegido sin cruces de pared: 2 tramos de canaleta (y pasamuros ninguno)
const runTrays = run.children.filter(c => c.children.length > 0);
assert(runTrays.length === 2, 'tramo dibujado: 3 puntos -> 2 segmentos');
assert(Array.isArray(run.userData.spawnData.points) && run.userData.spawnData.points.length === 3, 'tramo dibujado guarda sus puntos relativos');
const ctEntry = CATALOG.find(c => c.id === 'cableTray');
assert(typeof ctEntry.rebuild === 'function', 'catálogo canaleta expone rebuild');
const rebuilt = ctEntry.rebuild({ id: 'cableTray_runTmp', name: 'tmp', pos: [0, 3.42, 0], data: { points: [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 4 }], y: 3.42 } });
assert(!!rebuilt && rebuilt.children.length === 2, 'rebuild recrea el tramo desde los puntos');
const runSnap = serializeProject();
const runSer = runSnap.spawned.find(s => s.id === 'cableTray_run1');
assert(!!runSer && runSer.data && runSer.data.points.length === 3, 'tramo dibujado serializa sus puntos');

// --- canaleta dibujada con pasamuros automáticos (atraviesa tabiques) --- (RF-33)
// Tramo que cruza el tabique vertical oeste de juntas (x=-4.5): de x=-8 a x=0
// con z=-7.75 (dentro del rango del tabique). Debe incluir el pasamuro.
const runWall = createCableTrayRun('cableTray_runWall', 'Cruza Tabique', [{ x: -8, z: -7.75 }, { x: 0, z: -7.75 }], 3.42);
const sleeves = runWall.children.filter(c => c.children.length === 0 && c.geometry && c.geometry.type === 'CylinderGeometry' && c.material && c.material.color && c.material.color.getHex() === 0x8a929e);
assert(sleeves.length >= 1, 'tramo que atraviesa tabique genera pasamuro automático');
// Tramo que NO cruza paredes: sin pasamuros
const runFree = createCableTrayRun('cableTray_runFree', 'Libre', [{ x: 5, z: 5 }, { x: 9, z: 5 }], 3.42);
const sleevesFree = runFree.children.filter(c => c.children.length === 0 && c.geometry && c.geometry.type === 'CylinderGeometry' && c.material && c.material.color && c.material.color.getHex() === 0x8a929e);
assert(sleevesFree.length === 0, 'tramo sin cruces no genera pasamuros');

// --- canaleta: routing ortogonal (sin diagonales), codo 90° e imán/T --- (RF-33)
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

// --- paquetes de datos por las canaletas (GLM #4) --- (RF-35)
// El grafo se construye con la red fija + los runs dibujados, y se reconecta
// solo al detectar cambios (agregar/mover/borrar un tramo).
const { tickers } = await import(pathToFileURL('./js/tickers.js'));
const tickersAntes = tickers.length;
await import(pathToFileURL('./js/office/packets.js'));
assert(interactiveRegistry.has('cableTray_run1'), 'run de canaleta de prueba registrado');
assert(tickers.length >= tickersAntes, 'packets.js cargó sin romper el registro de tickers');

// --- cámaras colocables (#3): prop con FOV propio usado por las tomas --- (RF-34)
const { CATALOG: CAT3, spawnCatalogItem: spawn3 } = await import(pathToFileURL('./js/catalog.js'));
const { createSceneCamera, sceneCameraFov, setSceneCameraFov } =
  await import(pathToFileURL('./js/office/sceneCameras.js'));
const catCam = CAT3.find(c => c.id === 'sceneCamera');
assert(!!catCam && catCam.cat === '📡 Red', 'catálogo: la cámara colocable está en 📡 Red');
const camProp = spawn3('sceneCamera', { silent: true, pos: [6, 0, 6], rotY: 0 });
assert(!!camProp && camProp.userData.catalogId === 'sceneCamera', 'la cámara se spawnea como prop');
assert(sceneCameraFov(camProp) === 50, 'FOV por defecto 50°');
setSceneCameraFov(camProp, 72);
assert(sceneCameraFov(camProp) === 72, 'el FOV se guarda en el prop');
setSceneCameraFov(camProp, 5);
assert(sceneCameraFov(camProp) === 20, 'el FOV se acota al mínimo (20°)');
setSceneCameraFov(camProp, 999);
assert(sceneCameraFov(camProp) === 100, 'el FOV se acota al máximo (100°)');
setSceneCameraFov(camProp, 65);
// Persistencia: `rebuild` del catálogo restaura el FOV guardado en el JSON
const rebuiltCam = catCam.rebuild({ id: 'sceneCamera_spawnX', name: 'Cámara X', pos: [2, 0, 3], rotY: 1, data: { fov: 35 } });
assert(sceneCameraFov(rebuiltCam) === 35, 'rebuild restaura el FOV del proyecto');
// La toma "📷 Cámara puesta" mira con la posición y el FOV del prop
const { cutCameraToShot: cutCam, camera: camCore, controls: ctrlCore } =
  { ...(await import(pathToFileURL('./js/cinema/cinematics.js'))), ...(await import(pathToFileURL('./js/core.js'))) };
const { view: viewState } = await import(pathToFileURL('./js/state.js'));
const camPropB = spawn3('sceneCamera', { silent: true, pos: [4, 0, -2], rotY: 0 });
setSceneCameraFov(camPropB, 68);
let camIdB = null;
interactiveRegistry.forEach((e, id) => { if (e.group === camPropB) camIdB = id; });
assert(!!camIdB, 'la cámara spawneada queda registrada con su id');
const fovBefore = camCore.fov;
cutCam('sceneCam', camIdB);
assert(viewState.mode === 'sceneCam', 'corte a cámara puesta: la vista es sceneCam');
assert(Math.abs(camCore.fov - 68) < 1e-6, 'la toma toma el FOV del prop (68°)');
assert(Math.abs(camCore.position.z - (-2)) < 1e-6 && Math.abs(camCore.position.x - 4) < 1e-6,
  'la toma se para en la posición del prop');
assert(Math.abs(camCore.position.y - 1.5) < 1e-6, 'la óptica queda a la altura del prop (1.5 m)');
assert(Math.abs(ctrlCore.target.z - (-1)) < 1e-6, 'rotY=0 apunta al SUR (+z) como los personajes');
// Restaurar el estado del editor para las pruebas siguientes
camCore.fov = fovBefore;
camCore.updateProjectionMatrix();
viewState.mode = 'orbit';
viewState.subjectId = null;

// --- exportación 1080p fija y contenedor MP4/WebM (#1 y #2) --- (RF-40)
const { output } = await import(pathToFileURL('./js/core.js'));
assert(!!output && !!output.renderer, '#2: existe el renderer de SALIDA (indirección)');
assert(output.renderer === (await import(pathToFileURL('./js/core.js'))).renderer,
  '#2: sin exportar, la salida es el renderer de la ventana');
const { pickExportMime, exportFormatOptions: efOptions } = await import(pathToFileURL('./js/media/recorder.js'));
const mp4Only = pickExportMime('auto', t => t.startsWith('video/mp4'));
assert(mp4Only.ext === 'mp4' && mp4Only.mime.startsWith('video/mp4'), '#1: con MP4 disponible, Auto elige MP4');
const webmOnly = pickExportMime('auto', t => t === 'video/webm;codecs=vp9');
assert(webmOnly.ext === 'webm' && webmOnly.mime === 'video/webm;codecs=vp9', '#1: sin MP4, Auto cae a WebM (VP9)');
const forcedWebm = pickExportMime('webm', () => true);
assert(forcedWebm.ext === 'webm' && forcedWebm.mime.startsWith('video/webm'), '#1: forzar WebM ignora MP4');
const noneAvail = pickExportMime('auto', () => false);
assert(noneAvail.mime === '' && noneAvail.ext === 'webm', '#1: sin formatos soportados no se inventa mime');
assert(typeof efOptions === 'function', '#1: la UI consulta qué formatos soporta el navegador');

// --- gestos de un disparo (se reproducen una vez y vuelven a la acción base) --- (RF-11)
const { GESTURE_DEFS, addHumanCharacter } = await import(pathToFileURL('./js/characters/characters.js'));
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
gestoRig.setAction('type_standing');
assert(gestoRig.currentAction === 'type_standing', 'acción type_standing (tecleando de pie) existe y aplica');

// --- lip-sync (backlog #2): la boca abre/cierra mientras dura `talk` --- (RF-12)
// (Muestras fuera de la ventana de blending 0.3s: a 0.1s aún está mezclando.)
gestoRig.setAction('talk');
gestoRig.run(0.5); // frame con la boca bastante abierta
const openScale = gestoRig.parts.h_mouth.scale.y;
gestoRig.run(1.1); // ~medio ciclo después: mucho más cerrada
const closedScale = gestoRig.parts.h_mouth.scale.y;
assert(openScale > 1.6, 'lip-sync: boca se abre al hablar (scale.y alto)');
assert(Math.abs(closedScale - openScale) > 1, 'lip-sync: la boca varía su apertura con el tiempo');
assert(gestoRig.parts.h_mouth.scale.y >= 0.99 && gestoRig.parts.h_mouth.scale.y <= 4.5, 'lip-sync: apertura dentro del rango (cerrada→abierta)');
gestoRig.setAction('idle');
gestoRig.run(0.1);
assert(Math.abs(gestoRig.parts.h_mouth.scale.y - 1) < 0.02, 'lip-sync: fuera de talk la boca vuelve a la forma normal');

// --- sit_talk: hablando SENTADO (el jefe no se para de la silla) --- (RF-13)
// La pose mantiene las piernas de sit y agrega gesticulación + lip-sync.
gestoRig.setAction('sit_talk');
gestoRig.run(0.5);
const sitTalkOpen = gestoRig.parts.h_mouth.scale.y;
gestoRig.run(1.1);
const sitTalkClosed = gestoRig.parts.h_mouth.scale.y;
assert(sitTalkOpen > 1.6, 'sit_talk: lip-sync activo (boca se abre sentado)');
assert(Math.abs(sitTalkClosed - sitTalkOpen) > 1, 'sit_talk: la boca varía su apertura');
// Las piernas quedan en pose de sentado (muslos horizontales), no de pie
assert(Math.abs(gestoRig.parts.h_legL.rotation.x - (-Math.PI / 2)) < 0.01, 'sit_talk: piernas apoyadas como sit (muslos horizontales)');
// El torso queda a altura de asiento, no de pie: no se "para" al hablar
assert(gestoRig.parts.h_torso.position.y < 0.95, 'sit_talk: torso a altura de silla (no se para)');
gestoRig.setAction('idle');
gestoRig.run(0.1);

// --- escena: evento SIN espera mantiene su acción (lip-sync en marcha) --- (RF-12)
// El preview de la timeline (getPreviewPath) antes perdía acciones de eventos
// con wait:0 (ej. "talk" al pasar): el segmento move siguiente las pisaba.
// 3 waypoints con el evento en el INTERMEDIO: así hay un tramo en movimiento
// después del evento. Los tiempos no son fijos: el A* del ambiente real
// alarga el recorrido (desvíos), así que se barre la línea completa en vez
// de asumir "llega al segundo 2".
const cinGesto = await import(pathToFileURL('./js/cinema/cinematics.js'));
const { evaluateAllPathsAt } = cinGesto;
const V = (await import('three')).Vector3;
const gestoPath = {
  waypoints: [new V(0, 0, 0), new V(5, 0, 0), new V(10, 0, 0)],
  planeY: 0,
  speed: 5,
  events: { '1': { action: 'talk', wait: 0 } }
};
cinemaPaths.set('gestoTestChar', gestoPath);
const gestoEnd = cinGesto.previewPathEnd(gestoPath);
assert(gestoEnd && gestoEnd.totalEnd > 0, 'escena: el preview resuelve el recorrido de prueba');
let gestoSawMove = false;
let gestoTalkedDuringMove = false;
for (let tt = 0.2; tt < gestoEnd.totalEnd; tt += 0.1) {
  evaluateAllPathsAt(tt);
  if (gestoRig.currentAction === 'run' || gestoRig.currentAction === 'walk') gestoSawMove = true;
  // talk con t < totalEnd solo puede venir de un segmento move post-evento
  // (no hay waits en este recorrido): eso es la acción "en marcha".
  if (gestoRig.currentAction === 'talk') gestoTalkedDuringMove = true;
}
assert(gestoSawMove, 'escena: antes del evento el personaje camina/corre');
assert(gestoTalkedDuringMove, 'escena: evento sin espera mantiene su acción en el recorrido (talk en marcha)');
evaluateAllPathsAt(0.5); // antes del evento: caminando
assert(gestoRig.currentAction === 'walk' || gestoRig.currentAction === 'run', 'escena: rebobinar al inicio vuelve a caminar/correr');
cinemaPaths.delete('gestoTestChar');

// --- pista 🧍 por personaje: acción de TODA la escena (fullRange) --- (RF-21)
// Un personaje con acción base la mantiene durante toda la línea, y un
// bloque puntual la pisa solo durante su tramo (después vuelve a la base).
// (setCharBlocks(blocks, full) es la API de applyProject: setea ambos juntos.)
const { charActionsAt, setCharBlocks, setCharFullAction } = await import(pathToFileURL('./js/cinema/charTrack.js'));
setCharBlocks([], {});
setCharFullAction('gestoTestChar', 'sit_typing');
let st = charActionsAt(0).get('gestoTestChar');
assert(st && st.action === 'sit_typing', 'fullRange: aplica desde t=0');
st = charActionsAt(999).get('gestoTestChar');
assert(st && st.action === 'sit_typing', 'fullRange: aplica hasta el fin de la escena');
// Un bloque de tramo pisa la base SOLO durante su tramo. Con HABLAR (talk):
// expira al terminar el bloque y vuelve a la base.
setCharBlocks([
  { id: 'cbX', start: 5, duration: 2, actions: { gestoTestChar: { action: 'talk' } } }
], { gestoTestChar: { action: 'sit_typing' } });
st = charActionsAt(6).get('gestoTestChar');
assert(st && st.action === 'talk', 'bloque pisa la acción base durante su tramo');
st = charActionsAt(8).get('gestoTestChar');
assert(st && st.action === 'sit_typing', 'tras el bloque de talk vuelve a la acción base (hablar expira)');
st = charActionsAt(4).get('gestoTestChar');
assert(st && st.action === 'sit_typing', 'antes del bloque: acción base');
// Limpieza para no contaminar el resto de la suite
setCharBlocks([], {});

// --- bloques guardan pose (lugar + rotación) y la reproducen --- (RF-16)
// Cada cuadro recuerda dónde quedó el personaje: al pasar de un cuadro a
// otro salta a su pose, y terminada la escena conserva la última.
const { charPoseAt, createInitialCharBlock, captureBlockPose, charMoveAt, calcMoveDuration, calcMoveSpeed, moveDist, moveBlockReady } = await import(pathToFileURL('./js/cinema/charTrack.js'));const poseRig = addHumanCharacter('poseTestChar', 'Pose Test', 1, 2, 0, {});
// El bloque inicial (3 s) nace con el lugar de creación
const poseInit = createInitialCharBlock('poseTestChar', 'idle');
assert(poseInit.start === 0 && poseInit.duration === 3, 'bloque inicial: arranca en 0 y dura 3 s');
assert(Math.abs(poseInit.actions.poseTestChar.pos[0] - 1) < 1e-6 && Math.abs(poseInit.actions.poseTestChar.pos[2] - 2) < 1e-6, 'bloque inicial: captura el lugar de creación');
assert(Math.abs((poseInit.actions.poseTestChar.rotY || 0) - 0) < 1e-6, 'bloque inicial: captura la rotación de creación');
// Dos cuadros con lugares distintos
setCharBlocks([
  { id: 'cbP1', start: 0, duration: 2, actions: { poseTestChar: { action: 'talk', mood: 'happy', pos: [1, 0, 2], rotY: 0 } } },
  { id: 'cbP2', start: 5, duration: 2, actions: { poseTestChar: { action: 'idle', pos: [7, 0, 8], rotY: 1.5 } } }
], {});
let pp = charPoseAt(1).get('poseTestChar');
assert(pp && pp.pos[0] === 1 && pp.pos[2] === 2, 'pose del cuadro vigente durante su tramo');
assert(charActionsAt(1).get('poseTestChar').mood === 'happy', 'el cuadro recuerda el ánimo');
pp = charPoseAt(3).get('poseTestChar');
assert(pp && pp.pos[0] === 1, 'entre cuadros se conserva la última pose');
pp = charPoseAt(6).get('poseTestChar');
assert(pp && pp.pos[0] === 7 && Math.abs(pp.rotY - 1.5) < 1e-9, 'al entrar al cuadro siguiente salta a su pose');
pp = charPoseAt(99).get('poseTestChar');
assert(pp && pp.pos[0] === 7, 'terminada la escena conserva el último lugar');
// La evaluación lo aplica en escena (sin recorrido: pose del bloque)
evaluateAllPathsAt(6);
const poseEntry = interactiveRegistry.get('poseTestChar');
assert(Math.abs(poseEntry.group.position.x - 7) < 1e-6 && Math.abs(poseEntry.group.position.z - 8) < 1e-6, 'reproducción: el personaje aparece en el lugar del cuadro');
assert(Math.abs(poseEntry.group.rotation.y - 1.5) < 1e-6, 'reproducción: el personaje mira como quedó en el cuadro');
evaluateAllPathsAt(99);
assert(Math.abs(poseEntry.group.position.x - 7) < 1e-6, 'reproducción: al final conserva el último lugar');
// Definir en el cuadro también fija el lugar (sin 💾 de por medio)
const capBlock = { id: 'cbCap', start: 0, duration: 2, actions: { poseTestChar: { action: 'idle' } } };
poseEntry.group.position.set(11, 0, 12);
poseEntry.group.rotation.y = 0.7;
captureBlockPose(capBlock);
assert(Math.abs(capBlock.actions.poseTestChar.pos[0] - 11) < 1e-6 && Math.abs(capBlock.actions.poseTestChar.rotY - 0.7) < 1e-6, 'definir en el cuadro captura el lugar');

// --- migración de proyectos viejos: bloques sobre esperas reales, walk libre --- (RF-21)
const { previewWaitRanges, previewPathEnd, duplicatePathFor } = await import(pathToFileURL('./js/cinema/cinematics.js'));const { migrateEventsToCharBlocks } = await import(pathToFileURL('./js/projectFiles.js'));
cinemaPaths.set('poseTestChar', { waypoints: [new V(0, 0, 0), new V(10, 0, 0)], planeY: 0, speed: 2, events: { 1: { action: 'talk', wait: 2 } } });
const migStored = cinemaPaths.get('poseTestChar');
const migRanges = previewWaitRanges(migStored);
const migEnd = previewPathEnd(migStored);
assert(migRanges.length === 1 && migRanges[0].action === 'talk', 'migración: solo la espera genera bloque');
assert(Math.abs(migRanges[0].duration - 2) < 1e-9, 'migración: la espera dura lo del evento');
// El A* del ambiente real alarga el recorrido (desvíos): el instante de
// llegada no es el del tramo recto (10m/2 = 5s). La espera termina exactamente
// con el fin del preview (evento en el último waypoint, sin tramo posterior).
assert(migRanges[0].start > 1 && migRanges[0].start <= migEnd.totalEnd - 2 + 1e-9 && migRanges[0].start >= migEnd.totalEnd - 2 - 0.05, 'migración: tiempos reales del recorrido');
const migBlocks = migrateEventsToCharBlocks({ poseTestChar: {} });
assert(migBlocks.length === 1 && migBlocks[0].actions.poseTestChar.action === 'talk', 'migración: bloque de habla');
// El bloque guarda start redondeado a2 decimales (round2 de la migración)
assert(migBlocks[0].start > 1 && Math.abs(migBlocks[0].start - migRanges[0].start) <= 0.011, 'migración: el bloque arranca al llegar (no en 0)');
setCharBlocks(migBlocks, {});
evaluateAllPathsAt(1);
assert(poseRig.currentAction === 'walk', 'migración: caminando no hay bloque que pise (no desliza)');
evaluateAllPathsAt(migRanges[0].start + 1);
assert(poseRig.currentAction === 'talk', 'migración: en la espera habla');
cinemaPaths.delete('poseTestChar');
setCharBlocks([], {});

// --- bloque expirado no pisa el caminar (no desliza) --- (RF-16)
cinemaPaths.set('poseTestChar', { waypoints: [new V(0, 0, 0), new V(20, 0, 0)], planeY: 0, speed: 2, events: {} });
setCharBlocks([{ id: 'cbOld', start: 0, duration: 2, actions: { poseTestChar: { action: 'idle' } } }], {});
evaluateAllPathsAt(5);
assert(poseRig.currentAction === 'walk', 'bloque expirado no pisa el caminar');
setCharBlocks([{ id: 'cbNow', start: 4, duration: 4, actions: { poseTestChar: { action: 'idle' } } }], {});
evaluateAllPathsAt(5);
assert(poseRig.currentAction === 'idle', 'bloque vigente sí manda aunque camine');
evaluateAllPathsAt(12);
assert(poseRig.currentAction === 'idle', 'al terminar el camino conserva');
cinemaPaths.delete('poseTestChar');
setCharBlocks([], {});

// --- camino: ⧉ duplica waypoints + eventos (lo camina dos veces) --- (RF-20)
cinemaPaths.set('dupPathChar', { waypoints: [new V(0, 0, 0), new V(4, 0, 0)], planeY: 0, speed: 2, events: { 1: { action: 'talk', wait: 1 } } });
assert(duplicatePathFor('dupPathChar') === true, 'duplica el recorrido');
const dupSt = cinemaPaths.get('dupPathChar');
assert(dupSt.waypoints.length === 3, 'waypoints repetidos (2 + 1)');
assert(dupSt.events['1'] && dupSt.events['2'] && dupSt.events['2'].action === 'talk', 'eventos repetidos con offset');
assert(previewPathEnd(dupSt).totalEnd > 3, 'el recorrido duplicado dura más');
assert(duplicatePathFor('sinCamino') === false, 'sin recorrido no duplica');
cinemaPaths.delete('dupPathChar');

// --- bloques de desplazamiento: duración auto + interpolación en curva --- (RF-21)
const mvTest = { waypoints: [{ x: 0, z: 0 }, { x: 3, z: 4 }], speed: 2 };
assert(Math.abs(moveDist(mvTest) - 5) < 1e-6, 'distancia del recorrido (curva)');
assert(Math.abs(calcMoveDuration(mvTest) - 2.5) < 1e-9, 'duración = distancia/velocidad');
assert(Math.abs(calcMoveSpeed(mvTest, 5) - 1) < 1e-9, 'editar duración adapta la velocidad');
assert(moveBlockReady({ actions: { c: { action: 'walk', move: { waypoints: [{ x: 0, z: 0 }, { x: 1, z: 0 }], speed: 2 } } } }) === true, 'move completo listo para guardar');
assert(moveBlockReady({ actions: { c: { action: null, move: { waypoints: [], speed: 2 } } } }) === false, 'sin animación ni puntos no guarda');
assert(moveBlockReady({ actions: { c: { action: 'idle' } } }) === true, 'estático siempre listo');
assert(moveBlockReady({ actions: { c: { action: 'walk', move: { from: { x: 0, z: 0 }, to: { x: 1, z: 0 }, speed: 2 } } } }) === true, 'from/to viejos siguen valiendo (migración)');
const mvCurve = { waypoints: [{ x: 0, z: 0 }, { x: 3, z: 4 }, { x: 6, z: 0 }], speed: 2 };
assert(moveDist(mvCurve) > 5, 'curva con intermedio más larga que la recta');
setCharBlocks([
  { id: 'cbM1', start: 2, duration: 4, actions: { poseTestChar: { action: 'walk', pos: [6, 0.17, 8], rotY: 0.64, move: { from: { x: 0, z: 0 }, to: { x: 6, z: 8 }, speed: 2.5 } } } }
], {});
const mm = charMoveAt(4).get('poseTestChar');
assert(!!mm && Math.abs(mm.x - 3) < 1e-6 && Math.abs(mm.z - 4) < 1e-6 && mm.action === 'walk', 'move vigente a mitad del tramo');
assert(Math.abs(mm.rotY - Math.atan2(6, 8)) < 1e-9, 'rumbo = dirección del recorrido');
assert(!charMoveAt(1).has('poseTestChar') && !charMoveAt(7).has('poseTestChar'), 'fuera del tramo no hay move');
assert(charActionsAt(4).get('poseTestChar').action === 'walk', 'acción durante el tramo');
assert(!charActionsAt(7).has('poseTestChar'), 'al terminar expira (vuelve a la base)');
setCharBlocks([{ id: 'cbM0', start: 0, duration: 2, actions: { poseTestChar: { action: null } } }], {});
assert(!charActionsAt(1).has('poseTestChar'), 'acción sin definir no pisa');
setCharBlocks([
  { id: 'cbM1', start: 2, duration: 4, actions: { poseTestChar: { action: 'walk', pos: [6, 0.17, 8], rotY: 0.64, move: { from: { x: 0, z: 0 }, to: { x: 6, z: 8 }, speed: 2.5 } } } }
], {});
evaluateAllPathsAt(4);
assert(Math.abs(poseEntry.group.position.x - 3) < 1e-6 && Math.abs(poseEntry.group.position.z - 4) < 1e-6, 'reproducción: interpola el recorrido');
assert(Math.abs(poseEntry.group.rotation.y - Math.atan2(6, 8)) < 1e-6, 'reproducción: mira el rumbo');
assert(poseEntry.group.userData && poseRig.currentAction === 'walk', 'reproducción: anima caminando');
const serM = serializeProject().charBlocks.find(b => b.id === 'cbM1');
assert(!!serM && serM.actions.poseTestChar.move.waypoints[1].x === 6, 'move persiste en el JSON');
setCharBlocks([], {});

// --- ojitos de pistas: ocultar no borra --- (RF-27)
const { laneVis, isCharLaneHidden, toggleCharLaneHidden, resetLaneVis } = await import(pathToFileURL('./js/state.js'));
assert(isCharLaneHidden('poseTestChar') === false, 'visible por defecto');
setCharBlocks([
  { id: 'cbH1', start: 2, duration: 4, actions: { poseTestChar: { action: 'walk', move: { waypoints: [{ x: 0, z: 0 }, { x: 6, z: 8 }], speed: 2.5 } } } }
], {});
assert(toggleCharLaneHidden('poseTestChar') === true && isCharLaneHidden('poseTestChar') === true, 'ojito oculta');
evaluateAllPathsAt(4);
assert(poseEntry.group.visible === false, 'oculto no se ve al reproducir');
assert(toggleCharLaneHidden('poseTestChar') === false && isCharLaneHidden('poseTestChar') === false, 'ojito muestra');
evaluateAllPathsAt(4);
assert(poseEntry.group.visible === true && Math.abs(poseEntry.group.position.x - 3) < 1e-6, 'visible vuelve y se mueve');
toggleCharLaneHidden('poseTestChar');
const serV = serializeProject().laneVis;
assert(!!serV && Array.isArray(serV.chars) && serV.chars.includes('poseTestChar'), 'ojito persiste en el JSON');
toggleCharLaneHidden('poseTestChar');
laneVis.camera = false; laneVis.subs = false; laneVis.quiz = false;
const serV2 = serializeProject().laneVis;
assert(serV2.camera === false && serV2.subs === false && serV2.quiz === false, 'ojitos cámara/subs/quiz persisten');
resetLaneVis();
assert(isCharLaneHidden('poseTestChar') === false && laneVis.camera === true, 'reset deja todo visible');
setCharBlocks([], {});

// --- ojito quiz: sync apaga/muestra de una (vale en pausa) --- (RF-27)
const { quizTrack: quizLaneT } = await import(pathToFileURL('./js/state.js'));
const { quizPlayTick, syncQuizVisibility } = await import(pathToFileURL('./js/cinema/quizTrack.js'));
const { quizIsActive, resetQuiz } = await import(pathToFileURL('./js/media/quiz.js'));
const { timeline: tlT } = await import(pathToFileURL('./js/state.js'));
const savedT = tlT.time;
tlT.time = 5;
quizLaneT.push({ id: 'quizT1', question: 'Q?', options: ['A', 'B', 'C'], correct: 0, duration: 10, start: 0, end: 20 });
quizPlayTick(0);
assert(quizIsActive() === true, 'cartel en el tramo se muestra');
laneVis.quiz = false;
syncQuizVisibility();
assert(quizIsActive() === false, 'sync apaga de una');
laneVis.quiz = true;
syncQuizVisibility();
assert(quizIsActive() === true, 'sync reabre en el tramo');
quizLaneT.length = 0;
resetQuiz();
resetLaneVis();
tlT.time = savedT;

// --- ojito cámara: el scrub NO mueve la cámara con el ojo tachado --- (RF-27)
const { scrubTo } = await import(pathToFileURL('./js/cinema/timeline.js'));
const { camera: camT, controls: ctrlT } = await import(pathToFileURL('./js/core.js'));
const { timeline: tlC } = await import(pathToFileURL('./js/state.js'));
tlC.shots.length = 0;
tlC.shots.push({ id: 'shotEye1', start: 0, duration: 10, camMode: 'fixed', subjectId: null,
  camPos: [40, 30, 40], target: [0, 1, 0] });
camT.position.set(7, 1.8, 9);
ctrlT.target.set(1, 1, 2);
laneVis.camera = false;
scrubTo(3);
assert(Math.abs(camT.position.x - 7) < 1e-6 && Math.abs(camT.position.z - 9) < 1e-6,
  'ojito tachado: scrub deja la cámara donde estaba');
laneVis.camera = true;
scrubTo(3);
assert(Math.abs(camT.position.x - 40) < 1e-6, 'ojito activo: scrub encuadra la toma');
tlC.shots.length = 0;
resetLaneVis();

// --- duplicar bloque: copia idéntica al final de la lane --- (RF-21)
const { duplicateCharBlock } = await import(pathToFileURL('./js/cinema/charTrack.js'));
const { charBlocks } = await import(pathToFileURL('./js/state.js'));
setCharBlocks([
  { id: 'cbD1', start: 0, duration: 2, actions: { poseTestChar: { action: 'idle', pos: [1, 0, 2], rotY: 0 } } },
  { id: 'cbD2', start: 2, duration: 3, actions: { poseTestChar: { action: 'talk', pos: [5, 0, 6], rotY: 1 } } }
], {});
const srcD = charBlocks.find(b => b.id === 'cbD1');
const dupD = duplicateCharBlock(srcD, 'poseTestChar');
assert(!!dupD && dupD.id !== 'cbD1', 'duplicado con id nuevo');assert(dupD.start === 5 && dupD.duration === 2, 'copia al final aunque el original esté antes');
assert(dupD.actions.poseTestChar.action === 'idle' && dupD.actions.poseTestChar.pos[0] === 1, 'copia idéntica (acción + lugar)');
assert(duplicateCharBlock({ id: 'cbX' }, 'poseTestChar') === null, 'fuera de la pista no duplica');
setCharBlocks([], {});

// --- camino por tramos: la selección abraza el pedazo visible --- (RF-21)
const { caminoGaps } = await import(pathToFileURL('./js/cinema/charTrack.js'));
setCharBlocks([
  { id: 'cbG1', start: 0, duration: 4, actions: { poseTestChar: { action: 'idle' } } },
  { id: 'cbG2', start: 8, duration: 2, actions: { poseTestChar: { action: 'talk' } } }
], {});
assert(JSON.stringify(caminoGaps('poseTestChar', 30)) === JSON.stringify([[4, 8], [10, 30]]), 'tramos = huecos entre cuadros');
assert(JSON.stringify(caminoGaps('poseTestChar', 9)) === JSON.stringify([[4, 8]]), 'tramo final cortado si no llega');
setCharFullAction('poseTestChar', 'idle');
assert(JSON.stringify(caminoGaps('poseTestChar', 30)) === JSON.stringify([[0, 30]]), 'con base cubre todo (una tira)');
setCharFullAction('poseTestChar', null);
assert(JSON.stringify(caminoGaps('otro', 30)) === JSON.stringify([[0, 30]]), 'sin cuadros: tira entera');
setCharBlocks([], {});

// --- extender bloque hasta el final del clip --- (RF-21)
const { extendBlockDataTo } = await import(pathToFileURL('./js/cinema/charTrack.js'));
const extB = { id: 'cbE', start: 8, duration: 4, actions: { poseTestChar: { action: 'idle' } } };
assert(extendBlockDataTo(extB, 45.8) === true && Math.abs(extB.duration - 37.8) < 1e-9, 'estira hasta el final');
assert(extendBlockDataTo(extB, 45.8) === false, 'si ya llega no hace nada');
const extM = { id: 'cbEM', start: 0, duration: 2, actions: { poseTestChar: { action: 'walk', move: { from: { x: 0, z: 0 }, to: { x: 6, z: 8 }, speed: 2.5 } } } };
assert(extendBlockDataTo(extM, 10) === true && extM.duration === 10, 'move también se estira');
assert(Math.abs(extM.actions.poseTestChar.move.speed - 1) < 1e-9, 'al estirar adapta la velocidad');

// --- reproducción con solo bloques (sin tomas): siempre funciona --- (RF-22)
// La duración cubre los bloques y el play no se niega aunque no haya tomas.
const { playScene, stopScene, sceneDuration } = await import(pathToFileURL('./js/cinema/timeline.js'));
setCharBlocks([
  { id: 'cbS1', start: 0, duration: 3, actions: { poseTestChar: { action: 'talk', pos: [1, 0, 2], rotY: 0 } } },
  { id: 'cbS2', start: 5, duration: 4, actions: { poseTestChar: { action: 'idle', pos: [7, 0, 8], rotY: 1.5 } } }
], {});
assert(sceneDuration() >= 9, 'duración cubre los bloques aunque no haya tomas');
assert(playScene() === true, 'reproduce con solo bloques de personajes');
stopScene();
setCharBlocks([], {});

// --- dolly dentro de la toma: interpola inicio→fin en el plano --- (RF-22)
const { shotDollyAt, applyShotDolly } = await import(pathToFileURL('./js/cinema/cinematics.js'));
const { timeline } = await import(pathToFileURL('./js/state.js'));
const { camera, controls } = await import(pathToFileURL('./js/core.js'));
const dollyShot = { id: 'shotD', start: 2, duration: 4, camMode: 'free', camPos: [0, 2, 8], target: [0, 1, 0], camPosEnd: [0, 1, 3], targetEnd: [0, 1, 0] };
assert(shotDollyAt(dollyShot, 2).pos[2] === 8, 'dolly: arranca en el encuadre inicial');
assert(Math.abs(shotDollyAt(dollyShot, 4).pos[2] - 5.5) < 1e-9, 'dolly: a mitad viaja a mitad');
assert(shotDollyAt(dollyShot, 6).pos[2] === 3, 'dolly: termina en el encuadre final');
assert(shotDollyAt(dollyShot, 99).pos[2] === 3, 'dolly: pasado el fin se queda');
assert(shotDollyAt({ ...dollyShot, camPosEnd: undefined }, 4) === null, 'sin fin no hay movimiento');
const savedCamD = camera.position.clone();
const savedTgtD = controls.target.clone();
applyShotDolly(dollyShot, 4);
assert(Math.abs(camera.position.z - 5.5) < 1e-6, 'applyShotDolly mueve la cámara');
camera.position.copy(savedCamD);
controls.target.copy(savedTgtD);
timeline.shots.push({ id: 'shotDollySer', start: 0, duration: 2, camMode: 'free', subjectId: null, camPos: [0, 0, 0], target: [0, 0, 0], camPosEnd: [1, 1, 1], targetEnd: [0, 0, 0], label: '', color: '#111' });
const serD = serializeProject().timeline.shots.find(s => Array.isArray(s.camPosEnd));
assert(!!serD && serD.camPosEnd[0] === 1, 'dolly persiste en el JSON');
timeline.shots.splice(timeline.shots.findIndex(s => s.id === 'shotDollySer'), 1);

// --- audio por escena: metadata chica en snapshots, data solo al guardar --- (RF-42)
const { audioTracks, serializeAudioTracks, setAudioTracks, clearAudio } = await import(pathToFileURL('./js/media/audio.js'));
const { audioBus } = await import(pathToFileURL('./js/state.js'));
setAudioTracks([{ id: 'audio1', name: 'tema', kind: 'music', volume: 70, start: 2, loop: true }]);
assert(audioTracks.length === 1 && audioTracks[0].loop === true, 'audio: pista registrada');
const snapAudio = serializeProject();
assert(Array.isArray(snapAudio.audio) && snapAudio.audio[0].name === 'tema', 'audio: metadata en el snapshot');
assert(snapAudio.audioData === undefined, 'audio: sin dataURLs en el snapshot del undo');
assert(JSON.stringify(serializeAudioTracks(false)).includes('dataURL') === false, 'audio: serialize sin datos no expone nada binario');
assert(Array.isArray(audioBus.getExportTracks()) && audioBus.getExportTracks().length === 0, 'audio: sin destino hasta que suene algo (Node)');
clearAudio();
assert(audioTracks.length === 0, 'audio: limpiar deja cero pistas');

// --- reloj fijo de exportación: pasos de 1/30 s sobre tiempo real --- (RF-43)
const { SIM_STEP, simClock, consumeSimTime } = await import(pathToFileURL('./js/media/recorder.js'));
assert(Math.abs(SIM_STEP - 1 / 30) < 1e-12, 'paso fijo de 1/30 s');
simClock.acc = 0;
assert(consumeSimTime(1 / 30, 1, false) === 1 && Math.abs(simClock.acc) < 1e-9, 'un frame = un paso');
simClock.acc = 0;
assert(consumeSimTime(0.1, 1, false) === 3, 'drop de 0.1s = 3 pasos (sin salto)');
simClock.acc = 0;
assert(consumeSimTime(1 / 30, 2, false) === 2, 'rate 2x duplica los pasos');
simClock.acc = 0;
assert(consumeSimTime(10, 1, false) === 4 && simClock.acc === 0, 'tope anti-espiral: 4 pasos y lastre fuera');
simClock.acc = 0.02;
assert(consumeSimTime(1 / 60, 1, true) === 0 && Math.abs(simClock.acc - 0.02) < 1e-12, 'pausa congela el reloj');

// --- spawn en el centro de la vista (donde mira la cámara) --- (RF-51)
const { viewCenterGround } = await import(pathToFileURL('./js/core.js'));const vc = viewCenterGround();
assert(Number.isFinite(vc.x) && Number.isFinite(vc.z), 'centro de vista: punto finito sobre el piso');
const savedPos = camera.position.clone();
const savedTgt = controls.target.clone();
controls.target.set(3, 0.5, 4);
camera.position.set(3, 2, 4);
camera.lookAt(3, 2, 30); // rayo horizontal: el piso nunca se cruza
const vcH = viewCenterGround();
assert(Math.abs(vcH.x - 3) < 1e-6 && Math.abs(vcH.z - 4) < 1e-6, 'horizonte: usa el objetivo como reserva');
camera.position.copy(savedPos);
controls.target.copy(savedTgt);

// --- escala única de la timeline: todas las pistas dibujan igual --- (RF-24)
const { pxPerSec, LANE_LABEL_W } = await import(pathToFileURL('./js/cinema/tlScale.js'));
assert(Number.isFinite(LANE_LABEL_W) && LANE_LABEL_W >= 200, 'rótulo único alineado al panel (>=200px)');
const savedDuration = timeline.duration;
timeline.duration = 9;
assert(Math.abs(pxPerSec() - Math.max(1, (1280 - LANE_LABEL_W) / 20)) < 1e-9, 'escala única: tramos cortos usan 20s');
timeline.duration = 40;
assert(Math.abs(pxPerSec() - Math.max(1, (1280 - LANE_LABEL_W) / 40)) < 1e-9, 'escala única: cubre la duración real');
timeline.duration = savedDuration;

// --- paquetes de datos: la red es un grafo conexo (suben por las bajadas) --- (RF-35)
const { trayGraph } = await import(pathToFileURL('./js/office/packets.js'));
const tgraph = trayGraph();
assert(tgraph.edges.length > 0, 'grafo de canaletas con aristas');
const nearNode = (x, z, y) => tgraph.nodes.filter(n => Math.hypot(n.x - x, n.z - z) < 0.15 && Math.abs(n.y - y) < 0.6);
const degreeAt = (x, z, y) => nearNode(x, z, y).reduce((m, n) => m + n.edges.length, 0);
assert(degreeAt(-13.5, -10.82, 3.55) >= 3, 'rack sube a la norte (riser + principal + oeste)');
assert(degreeAt(-13.5, -10.82, 2.48) >= 2, 'riser empalma con el tramo del rack (sin rebote)');
assert(degreeAt(14.84, -9.45, 3.55) >= 2, 'bajada al mini rack conectada');
const risers = tgraph.edges.filter(e => Math.abs(e.y2 - e.y1) > 0.5);
assert(risers.length >= 8, 'bajadas verticales en el grafo (racks, mini rack, piso, jefe, foto, 3 norte)');
assert(tgraph.edges.every(e => isFinite(e.len) && e.len >= 0.05), 'sin aristas degeneradas');

// --- Fase 3: resize por bordes + tiling (baldosas, no estirado) --- (RF-31)
const { addConFloor, setConFloorSize, resizeConFloor, addConWall, retileConWall, clearConstruction, syncConstruction } = await import(pathToFileURL('./js/construction.js'));
const { getWallTexture } = await import(pathToFileURL('./js/office/walls.js'));
const tFloor = addConFloor(0, 0, 6, 6, 'Losa de cemento');
setConFloorSize(tFloor, 10, 4);
assert(tFloor.userData.floorData.w === 10 && tFloor.userData.floorData.d === 4, 'piso: cambia w/d');
assert(Math.abs(tFloor.userData.floorMesh.geometry.parameters.width - 10) < 1e-9, 'piso: reconstruye el plano');
assert(Math.abs(tFloor.userData.floorMesh.material.map.repeat.x - 5) < 1e-9 && Math.abs(tFloor.userData.floorMesh.material.map.repeat.y - 2) < 1e-9, 'piso: baldosas de 2m (repeat 5x2)');
resizeConFloor(tFloor, 8, 8, 1, 1);
assert(tFloor.position.x === 1 && tFloor.position.z === 1 && tFloor.userData.floorData.w === 8, 'piso: resize mueve centro + tamaño');
const tWall = addConWall(20, 20, 0, 4, 3, 0.15, 'solid', 'Ladrillo');
const tMap = tWall.userData.wallMesh.material.map;
assert(Math.abs(tMap.repeat.x - 6) < 1e-9 && Math.abs(tMap.repeat.y - 1.5) < 1e-9, 'pared: baldosas según tamaño (6x1.5)');
assert(tMap !== getWallTexture('Ladrillo'), 'pared: clon propio (no toca la compartida)');
tWall.userData.wallData.w = 8;
tWall.userData.wallMesh.scale.x = 8;
retileConWall(tWall);
assert(Math.abs(tWall.userData.wallMesh.material.map.repeat.x - 12) < 1e-9, 'al agrandar se agregan baldosas (12)');
const serCon = serializeProject().construction.find(c => c.id === tWall.userData.conId);
assert(!!serCon && serCon.w === 8 && serCon.tex === 'Ladrillo', 'resize persiste (tamaño + textura)');

// --- Fase 4: puertas y ventanas sobre paredes (huecos que se abren/cierran) --- (RF-31)
const { addConDoor, addConWindow, attachOpeningToWall } = await import(pathToFileURL('./js/construction.js'));
const { wallSnap } = await import(pathToFileURL('./js/office/walls.js'));
const tW = addConWall(30, 30, 0, 6, 3, 0.15, 'solid', 'Cemento');
const tD = addConDoor(30, 30.1, 0, 1.4);
attachOpeningToWall(tD, tW);
assert(tW.userData._wallHoleSegments && tW.userData._wallHoleSegments.length > 0, 'puerta pegada abre su hueco');
assert(tW.userData.wallMesh.visible === false, 'puerta pegada oculta el panel original');
assert(tD.userData._attachedWall === tW, 'puerta registra su pared');
const serDoor = serializeProject().construction.find(c => c.id === tD.userData.conId);
assert(!!serDoor && serDoor.wall === tW.userData.conId, 'puerta guarda su pared en el JSON');
attachOpeningToWall(tD, null);
assert(!tW.userData._wallHoleSegments && tW.userData.wallMesh.visible === true, 'al soltar se restaura la pared');
const tWn = addConWindow(30, 30.1, 0, 2, 1.6);
attachOpeningToWall(tWn, tW);
assert(tW.userData._wallHoleSegments && tW.userData._wallHoleSegments.length > 0, 'ventana pegada abre su hueco');
attachOpeningToWall(tWn, null);
assert(!tW.userData._wallHoleSegments && tW.userData.wallMesh.visible === true, 'al soltar ventana se restaura (sin crash)');
const snapD = wallSnap(tD, { x: 30, y: 0, z: 30.3 });
assert(!!snapD && snapD.attached === true, 'puerta con imán a pared cercana');
const snapFar = wallSnap(tD, { x: 30, y: 0, z: 35 });
assert(!!snapFar && snapFar.attached === false, 'puerta lejos no se pega');
attachOpeningToWall(tD, tW);
syncConstruction(serializeProject().construction);
const reWall = interactiveRegistry.get(tW.userData.conId);
assert(reWall && reWall.group.userData._wallHoleSegments && reWall.group.userData._wallHoleSegments.length > 0, 'al abrir se restaura el hueco');

// --- Fase 5: diseños de puertas y ventanas --- (RF-31)
const { addDoor, setDoorDesign, setDoorState, createWindow, setWindowDesign, DOOR_DESIGNS, WINDOW_DESIGNS } = await import(pathToFileURL('./js/office/walls.js'));
assert(DOOR_DESIGNS.length === 3 && WINDOW_DESIGNS.length === 3, '3 diseños de puerta y 3 de ventana');
const dGlass = addDoor('tDoorGlass', 'Puerta Vidrio', 40, 40, 0, 1.4);
assert(dGlass.userData.doorData.design === 'vidrio', 'diseño de puerta por defecto: vidrio');
const dWood = addDoor('tDoorWood', 'Puerta Madera', 42, 40, 0, 1.4, undefined, 'madera');
assert(dWood.userData.doorData.design === 'madera', 'puerta de madera');
setDoorState(dWood, 'abierto');
assert(Math.abs(dWood.userData.doorGroup.rotation.y - 1.95) < 1e-9, 'la hoja de madera abre');
const dDouble = addDoor('tDoorDouble', 'Puerta Doble', 44, 40, 0, 1.6, undefined, 'doble');
setDoorState(dDouble, 'abierto');
assert(Math.abs(dDouble.userData.doorLeaves[0].rotation.y + 1.95) < 1e-9 && Math.abs(dDouble.userData.doorLeaves[1].rotation.y - 1.95) < 1e-9, 'doble hoja abre en espejo');
setDoorDesign(dWood, 'doble');
assert(dWood.userData.doorData.design === 'doble' && Array.isArray(dWood.userData.doorLeaves), 'cambio de diseño reconstruye');
const wCl = createWindow('tWinCl', 'Ventana Cl', 40, 2.1, 46, 0, 2, 1.6);
assert(wCl.userData.windowData.design === 'clasica' && wCl.children.length === 7, 'ventana clásica (marco + travesaño + alféizar)');
const wPa = createWindow('tWinPa', 'Ventana Pa', 44, 2.1, 46, 0, 2, 1.6, undefined, 'panoramica');
assert(wPa.children.length === 5, 'panorámica sin travesaño ni alféizar');
setWindowDesign(wCl, 'persiana');
assert(wCl.userData.windowData.design === 'persiana' && wCl.children.length > 7, 'persiana agrega lamas');
const dCon = addConDoor(50, 50, 0, 1.4, null, null, 'madera');
const serDD = serializeProject().construction.find(c => c.id === dCon.userData.conId);
assert(!!serDD && serDD.design === 'madera', 'diseño de puerta persiste en el JSON');
clearConstruction();

// --- convención de orientación (blindaje anti "dados vuelta") --- (RF-15)
const { rotYToLookAt } = await import(pathToFileURL('./js/characters/characters.js'));
const approx = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;
const deg = (r) => r * 180 / Math.PI;
assert(approx(rotYToLookAt(0, 0, 0, 1), 0), 'orientación: rotY=0 mira al SUR (+z)');
assert(approx(rotYToLookAt(0, 0, 0, -1), Math.PI), 'orientación: rotY=π mira al NORTE (-z)');
assert(approx(rotYToLookAt(0, 0, 1, 0), Math.PI / 2), 'orientación: rotY=+π/2 mira al ESTE (+x)');
assert(approx(rotYToLookAt(0, 0, -1, 0), -Math.PI / 2), 'orientación: rotY=-π/2 mira al OESTE (-x)');
// Casos reales del código: human1 (-π/2 mira oeste), human5 (0 mira sur), perro (π mira... sur)
assert(deg(rotYToLookAt(2.7, 0.3, -1.1, -1.0)) < -80 && deg(rotYToLookAt(2.7, 0.3, -1.1, -1.0)) > -120, 'orientación: human1→escritorio da oeste (como el código)');

const { newProject } = await import(pathToFileURL('./js/projectFiles.js'));
const { areDefaultCharactersHidden } = await import(pathToFileURL('./js/characters/characters.js'));
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

// --- creador: outfit + accesorios persisten en el personaje --- (RF-10)
addHumanCharacter('customChar2', 'Chef Test', 1, 1, 0, { outfit: 'chef', sunglasses: true, femaleHair: true });
const withOutfit = serializeProject();
const serChef = withOutfit.characters.find(c => c.id === 'customChar2');
assert(!!serChef && serChef.colors.outfit === 'chef' && serChef.colors.sunglasses === true, 'outfit y accesorios del personaje serializados');

// --- mascotas del creador: 3 variantes de perro y 3 de gato --- (RF-10)
const { DOG_VARIANTS, CAT_VARIANTS, addDogCharacter, addCatCharacter, createDogPreview, createCatPreview } = await import(pathToFileURL('./js/characters/characters.js'));
assert(DOG_VARIANTS.length === 3 && CAT_VARIANTS.length === 3, '3 variantes de perro y 3 de gato');
const petDog = addDogCharacter('petDog1', 'Firulais Test', 1, 1, 0, DOG_VARIANTS[1].colors);
const petDogEntry = interactiveRegistry.get('petDog1');
assert(petDogEntry && petDogEntry.type === 'pet', 'perro agregado como mascota');
assert(petDogEntry.group.userData.customCharacter.pet === 'dog', 'perro guarda su especie');
assert(Math.abs(petDogEntry.group.position.y - 0.05) < 1e-6, 'perro apoyado en el piso');
const petCat = addCatCharacter('petCat1', 'Mishi Test', 2, 2, 0, CAT_VARIANTS[2].colors);
const petCatEntry = interactiveRegistry.get('petCat1');
assert(petCatEntry && petCatEntry.type === 'pet', 'gato agregado como mascota');
assert(petCatEntry.group.userData.customCharacter.pet === 'cat', 'gato guarda su especie');
// La vista previa no registra en la escena
const THREE_MOD = await import('three');
const prevParent = new THREE_MOD.Group();
createDogPreview('prevDog', 'Previa', DOG_VARIANTS[0].colors, prevParent);
createCatPreview('prevCat', 'Previa', CAT_VARIANTS[0].colors, prevParent);
assert(!interactiveRegistry.has('prevDog') && !interactiveRegistry.has('prevCat'), 'preview de mascotas no registra');
// Las mascotas viajan en el JSON con especie y colores
const withPets = serializeProject();
const serDog = withPets.characters.find(c => c.id === 'petDog1');
const serCat = withPets.characters.find(c => c.id === 'petCat1');
assert(!!serDog && serDog.pet === 'dog' && serDog.colors.fur === DOG_VARIANTS[1].colors.fur, 'perro serializado con variante');
assert(!!serCat && serCat.pet === 'cat' && serCat.colors.fur === CAT_VARIANTS[2].colors.fur, 'gato serializado con variante');

// --- transiciones suaves: la pose interpola 0.3s al cambiar de acción --- (RF-14)
const blendRig = addHumanCharacter('blendTestChar', 'Blend Test', 5, 5, 0, {});
blendRig.run(10); // idle estable
blendRig.setAction('sit');
assert(blendRig._blendFrom instanceof Map, 'blending: foto de la pose al cambiar');
blendRig.run(10.15); // mitad de la mezcla
const midLeg = blendRig.parts.h_legL.rotation.x;
assert(midLeg < -0.1 && midLeg > -Math.PI / 2, 'blending: a mitad camino entre idle y sit');
assert(Math.abs(blendRig.root.position.x - 5) < 1e-9, 'blending: no mueve la raíz');
blendRig.run(10.31); // mezcla terminada
assert(blendRig._blendFrom === null, 'blending: termina a los 0.3s');
assert(Math.abs(blendRig.parts.h_legL.rotation.x - (-Math.PI / 2)) < 1e-6, 'blending: pose final exacta');
blendRig.setAction('sit');
assert(blendRig._blendFrom === null, 'blending: repetir acción no mezcla');
const blendDog = addDogCharacter('blendDog', 'Blend Perro', 6, 6, 0, DOG_VARIANTS[0].colors);
blendDog.run(10);
blendDog.setAction('sit');
blendDog.run(10.15);
const midBody = blendDog.parts.d_body.position.y;
assert(midBody < 0.65 && midBody > 0.44, 'blending perro: interpola el cuerpo');

// --- sentarse en asiento (sit_at): evento con silla + ancla --- (RF-13)
const { sitAtAnchor } = await import(pathToFileURL('./js/characters/characters.js'));
const { anchorPose, anchorSeats } = await import(pathToFileURL('./js/characters/anchors.js'));
const sitRig = addHumanCharacter('sitTestChar', 'Sit Test', 2, 2, 0, {});
// El evento del waypoint guarda la silla elegida junto a la acción
const sitPose = anchorPose('seat_chair1');
assert(!!sitPose, 'ancla de asiento registrada (seat_chair1)');
assert(sitAtAnchor(sitRig, 'seat_chair1', { instant: true }) === true, 'sitAtAnchor instant coloca directo');
assert(Math.abs(sitRig.root.position.x - sitPose.x) < 1e-6 && Math.abs(sitRig.root.position.z - sitPose.z) < 1e-6, 'personaje en la pose del asiento');
// Gira 180° respecto de la silla: mirando HACIA EL FRENTE (respaldo atrás)
const chairEntry = interactiveRegistry.get('chair1');
const expectedRot = chairEntry.group.rotation.y + Math.PI;
assert(Math.abs(sitRig.root.rotation.y - expectedRot) < 1e-6, 'sentado mirando al frente de la silla (rotY + 180°)');
assert(sitRig.currentAction === 'sit', 'sentado tras sitAtAnchor instant');
assert(sitAtAnchor(sitRig, 'seat_inexistente_xyz') === false, 'sitAtAnchor devuelve false con ancla inexistente');
// Sillón de 2 cuerpos: 2 lugares con offsets laterales
const sofaSeats = anchorSeats('seat_sofa1');
assert(sofaSeats.length === 2, 'sillón verde de 2 cuerpos ofrece 2 lugares');
assert(Math.hypot(sofaSeats[0].x - sofaSeats[1].x, sofaSeats[0].z - sofaSeats[1].z) > 0.1, 'los 2 lugares del sillón están separados');
// Spot 1 = segundo lugar
assert(sitAtAnchor(sitRig, 'seat_sofa1', { instant: true, spot: 1 }) === true, 'sitAtAnchor con spot 1 (segundo cuerpo)');
assert(Math.abs(sitRig.root.position.x - sofaSeats[1].x) < 1e-6 && Math.abs(sitRig.root.position.z - sofaSeats[1].z) < 1e-6, 'sentado en el lugar 2 del sillón');
// Serialización: el evento sit_at guarda la silla (sitAt) en el recorrido
cinemaPaths.set('sitTestChar', {
  waypoints: [new (await import('three')).Vector3(2, 0, 2), new (await import('three')).Vector3(4, 0, 2)],
  planeY: 0, events: { '1': { action: 'sit_at', sitAt: 'chair1', wait: 0 } }
});
const withSit = serializeProject();
const sitEv = withSit.paths['sitTestChar'].events['1'];
assert(!!sitEv && sitEv.action === 'sit_at' && sitEv.sitAt === 'chair1', 'evento sit_at serializa la silla elegida');

 	// --- sentarse: altura del asiento por tipo de silla (mejoras_gemini.md) ---
 	// seatY = superficie REAL de apoyo (tope del cojín/almohadón), no el plano
 	// del asiento: así los muslos (a +0.48 del origen) apoyan exacto arriba.
 	const chairSeat = anchorSeats('seat_chair1')[0];
 const execSeat = anchorSeats('seat_execChair')[0];
 const guestSeat = anchorSeats('seat_guestChair')[0];
 const sofaSeat = anchorSeats('seat_sofa1')[0];
 const chestSeat = anchorSeats('seat_bossSofa1')[0];
 assert(chairSeat && Math.abs(chairSeat.seatY - 0.52) < 0.02, 'seatY silla comedor ≈ 0.52 (tope del asiento)');
 assert(execSeat && Math.abs(execSeat.seatY - 0.65) < 0.02, 'seatY silla gerencia ≈ 0.65 (tope del almohadón)');
 assert(guestSeat && Math.abs(guestSeat.seatY - 0.54) < 0.02, 'seatY invitado ≈ 0.54');
 assert(sofaSeat && Math.abs(sofaSeat.seatY - 0.49) < 0.02, 'seatY sillón verde ≈ 0.49 (tope del cojín)');
 assert(chestSeat && Math.abs(chestSeat.seatY - 0.53) < 0.02, 'seatY chesterfield ≈ 0.53 (tope del cojín)');
 // El descenso usa la fórmula física seatY - 0.48: en gerencia, 0.65 - 0.48
 // = 0.17 → muslos exactamente sobre el almohadón de cuero.
 const sitTest2 = addHumanCharacter('sitTest2', 'Sit Test 2', 0, 0, 0, {});
 sitAtAnchor(sitTest2, 'seat_execChair', { instant: true });
 assert(Math.abs(sitTest2.root.position.y - (0.65 - 0.48)) < 0.02, 'sentado en gerencia: muslos sobre el almohadón (y = 0.17)');

// --- personajes de pie junto a muebles: uso del frente del ancla --- (RF-13)
const { standInFrontOf, standFacing } = await import(pathToFileURL('./js/characters/characters.js'));
const standTest = addHumanCharacter('standTestChar', 'Test Frente', 0, 0, 0, {});
assert(standInFrontOf(standTest, 'kitchenCounter'), 'se ubica frente al mueble');
const counterEntry = interactiveRegistry.get('kitchenCounter');
const dx = standTest.root.position.x - counterEntry.group.position.x;
const dz = standTest.root.position.z - counterEntry.group.position.z;
assert(Math.hypot(dx, dz) > 0.25 && Math.hypot(dx, dz) < 1.6, 'frente al mueble a distancia razonable (no adentro)');
assert(standTest.root.position.y === 0, 'en piso, no flotando');
// Y mira hacia el mueble (no le da la espalda)
const facing = standTest.root.rotation.y;
const expectRot = Math.atan2(counterEntry.group.position.x - standTest.root.position.x,
                             counterEntry.group.position.z - standTest.root.position.z);
assert(Math.abs(facing - expectRot) < 0.05, 'mirando hacia el mueble (no le da la espalda)');
assert(standFacing(standTest, -5.0, 8.5, 0.55, 0), 'standFacing se ajusta igualmente');

// --- ✕ de la toma = commit: cinemática activa se guarda al cerrar --- (RF-22)
// (El ✕ de una toma seleccionada llama clearSelection, que hace cinemaDeactivate
// cuando hay un recorrido en edición — así la cinemática grabada de principio
// a fin queda guardada y se reproduce con la escena.)
const { cinema } = await import(pathToFileURL('./js/state.js'));
const { cinemaActivate, cinemaDeactivate } = await import(pathToFileURL('./js/cinema/cinematics.js'));
const cineChar = addHumanCharacter('cineCommitChar', 'Commit Test', 0, 0, 0, {});
store.activeTarget = 'cineCommitChar';
cinemaActivate();
assert(cinema.active === true, 'cinemática activada (modo edición de recorrido)');
cinema.targetId = 'cineCommitChar';
cinema.waypoints = [new (await import('three')).Vector3(0, 0, 0), new (await import('three')).Vector3(2, 0, 0)];
cinemaDeactivate(); // lo mismo que ejecuta el 💾 de la toma (via clearSelection)
assert(cinema.active === false, 'al 💾 de la toma: modo cinemático liberado');
assert(cinemaPaths.has('cineCommitChar') && cinemaPaths.get('cineCommitChar').waypoints.length === 2,
  'al 💾 de la toma: recorrido quedo guardado (se reproduce en la escena)');

// --- ✕ DESCARTA: el snapshot restaura el bloque modificado --- (RF-03)
// (discardSelection usa el mismo mecanismo: Object.assign sobre el snapshot)
const shotDiscard = { id: 'shotX', start: 1, duration: 2, camMode: 'free', subjectId: null, label: '', color: '#111' };
const snapDiscard = JSON.parse(JSON.stringify(shotDiscard));
shotDiscard.start = 9; shotDiscard.duration = 5; shotDiscard.camMode = 'top';
Object.assign(shotDiscard, JSON.parse(JSON.stringify(snapDiscard)));
assert(shotDiscard.start === 1 && shotDiscard.duration === 2 && shotDiscard.camMode === 'free',
  '✕ de la toma: el snapshot restaura el bloque modificado');

// --- Escena estática / diálogo (reunion_prioridades_jefe) --- (RF-22)
const fs = await import('fs');
const reunionJson = JSON.parse(fs.readFileSync('scenes/reunion_prioridades_jefe.json', 'utf8'));
applyProject(reunionJson);

const boss = interactiveRegistry.get('human2');
const alex = interactiveRegistry.get('human1');
const elena = interactiveRegistry.get('human3');

// En t = 3.9s (el timestamp de la captura del usuario):
evaluateAllPathsAt(3.9);
assert(Math.abs(boss.group.position.x - (-9.0)) < 0.05, 'jefe en x=-9.0 en t=3.9s');
// Ley de suelo sólido (mejoras_gemini.md): sentado en la silla de gerencia
// el jefe queda a Y = seatY - 0.48 = 0.65 - 0.48 = 0.17 — muslos exactamente
// sobre el almohadón de cuero (antes: 0.06, hundido 11 cm en el cojín).
assert(Math.abs(boss.group.position.y - 0.17) < 0.02, 'jefe sobre el almohadón (y = 0.17, no hundido)');
assert(Math.abs(boss.group.position.z - 9.6) < 0.05, 'jefe en z=9.6 en t=3.9s');
assert(Math.abs(boss.group.rotation.y - Math.PI) < 0.05, 'jefe mira al NORTE (PI) hacia el escritorio, no al oeste');
assert(boss.rig.currentAction === 'sit', 'jefe en pose sit en t=3.9s');

// Alex y Elena en t = 3.9s
assert(Math.abs(alex.group.rotation.y - (-0.28)) < 0.05, 'Alex mira hacia el jefe');
assert(Math.abs(elena.group.rotation.y - 0.28) < 0.05, 'Elena mira hacia el jefe');

// En t = 6.0s el jefe habla SENTADO (sit_talk): boca activa y sin pararse
evaluateAllPathsAt(6.0);
boss.rig.run(0.1);   // un frame de animación: la boca ya abierta en ese t
assert(boss.rig.currentAction === 'sit_talk', 'jefe hablando sentado (sit_talk) en t=6.0s');
assert(Math.abs(boss.group.position.y - 0.17) < 0.02, 'jefe sigue sobre el almohadón mientras habla (y = 0.17)');
assert(boss.rig.parts.h_mouth.scale.y > 1.0, 'lip-sync del jefe activo hablando sentado');

// Turnos de palabra con lanes continuas (sin huecos): cada personaje tiene
// su acción visible TODO el tiempo. Alex habla 9.4→15.8 y 28.6→32.4; Elena
// 16.2→22.4 y 32.7→36.2; el jefe alterna sit/sit_talk en cada parlamento.
evaluateAllPathsAt(12.0);
assert(alex.rig.currentAction === 'talk', 'Alex habla en su turno (t=12, bloque 9.4→15.8)');
assert(elena.rig.currentAction === 'idle', 'Elena aún no habla en t=12 (espera su turno, de pie)');
assert(boss.rig.currentAction === 'sit', 'jefe sentado mientras Alex habla');
evaluateAllPathsAt(18.0);
assert(alex.rig.currentAction === 'idle', 'Alex terminó su parlamento: de pie (t=18)');
assert(elena.rig.currentAction === 'talk', 'Elena habla en su turno (t=18, bloque 16.2→22.4)');
assert(boss.rig.currentAction === 'sit', 'jefe sentado mientras Elena habla');
evaluateAllPathsAt(34.0);
assert(elena.rig.currentAction === 'talk', 'Elena habla en su 2º turno (t=34, bloque 32.7→36.2)');
assert(alex.rig.currentAction === 'idle', 'Alex de pie mientras Elena habla (t=34)');
assert(boss.rig.currentAction === 'sit', 'jefe sentado mientras Elena habla (t=34)');
// Y en el turno del jefe, Alex también había vuelto a la base
evaluateAllPathsAt(6.0);
assert(alex.rig.currentAction === 'idle', 'Alex no habla en el turno del jefe (t=6)');
// Cierre: Alex remata sobre el perro (bloque 39.6→45.2, subtítulo 40→44.8)
evaluateAllPathsAt(42.0);
assert(alex.rig.currentAction === 'talk', 'Alex habla en el cierre sobre el perro (t=42)');
assert(boss.rig.currentAction === 'sit', 'jefe callado mientras Alex remata (t=42)');
const lastSub = reunionJson.subtitles[reunionJson.subtitles.length - 1];
assert(lastSub.text.startsWith('Alex:') && lastSub.text.includes('heladera'),
  'último subtítulo (perro/heladera) atribuido a Alex');

// Ley del piso en la evaluación: los personajes de PIE no se hunden (su
// origen queda en rig.groundY, pies apoyados) — antes el JSON con y=0 los
// enterraba cada frame.
evaluateAllPathsAt(0);
assert(alex.group.position.y >= (alex.rig.groundY || 0) - 1e-6, 'Alex apoya los pies (y >= groundY, no hundido)');
assert(elena.group.position.y >= (elena.rig.groundY || 0) - 1e-6, 'Elena apoya los pies (y >= groundY, no hundida)');

// --- Imán de alineación entre pistas (tlSnap) --- (RF-23)
// La toma de cámara que muestra a un personaje debe arrancar EXACTO cuando
// él empieza a hablar: al arrastrar la toma cerca del borde del bloque de
// talk, el imán los deja coincidiendo (0.1s de paso, radio ~8px).
const { collectTimelineSnapTimes, snapTimeToRefs } = await import(pathToFileURL('./js/cinema/tlSnap.js'));
const refsTalk = collectTimelineSnapTimes();
assert(refsTalk.includes(9.4), 'imán: el inicio del talk de Alex (9.4) es una referencia');
assert(refsTalk.includes(16.2), 'imán: el inicio del talk de Elena (16.2) es una referencia');
// A 0.05s de la referencia (dentro del radio) → se pega exacto
let snapped = snapTimeToRefs(9.35, 0.1, refsTalk);
assert(Math.abs(snapped - 9.4) < 1e-6, 'imán: cerca del borde se alinea exacto');
// Lejos (0.5s) no fuerza: solo redondea al paso 0.1
snapped = snapTimeToRefs(9.9, 0.1, refsTalk);
assert(Math.abs(snapped - 9.9) < 1e-6, 'imán: lejos de referencias no se fuerza (solo paso 0.1)');
// La escena quedó sincronizada: la toma frontal de cada personaje arranca
// con SU bloque de talk (caso "cámara enfoca → ya está hablando")
const tShots = reunionJson.timeline.shots;
const bossTalks = reunionJson.charBlocks.filter(b => b.actions.human2 && b.actions.human2.action === 'sit_talk');
const alexTalks = reunionJson.charBlocks.filter(b => b.actions.human1 && b.actions.human1.action === 'talk');
tShots.filter(s => s.camMode === 'front').forEach(s => {
  const talks = s.subjectId === 'human2' ? bossTalks
    : s.subjectId === 'human1' ? alexTalks
    : s.subjectId === 'human3' ? reunionJson.charBlocks.filter(b => b.actions.human3 && b.actions.human3.action === 'talk')
    : [];
  const match = talks.find(b => Math.abs(b.start - s.start) < 1e-6);
  assert(!!match || s.subjectId === 'dog',
    `toma frontal de ${s.subjectId} arranca exacto con su bloque de habla (${s.start}s)`);
});

console.log('✓ escena de diálogo: jefe y empleados mantienen posición, orientación y pose sin derivar');

// --- alarma (escena vieja): cada línea llega quieta hasta el fin del clip --- (RF-36)
const alarmaJson = JSON.parse(fs.readFileSync('scenes/alarma_en_la_red.json', 'utf8'));
applyProject(alarmaJson);
const laneEnd = (charId) => Math.max(...charBlocks.filter(b => b.actions[charId]).map(b => b.start + b.duration));
assert(Math.abs(laneEnd('human1') - 45.8) < 0.05, 'Alex llega hasta el final');
assert(Math.abs(laneEnd('human2') - 45.8) < 0.05, 'Carlos llega hasta el final');
assert(Math.abs(laneEnd('human3') - 45.8) < 0.05, 'Elena llega hasta el final');
assert(Math.abs(laneEnd('dog') - 45.8) < 0.05, 'perro llega hasta el final');
assert(Math.abs(laneEnd('cat') - 45.8) < 0.05, 'gato llega hasta el final');
// Carlos, perro y gato: bloques continuos desde 0 (sin huecos entre cambios)
['human2', 'dog', 'cat'].forEach(charId => {
  const ivals = charBlocks.filter(b => b.actions[charId])
    .map(b => [b.start, b.start + b.duration]).sort((x, y) => x[0] - y[0]);
  assert(ivals.length > 0 && Math.abs(ivals[0][0]) < 1e-6, `${charId} arranca en 0`);
  for (let i = 1; i < ivals.length; i++) {
    assert(Math.abs(ivals[i][0] - ivals[i - 1][1]) < 1e-6,
      `${charId} continuo: bloque arranca donde termina el anterior (${ivals[i - 1][1]}s)`);
  }
});
evaluateAllPathsAt(25);
assert(interactiveRegistry.get('human1').rig.currentAction === 'shoulder_carry', 'Alex vuelve con la escalera al hombro a los 25s (camina, no desliza)');
// La ida a buscar la escalera se ve en 3ra persona (en 1ra no se ven las piernas)
const shot165 = timeline.shots.find(s => Math.abs(s.start - 16.5) < 1e-6);
assert(!!shot165 && shot165.camMode === 'third' && shot165.subjectId === 'human1', 'ida por la escalera en 3ra persona (se lo ve correr)');
const { stepLadder } = await import(pathToFileURL('./js/office/group.js'));
assert(stepLadder.visible === false, 'escalera del piso oculta mientras Alex la lleva');
// Sin deslizamiento en idle al llegar: a los 29.4s sigue cargando y avanzando
const alexPos = () => interactiveRegistry.get('human1').group.position;
evaluateAllPathsAt(29.3);
const x293 = alexPos().x;
evaluateAllPathsAt(29.4);
assert(interactiveRegistry.get('human1').rig.currentAction === 'shoulder_carry', 'a los 29.4s aún carga (el bloque llega al fin del camino)');
assert(Math.abs(alexPos().x - x293) > 0.05, 'a los 29.4s sigue avanzando con pose de carga');
evaluateAllPathsAt(40);
assert(interactiveRegistry.get('human2').rig.currentAction === 'idle', 'Carlos parado a los 40s');
assert(interactiveRegistry.get('human3').rig.currentAction === 'idle', 'Elena parada a los 40s');
assert(interactiveRegistry.get('cat').rig.currentAction === 'lay', 'gato quieto a los 40s');
assert(stepLadder.visible === true && stepLadder.position.x > 13, 'escalera soltada junto a la heladera a los 40s');
console.log('✓ alarma: líneas completas y quietas hasta el fin del clip');

// --- undo con la aguja en t>0: base write-through (gizmo/sliders/menú) --- (RF-03)
const { syncBasePose } = await import(pathToFileURL('./js/state.js'));
applyProject(alarmaJson); // re-aplica alarma limpia (time=6.02, human1 en x=-9)
assert(timeline.time > 0, 'alarma abre con la aguja en t>0 (caso real del bug)');
const h1e = interactiveRegistry.get('human1');
const snapBefore = serializeProject();
assert(snapBefore.objects.human1.pos[0] === -9, 'base inicial de human1 es x=-9');
// Sin sync: la serialización en t>0 lee initialState y el arrastre no entra
h1e.group.position.x = -7.5;
let snapNoSync = serializeProject();
assert(snapNoSync.objects.human1.pos[0] === -9, 'sin syncBasePose el arrastre NO entra al snapshot (protegido)');
// Con sync (lo que hace gizmo.endDrag / sliders / menú antes del push):
syncBasePose(h1e);
let snapAfter = serializeProject();
assert(snapAfter.objects.human1.pos[0] === -7.5, 'syncBasePose escribe el arrastre en la base');
// undo: aplicar el snapshot previo restaura la posición original
applyProject(snapBefore);
assert(Math.abs(interactiveRegistry.get('human1').group.position.x + 9) < 1e-9, 'undo (apply del snapshot previo) restaura x=-9');
assert(interactiveRegistry.get('human1').initialState.pos[0] === -9, 'undo restaura initialState coherente');
// redo: aplicar el snapshot nuevo deja la posición editada
applyProject(snapAfter);
assert(Math.abs(interactiveRegistry.get('human1').group.position.x + 7.5) < 1e-9, 'redo (apply del snapshot nuevo) deja x=-7.5');
assert(interactiveRegistry.get('human1').initialState.pos[0] === -7.5, 'redo restaura initialState coherente');
// acción base: setAction + syncBasePose({action:true}) también entra al snapshot
const h1rig = interactiveRegistry.get('human1');
h1rig.rig.setAction('idle');
syncBasePose(h1rig, { action: true });
assert(serializeProject().objects.human1.action === 'idle', 'syncBasePose({action:true}) sincroniza la acción base');
console.log('✓ undo t>0: base write-through (posición y acción) entra al snapshot');

// --- anillo de selección: sigue al objetivo tras cualquier movimiento --- (RF-04)
const { updateSelectionRing, selectionRing, setActiveTarget } = await import(pathToFileURL('./js/ui/selection.js'));
addHumanCharacter('ringTestChar', 'Ring Test', 0, 0, 0, {});
setActiveTarget('ringTestChar');
const ringEntry = interactiveRegistry.get('ringTestChar');
ringEntry.group.position.set(7, 0.17, -3);
updateSelectionRing();
assert(selectionRing.visible === true, 'anillo visible con objetivo');
assert(Math.abs(selectionRing.position.x - 7) < 1e-9 && Math.abs(selectionRing.position.z + 3) < 1e-9, 'anillo sigue al grupo en XZ');
assert(Math.abs(selectionRing.position.y - 0.19) < 1e-9, 'anillo apoyado sobre el grupo');

// --- barra de bloques: selección, pin y acciones por pista --- (RF-53)
const { selectShot, getSelectedShot, resetShotToSnapshot, duplicateShot, deleteShot, openSubEditor, resetSubToSnapshot, duplicateSub, deleteSub } = await import(pathToFileURL('./js/cinema/timeline.js'));
const { openCharBlockEditor, charBlockSelection, resetCharBlock, deleteCharBlock } = await import(pathToFileURL('./js/cinema/charTrack.js'));
const { openQuizEditor, quizSelection, resetQuizBlock, duplicateQuizBlock, deleteQuizBlock } = await import(pathToFileURL('./js/cinema/quizTrack.js'));
const { subtitleTrack } = await import(pathToFileURL('./js/media/subtitles.js'));
const { quizTrack, togglePinBlock, pinMatches, blockPin } = await import(pathToFileURL('./js/state.js'));
const { getSelectedBlock, refreshBlockBar, deselectAllBlocks } = await import(pathToFileURL('./js/cinema/blockBar.js'));

// pin: helpers puros
const pinRef = { id: 'x' };
assert(togglePinBlock('shot', pinRef) === true && pinMatches('shot', pinRef), 'pin fija');
assert(togglePinBlock('shot', pinRef) === false && !pinMatches('shot', pinRef), 'pin suelta');

// tomas: seleccionar, duplicar, restablecer, pin bloquea, borrar
timeline.shots.length = 0;
timeline.shots.push({ id: 'shotBar1', start: 0, duration: 2, camMode: 'free', subjectId: null, label: '', color: '#111' });
selectShot('shotBar1');
assert(getSelectedBlock()?.kind === 'shot', 'barra ve la toma');
togglePinBlock('shot', getSelectedShot());
timeline.shots.push({ id: 'shotBar2', start: 2, duration: 2, camMode: 'free', subjectId: null, label: '', color: '#111' });
selectShot('shotBar2');
assert(getSelectedShot()?.id === 'shotBar1', 'con pin no cambia la selección');
togglePinBlock('shot', getSelectedShot());
selectShot('shotBar2');
assert(getSelectedShot()?.id === 'shotBar2', 'sin pin cambia');
const shotsBefore = timeline.shots.length;
assert(duplicateShot() === true && timeline.shots.length === shotsBefore + 1, 'duplica toma');
const dupShotBar = timeline.shots[timeline.shots.length - 1];
assert(dupShotBar.start === 4 && dupShotBar.camMode === 'free', 'copia idéntica al final');
const dupShot = timeline.shots.find(s => s.id !== 'shotBar1' && s.id !== 'shotBar2');
assert(!!dupShot && dupShot.start === 4 && dupShot.camMode === 'free', 'copia idéntica al final');
selectShot('shotBar1');
getSelectedShot().duration = 9;
assert(resetShotToSnapshot() === true && getSelectedShot().duration === 2, 'reset restaura snapshot');
assert(deleteShot() === true && !timeline.shots.find(s => s.id === 'shotBar1'), 'borra toma');
assert(getSelectedBlock() === null, 'sin selección al borrar');
timeline.shots.length = 0;
timeline.shots.length = 0;

// cuadros: seleccionar, restablecer, borrar (con pin bloquea)
setCharBlocks([{ id: 'cbBar1', start: 0, duration: 2, actions: { poseTestChar: { action: 'idle' } } }], {});
openCharBlockEditor(charBlocks.find(b => b.id === 'cbBar1'));
assert(getSelectedBlock()?.kind === 'char', 'barra ve el cuadro');
togglePinBlock('char', charBlockSelection());
openSubEditor(null);
assert(getSelectedBlock()?.kind === 'char', 'con pin no cambia ni a nulo');
togglePinBlock('char', charBlockSelection());
const cbBar = charBlockSelection();
cbBar.actions.poseTestChar.action = 'talk';
assert(resetCharBlock() === true && cbBar.actions.poseTestChar.action === 'idle', 'reset restaura cuadro');
assert(deleteCharBlock() === true && charBlockSelection() === null, 'borra cuadro');
setCharBlocks([], {});

// subtítulos y carteles: seleccionar, duplicar, restablecer, borrar
subtitleTrack.push({ start: 0, end: 2, text: 'Hola' });
const myCue = subtitleTrack[subtitleTrack.length - 1];
openSubEditor(myCue);
assert(getSelectedBlock()?.kind === 'sub', 'barra ve el subtítulo');
const subsBefore = subtitleTrack.length;
assert(duplicateSub() === true && subtitleTrack.length === subsBefore + 1, 'duplica subtítulo');
myCue.text = 'Cambiado';
assert(resetSubToSnapshot() === true && myCue.text === 'Hola', 'reset restaura subtítulo');
assert(deleteSub() === true && !subtitleTrack.includes(myCue), 'borra subtítulo');
quizTrack.push({ id: 'quizBar1', question: 'Q?', options: ['A', 'B', 'C'], correct: 0, duration: 10, start: 0, end: 10 });
const quizLenBefore = quizTrack.length;
const myQuiz = quizTrack[quizTrack.length - 1];
openQuizEditor(myQuiz);
assert(getSelectedBlock()?.kind === 'quiz', 'barra ve el cartel');
const quizBefore = quizTrack.length;
assert(duplicateQuizBlock() === true && quizTrack.length === quizBefore + 1, 'duplica cartel');
myQuiz.question = 'Cambiada';
assert(resetQuizBlock() === true && myQuiz.question === 'Q?', 'reset restaura cartel');
assert(deleteQuizBlock() === true && !quizTrack.includes(myQuiz), 'borra cartel');
quizTrack.length = quizLenBefore - 1;
subtitleTrack.length = 0;
refreshBlockBar();
deselectAllBlocks();
assert(getSelectedBlock() === null && blockPin.kind === null, 'todo limpio');
console.log('✓ barra de bloques: selección, pin y acciones por pista');

// --- navegación A* (navigation.js): desvío, fallback y extremos intactos --- (RF-28)
// Aislamiento total: se vacía el registry y se ocultan TODOS los ambientes para
// que los obstáculos sean 100% controlados por el test (sin paredes/muebles
// reales de la escena cargada). Se restaura todo al final del bloque.
const { solvePath } = await import(pathToFileURL('./js/cinema/navigation.js'));
const { officeGroup: navOffice } = await import(pathToFileURL('./js/office/group.js'));
const { parkGroup: navPark } = await import(pathToFileURL('./js/park.js'));
const { studioGroup: navStudio } = await import(pathToFileURL('./js/lights.js'));
const navSavedEntries = [...interactiveRegistry.entries()];
const navSavedVis = [navOffice.visible, navPark.visible, navStudio.visible];
interactiveRegistry.clear();
navOffice.visible = false; navPark.visible = false; navStudio.visible = false;
// Obstáculo circular fake: __colRadius evita setFromObject sobre el stub y el
// group plano satisface isShown/wallData/position de collectObstacles.
const navObs = (id, x, z, colR) => interactiveRegistry.set(id, {
  id, type: 'prop', __colRadius: colR,
  group: { position: { x, y: 0, z }, visible: true, parent: null, userData: {} },
});

// 1. Camino despejado → exactamente los 2 extremos, sin intermedios.
let nav = solvePath([new V(-4, 0, -6), new V(4, 0, -6)], 0);
assert(nav.length === 2, 'A*: sin obstáculos no inserta puntos');
assert(Math.abs(nav[0].x + 4) < 1e-9 && Math.abs(nav[1].x - 4) < 1e-9, 'A*: extremos intactos');

// 2. Obstáculo en el centro del tramo → desvío con intermedios fuera del radio.
navObs('navObs1', 0, -6, 1.0);
// Radio efectivo de collectObstacles: min(colR,2)*0.85 + CHAR_RADIUS*0.5 + MARGIN*0.5
const NAV_R = 1.0 * 0.85 + 0.3 * 0.5 + 0.45 * 0.5;
nav = solvePath([new V(-4, 0, -6), new V(4, 0, -6)], 0.17);
assert(nav.length > 2, 'A*: el obstáculo central fuerza un desvío');
assert(Math.abs(nav[0].x + 4) < 1e-9 && Math.abs(nav[0].z + 6) < 1e-9, 'A*: el extremo inicial se respeta');
assert(Math.abs(nav[nav.length - 1].x - 4) < 1e-9 && Math.abs(nav[nav.length - 1].z + 6) < 1e-9, 'A*: el extremo final (rojo) se respeta');
for (let i = 1; i < nav.length - 1; i++) {
  const d = Math.hypot(nav[i].x - 0, nav[i].z - (-6));
  assert(d >= NAV_R - 1e-6, `A*: intermedio ${i} fuera del obstáculo (d=${d.toFixed(3)} < ${NAV_R})`);
  assert(Math.abs(nav[i].y - 0.17) < 1e-9, 'A*: los intermedios respetan planeY');
}

// 3. Tramo bloqueado + meta FUERA de la grilla → A* devuelve null → el guard
//    `if (!cells) continue` conserva el camino directo (fallback probado).
//    Nota: collectObstacles acota el radio a Math.min(colR, 2.0), así que un
//    "obstáculo gigante" no sirve para forzar null — se usa meta fuera de bounds.
interactiveRegistry.clear();
navObs('navObsOut', 0, -6, 1.0);
nav = solvePath([new V(-4, 0, -6), new V(20, 0, -6)], 0); // x=20 > maxX (15)
assert(nav.length === 2, 'A*: sin solución posible se conserva el camino directo');
assert(Math.abs(nav[1].x - 20) < 1e-9, 'A*: el extremo fuera de grilla también se respeta');

// 4. Multi-waypoint: los originales se conservan en orden y SOLO el tramo
//    bloqueado suma puntos intermedios.
interactiveRegistry.clear();
navObs('navObsMid', 0, -6, 1.0);
nav = solvePath([new V(-4, 0, -6), new V(4, 0, -6), new V(4, 0, 6)], 0);
const navNear = (p, x, z) => Math.abs(p.x - x) < 1e-9 && Math.abs(p.z - z) < 1e-9;
const iA = nav.findIndex(p => navNear(p, -4, -6));
const iB = nav.findIndex(p => navNear(p, 4, -6));
const iC = nav.findIndex(p => navNear(p, 4, 6));
assert(iA === 0, 'A*: waypoint inicial en la posición 0');
assert(iB > iA, 'A*: waypoint intermedio conservado y en orden');
assert(iC === nav.length - 1 && iB < iC, 'A*: waypoint final conservado al cierre');
assert(nav.slice(iA + 1, iB).length >= 1, 'A*: tramo bloqueado suma intermedios');
assert(nav.slice(iB + 1, iC).length === 0, 'A*: tramo libre NO suma intermedios');

// 5. Entradas cortas se devuelven tal cual (guard clause).
assert(solvePath(null, 0) === null, 'A*: null pasa tal cual');
assert(solvePath([new V(1, 0, 1)], 0).length === 1, 'A*: un solo waypoint no hace nada');

// Restaurar el estado para lo que corra después.
interactiveRegistry.clear();
navSavedEntries.forEach(([k, v]) => interactiveRegistry.set(k, v));
navOffice.visible = navSavedVis[0];
navPark.visible = navSavedVis[1];
navStudio.visible = navSavedVis[2];
console.log('✓ navegación A*: desvío alrededor de obstáculos, fallback sin solución, extremos y planeY intactos');

// --- imán (tlSnap): exclude no imanta consigo mismo + refs de subtítulos/quiz --- (RF-23)
// El test de arriba (línea ~1040) cubre shots/bloques; acá se agregan las
// pistas restantes (subtitleTrack/quizTrack) y el exclude del bloque arrastrado.
const navSnapSub = { start: 99.0, end: 99.5, text: '__nav_snap__' };
const navSnapQuiz = { id: 'navSnapQuiz', question: 'Q?', options: ['A', 'B'], correct: 0, duration: 2, start: 98, end: 100 };
const navSnapBlk = { id: 'navSnapBlk', start: 97, duration: 0.6, actions: {} };
subtitleTrack.push(navSnapSub);
quizTrack.push(navSnapQuiz);
charBlocks.push(navSnapBlk);
const refsAll = collectTimelineSnapTimes();
assert(refsAll.includes(99) && refsAll.includes(99.5), 'imán: los bordes del subtítulo entran a las refs');
assert(refsAll.includes(98) && refsAll.includes(100), 'imán: los bordes del cartel entran a las refs');
const refsNoSelf = collectTimelineSnapTimes(navSnapBlk);
assert(!refsNoSelf.includes(97), 'imán: exclude quita el inicio del bloque arrastrado');
assert(!refsNoSelf.includes(97.6), 'imán: exclude quita el fin del bloque arrastrado');
assert(refsNoSelf.includes(99.5), 'imán: exclude no quita las refs de las demás pistas');
assert(Math.abs(snapTimeToRefs(99.45, 0.1, refsAll) - 99.5) < 1e-9, 'imán: 99.45 se pega al fin del subtítulo (99.5)');
subtitleTrack.splice(subtitleTrack.indexOf(navSnapSub), 1);
quizTrack.splice(quizTrack.indexOf(navSnapQuiz), 1);
charBlocks.splice(charBlocks.indexOf(navSnapBlk), 1);
assert(!collectTimelineSnapTimes().includes(97), 'imán: refs limpias tras el test');
console.log('✓ imán tlSnap: exclude propio, refs de subtítulos/quiz y snap a 0.1s');

console.log('\n✅ P7: todas las pruebas pasaron');
process.exit(0);
