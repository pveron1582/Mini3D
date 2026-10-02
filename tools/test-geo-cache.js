// Test de humo P9: verifica que geoCache deduplica primitivas idénticas.
// Uso: node tools/test-geo-cache.js
// Resuelve 'three' → vendor/three.module.js vía p7-loader.mjs (mismo loader
// que p7-test/p7-loadtest): así el test corre también en CI, sin necesitar el
// shim manual de node_modules/three (que está en .gitignore).
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./p7-loader.mjs', pathToFileURL('./tools/'));

const { box, sphere, geoCacheSize } = await import('../js/office/geoCache.js');

const a = box(0.06, 0.76, 0.85);
const b = box(0.06, 0.76, 0.85);
const c = box(1, 2, 3);
const s1 = sphere(0.045, 10, 8);
const s2 = sphere(0.045, 10, 8);

console.assert(a === b, 'ERROR: box igual debería ser misma instancia');
console.assert(c !== a, 'ERROR: box distinta no debe compartir');
console.assert(s1 === s2, 'ERROR: sphere igual debería ser misma instancia');
console.assert(geoCacheSize() === 3, `ERROR: caché esperaba 3, hay ${geoCacheSize()}`);
console.log('✓ test-geo-cache OK — instancias únicas en caché:', geoCacheSize());

