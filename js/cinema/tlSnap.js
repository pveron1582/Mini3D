// js/cinema/tlSnap.js — Imán de alineación entre pistas de la línea de tiempo.
//
// Al arrastrar o estirar un bloque (toma de cámara, bloque de personaje,
// subtítulo), sus bordes buscan coincidencias cercanas en las demás pistas:
// si el borde queda a menos de ~8 px de un borde de otra pista, se ajusta
// para que coincidan EXACTO (paso 0.1s). Así alinear "la cámara cambia cuando
// Alex empieza a hablar" es arrastrar cerca y soltar: el imán los deja
// coincidiendo sin esfuerzo fino.
//
// Referencias: bordes (inicio/fin) de tomas, bloques de personajes,
// subtítulos y carteles de pregunta. Se excluye el bloque que se arrastra.

import { timeline, charBlocks, quizTrack } from '../state.js';
import { subtitleTrack } from '../media/subtitles.js';

const round1 = (n) => Math.round(n * 10) / 10;

// Radio del imán en píxeles (se convierte a segundos según el zoom).
export const TL_SNAP_PX = 8;

// Tiempos de referencia para el imán: bordes de todas las pistas.
// `exclude` = el bloque que se está arrastrando (no imanta contra sí mismo).
export function collectTimelineSnapTimes(exclude = null) {
  const s = new Set();
  const add = (a, b) => { s.add(round1(a)); s.add(round1(b)); };
  timeline.shots.forEach(sh => { if (sh !== exclude) add(sh.start, sh.start + sh.duration); });
  charBlocks.forEach(b => { if (b !== exclude) add(b.start, b.start + b.duration); });
  subtitleTrack.forEach(c => { if (c !== exclude) add(c.start, c.end); });
  quizTrack.forEach(q => { if (q !== exclude) add(q.start, q.end); });
  return [...s];
}

// Ajusta `t` a la referencia más cercana si cae dentro del radio (tolSec);
// si no, devuelve t redondeado al paso del editor (0.1s).
export function snapTimeToRefs(t, tolSec, refs) {
  let best = null;
  for (let i = 0; i < refs.length; i++) {
    const d = refs[i] - t;
    if (Math.abs(d) <= tolSec && (best === null || Math.abs(d) < Math.abs(best))) best = d;
  }
  return best !== null ? round1(t + best) : round1(t);
}
