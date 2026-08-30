import * as THREE from 'three';
import { interactiveRegistry } from '../state.js';
import { getWallColliders } from '../office/walls.js';
import { officeGroup } from '../office/group.js';
import { parkGroup } from '../park.js';
import { studioGroup } from '../lights.js';
import { entryRadius } from '../collision.js';

// ==========================================
// NAVEGACIÓN AUTOMÁTICA DE RECORRIDOS (A*)
// ==========================================
// Si un tramo del recorrido cinemático atraviesa una pared u objeto, se
// calcula un camino alternativo (grilla + A* + suavizado por línea de vista)
// y se insertan puntos intermedios automáticamente. El punto final (rojo)
// siempre se respeta.

const MARGIN = 0.45;      // distancia libre extra alrededor de obstáculos
const CELL = 0.5;         // resolución de la grilla (m)
const CHAR_RADIUS = 0.3;  // radio del personaje que navega

function isShown(obj) {
  let o = obj;
  while (o) {
    if (!o.visible) return false;
    o = o.parent;
  }
  return true;
}

// Obstáculos activos del ambiente actual: paredes (AABB) y objetos estáticos
// (círculos). Los personajes no cuentan: ellos se apartan por colisión.
function collectObstacles() {
  const walls = [];
  const circles = [];
  if (officeGroup.visible) {
    getWallColliders().forEach(b => walls.push(boxInflated(b, CHAR_RADIUS + MARGIN)));
  }
  interactiveRegistry.forEach(entry => {
    if (entry.type === 'human' || entry.type === 'pet') return;
    if (!entry.group || !isShown(entry.group)) return;
    // Las paredes ya son obstáculos AABB
    if (entry.group.userData.wallData) return;
    // Montados en altura (APs de pared, mini rack, tablero): no bloquean el piso
    if (entry.group.position.y > 1.0) return;
    circles.push({
      x: entry.group.position.x,
      z: entry.group.position.z,
      r: Math.min(entryRadius(entry), 2.0) * 0.85 + CHAR_RADIUS * 0.5 + MARGIN * 0.5
    });
  });
  return { walls, circles };
}

function boxInflated(b, m) {
  return { minX: b.minX - m, maxX: b.maxX + m, minZ: b.minZ - m, maxZ: b.maxZ + m };
}

function pointBlocked(x, z, obs) {
  for (let i = 0; i < obs.walls.length; i++) {
    const b = obs.walls[i];
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return true;
  }
  for (let i = 0; i < obs.circles.length; i++) {
    const c = obs.circles[i];
    const dx = x - c.x, dz = z - c.z;
    if (dx * dx + dz * dz < c.r * c.r) return true;
  }
  return false;
}

function segmentBlocked(a, b, obs) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(len / 0.25));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (pointBlocked(a.x + dx * t, a.z + dz * t, obs)) return true;
  }
  return false;
}

// ---------- A* sobre grilla ----------
const DIRS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1]
];

// Límites de la grilla derivados de la geometría del ambiente activo (P4).
// Antes eran fijos (-14.5..14.5 / -10.5..10.5) y rompían en el parque/casa del
// hacker (que está en z≈-27). Se calcula la caja del grupo visible + margen.
function getNavBounds() {
  // Cache: solo se recalcula cuando cambia el set de grupos visibles.
  const sig = (officeGroup.visible ? 'o' : '') + (parkGroup.visible ? 'p' : '') + (studioGroup.visible ? 's' : '');
  if (getNavBounds._sig === sig && getNavBounds._box) return getNavBounds._box;
  const box = new THREE.Box3();
  const groups = [];
  if (officeGroup.visible) groups.push(officeGroup);
  if (parkGroup.visible) groups.push(parkGroup);
  if (studioGroup.visible) groups.push(studioGroup);
  let any = false;
  groups.forEach(g => g.traverse(o => {
    if (o.isMesh) { box.expandByObject(o); any = true; }
  }));
  let out;
  if (!any) out = { minX: -15, maxX: 15, minZ: -11, maxZ: 11 };
  else out = { minX: box.min.x - 2, maxX: box.max.x + 2, minZ: box.min.z - 2, maxZ: box.max.z + 2 };
  getNavBounds._sig = sig;
  getNavBounds._box = out;
  return out;
}

function aStar(sx, sz, gx, gz, obs) {
  const B = getNavBounds();
  const minX = B.minX, maxX = B.maxX, minZ = B.minZ, maxZ = B.maxZ;
  const W = Math.floor((maxX - minX) / CELL) + 1;
  const H = Math.floor((maxZ - minZ) / CELL) + 1;
  const idx = (ix, iz) => ix + iz * W;
  const toCell = (x, z) => [Math.round((x - minX) / CELL), Math.round((z - minZ) / CELL)];

  let [six, siz] = toCell(sx, sz);
  let [gix, giz] = toCell(gx, gz);
  const inBounds = (ix, iz) => ix >= 0 && ix < W && iz >= 0 && iz < H;
  if (!inBounds(six, siz) || !inBounds(gix, giz)) return null;

  // Si la celda está bloqueada, buscar la más cercana libre
  const freeCell = (ix, iz) => {
    if (inBounds(ix, iz) && !pointBlocked(minX + ix * CELL, minZ + iz * CELL, obs)) return [ix, iz];
    for (let r = 1; r <= 6; r++) {
      for (let dxx = -r; dxx <= r; dxx++) {
        for (let dzz = -r; dzz <= r; dzz++) {
          if (Math.abs(dxx) !== r && Math.abs(dzz) !== r) continue;
          const nx = ix + dxx, nz = iz + dzz;
          if (inBounds(nx, nz) && !pointBlocked(minX + nx * CELL, minZ + nz * CELL, obs)) return [nx, nz];
        }
      }
    }
    return null;
  };
  const s = freeCell(six, siz); if (!s) return null;
  const g = freeCell(gix, giz); if (!g) return null;
  [six, siz] = s;
  [gix, giz] = g;

  const total = W * H;
  const gScore = new Float32Array(total).fill(Infinity);
  const from = new Int32Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const startI = idx(six, siz), goalI = idx(gix, giz);
  gScore[startI] = 0;

  const h = (i) => {
    const ix = i % W, iz = (i / W) | 0;
    return Math.hypot(ix - gix, iz - giz);
  };
  const open = [startI];
  const inOpen = new Uint8Array(total);
  inOpen[startI] = 1;

  while (open.length) {
    // Extraer el de menor f (grilla chica: búsqueda lineal OK)
    let best = 0;
    for (let k = 1; k < open.length; k++) {
      if (gScore[open[k]] + h(open[k]) < gScore[open[best]] + h(open[best])) best = k;
    }
    const cur = open.splice(best, 1)[0];
    inOpen[cur] = 0;
    if (cur === goalI) break;
    closed[cur] = 1;
    const cix = cur % W, ciz = (cur / W) | 0;
    for (let d = 0; d < 8; d++) {
      const nx = cix + DIRS[d][0], nz = ciz + DIRS[d][1];
      if (!inBounds(nx, nz)) continue;
      const ni = idx(nx, nz);
      if (closed[ni]) continue;
      const wx = minX + nx * CELL, wz = minZ + nz * CELL;
      if (pointBlocked(wx, wz, obs)) continue;
      // No cortar esquinas en diagonal
      if (d >= 4) {
        if (pointBlocked(minX + (cix + DIRS[d][0]) * CELL, minZ + ciz * CELL, obs)) continue;
        if (pointBlocked(minX + cix * CELL, minZ + (ciz + DIRS[d][1]) * CELL, obs)) continue;
      }
      const step = d >= 4 ? CELL * Math.SQRT2 : CELL;
      const ng = gScore[cur] + step;
      if (ng < gScore[ni]) {
        gScore[ni] = ng;
        from[ni] = cur;
        if (!inOpen[ni]) { open.push(ni); inOpen[ni] = 1; }
      }
    }
  }

  if (from[goalI] === -1 && goalI !== startI) return null;
  // Reconstruir
  const cells = [];
  let c = goalI;
  while (c !== -1) { cells.push(c); if (c === startI) break; c = from[c]; }
  cells.reverse();
  return cells.map(i => ({ x: minX + (i % W) * CELL, z: minZ + ((i / W) | 0) * CELL }));
}

// Suavizado por línea de vista: eliminar puntos innecesarios
function smooth(points, obs) {
  if (points.length <= 2) return points;
  const out = [points[0]];
  let i = 0;
  while (i < points.length - 1) {
    let j = points.length - 1;
    while (j > i + 1 && segmentBlocked(points[i], points[j], obs)) j--;
    out.push(points[j]);
    i = j;
  }
  return out;
}

// ---------- API principal ----------
// Recibe los waypoints originales (Vector3) y devuelve una lista con puntos
// intermedios insertados donde el camino directo cruza obstáculos.
export function solvePath(waypoints, planeY) {
  if (!waypoints || waypoints.length < 2) return waypoints;
  const obs = collectObstacles();
  const result = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    result.push(a.clone());
    if (!segmentBlocked(a, b, obs)) continue;
    // Tramo bloqueado: A* entre los dos puntos y suavizado
    const cells = aStar(a.x, a.z, b.x, b.z, obs);
    if (!cells) continue; // sin solución: se mantiene el camino directo
    const sm = smooth(cells, obs);
    for (let k = 0; k < sm.length; k++) {
      // Evitar duplicados con los extremos
      const p = sm[k];
      if (p === sm[0] || p === sm[sm.length - 1]) continue;
      if (Math.hypot(p.x - a.x, p.z - a.z) < 0.6) continue;
      if (Math.hypot(p.x - b.x, p.z - b.z) < 0.6) continue;
      result.push(new THREE.Vector3(p.x, planeY, p.z));
    }
  }
  result.push(waypoints[waypoints.length - 1].clone());
  return result;
}
