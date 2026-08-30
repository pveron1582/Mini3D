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
