// ==========================================
// MiniStudio 3D - Punto de entrada (orquestador)
// ==========================================
// Importar todos los módulos (efecto secundario: construyen escena, personajes,
// entornos y registran listeners). El orden de evaluución lo resuelve el grafo
// de dependencias de ES modules.
import './core.js';
import './state.js';
import './lights.js';
import './park.js';
import './office/index.js';
import './terrain.js';
import './construction.js';
import './selection.js';
import './gizmo.js';
import './cinematics.js';
import './ui.js';
import './environment.js';
import './recorder.js';
import './characters.js';
import './characterCreator.js';
import './viewport.js';
import './timeline.js';
import './subtitles.js';
import './quizTrack.js';
import './wizard.js';
import './multiselect.js';
import './startup.js';
import './projectFiles.js';
import './undo.js';
import './render.js';

import { setEnvironment } from './environment.js';
import { populateOutliner, syncSlidersFromTarget } from './ui.js';
import { updateGizmoPosition } from './gizmo.js';
import { updateCinemaCharList, refreshCinemaUI } from './cinematics.js';
import { initUndo } from './undo.js';

// ==========================================
// INITIALIZATION
// ==========================================
setEnvironment('office');
populateOutliner();
// Proyecto nuevo arranca VACÍO: sin personajes por defecto ni selección
// inicial (los personajes se agregan desde el editor y los principales se
// restauran al cargar un proyecto viejo que los tenga).
syncSlidersFromTarget();
updateGizmoPosition();
updateCinemaCharList();
refreshCinemaUI();
initUndo();
