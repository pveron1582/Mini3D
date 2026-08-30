// js/terrain.js — Terreno limpio con césped (Fase 1 del editor de escenas).
// Un lote vacío que sirve de lienzo para el Modo Construcción: el usuario
// arranca acá y edifica encima (la construcción vive en js/construction.js).
import * as THREE from 'three';
import { renderer, scene } from './core.js';

export const terrainGroup = new THREE.Group();
terrainGroup.name = 'terrainGroup';
scene.add(terrainGroup);

// Textura procedural de césped: base verde con motas claras/oscuras que
// simulan briznas, y un leve veteado para que no se vea plana.
function makeGrassTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4a7c3a';
  ctx.fillRect(0, 0, 256, 256);
  // Veteado suave (manchas de tono distinto)
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(${60 + Math.random() * 30 | 0},${110 + Math.random() * 40 | 0},${45 + Math.random() * 25 | 0},0.18)`;
    ctx.beginPath();
    ctx.arc(Math.random() * 256, Math.random() * 256, 12 + Math.random() * 26, 0, Math.PI * 2);
    ctx.fill();
  }
  // Briznas: puntitos claros y oscuros
  for (let i = 0; i < 1400; i++) {
    const light = Math.random() > 0.5;
    ctx.fillStyle = light
      ? `rgba(120,170,90,${0.25 + Math.random() * 0.3})`
      : `rgba(40,70,32,${0.2 + Math.random() * 0.3})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5 + Math.random() * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

const GRASS_TILE = 4;      // metros por repetición de la textura
const TERRAIN_SIZE = 60;   // lado del lote (60 x 60 m)

function buildTerrain() {
  const tex = makeGrassTexture();
  tex.repeat.set(TERRAIN_SIZE / GRASS_TILE, TERRAIN_SIZE / GRASS_TILE);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  ground.name = 'terrainGround';
  terrainGroup.add(ground);
}

buildTerrain();
