// js/office/sceneCameras.js — Cámaras colocables de escena (GLM #3).
//
// Un prop "📷 Cámara" del catálogo (📡 Red): se posiciona y orienta como
// cualquier objeto (gizmo/sliders) y además guarda su propio FOV. En la
// línea de tiempo, una toma puede usar "Cámara puesta" como vista: elige
// la cámara en el dropdown "Quién" y la toma mira con SU posición y SU FOV.
//
// El encuadre lo define el prop (dónde está + hacia dónde mira + FOV), no la
// toma — así se puede reutilizar la misma cámara en varias tomas y moverla
// una sola vez. La rotación del gizmo (rotY) marca la dirección de mirada;
// la altura de la óptica es la del prop.
//
// userData.spawnData: { fov } — persiste en el JSON del proyecto.

import * as THREE from 'three';
import * as geo from './geoCache.js';
import { officeGroup } from './group.js';
import { registerSelectable } from '../ui/selection.js';

const DEFAULT_FOV = 50;

// Cuerpo low-poly de una cámara de video sobre trípode. El "frente" (lente)
// apunta a +z local, igual que la convención de personajes: rotY=0 mira al SUR.
export function createSceneCamera(id, name, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  const dark = new THREE.MeshStandardMaterial({ color: 0x23262d, roughness: 0.5, metalness: 0.6 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 0.4, metalness: 0.7 });

  // Trípode: 3 patas inclinadas
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(geo.cylinder(0.02, 0.025, 1.0, 6), dark);
    const a = (i / 3) * Math.PI * 2;
    leg.position.set(Math.sin(a) * 0.16, 0.5, Math.cos(a) * 0.16);
    leg.rotation.z = Math.sin(a) * 0.32;
    leg.rotation.x = Math.cos(a) * 0.32;
    g.add(leg);
  }
  // Columna central
  const column = new THREE.Mesh(geo.cylinder(0.03, 0.03, 0.5, 8), accent);
  column.position.y = 1.1;
  g.add(column);
  // Cabezal + cuerpo de la cámara (la óptica queda a ~1.35 m)
  const head = new THREE.Mesh(geo.box(0.16, 0.06, 0.16), accent);
  head.position.y = 1.38;
  g.add(head);
  const body = new THREE.Mesh(geo.box(0.16, 0.14, 0.3), dark);
  body.position.set(0, 1.5, 0);
  body.castShadow = true;
  g.add(body);
  // Lente (cilindro hacia +z: la dirección de mirada)
  const lens = new THREE.Mesh(geo.cylinder(0.05, 0.055, 0.1, 12), accent);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, 1.5, 0.19);
  g.add(lens);
  // Visor trasero + tally rojo (grabando)
  const tally = new THREE.Mesh(geo.box(0.03, 0.03, 0.01),
    new THREE.MeshBasicMaterial({ color: 0xff3333 }));
  tally.position.set(0.06, 1.56, 0.16);
  g.add(tally);

  g.userData.spawnData = { fov: DEFAULT_FOV };
  officeGroup.add(g);
  registerSelectable(id, name, g, 'prop');
  return g;
}

// FOV guardado en el prop (para la toma que la usa).
export function sceneCameraFov(group) {
  const sd = group && group.userData.spawnData;
  const f = sd && typeof sd.fov === 'number' ? sd.fov : DEFAULT_FOV;
  return Math.min(100, Math.max(20, f));
}

export function setSceneCameraFov(group, fov) {
  if (!group) return;
  group.userData.spawnData = group.userData.spawnData || {};
  group.userData.spawnData.fov = Math.min(100, Math.max(20, Math.round(fov)));
}
