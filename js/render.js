import * as THREE from 'three';
import { byId, qs, qsa } from './dom.js';
import { scene, camera, renderer, controls } from './core.js';
import { cinema, playbackInstances, view, interactiveRegistry, store, recorderState, timeline, playback } from './state.js';
import { updateSelectionRing } from './ui/selection.js';
import { updateGizmoPosition } from './ui/gizmo.js';
import { updateCinematicCamera, refreshCinemaUI, cinemaSetMode, syncFpvHead } from './cinema/cinematics.js';
import { syncSlidersFromTarget } from './ui/ui.js';
import { resolveCollisions } from './collision.js';
import { mediaRecorder } from './media/recorder.js';
import { updateTimeline } from './cinema/timeline.js';
import { renderSubtitleOverlay } from './media/subtitles.js';
import { updateFlyTo } from './ui/viewport.js';
import { renderQuizOverlay } from './media/quiz.js';
import { tickers } from './tickers.js';

// ==========================================
// CONTINUOUS RENDER LOOP (LIVE ANIMATIONS)
// ==========================================
const clock = new THREE.Clock();
let globalTime = 0;
let frameCount = 0;
let lastFpsUpdate = 0;
const hudFps = byId('hudFps');
const hudCamPos = byId('hudCamPos');

function animate(timestamp) {
  requestAnimationFrame(animate);
  try {
    const rawDt = clock.getDelta();
    // Acotar dt: si la pestaña pierde foco o hay un drop de FPS, un dt grande
    // desincronizaría la escena de la grabación (video no determinista).
    const dt = Math.min(rawDt, 1 / 20);
    // Reloj de simulación escalado por la velocidad elegida por el usuario:
    // recorridos, esperas, timeline y animaciones corren todos al mismo ritmo.
    // En pausa (timeline.paused) la simulación se congela por completo.
    const simDt = timeline.paused ? 0 : dt * playback.rate;
    globalTime += simDt;

    // Run continuous animations for all characters (each module registers its
    // own rigs/tickers: characters, mini rack door, alarm, hacker house, LEDs).
    tickers.forEach(t => t(simDt, globalTime, dt));

    // Vuelo suave de cámara al objetivo (flyToTarget, js/viewport.js)
    updateFlyTo(performance.now());

    // Mantener gizmo sincronizado con el objeto activo
    updateGizmoPosition();

    // Sistema de Cinemática (reproduce TODOS los recorridos activos)
    if (playbackInstances.size > 0) {
      const finished = [];
      playbackInstances.forEach((inst, id) => {
        const entry = interactiveRegistry.get(id);
        if (!entry || !inst.curve || inst.length <= 0) { finished.push(id); return; }
        const obj = entry.group;

        // Espera en waypoint con evento: quieto hasta agotar el tiempo
        if (inst.waiting > 0) {
          inst.waiting -= simDt;
          // Al terminar la espera se retoma la caminata, salvo que la espera
          // sea en el punto final con acción de cierre: ahí el personaje
          // queda quieto haciendo esa acción (hablar, sentarse, etc.)
          const atEnd = inst.lastU !== null && inst.lastU >= 0.9;
          if (inst.waiting <= 0 && entry.rig && inst.moveAction && !(atEnd && inst.endAction)) {
            entry.rig.setAction(inst.moveAction);
            entry.rig.cadence = inst.cadence || 1;
          }
          if (inst.waiting > 0) return;
        }

        inst.progress += simDt;
        const dur = inst.length / Math.max(0.1, inst.speed);
        let u = inst.progress / dur;
        let done = false;
        if (u >= 1) {
          if (inst.loop) { inst.progress = 0; u = 0; inst.events && inst.events.forEach(ev => ev.done = false); }
          else { u = 1; done = true; }
        }
        const uu = inst.reversed ? (1 - u) : u;
        const cu = THREE.MathUtils.clamp(uu, 0, 1);

        // Eventos de waypoint: acción + espera al cruzar el punto
        if (inst.events && inst.events.length > 0 && inst.lastU !== null) {
          inst.events.forEach(ev => {
            if (ev.done) return;
            const crossed = inst.reversed
              ? (inst.lastU >= ev.u && cu <= ev.u)
              : (inst.lastU <= ev.u && cu >= ev.u);
            if (!crossed) return;
            ev.done = true;
            // Al cargar la escalera al hombro, mientras camina al destino la
            // porta (usamos `shoulder_carry` como acción de movimiento en vez
            // de walk/run, así se ve que la lleva). Al soltarla, vuelve a
            // caminar normal (la escalera real queda en el piso).
            if (ev.action === 'shoulder_lift') inst.moveAction = 'shoulder_carry';
            else if (ev.action === 'shoulder_drop') inst.moveAction = 'walk';
            if (ev.action && entry.rig) entry.rig.setAction(ev.action);
            if (ev.wait > 0) inst.waiting = ev.wait;
          });
        }
        inst.lastU = cu;

        let pos, tan;
        try {
          pos = inst.curve.getPointAt(cu);
          tan = inst.curve.getTangentAt(cu);
        } catch (err) {
          finished.push(id);
          return;
        }
        obj.position.set(pos.x, inst.planeY, pos.z);
        obj.rotation.y = Math.atan2(tan.x, tan.z);
        if (id === store.activeTarget) {
          updateSelectionRing();
          updateGizmoPosition();
          syncSlidersFromTarget();
        }
        if (done) {
          // La acción final del recorrido (evento del último punto) persiste
          if (entry.rig) entry.rig.setAction(inst.endAction || inst.savedAction || 'idle');
          finished.push(id);
        }
      });
      finished.forEach(id => {
        playbackInstances.delete(id);
        if (id === cinema.targetId) {
          if (cinema.active) cinemaSetMode('edit');
          else refreshCinemaUI();
        }
      });
      if (finished.length) refreshCinemaUI();
    }

    // Colisiones: los personajes no atraviesan mobiliario, equipos ni entre sí
    resolveCollisions();

    // Secuenciador de escenas: reloj de tomas + cortes de cámara
    updateTimeline(simDt);

    if (recorderState.isRecording) {
      // recordDuration está en segundos REALES (duración/rate): el reloj de
      // la grabación avanza con dt real, no con el reloj de simulación.
      recorderState.recordTime += dt;
      if (recorderState.recordTime >= recorderState.recordDuration) {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
      }
    }

    // Mantener la cabeza del sujeto oculta en 1ª persona (y restaurarla al salir)
    syncFpvHead();

    if (view.mode === 'orbit') {
      controls.update();
    } else {
      updateCinematicCamera();
    }
    renderer.render(scene, camera);

    // Subtítulos dibujados dentro del canvas: se ven mientras la escena
    // corre Y también al mover la cabeza manualmente (scrub/pausa)
    renderSubtitleOverlay(timeline.time > 0 ? timeline.time : -1);

    // Cartel de cierre (pregunta + opciones + reloj) sobre el canvas
    renderQuizOverlay(timeline.time);

    frameCount++;
    if (timestamp - lastFpsUpdate > 500) {
      if (hudFps) hudFps.textContent = Math.round((frameCount * 1000) / (timestamp - lastFpsUpdate)) + ' FPS';
      frameCount = 0;
      lastFpsUpdate = timestamp;
    }
    if (hudCamPos) {
      hudCamPos.textContent = `Cam: X: ${camera.position.x.toFixed(2)}, Y: ${camera.position.y.toFixed(2)}, Z: ${camera.position.z.toFixed(2)}`;
    }
  } catch (e) {
    if (!window.__errShown) {
      window.__errShown = true;
      console.error(e);
      const el = byId('err');
      if (el) el.textContent = 'Error: ' + e.message;
    }
  }
}

animate(0);