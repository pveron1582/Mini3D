// js/cinema/tlScale.js — Escala ÚNICA de la línea de tiempo.
//
// TODAS las pistas (tomas, personajes, subtítulos, quiz) dibujan y arrastran
// con estos mismos píxeles-por-segundo y el mismo ancho de rótulo: si cada
// pista usara su propia escala, los bloques no coincidirían entre pistas ni
// con la regla y la aguja ("todo a destiempo").

import { timeline } from '../state.js';
import { byId } from '../dom.js';

export let LANE_LABEL_W = 290; // = ancho del panel izquierdo: el 0s queda justo bajo su borde

// Mide el panel izquierdo real y alinea el 0s con su borde derecho (la
// barra vertical que lo separa de la escena). También publica el ancho en
// la variable CSS --lane-label-w para la línea vertical y las grillas.
export function syncLaneLabelWidth() {
  if (typeof document === 'undefined') return LANE_LABEL_W;
  const p = document.getElementById('left-panel');
  const w = (p && typeof p.getBoundingClientRect === 'function')
    ? Math.round(p.getBoundingClientRect().width) : 290;
  LANE_LABEL_W = Math.max(200, w);
  const sec = (typeof document.getElementById === 'function')
    ? document.getElementById('scene-timeline') : null;
  if (sec && sec.style && typeof sec.style.setProperty === 'function') {
    sec.style.setProperty('--lane-label-w', LANE_LABEL_W + 'px');
  }
  return LANE_LABEL_W;
}

export function pxPerSec() {
  const track = byId('timelineTrack');
  if (!track) return 40;
  const viewSpan = Math.max(timeline.duration, 20);
  return Math.max(1, (track.clientWidth - LANE_LABEL_W) / viewSpan);
}
