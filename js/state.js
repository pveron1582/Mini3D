// Shared, mutable application state.
// Primitives that are reassigned live inside `store` (so they can be mutated
// through the imported binding). Object-like singletons are exported directly
// and only mutated in place.

export const store = {
  activeTarget: 'human1',
  currentEnv: 'office'
};

export const interactiveRegistry = new Map(); // id -> { id, name, group, type, rig }

export const cinema = {
  active: false,
  mode: 'off',        // off | pickStart | pickEnd | edit | play
  planeY: 0,
  targetId: null,
  waypoints: [],      // THREE.Vector3[]
  curve: null,
  length: 0,
  group: null,
  pathLine: null,
  markers: [],        // { mesh, index }
  playing: false,
  reversed: false,
  speed: 2,
  loop: true,
  progress: 0,        // segundos transcurridos
  savedAction: 'idle',
  dragging: -1,
  pressInfo: null,
  // Eventos por índice de waypoint: { [index]: { action, wait } }
  // Al pasar por ese punto, el personaje cambia de acción y espera `wait` seg.
  events: {}
};

// Recorridos guardados por cada objeto (persisten al cambiar de selección)
export const cinemaPaths = new Map(); // id -> { waypoints: [Vector3], planeY }

// Reproducciones activas (pueden correr varias a la vez)
export const playbackInstances = new Map(); // id -> { curve, length, planeY, reversed, speed, loop, progress, savedAction }

// Estado de vista de cámara
export const view = {
  mode: 'orbit', // orbit | fpv | third | top | cine1 | cine2 | cine3 | aerial
  // Sujeto que sigue la cámara (por defecto el objeto seleccionado)
  subjectId: null
};

// Secuenciador de escenas: línea de tiempo de tomas de cámara
export const timeline = {
  shots: [],     // { id, start, duration, camMode, subjectId, label, color }
  playing: false,
  time: 0,       // segundos transcurridos de la escena
  duration: 0,   // fin de la última toma
  activeShotId: null,
  recording: false
};

// Park lamps (filled by park.js, read by environment.js)
export const lampLights = [];
export const lampMeshes = [];

// Video recorder timing state (mutated by both recorder.js and render.js)
export const recorderState = {
  isRecording: false,
  recordTime: 0,
  recordDuration: 5
};
