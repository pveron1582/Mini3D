// js/office/network.js — extraído de office.js (split P1, ver mejoras_glm.md)

import * as THREE from 'three';
import * as geo from './geoCache.js';
import { officeGroup, registerMiniRack, serverLedMaterials } from './group.js';
import { createAlarmBeacon } from './alarm.js';
import { rackMat, metalDeskMat, glassMat, steelMat, goldMat } from './materials.js';
import { createCopier } from './furniture.js';
import { getWallColliders } from './walls.js';
import { registerSelectable } from '../ui/selection.js';
import { registerCatalogEntry } from '../catalog.js';

// Materiales de canaletas/cables a nivel de módulo: los reutiliza la fábrica
// del catálogo createCableTray además de la instalación fija de buildNetwork.
const trayMat = new THREE.MeshStandardMaterial({ color: 0xb8bec9, roughness: 0.5, metalness: 0.6 });
const cableMats = [
  new THREE.MeshStandardMaterial({ color: 0x2f6fd8, roughness: 0.7 }),
  new THREE.MeshStandardMaterial({ color: 0xd8a72f, roughness: 0.7 }),
  new THREE.MeshStandardMaterial({ color: 0xd83f3f, roughness: 0.7 })
];

// Segmentos de la instalación fija de canaletas (los llena buildNetwork). Los
// usa la herramienta de dibujo (js/trayDraw.js) como destinos del "imán" para
// conectar tramos nuevos a la red existente.
const fixedTraySegs = [];
export function getFixedTraySegments() { return fixedTraySegs; }

export function buildNetwork() {
// ==========================================
// 7. INSTALACIONES: PUERTA, TEXTURA, RED Y ELÉCTRICIDAD
// ==========================================

// A. Puerta doble de vidrio (entrada, pared sur)
const doorGroup = new THREE.Group();
doorGroup.position.set(0, 0, 10.85);
const aluMat = new THREE.MeshStandardMaterial({ color: 0x8a929e, roughness: 0.3, metalness: 0.9 });
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0xbfe0ea, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1
});
// Marco
const frameL = new THREE.Mesh(geo.box(0.08, 2.3, 0.14), aluMat);
frameL.position.set(-1.02, 1.15, 0);
doorGroup.add(frameL);
const frameR = frameL.clone(); frameR.position.x = 1.02; doorGroup.add(frameR);
const frameTop = new THREE.Mesh(geo.box(2.12, 0.08, 0.14), aluMat);
frameTop.position.set(0, 2.3, 0);
doorGroup.add(frameTop);
// Dos hojas de vidrio
[-0.5, 0.5].forEach(px => {
  const leaf = new THREE.Group();
  const glass = new THREE.Mesh(geo.box(0.94, 2.2, 0.04), glassMat);
  glass.position.y = 1.15;
  leaf.add(glass);
  const midBar = new THREE.Mesh(geo.box(0.94, 0.05, 0.06), aluMat);
  midBar.position.y = 1.15;
  leaf.add(midBar);
  const handle = new THREE.Mesh(geo.cylinder(0.02, 0.02, 0.5, 8), aluMat);
  handle.position.set(px > 0 ? -0.08 : 0.08, 1.05, 0.07);
  leaf.add(handle);
  leaf.position.x = px;
  doorGroup.add(leaf);
});
officeGroup.add(doorGroup);
registerSelectable('mainDoor', '🚪 Puerta de Entrada', doorGroup, 'furniture');

// C. Instalación de red: mini rack de pared + canaletas + cables
const TRAY_Y = 3.42;  // pegadas al borde superior de los tabiques (3.5)
const TRAY_Y_OUT = 3.55; // paredes exteriores (3.7)
fixedTraySegs.length = 0; // reinicia el índice de tramos fijos (para el imán)

// Canaleta horizontal (segmento de x1,z1 a x2,z2, pegada al borde de la pared)
function cableTray(x1, z1, x2, z2, y) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  if (len < 0.05) return;
  fixedTraySegs.push({ x1, z1, x2, z2, y: y !== undefined ? y : TRAY_Y });
  const g = new THREE.Group();
  g.position.set((x1 + x2) / 2, y !== undefined ? y : TRAY_Y, (z1 + z2) / 2);
  g.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  const tray = new THREE.Mesh(geo.box(len, 0.05, 0.16), trayMat);
  g.add(tray);
  // Cables de colores dentro de la canaleta
  cableMats.forEach((cm, i) => {
    const cable = new THREE.Mesh(geo.box(len, 0.02, 0.02), cm);
    cable.position.set(0, 0.04, -0.05 + i * 0.05);
    g.add(cable);
  });
  officeGroup.add(g);
}

// Bajada vertical hasta el mini rack / tablero
function cableDrop(x, z, yBottom, yTop) {
  const h = (yTop !== undefined ? yTop : TRAY_Y) - yBottom;
  const drop = new THREE.Mesh(geo.box(0.14, h, 0.1), trayMat);
  drop.position.set(x, yBottom + h / 2, z);
  officeGroup.add(drop);
  cableMats.forEach((cm, i) => {
    const cable = new THREE.Mesh(geo.box(0.02, h, 0.02), cm);
    cable.position.set(x - 0.04 + i * 0.04, yBottom + h / 2, z + 0.05);
    officeGroup.add(cable);
  });
}

// Mini rack FIJO de la sala de juntas: pegado a la PARED ESTE, justo al lado
// norte de la TV grande, montado BIEN ARRIBA (se llega con la escalera de
// apoyo de la sala de sistemas). Sale de la misma fábrica (createMiniRack,
// definida abajo a nivel de módulo) que los del catálogo, así la puerta
// funciona idéntico en todas las instancias.
createMiniRack('miniRack', '🖧 Mini Rack de Red', 14.48, -9.45, -Math.PI / 2, 2.3);

// Recorrido de canaletas: SOLO por paredes de oficinas. Ruta directa de la
// sala de racks (NO) a la oficina de la mesa grande (NE) por la pared norte
// exterior, atravesando los tabiques de las oficinas con pasamuros, como en
// cablerío estructurado real.
cableTray(-13.0, -10.82, 14.2, -10.82, TRAY_Y_OUT); // pared norte: racks → mini rack (juntas)

// Pasamuros donde el canal atraviesa los tabiques de las oficinas
[-4.5, 4.5].forEach(px => {
  const sleeve = new THREE.Mesh(
    geo.cylinder(0.09, 0.09, 0.34, 10),
    new THREE.MeshStandardMaterial({ color: 0x8a929e, roughness: 0.4, metalness: 0.7 })
  );
  sleeve.rotation.z = Math.PI / 2;
  sleeve.position.set(px, TRAY_Y_OUT, -10.82);
  officeGroup.add(sleeve);
  const ring = new THREE.Mesh(
    geo.torus(0.1, 0.02, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.35, metalness: 0.8 })
  );
  ring.rotation.y = Math.PI / 2;
  ring.position.set(px + (px < 0 ? 0.17 : -0.17), TRAY_Y_OUT, -10.82);
  officeGroup.add(ring);
});

// Bajada a los racks de la sala de servidores (por la pared hasta el tope
// del primer rack, con un tramo corto horizontal sobre el rack)
cableDrop(-13.5, -10.78, 2.48, TRAY_Y_OUT);
cableTray(-13.5, -10.82, -13.5, -9.9, 2.48);
// Bajada al mini rack de la oficina de juntas: baja por la pared ESTE
// hasta el tope del rack (ahora montado bien arriba, junto a la TV)
cableDrop(14.84, -9.45, 2.80, TRAY_Y_OUT);

// Derivación de canaletas de colores hacia los puestos nuevos del sector
// este (E5–E8): sale del mini rack por la parte superior de las paredes,
// recorre la pared ESTE interior de la sala de juntas hacia el sur,
// ATRAVIESA el tabique que cierra el contorno de la sala (z=-4.5) con un
// pasamuros, y CONTINÚA por la misma pared este (la que hace de borde con
// el exterior) hasta LA MITAD de esa pared (z=0, el centro de los puestos
// nuevos), donde baja un canal hasta el piso.
cableTray(14.2, -10.82, 14.82, -10.82, TRAY_Y_OUT);   // tramo al rincón NE
cableTray(14.82, -10.82, 14.82, -4.5, TRAY_Y_OUT);    // pared este interior → sur
// Pasamuros en el tabique sur de juntas (z=-4.5), igual al de la pared norte
const sleeveSE = new THREE.Mesh(
  geo.cylinder(0.09, 0.09, 0.34, 10),
  new THREE.MeshStandardMaterial({ color: 0x8a929e, roughness: 0.4, metalness: 0.7 })
);
sleeveSE.rotation.x = Math.PI / 2;
sleeveSE.position.set(14.82, TRAY_Y_OUT, -4.5);
officeGroup.add(sleeveSE);
[-0.17, 0.17].forEach(sz => {
  const ringSE = new THREE.Mesh(
    geo.torus(0.1, 0.02, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.35, metalness: 0.8 })
  );
  ringSE.position.set(14.82, TRAY_Y_OUT, -4.5 + sz);
  officeGroup.add(ringSE);
});
cableTray(14.82, -4.5, 14.82, 0, TRAY_Y_OUT);         // sigue por la pared este hasta su mitad
cableDrop(14.78, 0, 0.12, TRAY_Y_OUT);                // bajada hasta el piso (mitad de la pared este)

// Contorno OESTE: desde los racks de sistemas (rincón NO), por la pared
// oeste hacia el sur y por la pared sur, rodeando la oficina del jefe.
cableTray(-14.82, -10.82, -13.0, -10.82, TRAY_Y_OUT); // cierra el rincón NO con la canaleta existente
cableTray(-14.82, -10.82, -14.82, 10.82, TRAY_Y_OUT); // pared oeste completa hasta el rincón SO
// Pasamuros donde la canaleta OESTE atraviesa los tabiques horizontales
// (z=±4.5): mismos cilindros + anillos que el resto de la instalación.
// El tubo atraviesa en Z, así que los anillos abrazan el tubo a cada lado
// del espesor (offset en Z, toro mirando al eje del tubo).
[-4.5, 4.5].forEach(sz => {
  const sleeveW = new THREE.Mesh(
    geo.cylinder(0.09, 0.09, 0.34, 10),
    new THREE.MeshStandardMaterial({ color: 0x8a929e, roughness: 0.4, metalness: 0.7 })
  );
  sleeveW.rotation.x = Math.PI / 2;
  sleeveW.position.set(-14.82, TRAY_Y_OUT, sz);
  officeGroup.add(sleeveW);
  [-0.17, 0.17].forEach(off => {
    const ringW = new THREE.Mesh(
      geo.torus(0.1, 0.02, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.35, metalness: 0.8 })
    );
    ringW.position.set(-14.82, TRAY_Y_OUT, sz + off);
    officeGroup.add(ringW);
  });
});
cableTray(-14.82, 10.82, -4.82, 10.82, TRAY_Y_OUT);   // pared sur hasta el tabique este del jefe
// Ramal dentro de la oficina del jefe: por el borde superior del tabique
// norte (z=4.5, altura TRAY_Y) hasta el eje de la impresora (x=-10.4),
// donde baja un canal directo sobre la impresora.
cableTray(-14.7, 4.62, -10.4, 4.62, TRAY_Y);
cableDrop(-10.4, 4.66, 1.05, TRAY_Y);

// Bajada a la fotocopiadora de la sala de sistemas: toma la canaleta de la
// pared oeste y baja hasta el tope del equipo.
cableDrop(-14.72, -5.3, 1.02, TRAY_Y_OUT);

// Bajada a altura de tomacorriente (y=0.10) en la pared norte, sobre los
// puestos de la sala de sistemas: se ramifica de la canaleta y baja hasta
// ~10 cm del piso (no llega al suelo)
cableDrop(-4.0, -10.78, 0.10, TRAY_Y_OUT);
// Espejo del otro lado de la pared norte (lado este): baja hasta el piso
cableDrop(4.0, -10.78, 0.0, TRAY_Y_OUT);
// Centro de la pared norte: bajada para las PCs del medio (N5-N8), hasta el piso
cableDrop(0.0, -10.78, 0.0, TRAY_Y_OUT);

// C2. Distribución central por el PISO: bajada por el tabique sur al suelo,
// canal plano sobre el piso y puestos de red junto a cada PC
function floorChannel(x1, z1, x2, z2) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  if (len < 0.05) return;
  const g = new THREE.Group();
  g.position.set((x1 + x2) / 2, 0.015, (z1 + z2) / 2);
  g.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  const ch = new THREE.Mesh(geo.box(len, 0.03, 0.1), trayMat);
  ch.receiveShadow = true;
  g.add(ch);
  officeGroup.add(g);
}

let floorOutletCount = 0;
// Puesto técnico de piso con red (RJ45 + LEDs) y electricidad (2 enchufes).
// La geometría vive en la fábrica del catálogo createFloorOutlet; acá solo se
// mantiene el contador y se genera el id/nombre de los puestos fijos de la oficina.
function floorOutlet(x, z) {
  floorOutletCount++;
  return createFloorOutlet('floorOutlet' + floorOutletCount, '🔌 Puesto Red+Elec ' + floorOutletCount, x, z);
}

// Tendido de red por el piso para las 6 PCs del espacio central:
// SOLO tramos cortos ocultos bajo las mesas, junto a la torre de cada PC
// (sin columna visible cruzando la alfombra)
floorChannel(-2.0, -1.05, -2.0, 2.32);    // transversal que une todos los ramales
floorChannel(-2.0, -1.05, 1.65, -1.05);   // ramal escritorios 1-2
floorChannel(-2.0, 1.05, 0.55, 1.05);     // ramal escritorios 3-4
floorChannel(-2.0, -0.88, -3.2, -0.88);   // ramal escritorio 5 (conectado a la transversal)
floorChannel(-2.0, 2.32, -3.2, 2.32);     // ramal escritorio 6
floorChannel(-2.0, 0, -3.7, 0);           // ramal fotocopiadora
// Puestos de red junto a la torre de cada PC
floorOutlet(-0.55, -1.05);
floorOutlet(1.65, -1.05);
floorOutlet(-1.95, 1.05);
floorOutlet(0.55, 1.05);
floorOutlet(-3.05, -0.88);
floorOutlet(-3.2, 2.32);
floorOutlet(-3.7, 0);

// ===== Tomás de piso para las hileras ESTE y NORTE (sin canales blancos):
// la conexión se hará desde bocas de red en la pared de fondo =====
floorOutlet(13.35, -1.05); // bajo Escritorio Este 1
floorOutlet(13.35, -1.95); // bajo Escritorio Este 2
floorOutlet(13.35, 1.95);  // bajo Escritorio Este 3
floorOutlet(13.35, 1.05);  // bajo Escritorio Este 4
floorOutlet(12.4, -1.05);  // bajo Escritorio Este 5
floorOutlet(12.4, -1.95);  // bajo Escritorio Este 6
floorOutlet(12.4, 1.95);   // bajo Escritorio Este 7
floorOutlet(12.4, 1.05);   // bajo Escritorio Este 8

// Fotocopiadora del espacio central (entre los escritorios 5 y 6)
createCopier('copier', 'Fotocopiadora', -4.05, 0, -Math.PI / 2);

// D. Tablero eléctrico (pasillo norte, afuera de las oficinas)
createElecPanel('elecPanel', '⚡ Tablero Eléctrico', -9.0, -10.82, 0, 1.5);
// Conduit del tablero hasta la canaleta de la pared norte (pegado a la pared)
const conduit = new THREE.Mesh(geo.cylinder(0.03, 0.03, 1.6, 8), trayMat);
conduit.position.set(-9.0, 2.75, -10.85);
officeGroup.add(conduit);

// E. Access Points WiFi de pared (estilo Cisco, antenas grandes)

// --- Catálogo (Lote 3 — Red): piezas de red spawneables desde "➕ Agregar Objeto" ---
registerCatalogEntry({ id: 'wallAP', label: '📶 AP WiFi de Pared', cat: '📡 Red', baseY: 2.25, spawn: (id, name, x, z, rotY) => createWallAP(id, name, x, z, rotY) });
registerCatalogEntry({ id: 'elecPanel', label: '⚡ Tablero Eléctrico', cat: '📡 Red', baseY: 1.5, spawn: (id, name, x, z, rotY) => createElecPanel(id, name, x, z, rotY) });
registerCatalogEntry({ id: 'cableTray', label: '🔗 Canaleta de Cables', cat: '📡 Red', baseY: 3.42,
  spawn: (id, name, x, z, rotY) => createCableTray(id, name, x, z, rotY),
  // Reconstruye un tramo dibujado punto a punto (guarda sus puntos en `data`).
  rebuild: (s) => {
    const d = s.data;
    if (d && Array.isArray(d.points) && d.points.length >= 2) {
      const abs = d.points.map(off => ({ x: s.pos[0] + off.x, z: s.pos[2] + off.z }));
      return createCableTrayRun(s.id, s.name, abs, d.y ?? 3.42);
    }
    return null;
  } });
registerCatalogEntry({ id: 'floorOutlet', label: '🔌 Puesto Red+Elec', cat: '📡 Red', spawn: (id, name, x, z, rotY) => createFloorOutlet(id, name, x, z, rotY) });
registerCatalogEntry({ id: 'miniRack', label: '🖧 Mini Rack de Red', cat: '📡 Red', baseY: 2.3, spawn: (id, name, x, z, rotY) => createMiniRack(id, name, x, z, rotY) });
}

// ==========================================
// FÁBRICA DEL MINI RACK (Lote 3b)
// ==========================================
// Marco ABIERTO por delante para ver los equipos, patch panels, switches con
// LEDs y puerta de vidrio transparente con bisagra animable. Todas las
// instancias (el fijo + los del catálogo) registran su puerta vía
// registerMiniRack (group.js), así el ticker anima cualquiera de ellas.

function buildMiniRackMesh() {
  const rack = new THREE.Group();
  // Carcasa abierta (sin cara frontal): posterior + laterales + techo + base
  const mrBack = new THREE.Mesh(geo.box(0.8, 1.0, 0.04), rackMat);
  mrBack.position.set(0, 0, -0.43);
  mrBack.castShadow = true;
  rack.add(mrBack);
  const mrSideL = new THREE.Mesh(geo.box(0.04, 1.0, 0.86), rackMat);
  mrSideL.position.set(-0.38, 0, 0);
  rack.add(mrSideL);
  const mrSideR = new THREE.Mesh(geo.box(0.04, 1.0, 0.86), rackMat);
  mrSideR.position.set(0.38, 0, 0);
  rack.add(mrSideR);
  const mrTop = new THREE.Mesh(geo.box(0.8, 0.04, 0.86), rackMat);
  mrTop.position.set(0, 0.48, 0);
  rack.add(mrTop);
  const mrBottom = new THREE.Mesh(geo.box(0.8, 0.04, 0.86), rackMat);
  mrBottom.position.set(0, -0.48, 0);
  rack.add(mrBottom);
  // Montantes frontales (estilo 19") donde se atornillan los equipos
  const railMat = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, metalness: 0.8, roughness: 0.4 });
  const mrRailL = new THREE.Mesh(geo.box(0.03, 0.96, 0.05), railMat);
  mrRailL.position.set(-0.34, 0, 0.30);
  rack.add(mrRailL);
  const mrRailR = mrRailL.clone();
  mrRailR.position.x = 0.34;
  rack.add(mrRailR);

  // Patch panels (con sus puertos LED) montados en los montantes
  const patchMat = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, metalness: 0.7 });
  for (let i = 0; i < 4; i++) {
    const yy = 0.32 - i * 0.18;
    const patch = new THREE.Mesh(geo.box(0.66, 0.09, 0.05), patchMat);
    patch.position.set(0, yy, 0.30);
    rack.add(patch);
    for (let p = -0.27; p <= 0.27; p += 0.035) {
      const port = new THREE.Mesh(geo.box(0.014, 0.014, 0.012), new THREE.MeshBasicMaterial({ color: (i * 7 + p * 100) % 2 > 0 ? 0x00ff88 : 0x0a2a18 }));
      port.position.set(p, yy, 0.33);
      rack.add(port);
    }
  }

  // Switches de red (se ven por el frente abierto y la puerta transparente)
  const swBodyMat = new THREE.MeshStandardMaterial({ color: 0x14171c, metalness: 0.85, roughness: 0.35 });
  function makeMiniSwitch(yy, ledColor) {
    const sw = new THREE.Group();
    const body = new THREE.Mesh(geo.box(0.68, 0.16, 0.34), swBodyMat);
    body.position.z = 0.17;
    body.castShadow = true;
    sw.add(body);
    for (let i = -6; i <= 6; i++) {
      const led = new THREE.Mesh(geo.box(0.02, 0.02, 0.01), new THREE.MeshBasicMaterial({ color: i % 2 ? ledColor : 0x0a2a18 }));
      led.position.set(i * 0.05, 0.045, 0.345);
      sw.add(led);
      serverLedMaterials.push(led.material);
    }
    // Retraído hacia dentro de la carcasa (z=0.06): el frente del cuerpo queda
    // en z≈0.40 y los LEDs en z≈0.405, DETRÁS de la puerta de vidrio (z≈0.44).
    // Así se ven a través del vidrio sin atravesarla.
    sw.position.set(0, yy, 0.06);
    return sw;
  }
  rack.add(makeMiniSwitch(0.36, 0x33ccff));
  rack.add(makeMiniSwitch(0.08, 0x22aa55));

  // Puerta de vidrio transparente con bisagra (se abre sobre el borde
  // izquierdo). Manija y cerradura van como hijos de la bisagra.
  const mrDoorHinge = new THREE.Group();
  mrDoorHinge.position.set(-0.40, 0, 0.45);
  const mrDoor = new THREE.Mesh(geo.box(0.78, 0.96, 0.02), new THREE.MeshPhysicalMaterial({
    color: 0xbfd2e6, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.3, envMapIntensity: 1.4, depthWrite: false
  }));
  mrDoor.position.set(0.39, 0, 0);
  mrDoorHinge.add(mrDoor);
  const mrHandle = new THREE.Mesh(geo.box(0.02, 0.18, 0.03), steelMat);
  mrHandle.position.set(0.76, 0, 0.03);
  mrDoorHinge.add(mrHandle);
  const mrLock = new THREE.Mesh(geo.cylinder(0.014, 0.014, 0.03, 10), goldMat);
  mrLock.rotation.x = Math.PI / 2;
  mrLock.position.set(0.72, -0.08, 0.02);
  mrDoorHinge.add(mrLock);
  rack.add(mrDoorHinge);

  return { rack, doorHinge: mrDoorHinge };
}

// Crea un mini rack completo (geometría + registro + puerta animable).
// `y` permite montarlo en pared (por defecto a la altura de la sala de juntas).
export function createMiniRack(id, name, x, z, rotY = 0, y = 2.3) {
  const { rack, doorHinge } = buildMiniRackMesh();
  rack.position.set(x, y, z);
  rack.rotation.y = rotY;
  officeGroup.add(rack);
  registerSelectable(id, name, rack, 'prop');
  // registerSelectable pisa userData: la puerta se setea después de registrar.
  rack.userData.doorHinge = doorHinge;
  rack.userData.doorOpen = 0;
  rack.userData.doorAngle = 0;
  rack.userData.basePos = rack.position.clone();
  registerMiniRack(rack);
  return rack;
}

export function createWallAP(id, name, x, z, rotY, y = 2.25) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;

  const apMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f8, roughness: 0.4 });
  const body = new THREE.Mesh(geo.box(0.34, 0.2, 0.1), apMat);
  body.castShadow = true;
  g.add(body);

  const led = new THREE.Mesh(geo.box(0.06, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0x2fa8ff }));
  led.position.set(0.1, -0.05, 0.06);
  g.add(led);
  serverLedMaterials.push(led.material);

  // Antenas exteriores grandes
  const antMat = new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.35 });
  [-0.11, 0, 0.11].forEach((ax, i) => {
    const antGroup = new THREE.Group();
    antGroup.position.set(ax, 0.1, 0.02);
    antGroup.rotation.z = (i - 1) * 0.35;
    antGroup.rotation.x = -0.25;
    const ant = new THREE.Mesh(geo.cylinder(0.016, 0.02, 0.42, 8), antMat);
    ant.position.y = 0.21;
    ant.castShadow = true;
    antGroup.add(ant);
    const tip = new THREE.Mesh(geo.cylinder(0.008, 0.016, 0.05, 8), antMat);
    tip.position.y = 0.44;
    antGroup.add(tip);
    g.add(antGroup);
  });

  officeGroup.add(g);
  registerSelectable(id, name, g, 'prop');
  return g;
}
// AP central junto a la puerta (a la derecha, totalmente apoyado en la pared)
createWallAP('ap1', '📶 AP WiFi Central', 2.6, 10.85, Math.PI, 2.25);
createWallAP('ap2', '📶 AP WiFi Juntas', 4.57, -6.5, -Math.PI / 2);     // pared lisa → sala de juntas (NE)
createWallAP('ap3', '📶 AP WiFi Servidores', -4.57, -8.5, Math.PI / 2); // pared lisa → sala de servidores (NO)

// Tablero eléctrico de pared (fábrica del catálogo, Lote 3 — Red).
export function createElecPanel(id, name, x, z, rotY = 0, y = 1.5) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  const pBody = new THREE.Mesh(geo.box(0.8, 1.0, 0.18), new THREE.MeshStandardMaterial({ color: 0x9aa3ae, roughness: 0.4, metalness: 0.5 }));
  pBody.castShadow = true;
  g.add(pBody);
  const pDoor = new THREE.Mesh(geo.box(0.72, 0.9, 0.02), new THREE.MeshStandardMaterial({ color: 0x7d8794, roughness: 0.35, metalness: 0.6 }));
  pDoor.position.set(0, 0, 0.1);
  g.add(pDoor);
  const pHandle = new THREE.Mesh(geo.box(0.04, 0.18, 0.04), metalDeskMat);
  pHandle.position.set(0.28, 0, 0.13);
  g.add(pHandle);
  const pLight = new THREE.Mesh(geo.box(0.1, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: 0x33ff66 }));
  pLight.position.set(-0.28, 0.38, 0.11);
  g.add(pLight);
  officeGroup.add(g);
  registerSelectable(id, name, g, 'furniture');
  return g;
}

// Geometría de un tramo de canaleta (caja + 3 cables de colores), centrada en
// el origen y alineada al eje X. La reutilizan createCableTray (tramo fijo) y
// createCableTrayRun (tramo dibujado punto a punto).
function makeTrayGeom(len) {
  const g = new THREE.Group();
  const tray = new THREE.Mesh(geo.box(len, 0.05, 0.16), trayMat);
  g.add(tray);
  cableMats.forEach((cm, i) => {
    const cable = new THREE.Mesh(geo.box(len, 0.02, 0.02), cm);
    cable.position.set(0, 0.04, -0.05 + i * 0.05);
    g.add(cable);
  });
  return g;
}

// Canaleta de cables horizontal (fábrica del catálogo, Lote 3 — Red).
// Tramo recto de largo `len` con 3 cables de colores dentro.
export function createCableTray(id, name, x, z, rotY = 0, len = 2, y = 3.42) {
  const g = makeTrayGeom(len);
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  officeGroup.add(g);
  registerSelectable(id, name, g, 'prop');
  return g;
}

const r2 = (v) => Math.round(v * 100) / 100;

// Canaleta dibujada punto a punto (herramienta de dibujo, ver js/trayDraw.js).
// `absPoints` es la lista de puntos en coordenadas de mundo [{x, z}, ...]; el
// grupo se ancla en el primer punto y cada tramo se ubica relativo a él, así al
// mover el objeto con el gizmo se desplaza entero. Guarda los puntos relativos
// en userData.spawnData para poder recrearse al cargar el proyecto.
// Donde un tramo ATRAVIESA una pared (collider), se agrega un PASAMUROS
// (cilindro + 2 anillos) en el punto de cruce — igual que la instalación fija:
// el tubo se ve atravesando el tabique.
const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x8a929e, roughness: 0.4, metalness: 0.7 });
const ringMat = new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.35, metalness: 0.8 });

// Agrega un pasamuro en (x, y, z) orientado sobre el eje X o Z del mundo.
// El cilindro atraviesa el espesor de la pared y los anillos marcan ambas caras.
function addSleeveAt(g, x, y, z, alongZ) {
  const sleeve = new THREE.Mesh(geo.cylinder(0.09, 0.09, 0.34, 10), sleeveMat);
  if (alongZ) sleeve.rotation.x = Math.PI / 2;
  else sleeve.rotation.z = Math.PI / 2;
  sleeve.position.set(x - g.position.x, y - g.position.y, z - g.position.z);
  g.add(sleeve);
  const offs = [0.17, -0.17];
  offs.forEach(o => {
    const ring = new THREE.Mesh(geo.torus(0.1, 0.02, 8, 16), ringMat);
    if (!alongZ) ring.rotation.y = Math.PI / 2;
    ring.position.set(
      sleeve.position.x + (alongZ ? 0 : o),
      sleeve.position.y,
      sleeve.position.z + (alongZ ? o : 0)
    );
    g.add(ring);
  });
}

// ¿El segmento a→b atraviesa el AABB de una pared? Devuelve el punto de cruce
// (mundo) o null. Solo segmentos rectos (X o Z): el routing es ortogonal.
function segmentWallCross(a, b, box) {
  // Tramo horizontal (varía x, z constante): cruza si z cae en el rango del
  // box y el x del box está entre a.x y b.x.
  if (Math.abs(b.z - a.z) < 1e-6) {
    if (a.z < box.minZ || a.z > box.maxZ) return null;
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
    if (box.maxX <= x0 || box.minX >= x1) return null;
    return { x: (box.minX + box.maxX) / 2, z: a.z, alongZ: false };
  }
  // Tramo vertical (varía z, x constante)
  if (Math.abs(b.x - a.x) < 1e-6) {
    if (a.x < box.minX || a.x > box.maxX) return null;
    const z0 = Math.min(a.z, b.z), z1 = Math.max(a.z, b.z);
    if (box.maxZ <= z0 || box.minZ >= z1) return null;
    return { x: a.x, z: (box.minZ + box.maxZ) / 2, alongZ: true };
  }
  return null; // diagonales no ocurren (routing ortogonal)
}

export function createCableTrayRun(id, name, absPoints, y = 3.42) {
  const g = new THREE.Group();
  const ox = absPoints[0].x, oz = absPoints[0].z;
  g.position.set(ox, y, oz);
  const walls = getWallColliders();
  for (let i = 0; i < absPoints.length - 1; i++) {
    const a = absPoints[i], b = absPoints[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.05) continue;
    const seg = makeTrayGeom(len);
    seg.position.set((a.x + b.x) / 2 - ox, 0, (a.z + b.z) / 2 - oz);
    seg.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    g.add(seg);
    // Pasamuros automático donde ESTE tramo atraviesa una pared (sin repetir
    // el mismo cruce en tramos contiguos).
    for (const box of walls) {
      const cross = segmentWallCross(a, b, box);
      if (!cross) continue;
      // Evitar duplicado con el tramo anterior (esquinas comparten la pared)
      const dup = g.userData._crosses && g.userData._crosses.some(c =>
        Math.abs(c.x - cross.x) < 0.01 && Math.abs(c.z - cross.z) < 0.01);
      if (dup) continue;
      addSleeveAt(g, cross.x, 0, cross.z, cross.alongZ);
      (g.userData._crosses = g.userData._crosses || []).push(cross);
    }
  }
  officeGroup.add(g);
  registerSelectable(id, name, g, 'prop');
  g.userData.spawnData = { points: absPoints.map(p => ({ x: r2(p.x - ox), z: r2(p.z - oz) })), y };
  return g;
}

// Puesto técnico de piso con red (RJ45 + LEDs) y electricidad (2 enchufes),
// con base hexagonal y tapa metálica (fábrica del catálogo, Lote 3 — Red).
export function createFloorOutlet(id, name, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  // Base hexagonal
  const base = new THREE.Mesh(geo.cylinder(0.16, 0.18, 0.05, 6), new THREE.MeshStandardMaterial({ color: 0x20242b, roughness: 0.4, metalness: 0.6 }));
  base.position.y = 0.025;
  base.castShadow = true;
  g.add(base);
  // Tapa metálica bruñida
  const lid = new THREE.Mesh(geo.cylinder(0.13, 0.13, 0.03, 6), new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 0.3, metalness: 0.7 }));
  lid.position.y = 0.06;
  g.add(lid);
  // Placa central pisable retráctil
  const plate = new THREE.Mesh(geo.box(0.2, 0.012, 0.14), new THREE.MeshStandardMaterial({ color: 0x262b33, roughness: 0.5, metalness: 0.4 }));
  plate.position.y = 0.085;
  g.add(plate);
  // 2 puertos RJ45 con LEDs de actividad (verde y ámbar)
  [-0.05, 0.05].forEach((pz, i) => {
    const port = new THREE.Mesh(geo.box(0.045, 0.02, 0.018), new THREE.MeshBasicMaterial({ color: 0x0a2a18 }));
    port.position.set(-0.055, 0.1, pz);
    g.add(port);
    const led = new THREE.Mesh(geo.box(0.014, 0.008, 0.008), new THREE.MeshBasicMaterial({ color: i ? 0xffcc33 : 0x00ff88 }));
    led.position.set(0.045, 0.1, pz);
    g.add(led);
    serverLedMaterials.push(led.material);
  });
  // 2 enchufes de electricidad argentinos (tres patas)
  [-0.05, 0.05].forEach(pz => {
    const outlet = new THREE.Mesh(geo.cylinder(0.018, 0.018, 0.02, 6), new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.4 }));
    outlet.rotation.x = Math.PI / 2;
    outlet.position.set(0.055, 0.098, pz);
    g.add(outlet);
    const pin1 = new THREE.Mesh(geo.sphere(0.006, 6, 6), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
    pin1.position.set(0.055, 0.098, pz - 0.01);
    g.add(pin1);
    const pin2 = pin1.clone(); pin2.position.z = pz + 0.01;
    g.add(pin2);
  });
  // Etiqueta RJ45
  const label = new THREE.Mesh(geo.plane(0.06, 0.02), new THREE.MeshStandardMaterial({ color: 0x96a5b8 }));
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, 0.088, -0.08);
  g.add(label);
  officeGroup.add(g);
  registerSelectable(id, name, g, 'prop');
  return g;
}

// Balizas de alarma de emergencia (rojas). Parpadean cuando la escena activa
// la alarma (toma con `alarm: true`). Distribuidas por las paredes para que el
// destello rojo se vea en toda la oficina.
createAlarmBeacon(-11, 3.2, -10.55);  // sala de sistemas (pared norte)
createAlarmBeacon(0, 3.2, -10.55);    // pasillo norte
createAlarmBeacon(11, 3.2, -10.55);   // sala de juntas / mini rack (norte)
createAlarmBeacon(-11, 3.2, 10.55);   // oficina del jefe (suroeste)
createAlarmBeacon(11, 3.2, 10.55);    // sureste

