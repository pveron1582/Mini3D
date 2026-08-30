// js/office/alarm.js — extraído de office.js (split P1, ver mejoras_glm.md)

import * as THREE from 'three';
import * as geo from './geoCache.js';
import { officeGroup } from './group.js';
import { registerTicker } from '../tickers.js';

// ==========================================
// ALARMA DE EMERGENCIA (BALIZAS ROJAS)
// ==========================================
// Balizas rojas de pared que parpadean cuando la escena lo indica (toma con
// `alarm: true`). setAlarm() cambia el estado; updateAlarm() anima el
// parpadeo cada frame (llamado desde render.js).
export const alarmBeacons = [];   // { light, domeMat }
let alarmActive = false;
let alarmClock = 0;

export function setAlarm(on) {
  alarmActive = !!on;
  if (!alarmActive) {
    alarmBeacons.forEach(b => {
      b.light.intensity = 0;
      b.domeMat.emissive.setHex(0x2a0505);
      b.domeMat.emissiveIntensity = 0.2;
    });
  }
}

export function updateAlarm(dt) {
  if (!alarmActive) return;
  alarmClock += dt;
  // Destello rojo rápido, tipo baliza de emergencia
  const flash = Math.sin(alarmClock * 10) > 0 ? 1 : 0.05;
  alarmBeacons.forEach(b => {
    b.light.intensity = flash * 4.5;
    b.domeMat.emissive.setHex(0xff1a1a);
    b.domeMat.emissiveIntensity = 0.3 + flash * 2.6;
  });
}

export function createAlarmBeacon(x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  // Base metálica
  const base = new THREE.Mesh(
    geo.cylinder(0.13, 0.17, 0.1, 16),
    new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.5, metalness: 0.5 })
  );
  g.add(base);
  // Domo rojo translúcido (media esfera)
  const domeMat = new THREE.MeshStandardMaterial({
    color: 0x8a1010, emissive: 0x2a0505, emissiveIntensity: 0.2,
    roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92
  });
  const dome = new THREE.Mesh(
    geo.sphere(0.16, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat
  );
  dome.position.y = 0.05;
  g.add(dome);
  // Luz roja puntual (parpadea en updateAlarm)
  const light = new THREE.PointLight(0xff2020, 0, 16, 1.8);
  light.position.y = 0.14;
  g.add(light);
  officeGroup.add(g);
  alarmBeacons.push({ light, domeMat });
  return g;
}

// Ticker por-frame (P2): el parpadeo de las balizas ya no vive en render.js.
registerTicker((_simDt, _globalTime, dt) => updateAlarm(dt));
