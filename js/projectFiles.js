import * as THREE from 'three';
import { store, cinema, cinemaPaths, interactiveRegistry, timeline, recorderState } from './state.js';
import { setEnvironment } from './environment.js';
import { updateCinemaCharList, cinemaDeactivate } from './cinematics.js';
import { getWallTexture, wallTextureNames } from './office.js';
import { refreshTimelineUI, setShotCounter } from './timeline.js';
import { setStatus, mediaRecorder } from './recorder.js';

// ==========================================
// GUARDAR / ABRIR PROYECTO (JSON)
// ==========================================
// Serializa posiciones de todos los objetos, acciones de los personajes,
// recorridos cinemáticos (con eventos de waypoint) y tomas de la timeline.

let currentFileName = null;

export function serializeProject() {
  const objects = {};
  interactiveRegistry.forEach((entry, id) => {
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
      wall
    };
  });

  const paths = {};
  cinemaPaths.forEach((stored, id) => {
    paths[id] = {
      waypoints: stored.waypoints.map(v => [round2(v.x), round2(v.y), round2(v.z)]),
      planeY: round2(stored.planeY),
      events: stored.events || {}
    };
  });

  return {
    app: 'MiniStudio 3D',
    version: 1,
    env: store.currentEnv,
    objects,
    paths,
    timeline: {
      time: round2(timeline.time),
      shots: timeline.shots.map(s => ({
        start: round2(s.start),
        duration: round2(s.duration),
        camMode: s.camMode,
        subjectId: s.subjectId
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
  const save = document.getElementById('mnuSave');
  if (save) {
    save.classList.toggle('disabled', !currentFileName);
    save.textContent = currentFileName ? `💾 Guardar (${currentFileName})` : '💾 Guardar';
  }
}

export function saveProjectAs() {
  const suggested = currentFileName || 'escena_' + new Date().toISOString().slice(0, 10);
  const name = window.prompt('Nombre del archivo de escena:', suggested);
  if (!name) return;
  currentFileName = name.trim();
  downloadJSON(serializeProject(), currentFileName);
  updateMenuState();
  setStatus(`Escena guardada como "${currentFileName}.json".`);
}

export function saveProject() {
  if (!currentFileName) { saveProjectAs(); return; }
  downloadJSON(serializeProject(), currentFileName);
  setStatus(`Cambios guardados en "${currentFileName}.json".`);
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

  if (data.env) setEnvironment(data.env);

  if (data.objects) {
    interactiveRegistry.forEach((entry, id) => {
      const o = data.objects[id];
      if (!o || !Array.isArray(o.pos)) return;
      entry.group.position.set(o.pos[0], o.pos[1], o.pos[2]);
      entry.group.rotation.y = o.rotY || 0;
      const sc = o.scale || 1;
      entry.group.scale.set(sc, sc, sc);
      if (entry.rig && o.action) entry.rig.setAction(o.action);
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

  cinemaPaths.clear();
  if (data.paths) {
    Object.keys(data.paths).forEach(id => {
      const p = data.paths[id];
      cinemaPaths.set(id, {
        waypoints: p.waypoints.map(w => new THREE.Vector3(w[0], w[1], w[2])),
        planeY: p.planeY || 0,
        events: p.events || {}
      });
    });
  }
  cinema.events = {};

  if (data.timeline) {
    timeline.shots = (data.timeline.shots || []).map((s, i) => ({
      id: 'shot' + (i + 1),
      start: s.start || 0,
      duration: Math.max(0.5, s.duration || 1),
      camMode: s.camMode || 'third',
      subjectId: s.subjectId || null,
      label: '',
      color: SHOT_COLORS_FOR_LOAD(i)
    }));
    timeline.time = data.timeline.time || 0;
  }
  setShotCounter(timeline.shots.length);

  updateCinemaCharList();
  refreshTimelineUI();
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
      currentFileName = file.name.replace(/\.json$/i, '');
      updateMenuState();
      setStatus(`Escena "${currentFileName}" abierta.`);
    } catch (err) {
      setStatus('Error al abrir el archivo: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ---------- Menú Archivo ----------
const menuArchivo = document.getElementById('menuArchivo');
const dropdown = document.getElementById('menuArchivoDropdown');

menuArchivo?.addEventListener('click', (e) => {
  menuArchivo.classList.toggle('open');
  e.stopPropagation();
});
document.addEventListener('click', () => menuArchivo?.classList.remove('open'));

document.getElementById('mnuOpen')?.addEventListener('click', () => {
  document.getElementById('projectFileInput')?.click();
});
document.getElementById('mnuSaveAs')?.addEventListener('click', saveProjectAs);
document.getElementById('mnuSave')?.addEventListener('click', saveProject);
document.getElementById('projectFileInput')?.addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (file) openProject(file);
  e.target.value = '';
});
