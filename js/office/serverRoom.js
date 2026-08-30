// js/office/serverRoom.js — extraído de office.js (split P1, ver mejoras_glm.md)

import * as THREE from 'three';
import * as geo from './geoCache.js';
import { officeGroup, serverLedMaterials, stepLadder, STEP_LADDER_ORIGIN } from './group.js';
import { rackMat, screenMat, metalDeskMat, woodDeskMat } from './materials.js';
import { createChair, createCopier, createEmptyTable } from './furniture.js';
import { registerSelectable } from '../ui/selection.js';
import { registerCatalogEntry } from '../catalog.js';

export function buildServerRoom() {

// 4. Server Racks (Individual & Movable) — detalle técnico
// Rack de 19" con patch panel, switch 24p, blades con bahías, UPS y
// organizador de cables. Materiales cibernéticos IM&DT.
const rackFrameMat = new THREE.MeshStandardMaterial({ color: 0x181a1f, roughness: 0.3, metalness: 0.9 });
const rackDarkMat = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, metalness: 0.8, roughness: 0.4 });
const rackBladeMat = new THREE.MeshStandardMaterial({ color: 0x262a33, metalness: 0.7, roughness: 0.4 });
const patchPortMat = new THREE.MeshBasicMaterial({ color: 0x0a2a18 });
const switchBodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1e24, metalness: 0.8, roughness: 0.3 });
const ru = 0.0889; // unidad de rack (~0.089 m ≈ 1U)

function createServerRack(id, name, x, z) {
  const rack = new THREE.Group();
  rack.position.set(x, 0, z);

  // Marco / chasis exterior
  const frame = new THREE.Mesh(geo.box(1.0, 2.4, 0.9), rackFrameMat);
  frame.position.y = 1.2;
  frame.castShadow = true;
  frame.receiveShadow = true;
  rack.add(frame);

  // Postes verticales frontales de montaje (rails)
  [-0.42, 0.42].forEach(rx => {
    const rail = new THREE.Mesh(geo.box(0.03, 2.28, 0.05), rackDarkMat);
    rail.position.set(rx, 1.2, 0.42);
    rack.add(rail);
  });

  // ===== Unidades (de arriba hacia abajo) =====
  // 1) Patch panel 24 puertos (2U) arriba
  const patchPanel = new THREE.Mesh(geo.box(0.88, ru * 2, 0.1), rackDarkMat);
  patchPanel.position.set(0, 2.26, 0.42);
  rack.add(patchPanel);
  for (let p = -0.38; p <= 0.38; p += 0.034) {
    const port = new THREE.Mesh(geo.box(0.022, 0.045, 0.03), patchPortMat);
    port.position.set(p, 2.26, 0.475);
    rack.add(port);
  }
  // Ranura de patch cable vertical (organizador)
  const patchSpool = new THREE.Mesh(geo.torus(0.05, 0.02, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xd8a72f, roughness: 0.6 }));
  patchSpool.rotation.x = Math.PI / 2;
  patchSpool.position.set(-0.42, 2.12, 0.44);
  rack.add(patchSpool);

  // 2) Switch 24-puertos gestionable (1U)
  const switchS = new THREE.Mesh(geo.box(0.88, ru, 0.44), switchBodyMat);
  switchS.position.set(0, 2.02, 0.42);
  rack.add(switchS);
  for (let p = -0.36; p <= 0.3; p += 0.034) {
    const sp = new THREE.Mesh(geo.box(0.018, 0.018, 0.015), new THREE.MeshBasicMaterial({ color: 0x222222 }));
    sp.position.set(p, 2.03, 0.645);
    rack.add(sp);
    const sl = new THREE.Mesh(geo.box(0.01, 0.008, 0.005), new THREE.MeshBasicMaterial({ color: 0x00ff66 }));
    sl.position.set(p, 2.07, 0.645);
    rack.add(sl);
    serverLedMaterials.push(sl.material);
  }
  // LED de estado del switch
  const switchLed = new THREE.Mesh(geo.box(0.03, 0.02, 0.01), new THREE.MeshBasicMaterial({ color: 0x33ccff }));
  switchLed.position.set(0.4, 2.07, 0.645);
  rack.add(switchLed);
  serverLedMaterials.push(switchLed.material);

  // 3) Blades de servidor (bahías con frente detallado), 4 unidades
  const bladeYs = [1.75, 1.5, 1.25, 1.0];
  bladeYs.forEach((by, bi) => {
    const blade = new THREE.Mesh(geo.box(0.86, ru * 2.5, 0.5), rackBladeMat);
    blade.position.set(0, by, 0.42);
    blade.castShadow = true;
    rack.add(blade);
    // Frente con 4 bahías de disco
    for (let hh = 0; hh < 2; hh++) {
      for (let vv = 0; vv < 2; vv++) {
        const bay = new THREE.Mesh(geo.box(0.18, 0.06, 0.03),
          new THREE.MeshStandardMaterial({ color: 0x0e1116, roughness: 0.4, metalness: 0.7 }));
        bay.position.set(-0.2 + vv * 0.4, by - 0.04 + hh * 0.09, 0.66);
        rack.add(bay);
      }
    }
    // LED de actividad por blade
    const bLed = new THREE.Mesh(geo.box(0.03, 0.02, 0.008), new THREE.MeshBasicMaterial({ color: bi % 2 ? 0xffcc33 : 0x00ff88 }));
    bLed.position.set(0.32, by + 0.06, 0.67);
    rack.add(bLed);
    serverLedMaterials.push(bLed.material);
    // Cable de red desde el blade (tramo corto hacia el patch panel)
    const patchCable = new THREE.Mesh(geo.box(0.012, 0.25, 0.012),
      new THREE.MeshStandardMaterial({ color: [0x2f6fd8, 0xd8a72f, 0xd83f3f, 0x2f6fd8][bi % 4], roughness: 0.7 }));
    patchCable.position.set(-0.42, by + 0.03, 0.7);
    rack.add(patchCable);
  });

  // 4) UPS (3U) en la parte baja
  const ups = new THREE.Mesh(geo.box(0.86, ru * 3, 0.5), new THREE.MeshStandardMaterial({ color: 0x23262d, metalness: 0.5, roughness: 0.5 }));
  ups.position.set(0, 0.2, 0.42);
  rack.add(ups);
  const upsScreen = new THREE.Mesh(geo.box(0.28, 0.12, 0.02), new THREE.MeshStandardMaterial({ color: 0x080c12, emissive: 0x33ff66, emissiveIntensity: 0.6 }));
  upsScreen.position.set(-0.15, 0.28, 0.68);
  rack.add(upsScreen);
  serverLedMaterials.push(upsScreen.material);
  for (let uo = -1; uo <= 1; uo++) {
    const out = new THREE.Mesh(geo.box(0.05, 0.02, 0.02), new THREE.MeshStandardMaterial({ color: 0x44484f, metalness: 0.6 }));
    out.position.set(0.25 + uo * 0.08, 0.16, 0.68);
    rack.add(out);
  }

  // 5) Base con ruedas
  const base = new THREE.Mesh(geo.box(0.98, 0.06, 0.88), rackDarkMat);
  base.position.y = 0.06;
  base.castShadow = true;
  rack.add(base);
  [[-0.42, -0.38], [0.42, -0.38], [-0.42, 0.38], [0.42, 0.38]].forEach(([cx, cz]) => {
    const wheel = new THREE.Mesh(geo.torus(0.055, 0.025, 8, 14),
      new THREE.MeshStandardMaterial({ color: 0x0e1013, roughness: 0.8 }));
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(cx, 0.03, cz);
    rack.add(wheel);
  });

  // Organizador vertical de cables (corrida lateral, todo el alto)
  const vOrganizer = new THREE.Mesh(geo.box(0.1, 2.4, 0.06), rackDarkMat);
  vOrganizer.position.set(0.52, 1.2, 0.35);
  vOrganizer.castShadow = true;
  rack.add(vOrganizer);
  // Cables de colores que bajan por el organizador
  [0x2f6fd8, 0xd8a72f, 0xd83f3f].forEach((cc, ci) => {
    const vCable = new THREE.Mesh(geo.box(0.012, 2.2, 0.012),
      new THREE.MeshStandardMaterial({ color: cc, roughness: 0.7 }));
    vCable.position.set(0.52 + (ci - 1) * 0.03, 1.2, 0.35);
    rack.add(vCable);
  });

  officeGroup.add(rack);
  registerSelectable(id, name, rack, 'furniture');
  return rack;
}

createServerRack('serverRack1', 'Rack Servidor 1', -13.5, -9.5);
createServerRack('serverRack2', 'Rack Servidor 2', -12.2, -9.5);
createServerRack('serverRack3', 'Rack Servidor 3', -10.9, -9.5);

// ===== Equipamiento de seguridad / ciberseguridad (sala de servidores) =====

// Firewall / Security Appliance (rack dedicado de 19", estilo appliance)
function createFirewall(id, name, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  const fwBody = new THREE.Mesh(geo.box(0.62, 0.28, 0.48),
    new THREE.MeshStandardMaterial({ color: 0x1e2229, metalness: 0.6, roughness: 0.35 }));
  fwBody.position.y = 0.65;
  fwBody.castShadow = true;
  g.add(fwBody);

  // Frente con puertos y LEDs de estado (verde = tráfico seguro, rojo = alerta)
  for (let p = -0.23; p <= 0.23; p += 0.058) {
    const port = new THREE.Mesh(geo.box(0.025, 0.03, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x0e1116, metalness: 0.7 }));
    port.position.set(p, 0.66, 0.245);
    g.add(port);
    const led = new THREE.Mesh(geo.box(0.012, 0.01, 0.005),
      new THREE.MeshBasicMaterial({ color: (p * 100) % 3 === 0 ? 0xff4433 : 0x00ff88 }));
    led.position.set(p, 0.7, 0.25);
    g.add(led);
    serverLedMaterials.push(led.material);
  }
  // Pantallita LCD de monitoreo
  const lcd = new THREE.Mesh(geo.box(0.16, 0.08, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x06120a, emissive: 0x33ff66, emissiveIntensity: 0.7 }));
  lcd.position.set(0, 0.81, 0.24);
  g.add(lcd);
  serverLedMaterials.push(lcd.material);

  // Patas
  [[-0.26, -0.18], [0.26, -0.18], [-0.26, 0.18], [0.26, 0.18]].forEach(([fx, fz]) => {
    const foot = new THREE.Mesh(geo.cylinder(0.02, 0.02, 0.08, 8),
      new THREE.MeshStandardMaterial({ color: 0x22262c, metalness: 0.8 }));
    foot.position.set(fx, 0.04, fz);
    g.add(foot);
  });

  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
  return g;
}
// Firewall colocado junto al caminar de entrada a la sala de servidores
createFirewall('secFirewall', '🔥 Firewall / Security Appliance', -14.5, -8.2, Math.PI / 2);

// Consola KVM (teclado + pantalla para administrar los servidores)
function createKVMCart(id, name, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  // Base con ruedas + columna
  const base = new THREE.Mesh(geo.box(0.9, 0.05, 0.55),
    rackDarkMat);
  base.position.y = 0.05;
  base.castShadow = true;
  g.add(base);
  [[-0.38, -0.2], [0.38, -0.2], [-0.38, 0.2], [0.38, 0.2]].forEach(([cx, cz]) => {
    const wheel = new THREE.Mesh(geo.torus(0.045, 0.02, 8, 12),
      new THREE.MeshStandardMaterial({ color: 0x0e1013, roughness: 0.8 }));
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(cx, 0.025, cz);
    g.add(wheel);
  });
  const column = new THREE.Mesh(geo.box(0.2, 0.6, 0.05), rackDarkMat);
  column.position.y = 0.35;
  g.add(column);

  // Bandeja con teclado
  const trayK = new THREE.Mesh(geo.box(0.75, 0.03, 0.4), new THREE.MeshStandardMaterial({ color: 0x2b2f3a, metalness: 0.7 }));
  trayK.position.set(0, 0.68, 0.08);
  g.add(trayK);
  const keyboardK = new THREE.Mesh(geo.box(0.66, 0.02, 0.26),
    new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.5 }));
  keyboardK.position.set(0, 0.7, 0.08);
  g.add(keyboardK);

  // Monitor KVM sobre el carrito
  const monK = new THREE.Mesh(geo.box(0.66, 0.42, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.35 }));
  monK.position.set(0, 1.0, -0.02);
  monK.castShadow = true;
  g.add(monK);
  const scK = new THREE.Mesh(geo.plane(0.58, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x05140b, emissive: 0x1f7a4a, emissiveIntensity: 0.4 }));
  scK.position.set(0, 1.0, 0.006);
  g.add(scK);
  const neckK = new THREE.Mesh(geo.box(0.05, 0.25, 0.05), metalDeskMat);
  neckK.position.set(0, 0.83, -0.02);
  g.add(neckK);

  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
  return g;
}
createKVMCart('kvmCart', '🖥️ Consola KVM', -14.0, -6.4, Math.PI / 2);

// Extintor de pared (sala de servidores, cerca de la entrada)
function createExtinguisher(id, name, x, y, z, rotY) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;

  const red = new THREE.MeshStandardMaterial({ color: 0xd83f2f, roughness: 0.45, metalness: 0.2 });
  const body = new THREE.Mesh(geo.cylinder(0.09, 0.11, 0.42, 12), red);
  body.position.y = 0.35;
  body.castShadow = true;
  g.add(body);
  const shoulder = new THREE.Mesh(geo.cylinder(0.05, 0.09, 0.08, 12), red);
  shoulder.position.y = 0.6;
  g.add(shoulder);
  const handle = new THREE.Mesh(geo.box(0.06, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }));
  handle.position.set(0, 0.68, -0.02);
  g.add(handle);
  const hose = new THREE.Mesh(geo.torus(0.09, 0.015, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }));
  hose.position.set(0.04, 0.35, 0.05);
  g.add(hose);

  // Soporte de pared
  const bracket = new THREE.Mesh(geo.box(0.16, 0.5, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x8a929e, metalness: 0.6 }));
  bracket.position.set(0, 0.32, -0.04);
  g.add(bracket);
  const label = new THREE.Mesh(geo.plane(0.1, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xf5f2e8, roughness: 0.8 }));
  label.position.set(0, 0.35, 0.08);
  g.add(label);

  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
  return g;
}
// Montado en la pared norte de la sala de servidores (apoyado en tramo real)
createExtinguisher('fireExtinct', '🧯 Extintor', -10.0, 1.0, -10.8, 0);

// Señalética "Sala de Servidores — Acceso restringido" (pared norte)
function createServerSign(id, name, x, y, z, rotY) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  const sign = new THREE.Mesh(geo.box(0.7, 0.32, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x24313f, roughness: 0.4 }));
  g.add(sign);
  const plate = new THREE.Mesh(geo.plane(0.6, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x1a2530, emissive: 0x2a6bb5, emissiveIntensity: 0.5 }));
  plate.position.z = 0.03;
  g.add(plate);
  // Icono de escudo (ciberseguridad) + LED
  const iconBg = new THREE.Mesh(geo.circle(0.06, 16),
    new THREE.MeshStandardMaterial({ color: 0xd83f2f, roughness: 0.5 }));
  iconBg.position.set(-0.22, 0, 0.035);
  g.add(iconBg);
  const lockIcon = new THREE.Mesh(geo.box(0.05, 0.04, 0.01),
    new THREE.MeshStandardMaterial({ color: 0xf5f2e8 }));
  lockIcon.position.set(-0.22, 0.01, 0.045);
  g.add(lockIcon);
  const arcIcon = new THREE.Mesh(geo.torus(0.035, 0.006, 6, 14),
    new THREE.MeshStandardMaterial({ color: 0xf5f2e8 }));
  arcIcon.position.set(-0.22, 0.03, 0.045);
  g.add(arcIcon);
  const sigLed = new THREE.Mesh(geo.box(0.05, 0.02, 0.01),
    new THREE.MeshBasicMaterial({ color: 0x33ff66 }));
  sigLed.position.set(0.13, 0.10, 0.035);
  g.add(sigLed);
  serverLedMaterials.push(sigLed.material);

  officeGroup.add(g);
  registerSelectable(id, name, g, 'prop');
  return g;
}
createServerSign('serverSign', '🎛️ Cartel Sala de Servidores', -14.45, 2.2, -6.0, Math.PI / 2);

// ===== Sala de sistemas: puestos de trabajo, fotocopiadora, =====
// ===== estantes y pared de herramientas/reparaciones          =====

// Puesto de trabajo con PC sobre mesa (para reparaciones / testing)
function createServerBench(id, name, x, z, rotY) {
  const g = createEmptyTable(id, name, x, z, rotY);
  const pcTop = new THREE.Group();
  const chassis = new THREE.Mesh(geo.box(0.22, 0.45, 0.45), rackMat);
  chassis.position.set(-0.7, 0.24, 0);
  chassis.castShadow = true;
  pcTop.add(chassis);
  const ledPc = new THREE.Mesh(geo.box(0.02, 0.02, 0.01), new THREE.MeshBasicMaterial({ color: 0x66ff99 }));
  ledPc.position.set(-0.65, 0.40, 0.23);
  pcTop.add(ledPc);
  serverLedMaterials.push(ledPc.material);
  const monBase = new THREE.Mesh(geo.box(0.26, 0.02, 0.18), metalDeskMat);
  monBase.position.set(0.25, 0.01, -0.18);
  pcTop.add(monBase);
  const monNeck = new THREE.Mesh(geo.box(0.05, 0.18, 0.05), metalDeskMat);
  monNeck.position.set(0.25, 0.11, -0.20);
  pcTop.add(monNeck);
  const mon = new THREE.Mesh(geo.box(0.6, 0.36, 0.035), new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.35, metalness: 0.5 }));
  mon.position.set(0.25, 0.35, -0.16);
  mon.castShadow = true;
  pcTop.add(mon);
  const scr = new THREE.Mesh(geo.plane(0.54, 0.30), screenMat);
  scr.position.set(0.25, 0.35, -0.139);
  pcTop.add(scr);
  const kb = new THREE.Mesh(geo.box(0.42, 0.02, 0.14), new THREE.MeshStandardMaterial({ color: 0xd8dbe2, roughness: 0.5 }));
  kb.position.set(0.25, 0.02, 0.12);
  pcTop.add(kb);
  pcTop.position.y = 0.79;
  g.add(pcTop);
  return g;
}
createServerBench('benchSR1', '🛠️ Banco de Trabajo 1', -7.5, -6.8, Math.PI / 2);
createChair('benchChair1', 'Silla Banco 1', -6.5, -6.8, Math.PI / 2);
createServerBench('benchSR2', '🛠️ Banco de Trabajo 2', -7.5, -8.8, Math.PI / 2);
createChair('benchChair2', 'Silla Banco 2', -6.5, -8.8, Math.PI / 2);

// Fotocopiadora de la sala de sistemas (pared oeste)
createCopier('copierSR', '🖨️ Fotocopiadora Sistemas', -14.45, -5.3, Math.PI / 2);

// Estantes metálicos con repuestos (tabique este de la sala)
function createShelfUnit(id, name, x, z, rotY) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x8a929e, roughness: 0.4, metalness: 0.7 });
  [-0.78, 0.78].forEach(px => {
    const post = new THREE.Mesh(geo.box(0.06, 1.9, 0.4), shelfMat);
    post.position.set(px, 0.95, 0);
    post.castShadow = true;
    g.add(post);
  });
  [0.35, 0.85, 1.35, 1.85].forEach(by => {
    const board = new THREE.Mesh(geo.box(1.6, 0.04, 0.4), shelfMat);
    board.position.set(0, by, 0);
    g.add(board);
  });
  // Cajas de repuestos y bobinas de cable sobre las bandejas
  const boxColors = [0xb8563a, 0x3a6ab8, 0x3ab86a, 0xb8a23a];
  for (let s = 0; s < 3; s++) {
    for (let b = 0; b < 3; b++) {
      const box = new THREE.Mesh(
        geo.box(0.28, 0.22, 0.26),
        new THREE.MeshStandardMaterial({ color: boxColors[(s * 3 + b) % 4], roughness: 0.7 })
      );
      box.position.set(-0.5 + b * 0.5, 0.37 + s * 0.5, 0);
      box.castShadow = true;
      g.add(box);
    }
  }
  [-0.4, 0.4].forEach(cx => {
    const coil = new THREE.Mesh(geo.torus(0.12, 0.035, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0xd8a72f, roughness: 0.6 }));
    coil.position.set(cx, 1.44, 0);
    g.add(coil);
  });
  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
}
// Estantes de VUELTA a la sala de sistemas (donde estaban originalmente):
// apoyados en el tabique este de la sala (x=-4.575, cara interior), la misma
// pared donde está el AP WiFi Servidores (ap3). Frente mirando al oeste,
// hacia la sala.
createShelfUnit('shelfSR1', '📦 Estante Repuestos 1', -4.8, -7.9, -Math.PI / 2);
createShelfUnit('shelfSR2', '📦 Estante Repuestos 2', -4.8, -9.3, -Math.PI / 2);

// Rincón de recambio típico de sala de sistemas (pared norte, entre los
// racks y los estantes): CPUs apiladas, monitores viejos y cajas de cartón
// con cables. Todo apoyado en el piso, como equipamiento fuera de servicio.
const junkCorner = new THREE.Group();
const towerMat = new THREE.MeshStandardMaterial({ color: 0x24282f, roughness: 0.5, metalness: 0.4 });
const towerFaceMat = new THREE.MeshStandardMaterial({ color: 0x171a20, roughness: 0.6 });
const bezelMat = new THREE.MeshStandardMaterial({ color: 0x2e333b, roughness: 0.6 });
const screenOffMat = new THREE.MeshStandardMaterial({ color: 0x0a0e13, roughness: 0.18 });
const cartonMat = new THREE.MeshStandardMaterial({ color: 0xb08d5e, roughness: 1 });
const cartonInMat = new THREE.MeshStandardMaterial({ color: 0x9a784c, roughness: 1 });
const tapeMat = new THREE.MeshStandardMaterial({ color: 0xc9beA6, roughness: 0.8 });
const cableMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.7 });

// CPU acostada (torre en horizontal): cuerpo + frente con rejillas
function junkCpu(x, y, z, rotY) {
  const t = new THREE.Group();
  t.position.set(x, y, z);
  t.rotation.y = rotY;
  const body = new THREE.Mesh(geo.box(0.48, 0.19, 0.45), towerMat);
  body.position.y = 0.095;
  body.castShadow = true;
  t.add(body);
  const face = new THREE.Mesh(geo.box(0.44, 0.15, 0.02), towerFaceMat);
  face.position.set(0, 0.095, -0.225);
  t.add(face);
  for (let i = -1; i <= 1; i++) {
    const vent = new THREE.Mesh(geo.box(0.3, 0.012, 0.005), towerFaceMat);
    vent.position.set(0, 0.05 + i * 0.04, -0.237);
    t.add(vent);
  }
  junkCorner.add(t);
}
// Torre de 3 CPUs apiladas (acostadas)
junkCpu(-9.35, 0, -10.32, 0);
junkCpu(-9.33, 0.19, -10.34, 0.06);
junkCpu(-9.38, 0.38, -10.30, -0.05);

// Monitor viejo: base + cuello + marco con pantalla apagada
function junkMonitor(x, y, z, rotY, tilt) {
  const m = new THREE.Group();
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  m.rotation.x = tilt;
  const shell = new THREE.Mesh(geo.box(0.44, 0.36, 0.05), bezelMat);
  shell.castShadow = true;
  m.add(shell);
  const scr = new THREE.Mesh(geo.box(0.37, 0.28, 0.015), screenOffMat);
  scr.position.set(0, 0.01, -0.031);
  m.add(scr);
  junkCorner.add(m);
}
// Par apilados en el piso mirando al techo + uno parado reclinado a la pared
junkMonitor(-8.25, 0.19, -10.38, 0.1, Math.PI / 2);
junkMonitor(-8.27, 0.395, -10.36, -0.08, Math.PI / 2 + 0.04);
const monStand = new THREE.Group();
monStand.position.set(-7.55, 0, -10.42);
monStand.rotation.y = Math.PI; // pantalla hacia la sala
const mBase = new THREE.Mesh(geo.box(0.24, 0.02, 0.17), bezelMat);
mBase.position.set(0, 0.01, 0.02);
monStand.add(mBase);
const mNeck = new THREE.Mesh(geo.box(0.06, 0.14, 0.05), bezelMat);
mNeck.position.set(0, 0.08, 0);
monStand.add(mNeck);
const mShell = new THREE.Mesh(geo.box(0.44, 0.36, 0.05), bezelMat);
mShell.position.set(0, 0.33, -0.02);
mShell.rotation.x = -0.07;
mShell.castShadow = true;
monStand.add(mShell);
const mScr = new THREE.Mesh(geo.box(0.37, 0.28, 0.015), screenOffMat);
mScr.position.set(0, 0.34, -0.052);
mScr.rotation.x = -0.07;
monStand.add(mScr);
junkCorner.add(monStand);

// Cajas de cartón: cerrada con cinta, abierta con bobinas de cable adentro
function cardboardBox(x, z, rotY, openTop) {
  const b = new THREE.Group();
  b.position.set(x, 0, z);
  b.rotation.y = rotY;
  const wall = new THREE.Mesh(geo.box(0.56, 0.4, 0.46), openTop ? cartonInMat : cartonMat);
  wall.position.y = 0.2;
  wall.castShadow = true;
  b.add(wall);
  if (openTop) {
    [[-0.26, 0, 0.5], [0.26, 0, 0.5]].forEach(([fx, , rx]) => {
      const flap = new THREE.Mesh(geo.box(0.28, 0.015, 0.46), cartonMat);
      flap.position.set(fx * 1.62, 0.43, 0);
      flap.rotation.z = fx < 0 ? 0.9 : -0.9;
      b.add(flap);
    });
    for (let i = 0; i < 2; i++) {
      const coil = new THREE.Mesh(geo.torus(0.11, 0.028, 8, 16), cableMat);
      coil.rotation.x = Math.PI / 2;
      coil.position.set((i - 0.5) * 0.22, 0.36, i * 0.08 - 0.04);
      b.add(coil);
    }
    const loose = new THREE.Mesh(geo.torus(0.13, 0.025, 8, 16), cableMat);
    loose.rotation.x = Math.PI / 2;
    loose.position.set(x + 0.52, 0.025, z + 0.18);
    junkCorner.add(loose);
  } else {
    const tape = new THREE.Mesh(geo.box(0.57, 0.012, 0.09), tapeMat);
    tape.position.y = 0.405;
    b.add(tape);
  }
  junkCorner.add(b);
}
cardboardBox(-6.75, -10.35, 0.08, false);          // cerrada abajo
const boxTop = new THREE.Group();                  // segunda cerrada encima, girada
boxTop.position.set(-6.72, 0.4, -10.33);
boxTop.rotation.y = 0.31;
const btBody = new THREE.Mesh(geo.box(0.54, 0.38, 0.44), cartonMat);
btBody.position.y = 0.19;
btBody.castShadow = true;
boxTop.add(btBody);
const btTape = new THREE.Mesh(geo.box(0.55, 0.012, 0.09), tapeMat);
btTape.position.y = 0.385;
boxTop.add(btTape);
junkCorner.add(boxTop);
cardboardBox(-6.05, -9.85, -0.2, true);            // abierta con cables

officeGroup.add(junkCorner);
registerSelectable('itJunkCorner', '🗅️ Rincón de Recambio IT', junkCorner, 'furniture');

// Escalera de apoyo (tipo tijera) — sala de sistemas, apoyada contra el
// tabique sur al este de la puerta. Con ella se alcanza el mini rack de
// la sala de juntas, montado bien arriba. (El grupo vive a nivel de módulo:
// `export const stepLadder` arriba, para la animación de escalada.)
stepLadder.position.set(STEP_LADDER_ORIGIN[0], STEP_LADDER_ORIGIN[1], STEP_LADDER_ORIGIN[2]);
const ladderMat = new THREE.MeshStandardMaterial({ color: 0xb8bfc9, roughness: 0.35, metalness: 0.7 });
const treadMat = new THREE.MeshStandardMaterial({ color: 0x8d95a0, roughness: 0.5, metalness: 0.6 });
const LL = 1.83, leanA = 0.16;
// Dos planos en "A": patas inclinadas que se juntan en la bisagra superior
[1, -1].forEach(sx => {
  [[leanA, 0.01], [-leanA, -0.01]].forEach(([a, zo]) => {
    const leg = new THREE.Mesh(geo.box(0.05, LL, 0.06), ladderMat);
    leg.position.set(sx * 0.21, 1.79 - (LL / 2) * Math.cos(a), zo - (LL / 2) * Math.sin(a));
    leg.rotation.x = a;
    leg.castShadow = true;
    stepLadder.add(leg);
  });
});
// Bisagra superior
const ladderCap = new THREE.Mesh(geo.box(0.46, 0.06, 0.24), ladderMat);
ladderCap.position.set(0, 1.81, 0);
ladderCap.castShadow = true;
stepLadder.add(ladderCap);
// Peldaños del plano frontal (el que se usa para subir)
[0.35, 0.70, 1.05, 1.38].forEach(sy => {
  const step = new THREE.Mesh(geo.box(0.42, 0.03, 0.09), treadMat);
  step.position.set(0, sy, 0.01 + 0.163 * (1.79 - sy));
  step.castShadow = true;
  stepLadder.add(step);
});
// Cruceta de refuerzo del plano trasero
const ladderBrace = new THREE.Mesh(geo.box(0.42, 0.03, 0.06), treadMat);
ladderBrace.position.set(0, 1.15, -0.115);
stepLadder.add(ladderBrace);
officeGroup.add(stepLadder);
registerSelectable('stepLadder', '🪜 Escalera de Apoyo', stepLadder, 'furniture');

// Pared de herramientas (tablón perforado con herramientas colgadas,
// cables y cajones de repuestos) — pared oeste de la sala
const toolBoard = new THREE.Group();
toolBoard.position.set(-14.84, 1.6, -6.8);
toolBoard.rotation.y = Math.PI / 2;
const pegMat = new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 0.7 });
const pegboard = new THREE.Mesh(geo.box(2.8, 1.5, 0.06), pegMat);
toolBoard.add(pegboard);
// Herramientas: llaves (forma simple), destornilladores y martillo
const toolSteel = new THREE.MeshStandardMaterial({ color: 0xb9c0c9, roughness: 0.25, metalness: 0.85 });
const toolRed = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 });
[[-1.0, 0.35], [-0.6, 0.35], [-0.2, 0.35]].forEach(([tx, ty], i) => {
  const handle = new THREE.Mesh(geo.cylinder(0.025, 0.025, 0.34, 8), i === 2 ? toolRed : new THREE.MeshStandardMaterial({ color: 0x8a5a3b, roughness: 0.6 }));
  handle.position.set(tx, ty, 0.05);
  toolBoard.add(handle);
  const head = new THREE.Mesh(geo.box(i === 2 ? 0.22 : 0.09, 0.07, 0.04), toolSteel);
  head.position.set(tx, ty + 0.21, 0.05);
  toolBoard.add(head);
});
// Bobinas de cable colgadas (colores literales: cableMats aún no existe aquí)
[-1.15, -0.75, 0.9, 1.25].forEach((cx, i) => {
  const coil = new THREE.Mesh(geo.torus(0.11, 0.03, 8, 20),
    new THREE.MeshStandardMaterial({ color: [0x2f6fd8, 0xd8a72f, 0xd83f3f][i % 3], roughness: 0.6 }));
  coil.position.set(cx, -0.35, 0.06);
  toolBoard.add(coil);
});
// Cajones organizadores de repuestos
for (let bx = 0; bx < 4; bx++) {
  const bin = new THREE.Mesh(geo.box(0.3, 0.24, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x274e6d, roughness: 0.6 }));
  bin.position.set(-0.35 + bx * 0.32, -0.42, 0.08);
  toolBoard.add(bin);
}
// Mesa pequeña bajo el tablón con caja de herramientas
const toolTable = new THREE.Mesh(geo.box(2.4, 0.06, 0.7), woodDeskMat);
toolTable.position.set(0, 0.74, 0.35);
toolTable.castShadow = true;
toolBoard.add(toolTable);
[[-0.9], [0.9]].forEach(([lx]) => {
  const legT = new THREE.Mesh(geo.box(0.06, 0.74, 0.6), metalDeskMat);
  legT.position.set(lx, 0.37, 0.35);
  toolBoard.add(legT);
});
const toolbox = new THREE.Mesh(geo.box(0.5, 0.22, 0.28),
  new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.4, metalness: 0.3 }));
toolbox.position.set(-0.4, 0.88, 0.35);
toolbox.castShadow = true;
toolBoard.add(toolbox);
const trayParts = new THREE.Mesh(geo.box(0.6, 0.08, 0.3),
  new THREE.MeshStandardMaterial({ color: 0x33383f, roughness: 0.6 }));
trayParts.position.set(0.5, 0.81, 0.35);
toolBoard.add(trayParts);
officeGroup.add(toolBoard);
registerSelectable('toolWall', '🔧 Pared de Herramientas', toolBoard, 'furniture');

// 5. Multipurpose Empty Work Table (for IT lab)

  // ---------- Catálogo (P7): piezas instanciables desde el panel "➕ Agregar" ----------
  registerCatalogEntry({ id: 'serverRack', label: '🗅️ Rack 19"', cat: '💻 Equipamiento IT', spawn: (id, name, x, z, rotY) => createServerRack(id, name, x, z) });
  registerCatalogEntry({ id: 'firewall', label: '🛡️ Firewall', cat: '💻 Equipamiento IT', spawn: (id, name, x, z, rotY) => createFirewall(id, name, x, z, rotY) });
  registerCatalogEntry({ id: 'kvmCart', label: '🛒 Carro KVM', cat: '💻 Equipamiento IT', spawn: (id, name, x, z, rotY) => createKVMCart(id, name, x, z, rotY) });
  registerCatalogEntry({ id: 'shelfUnit', label: '📦 Estante de Repuestos', cat: '💻 Equipamiento IT', spawn: (id, name, x, z, rotY) => createShelfUnit(id, name, x, z, rotY) });
  registerCatalogEntry({ id: 'serverBench', label: '🛠️ Banco de Trabajo', cat: '💻 Equipamiento IT', spawn: (id, name, x, z, rotY) => createServerBench(id, name, x, z, rotY) });
}

