// js/office/lounge.js — extraído de office.js (split P1, ver mejoras_glm.md)

import * as THREE from 'three';
import * as geo from './geoCache.js';
import { officeGroup, serverLedMaterials } from './group.js';
import { woodDeskMat, darkWoodMat, metalDeskMat, screenMat, goldMat, steelMat, glassMat } from './materials.js';
import { createChair, createCopier, createEmptyTable } from './furniture.js';
import { createWallAP } from './network.js';
import { createWindow } from './walls.js';
import { registerSelectable } from '../ui/selection.js';
import { registerCatalogEntry } from '../catalog.js';

const counterMat = new THREE.MeshStandardMaterial({ color: 0xcfd4dc, roughness: 0.35, metalness: 0.2 });
const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x8a5a3b, roughness: 0.6 });
const kitchenSteelMat = new THREE.MeshStandardMaterial({ color: 0xb9c0c9, roughness: 0.25, metalness: 0.85 });
const leatherMat = new THREE.MeshStandardMaterial({ color: 0x4a2c1a, roughness: 0.35, metalness: 0.05 });
const leatherLightMat = new THREE.MeshStandardMaterial({ color: 0x5d3a24, roughness: 0.4 });

export function createKitchenCounter(id, name, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const counterTop = new THREE.Mesh(geo.box(0.62, 0.05, 3.2), counterMat);
  counterTop.position.set(0, 0.92, 0);
  counterTop.castShadow = true;
  counterTop.receiveShadow = true;
  g.add(counterTop);
  const counterBase = new THREE.Mesh(geo.box(0.58, 0.86, 3.16), cabinetMat);
  counterBase.position.set(0, 0.45, 0);
  counterBase.castShadow = true;
  g.add(counterBase);
  const backSplash = new THREE.Mesh(geo.box(0.04, 0.55, 3.2), counterMat);
  backSplash.position.set(-0.31, 1.22, 0);
  g.add(backSplash);
  const upperCabinet = new THREE.Mesh(geo.box(0.38, 0.7, 3.2), cabinetMat);
  upperCabinet.position.set(-0.12, 2.1, 0);
  upperCabinet.castShadow = true;
  g.add(upperCabinet);
  for (let d = 0; d < 3; d++) {
    const uDoor = new THREE.Mesh(geo.box(0.02, 0.6, 0.98), new THREE.MeshStandardMaterial({ color: 0x9c6b49, roughness: 0.55 }));
    uDoor.position.set(0.08, 2.1, -1.05 + d * 1.05);
    g.add(uDoor);
  }
  const sink = new THREE.Mesh(geo.box(0.4, 0.03, 0.5), kitchenSteelMat);
  sink.position.set(0.05, 0.94, -0.9);
  g.add(sink);
  const faucet = new THREE.Mesh(geo.cylinder(0.02, 0.02, 0.3, 8), kitchenSteelMat);
  faucet.position.set(-0.18, 1.1, -0.9);
  g.add(faucet);
  const faucetArc = new THREE.Mesh(geo.cylinder(0.015, 0.015, 0.22, 8), kitchenSteelMat);
  faucetArc.rotation.z = Math.PI / 2;
  faucetArc.position.set(-0.08, 1.25, -0.9);
  g.add(faucetArc);
  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
  return g;
}

export function createFridge(id, name, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const fBody = new THREE.Mesh(geo.box(0.75, 1.85, 0.72), kitchenSteelMat);
  fBody.position.y = 0.93;
  fBody.castShadow = true;
  g.add(fBody);
  const fSplit = new THREE.Mesh(geo.box(0.02, 1.7, 0.73), new THREE.MeshStandardMaterial({ color: 0x99a1ab, roughness: 0.3, metalness: 0.85 }));
  fSplit.position.set(0.38, 0.93, 0);
  g.add(fSplit);
  [-0.18, 0.18].forEach(hz => {
    const fh = new THREE.Mesh(geo.box(0.03, 0.5, 0.04), new THREE.MeshStandardMaterial({ color: 0x6d757f, roughness: 0.3, metalness: 0.8 }));
    fh.position.set(0.39, 1.15, hz);
    g.add(fh);
  });
  const fLed = new THREE.Mesh(geo.box(0.12, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0x66ff99 }));
  fLed.position.set(0.2, 1.78, 0.37);
  g.add(fLed);
  serverLedMaterials.push(fLed.material);
  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
  return g;
}

export function createWaterDispenser(id, name, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const coolerBody = new THREE.Mesh(geo.box(0.45, 0.9, 0.45), new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.3 }));
  coolerBody.position.y = 0.45;
  g.add(coolerBody);
  const bottle = new THREE.Mesh(geo.cylinder(0.18, 0.18, 0.45, 12), new THREE.MeshStandardMaterial({ color: 0x4aa3df, transparent: true, opacity: 0.65 }));
  bottle.position.y = 1.12;
  g.add(bottle);
  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
  return g;
}

export function createVendingMachine(id, name, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const vendBodyMat = new THREE.MeshStandardMaterial({ color: 0xa3242b, roughness: 0.35, metalness: 0.25 });
  const vendBody = new THREE.Mesh(geo.box(0.72, 1.9, 0.95), vendBodyMat);
  vendBody.position.y = 0.95;
  vendBody.castShadow = true;
  g.add(vendBody);
  const vendKick = new THREE.Mesh(
    geo.box(0.74, 0.1, 0.97),
    new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.5, metalness: 0.4 }));
  vendKick.position.y = 0.05;
  g.add(vendKick);
  const vendInner = new THREE.Mesh(
    geo.box(0.02, 1.04, 0.58),
    new THREE.MeshStandardMaterial({ color: 0xf4f2ea, emissive: 0xfff8e0, emissiveIntensity: 0.45, roughness: 0.9 }));
  vendInner.position.set(0.33, 1.14, -0.05);
  g.add(vendInner);
  const snackColors = [0x5a3317, 0xd88a1e, 0xc9b23a, 0x2e7d43, 0x27538f, 0x8e3b8e];
  [0.86, 1.16, 1.46].forEach((sy, si) => {
    const shelf = new THREE.Mesh(geo.box(0.14, 0.015, 0.58),
      new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.4, metalness: 0.5 }));
    shelf.position.set(0.29, sy, -0.05);
    g.add(shelf);
    for (let n = 0; n < 5; n++) {
      const snack = new THREE.Mesh(
        geo.box(0.09, 0.13, 0.095),
        new THREE.MeshStandardMaterial({ color: snackColors[(si * 5 + n) % snackColors.length], roughness: 0.55 }));
      snack.position.set(0.30, sy + 0.075, -0.05 - 0.22 + n * 0.11);
      g.add(snack);
    }
  });
  const vendGlass = new THREE.Mesh(
    geo.plane(0.60, 1.08),
    new THREE.MeshPhysicalMaterial({
      color: 0xbfd8e2, transparent: true, opacity: 0.18,
      roughness: 0.05, metalness: 0.1, envMapIntensity: 1.1,
      depthWrite: false, side: THREE.DoubleSide
    }));
  vendGlass.rotation.y = Math.PI / 2;
  vendGlass.position.set(0.365, 1.14, -0.05);
  g.add(vendGlass);
  const vendPad = new THREE.Mesh(
    geo.box(0.03, 1.04, 0.20),
    new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.4, metalness: 0.5 }));
  vendPad.position.set(0.365, 1.14, 0.33);
  g.add(vendPad);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 2; c++) {
      const key = new THREE.Mesh(
        geo.box(0.012, 0.055, 0.06),
        new THREE.MeshStandardMaterial({ color: 0xd8dce2, roughness: 0.5 }));
      key.position.set(0.383, 1.32 - r * 0.13, 0.29 + c * 0.085);
      g.add(key);
    }
  }
  const coinSlot = new THREE.Mesh(
    geo.box(0.012, 0.09, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.4 }));
  coinSlot.position.set(0.383, 0.78, 0.33);
  g.add(coinSlot);
  const vendFlap = new THREE.Mesh(
    geo.box(0.02, 0.26, 0.52),
    new THREE.MeshStandardMaterial({ color: 0x1d2026, roughness: 0.55 }));
  vendFlap.position.set(0.365, 0.42, -0.05);
  g.add(vendFlap);
  const vendStrip = new THREE.Mesh(
    geo.box(0.03, 0.07, 0.82),
    new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffe9b8, emissiveIntensity: 1.1, roughness: 0.4 }));
  vendStrip.position.set(0.355, 1.80, -0.02);
  g.add(vendStrip);
  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
  return g;
}

export function createLunchTable(id, name, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const top = new THREE.Mesh(geo.box(5.2, 0.08, 1.9), darkWoodMat);
  top.position.y = 0.74;
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);
  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
  return g;
}

export function createConferenceTable(id, name, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const top = new THREE.Mesh(geo.box(5.2, 0.08, 1.9), darkWoodMat);
  top.position.y = 0.74;
  top.castShadow = true;
  g.add(top);
  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
  return g;
}

export function createExecDesk(id, name, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const bdTop = new THREE.Mesh(geo.box(2.8, 0.09, 1.3), darkWoodMat);
  bdTop.position.y = 0.78;
  bdTop.castShadow = true; bdTop.receiveShadow = true;
  g.add(bdTop);
  const bdPad = new THREE.Mesh(geo.box(1.4, 0.02, 0.7), leatherMat);
  bdPad.position.set(0, 0.83, 0.15);
  g.add(bdPad);
  const bdFront = new THREE.Mesh(geo.box(2.7, 0.72, 0.08), darkWoodMat);
  bdFront.position.set(0, 0.40, -0.60);
  bdFront.castShadow = true;
  g.add(bdFront);
  [-0.9, 0, 0.9].forEach(px => {
    const mold = new THREE.Mesh(geo.box(0.5, 0.6, 0.02), leatherLightMat);
    mold.position.set(px, 0.40, -0.555);
    g.add(mold);
  });
  [-1.32, 1.32].forEach(sx => {
    const side = new THREE.Mesh(geo.box(0.12, 0.74, 1.2), darkWoodMat);
    side.position.set(sx, 0.37, 0);
    side.castShadow = true;
    g.add(side);
  });
  for (let d = 0; d < 3; d++) {
    const dr = new THREE.Mesh(geo.box(0.5, 0.16, 0.03), leatherLightMat);
    dr.position.set(1.0, 0.18 + d * 0.22, 0.60);
    g.add(dr);
    const hd = new THREE.Mesh(geo.box(0.3, 0.03, 0.02), goldMat);
    hd.position.set(1.0, 0.18 + d * 0.22, 0.62);
    g.add(hd);
  }
  [-0.45, 0.45].forEach(mx => {
    const bez = new THREE.Mesh(geo.box(0.78, 0.48, 0.04), new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.35 }));
    bez.position.set(mx, 1.28, -0.30);
    bez.castShadow = true;
    g.add(bez);
    const disp = new THREE.Mesh(geo.plane(0.70, 0.40), screenMat);
    disp.position.set(mx, 1.28, -0.275);
    g.add(disp);
    const neckM = new THREE.Mesh(geo.box(0.06, 0.26, 0.06), metalDeskMat);
    neckM.position.set(mx, 0.96, -0.32);
    g.add(neckM);
  });
  const lampBase = new THREE.Mesh(geo.cylinder(0.1, 0.13, 0.03, 16), goldMat);
  lampBase.position.set(1.05, 0.84, -0.35);
  lampBase.castShadow = true;
  g.add(lampBase);
  const lampStem = new THREE.Mesh(geo.cylinder(0.02, 0.02, 0.3, 10), goldMat);
  lampStem.position.set(1.05, 1.0, -0.35);
  g.add(lampStem);
  const lampArmH = new THREE.Mesh(geo.cylinder(0.012, 0.012, 0.38, 10), goldMat);
  lampArmH.rotation.z = Math.PI / 2;
  lampArmH.position.set(1.05, 1.14, -0.52);
  g.add(lampArmH);
  const lampArmV = new THREE.Mesh(geo.cylinder(0.012, 0.012, 0.2, 10), goldMat);
  lampArmV.position.set(1.05, 1.24, -0.55);
  g.add(lampArmV);
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0x2e6b46, roughness: 0.6, side: THREE.DoubleSide, emissive: 0xffe08a, emissiveIntensity: 0.6 });
  const lampShade = new THREE.Mesh(geo.cylinder(0.09, 0.05, 0.16, 14, 1, true), shadeMat);
  lampShade.position.set(1.05, 1.33, -0.58);
  g.add(lampShade);
  const bulb = new THREE.Mesh(geo.sphere(0.035, 10, 10), new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffdd88, emissiveIntensity: 1.2 }));
  bulb.position.set(1.05, 1.26, -0.58);
  g.add(bulb);
  const phone = new THREE.Mesh(geo.box(0.24, 0.06, 0.18), new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.4 }));
  phone.position.set(-1.0, 0.84, 0.3);
  g.add(phone);
  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
  return g;
}

export function createExecChair(id, name, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const ecSeat = new THREE.Mesh(geo.box(0.72, 0.14, 0.68), leatherMat);
  ecSeat.position.y = 0.54; ecSeat.castShadow = true;
  g.add(ecSeat);
  const ecCush = new THREE.Mesh(geo.box(0.64, 0.06, 0.6), leatherLightMat);
  ecCush.position.y = 0.62;
  g.add(ecCush);
  const ecBack = new THREE.Mesh(geo.box(0.68, 1.1, 0.12), leatherMat);
  ecBack.position.set(0, 1.15, 0.34); ecBack.castShadow = true;
  g.add(ecBack);
  for (let c = -1; c <= 1; c++) {
    for (let r = 0; r < 4; r++) {
      const btn = new THREE.Mesh(geo.sphere(0.03, 8, 8), goldMat);
      btn.position.set(c * 0.22, 0.85 + r * 0.22, 0.405);
      g.add(btn);
    }
  }
  const head = new THREE.Mesh(geo.box(0.68, 0.16, 0.1), leatherLightMat);
  head.position.set(0, 1.72, 0.34);
  g.add(head);
  [-0.42, 0.42].forEach(sx => {
    const armLift = new THREE.Mesh(geo.box(0.08, 0.24, 0.12), goldMat);
    armLift.position.set(sx, 0.72, 0.1);
    g.add(armLift);
    const armPad = new THREE.Mesh(geo.box(0.14, 0.05, 0.55), leatherLightMat);
    armPad.position.set(sx, 0.86, 0.08);
    g.add(armPad);
  });
  const ecStem = new THREE.Mesh(geo.cylinder(0.055, 0.06, 0.42, 10), goldMat);
  ecStem.position.y = 0.3;
  g.add(ecStem);
  const ecHub = new THREE.Mesh(geo.cylinder(0.1, 0.12, 0.05, 10), goldMat);
  ecHub.position.y = 0.09;
  g.add(ecHub);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const px = Math.cos(a) * 0.3, pz = Math.sin(a) * 0.3;
    const leg = new THREE.Mesh(geo.box(0.04, 0.03, 0.34), goldMat);
    leg.position.set(px * 0.5, 0.035, pz * 0.5);
    leg.rotation.y = -a;
    g.add(leg);
    const wheel = new THREE.Mesh(geo.torus(0.04, 0.015, 6, 12), new THREE.MeshStandardMaterial({ color: 0x0e1013, roughness: 0.8 }));
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(px, 0.035, pz);
    g.add(wheel);
  }
  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
  return g;
}

export function createGuestChair(id, name, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const gcSeat = new THREE.Mesh(geo.box(0.5, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 0.6 }));
  gcSeat.position.y = 0.5; gcSeat.castShadow = true;
  g.add(gcSeat);
  const gcBack = new THREE.Mesh(geo.box(0.48, 0.6, 0.07), new THREE.MeshStandardMaterial({ color: 0x33383f, roughness: 0.6 }));
  gcBack.position.set(0, 0.82, 0.26);
  gcBack.castShadow = true;
  g.add(gcBack);
  const gcStem = new THREE.Mesh(geo.cylinder(0.04, 0.04, 0.46, 8), metalDeskMat);
  gcStem.position.y = 0.23;
  g.add(gcStem);
  const gcBase = new THREE.Mesh(geo.cylinder(0.26, 0.26, 0.04, 5), metalDeskMat);
  gcBase.position.y = 0.04;
  g.add(gcBase);
  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
  return g;
}

export function createChesterfield(id, name, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const base = new THREE.Mesh(geo.box(2.0, 0.38, 0.9), leatherMat);
  base.position.y = 0.24; base.castShadow = true;
  g.add(base);
  const back = new THREE.Mesh(geo.box(2.0, 0.55, 0.22), leatherMat);
  back.position.set(0, 0.62, 0.36); back.castShadow = true;
  g.add(back);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 6; c++) {
      const btn = new THREE.Mesh(geo.sphere(0.025, 6, 6), goldMat);
      btn.position.set(-0.75 + c * 0.3, 0.48 + r * 0.22, 0.245);
      g.add(btn);
    }
  }
  [-1.0, 1.0].forEach(ax => {
    const roll = new THREE.Mesh(geo.cylinder(0.14, 0.14, 0.95, 10), leatherMat);
    roll.rotation.x = Math.PI / 2;
    roll.position.set(ax, 0.56, 0.05);
    roll.castShadow = true;
    g.add(roll);
  });
  const cush = new THREE.Mesh(geo.box(1.7, 0.12, 0.68), leatherLightMat);
  cush.position.set(0, 0.47, -0.02);
  g.add(cush);
  [[-0.85, -0.3], [0.85, -0.3], [-0.85, 0.3], [0.85, 0.3]].forEach(([px, pz]) => {
    const leg = new THREE.Mesh(geo.cylinder(0.04, 0.03, 0.12, 8), darkWoodMat);
    leg.position.set(px, 0.06, pz);
    g.add(leg);
  });
  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
  return g;
}

export function createBossTable(id, name, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const top = new THREE.Mesh(geo.cylinder(0.6, 0.6, 0.45, 20), darkWoodMat);
  top.position.y = 0.225;
  top.castShadow = true;
  g.add(top);
  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
  return g;
}

export function createWallClock(id, name, x, z, rotY = 0, y = 2.4) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  const clockBody = new THREE.Mesh(geo.cylinder(0.22, 0.22, 0.05, 18), goldMat);
  clockBody.rotation.x = Math.PI / 2;
  g.add(clockBody);
  const clockFace = new THREE.Mesh(geo.circle(0.19, 18), new THREE.MeshStandardMaterial({ color: 0xf5f2e8, roughness: 0.6 }));
  clockFace.position.z = 0.035;
  g.add(clockFace);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const mark = new THREE.Mesh(geo.box(0.02, 0.06, 0.005), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
    mark.position.set(Math.sin(a) * 0.15, Math.cos(a) * 0.15, 0.045);
    mark.rotation.z = -a;
    g.add(mark);
  }
  const hHand = new THREE.Mesh(geo.box(0.03, 0.1, 0.005), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
  hHand.position.set(0, 0.05, 0.05);
  g.add(hHand);
  const mHand = new THREE.Mesh(geo.box(0.02, 0.14, 0.005), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
  mHand.position.set(0, 0.09, 0.052);
  g.add(mHand);
  const clockHub = new THREE.Mesh(geo.sphere(0.02, 6, 6), new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.8 }));
  clockHub.position.z = 0.052;
  g.add(clockHub);
  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
  return g;
}

export function createPainting(id, name, x, z, rotY = 0, y = 2.1, w = 1.1, h = 0.8) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  const frame = new THREE.Mesh(geo.box(w + 0.12, h + 0.12, 0.05), goldMat);
  g.add(frame);
  const canvasP = new THREE.Mesh(geo.plane(w, h),
    new THREE.MeshStandardMaterial({ color: [0x274e6d, 0x6d4a27, 0x3d5a3a][id.length % 3], roughness: 0.9 }));
  canvasP.position.z = 0.03;
  g.add(canvasP);
  const blob = new THREE.Mesh(geo.circle(Math.min(w, h) * 0.22, 16),
    new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.8 }));
  blob.position.set(w * 0.15, -h * 0.1, 0.035);
  g.add(blob);
  officeGroup.add(g);
  registerSelectable(id, name, g, 'prop');
  return g;
}

export function createBar(id, name, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const barBody = new THREE.Mesh(geo.box(2.6, 1.0, 0.6), darkWoodMat);
  barBody.position.y = 0.5; barBody.castShadow = true;
  g.add(barBody);
  const barTop = new THREE.Mesh(geo.box(2.8, 0.06, 0.75), new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.25 }));
  barTop.position.y = 1.03;
  g.add(barTop);
  const barRail = new THREE.Mesh(geo.cylinder(0.025, 0.025, 2.6, 8), goldMat);
  barRail.rotation.z = Math.PI / 2;
  barRail.position.set(0, 0.92, 0.42);
  g.add(barRail);
  const bottleColors = [0x7a1f1f, 0x1f4a7a, 0x2a6b33, 0xb8860b, 0x4a235a];
  for (let b = 0; b < 5; b++) {
    const bot = new THREE.Mesh(geo.cylinder(0.05, 0.06, 0.3, 10),
      new THREE.MeshPhysicalMaterial({ color: bottleColors[b], transparent: true, opacity: 0.85, roughness: 0.1 }));
    bot.position.set(-1.0 + b * 0.28, 1.21, -0.1);
    g.add(bot);
    const neckB = new THREE.Mesh(geo.cylinder(0.02, 0.035, 0.1, 8), bot.material);
    neckB.position.set(-1.0 + b * 0.28, 1.41, -0.1);
    g.add(neckB);
  }
  for (let gl = 0; gl < 3; gl++) {
    const glassC = new THREE.Mesh(geo.cylinder(0.045, 0.035, 0.12, 10),
      new THREE.MeshPhysicalMaterial({ color: 0xcfe6ee, transparent: true, opacity: 0.5, roughness: 0.05 }));
    glassC.position.set(0.5 + gl * 0.18, 1.12, 0.12);
    g.add(glassC);
  }
  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
  return g;
}

export function buildLounge() {
createConferenceTable('confTable', 'Mesa de Juntas', 11.5, -7.0, 0);

createChair('confChair1', 'Silla Junta 1', 10.0, -6.0, 0);
createChair('confChair2', 'Silla Junta 2', 11.5, -6.0, 0);
createChair('confChair3', 'Silla Junta 3', 13.0, -6.0, 0);
createChair('confChair4', 'Silla Junta 4', 10.0, -8.0, Math.PI);
createChair('confChair5', 'Silla Junta 5', 11.5, -8.0, Math.PI);
createChair('confChair6', 'Silla Junta 6', 13.0, -8.0, Math.PI);

const tvScreen = new THREE.Mesh(
  geo.box(3.2, 1.8, 0.08),
  new THREE.MeshStandardMaterial({ color: 0x111622, emissive: 0x2e64b6, emissiveIntensity: 0.5 })
);
tvScreen.position.set(14.82, 2.0, -7.0);
tvScreen.rotation.y = -Math.PI / 2;
officeGroup.add(tvScreen);
const tvFrame = new THREE.Mesh(
  geo.box(3.36, 1.96, 0.05),
  new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.3 })
);
tvFrame.position.set(14.86, 2.0, -7.0);
tvFrame.rotation.y = -Math.PI / 2;
officeGroup.add(tvFrame);

const bossGroup = new THREE.Group();
officeGroup.add(bossGroup);

const bossRug = new THREE.Mesh(
  geo.plane(6.5, 5.0),
  new THREE.MeshStandardMaterial({ color: 0x5b2333, roughness: 0.95 })
);
bossRug.rotation.x = -Math.PI / 2;
bossRug.position.set(-9.5, 0.022, 8.0);
bossRug.receiveShadow = true;
bossGroup.add(bossRug);
const rugBorder = new THREE.Mesh(
  geo.plane(6.9, 5.4),
  new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.8 })
);
rugBorder.rotation.x = -Math.PI / 2;
rugBorder.position.set(-9.5, 0.006, 8.0);
rugBorder.receiveShadow = true;
bossGroup.add(rugBorder);

createExecDesk('execDesk', 'Escritorio Gerencia', -9.0, 8.4, 0);
createExecChair('execChair', 'Silla Gerencia', -9.0, 9.6, 0);
createGuestChair('guestChair', 'Silla de Invitado', -9.0, 7.6, Math.PI);
createChesterfield('bossSofa1', '🛋️ Chesterfield 1', -14.5, 6.6, -Math.PI / 2);
createChesterfield('bossSofa2', '🛋️ Chesterfield 2', -11.8, 10.5, 0);
createBossTable('bossTable', 'Mesa Ratona Gerencia', -13.0, 8.6, 0);

const bossPlant = new THREE.Group();
bossPlant.position.set(-14.0, 0, 10.4);
const bpPot = new THREE.Mesh(geo.cylinder(0.24, 0.18, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0x8a5a3b, roughness: 0.8 }));
bpPot.position.y = 0.2; bpPot.castShadow = true;
bossPlant.add(bpPot);
const bpStem = new THREE.Mesh(geo.cylinder(0.03, 0.05, 0.9, 8), new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 }));
bpStem.position.y = 0.85;
bossPlant.add(bpStem);
const bpLeafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d43, roughness: 0.9 });
for (let i = 0; i < 7; i++) {
  const leaf = new THREE.Mesh(geo.sphere(0.22, 8, 8), bpLeafMat);
  const a = (i / 7) * Math.PI * 2;
  leaf.position.set(Math.cos(a) * 0.3, 1.25 + Math.sin(a) * 0.1, Math.sin(a) * 0.3);
  leaf.scale.set(0.7, 1.0, 0.7);
  leaf.castShadow = true;
  bossPlant.add(leaf);
}
for (let i = 0; i < 4; i++) {
  const leaf = new THREE.Mesh(geo.sphere(0.16, 8, 8), new THREE.MeshStandardMaterial({ color: 0x3b9b4f, roughness: 0.9 }));
  const a = (i / 4) * Math.PI * 2 + 0.3;
  leaf.position.set(Math.cos(a) * 0.18, 1.65 + Math.sin(a) * 0.08, Math.sin(a) * 0.18);
  leaf.scale.set(0.8, 1.0, 0.8);
  bossPlant.add(leaf);
}
bossGroup.add(bossPlant);
registerSelectable('bossPlant', '🌿 Planta Gerencia', bossPlant, 'furniture');

createWallClock('bossClock', '🕰️ Reloj de Pared', -4.6, 7.6, -Math.PI / 2, 2.4);
createPainting('bossArt1', '🖼️ Cuadro 1', -4.6, 9.5, -Math.PI / 2, 2.1, 1.1, 0.8);
createPainting('bossArt3', '🖼️ Cuadro 3', -11.5, 4.59, 0, 2.1, 1.3, 0.85);

createWallAP('ap4', '📶 AP WiFi Gerencia', -14.88, 7.5, Math.PI / 2);
createWindow('bossWindow', '🪟 Ventana Gerencia', -14.87, 2.1, 9.8, Math.PI / 2, 2.0, 1.6, bossGroup);
createBar('bossBar', '🍸 Barra de Bebidas', -12.3, 5.15, 0);
createCopier('copier', '🖨️ Impresora del Jefe', -10.4, 5.0, 0);

createVendingMachine('vendingMachine', '🍫 Máquina de Golosinas', 14.4, 5.8, Math.PI);
createFridge('fridge', '🧊 Heladera', 4.85, 7.1, 0);
createWaterDispenser('dispenser', 'Dispenser de Agua', 4.85, 5.8, 0);
createKitchenCounter('kitchenCounter', '🍽️ Mesada de Cocina', 4.85, 9.3, 0);
createLunchTable('lunchTable', '🍽️ Mesa de Comedores', 8.5, 7.5, 0);

// 6 sillas del comedor alrededor de la mesa (8.5, 7.5). El respaldo queda en
// local +z, así que la silla "mira" hacia -z. Las del norte (z=6.4) miran al
// sur (hacia la mesa, +z) => rot 180°; las del sur (z=8.6) miran al norte (-z) => rot 0.
createChair('lunchChair1', 'Silla Comedor 1', 7.5, 6.4, Math.PI);
createChair('lunchChair2', 'Silla Comedor 2', 8.5, 6.4, Math.PI);
createChair('lunchChair3', 'Silla Comedor 3', 9.5, 6.4, Math.PI);
createChair('lunchChair4', 'Silla Comedor 4', 7.5, 8.6, 0);
createChair('lunchChair5', 'Silla Comedor 5', 8.5, 8.6, 0);
createChair('lunchChair6', 'Silla Comedor 6', 9.5, 8.6, 0);

registerCatalogEntry({ id: 'kitchenCounter', label: '🍽️ Mesada de Cocina', cat: '🍽️ Cocina', spawn: (id, name, x, z, rotY) => createKitchenCounter(id, name, x, z, rotY) });
registerCatalogEntry({ id: 'fridge', label: '🧊 Heladera', cat: '🍽️ Cocina', spawn: (id, name, x, z, rotY) => createFridge(id, name, x, z, rotY) });
registerCatalogEntry({ id: 'dispenser', label: '🚰 Dispenser de Agua', cat: '🍽️ Cocina', spawn: (id, name, x, z, rotY) => createWaterDispenser(id, name, x, z, rotY) });
registerCatalogEntry({ id: 'vendingMachine', label: '🍫 Máquina de Golosinas', cat: '🍽️ Cocina', spawn: (id, name, x, z, rotY) => createVendingMachine(id, name, x, z, rotY) });
registerCatalogEntry({ id: 'lunchTable', label: '🍽️ Mesa de Comedor', cat: '🍽️ Cocina', spawn: (id, name, x, z, rotY) => createLunchTable(id, name, x, z, rotY) });

registerCatalogEntry({ id: 'confTable', label: '🪵 Mesa de Juntas', cat: '🛋️ Lounge/Gerencia', spawn: (id, name, x, z, rotY) => createConferenceTable(id, name, x, z, rotY) });
registerCatalogEntry({ id: 'chesterfield', label: '🛋️ Chesterfield', cat: '🛋️ Lounge/Gerencia', spawn: (id, name, x, z, rotY) => createChesterfield(id, name, x, z, rotY) });
registerCatalogEntry({ id: 'bossTable', label: '☕ Mesa Ratona', cat: '🛋️ Lounge/Gerencia', spawn: (id, name, x, z, rotY) => createBossTable(id, name, x, z, rotY) });
registerCatalogEntry({ id: 'bar', label: '🍸 Barra de Bebidas', cat: '🛋️ Lounge/Gerencia', spawn: (id, name, x, z, rotY) => createBar(id, name, x, z, rotY) });
registerCatalogEntry({ id: 'execDesk', label: '🖥️ Escritorio Gerencia', cat: '🛋️ Lounge/Gerencia', spawn: (id, name, x, z, rotY) => createExecDesk(id, name, x, z, rotY) });
registerCatalogEntry({ id: 'execChair', label: '🪑 Silla Gerencia', cat: '🛋️ Lounge/Gerencia', spawn: (id, name, x, z, rotY) => createExecChair(id, name, x, z, rotY) });
registerCatalogEntry({ id: 'guestChair', label: '🪑 Silla de Invitado', cat: '🛋️ Lounge/Gerencia', spawn: (id, name, x, z, rotY) => createGuestChair(id, name, x, z, rotY) });
registerCatalogEntry({ id: 'painting', label: '🖼️ Cuadro', cat: '🛋️ Lounge/Gerencia', baseY: 2.1, spawn: (id, name, x, z, rotY) => createPainting(id, name, x, z, rotY) });
registerCatalogEntry({ id: 'wallClock', label: '🕰️ Reloj de Pared', cat: '🛋️ Lounge/Gerencia', baseY: 2.4, spawn: (id, name, x, z, rotY) => createWallClock(id, name, x, z, rotY) });

}
