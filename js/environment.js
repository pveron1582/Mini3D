import * as THREE from 'three';
import { scene } from './core.js';
import { hemiLight, dirLight, fillLight, studioGroup } from './lights.js';
import { parkGroup } from './park.js';
import { officeGroup } from './office.js';
import { store, lampLights, lampMeshes } from './state.js';
import { setStatus } from './recorder.js';

// ==========================================
// ENVIRONMENT SYSTEM (SWITCHER)
// ==========================================
export function setEnvironment(envKey) {
  store.currentEnv = envKey;
  const hudEnvName = document.getElementById('hudEnvName');

  document.querySelectorAll('.env-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-env') === envKey);
  });

  if (envKey === 'studio') {
    parkGroup.visible = false;
    officeGroup.visible = false;
    studioGroup.visible = true;
    scene.background = new THREE.Color(0x1a1c23);
    scene.fog = null;

    hemiLight.color.setHex(0xffffff);
    hemiLight.groundColor.setHex(0x222630);
    hemiLight.intensity = 0.7;

    dirLight.color.setHex(0xffffff);
    dirLight.intensity = 1.8;
    dirLight.position.set(6, 14, 8);
    fillLight.intensity = 0.5;

    lampLights.forEach(l => l.intensity = 0);
    lampMeshes.forEach(m => m.material.emissiveIntensity = 0.1);
    if (hudEnvName) hudEnvName.textContent = 'Estudio 3D';
    setStatus('Ambiente: Estudio 3D');
  } else if (envKey === 'office') {
    parkGroup.visible = false;
    studioGroup.visible = false;
    officeGroup.visible = true;
    scene.background = new THREE.Color(0x8fa3bf);
    scene.fog = new THREE.FogExp2(0xa0b5cf, 0.012);

    hemiLight.color.setHex(0xf5f8fc);
    hemiLight.groundColor.setHex(0x353a45);
    hemiLight.intensity = 1.1;

    dirLight.color.setHex(0xffffff);
    dirLight.intensity = 2.0;
    dirLight.position.set(6, 18, 8);
    fillLight.intensity = 0.6;

    lampLights.forEach(l => l.intensity = 0);
    if (hudEnvName) hudEnvName.textContent = 'Oficina Moderna';
    setStatus('Ambiente: Oficina Moderna 🏢');
  } else if (envKey === 'day') {
    officeGroup.visible = false;
    parkGroup.visible = true;
    studioGroup.visible = false;
    scene.background = new THREE.Color(0x7ea9d8);
    scene.fog = new THREE.FogExp2(0x9bc0e7, 0.018);

    hemiLight.color.setHex(0xddeeff);
    hemiLight.groundColor.setHex(0x3e5e2c);
    hemiLight.intensity = 0.95;

    dirLight.color.setHex(0xfffaed);
    dirLight.intensity = 2.2;
    dirLight.position.set(10, 18, 10);
    fillLight.intensity = 0.4;

    lampLights.forEach(l => l.intensity = 0);
    lampMeshes.forEach(m => m.material.emissiveIntensity = 0.1);
    if (hudEnvName) hudEnvName.textContent = 'Parque de Día';
    setStatus('Ambiente: Parque de Día ☀️');
  } else if (envKey === 'sunset') {
    officeGroup.visible = false;
    parkGroup.visible = true;
    studioGroup.visible = false;
    scene.background = new THREE.Color(0xd4683f);
    scene.fog = new THREE.FogExp2(0xde7954, 0.022);

    hemiLight.color.setHex(0xff9868);
    hemiLight.groundColor.setHex(0x38222a);
    hemiLight.intensity = 0.75;

    dirLight.color.setHex(0xff7733);
    dirLight.intensity = 2.8;
    dirLight.position.set(22, 5, 14);
    fillLight.intensity = 0.3;

    lampLights.forEach(l => l.intensity = 1.2);
    lampMeshes.forEach(m => m.material.emissiveIntensity = 1.2);
    if (hudEnvName) hudEnvName.textContent = 'Parque al Atardecer';
    setStatus('Ambiente: Parque de Tarde 🌅');
  } else if (envKey === 'night') {
    officeGroup.visible = false;
    parkGroup.visible = true;
    studioGroup.visible = false;
    scene.background = new THREE.Color(0x0a0e18);
    scene.fog = new THREE.FogExp2(0x0e1422, 0.028);

    hemiLight.color.setHex(0x283b5e);
    hemiLight.groundColor.setHex(0x090d14);
    hemiLight.intensity = 0.4;

    dirLight.color.setHex(0x6085ba);
    dirLight.intensity = 0.55;
    dirLight.position.set(-10, 16, -10);
    fillLight.intensity = 0.15;

    lampLights.forEach(l => l.intensity = 3.8);
    lampMeshes.forEach(m => m.material.emissiveIntensity = 2.5);
    if (hudEnvName) hudEnvName.textContent = 'Parque Nocturno';
    setStatus('Ambiente: Parque Nocturno 🌙');
  }
}
