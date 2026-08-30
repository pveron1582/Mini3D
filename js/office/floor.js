// js/office/floor.js — texturas procedurales del piso (P8, ver mejoras_glm.md).
// El piso es editable: el usuario elige entre varias variantes de material.
// Se registra la malla del piso (setFloorMesh) y applyFloorTexture cambia su
// material sin recrear geometría. La elección persiste en el JSON de proyecto.
import * as THREE from 'three';
import * as geo from './geoCache.js';
import { renderer } from '../core.js';
import { officeGroup } from './group.js';

let floorMesh = null;
let currentFloorTex = 'Piso de oficina';

export function setFloorMesh(mesh) { floorMesh = mesh; }
export function getFloorTextureName() { return currentFloorTex; }

// Lienzo procedural (mismo sistema texCanvas que las paredes de walls.js).
function texCanvas(painter) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  painter(c.getContext('2d'));
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}
function noise(ctx, alpha) {
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
}
function grout(ctx, gap, stroke) {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 256; i += gap) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
  }
}

const FLOOR_TEXTURES = {
  'Piso de oficina': () => texCanvas(ctx => {
    ctx.fillStyle = '#353a45'; ctx.fillRect(0, 0, 256, 256);
    grout(ctx, 64, '#2b2f38');
    noise(ctx, 0.04);
  }),
  'Losa de cemento': () => texCanvas(ctx => {
    ctx.fillStyle = '#9ba0a8'; ctx.fillRect(0, 0, 256, 256);
    noise(ctx, 0.2);
    ctx.strokeStyle = '#7d828a'; ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * 256, Math.random() * 256);
      ctx.lineTo(Math.random() * 256, Math.random() * 256);
      ctx.stroke();
    }
  }),
  'Madera clara': () => texCanvas(ctx => {
    ctx.fillStyle = '#c9a97a'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(120,80,40,${0.12 + Math.random() * 0.2})`;
      ctx.lineWidth = 1 + Math.random() * 2;
      const y = Math.random() * 256;
      ctx.beginPath(); ctx.moveTo(0, y);
      ctx.bezierCurveTo(80, y + 10, 160, y - 8, 256, y + 5);
      ctx.stroke();
    }
    grout(ctx, 64, 'rgba(120,80,40,0.35)');
  }),
  'Piso técnico (gris)': () => texCanvas(ctx => {
    ctx.fillStyle = '#d6d9de'; ctx.fillRect(0, 0, 256, 256);
    grout(ctx, 64, '#aeb2ba');
    // Detalle de paneles perforados (data center)
    for (let i = 16; i < 256; i += 64) {
      for (let j = 16; j < 256; j += 64) {
        ctx.fillStyle = '#c3c7ce';
        ctx.beginPath(); ctx.arc(i, j, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
  })
};
const floorTextureCache = {};
export function getFloorTexture(name) {
  if (!FLOOR_TEXTURES[name]) name = 'Piso de oficina';
  if (!floorTextureCache[name]) floorTextureCache[name] = FLOOR_TEXTURES[name]();
  return floorTextureCache[name];
}
export const floorTextureNames = Object.keys(FLOOR_TEXTURES);

// Aplica una textura al piso (cambio de material in-place, sin recrear geometría).
export function applyFloorTexture(name) {
  if (!FLOOR_TEXTURES[name]) name = 'Piso de oficina';
  currentFloorTex = name;
  if (floorMesh) {
    floorMesh.material = new THREE.MeshStandardMaterial({
      map: getFloorTexture(name), roughness: 0.85, metalness: 0.1
    });
    floorMesh.material.needsUpdate = true;
  }
}

// Selección por defecto al construir el piso (llamado desde index.js).
export function buildDefaultFloor() {
  const floor = new THREE.Mesh(geo.plane(30, 22), floorMatDefault());
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  officeGroup.add(floor);
  floorMesh = floor;
  applyFloorTexture(currentFloorTex);
  return floor;
}

function floorMatDefault() {
  return new THREE.MeshStandardMaterial({ map: getFloorTexture('Piso de oficina'), roughness: 0.85, metalness: 0.1 });
}