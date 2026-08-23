import * as THREE from 'three';
import { scene, camera, renderer, controls } from './core.js';
import { cinema, playbackInstances, view, interactiveRegistry, store, recorderState } from './state.js';
import { updateSelectionRing } from './selection.js';
import { updateGizmoPosition } from './gizmo.js';
import { updateCinematicCamera, refreshCinemaUI, cinemaSetMode } from './cinematics.js';
import { syncSlidersFromTarget } from './ui.js';
import { serverLedMaterials, officeGroup } from './office.js';
import { human1Rig, human2Rig, human3Rig, dogRig, catRig } from './characters.js';
import { resolveCollisions } from './collision.js';
import { mediaRecorder } from './recorder.js';
import { updateTimeline } from './timeline.js';

// ==========================================
// CONTINUOUS RENDER LOOP (LIVE ANIMATIONS)
// ==========================================
const clock = new THREE.Clock();
let globalTime = 0;
let frameCount = 0;
let lastFpsUpdate = 0;
const hudFps = document.getElementById('hudFps');
const hudCamPos = document.getElementById('hudCamPos');

function animate(timestamp) {
  requestAnimationFrame(animate);
  try {
    const dt = clock.getDelta();
    globalTime += dt;

    // Run continuous animations for all characters
    human1Rig.run(globalTime);
    human2Rig.run(globalTime + 1.2);
    human3Rig.run(globalTime + 2.4);
    dogRig.run(globalTime);
    catRig.run(globalTime + 0.8);

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
          inst.waiting -= dt;
          if (inst.waiting <= 0 && entry.rig && inst.moveAction) {
            entry.rig.setAction(inst.moveAction);
            entry.rig.cadence = inst.cadence || 1;
          }
          if (inst.waiting > 0) return;
        }

        inst.progress += dt;
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
          if (entry.rig) entry.rig.setAction(inst.savedAction || 'idle');
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
    updateTimeline(dt);

    // Blinking server LEDs
    if (officeGroup.visible && serverLedMaterials.length > 0) {
      for (let i = 0; i < serverLedMaterials.length; i++) {
        const mat = serverLedMaterials[i];
        const blink = Math.sin(globalTime * 9 + i * 1.4) > 0.05;
        mat.color.setHex(blink ? (i % 2 === 0 ? 0x00ff88 : 0x33aaff) : 0x002211);
      }
    }

    if (recorderState.isRecording) {
      recorderState.recordTime += dt;
      if (recorderState.recordTime >= recorderState.recordDuration) {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
      }
    }

    if (view.mode === 'orbit') {
      controls.update();
    } else {
      updateCinematicCamera();
    }
    renderer.render(scene, camera);

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
      const el = document.getElementById('err');
      if (el) el.textContent = 'Error: ' + e.message;
    }
  }
}

animate(0);
