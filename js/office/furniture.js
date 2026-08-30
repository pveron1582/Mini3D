// js/office/furniture.js — extraído de office.js (split P1, ver mejoras_glm.md)

import * as THREE from 'three';
import * as geo from './geoCache.js';
import { officeGroup, serverLedMaterials } from './group.js';
import { woodDeskMat, darkWoodMat, metalDeskMat, chairMat, screenMat } from './materials.js';
import { registerSelectable } from '../ui/selection.js';
import { registerAnchor, setSeatSpots } from '../characters/anchors.js';

// 3. Independent Desks & Chairs (Improved scale: 1.9m width x 0.95m depth)
export function createDesk(id, name, x, z, rotY = 0, isWood = false) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  const topMat = isWood ? darkWoodMat : woodDeskMat;
  const top = new THREE.Mesh(geo.box(1.9, 0.06, 0.95), topMat);
  top.position.y = 0.76;
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);

  const leg1 = new THREE.Mesh(geo.box(0.06, 0.76, 0.85), metalDeskMat);
  leg1.position.set(-0.85, 0.38, 0);
  leg1.castShadow = true;
  g.add(leg1);
  const leg2 = new THREE.Mesh(geo.box(0.06, 0.76, 0.85), metalDeskMat);
  leg2.position.set(0.85, 0.38, 0);
  leg2.castShadow = true;
  g.add(leg2);

  // Monitor realista: base plana + cuello + bisel + pantalla emisiva
  const mBase = new THREE.Mesh(geo.box(0.3, 0.02, 0.2), metalDeskMat);
  mBase.position.set(0, 0.79, -0.24);
  g.add(mBase);
  const neck = new THREE.Mesh(geo.box(0.05, 0.22, 0.05), metalDeskMat);
  neck.position.set(0, 0.9, -0.28);
  g.add(neck);
  const bezel = new THREE.Mesh(geo.box(0.72, 0.44, 0.035), new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.35, metalness: 0.5 }));
  bezel.position.set(0, 1.14, -0.24);
  bezel.castShadow = true;
  g.add(bezel);
  const display = new THREE.Mesh(geo.plane(0.66, 0.37), screenMat);
  display.position.set(0, 1.14, -0.219);
  g.add(display);

  // Teclado bicolor con teclas + mouse
  const keyboard = new THREE.Mesh(geo.box(0.44, 0.02, 0.14), new THREE.MeshStandardMaterial({ color: 0xd8dbe2, roughness: 0.5 }));
  keyboard.position.set(0, 0.80, 0.12);
  g.add(keyboard);
  const keys = new THREE.Mesh(geo.box(0.38, 0.012, 0.09), new THREE.MeshStandardMaterial({ color: 0x2b2f3a }));
  keys.position.set(0, 0.812, 0.12);
  g.add(keys);
  const mouse = new THREE.Mesh(geo.sphere(0.045, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd8dbe2, roughness: 0.4 }));
  mouse.scale.set(1, 0.55, 1.4);
  mouse.position.set(0.36, 0.81, 0.12);
  g.add(mouse);

  // Panel trasero (modesty panel)
  const backPanel = new THREE.Mesh(geo.box(1.8, 0.5, 0.035), topMat);
  backPanel.position.set(0, 0.48, -0.42);
  g.add(backPanel);

  // Cajonera bajo la mesa
  const drawerUnit = new THREE.Group();
  const duBody = new THREE.Mesh(geo.box(0.42, 0.58, 0.6), new THREE.MeshStandardMaterial({ color: 0x33383f, roughness: 0.5, metalness: 0.3 }));
  duBody.position.y = 0.29;
  duBody.castShadow = true;
  drawerUnit.add(duBody);
  for (let d = 0; d < 3; d++) {
    const dh = new THREE.Mesh(geo.box(0.3, 0.03, 0.03), metalDeskMat);
    dh.position.set(0, 0.14 + d * 0.18, 0.31);
    drawerUnit.add(dh);
  }
  drawerUnit.position.set(0.65, 0, 0);
  g.add(drawerUnit);

  // Torre de PC debajo de la mesa
  const tower = new THREE.Group();
  const tBody = new THREE.Mesh(geo.box(0.2, 0.42, 0.42), new THREE.MeshStandardMaterial({ color: 0x181b21, roughness: 0.3, metalness: 0.6 }));
  tBody.position.y = 0.21;
  tBody.castShadow = true;
  tower.add(tBody);
  const powerBtn = new THREE.Mesh(geo.box(0.02, 0.02, 0.01), new THREE.MeshBasicMaterial({ color: 0x66ff99 }));
  powerBtn.position.set(0.05, 0.36, 0.215);
  tower.add(powerBtn);
  serverLedMaterials.push(powerBtn.material);
  tower.position.set(-0.72, 0, 0.05);
  g.add(tower);

  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
  return g;
}

export function createChair(id, name, x, z, rotY = 0) {
  const chair = new THREE.Group();
  chair.position.set(x, 0, z);
  chair.rotation.y = rotY;

  const seat = new THREE.Mesh(geo.box(0.5, 0.08, 0.5), chairMat);
  seat.position.y = 0.48;
  seat.castShadow = true;
  chair.add(seat);

  const back = new THREE.Mesh(geo.box(0.48, 0.54, 0.06), chairMat);
  back.position.set(0, 0.76, 0.23);
  back.castShadow = true;
  chair.add(back);

  const stem = new THREE.Mesh(geo.cylinder(0.04, 0.04, 0.44, 8), metalDeskMat);
  stem.position.y = 0.22;
  chair.add(stem);

  const base = new THREE.Mesh(geo.cylinder(0.28, 0.28, 0.04, 5), metalDeskMat);
  base.position.y = 0.04;
  chair.add(base);

  officeGroup.add(chair);
  registerSelectable(id, name, chair, 'furniture');
  // Ancla de asiento (P4): los personajes que se sientan acá se colocan desde
  // esta ancla (posición+rotación de la silla), no con coordenadas hardcodeadas.
  registerAnchor('seat_' + id, chair);
  return chair;
}

// Central Open Space Desks (enfrentadas: las del norte miran al sur y
// viceversa, como en una oficina real)
// Orientación correcta con las sillas (que no se tocan)
createDesk('desk1', 'Escritorio 1', -1.1, -1.0, Math.PI);
createDesk('desk2', 'Escritorio 2', 1.1, -1.0, Math.PI);
createDesk('desk3', 'Escritorio 3', -1.1, 1.0, 0);
createDesk('desk4', 'Escritorio 4', 1.1, 1.0, 0);

// Central Open Space Chairs (lado exterior de cada escritorio, mirando
// hacia adentro: las parejas quedan enfrentadas a través del divisor)
createChair('chair1', 'Silla Oficina 1', -1.1, -1.7, Math.PI);
createChair('chair2', 'Silla Oficina 2', 1.1, -1.7, Math.PI);
createChair('chair3', 'Silla Oficina 3', -1.1, 1.7, 0);
createChair('chair4', 'Silla Oficina 4', 1.1, 1.7, 0);

export function createSofa(id, name, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  const fabric = new THREE.MeshStandardMaterial({ color: 0x3d6b5e, roughness: 0.95 });
  const base = new THREE.Mesh(geo.box(1.8, 0.35, 0.8), fabric);
  base.position.y = 0.22;
  base.castShadow = true;
  g.add(base);

  const back = new THREE.Mesh(geo.box(1.8, 0.5, 0.18), fabric);
  back.position.set(0, 0.6, 0.31);
  back.castShadow = true;
  g.add(back);

  const armL = new THREE.Mesh(geo.box(0.18, 0.28, 0.8), fabric);
  armL.position.set(-0.9, 0.5, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.9;
  g.add(armR);

  const cushion = new THREE.Mesh(geo.box(1.6, 0.1, 0.62), new THREE.MeshStandardMaterial({ color: 0x4a8071, roughness: 0.95 }));
  cushion.position.y = 0.44;
  g.add(cushion);

  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
  // Ancla de asiento con 2 LUGARES (sillón de 2 cuerpos): un cuerpo a cada
  // lado (±0.45 en el eje lateral del sillón).
  registerAnchor('seat_' + id, g);
  setSeatSpots(g, [{ dx: -0.45, dz: 0 }, { dx: 0.45, dz: 0 }]);
  return g;
}
export function createPlant(id, name, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const pot = new THREE.Mesh(geo.cylinder(0.22, 0.17, 0.35, 12), new THREE.MeshStandardMaterial({ color: 0x8a5a3b, roughness: 0.8 }));
  pot.position.y = 0.17;
  pot.castShadow = true;
  g.add(pot);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d43, roughness: 0.9 });
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(geo.cone(0.09, 0.7, 5), leafMat);
    const a = (i / 5) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.08, 0.62, Math.sin(a) * 0.08);
    leaf.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
    leaf.castShadow = true;
    g.add(leaf);
  }

  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
  return g;
}
export function createFileCabinet(id, name, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  const body = new THREE.Mesh(geo.box(0.6, 1.35, 0.55), new THREE.MeshStandardMaterial({ color: 0x9aa3b2, roughness: 0.4, metalness: 0.6 }));
  body.position.y = 0.68;
  body.castShadow = true;
  g.add(body);

  const drawerMat = new THREE.MeshStandardMaterial({ color: 0x7d8798, roughness: 0.35, metalness: 0.7 });
  for (let i = 0; i < 3; i++) {
    const drawer = new THREE.Mesh(geo.box(0.54, 0.36, 0.04), drawerMat);
    drawer.position.set(0, 0.32 + i * 0.38, 0.29);
    g.add(drawer);
    const handle = new THREE.Mesh(geo.box(0.22, 0.04, 0.03), metalDeskMat);
    handle.position.set(0, 0.42 + i * 0.38, 0.32);
    g.add(handle);
  }

  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
  return g;
}
export function createCopier(id, name, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  const body = new THREE.Mesh(geo.box(0.7, 0.95, 0.85), new THREE.MeshStandardMaterial({ color: 0xd8dade, roughness: 0.35 }));
  body.position.y = 0.48;
  body.castShadow = true;
  g.add(body);

  const lid = new THREE.Mesh(geo.box(0.6, 0.08, 0.7), new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 0.3 }));
  lid.position.set(0, 0.99, 0);
  g.add(lid);

  const panel = new THREE.Mesh(geo.box(0.4, 0.22, 0.03), new THREE.MeshStandardMaterial({ color: 0x14181f, emissive: 0x2a6db5, emissiveIntensity: 0.5 }));
  panel.position.set(0, 0.78, 0.44);
  g.add(panel);

  const tray = new THREE.Mesh(geo.box(0.55, 0.03, 0.25), metalDeskMat);
  tray.position.set(0, 0.6, 0.5);
  g.add(tray);

  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
  return g;
}
export function createEmptyTable(id, name, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  const top = new THREE.Mesh(geo.box(2.2, 0.06, 1.1), woodDeskMat);
  top.position.y = 0.76;
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);

  const leg1 = new THREE.Mesh(geo.box(0.06, 0.76, 1.0), metalDeskMat);
  leg1.position.set(-1.0, 0.38, 0);
  leg1.castShadow = true;
  g.add(leg1);
  const leg2 = new THREE.Mesh(geo.box(0.06, 0.76, 1.0), metalDeskMat);
  leg2.position.set(1.0, 0.38, 0);
  leg2.castShadow = true;
  g.add(leg2);

  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
  return g;
}

// (La "Mesa de Trabajo IT" que estaba al lado de la puerta de entrada fue
// ELIMINADA a pedido: sobraba ahí. La toma de piso asociada también.)

// ==========================================
// 6. IT HARDWARE & PROPS (PC TOWER, LAPTOP)
// ==========================================
// (El switch y el router sueltos que flotaban en la sala de servidores
// fueron eliminados: habían quedado a 0,8 m de altura sin mueble debajo.)

// C. PC Gaming / IT Server Tower
// Fábrica paramétrica (P7/bug laptop): recibe id, nombre y posición. La
// instancia original de la escena y las del catálogo comparten esta ruta.
export function createPCTower(id = 'it_pc', name = '🖥️ Torre PC IT', x = -6.6, y = 0.79, z = -6.8, rotY = 0) {
  const pc = new THREE.Group();
  pc.position.set(x, y, z);
  pc.rotation.y = rotY;

  const chassis = new THREE.Mesh(geo.box(0.24, 0.48, 0.48), new THREE.MeshStandardMaterial({ color: 0x121418, roughness: 0.3, metalness: 0.7 }));
  chassis.position.y = 0.24;
  chassis.castShadow = true;
  pc.add(chassis);

  // Tempered Glass Panel
  const glass = new THREE.Mesh(geo.plane(0.44, 0.44), new THREE.MeshStandardMaterial({ color: 0x334455, transparent: true, opacity: 0.6, metalness: 0.9 }));
  glass.rotation.y = Math.PI / 2;
  glass.position.set(0.122, 0.24, 0);
  pc.add(glass);

  // RGB Fan inside
  const fan = new THREE.Mesh(geo.ring(0.04, 0.08, 16), new THREE.MeshBasicMaterial({ color: 0xff00aa, side: THREE.DoubleSide }));
  fan.rotation.y = Math.PI / 2;
  fan.position.set(0.08, 0.28, 0.05);
  pc.add(fan);

  // Frente: botón de encendido + rejillas de ventilación
  const pwrBtn = new THREE.Mesh(geo.cylinder(0.02, 0.02, 0.01, 10), new THREE.MeshBasicMaterial({ color: 0x66ff99 }));
  pwrBtn.rotation.x = Math.PI / 2;
  pwrBtn.position.set(0, 0.44, 0.245);
  pc.add(pwrBtn);
  serverLedMaterials.push(pwrBtn.material);
  for (let v = 0; v < 4; v++) {
    const vent = new THREE.Mesh(geo.box(0.16, 0.015, 0.01), new THREE.MeshStandardMaterial({ color: 0x0b0d11 }));
    vent.position.set(0, 0.08 + v * 0.045, 0.245);
    pc.add(vent);
  }

  officeGroup.add(pc);
  if (id) registerSelectable(id, name, pc, 'prop');
  return pc;
}
createPCTower();

// D. Independent Laptop — fábrica paramétrica (id, nombre, posición)
export function createLaptop(id = 'it_laptop', name = '💻 Laptop Independiente', x = -1.1, y = 0.79, z = -0.6, rotY = 0) {
  const lap = new THREE.Group();
  lap.position.set(x, y, z);
  lap.rotation.y = rotY;

  const base = new THREE.Mesh(geo.box(0.36, 0.015, 0.26), new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.8, roughness: 0.3 }));
  base.position.y = 0.008;
  lap.add(base);

  const keyb = new THREE.Mesh(geo.box(0.3, 0.005, 0.12), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  keyb.position.set(0, 0.018, 0.02);
  lap.add(keyb);

  const screenPivot = new THREE.Group();
  screenPivot.position.set(0, 0.015, -0.13);
  screenPivot.rotation.x = 0.35; // 110 deg open

  const lid = new THREE.Mesh(geo.box(0.36, 0.24, 0.012), new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.8 }));
  lid.position.y = 0.12;
  screenPivot.add(lid);

  const display = new THREE.Mesh(geo.plane(0.33, 0.21), screenMat);
  display.position.set(0, 0.12, 0.007);
  screenPivot.add(display);

  lap.add(screenPivot);
  officeGroup.add(lap);
  if (id) registerSelectable(id, name, lap, 'prop');
  return lap;
}
createLaptop();

