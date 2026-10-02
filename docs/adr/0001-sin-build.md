# ADR-0001 — Sin build, sin framework, sin dependencias

Estado: aceptado | Fecha: 2026-10-01 (documenta decisión vigente desde el inicio)
Relacionado: RNF-01, RNF-02, RNF-08 (`02-no-funcionales.md`)

## Contexto
El producto debe correr fluido en PCs modestas y ser editable por una sola
persona sin pipeline. Cada dependencia/build añade fricción (instalación,
versiones, vulnerabilidades) y aleja a usuarios no expertos.

## Decisión
- Vanilla JS con ES Modules nativos, sin framework ni bundler.
- Three.js r0.185 vendorizado en `vendor/` (única copia); import map en
  `index.html` para el navegador y `p7-loader.mjs` para los tests Node.
- `package.json` sin `dependencies`/`devDependencies`; `node_modules/` solo
  existe localmente como shim manual para tests (no parte del producto).

## Consecuencias
- Pros: arranque instantáneo, offline, depuración directa en DevTools, cero
  roturas por updates externos, onboarding = abrir una carpeta.
- Contras: sin TypeScript (disciplina manual), sin tree-shaking (se carga
  Three completo), sin HMR (recargar página).
- Si alguna vez se necesita una librería: evaluar costo/beneficio explícito
  (SKILL.md regla 1) y probablemente vendorizarla en vez de npm-instalarla.
