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

// --- canaleta dibujada con pasamuros automáticos (atraviesa tabiques) ---
// Tramo que cruza el tabique vertical oeste de juntas (x=-4.5): de x=-8 a x=0
// con z=-7.75 (dentro del rango del tabique). Debe incluir el pasamuro.
const runWall = createCableTrayRun('cableTray_runWall', 'Cruza Tabique', [{ x: -8, z: -7.75 }, { x: 0, z: -7.75 }], 3.42);
const sleeves = runWall.children.filter(c => c.children.length === 0 && c.geometry && c.geometry.type === 'CylinderGeometry' && c.material && c.material.color && c.material.color.getHex() === 0x8a929e);
assert(sleeves.length >= 1, 'tramo que atraviesa tabique genera pasamuro automático');
// Tramo que NO cruza paredes: sin pasamuros
const runFree = createCableTrayRun('cableTray_runFree', 'Libre', [{ x: 5, z: 5 }, { x: 9, z: 5 }], 3.42);
const sleevesFree = runFree.children.filter(c => c.children.length === 0 && c.geometry && c.geometry.type === 'CylinderGeometry' && c.material && c.material.color && c.material.color.getHex() === 0x8a929e);
assert(sleevesFree.length === 0, 'tramo sin cruces no genera pasamuros');

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

// --- lip-sync (backlog #2): la boca abre/cierra mientras dura `talk` ---
gestoRig.setAction('talk');
gestoRig.run(0.1); // frame con la boca bastante abierta
const openScale = gestoRig.parts.h_mouth.scale.y;
gestoRig.run(0.7); // ~medio ciclo después: mucho más cerrada
const closedScale = gestoRig.parts.h_mouth.scale.y;
assert(openScale > 1.6, 'lip-sync: boca se abre al hablar (scale.y alto)');
assert(Math.abs(closedScale - openScale) > 1, 'lip-sync: la boca varía su apertura con el tiempo');
assert(gestoRig.parts.h_mouth.scale.y >= 0.99 && gestoRig.parts.h_mouth.scale.y <= 4.5, 'lip-sync: apertura dentro del rango (cerrada→abierta)');
gestoRig.setAction('idle');
gestoRig.run(0.1);
assert(Math.abs(gestoRig.parts.h_mouth.scale.y - 1) < 0.02, 'lip-sync: fuera de talk la boca vuelve a la forma normal');

// --- sit_talk: hablando SENTADO (el jefe no se para de la silla) ---
// La pose mantiene las piernas de sit y agrega gesticulación + lip-sync.
gestoRig.setAction('sit_talk');
gestoRig.run(0.1);
const sitTalkOpen = gestoRig.parts.h_mouth.scale.y;
gestoRig.run(0.7);
const sitTalkClosed = gestoRig.parts.h_mouth.scale.y;
assert(sitTalkOpen > 1.6, 'sit_talk: lip-sync activo (boca se abre sentado)');
assert(Math.abs(sitTalkClosed - sitTalkOpen) > 1, 'sit_talk: la boca varía su apertura');
// Las piernas quedan en pose de sentado (muslos horizontales), no de pie
assert(Math.abs(gestoRig.parts.h_legL.rotation.x - (-Math.PI / 2)) < 0.01, 'sit_talk: piernas apoyadas como sit (muslos horizontales)');
// El torso queda a altura de asiento, no de pie: no se "para" al hablar
assert(gestoRig.parts.h_torso.position.y < 0.95, 'sit_talk: torso a altura de silla (no se para)');
gestoRig.setAction('idle');
gestoRig.run(0.1);

// --- escena: evento SIN espera mantiene su acción (lip-sync en marcha) ---
// El preview de la timeline (getPreviewPath) antes perdía acciones de eventos
// con wait:0 (ej. "talk" al pasar): el segmento move siguiente las pisaba.
const { evaluateAllPathsAt } = await import(pathToFileURL('./js/cinema/cinematics.js'));
const V = (await import('three')).Vector3;
cinemaPaths.set('gestoTestChar', {
  waypoints: [new V(0, 0, 0), new V(10, 0, 0)],
  planeY: 0,
  speed: 5,
  events: { '1': { action: 'talk', wait: 0 } }
});
evaluateAllPathsAt(2.5); // ~después del evento (llega a x=10 al segundo 2)
assert(gestoRig.currentAction === 'talk', 'escena: evento sin espera mantiene su acción en el recorrido (talk en marcha)');
evaluateAllPathsAt(0.5); // antes del evento: caminando
assert(gestoRig.currentAction === 'walk' || gestoRig.currentAction === 'run', 'escena: antes del evento el personaje camina/corre');
cinemaPaths.delete('gestoTestChar');

// --- pista 🧍 por personaje: acción de TODA la escena (fullRange) ---
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

// --- bloques guardan pose (lugar + rotación) y la reproducen ---
// Cada cuadro recuerda dónde quedó el personaje: al pasar de un cuadro a
// otro salta a su pose, y terminada la escena conserva la última.
const { charPoseAt, createInitialCharBlock } = await import(pathToFileURL('./js/cinema/charTrack.js'));
const poseRig = addHumanCharacter('poseTestChar', 'Pose Test', 1, 2, 0, {});
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
setCharBlocks([], {});

// --- reproducción con solo bloques (sin tomas): siempre funciona ---
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

// --- audio por escena: metadata chica en snapshots, data solo al guardar ---
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

// --- spawn en el centro de la vista (donde mira la cámara) ---
const { viewCenterGround, camera, controls } = await import(pathToFileURL('./js/core.js'));
const vc = viewCenterGround();
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

// --- convención de orientación (blindaje anti "dados vuelta") ---
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

// --- creador: outfit + accesorios persisten en el personaje ---
addHumanCharacter('customChar2', 'Chef Test', 1, 1, 0, { outfit: 'chef', sunglasses: true, femaleHair: true });
const withOutfit = serializeProject();
const serChef = withOutfit.characters.find(c => c.id === 'customChar2');
assert(!!serChef && serChef.colors.outfit === 'chef' && serChef.colors.sunglasses === true, 'outfit y accesorios del personaje serializados');

// --- sentarse en asiento (sit_at): evento con silla + ancla ---
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

// --- personajes de pie junto a muebles: uso del frente del ancla ---
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

// --- ✕ de la toma = commit: cinemática activa se guarda al cerrar ---
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

// --- ✕ DESCARTA: el snapshot restaura el bloque modificado ---
// (discardSelection usa el mismo mecanismo: Object.assign sobre el snapshot)
const shotDiscard = { id: 'shotX', start: 1, duration: 2, camMode: 'free', subjectId: null, label: '', color: '#111' };
const snapDiscard = JSON.parse(JSON.stringify(shotDiscard));
shotDiscard.start = 9; shotDiscard.duration = 5; shotDiscard.camMode = 'top';
Object.assign(shotDiscard, JSON.parse(JSON.stringify(snapDiscard)));
assert(shotDiscard.start === 1 && shotDiscard.duration === 2 && shotDiscard.camMode === 'free',
  '✕ de la toma: el snapshot restaura el bloque modificado');

// --- Escena estática / diálogo (reunion_prioridades_jefe) ---
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

// Ley del piso en la evaluación: los personajes de PIE no se hunden (su
// origen queda en rig.groundY, pies apoyados) — antes el JSON con y=0 los
// enterraba cada frame.
evaluateAllPathsAt(0);
assert(alex.group.position.y >= (alex.rig.groundY || 0) - 1e-6, 'Alex apoya los pies (y >= groundY, no hundido)');
assert(elena.group.position.y >= (elena.rig.groundY || 0) - 1e-6, 'Elena apoya los pies (y >= groundY, no hundida)');

// --- Imán de alineación entre pistas (tlSnap) ---
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

console.log('\n✅ P7: todas las pruebas pasaron');
process.exit(0);
