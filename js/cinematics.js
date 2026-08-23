import * as THREE from 'three';
import { scene, camera, canvas, controls } from './core.js';
import { cinema, cinemaPaths, playbackInstances, view, interactiveRegistry } from './state.js';
import { getActiveObject, getActiveEntry, setActiveTarget } from './selection.js';
import { raycaster, getPointerNDC, projectPointerToPlane } from './gizmo.js';
import { setStatus } from './recorder.js';
import { solvePath } from './navigation.js';
import { pushHistory } from './undo.js';

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
  const hint = document.getElementById('cinemaHint');
  const editCtrls = document.getElementById('cinemaEditControls');
  const banner = document.getElementById('cinemaBanner');
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
  cinemaPaths.set(id, {
    waypoints: cinema.waypoints.map(v => v.clone()),
    planeY: cinema.planeY,
    events: Object.assign({}, cinema.events)
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
  }
  // Camino con esquivado automático: si un tramo cruza paredes u objetos,
  // se insertan puntos intermedios para rodearlos (el destino no cambia)
  const solved = solvePath(waypoints, planeY);
  const curve = cinemaBuildCurveFrom(solved);
  if (!curve) return false;
  const entry = interactiveRegistry.get(id);
  let savedAction = 'idle';
  let moveAction = 'walk';
  if (entry && entry.rig) {
    savedAction = entry.rig.currentAction;
    // Velocidad constante en m/s: la duración crece con el recorrido.
    // La animación se adapta: por encima de ~3.5 m/s corre, y la cadencia
    // de las zancadas se sincroniza con la velocidad real.
    moveAction = opts.speed !== undefined && opts.speed >= 3.5 ? 'run' : 'walk';
    entry.rig.setAction(moveAction);
    const spd = opts.speed !== undefined ? opts.speed : cinema.speed;
    const natural = moveAction === 'run' ? (entry.rig.naturalRun || 4.5) : (entry.rig.naturalWalk || 1.8);
    entry.rig.cadence = THREE.MathUtils.clamp(spd / natural, 0.6, 2.0);
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
  playbackInstances.set(id, {
    curve,
    length: curve.getLength(),
    planeY: planeY,
    reversed: !!opts.reversed,
    speed: opts.speed !== undefined ? opts.speed : cinema.speed,
    loop: opts.loop !== undefined ? !!opts.loop : cinema.loop,
    progress: 0,
    savedAction,
    moveAction,
    cadence: entry && entry.rig ? entry.rig.cadence : 1,
    events: evts,
    waiting: 0,
    lastU: null
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
  const allBtn = document.getElementById('btnCinemaPlayAll');
  const editCtrls = document.getElementById('cinemaEditControls');
  if (allBtn) {
    allBtn.textContent = playbackInstances.size > 0 ? '⏹ Detener Todas las Cinemáticas' : '▶ Reproducir Todas las Cinemáticas';
  }
  if (editCtrls) {
    const hasPath = cinema.active && (cinema.waypoints.length >= 2 || cinemaPaths.has(cinema.targetId));
    const show = cinema.mode === 'edit' || cinema.mode === 'play' || playbackInstances.has(cinema.targetId) || hasPath;
    editCtrls.style.display = show ? 'flex' : 'none';
  }
  updateCinemaCharList();
}

// Lista por personaje (seleccionar / reproducir individual)
function updateCinemaCharList() {
  const list = document.getElementById('cinemaCharList');
  if (!list) return;
  const activeId = getActiveEntry() ? getActiveEntry().id : '';
  const entries = [];
  interactiveRegistry.forEach(entry => {
    if (entry.type === 'human' || entry.type === 'pet') entries.push(entry);
  });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  list.innerHTML = '';
  entries.forEach(entry => {
    const stored = cinemaPaths.get(entry.id);
    const hasPath = !!(stored && stored.waypoints && stored.waypoints.length >= 2);
    const playing = playbackInstances.has(entry.id);
    const row = document.createElement('div');
    row.className = 'cinema-char-row' + (entry.id === activeId ? ' selected' : '');
    row.setAttribute('data-id', entry.id);

    const icon = entry.type === 'human' ? '🧍' : '🐾';
    const name = document.createElement('span');
    name.className = 'cinema-char-name';
    name.textContent = icon + ' ' + entry.name;
    row.appendChild(name);

    // Botón Play (habilitado solo si tiene recorrido)
    const playBtn = document.createElement('button');
    playBtn.className = 'blender-btn cinema-char-play';
    playBtn.textContent = playing ? '⏸' : '▶';
    playBtn.disabled = !hasPath;
    playBtn.title = hasPath ? 'Reproducir recorrido' : 'Sin recorrido configurado';
    playBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (entry.id !== activeId) setActiveTarget(entry.id);
      togglePlayback(entry.id);
    });
    row.appendChild(playBtn);

    // Botón Activar/Desactivar cinemática (ícono, funciona como toggle)
    const isCinemaTarget = cinema.active && cinema.targetId === entry.id;
    const actBtn = document.createElement('button');
    actBtn.className = 'blender-btn cinema-char-icon-btn' + (isCinemaTarget ? ' primary' : '');
    actBtn.textContent = isCinemaTarget ? '🎥' : '🎬';
    actBtn.title = isCinemaTarget
      ? 'Terminar y guardar el recorrido de ' + entry.name
      : 'Activar cinemática para ' + entry.name;
    actBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      setActiveTarget(entry.id);
      if (cinema.active && cinema.targetId === entry.id) cinemaDeactivate();
      else cinemaActivate();
    });
    row.appendChild(actBtn);

    // Botón Borrar cinemática (ícono rojo)
    const delBtn = document.createElement('button');
    delBtn.className = 'blender-btn cinema-char-icon-btn cinema-char-del';
    delBtn.textContent = '✖';
    delBtn.disabled = !hasPath;
    delBtn.title = hasPath ? 'Borrar recorrido de ' + entry.name : 'Sin recorrido para borrar';
    delBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      cinemaDeletePathFor(entry.id);
    });
    row.appendChild(delBtn);

    row.addEventListener('click', () => {
      if (entry.id !== activeId) setActiveTarget(entry.id);
    });
    list.appendChild(row);
  });
}

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

// ==========================================
// VISTAS DE CÁMARA (1ª persona, 3ª, persecución, cine fijo)
// ==========================================
export function updateCameraViewVisibility() {
  const entry = getActiveEntry();
  const show = !!(entry && (entry.type === 'human' || entry.type === 'pet'));
  const ctrls = document.getElementById('cameraViewControls');
  if (ctrls) ctrls.style.display = show ? 'flex' : 'none';
}

export function setCamView(mode) {
  view.mode = mode;
  view.subjectId = null; // vista manual: sigue al objeto seleccionado
  controls.enabled = (mode === 'orbit');
  document.querySelectorAll('.view-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-view') === mode);
  });
  if (mode === 'orbit') setStatus('Vista libre (órbita).');
  else setStatus('Vista de cámara: ' + mode);
}

// Corte de cámara de la timeline: aplica una toma (modo + sujeto) al instante
export function cutCameraToShot(mode, subjectId) {
  if (mode === 'free') {
    // Vista Libre: la cámara queda exactamente donde el usuario la dejó
    view.mode = 'orbit';
    view.subjectId = null;
    controls.enabled = true;
    return;
  }
  view.mode = mode;
  view.subjectId = subjectId || null;
  controls.enabled = (mode === 'orbit');
  updateCinematicCamera(true);
}

const _camTmp = new THREE.Vector3();
const _aerialCenter = new THREE.Vector3();
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
  const camPos = new THREE.Vector3();
  const look = new THREE.Vector3(p.x, p.y + 1.0, p.z);
  if (view.mode === 'fpv') {
    // Altura de ojos según el sujeto: mascotas ven cerca del piso
    const eyeH = entry.type === 'pet' ? 0.65 : 1.65;
    camPos.set(p.x, p.y + eyeH, p.z).addScaledVector(fwd, 0.15);
    look.set(p.x, p.y + (eyeH - 0.05), p.z).add(fwd);
  } else if (view.mode === 'third') {
    camPos.copy(p).addScaledVector(fwd, -3.0); camPos.y = p.y + 2.0;
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

export {
  cinemaStorePath, cinemaLoadTarget, cinemaActivate, cinemaDeactivate,
  cinemaClearPath, cinemaTogglePlay, startAllPlaybacks, stopAllPlaybacks,
  cinemaSetMode, refreshCinemaUI, updateCinemaCharList
};
