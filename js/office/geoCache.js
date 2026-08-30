// js/office/geoCache.js — caché de geometrías primitivas compartidas (P9)
//
// Todas las fábricas del entorno repiten primitivas idénticas (miles de
// `new THREE.BoxGeometry(0.06, 0.76, 0.85)` iguales entre sí). Compartir la
// MISMA instancia de geometría entre meshes es seguro y no afecta al editor:
// cada mesh conserva su propia transformación, selección, gizmo, colisión y
// sombras (a diferencia de InstancedMesh/merge, que rompen la selección
// individual — ver mejoras_glm.md P9).
//
// Regla de uso: solo primitivas de argumentos numéricos que NO se mutan después
// de crearlas (nada de .translate()/.rotateX()/.scale() sobre la geometría ni
// .dispose()). Para geometrías mutadas o por Shape, usar `new THREE.X...`
// directo como siempre.

import * as THREE from 'three';

const cache = new Map();

function makeCached(Ctor, label) {
  return (...args) => {
    const key = label + ':' + args
      .map((a) => (typeof a === 'number' ? Math.round(a * 1e6) / 1e6 : String(a)))
      .join(',');
    let g = cache.get(key);
    if (!g) {
      g = new Ctor(...args);
      cache.set(key, g);
    }
    return g;
  };
}

export const box = makeCached(THREE.BoxGeometry, 'box');
export const cylinder = makeCached(THREE.CylinderGeometry, 'cyl');
export const sphere = makeCached(THREE.SphereGeometry, 'sph');
export const plane = makeCached(THREE.PlaneGeometry, 'plane');
export const cone = makeCached(THREE.ConeGeometry, 'cone');
export const ring = makeCached(THREE.RingGeometry, 'ring');
export const torus = makeCached(THREE.TorusGeometry, 'torus');
export const circle = makeCached(THREE.CircleGeometry, 'circle');
export const capsule = makeCached(THREE.CapsuleGeometry, 'capsule');
export const icosahedron = makeCached(THREE.IcosahedronGeometry, 'ico');
export const tetrahedron = makeCached(THREE.TetrahedronGeometry, 'tetra');
export const octahedron = makeCached(THREE.OctahedronGeometry, 'octa');
export const dodecahedron = makeCached(THREE.DodecahedronGeometry, 'dodeca');

// Solo para diagnóstico/tests: cantidad de geometrías únicas en caché.
export function geoCacheSize() {
  return cache.size;
}
