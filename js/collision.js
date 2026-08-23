import * as THREE from 'three';
import { interactiveRegistry } from './state.js';
import { getWallColliders, officeGroup } from './office.js';

// ==========================================
// COLISIONES SENCILLAS (círculos en el plano XZ)
// ==========================================
// Cada objeto se aproxima por un círculo a la altura del suelo. Los objetos
// estáticos (mobiliario, equipos) no se mueven: se empuja al personaje.
// Se permite un solapamiento parcial (COLLISION_MARGIN) para que dos
// personajes puedan pasar uno al lado del otro rozándose.

const COLLISION_MARGIN = 0.75; // fracción de la suma de radios que pueden solaparse
const RADIUS = { human: 0.35, pet: 0.28 };

const _box = new THREE.Box3();
const _vSize = new THREE.Vector3();

function entryRadius(entry) {
  if (entry.__colRadius) return entry.__colRadius;
  let r;
  if (RADIUS[entry.type] !== undefined) {
    r = RADIUS[entry.type];
  } else {
    // Radio estático a partir de la caja envolvente del objeto
    _box.setFromObject(entry.group);
    if (_box.isEmpty()) r = 0.3;
    else {
      _box.getSize(_vSize);
      r = Math.max(_vSize.x, _vSize.z) / 2;
      r = THREE.MathUtils.clamp(r, 0.3, 4.0);
    }
  }
  entry.__colRadius = r;
  return r;
}

function isDynamic(entry) {
  if (entry.type !== 'human' && entry.type !== 'pet') return false;
  // Sentado/acostado = colocado a propósito junto a mobiliario: no empujar
  const act = entry.rig ? entry.rig.currentAction : '';
  return !(act.startsWith('sit') || act.startsWith('lay'));
}

export function resolveCollisions() {
  const entries = Array.from(interactiveRegistry.values());

  // Ley de física del piso: y = 0 es el límite absoluto para TODO objeto,
  // sin importar cómo se haya movido (gizmo, sliders, arrastre, reproducción).
  // Los personajes tienen su propio mínimo (rig.groundY): su origen queda por
  // encima de los pies, y bajarlos de ese mínimo los enterraría en el piso.
  // Las paredes apoyan en el piso: su mínimo es la mitad de su altura.
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e.group) continue;
    const wd = e.group.userData.wallData;
    const minY = e.rig && e.rig.groundY ? e.rig.groundY
      : wd ? (wd.h * e.group.scale.y) / 2
      : 0;
    if (e.group.position.y < minY) e.group.position.y = minY;
  }

  const wallBoxes = officeGroup.visible ? getWallColliders() : [];
  if (entries.length < 2 && wallBoxes.length === 0) return;

  for (let i = 0; i < entries.length; i++) {
    const a = entries[i];
    if (!a.group || !isDynamic(a)) continue;

    const pa = a.group.position;
    const ra = entryRadius(a);

    // Paredes del ambiente activo (no atravesarlas; colisionan como cajas)
    for (let w = 0; w < wallBoxes.length; w++) {
      resolveAABB(pa, ra * COLLISION_MARGIN, wallBoxes[w]);
    }

    for (let j = 0; j < entries.length; j++) {
      if (i === j) continue;
      const b = entries[j];
      if (!b.group || b.group === a.group) continue;
      if (!b.group.visible) continue;
      // Las paredes colisionan como cajas AABB, no como círculos
      if (b.group.userData.wallData) continue;
      // Elementos montados en altura (APs, mini rack, tablero): no bloquean
      // el paso a nivel del piso
      if (b.group.position.y > 1.0) continue;

      const pb = b.group.position;
      const minDist = (ra + entryRadius(b)) * COLLISION_MARGIN;

      const dx = pa.x - pb.x;
      const dz = pa.z - pb.z;
      const distSq = dx * dx + dz * dz;
      if (distSq >= minDist * minDist) continue;

      const dist = Math.sqrt(distSq) || 0.0001;
      const push = (minDist - dist);
      const nx = dx / dist;
      const nz = dz / dist;

      if (isDynamic(b)) {
        // Ambos son personajes: se reparten el empuje
        pa.x += nx * push * 0.5;
        pa.z += nz * push * 0.5;
        pb.x -= nx * push * 0.5;
        pb.z -= nz * push * 0.5;
      } else {
        // b es estático: solo se mueve el personaje
        pa.x += nx * push;
        pa.z += nz * push;
      }
    }

    // No atravesar el piso
    if (pa.y < 0) pa.y = 0;
  }
}

// Empujar un punto fuera de una caja (pared) en el plano XZ
function resolveAABB(p, minDist, box) {
  const cx = THREE.MathUtils.clamp(p.x, box.minX, box.maxX);
  const cz = THREE.MathUtils.clamp(p.z, box.minZ, box.maxZ);
  const dx = p.x - cx;
  const dz = p.z - cz;
  const distSq = dx * dx + dz * dz;
  if (distSq >= minDist * minDist) return;

  if (distSq > 1e-8) {
    // Fuera de la caja pero muy cerca: empujar radialmente
    const dist = Math.sqrt(distSq);
    p.x = cx + (dx / dist) * minDist;
    p.z = cz + (dz / dist) * minDist;
  } else {
    // Dentro de la caja: salir por la cara más cercana
    const dl = p.x - box.minX, dr = box.maxX - p.x;
    const db = p.z - box.minZ, df = box.maxZ - p.z;
    const m = Math.min(dl, dr, db, df);
    if (m === dl) p.x = box.minX - minDist;
    else if (m === dr) p.x = box.maxX + minDist;
    else if (m === db) p.z = box.minZ - minDist;
    else p.z = box.maxZ + minDist;
  }
}

// Exportar para el módulo de navegación
export { entryRadius, isDynamic };
