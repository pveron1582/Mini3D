import * as THREE from 'three';
import { byId, qs, qsa } from './dom.js';
import { scene } from './core.js';
import { hemiLight, dirLight, fillLight, studioGroup } from './lights.js';
import { parkGroup } from './park.js';
import { officeGroup } from './office/group.js';
import { terrainGroup } from './terrain.js';
import { updateConstructionVisibility } from './construction.js';
import { store, lampLights, lampMeshes } from './state.js';
import { setStatus } from './media/recorder.js';

// ==========================================
// ENVIRONMENT SYSTEM (SWITCHER) — P3 data-driven
// ==========================================
// Cada ambiente es un preset con: grupos visibles, color de fondo, niebla,
// luces (hemisférica, direccional, de relleno) y estado de los faroles del
// parque. setEnvironment() solo busca el preset y lo aplica, sin if/else.
const ENV_PRESETS = {
  studio: {
    label: 'Estudio 3D',
    status: 'Ambiente: Estudio 3D',
    show: { office: false, park: false, studio: true },
    bg: 0x1a1c23,
    fog: null,
    hemi: { c: 0xffffff, g: 0x222630, i: 0.7 },
    dir: { c: 0xffffff, i: 1.8, pos: [6, 14, 8] },
    fill: 0.5,
    lamps: { i: 0, e: 0.1 }
  },
  office: {
    label: 'Oficina Moderna',
    status: 'Ambiente: Oficina Moderna 🏢',
    show: { office: true, park: false, studio: false },
    bg: 0x8fa3bf,
    fog: { color: 0xa0b5cf, density: 0.012 },
    hemi: { c: 0xf5f8fc, g: 0x353a45, i: 1.1 },
    dir: { c: 0xffffff, i: 2.0, pos: [6, 18, 8] },
    fill: 0.6,
    lamps: { i: 0 }  // la oficina no tiene faroles (no toca lampMeshes)
  },
  day: {
    label: 'Parque de Día',
    status: 'Ambiente: Parque de Día ☀️',
    show: { office: false, park: true, studio: false },
    bg: 0x7ea9d8,
    fog: { color: 0x9bc0e7, density: 0.018 },
    hemi: { c: 0xddeeff, g: 0x3e5e2c, i: 0.95 },
    dir: { c: 0xfffaed, i: 2.2, pos: [10, 18, 10] },
    fill: 0.4,
    lamps: { i: 0, e: 0.1 }
  },
  sunset: {
    label: 'Parque al Atardecer',
    status: 'Ambiente: Parque de Tarde 🌅',
    show: { office: false, park: true, studio: false },
    bg: 0xd4683f,
    fog: { color: 0xde7954, density: 0.022 },
    hemi: { c: 0xff9868, g: 0x38222a, i: 0.75 },
    dir: { c: 0xff7733, i: 2.8, pos: [22, 5, 14] },
    fill: 0.3,
    lamps: { i: 1.2, e: 1.2 }
  },
  night: {
    label: 'Parque Nocturno',
    status: 'Ambiente: Parque Nocturno 🌙',
    show: { office: false, park: true, studio: false },
    bg: 0x0a0e18,
    fog: { color: 0x0e1422, density: 0.028 },
    hemi: { c: 0x283b5e, g: 0x090d14, i: 0.4 },
    dir: { c: 0x6085ba, i: 0.55, pos: [-10, 16, -10] },
    fill: 0.15,
    lamps: { i: 3.8, e: 2.5 }
  },
  terrain: {
    label: 'Terreno con Césped',
    status: 'Ambiente: Terreno con Césped 🌱 (Modo Construcción)',
    show: { office: false, park: false, studio: false, terrain: true },
    bg: 0x87ceeb,
    fog: { color: 0xa8d8e8, density: 0.012 },
    hemi: { c: 0xe8f4ff, g: 0x3e5e2c, i: 1.0 },
    dir: { c: 0xfff6e0, i: 2.1, pos: [10, 18, 8] },
    fill: 0.5,
    lamps: { i: 0, e: 0.1 }
  }
};

export const environmentNames = Object.keys(ENV_PRESETS);

export function setEnvironment(envKey) {
  const p = ENV_PRESETS[envKey] || ENV_PRESETS.studio;
  store.currentEnv = envKey;
  const hudEnvName = byId('hudEnvName');

  qsa('.env-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-env') === envKey);
  });

  // Grupos visibles por ambiente
  officeGroup.visible = !!p.show.office;
  parkGroup.visible = !!p.show.park;
  studioGroup.visible = !!p.show.studio;
  terrainGroup.visible = !!p.show.terrain;
  // La capa de construcción se ve en el terreno o con el Modo Construcción ON
  updateConstructionVisibility();

  // Fondo y niebla
  scene.background = new THREE.Color(p.bg);
  scene.fog = p.fog ? new THREE.FogExp2(p.fog.color, p.fog.density) : null;

  // Luz hemisférica
  hemiLight.color.setHex(p.hemi.c);
  hemiLight.groundColor.setHex(p.hemi.g);
  hemiLight.intensity = p.hemi.i;

  // Luz direccional
  dirLight.color.setHex(p.dir.c);
  dirLight.intensity = p.dir.i;
  dirLight.position.set(p.dir.pos[0], p.dir.pos[1], p.dir.pos[2]);
  fillLight.intensity = p.fill;

  // Faroles del parque (intensidad de luz + emisivo; `e` opcional)
  lampLights.forEach(l => l.intensity = p.lamps.i);
  if (p.lamps.e !== undefined) {
    lampMeshes.forEach(m => m.material.emissiveIntensity = p.lamps.e);
  }

  if (hudEnvName) hudEnvName.textContent = p.label;
  setStatus(p.status);
}