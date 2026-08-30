// js/tickers.js — registro de funciones por-frame (P2, ver mejoras_glm.md).
// Cada módulo registra sus propios "tickers" (rigs, parpadeos, alarmas...) y
// render.js los corre en el loop sin conocerlos uno por uno. Así agregar un
// personaje/prop animable no obliga a editar render.js.
//
// La firma de cada ticker es: fn(simDt, globalTime, dt)
//   - simDt      : dt de simulación (respeta pausa y velocidad de reproducción)
//   - globalTime : reloj de simulación acumulado (para animaciones tipo seno)
//   - dt         : dt real (sin escala) para integraciones de física/movimiento

export const tickers = [];

export function registerTicker(fn) {
  if (typeof fn === 'function') tickers.push(fn);
}

// Quita un ticker registrado (p.ej. una animación de un solo uso que termina).
export function unregisterTicker(fn) {
  const i = tickers.indexOf(fn);
  if (i >= 0) tickers.splice(i, 1);
}