// tools/fix-encoding.mjs — repara mojibake UTF-8→Latin-1→UTF-8 en js/
// Causa: reescrituras con PowerShell (Get-Content ANSI + Set-Content UTF8)
// sobre archivos UTF-8 sin BOM ("Diseñadora" → "DiseÃ±adora").
//
// Estrategia: recorrer el texto; cada run de caracteres U+0080–U+00FF se
// interpreta como bytes Latin-1 y se intenta decodificar como UTF-8. Si la
// decodificación es válida (sin U+FFFD y roundtrip estable), se reemplaza;
// si no (p. ej. un 'ñ' legítimo aislado), se deja como está. Los caracteres
// >U+00FF (emojis correctos, etc.) pasan intactos.
//
// Uso: node tools/fix-encoding.mjs  (reporta y repara in-place)

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MARKERS = /Ã.|ð|â€|Â[¿¡°]|â[\u0080-\u00ff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013\u2014\u2018\u2019\u201a\u201c\u201d\u201e\u2020\u2021\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]/;

// Chars >U+00FF que Windows-1252 produce al malinterpretar bytes UTF-8 altos
const CP1252_EXTRA = {
  '\u0152': 0x8c, '\u0153': 0x9c, '\u0160': 0x8a, '\u0161': 0x9a,
  '\u0178': 0x9f, '\u017d': 0x8e, '\u017e': 0x9e, '\u0192': 0x83,
  '\u02c6': 0x88, '\u02dc': 0x98, '\u2013': 0x96, '\u2014': 0x97,
  '\u2018': 0x91, '\u2019': 0x92, '\u201a': 0x93, '\u201c': 0x93,
  '\u201d': 0x94, '\u201e': 0x85, '\u2020': 0x86, '\u2021': 0x87,
  '\u2022': 0x95, '\u2026': 0x85, '\u2030': 0x89, '\u2039': 0x8b,
  '\u203a': 0x9b, '\u20ac': 0x80, '\u2122': 0x99,
};

function repair(s) {
  const byteOf = (c) => {
    const cp = c.charCodeAt(0);
    if (cp >= 0x80 && cp <= 0xff) return cp;
    if (CP1252_EXTRA[c] !== undefined) return CP1252_EXTRA[c];
    return null; // no es producto del mojibake (p. ej. '→' correcto): corta el run
  };
  let out = '';
  let i = 0;
  while (i < s.length) {
    if (byteOf(s[i]) !== null) {
      let j = i;
      const bytes = [];
      while (j < s.length) {
        const b = byteOf(s[j]);
        if (b === null) break;
        bytes.push(b);
        j++;
      }
      const buf = Buffer.from(bytes);
      const dec = buf.toString('utf8');
      const estable = !dec.includes('\uFFFD') && Buffer.from(dec, 'utf8').equals(buf);
      out += estable ? dec : s.slice(i, j);
      i = j;
    } else {
      out += s[i];
      i++;
    }
  }
  return out;
}

const files = ['js', 'js/office'].flatMap((d) =>
  readdirSync(join(root, d)).filter((f) => f.endsWith('.js')).map((f) => d + '/' + f)
);

let reparados = 0;
for (const f of files) {
  const p = join(root, f);
  let text = readFileSync(p, 'utf8');
  if (!MARKERS.test(text)) continue;
  let pasadas = 0;
  while (MARKERS.test(text) && pasadas < 3) {
    const nuevo = repair(text);
    if (nuevo === text) break; // no se puede avanzar más
    text = nuevo;
    pasadas++;
  }
  // quitar BOM duplicado si quedó (un solo BOM al inicio como máximo)
  text = text.replace(/^\uFEFF/, '');
  writeFileSync(p, text, 'utf8');
  reparados++;
  console.log(`reparado (${pasadas} pasada/s): ${f}`);
}
console.log(reparados ? `✓ ${reparados} archivo(s) reparados` : '✓ sin mojibake detectado');
