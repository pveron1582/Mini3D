import * as THREE from 'three';
import { byId, qs, qsa } from './dom.js';
import { store, cinema, cinemaPaths, interactiveRegistry, timeline, recorderState, sessionDirty, view } from './state.js';
import { controls } from './core.js';
import { setEnvironment } from './environment.js';
import { updateCinemaCharList, cinemaDeactivate, cutCameraToShot, stopAllPlaybacks, cinemaStorePath } from './cinema/cinematics.js';
import { getWallTexture, wallTextureNames } from './office/walls.js';
import { windowGroups, syncWindows } from './office/walls.js';
import { getFloorTextureName, applyFloorTexture } from './office/floor.js';
import { serializeConstruction, syncConstruction, clearConstruction } from './construction.js';
import { setAlarm } from './office/alarm.js';
import { refreshTimelineUI, setShotCounter } from './cinema/timeline.js';
import { setStatus, mediaRecorder } from './media/recorder.js';
import { subtitleTrack, setSubtitles } from './media/subtitles.js';
import { quizTrack as quizLaneData } from './state.js';
import { bumpQuizCounter, renderQuizLane, clearQuizSelection } from './cinema/quizTrack.js';
import { syncSpawned } from './catalog.js';
import {
  clearDefaultCharacters, restoreDefaultCharacters, areDefaultCharactersHidden,
  syncCustomCharacters, clearCustomCharacters
} from './characters/characters.js';
import { populateOutliner } from './ui/ui.js';
import { clearActiveTarget } from './ui/selection.js';

// ==========================================
// GUARDAR / ABRIR PROYECTO (JSON)
// ==========================================
// Serializa posiciones de todos los objetos, acciones de los personajes,
// recorridos cinemáticos (con eventos de waypoint) y tomas de la timeline.

// Nombre del archivo actual vive en store.projectName (P5): la timeline lo lee
// sin depender de projectFiles.
// Handle del archivo ya elegido (File System Access API): cuando existe,
// "Guardar" reescribe el archivo directo sin volver a preguntar. Queda
// definido al ABRIR un proyecto o al GUARDAR por primera vez.
let currentFileHandle = null;

export function getProjectName() { return store.projectName; }
export function setCurrentFileName(name) {
  store.projectName = name;
  updateMenuState();
}

// La API de File System Access (Chrome/Edge) permite recordar el archivo y
// reescribirlo en silencio; el resto de los navegadores usa la descarga.
function fsSupported() { return typeof window.showSaveFilePicker === 'function'; }

async function writeProjectToHandle(handle) {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(serializeProject(), null, 2));
  await writable.close();
}

// Proyecto nuevo en blanco: limpia recorridos, tomas y subtítulos
export function newProject(name) {
  cinemaPaths.clear();
  cinema.events = {};
  timeline.shots.length = 0;
  timeline.time = 0;
  timeline.playing = false;
  timeline.paused = false;
  timeline.activeShotId = null;
  setSubtitles([]);
  // Proyecto nuevo en blanco: sin personajes por defecto ni personalizados
  clearDefaultCharacters();
  clearCustomCharacters();
  clearActiveTarget();
  // Proyecto nuevo: vaciar la capa de construcción (pisos/paredes/puertas/ventanas)
  clearConstruction();
  populateOutliner();
  setCurrentFileName(name);
  currentFileHandle = null;   // proyecto nuevo: el archivo se define al guardar
  sessionDirty.value = false;
  refreshTimelineUI();
  updateCinemaCharList();
}

export function serializeProject() {
  const objects = {};
  interactiveRegistry.forEach((entry, id) => {
    // Las piezas de la capa de construcción viajan en construction[] (abajo)
    if (entry.group.userData.conType) return;
    const wd = entry.group.userData.wallData;
    let wall = undefined;
    if (wd) {
      const mesh = entry.group.userData.wallMesh;
      const texName = wallTextureNames.find(n => mesh && mesh.material.map === getWallTexture(n));
      wall = { w: round2(wd.w), h: round2(wd.h), d: round2(wd.d), tex: texName || wallTextureNames[0] };
    }
    objects[id] = {
      pos: [round2(entry.group.position.x), round2(entry.group.position.y), round2(entry.group.position.z)],
      rotY: round2(entry.group.rotation.y),
      scale: round2(entry.group.scale.x),
      action: entry.rig ? entry.rig.currentAction : undefined,
      wall,
      deleted: entry.deleted || undefined
    };
  });

  // Objetos agregados desde el catálogo (P7): viajan aparte para poder
  // recrearse al abrir el proyecto (las fábricas viven en js/catalog.js).
  const spawned = [];
  interactiveRegistry.forEach((entry, id) => {
    if (!entry.group.userData.spawned) return;
    spawned.push({
      catalog: entry.group.userData.catalogId,
      id,
      name: entry.name,
      pos: [round2(entry.group.position.x), round2(entry.group.position.y), round2(entry.group.position.z)],
      rotY: round2(entry.group.rotation.y),
      scale: round2(entry.group.scale.x),
      // Datos extra de piezas paramétricas (ej. puntos de una canaleta dibujada)
      data: entry.group.userData.spawnData || undefined
    });
  });

  const characters = [];
  interactiveRegistry.forEach((entry, id) => {
    if (!entry.group.userData.customCharacter || entry.deleted) return;
    characters.push({
      id,
      name: entry.name,
      pos: [round2(entry.group.position.x), round2(entry.group.position.y), round2(entry.group.position.z)],
      rotY: round2(entry.group.rotation.y),
      colors: entry.group.userData.customCharacter.colors
    });
  });

  const paths = {};
  cinemaPaths.forEach((stored, id) => {
    paths[id] = {
      waypoints: stored.waypoints.map(v => [round2(v.x), round2(v.y), round2(v.z)]),
      planeY: round2(stored.planeY),
      events: stored.events || {},
      loop: stored.loop ? true : undefined,
      delay: stored.delay !== undefined ? round2(stored.delay) : undefined,
      speed: stored.speed !== undefined ? round2(stored.speed) : undefined
    };
  });

  // Ventanas agregadas desde el panel de edificio (P8): viajan aparte para
  // poder recrearse al abrir el proyecto (viven en js/office/walls.js).
  const windows = [];
  windowGroups.forEach(g => {
    if (!g.userData.spawnedWindow) return;
    windows.push({
      id: g.userData.windowId,
      name: g.userData.windowName,
      pos: [round2(g.position.x), round2(g.position.y), round2(g.position.z)],
      rotY: round2(g.rotation.y),
      w: round2(g.userData.windowData.w),
      h: round2(g.userData.windowData.h)
    });
  });

  // Capa de construcción (Fase 1-2): pisos/paredes/puertas/ventanas del terreno
  const construction = serializeConstruction();

  return {
    app: 'MiniStudio 3D',
    version: 1,
    env: store.currentEnv,
    floorTex: getFloorTextureName(),
    objects,
    spawned: spawned.length ? spawned : undefined,
    hideDefaultCharacters: areDefaultCharactersHidden() ? true : undefined,
    characters: characters.length ? characters : undefined,
    windows: windows.length ? windows : undefined,
    construction: construction.length ? construction : undefined,
    paths,
    subtitles: subtitleTrack.map(c => ({ start: round2(c.start), end: round2(c.end), text: c.text })),
    // Carteles de pregunta (pista 📋 QUIZ): varios, intercalados con los
    // subtítulos. Cada uno guarda su tramo [start, end] y la configuración.
    quizzes: quizLaneData.length ? quizLaneData.map(q => ({
      id: q.id,
      question: q.question,
      options: [...q.options],
      correct: q.correct ?? 0,
      duration: q.duration ?? 10,
      start: round2(q.start),
      end: round2(q.end)
    })) : undefined,
    timeline: {
      time: round2(timeline.time),
      shots: timeline.shots.map(s => ({
        start: round2(s.start),
        duration: round2(s.duration),
        camMode: s.camMode,
        subjectId: s.subjectId,
        // Toma fija (plano clavado / zoom): cámara y objetivo propios
        camPos: Array.isArray(s.camPos) ? s.camPos : undefined,
        target: Array.isArray(s.target) ? s.target : undefined,
        // Apertura de puertas de mini rack en la toma
        openDoor: s.openDoor ? true : undefined,
        // (Los carteles de pregunta viven en `quizzes[]`, la pista 📋 QUIZ;
        // el viejo `shot.quiz` se sigue leyendo por compatibilidad.)
        // Alarma de emergencia (balizas rojas)
        alarm: typeof s.alarm === 'boolean' ? s.alarm : undefined
      }))
    }
  };
}

function round2(n) { return Math.round(n * 100) / 100; }

function downloadJSON(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.json') ? fileName : fileName + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function updateMenuState() {
  const save = byId('mnuSave');
  if (save) {
    save.classList.toggle('disabled', !store.projectName);
    save.textContent = store.projectName ? `💾 Guardar (${store.projectName})` : '💾 Guardar';
  }
  // Nombre del proyecto abierto, visible en la barra superior
  const label = byId('projectNameLabel');
  if (label) {
    label.textContent = store.projectName ? '📅 ' + store.projectName : '';
    label.title = store.projectName ? 'Proyecto actual: ' + store.projectName : '';
    label.style.display = store.projectName ? '' : 'none';
  }
}

export async function saveProjectAs() {
  if (cinema.active && cinema.targetId) cinemaStorePath(cinema.targetId);
  if (fsSupported()) {
    const suggested = store.projectName || 'escena_' + new Date().toISOString().slice(0, 10);
    let handle;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: suggested.endsWith('.json') ? suggested : suggested + '.json',
        types: [{ description: 'Escena MiniStudio 3D', accept: { 'application/json': ['.json'] } }]
      });
    } catch (err) {
      if (err && err.name === 'AbortError') return; // usuario canceló
      fallbackSaveAs();
      return;
    }
    currentFileHandle = handle;
    store.projectName = handle.name.replace(/\.json$/i, '');
    try {
      await writeProjectToHandle(handle);
      sessionDirty.value = false;
      updateMenuState();
      setStatus(`Escena guardada como "${store.projectName}".`);
    } catch (err) {
      setStatus('No se pudo escribir el archivo: ' + err.message);
    }
    return;
  }
  fallbackSaveAs();
}

// Alternativa para navegadores sin File System Access API: pide nombre y descarga.
function fallbackSaveAs() {
  const suggested = store.projectName || 'escena_' + new Date().toISOString().slice(0, 10);
  const name = window.prompt('Nombre del archivo de escena:', suggested);
  if (!name) return;
  store.projectName = name.trim();
  downloadJSON(serializeProject(), store.projectName);
  sessionDirty.value = false;
  updateMenuState();
  setStatus(`Escena guardada como "${store.projectName}.json".`);
}

export async function saveProject() {
  if (cinema.active && cinema.targetId) cinemaStorePath(cinema.targetId);
  // Si el archivo ya quedó definido (al abrir o en el primer guardado),
  // se reescribe directo sin preguntar nada.
  if (currentFileHandle) {
    try {
      await writeProjectToHandle(currentFileHandle);
      sessionDirty.value = false;
      setStatus(`Cambios guardados en "${currentFileHandle.name}".`);
    } catch (err) {
      currentFileHandle = null;
      setStatus('No se pudo guardar; elegí la ubicación de nuevo.');
      saveProjectAs();
    }
    return;
  }
  // Sin archivo definido todavía (o navegador con API): el primer "Guardar"
  // funciona como "Guardar como" y deja la ruta establecida para el futuro.
  if (!store.projectName || fsSupported()) { saveProjectAs(); return; }
  downloadJSON(serializeProject(), store.projectName);
  sessionDirty.value = false;
  setStatus(`Cambios guardados en "${store.projectName}.json".`);
}

export function applyProject(data) {
  // Detener todo lo activo antes de restaurar
  if (timeline.playing || timeline.recording) {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    timeline.playing = false;
    timeline.recording = false;
    recorderState.isRecording = false;
  }
  cinemaDeactivate();
  stopAllPlaybacks();
  setAlarm(false);   // al cargar un proyecto la alarma queda apagada

  if (data.env) setEnvironment(data.env);
  if (data.floorTex) applyFloorTexture(data.floorTex);

  // Objetos agregados desde el catálogo (P7): recrear/ocultar según el snapshot
  // ANTES de aplicar transformaciones, para que las posiciones caigan sobre
  // los objetos correctos.
  syncSpawned(data.spawned || []);
  // Ventanas del edificio (P8)
  syncWindows(data.windows || []);
  // Capa de construcción (Fase 1-2): recrea pisos/paredes/puertas/ventanas
  syncConstruction(data.construction || []);

  if (data.hideDefaultCharacters) clearDefaultCharacters();
  else restoreDefaultCharacters();
  syncCustomCharacters(Array.isArray(data.characters) ? data.characters : []);

  if (data.objects) {
    interactiveRegistry.forEach((entry, id) => {
      const o = data.objects[id];
      if (!o || !Array.isArray(o.pos)) return;
      entry.group.position.set(o.pos[0], o.pos[1], o.pos[2]);
      entry.group.rotation.y = o.rotY || 0;
      const sc = o.scale || 1;
      entry.group.scale.set(sc, sc, sc);
      // Borrado suave (catálogo): restaurar visibilidad según el snapshot
      entry.deleted = !!o.deleted;
      entry.group.visible = !o.deleted;
      if (entry.rig && o.action) entry.rig.setAction(o.action);
      if (entry.type === 'human' || entry.type === 'pet') {
        entry.initialState = {
          pos: [o.pos[0], o.pos[1], o.pos[2]],
          rotY: o.rotY || 0,
          action: o.action || null
        };
      }
      // Restaurar dimensiones y textura de paredes
      if (o.wall && entry.group.userData.wallData) {
        const wd = entry.group.userData.wallData;
        wd.w = o.wall.w; wd.h = o.wall.h; wd.d = o.wall.d;
        entry.group.userData.wallMesh.scale.set(wd.w, wd.h, wd.d);
        entry.group.userData.wallMesh.material.map = getWallTexture(o.wall.tex);
        entry.group.userData.wallMesh.material.needsUpdate = true;
        entry.group.position.y = wd.h / 2;
      }
    });
  }

  // Si el objeto activo quedó borrado en el snapshot, deseleccionar; y
  // refrescar el outliner con los objetos creados/borrados del catálogo.
  const act = store.activeTarget ? interactiveRegistry.get(store.activeTarget) : null;
  if (store.activeTarget && (!act || act.deleted)) clearActiveTarget();
  populateOutliner();

  cinemaPaths.clear();
  if (data.paths) {
    Object.keys(data.paths).forEach(id => {
      const p = data.paths[id];
      cinemaPaths.set(id, {
        waypoints: p.waypoints.map(w => new THREE.Vector3(w[0], w[1], w[2])),
        planeY: p.planeY || 0,
        events: p.events || {},
        loop: p.loop ? true : undefined,
        delay: typeof p.delay === 'number' ? p.delay : undefined,
        speed: typeof p.speed === 'number' ? p.speed : undefined
      });
    });
  }
  cinema.events = {};

  // Subtítulos guardados con la escena
  setSubtitles(Array.isArray(data.subtitles) ? data.subtitles : []);

  // Carteles de pregunta (pista 📋 QUIZ). Compatibilidad: los proyectos viejos
  // traían el quiz anclado a una toma (shot.quiz); se migra a la pista con el
  // tramo de esa toma, así sigue apareciendo igual (y se puede mover/editar).
  quizLaneData.length = 0;
  clearQuizSelection();
  (Array.isArray(data.quizzes) ? data.quizzes : []).forEach((q, i) => {
    quizLaneData.push({
      id: q.id || ('quiz' + (i + 1)),
      question: q.question || '',
      options: Array.isArray(q.options) ? q.options.slice(0, 3) : [],
      correct: typeof q.correct === 'number' ? q.correct : 0,
      duration: Math.max(1, q.duration || 10),
      start: q.start || 0,
      end: Math.max((q.start || 0) + 0.5, q.end || (q.start || 0) + 10)
    });
  });
  bumpQuizCounter(quizLaneData.length);

  if (data.timeline) {
    timeline.shots = (data.timeline.shots || []).map((s, i) => ({
      id: 'shot' + (i + 1),
      start: s.start || 0,
      duration: Math.max(0.5, s.duration || 1),
      camMode: s.camMode || 'third',
      subjectId: s.subjectId || null,
      camPos: Array.isArray(s.camPos) ? s.camPos : undefined,
      target: Array.isArray(s.target) ? s.target : undefined,
      // Apertura de puertas de mini rack en la toma
      openDoor: s.openDoor ? true : undefined,
      // Migración del quiz legacy: si la toma traía quiz y no hay pista
      // (proyecto viejo), se crea el bloque con el tramo de esa toma.
      quiz: s.quiz || undefined,
      // Alarma de emergencia (balizas rojas)
      alarm: typeof s.alarm === 'boolean' ? s.alarm : undefined,
      label: '',
      color: SHOT_COLORS_FOR_LOAD(i)
    }));
    timeline.time = data.timeline.time || 0;
    // shot.quiz legacy → pista QUIZ (solo si no vino `quizzes` en el JSON)
    if (!Array.isArray(data.quizzes)) {
      timeline.shots.forEach(s => {
        if (s.quiz) {
          quizLaneData.push({
            id: 'quiz' + (quizLaneData.length + 1),
            question: s.quiz.question || '',
            options: Array.isArray(s.quiz.options) ? s.quiz.options.slice(0, 3) : [],
            correct: typeof s.quiz.correct === 'number' ? s.quiz.correct : 0,
            duration: Math.max(1, s.quiz.duration || 10),
            start: s.start,
            end: s.start + s.duration
          });
        }
      });
      bumpQuizCounter(quizLaneData.length);
    }
  }
  setShotCounter(timeline.shots.length);
  renderQuizLane();

  updateCinemaCharList();
  refreshTimelineUI();

  // Encuadrar la cámara en la PRIMERA toma al cargar: así se ve el arranque de
  // la escena (ej. los personajes hablando en la sala de sistemas) en lugar de
  // quedarse en la vista por defecto del centro del edificio. Re-habilitamos la
  // órbita para que el usuario pueda moverse con libertad tras cargar.
  if (timeline.shots.length > 0) {
    const first = timeline.shots[0];
    cutCameraToShot(first.camMode, first.subjectId, first);
    // La cámara queda en el encuadre de la primera toma pero en VISTA LIBRE:
    // el usuario puede moverla de inmediato. Al reproducir o mover la barra
    // roja vuelve al encuadre configurado de cada toma.
    view.mode = 'orbit';
    view.subjectId = null;
    controls.enabled = true;
  }
}

// Colores/contador de tomas al recargar (mantiene el ciclo de palette)
function SHOT_COLORS_FOR_LOAD(i) {
  const colors = ['#4772b3', '#3f9d6f', '#b3772e', '#8e5bb3', '#b3455c', '#4aa5a0'];
  return colors[i % colors.length];
}

export function openProject(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.app !== 'MiniStudio 3D') {
        setStatus('El archivo no parece una escena de MiniStudio 3D.');
        return;
      }
      applyProject(data);
      store.projectName = file.name.replace(/\.json$/i, '');
      sessionDirty.value = false;
      updateMenuState();
      setStatus(`Escena "${store.projectName}" abierta.`);
    } catch (err) {
      setStatus('Error al abrir el archivo: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// Abre un proyecto desde un handle ya elegido (File System Access API).
// Usado por openProjectPicker y por boot.js (que pide el archivo ANTES de
// cargar el editor).
export async function openProjectHandle(handle) {
  try {
    const file = await handle.getFile();
    const data = JSON.parse(await file.text());
    if (data.app !== 'MiniStudio 3D') {
      setStatus('El archivo no parece una escena de MiniStudio 3D.');
      return false;
    }
    applyProject(data);
    currentFileHandle = handle;
    store.projectName = handle.name.replace(/\.json$/i, '');
    sessionDirty.value = false;
    updateMenuState();
    setStatus(`Escena "${store.projectName}" abierta.`);
    return true;
  } catch (err) {
    setStatus('Error al abrir el archivo: ' + err.message);
    return false;
  }
}

// Abrir con el selector nativo (File System Access API): además de cargar la
// escena, recuerda el archivo para que "Guardar" no vuelva a preguntar.
export async function openProjectPicker() {
  if (!fsSupported()) {
    byId('projectFileInput')?.click();
    return;
  }
  let handle;
  try {
    [handle] = await window.showOpenFilePicker({
      types: [{ description: 'Escena MiniStudio 3D', accept: { 'application/json': ['.json'] } }],
      multiple: false
    });
  } catch (err) {
    if (err && err.name === 'AbortError') return; // usuario canceló
    byId('projectFileInput')?.click();
    return;
  }
  await openProjectHandle(handle);
}

// ---------- Menú Archivo ----------
const menuArchivo = byId('menuArchivo');
const dropdown = byId('menuArchivoDropdown');

menuArchivo?.addEventListener('click', (e) => {
  menuArchivo.classList.toggle('open');
  e.stopPropagation();
});
document.addEventListener('click', () => menuArchivo?.classList.remove('open'));

byId('mnuOpen')?.addEventListener('click', () => {
  openProjectPicker();
});
byId('mnuSaveAs')?.addEventListener('click', saveProjectAs);
byId('mnuSave')?.addEventListener('click', saveProject);
byId('projectFileInput')?.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) openProject(file);
  e.target.value = '';
});