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
import './ui/selection.js';
import './ui/gizmo.js';
import './ui/contextMenu.js';
import './cinema/cinematics.js';
import './ui/ui.js';
import './environment.js';
import './media/recorder.js';
import './media/audio.js';
import './characters/characters.js';
import './characters/characterCreator.js';
import './ui/viewport.js';
import './cinema/timeline.js';
import './media/subtitles.js';
import './cinema/quizTrack.js';
import './cinema/charTrack.js';
import './cinema/tlSnap.js';
import './cinema/wizard.js';
import './ui/multiselect.js';
import './ui/panelResize.js';
import './startup.js';
import './projectFiles.js';
import './undo.js';
import './render.js';

import { setEnvironment } from './environment.js';
import { populateOutliner, syncSlidersFromTarget, initConstructionDesignSelects } from './ui/ui.js';
import { updateGizmoPosition } from './ui/gizmo.js';
import { updateCinemaCharList, refreshCinemaUI } from './cinema/cinematics.js';
import { initUndo } from './undo.js';
import { serializeProject, applyProject } from './projectFiles.js';

// ==========================================
// INITIALIZATION
// ==========================================
setEnvironment('office');
populateOutliner();
initConstructionDesignSelects();
// Proyecto nuevo arranca VACÍO: sin personajes por defecto ni selección
// inicial (los personajes se agregan desde el editor y los principales se
// restauran al cargar un proyecto viejo que los tenga).
syncSlidersFromTarget();
updateGizmoPosition();
updateCinemaCharList();
refreshCinemaUI();
// Fase 3: el undo recibe la serialización por INYECCIÓN en vez de importar
// projectFiles (rompía el ciclo projectFiles → catalog → undo). main conoce
// ambos lados sin circular.
initUndo({ serialize: serializeProject, apply: applyProject });
