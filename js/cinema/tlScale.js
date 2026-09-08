// js/cinema/tlScale.js — Escala ÚNICA de la línea de tiempo.
//
// TODAS las pistas (tomas, personajes, subtítulos, quiz) dibujan y arrastran
// con estos mismos píxeles-por-segundo y el mismo ancho de rótulo: si cada
// pista usara su propia escala, los bloques no coincidirían entre pistas ni
// con la regla y la aguja ("todo a destiempo").

import { timeline } from '../state.js';
import { byId } from '../dom.js';

export const LANE_LABEL_W = 116; // ancho del rótulo de cada pista (px)

export function pxPerSec() {
  const track = byId('timelineTrack');
  if (!track) return 40;
  const viewSpan = Math.max(timeline.duration, 20);
  return Math.max(1, (track.clientWidth - LANE_LABEL_W) / viewSpan);
}
