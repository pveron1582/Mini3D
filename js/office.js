import * as THREE from 'three';
import { scene } from './core.js';
import { registerSelectable } from './selection.js';

// ==========================================
// OFFICE ENVIRONMENT & INDEPENDENT PROPS
// ==========================================
export const officeGroup = new THREE.Group();
scene.add(officeGroup);
officeGroup.visible = false;

export const serverLedMaterials = [];

// Colisionadores AABB de las paredes (derivados de los grupos de pared)
export const wallGroups = [];
export function getWallColliders() {
  const out = [];
  wallGroups.forEach(g => {
    if (!g.visible) return;
    const wd = g.userData.wallData;
    if (!wd) return;
    // Paredes axis-aligned: si está rotada ~90° se intercambian largo/espesor
    const swap = Math.abs(Math.sin(g.rotation.y)) > 0.5;
    const w = (swap ? wd.d : wd.w) * g.scale.x;
    const d = (swap ? wd.w : wd.d) * g.scale.x;
    out.push({
      minX: g.position.x - w / 2, maxX: g.position.x + w / 2,
      minZ: g.position.z - d / 2, maxZ: g.position.z + d / 2
    });
  });
  return out;
}

// Materials for Office
const floorMat = new THREE.MeshStandardMaterial({ color: 0x353a45, roughness: 0.85, metalness: 0.1 });

// Catálogo de texturas de pared (procedurales, elegibles por el usuario)
function texCanvas(painter) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  painter(c.getContext('2d'));
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 1.5);
  return tex;
}
function noise(ctx, alpha) {
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(150,160,180,${alpha})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
}
const WALL_TEXTURES = {
  'Paneles claros': () => texCanvas(ctx => {
    // Greige elegante con degradado sutil y paneles grandes de juntas finas
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#edeae3');
    grad.addColorStop(1, '#dcd8ce');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#ccc7bb';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 256; i += 85) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, 128); ctx.lineTo(256, 128); ctx.stroke();
    noise(ctx, 0.05);
  }),
  'Cemento': () => texCanvas(ctx => {
    ctx.fillStyle = '#b9bcc2'; ctx.fillRect(0, 0, 256, 256);
    noise(ctx, 0.22);
    ctx.strokeStyle = '#a0a4ac'; ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * 256, Math.random() * 256);
      ctx.lineTo(Math.random() * 256, Math.random() * 256);
      ctx.stroke();
    }
  }),
  'Ladrillo': () => texCanvas(ctx => {
    ctx.fillStyle = '#9c5f4a'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#c9c2b8';
    const bh = 32, bw = 64;
    for (let r = 0; r < 256 / bh; r++) {
      for (let col = -1; col < 256 / bw + 1; col++) {
        const off = (r % 2) * (bw / 2);
        ctx.fillRect(col * bw + off + 2, r * bh + 2, bw - 4, bh - 4);
      }
    }
    noise(ctx, 0.1);
  }),
  'Madera': () => texCanvas(ctx => {
    ctx.fillStyle = '#a4784f'; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 30; i++) {
      ctx.strokeStyle = `rgba(90,60,35,${0.15 + Math.random() * 0.2})`;
      ctx.lineWidth = 1 + Math.random() * 2;
      const y = Math.random() * 256;
      ctx.beginPath(); ctx.moveTo(0, y);
      ctx.bezierCurveTo(80, y + 10, 160, y - 10, 256, y + 5);
      ctx.stroke();
    }
  }),
  'Azul corporativo': () => texCanvas(ctx => {
    ctx.fillStyle = '#3d5a80'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#46698f';
    for (let i = 0; i < 256; i += 32) ctx.fillRect(0, i, 256, 16);
    noise(ctx, 0.06);
  }),
  'Rayas grises': () => texCanvas(ctx => {
    ctx.fillStyle = '#cfd4dc'; ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#aab2bf';
    for (let i = 0; i < 256; i += 32) ctx.fillRect(0, i, 256, 12);
    noise(ctx, 0.05);
  })
};
const wallTextureCache = {};
export function getWallTexture(name) {
  if (!WALL_TEXTURES[name]) name = 'Paneles claros';
  if (!wallTextureCache[name]) wallTextureCache[name] = WALL_TEXTURES[name]();
  return wallTextureCache[name];
}
export const wallTextureNames = Object.keys(WALL_TEXTURES);

const wallMat = new THREE.MeshStandardMaterial({ map: getWallTexture('Paneles claros'), roughness: 0.9 });
const accentMat = new THREE.MeshStandardMaterial({ color: 0x4772b3, roughness: 0.6 });
const woodDeskMat = new THREE.MeshStandardMaterial({ color: 0xdfd4c0, roughness: 0.6 });
const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.5 });
const metalDeskMat = new THREE.MeshStandardMaterial({ color: 0x242830, roughness: 0.4, metalness: 0.8 });
const chairMat = new THREE.MeshStandardMaterial({ color: 0x1f232b, roughness: 0.7 });
const screenMat = new THREE.MeshStandardMaterial({ color: 0x101520, emissive: 0x3a7bd5, emissiveIntensity: 0.6, roughness: 0.2 });
const rackMat = new THREE.MeshStandardMaterial({ color: 0x181a1f, roughness: 0.3, metalness: 0.9 });

function buildOfficeEnvironment() {
  // 1. Floor (30m x 22m)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 22), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  officeGroup.add(floor);

  // 2. Walls (editables: seleccionables, movibles, con largo/alto/espesor
  //    y textura configurables desde el panel de Pared)
  let wallCounter = 0;
  function createWall(w, h, d, x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wallMat.clone());
    mesh.scale.set(w, h, d);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    officeGroup.add(g);
    wallCounter++;
    // Las paredes NO son seleccionables: quedan fijas (solo personajes y,
    // con "Editar Objetos" activado, el resto del mobiliario)
    g.userData.wallData = { w, h, d };
    g.userData.wallMesh = mesh;
    wallGroups.push(g);
    return g;
  }

  createWall(30, 3.7, 0.2, 0, 1.85, -11);
  createWall(30, 3.7, 0.2, 0, 1.85, 11);
  createWall(0.2, 3.7, 22, -15, 1.85, 0);
  createWall(0.2, 3.7, 22, 15, 1.85, 0);

  // Oficinas de esquina más chicas: tabiques en |x| >= 4.5 y |z| >= 4.5,
  // dejando un espacio central abierto más grande (9m x 8m)
  // Norte (z = -4.5), con puertas
  createWall(5.0, 3.5, 0.15, -12.5, 1.75, -4.5);
  createWall(4.0, 3.5, 0.15, -6.5, 1.75, -4.5);
  createWall(4.0, 3.5, 0.15, 6.5, 1.75, -4.5);
  createWall(5.0, 3.5, 0.15, 12.5, 1.75, -4.5);

  // Sur (z = +4.5), con puertas
  createWall(5.0, 3.5, 0.15, -12.5, 1.75, 4.5);
  createWall(4.0, 3.5, 0.15, -6.5, 1.75, 4.5);
  createWall(4.0, 3.5, 0.15, 6.5, 1.75, 4.5);
  createWall(5.0, 3.5, 0.15, 12.5, 1.75, 4.5);

  // Tabiques verticales Este/Oeste del espacio central
  createWall(0.15, 3.5, 6.5, -4.5, 1.75, -7.75);
  createWall(0.15, 3.5, 6.5, 4.5, 1.75, -7.75);
  createWall(0.15, 3.5, 6.5, -4.5, 1.75, 7.75);
  createWall(0.15, 3.5, 6.5, 4.5, 1.75, 7.75);

  // 3. Independent Desks & Chairs (Improved scale: 1.9m width x 0.95m depth)
  function createDesk(id, name, x, z, rotY = 0, isWood = false) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;

    const topMat = isWood ? darkWoodMat : woodDeskMat;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.06, 0.95), topMat);
    top.position.y = 0.76;
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);

    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.76, 0.85), metalDeskMat);
    leg1.position.set(-0.85, 0.38, 0);
    leg1.castShadow = true;
    g.add(leg1);
    const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.76, 0.85), metalDeskMat);
    leg2.position.set(0.85, 0.38, 0);
    leg2.castShadow = true;
    g.add(leg2);

    // Monitor realista: base plana + cuello + bisel + pantalla emisiva
    const mBase = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.2), metalDeskMat);
    mBase.position.set(0, 0.79, -0.24);
    g.add(mBase);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), metalDeskMat);
    neck.position.set(0, 0.9, -0.28);
    g.add(neck);
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.44, 0.035), new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.35, metalness: 0.5 }));
    bezel.position.set(0, 1.14, -0.24);
    bezel.castShadow = true;
    g.add(bezel);
    const display = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.37), screenMat);
    display.position.set(0, 1.14, -0.219);
    g.add(display);

    // Teclado bicolor con teclas + mouse
    const keyboard = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.02, 0.14), new THREE.MeshStandardMaterial({ color: 0xd8dbe2, roughness: 0.5 }));
    keyboard.position.set(0, 0.80, 0.12);
    g.add(keyboard);
    const keys = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.012, 0.09), new THREE.MeshStandardMaterial({ color: 0x2b2f3a }));
    keys.position.set(0, 0.812, 0.12);
    g.add(keys);
    const mouse = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd8dbe2, roughness: 0.4 }));
    mouse.scale.set(1, 0.55, 1.4);
    mouse.position.set(0.36, 0.81, 0.12);
    g.add(mouse);

    // Panel trasero (modesty panel)
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.035), topMat);
    backPanel.position.set(0, 0.48, -0.42);
    g.add(backPanel);

    // Cajonera bajo la mesa
    const drawerUnit = new THREE.Group();
    const duBody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.58, 0.6), new THREE.MeshStandardMaterial({ color: 0x33383f, roughness: 0.5, metalness: 0.3 }));
    duBody.position.y = 0.29;
    duBody.castShadow = true;
    drawerUnit.add(duBody);
    for (let d = 0; d < 3; d++) {
      const dh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.03), metalDeskMat);
      dh.position.set(0, 0.14 + d * 0.18, 0.31);
      drawerUnit.add(dh);
    }
    drawerUnit.position.set(0.65, 0, 0);
    g.add(drawerUnit);

    // Torre de PC debajo de la mesa
    const tower = new THREE.Group();
    const tBody = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 0.42), new THREE.MeshStandardMaterial({ color: 0x181b21, roughness: 0.3, metalness: 0.6 }));
    tBody.position.y = 0.21;
    tBody.castShadow = true;
    tower.add(tBody);
    const powerBtn = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.01), new THREE.MeshBasicMaterial({ color: 0x66ff99 }));
    powerBtn.position.set(0.05, 0.36, 0.215);
    tower.add(powerBtn);
    serverLedMaterials.push(powerBtn.material);
    tower.position.set(-0.72, 0, 0.05);
    g.add(tower);

    officeGroup.add(g);
    registerSelectable(id, name, g, 'furniture');
    return g;
  }

  function createChair(id, name, x, z, rotY = 0) {
    const chair = new THREE.Group();
    chair.position.set(x, 0, z);
    chair.rotation.y = rotY;

    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), chairMat);
    seat.position.y = 0.48;
    seat.castShadow = true;
    chair.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.54, 0.06), chairMat);
    back.position.set(0, 0.76, 0.23);
    back.castShadow = true;
    chair.add(back);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.44, 8), metalDeskMat);
    stem.position.y = 0.22;
    chair.add(stem);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 5), metalDeskMat);
    base.position.y = 0.04;
    chair.add(base);

    officeGroup.add(chair);
    registerSelectable(id, name, chair, 'furniture');
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

  // Acoustic Privacy Divider
  const divider = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.45, 0.06), new THREE.MeshStandardMaterial({ color: 0x4a7bb0, roughness: 0.9 }));
  divider.position.set(0, 1.02, 0);
  officeGroup.add(divider);

  // ===== Mobiliario del espacio central ampliado =====

  // Alfombra central (solo visual, sin colisión)
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(7.5, 7.5),
    new THREE.MeshStandardMaterial({ color: 0x4c5568, roughness: 0.95 })
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.012, 0);
  rug.receiveShadow = true;
  officeGroup.add(rug);

  // Escritorios extra lado oeste
  // Rotadas 180° (pantalla mirando a la silla)
  createDesk('desk5', 'Escritorio 5', -3.4, -1.6, Math.PI / 2);
  createDesk('desk6', 'Escritorio 6', -3.4, 1.6, Math.PI / 2);
  // Sillas del lado este de las mesas (lado del teclado), mirando a la PC
  createChair('chair5', 'Silla Oficina 5', -2.7, -1.6, Math.PI / 2);
  createChair('chair6', 'Silla Oficina 6', -2.7, 1.6, Math.PI / 2);

  // ===== Hilera ESTE (pasillo entre sala de juntas y oficina privada) =====
  // 3 puestos en columna, monitores hacia el este (+x), sillas al oeste mirando a la PC
  createDesk('deskE1', 'Escritorio Este 1', 6.3, -1.0, -Math.PI / 2);
  createChair('chairE1', 'Silla Este 1', 5.5, -1.0, Math.PI / 2);
  createDesk('deskE2', 'Escritorio Este 2', 6.3, 1.0, -Math.PI / 2);
  createChair('chairE2', 'Silla Este 2', 5.5, 1.0, Math.PI / 2);
  createDesk('deskE3', 'Escritorio Este 3', 6.3, 3.0, -Math.PI / 2);
  createChair('chairE3', 'Silla Este 3', 5.5, 3.0, Math.PI / 2);

  // ===== Hilera NORTE (pasillo entre sala de sistemas y sala de juntas) =====
  // Revertido al arreglo previo al de "8 pegados a la pared norte": las
  // originales (N1/N2 oeste, N3/N4 este) PEGADAS A LOS TABIQUES (x=±4.0,
  // espalda al muro, monitores al ambiente) y 4 del centro (N5-N8) enfrentados,
  // cada silla del lado del monitor.
  createDesk('deskN1', 'Escritorio Norte 1', -4.0, -7.5, Math.PI / 2);   // espalda tabique oeste, monitores al este
  createChair('chairN1', 'Silla Norte 1', -3.3, -7.5, Math.PI / 2);
  createDesk('deskN2', 'Escritorio Norte 2', -4.0, -8.5, Math.PI / 2);
  createChair('chairN2', 'Silla Norte 2', -3.3, -8.5, Math.PI / 2);
  createDesk('deskN3', 'Escritorio Norte 3', 4.0, -7.5, -Math.PI / 2);   // espalda tabique este, monitores al oeste
  createChair('chairN3', 'Silla Norte 3', 3.3, -7.5, -Math.PI / 2);
  createDesk('deskN4', 'Escritorio Norte 4', 4.0, -8.5, -Math.PI / 2);
  createChair('chairN4', 'Silla Norte 4', 3.3, -8.5, -Math.PI / 2);
  // Centro: espejo hacia el centro (enfrentados a los originales)
  createDesk('deskN5', 'Escritorio Norte 5', -0.45, -7.5, -Math.PI / 2);
  createChair('chairN5', 'Silla Norte 5', -1.15, -7.5, -Math.PI / 2);
  createDesk('deskN6', 'Escritorio Norte 6', -0.45, -8.5, -Math.PI / 2);
  createChair('chairN6', 'Silla Norte 6', -1.15, -8.5, -Math.PI / 2);
  createDesk('deskN7', 'Escritorio Norte 7', 0.45, -7.5, Math.PI / 2);
  createChair('chairN7', 'Silla Norte 7', 1.15, -7.5, Math.PI / 2);
  createDesk('deskN8', 'Escritorio Norte 8', 0.45, -8.5, Math.PI / 2);
  createChair('chairN8', 'Silla Norte 8', 1.15, -8.5, Math.PI / 2);

  // Sillones (área de descanso lado este)
  function createSofa(id, name, x, z, rotY = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;

    const fabric = new THREE.MeshStandardMaterial({ color: 0x3d6b5e, roughness: 0.95 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 0.8), fabric);
    base.position.y = 0.22;
    base.castShadow = true;
    g.add(base);

    const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.18), fabric);
    back.position.set(0, 0.6, 0.31);
    back.castShadow = true;
    g.add(back);

    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.8), fabric);
    armL.position.set(-0.9, 0.5, 0);
    g.add(armL);
    const armR = armL.clone();
    armR.position.x = 0.9;
    g.add(armR);

    const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.62), new THREE.MeshStandardMaterial({ color: 0x4a8071, roughness: 0.95 }));
    cushion.position.y = 0.44;
    g.add(cushion);

    officeGroup.add(g);
    registerSelectable(id, name, g, 'furniture');
    return g;
  }
  createSofa('sofa1', 'Sillón 1', 3.6, -1.4, Math.PI / 2);
  createSofa('sofa2', 'Sillón 2', 3.6, 1.4, Math.PI / 2);
  // Sillones pegados a paredes blancas reales (respaldo apoyado, como la puerta):
  // el respaldo local +z queda contra la cara interior de la pared
  createSofa('sofa3', 'Sillón 3', -6.5, -4.12, Math.PI);  // tabique norte (segmento oeste), mira al sur
  createSofa('sofa4', 'Sillón 4', 6.0, 4.12, 0);          // tabique sur (segmento este), mira al norte
  createSofa('sofa5', 'Sillón 5', 4.12, 7.5, Math.PI / 2); // tabique este del espacio central, mira al oeste

  // Mesita de centro de los sillones
  const coffeeTable = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.42, 16), darkWoodMat);
  coffeeTable.position.set(3.0, 0.21, 0);
  coffeeTable.castShadow = true;
  officeGroup.add(coffeeTable);
  registerSelectable('coffeeTable', 'Mesita de Centro', coffeeTable, 'furniture');

  // Plantas de interior
  function createPlant(id, name, x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);

    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.35, 12), new THREE.MeshStandardMaterial({ color: 0x8a5a3b, roughness: 0.8 }));
    pot.position.y = 0.17;
    pot.castShadow = true;
    g.add(pot);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d43, roughness: 0.9 });
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.7, 5), leafMat);
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
  createPlant('plant1', 'Planta 1', -4.0, -4.0);
  createPlant('plant2', 'Planta 2', 4.0, -4.0);
  createPlant('plant3', 'Planta 3', -4.0, 4.0);
  createPlant('plant4', 'Planta 4', 4.0, 3.7);
  createPlant('plant5', 'Planta 5', -4.0, -2.2);
  createPlant('plant6', 'Planta 6', 0.2, 4.05);

  // Archiveros (lado sur)
  function createFileCabinet(id, name, x, z, rotY = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.35, 0.55), new THREE.MeshStandardMaterial({ color: 0x9aa3b2, roughness: 0.4, metalness: 0.6 }));
    body.position.y = 0.68;
    body.castShadow = true;
    g.add(body);

    const drawerMat = new THREE.MeshStandardMaterial({ color: 0x7d8798, roughness: 0.35, metalness: 0.7 });
    for (let i = 0; i < 3; i++) {
      const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.36, 0.04), drawerMat);
      drawer.position.set(0, 0.32 + i * 0.38, 0.29);
      g.add(drawer);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.03), metalDeskMat);
      handle.position.set(0, 0.42 + i * 0.38, 0.32);
      g.add(handle);
    }

    officeGroup.add(g);
    registerSelectable(id, name, g, 'furniture');
    return g;
  }
  createFileCabinet('cabinet1', 'Archivero 1', 2.9, 4.05, 0);
  createFileCabinet('cabinet2', 'Archivero 2', 3.7, 4.05, 0);

  // Fotocopiadora (contra el tabique oeste)
  function createCopier(id, name, x, z, rotY = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.95, 0.85), new THREE.MeshStandardMaterial({ color: 0xd8dade, roughness: 0.35 }));
    body.position.y = 0.48;
    body.castShadow = true;
    g.add(body);

    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.7), new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 0.3 }));
    lid.position.set(0, 0.99, 0);
    g.add(lid);

    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.03), new THREE.MeshStandardMaterial({ color: 0x14181f, emissive: 0x2a6db5, emissiveIntensity: 0.5 }));
    panel.position.set(0, 0.78, 0.44);
    g.add(panel);

    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.03, 0.25), metalDeskMat);
    tray.position.set(0, 0.6, 0.5);
    g.add(tray);

    officeGroup.add(g);
    registerSelectable(id, name, g, 'furniture');
    return g;
  }

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
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.4, 0.9), rackFrameMat);
    frame.position.y = 1.2;
    frame.castShadow = true;
    frame.receiveShadow = true;
    rack.add(frame);

    // Postes verticales frontales de montaje (rails)
    [-0.42, 0.42].forEach(rx => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.28, 0.05), rackDarkMat);
      rail.position.set(rx, 1.2, 0.42);
      rack.add(rail);
    });

    // ===== Unidades (de arriba hacia abajo) =====
    // 1) Patch panel 24 puertos (2U) arriba
    const patchPanel = new THREE.Mesh(new THREE.BoxGeometry(0.88, ru * 2, 0.1), rackDarkMat);
    patchPanel.position.set(0, 2.26, 0.42);
    rack.add(patchPanel);
    for (let p = -0.38; p <= 0.38; p += 0.034) {
      const port = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.045, 0.03), patchPortMat);
      port.position.set(p, 2.26, 0.475);
      rack.add(port);
    }
    // Ranura de patch cable vertical (organizador)
    const patchSpool = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.02, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xd8a72f, roughness: 0.6 }));
    patchSpool.rotation.x = Math.PI / 2;
    patchSpool.position.set(-0.42, 2.12, 0.44);
    rack.add(patchSpool);

    // 2) Switch 24-puertos gestionable (1U)
    const switchS = new THREE.Mesh(new THREE.BoxGeometry(0.88, ru, 0.44), switchBodyMat);
    switchS.position.set(0, 2.02, 0.42);
    rack.add(switchS);
    for (let p = -0.36; p <= 0.3; p += 0.034) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.015), new THREE.MeshBasicMaterial({ color: 0x222222 }));
      sp.position.set(p, 2.03, 0.645);
      rack.add(sp);
      const sl = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.008, 0.005), new THREE.MeshBasicMaterial({ color: 0x00ff66 }));
      sl.position.set(p, 2.07, 0.645);
      rack.add(sl);
      serverLedMaterials.push(sl.material);
    }
    // LED de estado del switch
    const switchLed = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.01), new THREE.MeshBasicMaterial({ color: 0x33ccff }));
    switchLed.position.set(0.4, 2.07, 0.645);
    rack.add(switchLed);
    serverLedMaterials.push(switchLed.material);

    // 3) Blades de servidor (bahías con frente detallado), 4 unidades
    const bladeYs = [1.75, 1.5, 1.25, 1.0];
    bladeYs.forEach((by, bi) => {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.86, ru * 2.5, 0.5), rackBladeMat);
      blade.position.set(0, by, 0.42);
      blade.castShadow = true;
      rack.add(blade);
      // Frente con 4 bahías de disco
      for (let hh = 0; hh < 2; hh++) {
        for (let vv = 0; vv < 2; vv++) {
          const bay = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.03),
            new THREE.MeshStandardMaterial({ color: 0x0e1116, roughness: 0.4, metalness: 0.7 }));
          bay.position.set(-0.2 + vv * 0.4, by - 0.04 + hh * 0.09, 0.66);
          rack.add(bay);
        }
      }
      // LED de actividad por blade
      const bLed = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.008), new THREE.MeshBasicMaterial({ color: bi % 2 ? 0xffcc33 : 0x00ff88 }));
      bLed.position.set(0.32, by + 0.06, 0.67);
      rack.add(bLed);
      serverLedMaterials.push(bLed.material);
      // Cable de red desde el blade (tramo corto hacia el patch panel)
      const patchCable = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.25, 0.012),
        new THREE.MeshStandardMaterial({ color: [0x2f6fd8, 0xd8a72f, 0xd83f3f, 0x2f6fd8][bi % 4], roughness: 0.7 }));
      patchCable.position.set(-0.42, by + 0.03, 0.7);
      rack.add(patchCable);
    });

    // 4) UPS (3U) en la parte baja
    const ups = new THREE.Mesh(new THREE.BoxGeometry(0.86, ru * 3, 0.5), new THREE.MeshStandardMaterial({ color: 0x23262d, metalness: 0.5, roughness: 0.5 }));
    ups.position.set(0, 0.2, 0.42);
    rack.add(ups);
    const upsScreen = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.02), new THREE.MeshStandardMaterial({ color: 0x080c12, emissive: 0x33ff66, emissiveIntensity: 0.6 }));
    upsScreen.position.set(-0.15, 0.28, 0.68);
    rack.add(upsScreen);
    serverLedMaterials.push(upsScreen.material);
    for (let uo = -1; uo <= 1; uo++) {
      const out = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.02), new THREE.MeshStandardMaterial({ color: 0x44484f, metalness: 0.6 }));
      out.position.set(0.25 + uo * 0.08, 0.16, 0.68);
      rack.add(out);
    }

    // 5) Base con ruedas
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.06, 0.88), rackDarkMat);
    base.position.y = 0.06;
    base.castShadow = true;
    rack.add(base);
    [[-0.42, -0.38], [0.42, -0.38], [-0.42, 0.38], [0.42, 0.38]].forEach(([cx, cz]) => {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.025, 8, 14),
        new THREE.MeshStandardMaterial({ color: 0x0e1013, roughness: 0.8 }));
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(cx, 0.03, cz);
      rack.add(wheel);
    });

    // Organizador vertical de cables (corrida lateral, todo el alto)
    const vOrganizer = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 0.06), rackDarkMat);
    vOrganizer.position.set(0.52, 1.2, 0.35);
    vOrganizer.castShadow = true;
    rack.add(vOrganizer);
    // Cables de colores que bajan por el organizador
    [0x2f6fd8, 0xd8a72f, 0xd83f3f].forEach((cc, ci) => {
      const vCable = new THREE.Mesh(new THREE.BoxGeometry(0.012, 2.2, 0.012),
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

    const fwBody = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.28, 0.48),
      new THREE.MeshStandardMaterial({ color: 0x1e2229, metalness: 0.6, roughness: 0.35 }));
    fwBody.position.y = 0.65;
    fwBody.castShadow = true;
    g.add(fwBody);

    // Frente con puertos y LEDs de estado (verde = tráfico seguro, rojo = alerta)
    for (let p = -0.23; p <= 0.23; p += 0.058) {
      const port = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.03, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x0e1116, metalness: 0.7 }));
      port.position.set(p, 0.66, 0.245);
      g.add(port);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.01, 0.005),
        new THREE.MeshBasicMaterial({ color: (p * 100) % 3 === 0 ? 0xff4433 : 0x00ff88 }));
      led.position.set(p, 0.7, 0.25);
      g.add(led);
      serverLedMaterials.push(led.material);
    }
    // Pantallita LCD de monitoreo
    const lcd = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x06120a, emissive: 0x33ff66, emissiveIntensity: 0.7 }));
    lcd.position.set(0, 0.81, 0.24);
    g.add(lcd);
    serverLedMaterials.push(lcd.material);

    // Patas
    [[-0.26, -0.18], [0.26, -0.18], [-0.26, 0.18], [0.26, 0.18]].forEach(([fx, fz]) => {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 8),
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
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.55),
      rackDarkMat);
    base.position.y = 0.05;
    base.castShadow = true;
    g.add(base);
    [[-0.38, -0.2], [0.38, -0.2], [-0.38, 0.2], [0.38, 0.2]].forEach(([cx, cz]) => {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.02, 8, 12),
        new THREE.MeshStandardMaterial({ color: 0x0e1013, roughness: 0.8 }));
      wheel.rotation.y = Math.PI / 2;
      wheel.position.set(cx, 0.025, cz);
      g.add(wheel);
    });
    const column = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.05), rackDarkMat);
    column.position.y = 0.35;
    g.add(column);

    // Bandeja con teclado
    const trayK = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.03, 0.4), new THREE.MeshStandardMaterial({ color: 0x2b2f3a, metalness: 0.7 }));
    trayK.position.set(0, 0.68, 0.08);
    g.add(trayK);
    const keyboardK = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.02, 0.26),
      new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.5 }));
    keyboardK.position.set(0, 0.7, 0.08);
    g.add(keyboardK);

    // Monitor KVM sobre el carrito
    const monK = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.42, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.35 }));
    monK.position.set(0, 1.0, -0.02);
    monK.castShadow = true;
    g.add(monK);
    const scK = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x05140b, emissive: 0x1f7a4a, emissiveIntensity: 0.4 }));
    scK.position.set(0, 1.0, 0.0);
    g.add(scK);
    const neckK = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.25, 0.05), metalDeskMat);
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
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.42, 12), red);
    body.position.y = 0.35;
    body.castShadow = true;
    g.add(body);
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.08, 12), red);
    shoulder.position.y = 0.6;
    g.add(shoulder);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 }));
    handle.position.set(0, 0.68, -0.02);
    g.add(handle);
    const hose = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.015, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }));
    hose.position.set(0.04, 0.35, 0.05);
    g.add(hose);

    // Soporte de pared
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x8a929e, metalness: 0.6 }));
    bracket.position.set(0, 0.32, -0.04);
    g.add(bracket);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.16),
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
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.32, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x24313f, roughness: 0.4 }));
    g.add(sign);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x1a2530, emissive: 0x2a6bb5, emissiveIntensity: 0.5 }));
    plate.position.z = 0.03;
    g.add(plate);
    // Icono de escudo (ciberseguridad) + LED
    const iconBg = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16),
      new THREE.MeshStandardMaterial({ color: 0xd83f2f, roughness: 0.5 }));
    iconBg.position.set(-0.22, 0, 0.035);
    g.add(iconBg);
    const lockIcon = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.01),
      new THREE.MeshStandardMaterial({ color: 0xf5f2e8 }));
    lockIcon.position.set(-0.22, 0.01, 0.045);
    g.add(lockIcon);
    const arcIcon = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 6, 14),
      new THREE.MeshStandardMaterial({ color: 0xf5f2e8 }));
    arcIcon.position.set(-0.22, 0.03, 0.045);
    g.add(arcIcon);
    const sigLed = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.01),
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
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.45, 0.45), rackMat);
    chassis.position.set(-0.7, 0.24, 0);
    chassis.castShadow = true;
    pcTop.add(chassis);
    const ledPc = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.01), new THREE.MeshBasicMaterial({ color: 0x66ff99 }));
    ledPc.position.set(-0.65, 0.40, 0.23);
    pcTop.add(ledPc);
    serverLedMaterials.push(ledPc.material);
    const mon = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.36, 0.04), new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.35 }));
    mon.position.set(0.25, 0.60, -0.16);
    mon.castShadow = true;
    pcTop.add(mon);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.30), screenMat);
    scr.position.set(0.25, 0.60, -0.135);
    pcTop.add(scr);
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.14), new THREE.MeshStandardMaterial({ color: 0xd8dbe2, roughness: 0.5 }));
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
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.9, 0.4), shelfMat);
      post.position.set(px, 0.95, 0);
      post.castShadow = true;
      g.add(post);
    });
    [0.35, 0.85, 1.35, 1.85].forEach(by => {
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.4), shelfMat);
      board.position.set(0, by, 0);
      g.add(board);
    });
    // Cajas de repuestos y bobinas de cable sobre las bandejas
    const boxColors = [0xb8563a, 0x3a6ab8, 0x3ab86a, 0xb8a23a];
    for (let s = 0; s < 3; s++) {
      for (let b = 0; b < 3; b++) {
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(0.28, 0.22, 0.26),
          new THREE.MeshStandardMaterial({ color: boxColors[(s * 3 + b) % 4], roughness: 0.7 })
        );
        box.position.set(-0.5 + b * 0.5, 0.37 + s * 0.5, 0);
        box.castShadow = true;
        g.add(box);
      }
    }
    [-0.4, 0.4].forEach(cx => {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 8, 20),
        new THREE.MeshStandardMaterial({ color: 0xd8a72f, roughness: 0.6 }));
      coil.position.set(cx, 1.44, 0);
      g.add(coil);
    });
    officeGroup.add(g);
    registerSelectable(id, name, g, 'furniture');
  }
  // Estantes movidos a la pared ESTE del espacio central (junto a la puerta
  // de entrada), apoyados en la pared real x=15
  createShelfUnit('shelfSR1', '📦 Estante Repuestos 1', 14.7, 7.0, Math.PI);
  createShelfUnit('shelfSR2', '📦 Estante Repuestos 2', 14.7, 8.4, Math.PI);

  // Pared de herramientas (tablón perforado con herramientas colgadas,
  // cables y cajones de repuestos) — pared oeste de la sala
  const toolBoard = new THREE.Group();
  toolBoard.position.set(-14.84, 1.6, -6.8);
  toolBoard.rotation.y = Math.PI / 2;
  const pegMat = new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 0.7 });
  const pegboard = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.5, 0.06), pegMat);
  toolBoard.add(pegboard);
  // Herramientas: llaves (forma simple), destornilladores y martillo
  const toolSteel = new THREE.MeshStandardMaterial({ color: 0xb9c0c9, roughness: 0.25, metalness: 0.85 });
  const toolRed = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 });
  [[-1.0, 0.35], [-0.6, 0.35], [-0.2, 0.35]].forEach(([tx, ty], i) => {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.34, 8), i === 2 ? toolRed : new THREE.MeshStandardMaterial({ color: 0x8a5a3b, roughness: 0.6 }));
    handle.position.set(tx, ty, 0.05);
    toolBoard.add(handle);
    const head = new THREE.Mesh(new THREE.BoxGeometry(i === 2 ? 0.22 : 0.09, 0.07, 0.04), toolSteel);
    head.position.set(tx, ty + 0.21, 0.05);
    toolBoard.add(head);
  });
  // Bobinas de cable colgadas (colores literales: cableMats aún no existe aquí)
  [-1.15, -0.75, 0.9, 1.25].forEach((cx, i) => {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.03, 8, 20),
      new THREE.MeshStandardMaterial({ color: [0x2f6fd8, 0xd8a72f, 0xd83f3f][i % 3], roughness: 0.6 }));
    coil.position.set(cx, -0.35, 0.06);
    toolBoard.add(coil);
  });
  // Cajones organizadores de repuestos
  for (let bx = 0; bx < 4; bx++) {
    const bin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x274e6d, roughness: 0.6 }));
    bin.position.set(-0.35 + bx * 0.32, -0.42, 0.08);
    toolBoard.add(bin);
  }
  // Mesa pequeña bajo el tablón con caja de herramientas
  const toolTable = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 0.7), woodDeskMat);
  toolTable.position.set(0, 0.74, 0.35);
  toolTable.castShadow = true;
  toolBoard.add(toolTable);
  [[-0.9], [0.9]].forEach(([lx]) => {
    const legT = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.74, 0.6), metalDeskMat);
    legT.position.set(lx, 0.37, 0.35);
    toolBoard.add(legT);
  });
  const toolbox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.28),
    new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.4, metalness: 0.3 }));
  toolbox.position.set(-0.4, 0.88, 0.35);
  toolbox.castShadow = true;
  toolBoard.add(toolbox);
  const trayParts = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x33383f, roughness: 0.6 }));
  trayParts.position.set(0.5, 0.81, 0.35);
  toolBoard.add(trayParts);
  officeGroup.add(toolBoard);
  registerSelectable('toolWall', '🔧 Pared de Herramientas', toolBoard, 'furniture');

  // 5. Multipurpose Empty Work Table (for IT lab)
  function createEmptyTable(id, name, x, z, rotY = 0) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;

    const top = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 1.1), woodDeskMat);
    top.position.y = 0.76;
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);

    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.76, 1.0), metalDeskMat);
    leg1.position.set(-1.0, 0.38, 0);
    leg1.castShadow = true;
    g.add(leg1);
    const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.76, 1.0), metalDeskMat);
    leg2.position.set(1.0, 0.38, 0);
    leg2.castShadow = true;
    g.add(leg2);

    officeGroup.add(g);
    registerSelectable(id, name, g, 'furniture');
    return g;
  }

  // Mesa de trabajo IT movida al lado de la puerta de entrada (espacio este,
  // entre la puerta y la pared sur): quien entra se sienta (silla al norte)
  // y mira hacia la pared sur (z=+11). La mesa mira a la pared (tablero en
  // local -z hacia el norte, silla en local +z hacia el sur).
  createEmptyTable('emptyTable', 'Mesa de Trabajo IT', 3.5, 8.9, 0);
  createChair('chairIT', 'Silla Puesto IT', 3.5, 8.2, Math.PI);

  // 6. Conference Room Table & 6 Individual Chairs
  const confTable = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.08, 1.9), darkWoodMat);
  confTable.position.set(11.5, 0.74, -7.0); // cerca de la TV (pared este)
  confTable.castShadow = true;
  officeGroup.add(confTable);
  registerSelectable('confTable', 'Mesa de Juntas', confTable, 'furniture');

  // Sillas mirando HACIA la mesa (las del lado norte miran al sur y viceversa)
  createChair('confChair1', 'Silla Junta 1', 10.0, -6.0, 0);
  createChair('confChair2', 'Silla Junta 2', 11.5, -6.0, 0);
  createChair('confChair3', 'Silla Junta 3', 13.0, -6.0, 0);
  createChair('confChair4', 'Silla Junta 4', 10.0, -8.0, Math.PI);
  createChair('confChair5', 'Silla Junta 5', 11.5, -8.0, Math.PI);
  createChair('confChair6', 'Silla Junta 6', 13.0, -8.0, Math.PI);

  // Big TV Screen (pared este de la oficina de juntas, mirando al oeste)
  const tvScreen = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.8, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x111622, emissive: 0x2e64b6, emissiveIntensity: 0.5 })
  );
  tvScreen.position.set(14.82, 2.0, -7.0);
  tvScreen.rotation.y = -Math.PI / 2;
  officeGroup.add(tvScreen);
  const tvFrame = new THREE.Mesh(
    new THREE.BoxGeometry(3.36, 1.96, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.3 })
  );
  tvFrame.position.set(14.86, 2.0, -7.0);
  tvFrame.rotation.y = -Math.PI / 2;
  officeGroup.add(tvFrame);

  // Private Office Desk (oficina este)
  createDesk('privateDesk', 'Escritorio Privado', 8.5, 7.5, 0, false);
  createChair('privateChair', 'Silla Privada', 8.5, 6.8, Math.PI);

  // ==========================================
  // OFICINA DEL JEFE (SO, frente a la sala de sistemas) — con onda
  // ==========================================
  const bossGroup = new THREE.Group();
  officeGroup.add(bossGroup);
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x4a2c1a, roughness: 0.35, metalness: 0.05 });
  const leatherLightMat = new THREE.MeshStandardMaterial({ color: 0x5d3a24, roughness: 0.4 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.3, metalness: 0.85 });

  // Alfombra grande de la oficina
  const bossRug = new THREE.Mesh(
    new THREE.PlaneGeometry(6.5, 5.0),
    new THREE.MeshStandardMaterial({ color: 0x5b2333, roughness: 0.95 })
  );
  bossRug.rotation.x = -Math.PI / 2;
  bossRug.position.set(-9.5, 0.022, 8.0);
  bossRug.receiveShadow = true;
  bossGroup.add(bossRug);
  const rugBorder = new THREE.Mesh(
    new THREE.PlaneGeometry(6.9, 5.4),
    new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.8 })
  );
  rugBorder.rotation.x = -Math.PI / 2;
  rugBorder.position.set(-9.5, 0.006, 8.0);
  rugBorder.receiveShadow = true;
  bossGroup.add(rugBorder);

  // Escritorio ejecutivo GRANDE (2.8 m, madera oscura con tapa de cuero)
  const bigDesk = new THREE.Group();
  bigDesk.position.set(-9.0, 0, 8.4);
  bigDesk.rotation.y = 0; // monitores hacia el norte, el jefe se sienta al sur
  const bdTop = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.09, 1.3), darkWoodMat);
  bdTop.position.y = 0.78;
  bdTop.castShadow = true; bdTop.receiveShadow = true;
  bigDesk.add(bdTop);
  const bdPad = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.02, 0.7), leatherMat);
  bdPad.position.set(0, 0.83, 0.15);
  bigDesk.add(bdPad);
  // Frente ejecutivo (panel alto con paneles)
  const bdFront = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.72, 0.08), darkWoodMat);
  bdFront.position.set(0, 0.40, -0.60);
  bdFront.castShadow = true;
  bigDesk.add(bdFront);
  [-0.9, 0, 0.9].forEach(px => {
    const mold = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.02), leatherLightMat);
    mold.position.set(px, 0.40, -0.555);
    bigDesk.add(mold);
  });
  // Laterales con cajonera doble
  [-1.32, 1.32].forEach(sx => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.74, 1.2), darkWoodMat);
    side.position.set(sx, 0.37, 0);
    side.castShadow = true;
    bigDesk.add(side);
  });
  // Cajoneras bajo la tapa, bien dentro del escritorio (frente hacia el sur)
  for (let d = 0; d < 3; d++) {
    const dr = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.03), leatherLightMat);
    dr.position.set(1.0, 0.18 + d * 0.22, 0.60);
    bigDesk.add(dr);
    const hd = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.02), goldMat);
    hd.position.set(1.0, 0.18 + d * 0.22, 0.62);
    bigDesk.add(hd);
  }
  // Monitor grande dual + lámpara + teléfono
  [-0.45, 0.45].forEach(mx => {
    const bez = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.48, 0.04), new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.35 }));
    bez.position.set(mx, 1.28, -0.30);
    bez.castShadow = true;
    bigDesk.add(bez);
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.70, 0.40), screenMat);
    disp.position.set(mx, 1.28, -0.275);
    bigDesk.add(disp);
    const neckM = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.06), metalDeskMat);
    neckM.position.set(mx, 0.96, -0.32);
    bigDesk.add(neckM);
  });
  // Lámpara de escritorio clásica (base + vástago + brazo articulado +
  // pantalla de tela con bombilla emisiva)
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.03, 16), goldMat);
  lampBase.position.set(1.05, 0.84, -0.35);
  lampBase.castShadow = true;
  bigDesk.add(lampBase);
  const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 10), goldMat);
  lampStem.position.set(1.05, 1.0, -0.35);
  bigDesk.add(lampStem);
  const lampArmH = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.38, 10), goldMat);
  lampArmH.rotation.z = Math.PI / 2;
  lampArmH.position.set(1.05, 1.14, -0.52);
  bigDesk.add(lampArmH);
  const lampArmV = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 10), goldMat);
  lampArmV.position.set(1.05, 1.24, -0.55);
  bigDesk.add(lampArmV);
  // Pantalla de tela (cónica, ánima hacia abajo sobre el escritorio)
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0x2e6b46, roughness: 0.6, side: THREE.DoubleSide, emissive: 0xffe08a, emissiveIntensity: 0.6 });
  const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.05, 0.16, 14, 1, true), shadeMat);
  lampShade.position.set(1.05, 1.33, -0.58);
  bigDesk.add(lampShade);
  // Bombilla emisiva dentro de la pantalla
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10), new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffdd88, emissiveIntensity: 1.2 }));
  bulb.position.set(1.05, 1.26, -0.58);
  bigDesk.add(bulb);
  const phone = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.18), new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.4 }));
  phone.position.set(-1.0, 0.84, 0.3);
  bigDesk.add(phone);
  bossGroup.add(bigDesk);
  registerSelectable('execDesk', 'Escritorio Gerencia', bigDesk, 'furniture');

  // REGLA DE ORIENTACIÓN (SKILL.md): el monitor está en local -z y la persona
  // se sienta del lado opuesto al bisel (local +z). El escritorio está en
  // z=8.4 con los monitores hacia el norte (-z global), por lo que el jefe
  // se sienta al SUR (z>9.05) mirando hacia los monitores (rotY=0).
  // Silla ejecutiva de capitoné imponente (asiento grande, respaldo alto con
  // botones dorados, apoyabrazos acolchados y base de 5 patas con ruedas)
  const execChairG = new THREE.Group();
  execChairG.position.set(-9.0, 0, 9.6);
  execChairG.rotation.y = 0; // mirando al norte (monitores)
  // Asiento grande acolchado con cojín
  const ecSeat = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.14, 0.68), leatherMat);
  ecSeat.position.y = 0.54; ecSeat.castShadow = true;
  execChairG.add(ecSeat);
  const ecCush = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.06, 0.6), leatherLightMat);
  ecCush.position.y = 0.62;
  execChairG.add(ecCush);
  // Respaldo alto de capitoné con cabecera
  const ecBack = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.1, 0.12), leatherMat);
  ecBack.position.set(0, 1.15, 0.34); ecBack.castShadow = true;
  execChairG.add(ecBack);
  // Capitoné: botones dorados (3 columnas x 4 filas)
  for (let c = -1; c <= 1; c++) {
    for (let r = 0; r < 4; r++) {
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), goldMat);
      btn.position.set(c * 0.22, 0.85 + r * 0.22, 0.405);
      execChairG.add(btn);
    }
  }
  // Cabecera acolchada superior
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.16, 0.1), leatherLightMat);
  head.position.set(0, 1.72, 0.34);
  execChairG.add(head);
  // Apoyabrazos acolchados
  [-0.42, 0.42].forEach(sx => {
    const armLift = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.12), goldMat);
    armLift.position.set(sx, 0.72, 0.1);
    execChairG.add(armLift);
    const armPad = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.55), leatherLightMat);
    armPad.position.set(sx, 0.86, 0.08);
    execChairG.add(armPad);
  });
  // Vástago y base de 5 patas con ruedas
  const ecStem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.42, 10), goldMat);
  ecStem.position.y = 0.3;
  execChairG.add(ecStem);
  const ecHub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 10), goldMat);
  ecHub.position.y = 0.09;
  execChairG.add(ecHub);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const px = Math.cos(a) * 0.3, pz = Math.sin(a) * 0.3;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.34), goldMat);
    leg.position.set(px * 0.5, 0.035, pz * 0.5);
    leg.rotation.y = -a;
    execChairG.add(leg);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.015, 6, 12), new THREE.MeshStandardMaterial({ color: 0x0e1013, roughness: 0.8 }));
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(px, 0.035, pz);
    execChairG.add(wheel);
  }
  bossGroup.add(execChairG);
  registerSelectable('execChair', 'Silla Gerencia', execChairG, 'furniture');

  // Silla de invitado (al NORTE del escritorio, frente al jefe), para conversar
  // cara a cara: se sienta del lado del monitor mirando al sur (rotY=Math.PI).
  const guestChairG = new THREE.Group();
  guestChairG.position.set(-9.0, 0, 7.6);
  guestChairG.rotation.y = Math.PI; // mirando al sur (al jefe)
  const gcSeat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 0.6 }));
  gcSeat.position.y = 0.5; gcSeat.castShadow = true;
  guestChairG.add(gcSeat);
  const gcBack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.6, 0.07), new THREE.MeshStandardMaterial({ color: 0x33383f, roughness: 0.6 }));
  gcBack.position.set(0, 0.82, 0.26);
  gcBack.castShadow = true;
  guestChairG.add(gcBack);
  const gcStem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.46, 8), metalDeskMat);
  gcStem.position.y = 0.23;
  guestChairG.add(gcStem);
  const gcBase = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.04, 5), metalDeskMat);
  gcBase.position.y = 0.04;
  guestChairG.add(gcBase);
  bossGroup.add(guestChairG);
  registerSelectable('guestChair', 'Silla de Invitado', guestChairG, 'furniture');

  // Sillones Chesterfield (cuero marrón, respaldo capitoné y apoyabrazos enrollados)
  function createChester(id, name, x, z, rotY) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.38, 0.9), leatherMat);
    base.position.y = 0.24; base.castShadow = true;
    g.add(base);
    // Respaldo bajo y curvo con botones dorados (capitoné)
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 0.22), leatherMat);
    back.position.set(0, 0.62, 0.36); back.castShadow = true;
    g.add(back);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 6; c++) {
        const btn = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), goldMat);
        btn.position.set(-0.75 + c * 0.3, 0.48 + r * 0.22, 0.245);
        g.add(btn);
      }
    }
    // Apoyabrazos enrollados (cilindros horizontales)
    [-1.0, 1.0].forEach(ax => {
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.95, 10), leatherMat);
      roll.rotation.x = Math.PI / 2;
      roll.position.set(ax, 0.56, 0.05);
      roll.castShadow = true;
      g.add(roll);
    });
    const cush = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.68), leatherLightMat);
    cush.position.set(0, 0.47, -0.02);
    g.add(cush);
    // Patas cortas de madera
    [[-0.85, -0.3], [0.85, -0.3], [-0.85, 0.3], [0.85, 0.3]].forEach(([px, pz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.12, 8), darkWoodMat);
      leg.position.set(px, 0.06, pz);
      g.add(leg);
    });
    bossGroup.add(g);
    registerSelectable(id, name, g, 'furniture');
    return g;
  }
  createChester('bossSofa1', '🛋️ Chesterfield 1', -14.5, 6.6, -Math.PI / 2); // pared oeste, mira al este
  createChester('bossSofa2', '🛋️ Chesterfield 2', -11.8, 10.5, 0);          // pared sur (bajo las ventanas)

  // Mesa ratona de centro entre los chesterfields
  const bossTable = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.45, 20), darkWoodMat);
  bossTable.position.set(-13.0, 0.225, 8.6);
  bossTable.castShadow = true;
  bossGroup.add(bossTable);
  registerSelectable('bossTable', 'Mesa Ratona Gerencia', bossTable, 'furniture');

  // Planta grande de interior en la esquina NO de la oficina del jefe
  const bossPlant = new THREE.Group();
  bossPlant.position.set(-14.0, 0, 10.4);
  const bpPot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0x8a5a3b, roughness: 0.8 }));
  bpPot.position.y = 0.2; bpPot.castShadow = true;
  bossPlant.add(bpPot);
  const bpStem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.9, 8), new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 }));
  bpStem.position.y = 0.85;
  bossPlant.add(bpStem);
  const bpLeafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d43, roughness: 0.9 });
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), bpLeafMat);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.3, 1.25 + Math.sin(a) * 0.1, Math.sin(a) * 0.3);
    leaf.scale.set(0.7, 1.0, 0.7);
    leaf.castShadow = true;
    bossPlant.add(leaf);
  }
  for (let i = 0; i < 4; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshStandardMaterial({ color: 0x3b9b4f, roughness: 0.9 }));
    const a = (i / 4) * Math.PI * 2 + 0.3;
    leaf.position.set(Math.cos(a) * 0.18, 1.65 + Math.sin(a) * 0.08, Math.sin(a) * 0.18);
    leaf.scale.set(0.8, 1.0, 0.8);
    bossPlant.add(leaf);
  }
  bossGroup.add(bossPlant);
  registerSelectable('bossPlant', '🌿 Planta Gerencia', bossPlant, 'furniture');

  // Reloj de pared (pared sur de la oficina, entre las ventanas)
  const bossClock = new THREE.Group();
  bossClock.position.set(-9.5, 2.4, 10.86);
  const clockBody = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 18), goldMat);
  clockBody.rotation.x = Math.PI / 2;
  bossClock.add(clockBody);
  const clockFace = new THREE.Mesh(new THREE.CircleGeometry(0.19, 18), new THREE.MeshStandardMaterial({ color: 0xf5f2e8, roughness: 0.6 }));
  clockFace.position.z = 0.035;
  bossClock.add(clockFace);
  // 12 marcas horarias
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.005), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
    mark.position.set(Math.sin(a) * 0.15, Math.cos(a) * 0.15, 0.045);
    mark.rotation.z = -a;
    bossClock.add(mark);
  }
  // Agujas (hora y minuto apuntando hacia arriba)
  const hHand = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.005), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
  hHand.position.set(0, 0.05, 0.05);
  bossClock.add(hHand);
  const mHand = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.005), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
  mHand.position.set(0, 0.09, 0.052);
  bossClock.add(mHand);
  const clockHub = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.8 }));
  clockHub.position.z = 0.052;
  bossClock.add(clockHub);
  bossGroup.add(bossClock);
  registerSelectable('bossClock', '🕰️ Reloj de Pared', bossClock, 'furniture');

  // Cuadros con marco dorado (pared oeste y tabique norte de la oficina)
  function createPainting(id, name, x, y, z, rotY, w, h) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.05), goldMat);
    g.add(frame);
    const canvasP = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ color: [0x274e6d, 0x6d4a27, 0x3d5a3a][id.length % 3], roughness: 0.9 }));
    canvasP.position.z = 0.03;
    g.add(canvasP);
    // Motivo abstracto simple
    const blob = new THREE.Mesh(new THREE.CircleGeometry(Math.min(w, h) * 0.22, 16),
      new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.8 }));
    blob.position.set(w * 0.15, -h * 0.1, 0.035);
    g.add(blob);
    bossGroup.add(g);
    registerSelectable(id, name, g, 'prop');
  }
  createPainting('bossArt1', '🖼️ Cuadro 1', -14.86, 2.1, 8.6, Math.PI / 2, 1.1, 0.8);
  // Cuadro 3 sobre el tabique norte, DENTRO del tramo de pared (x -14.95..-10)
  createPainting('bossArt3', '🖼️ Cuadro 3', -11.5, 2.1, 4.59, 0, 1.3, 0.85);

  // WiFi propio de la oficina del jefe (pared oeste)
  createWallAP('ap4', '📶 AP WiFi Gerencia', -14.88, 7.5, Math.PI / 2);

  // Ventanas importantes (marco oscuro + vidrio celeste + travesaños)
  function createWindow(x, y, z, rotY, w, h) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), new THREE.MeshStandardMaterial({ color: 0x2b2f38, roughness: 0.4 }));
    g.add(frame);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.12, h - 0.12),
      new THREE.MeshPhysicalMaterial({ color: 0xbfe0ea, transparent: true, opacity: 0.5, roughness: 0.05, emissive: 0x9cc8dd, emissiveIntensity: 0.25 }));
    glass.position.z = 0.042;
    g.add(glass);
    const mullV = new THREE.Mesh(new THREE.BoxGeometry(0.05, h - 0.12, 0.03), new THREE.MeshStandardMaterial({ color: 0xdadfe6 }));
    mullV.position.z = 0.062;
    g.add(mullV);
    const mullH = new THREE.Mesh(new THREE.BoxGeometry(w - 0.12, 0.05, 0.03), new THREE.MeshStandardMaterial({ color: 0xdadfe6 }));
    mullH.position.z = 0.062;
    g.add(mullH);
    bossGroup.add(g);
  }
  createWindow(-12.0, 2.1, 10.87, 0, 2.4, 1.6);   // pared sur
  createWindow(-7.0, 2.1, 10.87, 0, 2.4, 1.6);    // pared sur
  createWindow(-14.87, 2.1, 9.8, Math.PI / 2, 2.0, 1.6); // pared oeste

  // Barra de bebidas propia (contra el tabique norte de la oficina)
  const bar = new THREE.Group();
  bar.position.set(-12.3, 0, 5.15);
  const barBody = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 0.6), darkWoodMat);
  barBody.position.y = 0.5; barBody.castShadow = true;
  bar.add(barBody);
  const barTop = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.06, 0.75), new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.25 }));
  barTop.position.y = 1.03;
  bar.add(barTop);
  const barRail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.6, 8), goldMat);
  barRail.rotation.z = Math.PI / 2;
  barRail.position.set(0, 0.92, 0.42);
  bar.add(barRail);
  // Botellas y vasos sobre la barra
  const bottleColors = [0x7a1f1f, 0x1f4a7a, 0x2a6b33, 0xb8860b, 0x4a235a];
  for (let b = 0; b < 5; b++) {
    const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.3, 10),
      new THREE.MeshPhysicalMaterial({ color: bottleColors[b], transparent: true, opacity: 0.85, roughness: 0.1 }));
    bot.position.set(-1.0 + b * 0.28, 1.21, -0.1);
    bar.add(bot);
    const neckB = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.1, 8), bot.material);
    neckB.position.set(-1.0 + b * 0.28, 1.41, -0.1);
    bar.add(neckB);
  }
  for (let gl = 0; gl < 3; gl++) {
    const glassC = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.12, 10),
      new THREE.MeshPhysicalMaterial({ color: 0xcfe6ee, transparent: true, opacity: 0.5, roughness: 0.05 }));
    glassC.position.set(0.5 + gl * 0.18, 1.12, 0.12);
    bar.add(glassC);
  }
  bossGroup.add(bar);
  registerSelectable('bossBar', '🍸 Barra de Bebidas', bar, 'furniture');

  // Impresora propia del jefe (esquina SO de su oficina)
  createCopier('copier', '🖨️ Impresora del Jefe', -14.4, 9.8, Math.PI / 2);

  // Dispenser
  const cooler = new THREE.Group();
  cooler.position.set(-14.0, 0, 0);
  const coolerBody = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.9, 0.45), new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.3 }));
  coolerBody.position.y = 0.45;
  cooler.add(coolerBody);
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.45, 12), new THREE.MeshStandardMaterial({ color: 0x4aa3df, transparent: true, opacity: 0.65 }));
  bottle.position.y = 1.12;
  cooler.add(bottle);
  officeGroup.add(cooler);
  registerSelectable('dispenser', 'Dispenser de Agua', cooler, 'furniture');

  // Sector de comidas y bebidas (pared oeste, junto al dispenser)
  const counterMat = new THREE.MeshStandardMaterial({ color: 0xcfd4dc, roughness: 0.35, metalness: 0.2 });
  const cabinetMat = new THREE.MeshStandardMaterial({ color: 0x8a5a3b, roughness: 0.6 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xb9c0c9, roughness: 0.25, metalness: 0.85 });

  // Mesada con alacena (corre por la pared oeste, al norte del dispenser)
  const kitchen = new THREE.Group();
  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 3.2), counterMat);
  counterTop.position.set(0, 0.92, 0);
  counterTop.castShadow = true;
  counterTop.receiveShadow = true;
  kitchen.add(counterTop);
  const counterBase = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.86, 3.16), cabinetMat);
  counterBase.position.set(0, 0.45, 0);
  counterBase.castShadow = true;
  kitchen.add(counterBase);
  // Puertas de la mesada
  // Respaldo y alacena superior
  const backSplash = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, 3.2), counterMat);
  backSplash.position.set(-0.31, 1.22, 0);
  kitchen.add(backSplash);
  const upperCabinet = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.7, 3.2), cabinetMat);
  upperCabinet.position.set(-0.12, 2.1, 0);
  upperCabinet.castShadow = true;
  kitchen.add(upperCabinet);
  for (let d = 0; d < 3; d++) {
    const uDoor = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.6, 0.98), new THREE.MeshStandardMaterial({ color: 0x9c6b49, roughness: 0.55 }));
    uDoor.position.set(0.08, 2.1, -1.05 + d * 1.05);
    kitchen.add(uDoor);
  }
  // Bacha (sink) y grifería
  const sink = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.5), steelMat);
  sink.position.set(0.05, 0.94, -0.9);
  kitchen.add(sink);
  const faucet = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), steelMat);
  faucet.position.set(-0.18, 1.1, -0.9);
  kitchen.add(faucet);
  const faucetArc = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 8), steelMat);
  faucetArc.rotation.z = Math.PI / 2;
  faucetArc.position.set(-0.08, 1.25, -0.9);
  kitchen.add(faucetArc);
  kitchen.position.set(-14.52, 0, -1.8);
  officeGroup.add(kitchen);
  registerSelectable('kitchenCounter', '🍽️ Mesada de Cocina', kitchen, 'furniture');

  // Heladera (side by side, acero)
  const fridge = new THREE.Group();
  const fBody = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.85, 0.72), steelMat);
  fBody.position.y = 0.93;
  fBody.castShadow = true;
  fridge.add(fBody);
  const fSplit = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.7, 0.73), new THREE.MeshStandardMaterial({ color: 0x99a1ab, roughness: 0.3, metalness: 0.85 }));
  fSplit.position.set(0.38, 0.93, 0);
  fridge.add(fSplit);
  [-0.18, 0.18].forEach(hz => {
    const fh = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.04), new THREE.MeshStandardMaterial({ color: 0x6d757f, roughness: 0.3, metalness: 0.8 }));
    fh.position.set(0.39, 1.15, hz);
    fridge.add(fh);
  });
  const fLed = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0x66ff99 }));
  fLed.position.set(0.2, 1.78, 0.37);
  fridge.add(fLed);
  serverLedMaterials.push(fLed.material);
  fridge.position.set(-14.45, 0, 1.6);
  officeGroup.add(fridge);
  registerSelectable('fridge', '🧊 Heladera', fridge, 'furniture');

  // ==========================================
  // 6. IT HARDWARE & PROPS (SWITCH, ROUTER, PC TOWER, LAPTOP)
  // ==========================================
  // A. Network Switch 24-Port
  function createNetworkSwitch() {
    const sw = new THREE.Group();
    sw.position.set(-6.2, 0.79, -7.4);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 0.28), new THREE.MeshStandardMaterial({ color: 0x1a1e24, metalness: 0.8, roughness: 0.3 }));
    body.position.y = 0.03;
    body.castShadow = true;
    sw.add(body);

    for (let p = -0.2; p <= 0.2; p += 0.035) {
      const port = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.01), new THREE.MeshBasicMaterial({ color: 0x222222 }));
      port.position.set(p, 0.03, 0.142);
      sw.add(port);

      const led = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.01, 0.005), new THREE.MeshBasicMaterial({ color: 0x00ff66 }));
      led.position.set(p, 0.048, 0.142);
      sw.add(led);
      serverLedMaterials.push(led.material);
    }

    officeGroup.add(sw);
    registerSelectable('it_switch', '🖧 Switch de Red', sw, 'prop');
  }
  createNetworkSwitch();

  // B. Wi-Fi Router
  function createRouter() {
    const r = new THREE.Group();
    r.position.set(-5.6, 0.79, -7.0);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.22), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }));
    body.position.y = 0.025;
    body.castShadow = true;
    r.add(body);

    // 4 Antennas
    for (let i = -0.12; i <= 0.12; i += 0.08) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.25, 6), metalDeskMat);
      ant.position.set(i, 0.14, -0.1);
      ant.rotation.x = -0.2;
      r.add(ant);
    }

    // Status Blue LEDs
    for (let i = -0.06; i <= 0.06; i += 0.03) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.005), new THREE.MeshBasicMaterial({ color: 0x00aaff }));
      led.position.set(i, 0.03, 0.112);
      r.add(led);
      serverLedMaterials.push(led.material);
    }

    officeGroup.add(r);
    registerSelectable('it_router', '📡 Router Wi-Fi', r, 'prop');
  }
  createRouter();

  // C. PC Gaming / IT Server Tower
  function createPCTower() {
    const pc = new THREE.Group();
    pc.position.set(-6.6, 0.79, -6.8);

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.48, 0.48), new THREE.MeshStandardMaterial({ color: 0x121418, roughness: 0.3, metalness: 0.7 }));
    chassis.position.y = 0.24;
    chassis.castShadow = true;
    pc.add(chassis);

    // Tempered Glass Panel
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.44), new THREE.MeshStandardMaterial({ color: 0x334455, transparent: true, opacity: 0.6, metalness: 0.9 }));
    glass.rotation.y = Math.PI / 2;
    glass.position.set(0.122, 0.24, 0);
    pc.add(glass);

    // RGB Fan inside
    const fan = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.08, 16), new THREE.MeshBasicMaterial({ color: 0xff00aa, side: THREE.DoubleSide }));
    fan.rotation.y = Math.PI / 2;
    fan.position.set(0.08, 0.28, 0.05);
    pc.add(fan);

    // Frente: botón de encendido + rejillas de ventilación
    const pwrBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 10), new THREE.MeshBasicMaterial({ color: 0x66ff99 }));
    pwrBtn.rotation.x = Math.PI / 2;
    pwrBtn.position.set(0, 0.44, 0.245);
    pc.add(pwrBtn);
    serverLedMaterials.push(pwrBtn.material);
    for (let v = 0; v < 4; v++) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.015, 0.01), new THREE.MeshStandardMaterial({ color: 0x0b0d11 }));
      vent.position.set(0, 0.08 + v * 0.045, 0.245);
      pc.add(vent);
    }

    officeGroup.add(pc);
    registerSelectable('it_pc', '🖥️ Torre PC IT', pc, 'prop');
  }
  createPCTower();

  // D. Independent Laptop
  function createLaptop() {
    const lap = new THREE.Group();
    lap.position.set(-1.1, 0.79, -0.6);

    const base = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.015, 0.26), new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.8, roughness: 0.3 }));
    base.position.y = 0.008;
    lap.add(base);

    const keyb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.005, 0.12), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    keyb.position.set(0, 0.018, 0.02);
    lap.add(keyb);

    const screenPivot = new THREE.Group();
    screenPivot.position.set(0, 0.015, -0.13);
    screenPivot.rotation.x = 0.35; // 110 deg open

    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.012), new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.8 }));
    lid.position.y = 0.12;
    screenPivot.add(lid);

    const display = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.21), screenMat);
    display.position.set(0, 0.12, 0.007);
    screenPivot.add(display);

    lap.add(screenPivot);
    officeGroup.add(lap);
    registerSelectable('it_laptop', '💻 Laptop Independiente', lap, 'prop');
  }
  createLaptop();

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
  const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.3, 0.14), aluMat);
  frameL.position.set(-1.02, 1.15, 0);
  doorGroup.add(frameL);
  const frameR = frameL.clone(); frameR.position.x = 1.02; doorGroup.add(frameR);
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.08, 0.14), aluMat);
  frameTop.position.set(0, 2.3, 0);
  doorGroup.add(frameTop);
  // Dos hojas de vidrio
  [-0.5, 0.5].forEach(px => {
    const leaf = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.94, 2.2, 0.04), glassMat);
    glass.position.y = 1.15;
    leaf.add(glass);
    const midBar = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.05, 0.06), aluMat);
    midBar.position.y = 1.15;
    leaf.add(midBar);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), aluMat);
    handle.position.set(px > 0 ? -0.08 : 0.08, 1.05, 0.07);
    leaf.add(handle);
    leaf.position.x = px;
    doorGroup.add(leaf);
  });
  officeGroup.add(doorGroup);
  registerSelectable('mainDoor', '🚪 Puerta de Entrada', doorGroup, 'furniture');

  // C. Instalación de red: mini rack de pared + canaletas + cables
  const trayMat = new THREE.MeshStandardMaterial({ color: 0xb8bec9, roughness: 0.5, metalness: 0.6 });
  const cableMats = [
    new THREE.MeshStandardMaterial({ color: 0x2f6fd8, roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ color: 0xd8a72f, roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ color: 0xd83f3f, roughness: 0.7 })
  ];
  const TRAY_Y = 3.42;  // pegadas al borde superior de los tabiques (3.5)
  const TRAY_Y_OUT = 3.55; // paredes exteriores (3.7)

  // Canaleta horizontal (segmento de x1,z1 a x2,z2, pegada al borde de la pared)
  function cableTray(x1, z1, x2, z2, y) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (len < 0.05) return;
    const g = new THREE.Group();
    g.position.set((x1 + x2) / 2, y !== undefined ? y : TRAY_Y, (z1 + z2) / 2);
    g.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    const tray = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.16), trayMat);
    g.add(tray);
    // Cables de colores dentro de la canaleta
    cableMats.forEach((cm, i) => {
      const cable = new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, 0.02), cm);
      cable.position.set(0, 0.04, -0.05 + i * 0.05);
      g.add(cable);
    });
    officeGroup.add(g);
  }

  // Bajada vertical hasta el mini rack / tablero
  function cableDrop(x, z, yBottom, yTop) {
    const h = (yTop !== undefined ? yTop : TRAY_Y) - yBottom;
    const drop = new THREE.Mesh(new THREE.BoxGeometry(0.14, h, 0.1), trayMat);
    drop.position.set(x, yBottom + h / 2, z);
    officeGroup.add(drop);
    cableMats.forEach((cm, i) => {
      const cable = new THREE.Mesh(new THREE.BoxGeometry(0.02, h, 0.02), cm);
      cable.position.set(x - 0.04 + i * 0.04, yBottom + h / 2, z + 0.05);
      officeGroup.add(cable);
    });
  }

  // Mini rack de pared (juntas, extremo ESTE de la pared norte — lejos de la
  // TV). Misma profundidad que los racks principales de la sala de sistemas.
  const miniRack = new THREE.Group();
  miniRack.position.set(14.2, 1.55, -10.42);
  const mrBody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.9), rackMat);
  mrBody.castShadow = true;
  miniRack.add(mrBody);
  const mrFrame = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.04, 0.03), new THREE.MeshStandardMaterial({ color: 0x22252c, roughness: 0.4, metalness: 0.8 }));
  mrFrame.position.set(0, 0, 0.45);
  miniRack.add(mrFrame);
  const mrDoor = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.9, 0.02), new THREE.MeshPhysicalMaterial({ color: 0x30363f, transparent: true, opacity: 0.45, roughness: 0.15, metalness: 0.6 }));
  mrDoor.position.set(-0.03, 0, 0.47);
  miniRack.add(mrDoor);
  for (let i = 0; i < 4; i++) {
    const patch = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.09, 0.04), new THREE.MeshStandardMaterial({ color: 0x2b2f3a, metalness: 0.7 }));
    patch.position.set(0, 0.34 - i * 0.2, 0.44);
    miniRack.add(patch);
    for (let p = -0.27; p <= 0.27; p += 0.035) {
      const port = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.012), new THREE.MeshBasicMaterial({ color: (i * 7 + p * 100) % 2 > 0 ? 0x00ff88 : 0x0a2a18 }));
      port.position.set(p, 0.34 - i * 0.2, 0.47);
      miniRack.add(port);
    }
  }
  officeGroup.add(miniRack);
  registerSelectable('miniRack', '🖧 Mini Rack de Red', miniRack, 'prop');

  // Recorrido de canaletas: SOLO por paredes de oficinas. Ruta directa de la
  // sala de racks (NO) a la oficina de la mesa grande (NE) por la pared norte
  // exterior, atravesando los tabiques de las oficinas con pasamuros, como en
  // cablerío estructurado real.
  cableTray(-13.0, -10.82, 14.2, -10.82, TRAY_Y_OUT); // pared norte: racks → mini rack (juntas)

  // Pasamuros donde el canal atraviesa los tabiques de las oficinas
  [-4.5, 4.5].forEach(px => {
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.34, 10),
      new THREE.MeshStandardMaterial({ color: 0x8a929e, roughness: 0.4, metalness: 0.7 })
    );
    sleeve.rotation.z = Math.PI / 2;
    sleeve.position.set(px, TRAY_Y_OUT, -10.82);
    officeGroup.add(sleeve);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, 0.02, 8, 16),
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
  // Bajada al mini rack de la oficina de juntas (extremo este)
  cableDrop(14.2, -10.78, 2.05, TRAY_Y_OUT);

  // Bajada a altura de tomacorriente (y=0.10) en la pared norte, sobre los
  // puestos de la sala de sistemas: se ramifica de la canaleta y baja hasta
  // ~10 cm del piso (no llega al suelo)
  cableDrop(-4.0, -10.78, 0.10, TRAY_Y_OUT);
  // Espejo del otro lado de la pared norte (lado este): baja hasta el piso
  cableDrop(4.0, -10.78, 0.0, TRAY_Y_OUT);
  // Centro de la pared norte: bajada para las PCs del medio, hasta el piso
  cableDrop(0.0, -10.78, 0.0, TRAY_Y_OUT);
  // Centro de la pared norte: alimenta las PCs del medio (N5-N8)
  cableDrop(0.0, -10.78, 0.0, TRAY_Y_OUT);

  // C2. Distribución central por el PISO: bajada por el tabique sur al suelo,
  // canal plano sobre el piso y puestos de red junto a cada PC
  function floorChannel(x1, z1, x2, z2) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (len < 0.05) return;
    const g = new THREE.Group();
    g.position.set((x1 + x2) / 2, 0.015, (z1 + z2) / 2);
    g.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    const ch = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.1), trayMat);
    ch.receiveShadow = true;
    g.add(ch);
    officeGroup.add(g);
  }

  let floorOutletCount = 0;
  // Puesto técnico de piso con red (RJ45 + LEDs) y electricidad (2 enchufes),
  // con base hexagonal y tapa metálica (diseño mejorado)
  function floorOutlet(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    // Base hexagonal
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.05, 6), new THREE.MeshStandardMaterial({ color: 0x20242b, roughness: 0.4, metalness: 0.6 }));
    base.position.y = 0.025;
    base.castShadow = true;
    g.add(base);
    // Tapa metálica bruñida
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 6), new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 0.3, metalness: 0.7 }));
    lid.position.y = 0.06;
    g.add(lid);
    // Placa central pisable retráctil
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.14), new THREE.MeshStandardMaterial({ color: 0x262b33, roughness: 0.5, metalness: 0.4 }));
    plate.position.y = 0.085;
    g.add(plate);
    // 2 puertos RJ45 con LEDs de actividad (verde y ámbar)
    [-0.05, 0.05].forEach((pz, i) => {
      const port = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.02, 0.018), new THREE.MeshBasicMaterial({ color: 0x0a2a18 }));
      port.position.set(-0.055, 0.1, pz);
      g.add(port);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.008, 0.008), new THREE.MeshBasicMaterial({ color: i ? 0xffcc33 : 0x00ff88 }));
      led.position.set(0.045, 0.1, pz);
      g.add(led);
      serverLedMaterials.push(led.material);
    });
    // 2 enchufes de electricidad argentinos (tres patas)
    [-0.05, 0.05].forEach(pz => {
      const outlet = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 6), new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.4 }));
      outlet.rotation.x = Math.PI / 2;
      outlet.position.set(0.055, 0.098, pz);
      g.add(outlet);
      const pin1 = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
      pin1.position.set(0.055, 0.098, pz - 0.01);
      g.add(pin1);
      const pin2 = pin1.clone(); pin2.position.z = pz + 0.01;
      g.add(pin2);
    });
    // Etiqueta RJ45
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.02), new THREE.MeshStandardMaterial({ color: 0x96a5b8 }));
    label.rotation.x = -Math.PI / 2;
    label.position.set(0, 0.088, -0.08);
    g.add(label);
    officeGroup.add(g);
    floorOutletCount++;
    registerSelectable('floorOutlet' + floorOutletCount, '🔌 Puesto Red+Elec ' + floorOutletCount, g, 'prop');
    return g;
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
  floorOutlet(5.75, -1.0);   // junto a Escritorio Este 1
  floorOutlet(5.85, 1.0);    // junto a Escritorio Este 2
  floorOutlet(5.75, 3.0);    // junto a Escritorio Este 3
  floorOutlet(3.5, 8.7);     // junto a la Mesa de Trabajo IT (entrada)

  // Fotocopiadora del espacio central (entre los escritorios 5 y 6)
  createCopier('copier', 'Fotocopiadora', -4.05, 0, -Math.PI / 2);

  // D. Tablero eléctrico (pasillo norte, afuera de las oficinas)
  const panel = new THREE.Group();
  panel.position.set(-9.0, 1.5, -10.82);
  const pBody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.18), new THREE.MeshStandardMaterial({ color: 0x9aa3ae, roughness: 0.4, metalness: 0.5 }));
  pBody.castShadow = true;
  panel.add(pBody);
  const pDoor = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.9, 0.02), new THREE.MeshStandardMaterial({ color: 0x7d8794, roughness: 0.35, metalness: 0.6 }));
  pDoor.position.set(0, 0, 0.1);
  panel.add(pDoor);
  const pHandle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.04), metalDeskMat);
  pHandle.position.set(0.28, 0, 0.13);
  panel.add(pHandle);
  const pLight = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: 0x33ff66 }));
  pLight.position.set(-0.28, 0.38, 0.11);
  panel.add(pLight);
  officeGroup.add(panel);
  registerSelectable('elecPanel', '⚡ Tablero Eléctrico', panel, 'furniture');
  // Conduit del tablero hasta la canaleta de la pared norte (pegado a la pared)
  const conduit = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 8), trayMat);
  conduit.position.set(-9.0, 2.75, -10.85);
  officeGroup.add(conduit);

  // E. Access Points WiFi de pared (estilo Cisco, antenas grandes)
  function createWallAP(id, name, x, z, rotY, y = 2.25) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;

    const apMat = new THREE.MeshStandardMaterial({ color: 0xf2f4f8, roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.1), apMat);
    body.castShadow = true;
    g.add(body);

    const led = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0x2fa8ff }));
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
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.42, 8), antMat);
      ant.position.y = 0.21;
      ant.castShadow = true;
      antGroup.add(ant);
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.016, 0.05, 8), antMat);
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
}

buildOfficeEnvironment();
