// Validación post-split: sintaxis + imports/exports + referencias faltantes.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const DIR = 'js/office';
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.js'));

// 1) Sintaxis: copiar a .mjs y node --check
for (const f of files) {
  const tmp = path.join('tools', '__chk_' + f.replace(/\.js$/, '.mjs'));
  fs.copyFileSync(path.join(DIR, f), tmp);
  try {
    execSync(`node --check "${tmp}"`, { stdio: 'pipe' });
    console.log(`sintaxis OK: ${f}`);
  } catch (e) {
    console.log(`SINTAXIS ERROR ${f}:\n${e.stderr}`);
  } finally { fs.unlinkSync(tmp); }
}

// 2) Mapa de exports por módulo
const parseImports = (src) => {
  const out = []; // { names:[{local, imported}], source }
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*'([^']+)'/g)) {
    const names = m[1].split(',').map(s => s.trim()).filter(Boolean)
      .map(s => { const [i, l] = s.split(/\s+as\s+/); return { imported: i.trim(), local: (l || i).trim() }; });
    out.push({ names, source: m[2] });
  }
  for (const m of src.matchAll(/import\s*\*\s*as\s+(\w+)\s*from\s*'([^']+)'/g)) out.push({ names: [{ imported: '*', local: m[1] }], source: m[2] });
  return out;
};
const exportsOf = {};
for (const f of files) {
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s+const\s+(\w+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s+\{([^}]+)\}/g)) m[1].split(',').forEach(s => names.add(s.trim().split(/\s+as\s+/)[0].trim()));
  exportsOf[f] = names;
}
console.log('\nexports:', Object.fromEntries(Object.entries(exportsOf).map(([f, n]) => [f, [...n].join(',')])));

// 3) Validar cada import contra su módulo de origen
let bad = 0;
for (const f of files) {
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  for (const imp of parseImports(src)) {
    const base = path.basename(imp.source);
    if (!exportsOf[base]) { console.log(`AVISO ${f}: importa '${imp.source}' (fuera de office/) — no se valida aquí`); continue; }
    for (const n of imp.names) {
      if (n.imported === '*') continue;
      if (!exportsOf[base].has(n.imported)) { console.log(`ERROR ${f}: importa { ${n.imported} } pero ${base} no lo exporta`); bad++; }
    }
  }
}

// 4) Referencias faltantes: nombres candidatos (exportados por hermanos) usados sin importar/declarar
const GLOBALS = new Set(['THREE','Math','JSON','Object','console','document','window','Array','Number','String','Boolean','Set','Map','parseFloat','parseInt','isNaN','undefined','performance','requestAnimationFrame','URL','Blob','navigator','location','Error','Symbol','Promise','Intl','Date','RegExp']);
for (const f of files) {
  const src = fs.readFileSync(path.join(DIR, f), 'utf8');
  const declared = new Set();
  for (const m of src.matchAll(/(?:const|let|var|function|class)\s+(\w+)/g)) declared.add(m[1]);
  for (const m of src.matchAll(/function\s*[^(]*\(([^)]*)\)/g)) m[1].split(',').forEach(p => { const n = p.trim().split(/[=\s]/)[0]; if (n) declared.add(n.replace(/^\.\.\./, '')); });
  for (const imp of parseImports(src)) imp.names.forEach(n => declared.add(n.local));
  const candidates = new Set(); Object.entries(exportsOf).forEach(([mod, names]) => { if (mod !== f) names.forEach(n => candidates.add(n)); });
  const used = new Set();
  for (const m of src.matchAll(/(?<![.\w$'"])([A-Za-z_$][\w$]*)\s*\(/g)) used.add(m[1]); // llamadas f(...)
  for (const m of src.matchAll(/(?<![.\w$'"])([A-Za-z_$][\w$]*)/g)) used.add(m[1]);
  const missing = [...used].filter(n => candidates.has(n) && !declared.has(n) && !GLOBALS.has(n));
  if (missing.length) console.log(`FALTAN IMPORTS en ${f}: ${missing.join(', ')}`); bad += missing.length ? 1 : 0;
}
console.log(bad === 0 ? '\n✓ Validación cruzada sin errores' : `\n✗ ${bad} problemas`);
