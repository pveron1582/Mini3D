// js/office/index.js — orquestador del entorno oficina (split P1).
// La geometría vive en los módulos hermanos; este archivo arma el layout general:
// piso, tabiques (buildWalls), espacio central, recepción y los llamados a cada
// sección (sala de servidores, salas ejecutivas, cableado, calle, casa del hacker).
import * as THREE from 'three';
import * as geo from './geoCache.js';
import { officeGroup } from './group.js';
import { darkWoodMat } from './materials.js';
import { buildWalls } from './walls.js';
import { buildDefaultFloor } from './floor.js';
import { createDesk, createChair, createSofa, createPlant, createFileCabinet, createCopier } from './furniture.js';
import { buildServerRoom } from './serverRoom.js';
import { buildLounge } from './lounge.js';
import { buildNetwork } from './network.js';
import { buildCity } from './city.js';
import { buildHackerHouseInterior } from './hackerHouse.js';
import { registerSelectable } from '../selection.js';




function buildOfficeEnvironment() {
  // 1. Floor (30m x 22m) — textura procedural editable (P8)
  buildDefaultFloor();

  // 2. Walls (editables en modo "Editar Edificio": seleccionables, movibles,
  //    con largo/alto/espesor, tipo vidrio/sólido y textura configurables)
  //    Por defecto son PANELES DE VIDRIO (este modelo de oficina).
  buildWalls();
  // Acoustic Privacy Divider
  const divider = new THREE.Mesh(geo.box(4.2, 0.45, 0.06), new THREE.MeshStandardMaterial({ color: 0x4a7bb0, roughness: 0.9 }));
  divider.position.set(0, 1.02, 0);
  officeGroup.add(divider);

  // ===== Mobiliario del espacio central ampliado =====

  // Alfombra central (solo visual, sin colisión)
  const rug = new THREE.Mesh(
    geo.plane(7.5, 7.5),
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

  // ===== Hilera ESTE (pocket entre sala de juntas y oficina privada) =====
  // De a pares enfrentados, cerca del fondo (pared este), con cada par
  // ROTADO 90°: ahora las mesas quedan alineadas norte–sur, espaldas juntas
  // en el medio del par (z=∓1.5), monitores hacia afuera y las dos personas
  // una frente a la otra. Par 1 centrado en z=-1.5, par 2 en z=+1.5.
  createDesk('deskE1', 'Escritorio Este 1', 13.35, -1.05, 0);
  createChair('chairE1', 'Silla Este 1', 13.35, -0.35, 0);
  createDesk('deskE2', 'Escritorio Este 2', 13.35, -1.95, Math.PI);
  createChair('chairE2', 'Silla Este 2', 13.35, -2.65, Math.PI);
  createDesk('deskE3', 'Escritorio Este 3', 13.35, 1.95, 0);
  createChair('chairE3', 'Silla Este 3', 13.35, 2.65, 0);
  createDesk('deskE4', 'Escritorio Este 4', 13.35, 1.05, Math.PI);
  createChair('chairE4', 'Silla Este 4', 13.35, 0.35, Math.PI);

  // Copia espejada NO: copia IDÉNTICA de los 4 puestos, pegada del lado
  // oeste (el este lo limita la pared): mismo orientación, desplazada
  // exactamente una profundidad de mesa (0.95 m) para que los bordes queden
  // apoyados y todo quede simétrico.
  createDesk('deskE5', 'Escritorio Este 5', 12.4, -1.05, 0);
  createChair('chairE5', 'Silla Este 5', 12.4, -0.35, 0);
  createDesk('deskE6', 'Escritorio Este 6', 12.4, -1.95, Math.PI);
  createChair('chairE6', 'Silla Este 6', 12.4, -2.65, Math.PI);
  createDesk('deskE7', 'Escritorio Este 7', 12.4, 1.95, 0);
  createChair('chairE7', 'Silla Este 7', 12.4, 2.65, 0);
  createDesk('deskE8', 'Escritorio Este 8', 12.4, 1.05, Math.PI);
  createChair('chairE8', 'Silla Este 8', 12.4, 0.35, Math.PI);

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
  createSofa('sofa1', 'Sillón 1', 3.6, -1.4, Math.PI / 2);
  createSofa('sofa2', 'Sillón 2', 3.6, 1.4, Math.PI / 2);
  // Sillones pegados a paredes blancas reales (respaldo apoyado, como la puerta):
  // el respaldo local +z queda contra la cara interior de la pared
  createSofa('sofa3', 'Sillón 3', -6.5, -4.12, Math.PI);  // tabique norte (segmento oeste), mira al sur
  createSofa('sofa4', 'Sillón 4', 6.0, 4.12, 0);          // tabique sur (segmento este), mira al norte
  createSofa('sofa5', 'Sillón 5', 4.12, 7.5, Math.PI / 2); // tabique este del espacio central, mira al oeste

  // Mesita de centro de los sillones
  const coffeeTable = new THREE.Mesh(geo.cylinder(0.45, 0.45, 0.42, 16), darkWoodMat);
  coffeeTable.position.set(3.0, 0.21, 0);
  coffeeTable.castShadow = true;
  officeGroup.add(coffeeTable);
  registerSelectable('coffeeTable', 'Mesita de Centro', coffeeTable, 'furniture');

  // Plantas de interior
  // Una maceta en cada esquina de la alfombra central (7.5×7.5, esquinas ±3.75)
  createPlant('plant1', 'Planta 1', -3.6, -3.6);
  createPlant('plant2', 'Planta 2', 3.6, -3.6);
  createPlant('plant3', 'Planta 3', -3.6, 3.6);
  createPlant('plant4', 'Planta 4', 3.6, 3.6);
  // (Las plantas 5 y 6 extra del espacio central fueron eliminadas: sobraban)

  // Archiveros (lado sur)
  createFileCabinet('cabinet1', 'Archivero 1', 2.9, 4.05, 0);
  createFileCabinet('cabinet2', 'Archivero 2', 3.7, 4.05, 0);

  // Fotocopiadora (contra el tabique oeste)
  buildServerRoom();
  buildLounge();
  // ==========================================
  // RECEPCIÓN / SALA DE ESPERA (donde estaba la cocina, junto a la oficina
  // del jefe): sillones, alfombras, mesas y plantas para recibir clientes.
  // ==========================================
  // Alfombra central
  const recRug = new THREE.Mesh(
    geo.plane(4.6, 3.4),
    new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.95 })
  );
  recRug.rotation.x = -Math.PI / 2;
  recRug.position.set(-9.5, 0.012, 0);
  recRug.receiveShadow = true;
  officeGroup.add(recRug);

  // Dos sillones enfrentados, espalda hacia los costados
  createSofa('recSofa1', '🛋️ Sillón Recepción 1', -11.8, 0, -Math.PI / 2);
  createSofa('recSofa2', '🛋️ Sillón Recepción 2', -7.2, 0, Math.PI / 2);

  // Mesa ratona central (rectangular) + 2 mesitas redondas laterales
  const recTable = new THREE.Group();
  recTable.position.set(-9.5, 0, 0);
  const recTop = new THREE.Mesh(geo.box(1.1, 0.06, 0.6), darkWoodMat);
  recTop.position.y = 0.42; recTop.castShadow = true;
  recTable.add(recTop);
  const recLegM = new THREE.Mesh(geo.cylinder(0.05, 0.05, 0.4, 8), darkWoodMat);
  recLegM.position.y = 0.2;
  recTable.add(recLegM);
  officeGroup.add(recTable);
  registerSelectable('recTable', '☕ Mesa Ratona', recTable, 'furniture');
  [-1.5, 1.5].forEach(zOff => {
    const recSide = new THREE.Mesh(geo.cylinder(0.3, 0.3, 0.4, 14), darkWoodMat);
    recSide.position.set(-9.5, 0.2, zOff);
    recSide.castShadow = true;
    officeGroup.add(recSide);
  });

  // Plantas en las esquinas de la sala de espera
  createPlant('recPlant1', '🪴 Planta Recepción 1', -13.8, -3.8);
  createPlant('recPlant2', '🪴 Planta Recepción 2', -13.8, 3.8);
  createPlant('recPlant3', '🪴 Planta Recepción 3', -5.4, -3.8);
  createPlant('recPlant4', '🪴 Planta Recepción 4', -5.4, 3.8);

  buildNetwork();
  buildCity();
  buildHackerHouseInterior();
}

buildOfficeEnvironment();

