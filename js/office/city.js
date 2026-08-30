// js/office/city.js — extraído de office.js (split P1, ver mejoras_glm.md)

import * as THREE from 'three';
import * as geo from './geoCache.js';
import { officeGroup } from './group.js';
import { lampLights, lampMeshes } from '../state.js';
import { registerSelectable } from '../selection.js';

export function buildCity() {
// ============================================================
// EXTERIOR / VÍA PÚBLICA ALREDEDOR DEL EDIFICIO
// ============================================================
// Césped que rodea el terreno, con veredas, calle perimetral, arbolado de
// parque y un par de construcciones a lo lejos (todo estático, no editable).
const matGrass = new THREE.MeshStandardMaterial({ color: 0x5f9b46, roughness: 1 });
const grassPlane = new THREE.Mesh(geo.plane(120, 90), matGrass);
grassPlane.rotation.x = -Math.PI / 2;
grassPlane.position.y = -0.06;
officeGroup.add(grassPlane);

const concreteM = new THREE.MeshStandardMaterial({ color: 0xb2b6be, roughness: 1 });
const asphaltM = new THREE.MeshStandardMaterial({ color: 0x383b41, roughness: 0.85 });
const laneM = new THREE.MeshBasicMaterial({ color: 0xfff1c0 });
const curbM = new THREE.MeshStandardMaterial({ color: 0x8a9099, roughness: 0.9 });

// Pieza plana (strip) horizontal sobre el piso
function underStrip(x, z, w, d, mat, yy) {
  const m = new THREE.Mesh(geo.box(w, 0.05, d), mat);
  m.position.set(x, yy, z);
  m.receiveShadow = true;
  officeGroup.add(m);
  return m;
}

// Aceras / veredas de hormigón alrededor del edificio (4 lados)
underStrip(0, -12.6, 31.0, 1.7, concreteM, 0.02);  // norte
underStrip(0, 12.6, 31.0, 1.7, concreteM, 0.02);   // sur
underStrip(-15.5, 0, 1.7, 26.8, concreteM, 0.02);  // oeste (no pisa las esquinas)
underStrip(15.5, 0, 1.7, 26.8, concreteM, 0.02);   // este

// Calle perimetral (asfalto) rodeando las veredas, en anillo CERRADO y con
// esquinas de rectángulo limpio: los bordes externos de las 4 calles quedan
// alineados (|x|=21.6, |z|=19.1). Las calles norte/sur cubren las esquinas
// hasta exactamente el borde externo de las este/oeste — sin pestañas, huecos
// ni solapes coplanares.
underStrip(0, -17.0, 43.2, 4.2, asphaltM, 0.03);   // norte (incluye esquinas)
underStrip(0, 17.0, 43.2, 4.2, asphaltM, 0.03);    // sur (incluye esquinas)
underStrip(-19.5, 0, 4.2, 29.8, asphaltM, 0.03);   // oeste
underStrip(19.5, 0, 4.2, 29.8, asphaltM, 0.03);    // este

// Esquinas de vereda: cuadrados que cierran el anillo peatonal (entre el
// borde exterior de las veredas N/S y el arranque de las E/O).
[[-15.5, -14.15], [15.5, -14.15], [-15.5, 14.15], [15.5, 14.15]].forEach(([cx, cz]) => {
  underStrip(cx, cz, 1.7, 1.5, concreteM, 0.02);
});

// Línea discontinua amarilla central en cada calle
function laneDash(axisIsX, fixed, count, span, lineLen) {
  const gap = span / count;
  for (let i = 0; i < count; i++) {
    if (i % 2 !== 0) continue;
    const along = (i - count / 2) * gap + gap / 2;
    const m = new THREE.Mesh(geo.box(
      axisIsX ? lineLen : 0.2, 0.01, axisIsX ? 0.18 : lineLen), laneM);
    m.position.set(axisIsX ? along : fixed, 0.075, axisIsX ? fixed : along);
    officeGroup.add(m);
  }
}

// Marcas de carril: línea amarilla central SOLO en los tramos rectos —
// se corta antes de las esquinas/intersecciones para no cruzar las juntas.
laneDash(true, -17.0, 18, 33, 1.0);   // norte
laneDash(true, 17.0, 18, 33, 1.0);    // sur
laneDash(false, -19.5, 16, 28, 1.0);  // oeste
laneDash(false, 19.5, 16, 28, 1.0);   // este

// Árboles de parque (tronco + copa) SOBRE el césped, siempre afuera de la
// calzada: |x| > 22 en los lados este/oeste y |z| > 19.5 al norte/sur.
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4526, roughness: 0.9 });
const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 1 });
function parkTree(x, z, s) {
  const trunk = new THREE.Mesh(geo.cylinder(0.12 * s, 0.18 * s, 1.5 * s, 7), trunkMat);
  trunk.position.set(x, 0.75 * s - 0.06, z); // apoya sobre el césped (y=-0.06)
  trunk.castShadow = true;
  officeGroup.add(trunk);
  const foliage = new THREE.Mesh(geo.sphere(0.85 * s, 8, 8), leafMat);
  foliage.position.set(x, 1.9 * s - 0.06, z);
  foliage.castShadow = true;
  officeGroup.add(foliage);
}
[[-24, -10, 1.1], [-28, 11, 1.3], [25, -12, 1.2], [27, 11, 1.0],
 [-24, -4, 1.4], [24, 0, 1.2], [-8, -21, 1.3], [9, -22, 1.1],
 [-9, 22, 1.2], [9, 21, 1.4]].forEach(([tx, tz, ts]) => parkTree(tx, tz, ts));

// ---------- ARBUSTOS CUADRADOS vereda-calle (barrera, solo por tramos) ----
// Franja de césped entre el borde de la vereda y la calzada. Arbustos con
// forma de caja recortada (setos), agrupados en algunos tramos, no todo el
// contorno.
const bushMats = [0x2f6b33, 0x38793a, 0x2a5e2d].map(c =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
function bushHedge(x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, -0.06, z); // apoya sobre el césped
  g.rotation.y = rotY + (Math.random() - 0.5) * 0.25;
  const m = bushMats[Math.floor(Math.random() * bushMats.length)];
  const base = new THREE.Mesh(geo.box(0.95, 0.55, 0.62), m);
  base.position.y = 0.28;
  base.castShadow = true;
  g.add(base);
  const top = new THREE.Mesh(geo.box(0.62, 0.32, 0.42), m);
  top.position.set(0.09, 0.63, 0.05);
  top.castShadow = true;
  g.add(top);
  officeGroup.add(g);
}
function hedgeRow(axisIsX, fixed, from, to) {
  for (let v = from; v <= to + 0.01; v += 1.15) {
    if (axisIsX) bushHedge(v, fixed, 0);
    else bushHedge(fixed, v, Math.PI / 2);
  }
}
hedgeRow(true, -14.18, -12.5, -4);   // norte, tramo oeste
hedgeRow(true, -14.18, 6, 12);       // norte, tramo este
hedgeRow(true, 14.18, 4, 12);        // sur, tramo este
hedgeRow(false, -16.88, 4, 10);      // oeste, tramo sur
hedgeRow(false, 16.88, -10, -4);     // este, tramo norte

// ---------- CRUCES PEATONALES ---------------------------------------------
// Zebra real: barras PARALELAS al eje de la calle (los autos pasan por
// encima de cada barra a lo largo), repetidas a lo ancho de la calzada.
const zebraM = new THREE.MeshStandardMaterial({ color: 0xe8e6df, roughness: 0.9 });
function crosswalk(axisAlongX, fixed, crossAt) {
  for (let off = -1.42; off <= 1.43; off += 0.95) {
    const m = new THREE.Mesh(geo.box(
      axisAlongX ? 2.6 : 0.5, 0.01, axisAlongX ? 0.5 : 2.6), zebraM);
    m.position.set(
      axisAlongX ? crossAt : fixed + off,
      0.075,
      axisAlongX ? fixed + off : crossAt);
    officeGroup.add(m);
  }
}
crosswalk(true, -17.0, -13);  // calle norte, lado oeste
crosswalk(true, -17.0, 13);   // calle norte, lado este
crosswalk(true, 17.0, -13);   // calle sur, lado oeste
crosswalk(true, 17.0, 13);    // calle sur, lado este
crosswalk(false, -19.5, 10);  // calle oeste
crosswalk(false, 19.5, -10);  // calle este

// ---------- SEMÁFOROS -------------------------------------------------------
// Uno por esquina del anillo, sobre el pasto entre vereda y calle. Las luces
// miran EN CONTRA del sentido de llegada: el que maneja hacia la esquina ve
// las tres luces de frente. Con +45° sobre la diagonal interna, cada semáforo
// queda de cara al tramo recto que alimenta su esquina.
const poleMetalM = new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.45, metalness: 0.75 });
function trafficLight(x, z) {
  const g = new THREE.Group();
  g.position.set(x, -0.06, z);
  g.rotation.y = Math.atan2(-x, -z) + Math.PI / 4;
  const pole = new THREE.Mesh(geo.cylinder(0.06, 0.08, 3.2, 8), poleMetalM);
  pole.position.y = 1.6;
  pole.castShadow = true;
  g.add(pole);
  const head = new THREE.Mesh(geo.box(0.34, 0.95, 0.22), poleMetalM);
  head.position.set(0, 3.35, 0.06);
  head.castShadow = true;
  g.add(head);
  [[0xff4438, 0.28], [0xffc93c, 0.0], [0x39d353, -0.28]].forEach(([c, dy]) => {
    const lamp = new THREE.Mesh(
      geo.circle(0.1, 12),
      new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, roughness: 0.4 }));
    lamp.position.set(0, 3.35 + dy, 0.178);
    g.add(lamp);
  });
  officeGroup.add(g);
}
trafficLight(-16.9, -14.15); // NO
trafficLight(16.9, -14.15);  // NE
trafficLight(-16.9, 14.15);  // SO
trafficLight(16.9, 14.15);   // SE

// ---------- ALUMBRADO PÚBLICO ---------------------------------------------
// Farolas sobre el pasto, al borde externo de cada tramo de calle, con el
// brazo volando hacia la calzada. Se registran en lampLights/lampMeshes para
// encenderse con el modo nocturno como las demás luces.
function streetLamp(x, z, rotY) {
  const g = new THREE.Group();
  g.position.set(x, -0.06, z);
  g.rotation.y = rotY;
  const pole = new THREE.Mesh(geo.cylinder(0.07, 0.11, 4.2, 8), poleMetalM);
  pole.position.y = 2.1;
  pole.castShadow = true;
  g.add(pole);
  const arm = new THREE.Mesh(geo.box(1.1, 0.09, 0.09), poleMetalM);
  arm.position.set(0.55, 4.15, 0);
  arm.castShadow = true;
  g.add(arm);
  const head = new THREE.Mesh(geo.box(0.55, 0.12, 0.26), poleMetalM);
  head.position.set(1.0, 4.08, 0);
  g.add(head);
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff2cf, emissive: 0xffd57e, emissiveIntensity: 1.2, roughness: 0.3
  });
  const bulb = new THREE.Mesh(geo.box(0.42, 0.05, 0.18), bulbMat);
  bulb.position.set(1.0, 4.0, 0);
  g.add(bulb);
  lampMeshes.push(bulb);
  const pLight = new THREE.PointLight(0xffd57e, 0, 16, 1.5);
  pLight.position.set(1.0, 3.85, 0);
  g.add(pLight);
  lampLights.push(pLight);
  officeGroup.add(g);
}
streetLamp(-11, -19.8, -Math.PI / 2); // norte, brazo hacia la calle (+Z)
streetLamp(11, -19.8, -Math.PI / 2);
streetLamp(-11, 19.8, Math.PI / 2);   // sur, brazo hacia la calle (-Z)
streetLamp(11, 19.8, Math.PI / 2);
streetLamp(-22.3, -7, 0);             // oeste, brazo hacia la calle (+X)
streetLamp(-22.3, 7, 0);
streetLamp(22.3, -7, Math.PI);        // este, brazo hacia la calle (-X)
streetLamp(22.3, 7, Math.PI);

// Construcción pequeña: una casa (oeste, al otro lado de la calle)
const roofMat = new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 0.8 });
const wallM = new THREE.MeshStandardMaterial({ color: 0xe7dccb, roughness: 0.8 });
const winM = new THREE.MeshBasicMaterial({ color: 0xbfe3ee });
function house(cx, cz) {
  const g = new THREE.Group();
  g.position.set(cx, -0.06, cz); // apoya sobre el césped
  const body = new THREE.Mesh(geo.box(5, 2.4, 4), wallM);
  body.position.y = 1.2; body.receiveShadow = true; g.add(body);
  const roof = new THREE.Mesh(geo.cone(3.8, 1.4, 4), roofMat);
  roof.rotation.y = Math.PI / 4; roof.position.y = 2.9; roof.castShadow = true; g.add(roof);
  // puerta
  const doorM = new THREE.Mesh(geo.box(0.7, 1.4, 0.1), new THREE.MeshStandardMaterial({ color: 0x6b4526 }));
  doorM.position.set(0, 0.8, 2.1); g.add(doorM);
  // ventanas
  [[-1.5, 1.5, 2.1], [1.5, 1.5, 2.1], [-1.5, 1.5, -2.1]].forEach(([wx, wy, wz]) => {
    const wn = new THREE.Mesh(geo.box(0.7, 0.7, 0.05), winM);
    wn.position.set(wx, wy, wz); g.add(wn);
  });
  officeGroup.add(g);
}
house(-25, 5);
house(28, -7);

// Pequeño comercio (tienda con toldo) al otro lado de la calle norte
function shop(cx, cz) {
  const g = new THREE.Group();
  g.position.set(cx, -0.06, cz); // apoya sobre el césped
  const body = new THREE.Mesh(geo.box(8, 2.6, 4.5), wallM);
  body.position.y = 1.3; body.castShadow = true; g.add(body);
  const roof = new THREE.Mesh(geo.box(8.4, 0.25, 4.9), new THREE.MeshStandardMaterial({ color: 0x44586e }));
  roof.position.y = 2.75; g.add(roof);
  // toldo
  const awning = new THREE.Mesh(geo.box(7, 0.08, 1.0), new THREE.MeshStandardMaterial({ color: 0xd2453f }));
  awning.position.set(0, 2.1, 2.6); g.add(awning);
  // vidriera
  const glassWin = new THREE.Mesh(geo.box(5, 1.2, 0.06), winM);
  glassWin.position.set(0, 1.5, 2.05); g.add(glassWin);
  officeGroup.add(g);
}
shop(-3, -23);

}

