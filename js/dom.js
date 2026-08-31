// js/dom.js — acceso a DOM agrupado (diferido P6, ver mejoras_glm.md)
//
// Antes cada módulo llamaba `document.getElementById(...)` directamente
// (~175 llamadas repartidas en 15 archivos). Ahora los lookups pasan por aquí:
//
// - `byId(id)`: memoizado. Solo cachea resultados NO nulos, así que si un
//   elemento aparece más tarde en el DOM se lo encuentra en la siguiente
//   llamada. Regla de uso: la UI de `index.html` es estática; si algún día un
//   elemento se elimina y se recrea con el mismo id, invalidar el caché aquí.
// - `qs(sel)` / `qsa(sel)`: wrappers sin caché (los NodeList y resultados de
//   selector pueden depender de contenido dinámico).

const byIdCache = new Map();

export function byId(id) {
  if (byIdCache.has(id)) return byIdCache.get(id);
  const node = document.getElementById(id);
  if (node) byIdCache.set(id, node);
  return node;
}

export function qs(selector) {
  return document.querySelector(selector);
}

export function qsa(selector) {
  return document.querySelectorAll(selector);
}

// Muestra/oculta el hint tipo subtítulo abajo del viewport (#viewportHint).
// Sirve para instrucciones de modos interactivos (elegir asiento, dibujar
// canaleta…): texto grande legible sobre banda oscura, como un subtítulo.
// `sticky: true` lo mantiene visible hasta el próximo show/hide (modos que
// esperan una acción del usuario); sin sticky se oculta solo a los ~2.6 s.
let vhTimer = null;
export function showViewportHint(text, { sticky = false } = {}) {
  const el = byId('viewportHint');
  if (!el) return;
  if (vhTimer) { clearTimeout(vhTimer); vhTimer = null; }
  if (!text) { el.style.display = 'none'; return; }
  el.textContent = text;
  el.style.display = 'block';
  if (!sticky) vhTimer = setTimeout(() => { el.style.display = 'none'; }, 2600);
}
