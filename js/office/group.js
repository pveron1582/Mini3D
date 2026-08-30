// js/office/group.js — extraído de office.js (split P1, ver mejoras_glm.md)

import * as THREE from 'three';
import { scene } from '../core.js';
import { registerTicker } from '../tickers.js';

// ==========================================
// OFFICE ENVIRONMENT & INDEPENDENT PROPS
// ==========================================
export const officeGroup = new THREE.Group();
scene.add(officeGroup);
officeGroup.visible = false;

export const serverLedMaterials = [];

// Escalera de apoyo (tipo tijera) — vive en el ámbito del módulo para que
// characters.js pueda moverla/ocultarla durante la animación de escalada.
export const stepLadder = new THREE.Group();
// Punto de origen de la escalera (donde aparece por defecto en la sala de
// sistemas). Lo usa la timeline al (re)producir una escena para volver la
// escalera a su lugar cuando Alex la deja en otro lado.
export const STEP_LADDER_ORIGIN = [-6.6, 0, -5.05];

// Mini racks de pared (Lote 3b): el fijo de la sala de juntas y los que se
// agregan desde el catálogo. Los crea la fábrica createMiniRack() de
// network.js y los registra acá; el ticker anima cada puerta por separado.
const miniRacks = [];
export function registerMiniRack(rack) {
  if (!miniRacks.includes(rack)) miniRacks.push(rack);
}

// Abre/cierra las puertas de TODOS los mini racks (la usa la timeline con el
// flag `openDoor` de las tomas).
export function openAllRackDoors(open = true) {
  for (let i = 0; i < miniRacks.length; i++) {
    const ud = miniRacks[i].userData;
    if (ud.doorHinge) ud.doorOpen = open ? 1 : 0;
  }
}

// Animación de apertura/cierre de las puertas de TODOS los mini racks
// (llamada desde el loop de render). `doorOpen` (0/1) es el objetivo de cada
// rack; `doorAngle` persigue.
export function updateMiniRackDoor(dt) {
  for (let i = 0; i < miniRacks.length; i++) {
    const ud = miniRacks[i].userData;
    if (!ud.doorHinge) continue;
    const target = ud.doorOpen ? -2.0 : 0;
    ud.doorAngle += (target - ud.doorAngle) * Math.min(1, dt * 4);
    ud.doorHinge.rotation.y = ud.doorAngle;
  }
}

// Tickers por-frame (P2): las puertas de los mini racks y el parpadeo de LEDs
// de servidor ya no viven en render.js sino registrados acá.
registerTicker((_simDt, _globalTime, dt) => updateMiniRackDoor(dt));
registerTicker((_simDt, globalTime) => {
  if (!officeGroup.visible || serverLedMaterials.length === 0) return;
  for (let i = 0; i < serverLedMaterials.length; i++) {
    const mat = serverLedMaterials[i];
    const blink = Math.sin(globalTime * 9 + i * 1.4) > 0.05;
    mat.color.setHex(blink ? (i % 2 === 0 ? 0x00ff88 : 0x33aaff) : 0x002211);
  }
});
