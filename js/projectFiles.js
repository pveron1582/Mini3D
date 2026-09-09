import * as THREE from 'three';
import { byId, qs, qsa } from './dom.js';
import { store, cinema, cinemaPaths, interactiveRegistry, timeline, recorderState, sessionDirty, view, timelineBus, charBlocks, charFullRange } from './state.js';
import { controls } from './core.js';
import { getMinGroundY } from './collision.js';
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
import { setCharBlocks, clearCharBlockSelection } from './cinema/charTrack.js';
import { audioTracks, serializeAudioTracks, setAudioTracks, loadAudioData, clearAudio, renderAudioList } from './media/audio.js';
import { syncSpawned } from './catalog.js';
import {
  clearDefaultCharacters, restoreDefaultCharacters, areDefaultCharactersHidden,
  syncCustomCharacters, clearCustomCharacters
} from './characters/characters.js';
import { populateOutliner, closeAllBarMenus } from './ui/ui.js';
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

// PERSISTENCIA DEL HANDLE (IndexedDB): los handles de archivo pueden
// guardarse en IndexedDB. Así, tras recargar la página y volver a abrir el
// mismo proyecto, "Guardar" sigue escribiendo directo en el archivo (un
// solo click para cambios progresivos) en vez de reabrir el explorador.
const IDB_NAME = 'mini3d';
const IDB_STORE = 'handles';
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbPut(key, value) {
  try {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) { /* sin IDB: el guardado directo solo dura la sesión */ }
}
async function idbGet(key) {
  try {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) { return null; }
}
async function idbDel(key) {
  try {
    const db = await idbOpen();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) { /* best effort */ }
}

// Guarda el handle del proyecto actual (key fija: el último archivo usado).
async function rememberFileHandle(handle, projectName) {
  if (!handle || typeof handle.isSameEntry !== 'function') return;
  await idbPut('lastProject', { handle, name: projectName });
}
// Recupera el handle recordado y verifica que el permiso de escritura siga
// otorgado (si el usuario no lo concedió aún, se pide al primer guardado).
async function restoreFileHandle() {
  const rec = await idbGet('lastProject');
  if (!rec || !rec.handle) return null;
  return rec.handle;
}
async function forgetFileHandle() {
  await idbDel('lastProject');
}

export function getProjectName() { return store.projectName; }
export function setCurrentFileName(name) {
  store.projectName = name;
  updateMenuState();
}

// La API de File System Access (Chrome/Edge) permite recordar el archivo y
// reescribirlo en silencio; el resto de los navegadores usa la descarga.
function fsSupported() { return typeof window.showSaveFilePicker === 'function'; }

async function verifyPermission(fileHandle, readWrite = true) {
  if (!fileHandle) return false;
  const options = {};
  if (readWrite) options.mode = 'readwrite';
  try {
    if (typeof fileHandle.queryPermission === 'function') {
      if ((await fileHandle.queryPermission(options)) === 'granted') return true;
    }
    if (typeof fileHandle.requestPermission === 'function') {
      if ((await fileHandle.requestPermission(options)) === 'granted') return true;
    }
  } catch (err) {
    return false;
  }
  return false;
}

async function writeProjectToHandle(handle) {
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(serializeProject({ includeAudioData: true }), null, 2));
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
  setCharBlocks([], {});
  clearCharBlockSelection();
  clearAudio();
  // Proyecto nuevo en blanco: sin personajes por defecto ni personalizados
  clearDefaultCharacters();
  clearCustomCharacters();
  clearActiveTarget();
  // Proyecto nuevo: vaciar la capa de construcción (pisos/paredes/puertas/ventanas)
  clearConstruction();
  populateOutliner();
  setCurrentFileName(name);
  currentFileHandle = null;   // proyecto nuevo: el archivo se define al guardar
  forgetFileHandle();         // y el handle recordado ya no aplica
  sessionDirty.value = false;
  refreshTimelineUI();
  updateCinemaCharList();
}

export function serializeProject(opts = {}) {
  captureCharacterInitialStates();
  // Persistir el encuadre actual de la toma seleccionada (si guarda encuadre)
  if (timelineBus.saveSelectedFrame) timelineBus.saveSelectedFrame();
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
    // Personajes: si la aguja está en un instante > 0, su posición/acción
    // ACTUAL es de la cinemática (transitoria). Se guarda el estado base
    // (initialState) para que el proyecto abra con la pose de edición.
    const st = entry.initialState;
    if (st && st.pos && (entry.type === 'human' || entry.type === 'pet') && timeline.time > 0) {
      objects[id].pos = [round2(st.pos[0]), round2(st.pos[1]), round2(st.pos[2])];
      objects[id].rotY = round2(st.rotY || 0);
      if (st.action) objects[id].action = st.action;
    }
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
      colors: entry.group.userData.customCharacter.colors,
      kind: entry.group.userData.customCharacter.kind || 'human',
      pet: entry.group.userData.customCharacter.pet || undefined
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
      h: round2(g.userData.windowData.h),
      design: g.userData.windowData.design || undefined
    });
  });

  // Capa de construcción (Fase 1-2): pisos/paredes/puertas/ventanas del terreno
  const construction = serializeConstruction();
  const audioSer = serializeAudioTracks(!!opts.includeAudioData);

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
    // Pista 🧍 PERSONAJES: bloques de acciones por tramo (acción + ánimo por
    // personaje). Migración: los proyectos viejos sin esta pista generan sus
    // bloques desde los eventos de los recorridos (ver applyProject).
    charBlocks: charBlocks.length ? charBlocks.map(b => ({
      id: b.id,
      start: round2(b.start),
      duration: round2(b.duration),
      actions: b.actions
    })) : undefined,
    // Acción de TODA la escena por personaje (bloque base de su lane):
    // { [charId]: { action, mood } } — ej. empleados tecleando toda la escena.
    charFullRange: Object.keys(charFullRange).length ? Object.fromEntries(
      Object.keys(charFullRange).map(id => [id, {
        action: charFullRange[id].action,
        mood: charFullRange[id].mood || undefined
      }])
    ) : undefined,
    // Pistas de audio (música + efectos): la metadata siempre (es chica y va
    // también a los snapshots del undo); los dataURLs embebidos SOLO al
    // guardar el archivo (pesan MB y no deben duplicarse en el historial).
    audio: audioSer.tracks,
    ...(audioSer.data ? { audioData: audioSer.data } : {}),
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
        // Dolly dentro de la toma: encuadre de FIN (inicio→fin en el plano)
        camPosEnd: Array.isArray(s.camPosEnd) ? s.camPosEnd : undefined,
        targetEnd: Array.isArray(s.targetEnd) ? s.targetEnd : undefined,
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

// Actualiza el initialState de cada personaje al estado ACTUAL de la escena
// (posición, rotación y acción). Así, al dar Play o volver a cargar, los
// personajes arrancan exactamente como quedaron (sentados/parados, en su
// lugar) y no se revierten a la pose con la que se abrió el proyecto.
export function captureCharacterInitialStates() {
  // La aguja es la fuente de verdad de dónde están los personajes. Solo se
  // captura el "estado de edición" (la base que se guarda) con la aguja en 0
  // y sin reproducir/pausar: en otros instantes los personajes están en
  // poses de la cinemática (talk, caminando a mitad de recorrido) que NO son
  // su ubicación base, y guardarlas contaminaría la escena.
  if (timeline.playing || timeline.paused || timeline.time > 0) return;
  interactiveRegistry.forEach(entry => {
    if (!(entry.type === 'human' || entry.type === 'pet')) return;
    entry.initialState = {
      pos: [entry.group.position.x, entry.group.position.y, entry.group.position.z],
      rotY: entry.group.rotation.y,
      action: entry.rig ? entry.rig.currentAction : (entry.initialState ? entry.initialState.action : 'idle')
    };
  });
}

function downloadJSON(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName.endsWith('.json') ? fileName : fileName + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function flashSaveButton() {
  const btn = byId('btnSaveQuick');
  if (btn) {
    btn.classList.add('save-success');
    setTimeout(() => btn.classList.remove('save-success'), 800);
  }
}

function updateMenuState() {
  const save = byId('mnuSave');
  if (save) {
    save.classList.remove('disabled');
    save.textContent = store.projectName ? `💾 Guardar (${store.projectName})` : '💾 Guardar';
  }
  const quick = byId('btnSaveQuick');
  if (quick) {
    quick.disabled = false;
    quick.title = store.projectName ? `Guardar cambios en "${store.projectName}" (Ctrl+S)` : 'Guardar cambios (Ctrl+S)';
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
    rememberFileHandle(handle, store.projectName);   // recordarlo (IDB)
    try {
      await writeProjectToHandle(handle);
      sessionDirty.value = false;
      flashSaveButton();
      updateMenuState();
      setStatus(`💾 Escena guardada como "${store.projectName}".`);
    } catch (err) {
      setStatus('No se pudo escribir el archivo: ' + err.message);
    }
    return;
  }
  fallbackSaveAs();
}

// Alternativa para navegadores sin File System Access API (Firefox/Safari):
// si el proyecto YA TIENE nombre (abierto o guardado antes), guarda directo
// con ese nombre (descarga, sin volver a preguntar); si no, pide nombre.
function fallbackSaveAs() {
  const suggested = store.projectName || 'escena_' + new Date().toISOString().slice(0, 10);
  let name = suggested;
  if (!store.projectName) {
    const asked = window.prompt('Nombre del archivo de escena:', suggested);
    if (!asked) return;
    name = asked.trim();
  }
  store.projectName = name;
  downloadJSON(serializeProject({ includeAudioData: true }), store.projectName);
  sessionDirty.value = false;
  flashSaveButton();
  updateMenuState();
  setStatus(`💾 Cambios guardados en "${store.projectName}.json".`);
}

export async function saveProject() {
  if (cinema.active && cinema.targetId) cinemaStorePath(cinema.targetId);

  // 1) Si no hay handle en memoria pero el navegador soporta File System Access
  //    y hay un proyecto recordado en IndexedDB, intentar restaurarlo si coincide el nombre:
  if (!currentFileHandle && fsSupported() && store.projectName) {
    try {
      const restored = await restoreFileHandle();
      if (restored) {
        const restoredName = (restored.name || '').replace(/\.json$/i, '');
        if (restoredName === store.projectName) {
          currentFileHandle = restored;
        }
      }
    } catch (e) { /* continuar */ }
  }

  // 2) Si ya tenemos un archivo asignado en disco (abierto o guardado previamente):
  //    Escribir directo en 1 solo clic SIN abrir la ventana del explorador.
  if (currentFileHandle) {
    try {
      const hasPerm = await verifyPermission(currentFileHandle, true);
      if (!hasPerm) {
        throw new Error('Permiso de escritura no otorgado por el navegador.');
      }
      await writeProjectToHandle(currentFileHandle);
      sessionDirty.value = false;
      flashSaveButton();
      updateMenuState();
      setStatus(`💾 Cambios guardados en "${currentFileHandle.name}".`);
      return;
    } catch (err) {
      console.warn('Fallo al guardar en handle previo:', err);
      currentFileHandle = null;
      setStatus('No se pudo guardar directo en el archivo; elegí la ubicación.');
      await saveProjectAs();
      return;
    }
  }

  // 3) Si el navegador soporta File System Access pero aún NO se eligió un archivo
  //    en disco (ej. proyecto nuevo recién creado):
  //    Pedir ubicación UNA SOLA VEZ para crearlo y memorizar el handle.
  if (fsSupported()) {
    await saveProjectAs();
    return;
  }

  // 4) Fallback para navegadores sin File System Access API (ej. Firefox / Safari):
  if (store.projectName) {
    downloadJSON(serializeProject({ includeAudioData: true }), store.projectName);
    sessionDirty.value = false;
    flashSaveButton();
    updateMenuState();
    setStatus(`💾 Cambios guardados en "${store.projectName}.json".`);
    return;
  }
  // Primera vez y sin nombre en navegadores antiguos:
  saveProjectAs();
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
      // LEY DE SUELO SÓLIDO (mejoras_gemini.md): el Y del JSON es crudo (los
      // proyectos viejos traen 0). Normalizar contra el suelo mínimo de la
      // entidad DESPUÉS de setAction (la acción define si puede bajar, ej.
      // sentado). Así nadie abre con los pies enterrados.
      const minY = getMinGroundY(entry);
      if (entry.group.position.y < minY) entry.group.position.y = minY;
      if (entry.type === 'human' || entry.type === 'pet') {
        entry.initialState = {
          pos: [entry.group.position.x, entry.group.position.y, entry.group.position.z],
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

  // Pista 🧍 PERSONAJES: bloques de acciones + acción de toda la escena
  // (charFullRange). Si el proyecto no trae la pista (formato viejo), se
  // MIGRAN los eventos de los recorridos (waypoints) a bloques.
  if (Array.isArray(data.charBlocks)) {
    setCharBlocks(data.charBlocks, data.charFullRange || {});
  } else {
    setCharBlocks(migrateEventsToCharBlocks(data.paths || {}), {});
  }

  // Pistas de audio (música + efectos): metadata siempre; si el JSON trae el
  // audio embebido se decodifica en segundo plano. Sin clave `audio` (ej.
  // snapshot del undo) no se toca nada.
  if (Array.isArray(data.audio)) {
    setAudioTracks(data.audio);
    if (data.audioData) loadAudioData(data.audioData);
  } else {
    renderAudioList();
  }

  if (data.timeline) {
    timeline.shots = (data.timeline.shots || []).map((s, i) => ({
      id: 'shot' + (i + 1),
      start: s.start || 0,
      duration: Math.max(0.5, s.duration || 1),
      camMode: s.camMode || 'third',
      subjectId: s.subjectId || null,
      camPos: Array.isArray(s.camPos) ? s.camPos : undefined,
      target: Array.isArray(s.target) ? s.target : undefined,
      camPosEnd: Array.isArray(s.camPosEnd) ? s.camPosEnd : undefined,
      targetEnd: Array.isArray(s.targetEnd) ? s.targetEnd : undefined,
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

// MIGRACIÓN (formato viejo → pista 🧍 PERSONAJES): los eventos de waypoint
// de cada recorrido ({ índice: { action, wait } }) se convierten en bloques
// secuenciales: un bloque por acción, cuya duración es la espera del evento.
// Los recorridos quedan solo para el MOVIMIENTO; las acciones viven en la pista.
function migrateEventsToCharBlocks(paths) {
  const blocks = [];
  Object.keys(paths).forEach(charId => {
    const p = paths[charId];
    if (!p || !p.events) return;
    const events = p.events;
    let cursor = 0;
    let n = 0;
    Object.keys(events).map(k => parseInt(k, 10)).sort((a, b) => a - b).forEach(k => {
      const ev = events[k];
      if (!ev) return;
      const wait = ev.wait > 0 ? ev.wait : 0.5;
      const action = ev.action || (ev.sitAt ? 'sit' : 'idle');
      blocks.push({
        id: 'cb_' + charId + '_' + (++n),
        start: round2(cursor),
        duration: round2(wait),
        actions: { [charId]: { action } }
      });
      cursor += wait;
    });
  });
  // Ordenar por inicio para que el editor los muestre en secuencia
  blocks.sort((a, b) => a.start - b.start);
  return blocks;
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
      // Abierto vía input File (sin File System Access API): un File no da
      // permiso de escritura. Si el navegador SÍ tiene la API y este proyecto
      // ya se guardó antes con ella, restaurar su handle para que "Guardar"
      // siga siendo de un click.
      currentFileHandle = null;
      if (fsSupported()) {
        restoreFileHandle().then(restored => {
          if (restored && restored.name.replace(/\.json$/i, '') === store.projectName) {
            currentFileHandle = restored;
          }
        });
      }
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
    rememberFileHandle(handle, store.projectName);   // recordarlo (IDB)
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
  e.stopPropagation();
  // Click en una OPCIÓN del menú: no re-abrir el contenedor (la opción ya
  // cerró el menú). Solo el click en la pestaña "Archivo ▾" alterna.
  if (e.target.closest('.menu-option')) return;
  const wasOpen = menuArchivo.classList.contains('open');
  closeAllBarMenus();              // cierra Editar/Ayuda si estaban abiertos
  menuArchivo.classList.toggle('open', !wasOpen);
});
// (El cierre por click afuera es global en js/ui/ui.js — closeAllBarMenus.)

byId('mnuOpen')?.addEventListener('click', () => {
  closeAllBarMenus();               // la opción elegida cierra el menú
  openProjectPicker();
});
byId('mnuSaveAs')?.addEventListener('click', () => { closeAllBarMenus(); saveProjectAs(); });
byId('mnuSave')?.addEventListener('click', () => { closeAllBarMenus(); saveProject(); });
byId('mnuNew')?.addEventListener('click', () => { closeAllBarMenus(); });  // el resto lo maneja startup.js
byId('mnuClose')?.addEventListener('click', () => { closeAllBarMenus(); });  // ídem: startup.js cierra el proyecto
byId('projectFileInput')?.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) openProject(file);
  e.target.value = '';
});