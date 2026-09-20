// js/office/packets.js — Paquetes de datos viajando por las canaletas (GLM #4).
//
// Pulses luminosos (esferas emisivas con estela) que recorren la instalación
// de canaletas de la oficina: la fija (fixedTraySegs de network.js) más los
// tramos dibujados punto a punto (catálogo `cableTray`). Se reconectan solos:
// el ticker relee la red y si detecta que se agregó/movió/borró un tramo,
// reconstruye el grafo sin reiniciar los paquetes en vuelo.
//
// Solo viven en el ambiente oficina (cuelgan de officeGroup: se ocultan con
// el ambiente, y en la vista "👁 Solo edificio" el ticker las esconde).
// Nada se serializa: es decoración de escena, no contenido del proyecto.

import * as THREE from 'three';
import * as geo from './geoCache.js';
import { officeGroup } from './group.js';
import { getFixedTraySegments } from './network.js';
import { interactiveRegistry, store } from '../state.js';
import { registerTicker } from '../tickers.js';

// ---------- Parámetros ----------
const PACKET_COUNT = 6;        // pulsos simultáneos (pocos: filosofía liviana)
const PACKET_SPEED = 2.4;      // m/s sobre la canaleta
const STAY_OFFSET = 0.16;      // altura sobre la canaleta (los "cables" quedan abajo)
const PACKET_R = 0.045;        // radio del pulso
const TRAIL_R = 0.022;         // estela (más fina y tenue)
const PACKET_COLORS = [0x35d0ff, 0x3aff88, 0xffc233]; // datos / ok / alerta

// Firma de la red (cambios => reconstruir el grafo)
function networkSignature() {
  let s = 'F' + getFixedTraySegments().length + '|';
  interactiveRegistry.forEach(entry => {
    const g = entry.group;
    if (!g || g.userData.catalogId !== 'cableTray') return;
    const sd = g.userData.spawnData;
    if (entry.deleted || !g.visible || !sd || !sd.points) return;
    s += entry.id + ':' + g.position.x.toFixed(2) + ',' + g.position.z.toFixed(2) + ';';
  });
  return s;
}

// Recolecta los tramos absolutos: fijos + runs dibujados (misma lógica que
// collectTargetSegments de trayDraw.js, más el filtro de visibilidad).
// Los risers (bajadas verticales) traen y1/y2; el resto, una sola y.
function collectSegments() {
  const segs = [];
  for (const t of getFixedTraySegments()) {
    segs.push({ x1: t.x1, z1: t.z1, x2: t.x2, z2: t.z2, y: t.y, y1: t.y1 ?? t.y, y2: t.y2 ?? t.y });
  }
  interactiveRegistry.forEach(entry => {
    const g = entry.group;
    if (!g || g.userData.catalogId !== 'cableTray') return;
    if (entry.deleted || !g.visible) return;
    const sd = g.userData.spawnData;
    if (!sd || !Array.isArray(sd.points) || sd.points.length < 2) return;
    const ox = g.position.x, oz = g.position.z;
    const y = sd.y !== undefined ? sd.y : g.position.y;
    for (let i = 0; i < sd.points.length - 1; i++) {
      const a = sd.points[i], b = sd.points[i + 1];
      segs.push({ x1: ox + a.x, z1: oz + a.z, x2: ox + b.x, z2: oz + b.z, y, y1: y, y2: y });
    }
  });
  return segs;
}


// ---------- Grafo de navegación sobre los tramos ----------
// Nodos: extremos de tramo (los que se tocan forman UNA esquina). Aristas:
// los tramos. Un paquete viaja por una arista y al llegar a un nodo elige
// otra arista del nodo (nunca vuelve por donde vino salvo callejón sin salida).
const NODE_TOL = 0.12;
let graph = null; // { nodes:[{x,z,y,edges:[i]}], edges:[{a,b,len,seg}] }
let lastSig = '';

function buildGraph() {
  const raw = collectSegments();
  // Partir los tramos horizontales donde apoya un riser en su interior
  // (bajadas a mitad de pared): si no, la unión en T nunca se forma y el
  // riser queda como callejón sin salida.
  const segs = [];
  for (const s of raw) {
    if (s.y1 !== s.y2) { segs.push(s); continue; } // el riser no se parte
    let cuts = [{ x: s.x1, z: s.z1 }, { x: s.x2, z: s.z2 }];
    for (const r of raw) {
      if (r.y1 === r.y2) continue;
      const px = r.x1, pz = r.z1; // base del riser (x1==x2, z1==z2)
      const dx = s.x2 - s.x1, dz = s.z2 - s.z1;
      const len2 = dx * dx + dz * dz;
      if (len2 < 1e-9) continue;
      let t = ((px - s.x1) * dx + (pz - s.z1) * dz) / len2;
      if (t < 0.02 || t > 0.98) continue; // cerca de un extremo: ya empalma
      const qx = s.x1 + t * dx, qz = s.z1 + t * dz;
      if (Math.hypot(px - qx, pz - qz) > NODE_TOL) continue;
      cuts.push({ x: qx, z: qz });
    }
    cuts.sort((a, b) =>
      (a.x - s.x1) * Math.sign(s.x2 - s.x1) + (a.z - s.z1) * Math.sign(s.z2 - s.z1) -
      ((b.x - s.x1) * Math.sign(s.x2 - s.x1) + (b.z - s.z1) * Math.sign(s.z2 - s.z1)));
    for (let i = 0; i < cuts.length - 1; i++) {
      segs.push({ x1: cuts[i].x, z1: cuts[i].z, x2: cuts[i + 1].x, z2: cuts[i + 1].z, y: s.y, y1: s.y, y2: s.y });
    }
  }
  const nodes = [];
  const findNode = (x, z, y) => {
    for (const n of nodes) {
      if (Math.abs(n.x - x) < NODE_TOL && Math.abs(n.z - z) < NODE_TOL && Math.abs(n.y - y) < 0.5) return n;
    }
    const n = { x, z, y, edges: [] };
    nodes.push(n);
    return n;
  };
  const edges = [];
  for (const s of segs) {
    const y1 = s.y1 ?? s.y, y2 = s.y2 ?? s.y;
    const len = Math.hypot(s.x2 - s.x1, s.z2 - s.z1, y2 - y1);
    if (len < 0.05 || !isFinite(len)) continue;
    const a = findNode(s.x1, s.z1, y1);
    const b = findNode(s.x2, s.z2, y2);
    const ei = edges.length;
    edges.push({ a, b, len, seg: s, y1, y2 });
    a.edges.push(ei);
    b.edges.push(ei);
  }
  graph = { nodes, edges };
  lastSig = networkSignature();
}

// Grafo actual (para tests): lo reconstruye si la red cambió.
export function trayGraph() {
  if (!graph || networkSignature() !== lastSig) buildGraph();
  return graph;
}

function pickOtherEdge(node, excludeIdx) {
  const opts = node.edges.filter(e => e !== excludeIdx);
  if (opts.length === 0) return excludeIdx; // callejón: pega la vuelta
  return opts[(Math.random() * opts.length) | 0];
}

// ---------- Paquetes (mesh + estado) ----------
const packetGroup = new THREE.Group();
officeGroup.add(packetGroup);

const packetMats = PACKET_COLORS.map(c =>
  new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.95 })
);
const trailMats = PACKET_COLORS.map(c =>
  new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.3 })
);

const packets = [];
for (let i = 0; i < PACKET_COUNT; i++) {
  const body = new THREE.Mesh(geo.sphere(PACKET_R, 10, 10), packetMats[i % packetMats.length]);
  const trail = new THREE.Mesh(geo.sphere(TRAIL_R, 8, 8), trailMats[i % trailMats.length]);
  body.visible = false;
  trail.visible = false;
  packetGroup.add(body, trail);
  packets.push({ body, trail, edge: -1, t: 0, dir: 1 });
}

// Posición sobre una arista: interpolación entre sus dos nodos (incluye
// subidas/bajadas por las bajadas verticales).
function edgePos(e, t, out) {
  out.x = e.a.x + (e.b.x - e.a.x) * t;
  out.z = e.a.z + (e.b.z - e.a.z) * t;
  out.y = e.y1 + (e.y2 - e.y1) * t + STAY_OFFSET;
  return out;
}

const _p = { x: 0, y: 0, z: 0 };

function respawnPacket(pk, randomT = false) {
  if (!graph || graph.edges.length === 0) { pk.body.visible = pk.trail.visible = false; pk.edge = -1; return; }
  pk.edge = (Math.random() * graph.edges.length) | 0;
  pk.t = randomT ? Math.random() : 0;
  pk.dir = Math.random() < 0.5 ? 1 : -1;
}

function updatePackets(simDt) {
  const sig = networkSignature();
  if (sig !== lastSig) buildGraph();
  if (!graph || graph.edges.length === 0) {
    packets.forEach(pk => { pk.body.visible = pk.trail.visible = false; });
    return;
  }
  // "Solo edificio": las canaletas quedan pero los paquetes distraen — ocultar.
  const show = !store.buildingOnly;
  for (const pk of packets) {
    if (pk.edge < 0 || pk.edge >= graph.edges.length) respawnPacket(pk);
    if (pk.edge < 0) continue;
    const e = graph.edges[pk.edge];
    pk.t += (simDt * PACKET_SPEED / e.len) * pk.dir;
    if (pk.t >= 1 || pk.t <= 0) {
      // Llegó a un nodo: elegir la siguiente arista (sin volver, si se puede).
      const node = pk.t >= 1 ? (pk.dir > 0 ? e.b : e.a) : (pk.dir > 0 ? e.a : e.b);
      const next = pickOtherEdge(node, pk.edge);
      const ne = graph.edges[next];
      pk.edge = next;
      pk.dir = (ne.a === node) ? 1 : -1;
      pk.t = pk.dir > 0 ? 0 : 1;
    }
    edgePos(e, THREE.MathUtils.clamp(pk.t, 0, 1), _p);
    pk.body.visible = pk.trail.visible = show;
    if (!show) continue;
    pk.body.position.set(_p.x, _p.y, _p.z);
    // Estela: un paso atrás sobre la arista (hacia donde vino).
    const tTrail = THREE.MathUtils.clamp(pk.t - pk.dir * 0.12 / e.len, 0, 1);
    edgePos(e, tTrail, _p);
    pk.trail.position.set(_p.x, _p.y, _p.z);
  }
}

// Arranque: la red fija ya existe (buildNetwork corrió antes), los runs se
// suman después y la firma los detecta. Distribuir los paquetes por la red.
buildGraph();
packets.forEach(pk => respawnPacket(pk, true));

registerTicker((simDt) => updatePackets(simDt));
