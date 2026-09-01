// Shared, mutable application state.
// Primitives that are reassigned live inside `store` (so they can be mutated
// through the imported binding). Object-like singletons are exported directly
// and only mutated in place.

export const store = {
  activeTarget: null,
  currentEnv: 'office',
  // Nombre del proyecto abierto/guardado (P5: living en state para que la
  // timeline no dependa de projectFiles).
  projectName: null,
  // Modos de edición:
  editObjects: false,   // "✏ Editar Objetos" (legacy, ahora vía editMode)
  editBuilding: false,  // "Editar Edificio" (paredes y puertas) (legacy)
  buildingOnly: false,  // "👁 Solo edificio" (oculta mobiliario/equipo)
  trayDrawing: false,   // herramienta de dibujo de canaletas activa (trayDraw.js)
  editMode: 'personajes', // 'edificio' | 'objetos' | 'personajes' | 'subtitulos' | 'cinematica'
  // Id del objeto/personaje que se está arrastrando con el gizmo (o null).
  // Lo usa collision.js para NO empujarlo contra paredes durante el arrastre
  // (así se puede cruzar de un lado al otro); al soltar, se resuelve la
  // posición al lado más cercano (ver resolveDropAfterDrag).
  dragTargetId: null
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
export const playbackInstances = new Map(); // id -> { curve, length, planeY, reversed, speed, loop, progress, savedAction, endAction }

// Estado de vista de cámara
export const view = {
  mode: 'orbit', // orbit | fpv | third | top | cine1 | cine2 | cine3 | aerial
  // Sujeto que sigue la cámara (por defecto el objeto seleccionado)
  subjectId: null
};

// Bus de la timeline: cinematics.js no puede importar timeline.js (ciclo),
// así que timeline registra acá sus getters (se llena al evaluarse timeline).
export const timelineBus = { getSelectedShot: () => null };

// Secuenciador de escenas: línea de tiempo de tomas de cámara
export const timeline = {
  shots: [],     // { id, start, duration, camMode, subjectId, label, color }
  playing: false,
  paused: false, // pausa: congela la simulación sin reiniciar la escena
  time: 0,       // segundos transcurridos de la escena
  duration: 0,   // fin de la última toma
  activeShotId: null,
  recording: false,
  loopPlayback: false
};

// Carteles de pregunta (quiz) de la escena: bloques de la pista 📋 QUIZ.
// Cada cartel define su tramo [start, end] y la pregunta (question, 3
// opciones, correct, duration en segundos de cuenta regresiva). Puede haber
// varios en la misma escena (intercalados con subtítulos; mientras un cartel
// está en pantalla, los subtítulos de ese tramo no se dibujan).
// Compatibilidad: los proyectos viejos traían shot.quiz (cartel anclado a
// una toma); al abrirlos se migran a esta pista (ver projectFiles.js).
export const quizTrack = [];

// Velocidad de reproducción de escenas (control de usuario en la toolbar
// de la línea de tiempo): escala TODO el reloj de simulación (recorridos,
// esperas de waypoints, timeline y animaciones) de forma proporcional.
export const playback = { rate: 1 };

// "Hay cambios sin guardar": se marca en cada pushHistory() y se limpia al
// guardar / abrir / crear proyecto. La usa el flujo de proyecto nuevo.
export const sessionDirty = { value: false };

// Park lamps (filled by park.js, read by environment.js)
export const lampLights = [];
export const lampMeshes = [];

// Video recorder timing state (mutated by both recorder.js and render.js)
export const recorderState = {
  isRecording: false,
  recordTime: 0,
  recordDuration: 5
};
