// tools/check-specs.cjs — Enforcer de Spec-Driven Development (Fase D del
// roadmap). Corre dentro de `pnpm run verify` (y por lo tanto en el CI de
// GitHub Actions): la regla 8 de SKILL.md deja de ser disciplina social y
// pasa a ser código que falla el push si se rompe.
//
// Valida tres cosas:
//   1. Toda spec (docs/specs/0x-*.md) declara Estado y los RFs tienen un
//      estado de la lista: borrador | aprobado | implementado | verificado.
//   2. Todo RF-XX / RNF-XX referenciado en el repo EXISTE en la spec que lo
//      define (trazabilidad inversa: no se referencian IDs fantasma).
//   3. Toda entrada del CHANGELOG desde 2026-10-01 (adopción SDD) referencia
//      al menos un RF-\d+ válido o lleva "(infra)" en su título (cambios de
//      CI/docs/proceso que no corresponden a un requisito de producto).
//
// Uso: node tools/check-specs.cjs  (exit 1 = violaciones)

const fs = require('fs');
const path = require('path');

const ESTADOS = new Set(['borrador', 'aprobado', 'implementado', 'verificado']);
const SDD_SINCE = '2026-10-01'; // fecha de adopción: entradas anteriores quedan exentas

const SPEC_REQ = 'docs/specs/01-requisitos.md';
const SPEC_RNF = 'docs/specs/02-no-funcionales.md';

let errors = 0;
const fail = (msg) => { console.error('  ✗ ' + msg); errors++; };

// ---------- 1. Definiciones + estados de RF ----------
const reqSrc = fs.readFileSync(SPEC_REQ, 'utf8');
const rfBlocks = reqSrc.split(/^### /m).slice(1); // primer trozo = preámbulo
const rfDefs = new Map(); // RF-XX -> estado | null
for (const b of rfBlocks) {
  const m = b.match(/^(RF-\d+)\b/);
  if (!m) continue;
  const em = b.match(/^\s*Estado:\s*`?([a-zá]+)`?/mi);
  rfDefs.set(m[1], em ? em[1] : null);
}
if (rfDefs.size === 0) fail(`no se encontró ningún RF definido en ${SPEC_REQ}`);

for (const [id, estado] of rfDefs) {
  if (estado === null) fail(`${id} sin línea "Estado:"`);
  else if (!ESTADOS.has(estado)) fail(`${id} tiene estado inválido: "${estado}" (válidos: ${[...ESTADOS].join(', ')})`);
}

// ---------- RNF: IDs definidos (estado global en el header del archivo) ----------
const rnfSrc = fs.readFileSync(SPEC_RNF, 'utf8');
const rnfDefs = new Set([...rnfSrc.matchAll(/^##\s+(RNF-\d+)\b/gm)].map(m => m[1]));
if (rnfDefs.size === 0) fail(`no se encontró ningún RNF en ${SPEC_RNF}`);
if (!/^Estado:/m.test(rnfSrc)) fail(`${SPEC_RNF} sin "Estado:" global en el encabezado`);

// ---------- 2. Toda spec declara Estado ----------
for (const f of fs.readdirSync('docs/specs').filter(f => /^\d\d-.*\.md$/.test(f))) {
  const src = fs.readFileSync(path.join('docs/specs', f), 'utf8');
  if (!/^Estado:/m.test(src)) fail(`docs/specs/${f} sin línea "Estado:"`);
}

// ---------- 3. IDs fantasma: referenciados pero no definidos ----------
function walk(dir, acc = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (f === 'vendor' || f === 'node_modules' || f === '.git' || f === 'archivo') continue;
    if (fs.statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(md|mjs|js|cjs|html)$/.test(f)) acc.push(p);
  }
  return acc;
}
const scanFiles = ['CHANGELOG.md', 'README.md', 'AGENTS.md', 'SKILL.md', 'GLM.md',
  'roadmap_mejoras.md', 'mini3d_mejoras.md', 'package.json']
  .filter(f => fs.existsSync(f)).concat(walk('docs'), walk('tools'), walk('js'));

const phantomRF = new Map(), phantomRNF = new Map();
for (const f of scanFiles) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bRF-(\d+)\b/g)) {
    const id = 'RF-' + m[1];
    if (!rfDefs.has(id)) phantomRF.set(id, f);
  }
  for (const m of src.matchAll(/\bRNF-(\d+)\b/g)) {
    const id = 'RNF-' + m[1];
    if (!rnfDefs.has(id)) phantomRNF.set(id, f);
  }
}
for (const [id, f] of phantomRF) fail(`${id} referenciado en ${f} pero NO existe en ${SPEC_REQ}`);
for (const [id, f] of phantomRNF) fail(`${id} referenciado en ${f} pero NO existe en ${SPEC_RNF}`);

// ---------- 4. CHANGELOG reciente: RF o (infra) ----------
const clSrc = fs.readFileSync('CHANGELOG.md', 'utf8');
const entries = clSrc.split(/^## /m).slice(1);
let recientes = 0;
for (const e of entries) {
  const dm = e.match(/^\[(\d{4}-\d{2}-\d{2})\]/);
  if (!dm || dm[1] < SDD_SINCE) continue;
  recientes++;
  const titulo = e.split('\n')[0];
  const tieneRF = /\bRF-\d+\b/.test(e);
  const esInfra = /\(infra\)/.test(titulo);
  if (!tieneRF && !esInfra) {
    fail(`entrada CHANGELOG sin RF-XX ni "(infra)" en el título: "${titulo.slice(0, 80)}"`);
  }
}

if (errors) {
  console.error(`\ncheck-specs: ${errors} violación(es). Ver regla 8 de SKILL.md y plantilla_spec.md.`);
  process.exit(1);
}
console.log(`✓ check-specs OK — ${rfDefs.size} RFs (${[...rfDefs.values()].filter(e => e === 'verificado').length} verificados, ${[...rfDefs.values()].filter(e => e === 'borrador').length} en borrador), ${rnfDefs.size} RNFs, ${recientes} entradas de CHANGELOG con SDD, 0 IDs fantasma`);
