import * as THREE from 'three';
import { byId, qs, qsa } from '../dom.js';
import { scene, camera, canvas, controls } from '../core.js';
import { cinema, cinemaPaths, playbackInstances, view, interactiveRegistry, timelineBus, charLaneBus, blockEdit } from '../state.js';
import { getActiveObject, getActiveEntry, setActiveTarget } from '../ui/selection.js';
import { raycaster, getPointerNDC, projectPointerToPlane } from '../ui/gizmo.js';
import { setStatus } from '../media/recorder.js';
import { solvePath } from './navigation.js';
import { charActionsAt, charPoseAt } from './charTrack.js';
import { pushHistory } from '../undo.js';
import { anchorSeats } from '../characters/anchors.js';
import { getWallColliders, getDoorColliders } from '../office/walls.js';
import { stepLadder, STEP_LADDER_ORIGIN } from '../office/group.js';
import { getMinGroundY } from '../collision.js';

// ==========================================
// SISTEMA DE CINEMÁTICA (RECORRIDO ANIMADO)
// ==========================================
let cinemaAllGroup = null;     // líneas de recorridos de otros objetos

function cinemaInitGroup() {
  if (cinema.group) return;
  cinema.group = new THREE.Group();
  cinema.group.renderOrder = 1000;
  scene.add(cinema.group);
  cinemaAllGroup = new THREE.Group();
  scene.add(cinemaAllGroup);
}

function cinemaDisposeChildren(group) {
  while (group.children.length) {
    const c = group.children[0];
    group.remove(c);
    if (c.geometry) c.geometry.dispose();
    if (c.material) c.material.dispose();
  }
}

function cinemaClearVisuals() {
  if (!cinema.group) return;
  cinemaDisposeChildren(cinema.group);
  cinema.markers = [];
  cinema.pathLine = null;
}

function cinemaClearAllVisuals() {
  if (cinemaAllGroup) cinemaDisposeChildren(cinemaAllGroup);
}

function cinemaBuildCurveFrom(waypoints) {
  if (!waypoints || waypoints.length < 2) return null;
  const c = new THREE.CatmullRomCurve3(waypoints, false, 'catmullrom', 0.5);
  return c;
}

function cinemaBuildCurve() {
  cinema.curve = cinemaBuildCurveFrom(cinema.waypoints);
  cinema.length = cinema.curve ? cinema.curve.getLength() : 0;
}

function cinemaMakeMarker(pos, colorHex, size, groundRing) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(size, 16, 16),
    new THREE.MeshBasicMaterial({ color: colorHex, depthTest: false })
  );
  m.renderOrder = 1001;
  m.position.copy(pos);
  m.userData.isCinemaMarker = true;
  cinema.group.add(m);
  if (groundRing) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.34, 32),
      new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: 0.9 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, pos.y + 0.02, pos.z);
    ring.renderOrder = 1000;
    cinema.group.add(ring);
  }
  return m;
}

function cinemaRebuildVisuals() {
  cinemaClearVisuals();
  // Guardar el recorrido en cuanto existe (inicio + fin), y con cada edición,
  // para que Reproducir quede habilitado sin salir del modo edición
  if (cinema.targetId) cinemaStorePath(cinema.targetId);
  if (cinema.waypoints.length >= 2) {
    cinemaBuildCurve();
    const pts = cinema.curve.getPoints(140);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffd24d, depthTest: false });
    cinema.pathLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat);
    cinema.pathLine.renderOrder = 1000;
    cinema.group.add(cinema.pathLine);
  }
  cinema.markers = [];
  cinema.waypoints.forEach((wp, i) => {
    const isEnd = (i === 0) || (i === cinema.waypoints.length - 1);
    const color = i === 0 ? 0x48bb78 : (i === cinema.waypoints.length - 1 ? 0xe04d4d : 0xffd24d);
    const mk = cinemaMakeMarker(wp, color, isEnd ? 0.22 : 0.16, isEnd);
    mk.userData.waypointIndex = i;
    cinema.markers.push({ mesh: mk, index: i });
  });
  cinemaDrawAllPaths();
  refreshCinemaUI();
  refreshCharLanes();   // la pista 🧍 del personaje se redibuja (bloque 🚶)
}

function cinemaDrawAllPaths() {
  if (!cinemaAllGroup) return;
  cinemaClearAllVisuals();
  if (!cinema.active) return;
  cinemaPaths.forEach((stored, id) => {
    if (id === cinema.targetId) return; // el activo ya se dibuja con marcadores
    if (!stored.waypoints || stored.waypoints.length < 2) return;
    const c = cinemaBuildCurveFrom(stored.waypoints);
    if (!c) return;
    const pts = c.getPoints(100);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x6fa8ff, depthTest: false, transparent: true, opacity: 0.65 })
    );
    line.renderOrder = 999;
    cinemaAllGroup.add(line);
  });
}

function cinemaGroundPlane() {
  return new THREE.Plane().setFromNormalAndCoplanarPoint(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, cinema.planeY, 0)
  );
}

function cinemaPointerToGround(e, out) {
  return projectPointerToPlane(e, cinemaGroundPlane(), out);
}

function cinemaSetMode(mode) {
  cinema.mode = mode;
  const hint = byId('cinemaHint');
  const editCtrls = byId('cinemaEditControls');
  const banner = byId('cinemaBanner');
  if (hint) {
    if (mode === 'pickStart') hint.textContent = 'Paso 1: haz clic en el escenario para fijar el punto de INICIO (círculo verde).';
    else if (mode === 'pickEnd') hint.textContent = 'Paso 2: haz clic para fijar el punto FINAL (círculo rojo).';
    else if (mode === 'edit') hint.textContent = 'Clic sobre la línea para añadir puntos; arrastra los puntos para moldear el recorrido.';
    else hint.textContent = 'Activa la cinemática de un personaje para grabar su recorrido.';
  }
  if (banner) {
    if (mode === 'pickStart') { banner.textContent = '🟢 PON EL PUNTO INICIAL'; banner.style.display = 'block'; }
    else if (mode === 'pickEnd') { banner.textContent = '🔴 PON EL PUNTO FINAL'; banner.style.display = 'block'; }
    else banner.style.display = 'none';
  }
  if (editCtrls) editCtrls.style.display = (mode === 'edit' || mode === 'play' || playbackInstances.has(cinema.targetId)) ? 'flex' : 'none';
  refreshCinemaUI();
}

function cinemaStorePath(id) {
  if (!id) return;
  if (cinema.waypoints.length === 0) { cinemaPaths.delete(id); return; }
  const prev = cinemaPaths.get(id);
  cinemaPaths.set(id, {
    waypoints: cinema.waypoints.map(v => v.clone()),
    planeY: cinema.planeY,
    events: Object.assign({}, cinema.events),
    loop: prev ? prev.loop : undefined,
    delay: prev ? prev.delay : undefined,
    speed: prev ? prev.speed : undefined
  });
}

function cinemaLoadTarget(id) {
  // Guardar el recorrido del objetivo anterior antes de cambiar
  if (cinema.active && cinema.targetId && cinema.targetId !== id && cinema.waypoints.length > 0) {
    cinemaStorePath(cinema.targetId);
  }
  cinema.targetId = id;
  const entry = interactiveRegistry.get(id);
  const obj = entry ? entry.group : null;
  cinema.planeY = obj ? obj.position.y : 0;
  cinema.playing = false;
  const stored = cinemaPaths.get(id);
  if (stored) {
    cinema.waypoints = stored.waypoints.map(v => v.clone());
    cinema.planeY = stored.planeY;
    cinema.events = Object.assign({}, stored.events);
    cinemaBuildCurve();
    cinemaRebuildVisuals();
    cinemaSetMode(cinema.waypoints.length >= 2 ? 'edit' : (cinema.waypoints.length === 1 ? 'pickEnd' : 'pickStart'));
  } else {
    cinema.waypoints = [];
    cinema.events = {};
    cinema.curve = null;
    cinema.length = 0;
    cinemaClearVisuals();
    cinemaSetMode('pickStart');
  }
  cinemaDrawAllPaths();
}

function cinemaActivate() {
  const obj = getActiveObject();
  if (!obj) { setStatus('Selecciona un objeto primero.'); return; }
  cinemaInitGroup();
  cinema.active = true;
  cinema.dragging = -1;
  cinemaLoadTarget(getActiveEntry() ? getActiveEntry().id : '');
  setStatus('Cinemática activada para ' + (getActiveEntry() ? getActiveEntry().name : 'objeto') + '.');
}
// (getActiveEntry().id es equivalente a store.activeTarget)

function cinemaDeactivate() {
  if (cinema.targetId) cinemaStorePath(cinema.targetId);
  cinema.active = false;
  cinema.playing = false;
  cinema.dragging = -1;
  cinema.waypoints = [];
  cinema.curve = null;
  cinema.length = 0;
  cinemaClearVisuals();
  cinemaClearAllVisuals();
  controls.enabled = true;
  canvas.style.cursor = 'default';
  cinemaSetMode('off');
  setStatus('Cinemática desactivada (recorridos guardados por objeto).');
}

function cinemaInsertWaypoint(v) {
  if (cinema.waypoints.length < 2) { cinema.waypoints.push(v.clone()); return; }
  const N = 80;
  let bestT = 0, bestD = Infinity;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = cinema.curve.getPoint(t);
    const d = p.distanceToSquared(v);
    if (d < bestD) { bestD = d; bestT = t; }
  }
  let idx = Math.round(bestT * (cinema.waypoints.length - 1)) + 1;
  // Nunca insertar después del punto final (rojo) ni antes del inicial (verde):
  // los extremos solo se mueven arrastrándolos
  idx = Math.max(1, Math.min(cinema.waypoints.length - 1, idx));
  cinema.waypoints.splice(idx, 0, v.clone());
  // Desplazar los eventos de waypoints >= idx (el índice corrió)
  const shifted = {};
  Object.keys(cinema.events).forEach(k => {
    const ki = parseInt(k, 10);
    shifted[ki >= idx ? ki + 1 : ki] = cinema.events[k];
  });
  cinema.events = shifted;
}

function cinemaPickClick(e) {
  const pt = new THREE.Vector3();
  if (!cinemaPointerToGround(e, pt)) return;
  if (cinema.mode === 'pickStart') {
    cinema.waypoints = [pt.clone()];
    cinemaRebuildVisuals();
    cinemaSetMode('pickEnd');
    setStatus('Punto de inicio fijado (círculo verde). Ahora elige el punto final.');
  } else if (cinema.mode === 'pickEnd') {
    cinema.waypoints.push(pt.clone());
    cinemaRebuildVisuals();
    cinemaSetMode('edit');
    setStatus('Recorrido creado. Añade y moldea puntos, luego reproduce.');
  } else if (cinema.mode === 'edit') {
    cinemaInsertWaypoint(pt);
    cinemaRebuildVisuals();
  }
  pushHistory();
}

function cinemaGetMarkerHit(e) {
  const ndc = getPointerNDC(e);
  raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  const meshes = cinema.markers.map(m => m.mesh);
  const hits = raycaster.intersectObjects(meshes, false);
  if (hits.length) {
    let curr = hits[0].object;
    while (curr && curr.userData.waypointIndex === undefined) curr = curr.parent;
    if (curr) return curr.userData.waypointIndex;
  }
  return -1;
}

function onCinemaPointerDownCapture(e) {
  if (!cinema.active) return;
  // Solo el botón IZQUIERDO edita el recorrido (agregar/arrastrar puntos);
  // el derecho queda para la cámara (pan) y el menú contextual.
  if (e.button !== 0) return;
  if (cinema.mode === 'play') return; // dejar orbit/select normal
  cinema.pressInfo = { x: e.clientX, y: e.clientY, t: performance.now() };
  if (cinema.mode === 'edit') {
    const idx = cinemaGetMarkerHit(e);
    if (idx >= 0) {
      cinema.dragging = idx;
      controls.enabled = false;
      canvas.style.cursor = 'grabbing';
      e.stopPropagation();
      return;
    }
  }
}

function onCinemaPointerMoveCapture(e) {
  if (!cinema.active) return;
  if (cinema.dragging >= 0) {
    const pt = new THREE.Vector3();
    if (cinemaPointerToGround(e, pt)) {
      cinema.waypoints[cinema.dragging].copy(pt);
      cinemaRebuildVisuals();
    }
    e.stopPropagation();
    return;
  }
  if (cinema.mode === 'edit') {
    const idx = cinemaGetMarkerHit(e);
    canvas.style.cursor = idx >= 0 ? 'grab' : 'crosshair';
  } else if (cinema.mode === 'pickStart' || cinema.mode === 'pickEnd') {
    canvas.style.cursor = 'crosshair';
  }
}

function onCinemaPointerUpCapture(e) {
  if (!cinema.active) return;
  if (e.button !== 0) return;   // el derecho es de cámara/menú, no de edición
  if (cinema.dragging >= 0) {
    cinema.dragging = -1;
    controls.enabled = true;
    canvas.style.cursor = 'default';
    if (cinema.curve) cinema.length = cinema.curve.getLength();
    pushHistory();
    e.stopPropagation();
    return;
  }
  if (cinema.mode === 'play') return;
  const p = cinema.pressInfo;
  cinema.pressInfo = null;
  if (!p) return;
  const moved = Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y);
  if (moved > 6) return; // fue un arrastre (orbitar), no un clic
  cinemaPickClick(e);
}

canvas.addEventListener('pointerdown', onCinemaPointerDownCapture, true);
canvas.addEventListener('pointermove', onCinemaPointerMoveCapture, true);
canvas.addEventListener('pointerup', onCinemaPointerUpCapture, true);

// Doble click en un punto del recorrido (modo edición) → editar su evento
// (acción al llegar + espera). Lo consume la UI de la timeline.
canvas.addEventListener('dblclick', (e) => {
  if (!cinema.active || cinema.mode !== 'edit') return;
  const idx = cinemaGetMarkerHit(e);
  if (idx < 0) return;
  window.dispatchEvent(new CustomEvent('cinema-waypoint-edit', { detail: { index: idx } }));
});

function cinemaPlay() {
  const id = cinema.targetId || (getActiveEntry() ? getActiveEntry().id : '');
  if (!id) return;
  cinema.targetId = id;
  if (playbackInstances.has(id)) stopPlayback(id);
  else if (!startPlayback(id)) { setStatus('Ese objeto no tiene un recorrido configurado.'); return; }
  refreshCinemaUI();
  setStatus('Reproduciendo recorrido de ' + (interactiveRegistry.get(id) ? interactiveRegistry.get(id).name : 'objeto') + '...');
}

function cinemaPause() {
  if (cinema.targetId) stopPlayback(cinema.targetId);
  refreshCinemaUI();
  setStatus('Recorrido en pausa.');
}

function cinemaTogglePlay() {
  cinemaPlay();
}

// Posición u (0..1, parametrizada por longitud de arco) más cercana a un punto
function cinemaWaypointU(curve, point) {
  const N = 120;
  let bestU = 0, bestD = Infinity;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const d = curve.getPointAt(u).distanceToSquared(point);
    if (d < bestD) { bestD = d; bestU = u; }
  }
  return bestU;
}

export function startPlayback(id, opts = {}) {
  let waypoints, planeY, events;
  if (id === cinema.targetId && cinema.waypoints.length >= 2) {
    waypoints = cinema.waypoints;
    planeY = cinema.planeY;
    events = cinema.events;
  } else {
    const stored = cinemaPaths.get(id);
    if (!stored || !stored.waypoints || stored.waypoints.length < 2) return false;
    waypoints = stored.waypoints;
    planeY = stored.planeY;
    events = stored.events || {};
    var storedSpeed = stored.speed; // velocidad guardada con el recorrido (ej. correr)
    var storedDelay = stored.delay; // segundos que espera antes de arrancar (ej. sale cuando lo llaman)
  }
  const baseSpeed = opts.speed !== undefined ? opts.speed : (typeof storedSpeed === 'number' ? storedSpeed : cinema.speed);
  const delay = opts.delay !== undefined ? opts.delay : (typeof storedDelay === 'number' ? storedDelay : 0);

  // Detectar si es un recorrido estacionario (waypoints en el mismo lugar para coordinar diálogos/acciones)
  const p0 = waypoints[0];
  const p0x = p0.x !== undefined ? p0.x : p0[0];
  const p0z = p0.z !== undefined ? p0.z : p0[2];
  let maxSpan = 0;
  for (let i = 0; i < waypoints.length; i++) {
    const p = waypoints[i];
    const px = p.x !== undefined ? p.x : p[0];
    const pz = p.z !== undefined ? p.z : p[2];
    maxSpan = Math.max(maxSpan, Math.hypot(px - p0x, pz - p0z));
  }
  const isStationary = maxSpan < 0.25 || baseSpeed <= 0;

  // Camino con esquivado automático: si un tramo cruza paredes u objetos,
  // se insertan puntos intermedios para rodearlos (el destino no cambia).
  // Si es estacionario, no se ejecuta A* para no alejar al personaje de su silla o escritorio.
  const solved = isStationary ? waypoints : solvePath(waypoints, planeY);
  const curve = cinemaBuildCurveFrom(solved);
  if (!curve) return false;
  const entry = interactiveRegistry.get(id);
  if (entry && solved.length > 0 && !isStationary) {
    const p0Coord = opts.reversed ? solved[solved.length - 1] : solved[0];
    entry.group.position.set(p0Coord.x, planeY, p0Coord.z);
  }
  let savedAction = 'idle';
  let moveAction = 'walk';
  let cadence = 1;
  if (entry && entry.rig) {
    savedAction = entry.rig.currentAction;
    if (isStationary) {
      moveAction = savedAction;
    } else {
      // Velocidad constante en m/s: la duración crece con el recorrido.
      // La animación se adapta: por encima de ~3.5 m/s corre, y la cadencia
      // de las zancadas se sincroniza con la velocidad real.
      moveAction = baseSpeed >= 3.5 ? 'run' : 'walk';
      const natural = moveAction === 'run' ? (entry.rig.naturalRun || 4.5) : (entry.rig.naturalWalk || 1.8);
      cadence = THREE.MathUtils.clamp(baseSpeed / natural, 0.6, 2.0);
      // Con delay el personaje arranca con la acción que ya tenía (ej. quieto
      // trabajando); el walk/run se aplica al terminarse la espera (render.js).
      if (!(delay > 0)) {
        entry.rig.setAction(moveAction);
        entry.rig.cadence = cadence;
      }
    }
  }
  // Eventos de waypoint: acción al llegar + espera, con su u en la curva
  const evts = [];
  Object.keys(events).forEach(k => {
    const i = parseInt(k, 10);
    const ev = events[k];
    if (!ev || i < 0 || i >= waypoints.length) return;
    if (!ev.action && !(ev.wait > 0)) return;
    evts.push({ u: cinemaWaypointU(curve, waypoints[i]), action: ev.action || null, wait: ev.wait || 0, done: false });
  });
  evts.sort((a, b) => a.u - b.u);
  // Acción final: si hay un evento sobre el último punto (u cercano a 1) con
  // acción, esa acción PERSISTE al terminar el recorrido en vez de volver a
  // la previa. Permite "camina hasta el escritorio y queda hablando/sentado".
  let endAction = null;
  if (evts.length > 0 && evts[evts.length - 1].u > 0.9 && evts[evts.length - 1].action) {
    endAction = evts[evts.length - 1].action;
  }
  playbackInstances.set(id, {
    curve,
    length: curve.getLength(),
    planeY: planeY,
    reversed: !!opts.reversed,
    speed: baseSpeed,
    loop: opts.loop !== undefined ? !!opts.loop : cinema.loop,
    progress: 0,
    savedAction,
    moveAction,
    cadence: cadence,
    events: evts,
    endAction,
    waiting: delay > 0 ? delay : 0,
    // Arranca en el extremo de la curva (0 al avanzar, 1 al revés) para que un
    // evento situado justo en el primer punto (u=0) se dispare en el 1er frame.
    lastU: opts.reversed ? 1 : 0,
    isStationary,
    initialPosX: entry ? entry.group.position.x : p0x,
    initialPosY: entry ? entry.group.position.y : planeY,
    initialPosZ: entry ? entry.group.position.z : p0z,
    initialRotY: entry ? entry.group.rotation.y : 0
  });
  return true;
}

export function stopPlayback(id) {
  const inst = playbackInstances.get(id);
  if (inst) {
    const entry = interactiveRegistry.get(id);
    if (entry && entry.rig) entry.rig.setAction(inst.savedAction || 'idle');
  }
  playbackInstances.delete(id);
}

function togglePlayback(id) {
  if (playbackInstances.has(id)) stopPlayback(id);
  else startPlayback(id);
  refreshCinemaUI();
}

function startAllPlaybacks() {
  let any = false;
  if (cinema.active && cinema.targetId && cinema.waypoints.length >= 2) {
    cinemaStorePath(cinema.targetId);
  }
  cinemaPaths.forEach((stored, id) => {
    if (stored.waypoints && stored.waypoints.length >= 2) { startPlayback(id); any = true; }
  });
  refreshCinemaUI();
  return any;
}

function stopAllPlaybacks() {
  const ids = Array.from(playbackInstances.keys());
  ids.forEach(stopPlayback);
  refreshCinemaUI();
}

function refreshCinemaUI() {
  // Re-poblar el dropdown de cámara (por si aparecieron/desaparecieron
  // personajes) y sincronizarlo con la toma seleccionada.
  populateShotCamSubject();
  syncShotCamUI();
  updateCinemaCharList();
}

// La lista de recorridos por personaje dejó de existir (vive en las pistas
// 🧍 de la línea de tiempo, una lane por personaje). Mantenemos la función
// como un refresh de esas pistas: recorre los recorridos para calcular su
// duración y pide el redibujado de las lanes.
function updateCinemaCharList() {
  refreshCharLanes();
}

// (La selección de cámara por personaje/vista ahora la maneja el control
//  "🎥 Cámara de la toma" del panel, vía applyShotCamControl más abajo.)

// ==========================================
// CONTROL DE CÁMARA DE LA TOMA (dropdown personaje + vista + botón Ver)
// ==========================================
// Mapeo del valor del dropdown de vista al modo interno de cámara.
const SHOT_CAM_MAP = {
  '1p': 'fpv',
  '3p': 'third',
  'front': 'front',
  'profile': 'profile',
  'free': 'free'
};

// Llena el dropdown de "Quién" con todos los personajes de la escena + la
// opción "Cámara libre" (sin protagonista). Mantiene la selección actual.
function populateShotCamSubject() {
  const sel = byId('shotCamSubject');
  if (!sel) return;
  const current = sel.value || '';
  sel.innerHTML = '';
  const free = document.createElement('option');
  free.value = '';
  free.textContent = '🎥 Cámara libre';
  sel.appendChild(free);
  const entries = [];
  interactiveRegistry.forEach(entry => {
    if (entry.deleted) return;
    if (entry.type === 'human' || entry.type === 'pet') entries.push(entry);
  });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  entries.forEach(entry => {
    const o = document.createElement('option');
    o.value = entry.id;
    o.textContent = (entry.type === 'human' ? '🧍 ' : '🐾 ') + entry.name;
    sel.appendChild(o);
  });
  if (current) sel.value = current;
}

// Refleja la toma seleccionada en los dropdowns (quién + vista). Si no hay
// toma seleccionada, deja los valores actuales (vista en vivo).
function syncShotCamUI() {
  const shot = timelineBus.getSelectedShot();
  const subjectSel = byId('shotCamSubject');
  const viewSel = byId('shotCamView');
  if (!subjectSel || !viewSel) return;
  if (shot) {
    subjectSel.value = shot.subjectId || '';
    const mapped = Object.keys(SHOT_CAM_MAP).find(k => SHOT_CAM_MAP[k] === shot.camMode);
    viewSel.value = mapped || 'free';
  }
  syncShotDollyUI();
}

// Estado del movimiento en el panel: qué toma lo tiene y con qué modo.
function syncShotDollyUI() {
  const status = byId('shotDollyStatus');
  const endBtn = byId('btnShotDollyEnd');
  const clearBtn = byId('btnShotDollyClear');
  if (!status) return;
  const shot = timelineBus.getSelectedShot();
  const ok = !!(shot && DOLLY_MODES.includes(shot.camMode));
  const has = !!(shot && Array.isArray(shot.camPosEnd));
  status.textContent = !shot
    ? 'Sin toma seleccionada.'
    : !ok
      ? 'Solo en cámara libre o fija.'
      : has
        ? '🎬 Con movimiento: viaja inicio→fin durante la toma.'
        : 'Sin movimiento: plano fijo.';
  if (endBtn) endBtn.disabled = !ok;
  if (clearBtn) clearBtn.disabled = !ok || !has;
}

// Aplica la combinación (quién + vista) elegida en el control. Si hay una toma
// seleccionada, configura ESA toma (camMode + subjectId) y, en cámara libre,
// guarda el encuadre actual; si no, es una vista en vivo.
function applyShotCamControl() {
  const subjectSel = byId('shotCamSubject');
  const viewSel = byId('shotCamView');
  if (!subjectSel || !viewSel) return;
  const personId = subjectSel.value || null;
  const mode = SHOT_CAM_MAP[viewSel.value] || 'free';
  const entry = personId ? interactiveRegistry.get(personId) : null;

  const shot = timelineBus.getSelectedShot();
  if (mode === 'free') {
    // Cámara libre: sin protagonista. Si hay toma seleccionada, queda como una
    // toma en Vista Libre; el encuadre lo pone el usuario y se guarda con 💾.
    if (shot) {
      shot.camMode = 'free';
      shot.subjectId = null;
      timelineBus.renderShots();
    }
    view.mode = 'orbit';
    view.subjectId = null;
    controls.enabled = true;
    setStatus('Cámara libre' + (shot ? ' (toma seleccionada): movela y guardá con 💾.' : ' activada.'));
  } else if (shot) {
    shot.camMode = mode;
    shot.subjectId = personId;
    timelineBus.renderShots();
    cutCameraToShot(mode, personId, shot);
    setStatus(`${label(mode)} sobre ${entry ? entry.name : 'objeto'} (toma seleccionada).`);
  } else {
    view.mode = mode;
    view.subjectId = personId;
    controls.enabled = false;
    updateCinematicCamera(true);
    setStatus(`${label(mode)} sobre ${entry ? entry.name : 'objeto'}.`);
  }
}

function label(mode) {
  return { fpv: '1ª persona', third: '3ª persona', front: 'Frente', profile: 'Perfil' }[mode] || mode;
}

// Cableado de la UI: dropdowns y botón "Ver". Se llama una sola vez al evaluar
// el módulo (los elementos existen en index.html).
(function initShotCamControl() {
  const subjectSel = byId('shotCamSubject');
  const viewSel = byId('shotCamView');
  const viewBtn = byId('btnShotCamView');
  populateShotCamSubject();
  if (viewBtn) {
    viewBtn.addEventListener('click', () => applyShotCamControl());
  }
  // Al cambiar "Quién" a un personaje, saltamos a esa vista automáticamente
  // (la vista actual se reconfigura al personaje elegido). Si se elige
  // "Cámara libre", la vista pasa sola a "Cámara libre".
  if (subjectSel) {
    subjectSel.addEventListener('change', () => {
      if (!subjectSel.value) {
        const viewSel = byId('shotCamView');
        if (viewSel) viewSel.value = 'free';
      }
      applyShotCamControl();
    });
  }
  if (viewSel) {
    viewSel.addEventListener('change', () => applyShotCamControl());
  }
  // Movimiento en la toma: marcar el encuadre actual como fin, o quitarlo.
  byId('btnShotDollyEnd')?.addEventListener('click', () => {
    if (markShotDollyEnd()) {
      if (timelineBus.renderShots) timelineBus.renderShots();
      syncShotDollyUI();
      pushHistory();
      setStatus('🎬 Fin del movimiento marcado: en la toma la cámara viaja hasta acá. 💾 guarda.');
    } else {
      setStatus('Elegí una toma en cámara libre o fija para marcarle movimiento.');
    }
  });
  byId('btnShotDollyClear')?.addEventListener('click', () => {
    if (clearShotDolly()) {
      if (timelineBus.renderShots) timelineBus.renderShots();
      syncShotDollyUI();
      pushHistory();
      setStatus('Movimiento de la toma quitado: vuelve a plano fijo.');
    }
  });
  // Mantener el dropdown de personajes y la vista sincronizados con la toma
  // seleccionada: refrescamos al seleccionar/descartar tomas.
  timelineBus.syncShotCamUI = syncShotCamUI;
  timelineBus.populateShotCamSubject = populateShotCamSubject;
})();

function cinemaDeletePathFor(id) {
  stopPlayback(id);
  cinemaPaths.delete(id);
  if (id === cinema.targetId) {
    cinema.waypoints = [];
    cinema.curve = null;
    cinema.length = 0;
    cinemaClearVisuals();
    cinemaDrawAllPaths();
    if (cinema.active) cinemaSetMode('pickStart');
  }
  refreshCinemaUI();
  pushHistory();
  const e = interactiveRegistry.get(id);
  setStatus('Recorrido de ' + (e ? e.name : 'objeto') + ' eliminado.');
}

function cinemaClearPath() {
  if (cinema.targetId) cinemaPaths.delete(cinema.targetId);
  cinema.waypoints = [];
  cinema.events = {};
  cinema.curve = null;
  cinema.length = 0;
  cinema.playing = false;
  cinemaClearVisuals();
  cinemaDrawAllPaths();
  refreshCinemaUI();
  if (!cinema.active) return;
  cinemaSetMode('pickStart');
  setStatus('Recorrido limpiado. Elige el punto de inicio.');
}

// Registro en el bus de los recorridos (lo usa la pista 🧍 PERSONAJES de
// charTrack.js, que no puede importarnos por el ciclo charTrack→cinematics):
charLaneBus.pathInfo = (id) => {
  const stored = cinemaPaths.get(id);
  if (!stored || !stored.waypoints || stored.waypoints.length < 2) return null;
  // Si el recorrido tiene duración ~0 (estacionario: waypoints coincidentes o
  // velocidad 0), no es un CAMINO — se omite para no pintar un bloque 🚶 vacío
  // junto al personaje.
  const dur = stored._duration || 0;
  if (!(dur > 0.3)) return null;
  return { duration: dur, loop: !!stored.loop, speed: typeof stored.speed === 'number' ? stored.speed : cinema.speed };
};
charLaneBus.isEditing = (id) => cinema.active && cinema.targetId === id;
charLaneBus.closeEditor = () => { if (cinema.active) cinemaDeactivate(); };
charLaneBus.toggleEditor = (id) => {
  // Exclusividad total: abrir el editor de recorrido suelta el bloque de
  // acciones en edición (un solo bloque a la vez, de cualquier pista).
  if (blockEdit.get()) window.dispatchEvent(new CustomEvent('char-block-selected'));
  setActiveTarget(id);
  if (cinema.active && cinema.targetId === id) cinemaDeactivate();
  else cinemaActivate();
};
charLaneBus.deletePath = (id) => cinemaDeletePathFor(id);

// Duración del recorrido (para el bloque 🚶 de la pista): se recalcula con
// la misma previsión determinista del playback. Se expone como helper para
// refrescar la pista cuando cambia un recorrido.
export function refreshCharLanes() {
  cinemaPaths.forEach((stored, id) => {
    const pv = getPreviewPath(stored);
    stored._duration = pv ? pv.totalEnd : 0;
  });
  if (charLaneBus.refresh) charLaneBus.refresh();
}

// ==========================================
// VISTAS DE CÁMARA (1ª persona, 3ª, persecución, cine fijo)
// ==========================================
export function updateCameraViewVisibility() {
  const entry = getActiveEntry();
  const show = !!(entry && (entry.type === 'human' || entry.type === 'pet'));
  const ctrls = byId('cameraViewControls');
  if (ctrls) ctrls.style.display = show ? 'flex' : 'none';
}

export function setCamView(mode) {
  view.mode = mode;
  view.subjectId = null; // vista manual: sigue al objeto seleccionado
  controls.enabled = (mode === 'orbit');
  qsa('.view-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-view') === mode);
  });
  if (mode === 'orbit') setStatus('Vista libre (órbita).');
  else setStatus('Vista de cámara: ' + mode);
}

// Corte de cámara de la timeline: aplica una toma (modo + sujeto) al instante
export function cutCameraToShot(mode, subjectId, shot = null) {
  // Dolly: si la toma tiene fin de movimiento pero nunca se guardó el inicio,
  // el encuadre actual pasa a ser el inicio (el 💾 lo confirma después).
  if (shot && shot.camPosEnd && !shot.camPos && (mode === 'free' || mode === 'orbit' || mode === 'fixed')) {
    shot.camPos = [camera.position.x, camera.position.y, camera.position.z];
    shot.target = [controls.target.x, controls.target.y, controls.target.z];
  }
  if (mode === 'free') {
    // Vista Libre: si la toma guarda un encuadre (el usuario lo dejó con 💾),
    // se restaura; si no, la cámara queda donde está — PERO si venimos de un
    // modo que posicionó la cámara de forma especial (FPV pegado a una cara,
    // aérea cenital), la posición heredada es inutilizable: la reencuadramos
    // retrocediendo desde donde mira y poniendo el objetivo delante.
    view.mode = 'orbit';
    view.subjectId = null;
    controls.enabled = true;
    if (shot && Array.isArray(shot.camPos) && Array.isArray(shot.target)) {
      camera.position.set(shot.camPos[0], shot.camPos[1], shot.camPos[2]);
      controls.target.set(shot.target[0], shot.target[1], shot.target[2]);
      camera.lookAt(controls.target);
    }
    // Si la cámara quedó "pegada" (venía de FPV/third/aerial): reencuadre
    // de emergencia para que la Vista Libre sea usable — mirar adelante y
    // alejarse un poco (la posición relativa se mantiene razonable).
    const dist = camera.position.distanceTo(controls.target);
    if (dist < 0.4 || !isFinite(dist)) {
      // Objetivo inválido o pegadísimo: recalcularlo delante de la cámara
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      controls.target.copy(camera.position).addScaledVector(dir, 3.5);
      // Y retroceder la cámara para no estar dentro del objetivo
      camera.position.subScaledVector(dir, 1.2);
    }
    return;
  }
  if (mode === 'fixed' && shot && Array.isArray(shot.camPos) && Array.isArray(shot.target)) {
    // Toma FIJA: posición de cámara y punto objetivo definidos por la toma
    // (planos cerrados, zooms de detalle). La cámara queda clavada ahí.
    view.mode = 'orbit';   // el loop no la toca: orbit solo hace controls.update()
    view.subjectId = null;
    controls.enabled = false;
    camera.position.set(shot.camPos[0], shot.camPos[1], shot.camPos[2]);
    controls.target.set(shot.target[0], shot.target[1], shot.target[2]);
    camera.lookAt(controls.target);
    return;
  }
  view.mode = mode;
  view.subjectId = subjectId || null;
  controls.enabled = (mode === 'orbit');
  updateCinematicCamera(true);
}

const _camTmp = new THREE.Vector3();
const _aerialCenter = new THREE.Vector3();
// ==========================================
// DOLLY / ZOOM DENTRO DE LA TOMA (backlog #6)
// ==========================================
// La toma guarda un encuadre de FIN (camPosEnd/targetEnd, como el de inicio):
// durante la toma la cámara interpola inicio→fin (ej. acercarse al rack EN el
// plano, no con dos cortes). Vale para free/orbit/fixed (encuadre guardado).
const DOLLY_MODES = ['free', 'orbit', 'fixed'];

// Encuadre interpolado en el instante t (puro, testeable): null sin movimiento.
export function shotDollyAt(shot, t) {
  if (!shot || !Array.isArray(shot.camPosEnd) || !Array.isArray(shot.targetEnd)) return null;
  if (!Array.isArray(shot.camPos) || !Array.isArray(shot.target)) return null;
  if (!(shot.duration > 0)) return null;
  const k = Math.max(0, Math.min(1, (t - shot.start) / shot.duration));
  const e = k * k * (3 - 2 * k); // smoothstep: arranca y frena suave
  const mix3 = (a, b) => [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e];
  return { pos: mix3(shot.camPos, shot.camPosEnd), target: mix3(shot.target, shot.targetEnd) };
}

// Aplica el dolly a la cámara (reproducción y scrub): true si se aplicó.
export function applyShotDolly(shot, t) {
  if (!shot || !DOLLY_MODES.includes(shot.camMode)) return false;
  const f = shotDollyAt(shot, t);
  if (!f) return false;
  camera.position.set(f.pos[0], f.pos[1], f.pos[2]);
  controls.target.set(f.target[0], f.target[1], f.target[2]);
  camera.lookAt(controls.target);
  return true;
}

// Marcar el encuadre actual como FIN del movimiento de la toma seleccionada.
export function markShotDollyEnd() {
  const shot = timelineBus.getSelectedShot();
  if (!shot || !DOLLY_MODES.includes(shot.camMode)) return false;
  if (!Array.isArray(shot.camPos) || !Array.isArray(shot.target)) {
    shot.camPos = [camera.position.x, camera.position.y, camera.position.z];
    shot.target = [controls.target.x, controls.target.y, controls.target.z];
  }
  shot.camPosEnd = [camera.position.x, camera.position.y, camera.position.z];
  shot.targetEnd = [controls.target.x, controls.target.y, controls.target.z];
  return true;
}

export function clearShotDolly() {
  const shot = timelineBus.getSelectedShot();
  if (!shot) return false;
  const had = Array.isArray(shot.camPosEnd);
  delete shot.camPosEnd;
  delete shot.targetEnd;
  return had;
}
function getAerialCenter() {
  // Centro aproximado de la escena: promedio de personajes visibles
  let n = 0;
  _aerialCenter.set(0, 0, 0);
  interactiveRegistry.forEach(entry => {
    if (entry.type === 'human' || entry.type === 'pet') {
      _aerialCenter.x += entry.group.position.x;
      _aerialCenter.z += entry.group.position.z;
      n++;
    }
  });
  if (n > 0) _aerialCenter.multiplyScalar(1 / n);
  return _aerialCenter;
}

export function updateCinematicCamera(snap = false) {
  if (view.mode === 'aerial') {
    const c = getAerialCenter();
    const camPos = _camTmp.set(c.x + 4, 16, c.z + 10);
    const look = new THREE.Vector3(c.x, 0, c.z);
    if (snap) {
      camera.position.copy(camPos);
      controls.target.copy(look);
    } else {
      camera.position.lerp(camPos, 0.18);
      controls.target.lerp(look, 0.25);
    }
    camera.lookAt(controls.target);
    return;
  }
  const entry = interactiveRegistry.get(view.subjectId) || getActiveEntry();
  if (!entry) return;
  const obj = entry.group;
  const p = obj.position;
  const ry = obj.rotation.y;
  const fwd = _camTmp.set(Math.sin(ry), 0, Math.cos(ry));
  // Perpendicular a la mirada en el plano XZ (para la vista de perfil)
  const right = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
  const camPos = new THREE.Vector3();
  const look = new THREE.Vector3(p.x, p.y + 1.0, p.z);
  if (view.mode === 'fpv') {
    // Altura de ojos según el sujeto: mascotas ven cerca del piso
    const eyeH = entry.type === 'pet' ? 0.65 : 1.65;
    camPos.set(p.x, p.y + eyeH, p.z).addScaledVector(fwd, 0.15);
    look.set(p.x, p.y + (eyeH - 0.05), p.z).add(fwd);
  } else if (view.mode === 'third') {
    camPos.copy(p).addScaledVector(fwd, -3.0); camPos.y = p.y + 2.0;
  } else if (view.mode === 'front') {
    // Cámara de frente a la cara, cerca: se aleja un metro en la dirección de
    // la mirada y enfoca la cara (a la altura de la cabeza).
    const faceH = entry.type === 'pet' ? 0.65 : 1.6;
    camPos.copy(p).addScaledVector(fwd, 1.0); camPos.y = p.y + faceH;
    look.copy(p).addScaledVector(fwd, 0.35); look.y = p.y + faceH;
  } else if (view.mode === 'profile') {
    // Cámara de costado, cerca de la cara: perpendicular a la mirada y a la
    // misma altura; la cara queda de perfil en el encuadre.
    const faceH = entry.type === 'pet' ? 0.55 : 1.55;
    camPos.copy(p).addScaledVector(right, 1.0); camPos.y = p.y + faceH;
    look.copy(p).addScaledVector(right, 0.1); look.y = p.y + faceH;
  } else if (view.mode === 'top') {
    camPos.copy(p).addScaledVector(fwd, -4.0); camPos.y = p.y + 6.0;
    look.set(p.x, p.y + 0.5, p.z);
  } else if (view.mode === 'cine1') {
    camPos.set(p.x + 3.5, p.y + 1.0, p.z + 3.5);
  } else if (view.mode === 'cine2') {
    camPos.set(p.x - 3.0, p.y + 0.9, p.z + 2.5);
    look.set(p.x, p.y + 1.1, p.z);
  } else if (view.mode === 'cine3') {
    camPos.set(p.x, p.y + 5.0, p.z + 6.0);
    look.set(p.x, p.y + 0.8, p.z);
  }
  if (snap) {
    camera.position.copy(camPos);
    controls.target.copy(look);
  } else {
    camera.position.lerp(camPos, 0.18);
    controls.target.lerp(look, 0.25);
  }
  camera.lookAt(controls.target);
}

// En vista PRIMERA PERSONA ocultamos la cabeza del personaje seguido: como la
// cámara se coloca a la altura de los ojos, de otro modo se vería la nariz,
// la cara o el cuello del propio personaje (objetos raros en la vista FPV).
// Al salir de FPV (o cambiar de sujeto) restauramos todas las cabezas.
let fpvHiddenHead = null;
function fpvHeadOf(entry) {
  if (!entry || !entry.rig || !entry.rig.parts) return null;
  return entry.rig.parts.h_head || entry.rig.parts.d_head || entry.rig.parts.c_head || null;
}
export function syncFpvHead() {
  if (fpvHiddenHead) { fpvHiddenHead.visible = true; fpvHiddenHead = null; }
  if (view.mode !== 'fpv') return;
  const entry = interactiveRegistry.get(view.subjectId) || getActiveEntry();
  const head = fpvHeadOf(entry);
  if (head) { head.visible = false; fpvHiddenHead = head; }
}

// ==========================================
// PREVISIÓN DETERMINISTA DE RECORRIDOS (SCRUB)
// ==========================================
const previewCache = new WeakMap();

function getPreviewPath(stored) {
  const speed = typeof stored.speed === 'number' ? stored.speed : cinema.speed;
  let pv = previewCache.get(stored);
  if (pv && pv.speedUsed === speed) return pv;

  const p0 = stored.waypoints[0];
  const p0x = p0.x !== undefined ? p0.x : p0[0];
  const p0z = p0.z !== undefined ? p0.z : p0[2];
  let maxSpan = 0;
  for (let i = 0; i < stored.waypoints.length; i++) {
    const p = stored.waypoints[i];
    const px = p.x !== undefined ? p.x : p[0];
    const pz = p.z !== undefined ? p.z : p[2];
    maxSpan = Math.max(maxSpan, Math.hypot(px - p0x, pz - p0z));
  }
  const isStationary = maxSpan < 0.25 || speed <= 0;

  const solved = isStationary ? stored.waypoints : solvePath(stored.waypoints, stored.planeY);
  const curve = cinemaBuildCurveFrom(solved);
  if (!curve) return null;
  let length = 0;
  try { length = curve.getLength(); } catch (err) { length = 0; }
  if (!(length > 0)) return null;

  const delay = typeof stored.delay === 'number' ? stored.delay : 0;
  const moveDur = length / Math.max(0.1, speed);
  const events = [];
  Object.keys(stored.events || {}).forEach(k => {
    const i = parseInt(k, 10);
    const ev = stored.events[k];
    if (!ev || i < 0 || i >= stored.waypoints.length) return;
    if (!ev.action && !(ev.wait > 0)) return;
    events.push({ u: cinemaWaypointU(curve, stored.waypoints[i]), action: ev.action || null, wait: ev.wait || 0, sitAt: ev.sitAt || null });
  });
  events.sort((a, b) => a.u - b.u);

  const segments = [];
  let cursor = delay;
  let prevU = 0;
  let moveAction = isStationary ? ((events[0] && events[0].action) || 'idle') : (speed >= 3.5 ? 'run' : 'walk');
  let ladderDrop = null;

  events.forEach(ev => {
    const arrive = cursor + Math.max(0, ev.u - prevU) * moveDur;
    if (arrive > cursor) segments.push({ type: 'move', t0: cursor, t1: arrive, u0: prevU, u1: ev.u, action: moveAction });
    cursor = arrive;
    if (ev.action === 'shoulder_lift') moveAction = 'shoulder_carry';
    else if (ev.action === 'shoulder_drop') {
      moveAction = 'walk';
      try { ladderDrop = { time: cursor, pos: curve.getPointAt(THREE.MathUtils.clamp(ev.u, 0, 1)) }; } catch (err) { /* sin posición */ }
    }
    if (ev.wait > 0) {
      segments.push({ type: 'wait', t0: cursor, t1: cursor + ev.wait, u: ev.u, action: ev.action || moveAction, sitAt: ev.sitAt || null });
      cursor += ev.wait;
    } else if (ev.action) {
      // Evento SIN espera pero con acción (ej. "talk" al pasar, sin parar):
      // la acción se MANTIENE mientras el recorrido sigue — igual que el
      // playback en vivo (render.js la aplica y ningún segmento la pisa).
      // Así el lip-sync de una respuesta en marcha sí se ve en la escena.
      moveAction = ev.action;
    }
    prevU = ev.u;
  });

  if (prevU < 1) {
    const end = cursor + (1 - prevU) * moveDur;
    if (end > cursor) segments.push({ type: 'move', t0: cursor, t1: end, u0: prevU, u1: 1, action: moveAction });
    cursor = end;
  }

  const last = events.length ? events[events.length - 1] : null;
  pv = {
    curve, length, speedUsed: speed, delay, moveDur, segments,
    endAction: (last && last.u > 0.9 && last.action) ? last.action : null,
    totalEnd: cursor, loop: !!stored.loop, ladderDrop,
    planeY: stored.planeY || 0,
    isStationary
  };
  previewCache.set(stored, pv);
  return pv;
}

function samplePreviewPath(pv, t, entry) {
  const initialAction = (entry && entry.initialState && entry.initialState.action) || 'idle';
  if (!pv) return { u: 0, action: initialAction };
  if (t < pv.delay) return { u: 0, action: initialAction };
  let tAbs = t;
  if (pv.loop) {
    const cycle = Math.max(0.001, pv.totalEnd - pv.delay);
    tAbs = pv.delay + ((t - pv.delay) % cycle);
  } else if (t >= pv.totalEnd) {
    return { u: 1, action: pv.endAction || initialAction };
  }
  for (const seg of pv.segments) {
    if (tAbs >= seg.t0 && tAbs < seg.t1) {
      if (seg.type === 'wait') {
        // Espera en un asiento (sit_at): el personaje queda SENTADO en la
        // silla elegida (pose del ancla + 180° como el playback en vivo).
        if (seg.sitAt) {
          const seats = anchorSeats('seat_' + seg.sitAt);
          const spot = seats[0] || null;
          if (spot) return { u: seg.u, action: 'sit', seatPose: spot };
        }
        return { u: seg.u, action: seg.action };
      }
      const f = (tAbs - seg.t0) / Math.max(0.0001, seg.t1 - seg.t0);
      return { u: seg.u0 + (seg.u1 - seg.u0) * f, action: seg.action };
    }
  }
  return { u: 1, action: pv.endAction || initialAction };
}

// Ley del suelo sólido para la evaluación determinista: el origen del rig
// nunca queda por debajo de su suelo (getMinGroundY de collision.js). Los
// sentados/acostados pueden bajar (su "piso" es el asiento/cama, fijado por
// el ancla de su silla con la fórmula seatY - 0.48).
function applyFloorLaw(entry, y) {
  return Math.max(y, getMinGroundY(entry));
}

export function evaluateAllPathsAt(t) {
  if (stepLadder) {
    stepLadder.position.set(STEP_LADDER_ORIGIN[0], STEP_LADDER_ORIGIN[1], STEP_LADDER_ORIGIN[2]);
    stepLadder.visible = true;
  }
  // Pista 🧍 PERSONAJES: acciones definidas por bloques (la fuente de verdad
  // de QUÉ hace cada personaje; los recorridos solo mueven). Si un personaje
  // tiene acción de bloque, esa manda; si no, aplica la de su recorrido.
  const blockActions = charActionsAt(t);
  // Poses guardadas por cuadro (💾): dónde quedó cada personaje en cada
  // bloque. Sin recorrido, el personaje aparece en su pose vigente (salto
  // entre cuadros incluido) y la conserva cuando la escena sigue sin bloques.
  const blockPoses = charPoseAt(t);
  interactiveRegistry.forEach((entry, id) => {
    if (!(entry.type === 'human' || entry.type === 'pet')) return;
    const ba = blockActions.get(id);
    const pose = blockPoses.get(id);
    // Sin contenido en la pista (ni acción ni pose vigentes): no se toca,
    // queda donde está en el editor — como siempre.
    if (!ba && !pose) return;
    if (ba) {
      if (entry.rig && entry.rig.currentAction !== ba.action) {
        entry.rig.setAction(ba.action);
      }
      if (entry.rig && ba.mood && entry.rig.setMood) {
        entry.rig.setMood(ba.mood);
      }
    }
    // Sin recorrido: el personaje queda en su pose de bloque, en su lugar.
    // La pose se aplica aunque la acción del cuadro ya haya expirado (ej.
    // hablar): el último lugar se conserva siempre hasta que otro cuadro,
    // un recorrido o el estado inicial lo cambien.
    const stored = cinemaPaths.get(id);
    if (!stored || !stored.waypoints || stored.waypoints.length < 2) {
      if (pose && pose.pos) {
        entry.group.position.set(pose.pos[0], applyFloorLaw(entry, pose.pos[1]), pose.pos[2]);
        if (pose.rotY !== undefined) entry.group.rotation.y = pose.rotY;
        return;
      }
      const st = entry.initialState;
      if (st && st.pos) {
        entry.group.position.set(st.pos[0], applyFloorLaw(entry, st.pos[1]), st.pos[2]);
        if (st.rotY !== undefined) entry.group.rotation.y = st.rotY;
      }
    }
  });
  cinemaPaths.forEach((stored, id) => {
    const entry = interactiveRegistry.get(id);
    if (!entry || !stored.waypoints || stored.waypoints.length < 2) return;
    const pv = getPreviewPath(stored);
    const s = samplePreviewPath(pv, t, entry);
    if (!pv) {
      entry.group.position.set(stored.waypoints[0].x, stored.planeY || 0, stored.waypoints[0].z);
      if (entry.rig) entry.rig.setAction(s.action);
      return;
    }
    if (pv.isStationary) {
      const st = entry.initialState;
      if (st && st.pos) {
        entry.group.position.set(st.pos[0], applyFloorLaw(entry, st.pos[1]), st.pos[2]);
        entry.group.rotation.y = st.rotY !== undefined ? st.rotY : 0;
      }
    } else {
      let pos, tan;
      if (s.seatPose) {
        // Sentado en su asiento (evento sit_at en escena): pose del ancla,
        // mirando al frente de la silla (rotY + 180°, como sitAtAnchor).
        pos = { x: s.seatPose.x, z: s.seatPose.z };
        tan = null;
      } else {
        try {
          const cu = THREE.MathUtils.clamp(s.u, 0, 1);
          pos = pv.curve.getPointAt(cu);
          tan = pv.curve.getTangentAt(cu);
        } catch (err) {
          pos = stored.waypoints[0];
          tan = { x: 0, z: 1 };
        }
      }
      entry.group.position.set(pos.x, applyFloorLaw(entry, s.seatPose ? 0 : pv.planeY), pos.z);
      if (s.seatPose) {
        entry.group.rotation.y = s.seatPose.rotY + Math.PI;
      } else if (tan && (tan.x || tan.z)) {
        entry.group.rotation.y = Math.atan2(tan.x, tan.z);
      }
    }
    if (entry.rig) {
      // La acción de un bloque de 🧍 PERSONAJES pisa la del recorrido: la
      // pista de bloques es la fuente de verdad de las acciones.
      const ba = blockActions.get(id);
      const act = (ba && ba.action) ? ba.action : (s.action || 'idle');
      entry.rig.setAction(act);
      const natural = act === 'run' ? (entry.rig.naturalRun || 4.5) : (entry.rig.naturalWalk || 1.8);
      entry.rig.cadence = THREE.MathUtils.clamp(pv.speedUsed / natural, 0.6, 2.0);
    }
    if (pv.ladderDrop && id === 'human1' && t >= pv.ladderDrop.time) {
      stepLadder.position.set(pv.ladderDrop.pos.x, 0, pv.ladderDrop.pos.z + 0.5);
      stepLadder.visible = true;
    }
  });
}

export {
  cinemaStorePath, cinemaLoadTarget, cinemaActivate, cinemaDeactivate,
  cinemaClearPath, cinemaTogglePlay, startAllPlaybacks, stopAllPlaybacks,
  cinemaSetMode, refreshCinemaUI, updateCinemaCharList, fixCameraVisibility,
  cinemaClearVisuals, cinemaClearAllVisuals
};

// ==========================================
// CÁMARAS FIJAS: línea de vista libre (nada tapa al personaje)
// ==========================================
// Una toma fija con camPos/target queda inútil si la cámara está detrás de
// una pared o de un mueble que tape al personaje. Esta función revisa el
// segmento cámara→objetivo contra los colliders de paredes y, si hay algo en
// el medio, ACorta la cámara hacia el objetivo hasta verlo (después un
// paso de "zoom de emergencia" se queda). Usar al crear/editar una toma.
function fixCameraVisibility(camPosIn, targetIn) {
  const cp = new THREE.Vector3(camPosIn[0], camPosIn[1], camPosIn[2]);
  const tp = new THREE.Vector3(targetIn[0], targetIn[1], targetIn[2]);
  const dir = new THREE.Vector3().subVectors(tp, cp);
  const len = dir.length();
  if (len < 0.01) return { camPos: camPosIn, target: targetIn, changed: false };
  dir.normalize();
  const walls = [...getWallColliders(), ...getDoorColliders()];
  // Intersección del rayo cámara→objetivo contra las cajas de paredes
  const hitWall = (rayOrigin, rayDir, maxT) => {
    let minT = Infinity;
    walls.forEach(b => {
      // AABB 2D en el plano XZ con el piso de la pared (se sube hasta y ~1.9)
      const ax = [b.minX, 1.0, b.minZ], aw = [b.maxX - b.minX, 0.9, b.maxZ - b.minZ];
      const inv = new THREE.Vector3(1 / rayDir.x, 1 / rayDir.y, 1 / rayDir.z);
      let tmin = 0, tmax = maxT;
      ['x', 'z'].forEach(k => {
        const d0 = (ax[k === 'x' ? 0 : 2] - rayOrigin[k]) * inv[k === 'x' ? 'x' : 'z'];
        const d1 = (ax[k === 'x' ? 0 : 2] + aw[k === 'x' ? 0 : 2] - rayOrigin[k]) * inv[k === 'x' ? 'x' : 'z'];
        const t0 = Math.min(d0, d1), t1 = Math.max(d0, d1);
        tmin = Math.max(tmin, t0); tmax = Math.min(tmax, t1);
      });
      const hy = ax[1], hh = aw[1];
      const y0 = (hy - hh / 2 - rayOrigin.y) * inv.y, y1 = (hy + hh / 2 - rayOrigin.y) * inv.y;
      tmin = Math.max(tmin, Math.min(y0, y1)); tmax = Math.min(tmax, Math.max(y0, y1));
    });
    return minT;
  };
  let cam = cp.clone();
  let changed = false;
  // Acercar la cámara hacia el objetivo hasta que la línea de vista quede libre
  for (let i = 0; i < 12; i++) {
    const segLen = cam.distanceTo(tp);
    if (segLen < 0.05) { changed = true; break; }
    const ray = new THREE.Vector3().subVectors(tp, cam).normalize();
    // Con todas las paredes, probar el cruce
    let anyHit = false;
    for (const b of walls) {
      if (segmentIntersectsBox(cam, ray, b, segLen)) { anyHit = true; break; }
    }
    if (!anyHit) break;
    changed = true;
    cam.addScaledVector(ray, segLen * 0.18); // acercar un 18% del tramo faltante
  }
  return { camPos: cam.toArray(), target: targetIn, changed };
}

// ¿El segmento (origin, dir, len) cruza la caja AABB (pared) en XZ/Y?
function segmentIntersectsBox(origin, dir, box, segLen) {
  // AABB 3D aproximada (se limita a XZ con un poco de y para cubrir la pared)
  const min = { x: box.minX, y: 0.0, z: box.minZ };
  const max = { x: box.maxX, y: 2.1, z: box.maxZ };
  let tmin = 0, tmax = segLen;
  const inv = { x: 1 / dir.x, y: 1 / (dir.y || 1e-9), z: 1 / dir.z };
  for (const ax of ['x', 'y', 'z']) {
    const d0 = (min[ax] - origin[ax]) * inv[ax], d1 = (max[ax] - origin[ax]) * inv[ax];
    const t0 = Math.min(d0, d1), t1 = Math.max(d0, d1);
    tmin = Math.max(tmin, t0); tmax = Math.min(tmax, t1);
    if (tmax < tmin) return false;
  }
  return tmin >= 0 && tmin <= segLen;
}