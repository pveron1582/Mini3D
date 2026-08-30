// tools/check-scc.js — guardia del ítem P5 (ciclos de import, ver mejoras_glm.md)
//
// Verifica la invariante que hace benignos los ciclos de import: NINGÚN módulo
// lee, durante su evaluación top-level, bindings importados de otro módulo que
// pertenezca al MISMO SCC (componente fuertemente conexo del grafo de imports).
// Una lectura prematura de un módulo aún no evaluado devolvería undefined (o
// dispararía TDZ) — esa es la única forma real de que un ciclo explote.
//
// - Construye el grafo de imports de js/*.js + js/office/*.js.
// - Calcula los SCC con Tarjan.
// - Revisa las sentencias top-level de cada módulo (profundidad de llaves 0)
//   y marca las que invocan/leen un binding importado desde su mismo SCC,
//   salvo patrones seguros: cierres no invocados (arrow fns), registro
//   diferido (queueMicrotask/setTimeout/addEventListener), lookups DOM y
//   primitivos.
//
// Uso: node tools/check-scc.js  → exit 1 si hay riesgo de orden de evaluación.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['js', 'js/office'];
const files = DIRS.flatMap((d) =>
  readdirSync(join(root, d)).filter((f) => f.endsWith('.js')).map((f) => d + '/' + f)
);
const resolveImport = (from, spec) => {
  if (!spec.startsWith('.')) return null;
  const abs = resolve(dirname(join(root, from)), spec).replace(/\\/g, '/');
  const rel = abs.slice(root.replace(/\\/g, '/').length + 1);
  return files.find((f) => f === rel || rel === f.replace(/\.js$/, '') + '.js') || null;
};

// grafo: módulo -> deps; bindings: módulo -> Map(binding -> módulo origen)
const graph = new Map(), bindings = new Map();
for (const f of files) {
  const text = readFileSync(join(root, f), 'utf8');
  const deps = new Set(), bmap = new Map();
  const addDep = (spec) => { const d = resolveImport(f, spec); if (d) deps.add(d); return d; };
  for (const m of text.matchAll(/import\s*{([^}]+)}\s*from\s*'([^']+)'/g)) {
    const dep = addDep(m[2]);
    if (!dep) continue;
    for (const b of m[1].split(',')) {
      const binding = b.trim().split(/\s+as\s+/).pop().trim();
      if (binding) bmap.set(binding, dep);
    }
  }
  for (const m of text.matchAll(/import\s*\*\s*as\s*(\w+)\s*from\s*'([^']+)'/g)) {
    const dep = addDep(m[2]); if (dep) bmap.set(m[1], dep);
  }
  for (const m of text.matchAll(/import\s+\w+\s+from\s*'([^']+)'/g)) addDep(m[1]);
  graph.set(f, deps); bindings.set(f, bmap);
}

// Tarjan SCC
const index = new Map(), low = new Map(), onStack = new Set(), stack = [];
let counter = 0;
const sccOf = new Map(), sccs = [];
function strongconnect(v) {
  index.set(v, counter); low.set(v, counter); counter++;
  stack.push(v); onStack.add(v);
  for (const w of graph.get(v) || []) {
    if (!index.has(w)) { strongconnect(w); low.set(v, Math.min(low.get(v), low.get(w))); }
    else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
  }
  if (low.get(v) === index.get(v)) {
    const comp = []; let w;
    do { w = stack.pop(); onStack.delete(w); comp.push(w); sccOf.set(w, sccs.length); } while (w !== v);
    sccs.push(comp);
  }
}
for (const f of files) if (!index.has(f)) strongconnect(f);

// ---------- auditoría de sentencias top-level ----------
const SAFE = [
  /=>\s*\{?\s*$/,                                   // arrow: el cuerpo es diferido
  /queueMicrotask\(|setTimeout\(|setInterval\(/,    // diferido explícito
  /\.addEventListener\(/,                            // registro diferido
];
const PRIMITIVE = /^(const|let|var)\s+\w+\s*=\s*(true|false|null|undefined|-?\d|['"`])/;

let problemas = 0;
for (const f of files) {
  const comp = sccs[sccOf.get(f)];
  if (comp.length < 2) continue; // sin ciclo: el orden lo resuelve el grafo
  const sameScc = new Set(comp);
  const bmap = bindings.get(f);
  const risky = new Map();
  for (const [b, dep] of bmap) if (sameScc.has(dep)) risky.set(b, dep);
  if (risky.size === 0) continue;

  const text = readFileSync(join(root, f), 'utf8');
  const lines = text.split('\n');
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (depth === 0 && raw.trim() && !/^\s*(\/\/|\*|\/\*)/.test(raw)) {
      const line = raw.trim();
      if (/^import\b/.test(line)) { /* sentencia import: no ejecuta bindings */ }
      else {
      const used = [...risky.keys()].filter((b) => new RegExp('\\b' + b + '\\b').test(line));
      if (used.length && !PRIMITIVE.test(line) && !SAFE.some((re) => re.test(line))) {
        // Uso como cierre: el binding aparece después de una flecha `=>`
        // (la función no se invoca al evaluarse).
        const arrowIdx = line.indexOf('=>');
        const soloCierre = arrowIdx !== -1 && used.every((b) => line.indexOf(b) > arrowIdx);
        if (!soloCierre) {
        problemas++;
        console.log(`PELIGRO ${f}:${i + 1} — top-level lee bindings de su mismo SCC (${used.map((b) => `${b} ← ${risky.get(b)}`).join(', ')}):`);
        console.log(`   ${line}`);
        }
      }
      }
    }
    const clean = raw.replace(/\/\/.*$/, '').replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
    depth += (clean.match(/{/g) || []).length - (clean.match(/}/g) || []).length;
    if (depth < 0) depth = 0;
  }
}

const ciclos = sccs.filter((c) => c.length > 1);
console.log(`SCCs con ciclo: ${ciclos.map((c) => c.length + ' módulos: ' + c.map((m) => m.replace(/^js\//, '')).join(', ')).join(' | ') || 'ninguno'}`);
if (problemas === 0) {
  console.log('✓ check-scc OK — ningún módulo lee bindings de su mismo SCC al evaluarse');
  console.log('  (todas las llamadas cruzadas dentro de ciclos son diferidas).');
} else {
  console.log(`✗ ${problemas} riesgo(s) de orden de evaluación — diferir con queueMicrotask/init()`);
  process.exit(1);
}
