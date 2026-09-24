import * as THREE from 'three';
import { byId, qs, qsa } from '../dom.js';
import { interactiveRegistry, cinemaPaths, timeline, syncBasePose } from '../state.js';
import { refreshTimelineUI } from './timeline.js';
import { setSubtitles } from '../media/subtitles.js';
import { pushHistory } from '../undo.js';
import { setStatus } from '../media/recorder.js';

// ==========================================
// ASISTENTE DE ESCENAS (🪅) — Diálogo a dos
// ==========================================
// Plantilla genérica: elegís dos personajes, pegás el guion de cada uno
// (una frase por línea) y el asistente arma la escena completa:
//   - posiciones enfrentadas, mirándose
//   - tomas de cámara (plano/contraplano, plano medio o general único)
//   - subtítulos sincronizados con el nombre del personaje que habla
// La duración de cada réplica se calcula según su cantidad de palabras.

const CHAR_NAMES = { human1: 'Alex', human2: 'Carlos', human3: 'Elena', human4: 'Mike', human5: 'Sofi', human6: 'Nico', human7: 'Marta', human8: 'Leo', human9: 'Valen' };
const SHOT_COLORS = ['#4772b3', '#3f9d6f'];

function parseLines(t) {
  return (t || '').split('\n').map(s => s.trim()).filter(Boolean);
}

// Duración estimada de una réplica: base + tiempo de lectura
function lineDuration(text) {
  const words = text.split(/\s+/).length;
  return Math.max(2.2, Math.round((words * 0.38 + 0.7) * 10) / 10);
}

function placeFacing(id, x, z, lookAtX) {
  const entry = interactiveRegistry.get(id);
  if (!entry) return;
  entry.group.position.set(x, 0, z);
  entry.group.rotation.y = Math.atan2(lookAtX - x, 0); // mira hacia el otro
  if (entry.rig) entry.rig.setAction('talk');
  // El asistente decide la pose base: escribirla aunque la aguja esté en t>0
  syncBasePose(entry, { action: true });
}

export function generateDialogueScene({ charA, charB, linesA, linesB, camStyle, withGeneral }) {
  // Posiciones enfrentadas en el área libre frente al centro (funciona en
  // oficina, estudio y parque)
  placeFacing(charA, -1.5, -2.4, 1.5);
  placeFacing(charB, 1.5, -2.4, -1.5);

  // Interleave de réplicas: A y B alternan; si uno tiene más líneas que el
  // otro, las sobrantes corren seguidas al final.
  const turns = [];
  const n = Math.max(linesA.length, linesB.length);
  for (let i = 0; i < n; i++) {
    if (i < linesA.length) turns.push({ id: charA, name: CHAR_NAMES[charA] || charA, text: linesA[i] });
    if (i < linesB.length) turns.push({ id: charB, name: CHAR_NAMES[charB] || charB, text: linesB[i] });
  }
  if (turns.length === 0) {
    setStatus('El asistente necesita al menos una línea de guion.');
    return false;
  }

  // Centro de la pareja para la cámara general
  const mid = new THREE.Vector3(0, 0, -2.4);

  // Tomas
  timeline.shots.length = 0;
  let t = 0;
  const pushShot = (duration, camMode, subjectId, camPos, target) => {
    timeline.shots.push({
      id: 'wz' + (timeline.shots.length + 1),
      start: Math.round(t * 10) / 10,
      duration,
      camMode, subjectId: subjectId || null,
      camPos, target,
      label: '', color: SHOT_COLORS[timeline.shots.length % SHOT_COLORS.length]
    });
    t += duration;
  };

  if (withGeneral) {
    pushShot(2.0, 'fixed', null,
      [mid.x, 2.4, mid.z + 4.6],
      [mid.x, 1.1, mid.z]);
  }

  if (camStyle === 'general') {
    // Una sola toma fija con toda la conversación
    const total = turns.reduce((s, r) => s + lineDuration(r.text), 0);
    pushShot(Math.round(total * 10) / 10, 'fixed', null,
      [mid.x, 2.0, mid.z + 4.2],
      [mid.x, 1.1, mid.z]);
  } else {
    turns.forEach(r => {
      const dur = lineDuration(r.text);
      if (camStyle === 'medio') {
        pushShot(dur, 'third', r.id);
      } else {
        // Alterno cerrado: cine1 para A, cine2 para B
        pushShot(dur, r.id === charA ? 'cine1' : 'cine2', r.id);
      }
    });
  }

  // Subtítulos sincronizados con las tomas
  let cur = withGeneral ? 2.0 : 0;
  const cues = [];
  turns.forEach(r => {
    const d = lineDuration(r.text);
    cues.push({ start: Math.round(cur * 10) / 10, end: Math.round((cur + d - 0.15) * 10) / 10, text: `${r.name}: ${r.text}` });
    cur += d;
  });
  setSubtitles(cues);

  refreshTimelineUI();
  // Un paso de historial (no reset): así el Undo revierte TODO lo que armó
  // el asistente (tomas, subtítulos, posiciones) de vuelta a antes de generar.
  pushHistory();
  setStatus(`Escena generada: ${turns.length} réplicas, ${timeline.shots.length} tomas, ${timeline.duration.toFixed(1)}s. ▶ para verla.`);
  return true;
}

// ---------- UI ----------
function openWizard() {
  byId('wizardModal').style.display = 'flex';
  updateEstimate();
}

function closeWizard() {
  byId('wizardModal').style.display = 'none';
}

function readForm() {
  return {
    charA: byId('wzCharA').value,
    charB: byId('wzCharB').value,
    linesA: parseLines(byId('wzLinesA').value),
    linesB: parseLines(byId('wzLinesB').value),
    camStyle: byId('wzCamStyle').value,
    withGeneral: byId('wzGeneral').checked
  };
}

function updateEstimate() {
  const f = readForm();
  const n = Math.max(f.linesA.length, f.linesB.length);
  let total = f.withGeneral ? 2.0 : 0;
  for (let i = 0; i < n; i++) {
    if (i < f.linesA.length) total += lineDuration(f.linesA[i]);
    if (i < f.linesB.length) total += lineDuration(f.linesB[i]);
  }
  const el = byId('wzEstimate');
  if (el) el.textContent = `Duración estimada: ~${total.toFixed(1)} s · ${f.linesA.length + f.linesB.length} frases`;
}

byId('btnWizard')?.addEventListener('click', openWizard);
byId('wzClose')?.addEventListener('click', closeWizard);
['wzLinesA', 'wzLinesB'].forEach(id => {
  byId(id)?.addEventListener('input', updateEstimate);
});
byId('wzGeneral')?.addEventListener('change', updateEstimate);
byId('wzGenerate')?.addEventListener('click', () => {
  const f = readForm();
  if (f.charA === f.charB) { setStatus('Elegí dos personajes distintos.'); return; }
  if (!f.linesA.length && !f.linesB.length) { setStatus('Pegá al menos una línea de guion.'); return; }
  if (generateDialogueScene(f)) closeWizard();
});
void cinemaPaths;