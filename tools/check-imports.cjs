const fs = require('fs'), path = require('path');
function walk(dir, acc = []) { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); const s = fs.statSync(p); if (s.isDirectory()) walk(p, acc); else if (f.endsWith('.js')) acc.push(p); } return acc; }
let bad = 0;
for (const f of walk('js')) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/from\s+'(\.[^']+)'/g)) {
    const resolved = path.resolve(path.dirname(f), m[1]);
    if (!fs.existsSync(resolved)) { console.log('ROTO:', f, '->', m[1]); bad++; }
  }
  for (const m of src.matchAll(/import\s+'(\.[^']+)'/g)) {
    const resolved = path.resolve(path.dirname(f), m[1]);
    if (!fs.existsSync(resolved)) { console.log('ROTO:', f, '->', m[1]); bad++; }
  }
}
console.log(bad === 0 ? 'todos los imports resuelven OK' : bad + ' imports rotos');
