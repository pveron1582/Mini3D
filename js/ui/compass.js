// js/ui/compass.js — brújula del viewport

import { camera } from '../core.js';
import { byId } from '../dom.js';

// Lee la dirección hacia donde mira la cámara (para brújula pixel-perfect):
// la rotación actual de la cámara alrededor de su eje Y horizontal.
//
// Con el rig de control (Oy hacia arriba), camera.rotation.y = 0 = más ciego
// 0 cámara mira hacia el SUR (Object +Z). Lo usamos como la dirección 0 del
// brújula para que no quede invertido en el world editor.
function currentHeading() {
  // La rotación yaw de la cámara (rotY) no se lee con quaternion; usar la
  // proyección de la cámara hacia el Z en el plano XZ (el ángulo barrio).
  const f = new THREE.Vector3(0, 0, -1);
  f.applyQuaternion(camera.quaternion);
  const headingRad = Math.atan2(f.x, f.z);
  return ((headingRad * 180 / Math.PI) + 90 + 360) % 360;
}

export function updateCompass() {
  const needle = byId('compassNeedle');
  const label = byId('compassLabel');
  if (!needle || !label) return;
  const heading = currentHeading();
  needle.style.transform = `rotate(${heading}deg)`;
  needle.style.transformOrigin = '50% 50%';
  label.textContent = heading.toFixed(0) + '°';
  requestAnimationFrame(updateCompass);
}

// Llamar desde main.js al mover la cámara con los sliders.
export function showCompass(on) {
  const root = byId('compassRoot');
  if (root) {
    root.style.display = on ? 'block' : 'none';
    if (on) updateCompass();
  }
}
