// js/office/hackerHouse.js — extraído de office.js (split P1, ver mejoras_glm.md)

import * as THREE from 'three';
import * as geo from './geoCache.js';
import { officeGroup, serverLedMaterials } from './group.js';
import { wallMat } from './walls.js';
import { glassMat, screenMat } from './materials.js';
import { registerSelectable } from '../ui/selection.js';
import { camera } from '../core.js';
import { registerTicker } from '../tickers.js';

// ==========================================
// CASA DEL HACKER (interior visible, dos ambientes)
// ==========================================
// Casa afuera de la oficina, estilo "casa de muñecas": la pared que queda entre
// la cámara y el interior se oculta, y el techo se oculta cuando la cámara está
// sobre la planta, para que siempre se vea el interior. Tiene dos ambientes:
// el "guarida hacker" (oeste) y un estar/dormitorio (este).
const HH_X = 9, HH_Z = -27;         // centro de la casa
const HH_HALFW = 4, HH_HALFD = 2.75; // media planta (8 x 5.5 m)
const HH_WALLH = 2.5;                // alto de paredes
const hackerHouseWalls = [];         // grupos de pared exterior (se ocultan según cámara)
const hackerHouseColliders = [];     // AABB de paredes (colisión de personajes)

export function getHackerHouseColliders() {
  return hackerHouseColliders;
}

// Visibilidad tipo casa de muñecas (llamado desde render.js con la cámara)
export function updateHackerHouse(camPos) {
  if (!officeGroup.visible) return;
  // Paredes exteriores: ocultar la que queda entre la cámara y el interior
  hackerHouseWalls.forEach(w => {
    const n = w.userData.normal, c = w.userData.center;
    const dot = (camPos.x - c.x) * n[0] + (camPos.z - c.z) * n[1];
    w.visible = dot < 0;
  });
}

// Añade una caja de pared al grupo `g` y (opcional) registra su colisionador AABB
function hhWallBox(g, w, h, d, x, y, z, mat, collider) {
  const m = new THREE.Mesh(geo.box(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  if (collider) {
    hackerHouseColliders.push({
      minX: x - w / 2, maxX: x + w / 2,
      minZ: z - d / 2, maxZ: z + d / 2
    });
  }
  return m;
}
export function buildHackerHouseInterior() {
  // ============================================================
  // CASA DEL HACKER (dos ambientes, interior visible)
  // ============================================================
  (function buildHackerHouse() {
const T = 0.15;                        // espesor de pared exterior
const wallMat = new THREE.MeshStandardMaterial({ color: 0x9aa5b1, roughness: 0.85 });
const wallMatIn = new THREE.MeshStandardMaterial({ color: 0xb8c0cc, roughness: 0.9 });
const hhFloorMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.9 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fd4e8, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.55 });

const x0 = HH_X - HH_HALFW, x1 = HH_X + HH_HALFW;   // 5 .. 13
const z0 = HH_Z - HH_HALFD, z1 = HH_Z + HH_HALFD;   // -29.75 .. -24.25
const wy = HH_WALLH / 2;                             // centro Y de paredes

// ---- Piso (losa) ----
const floor = new THREE.Mesh(geo.box(HH_HALFW * 2 + 0.6, 0.14, HH_HALFD * 2 + 0.6), hhFloorMat);
floor.position.set(HH_X, -0.07, HH_Z);
floor.receiveShadow = true;
officeGroup.add(floor);

// ---- Pared SUR (frente, con puerta a la guarida) — normal (0,1) ----
const wallS = new THREE.Group();
wallS.userData.normal = [0, 1];
wallS.userData.center = { x: HH_X, z: z1 };
const doorX = 6.5, doorW = 0.9, doorH = 2.0;
const dL = (doorX - doorW / 2) - x0;                 // segmento izquierdo
hhWallBox(wallS, dL, HH_WALLH, T, x0 + dL / 2, wy, z1, wallMat, true);
const dR = x1 - (doorX + doorW / 2);                 // segmento derecho
hhWallBox(wallS, dR, HH_WALLH, T, x1 - dR / 2, wy, z1, wallMat, true);
hhWallBox(wallS, doorW, HH_WALLH - doorH, T, doorX, doorH + (HH_WALLH - doorH) / 2, z1, wallMat, false); // dintel
const winS = new THREE.Mesh(geo.box(1.0, 0.85, 0.05), glassMat);
winS.position.set(10.6, 1.5, z1 + 0.1);
wallS.add(winS);
officeGroup.add(wallS);
hackerHouseWalls.push(wallS);

// ---- Pared NORTE (fondo) — normal (0,-1) ----
const wallN = new THREE.Group();
wallN.userData.normal = [0, -1];
wallN.userData.center = { x: HH_X, z: z0 };
hhWallBox(wallN, HH_HALFW * 2, HH_WALLH, T, HH_X, wy, z0, wallMat, true);
const winN = new THREE.Mesh(geo.box(1.2, 0.85, 0.05), glassMat);
winN.position.set(11, 1.5, z0 - 0.1);
wallN.add(winN);
officeGroup.add(wallN);
hackerHouseWalls.push(wallN);

// ---- Pared OESTE — normal (-1,0) ----
const wallW = new THREE.Group();
wallW.userData.normal = [-1, 0];
wallW.userData.center = { x: x0, z: HH_Z };
hhWallBox(wallW, T, HH_WALLH, HH_HALFD * 2, x0, wy, HH_Z, wallMat, true);
const winW = new THREE.Mesh(geo.box(0.05, 0.85, 1.2), glassMat);
winW.position.set(x0 - 0.1, 1.5, -26.2);
wallW.add(winW);
officeGroup.add(wallW);
hackerHouseWalls.push(wallW);

// ---- Pared ESTE — normal (1,0) ----
const wallE = new THREE.Group();
wallE.userData.normal = [1, 0];
wallE.userData.center = { x: x1, z: HH_Z };
hhWallBox(wallE, T, HH_WALLH, HH_HALFD * 2, x1, wy, HH_Z, wallMat, true);
const winE = new THREE.Mesh(geo.box(0.05, 0.85, 1.2), glassMat);
winE.position.set(x1 + 0.1, 1.5, -26.2);
wallE.add(winE);
officeGroup.add(wallE);
hackerHouseWalls.push(wallE);

// ---- TABIQUE interior (dos ambientes) con abertura de paso ----
const partT = 0.12;
const part = new THREE.Group();
const segN_len = (-27.3) - z0;                       // tramo norte
hhWallBox(part, partT, HH_WALLH, segN_len, HH_X, wy, z0 + segN_len / 2, wallMatIn, true);
const segS_len = z1 - (-26.3);                       // tramo sur
hhWallBox(part, partT, HH_WALLH, segS_len, HH_X, wy, -26.3 + segS_len / 2, wallMatIn, true);
officeGroup.add(part);

// ---- MUEBLES: guarida hacker (ambiente oeste) ----
const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.6 });
const deskMat = new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.5 });
const desk = new THREE.Group();
const dtop = new THREE.Mesh(geo.box(2.4, 0.08, 0.85), deskMat);
dtop.position.y = 0.74; dtop.castShadow = true;
desk.add(dtop);
[[-1.1, -0.35], [1.1, -0.35], [-1.1, 0.35], [1.1, 0.35]].forEach(([lx, lz]) => {
  const leg = new THREE.Mesh(geo.box(0.08, 0.7, 0.08), darkMat);
  leg.position.set(lx, 0.35, lz);
  desk.add(leg);
});
desk.position.set(6.8, 0, -28.9);
officeGroup.add(desk);
// 3 monitores con pantalla verde "código"
const screenMat = new THREE.MeshBasicMaterial({ color: 0x1f6f2f });
for (let i = 0; i < 3; i++) {
  const mon = new THREE.Group();
  const scr = new THREE.Mesh(geo.box(0.62, 0.4, 0.04), screenMat);
  scr.position.y = 0.32;
  mon.add(scr);
  const stand = new THREE.Mesh(geo.box(0.08, 0.14, 0.08), darkMat);
  stand.position.y = 0.05;
  mon.add(stand);
  mon.position.set(6.8 + (i - 1) * 0.72, 0.78, -29.1);
  officeGroup.add(mon);
}
// Silla frente al escritorio
const chair = new THREE.Group();
const seat = new THREE.Mesh(geo.box(0.5, 0.08, 0.5), darkMat);
seat.position.y = 0.48; chair.add(seat);
const backr = new THREE.Mesh(geo.box(0.5, 0.55, 0.08), darkMat);
backr.position.set(0, 0.78, 0.24); chair.add(backr);
const post = new THREE.Mesh(geo.cylinder(0.05, 0.05, 0.44, 8), darkMat);
post.position.y = 0.24; chair.add(post);
chair.position.set(6.8, 0, -28.0);
officeGroup.add(chair);
// Torre / servidor con LED
const tower = new THREE.Mesh(geo.box(0.5, 1.3, 0.55), darkMat);
tower.position.set(5.3, 0.65, -29.0); tower.castShadow = true;
officeGroup.add(tower);
const towerLed = new THREE.Mesh(geo.box(0.3, 0.06, 0.02), new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
towerLed.position.set(5.3, 1.0, -28.72);
officeGroup.add(towerLed);
serverLedMaterials.push(towerLed.material);
// Caja de pizza en el piso (detalle de color)
const pizza = new THREE.Mesh(geo.box(0.5, 0.05, 0.5), new THREE.MeshStandardMaterial({ color: 0xc9a24b, roughness: 0.9 }));
pizza.position.set(7.9, 0.03, -26.2); pizza.rotation.y = 0.4;
officeGroup.add(pizza);

// ---- MUEBLES: estar / dormitorio (ambiente este) ----
const sofaMat = new THREE.MeshStandardMaterial({ color: 0x5a6b7c, roughness: 0.8 });
const sofa = new THREE.Group();
const sbase = new THREE.Mesh(geo.box(0.8, 0.4, 1.9), sofaMat);
sbase.position.y = 0.25; sofa.add(sbase);
const sback = new THREE.Mesh(geo.box(0.25, 0.6, 1.9), sofaMat);
sback.position.set(0.35, 0.55, 0); sofa.add(sback);
sofa.position.set(12.4, 0, -27);
officeGroup.add(sofa);
const ctable = new THREE.Mesh(geo.box(0.7, 0.4, 0.9), new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.7 }));
ctable.position.set(11.0, 0.2, -27); ctable.castShadow = true;
officeGroup.add(ctable);
const rug2 = new THREE.Mesh(geo.box(2.6, 0.02, 2.2), new THREE.MeshStandardMaterial({ color: 0x6b4a4a, roughness: 1 }));
rug2.position.set(11, 0.015, -27); rug2.receiveShadow = true;
officeGroup.add(rug2);

// ---- LUCES interiores (una por ambiente) ----
const lampDen = new THREE.PointLight(0xfff0d0, 1.6, 10, 1.5);
lampDen.position.set(7, 2.2, -27);
officeGroup.add(lampDen);
const lampLiv = new THREE.PointLight(0xfff0d0, 1.4, 10, 1.5);
lampLiv.position.set(11, 2.2, -27);
officeGroup.add(lampLiv);
  })();
}

// Ticker por-frame (P2): ocultar pared/techo de la casa del hacker según la
// posición de la cámara (interior visible). Antes vivía en render.js.
registerTicker((_simDt, _globalTime) => updateHackerHouse(camera.position));

