// js/cinema/wpNumbers.js — RF-67: números de orden (01, 02, … 99) en un
// sprite de texto sobre la esfera de cada marker, visible mientras se edita
// el camino. Del punto 100 en adelante no llevan número (siguen funcionando).
// Patrón canvas→texture igual que subtítulos/quiz: el texto se dibuja en un
// lienzo chico y se usa como map de un Sprite con depthTest apagado.
import * as THREE from 'three';

const NUM_W = 128, NUM_H = 64;
const NUM_H_WORLD = 0.16;   // alto del número en unidades de mundo

// Índice 0-based → etiqueta '01'…'99'; 100º en adelante → '' (sin número).
export function waypointNumberLabel(index0) {
  if (!(index0 >= 0) || index0 > 98) return '';
  return String(index0 + 1).padStart(2, '0');
}

function ensureNumberSprite(mesh, lift) {
  let spr = mesh.userData.numberSprite;
  if (spr) return spr;
  const cv = document.createElement('canvas');
  cv.width = NUM_W;
  cv.height = NUM_H;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthTest: false, depthWrite: false
  }));
  spr.renderOrder = 1002;
  spr.scale.set(NUM_H_WORLD * (NUM_W / NUM_H), NUM_H_WORLD, 1);
  spr.position.y = lift;   // sobre la esfera (el sprite es hijo del marker)
  mesh.add(spr);
  mesh.userData.numberSprite = spr;
  return spr;
}

// Deja el marker con el número que corresponde (índice 0-based). Índice < 0
// o ≥ 100 → sin número (sprite oculto). Redibuja SOLO si el label cambió:
// updateMoveMarkers corre hasta en cada frame de drag.
export function syncMarkerNumber(mesh, index0, lift) {
  const label = waypointNumberLabel(index0);
  if (mesh.userData.numberLabel === label) return;
  const spr = ensureNumberSprite(mesh, lift);
  spr.visible = !!label;
  mesh.userData.numberLabel = label;
  if (!label) return;
  const ctx = spr.userData.ctx || (spr.userData.ctx = spr.material.map.image.getContext('2d'));
  ctx.clearRect(0, 0, NUM_W, NUM_H);
  ctx.font = 'bold 40px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.strokeText(label, NUM_W / 2, NUM_H / 2);
  ctx.fillStyle = '#fff';
  ctx.fillText(label, NUM_W / 2, NUM_H / 2);
  spr.material.map.needsUpdate = true;
}
