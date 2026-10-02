# ADR-0003 — Ciclos de dependencia rotos por inyección + guardia check-scc

Estado: aceptado | Fecha: 2026-10-01
Relacionado: `tools/check-scc.js`, `tools/check-imports.cjs`, `js/main.js`, `js/undo.js`

## Contexto
Con módulos por efecto de evaluación, los imports circulares entre capas
(projectFiles ↔ catalog ↔ undo) rompen la inicialización o leen bindings sin
inicializar.

## Decisión
1. **Inyección en el orquestador**: `undo.js` no importa `projectFiles.js`
   para serializar; `main.js` —que conoce ambos lados sin circular— le pasa
   `{ serialize, apply }` vía `initUndo()`.
2. **Regla de oro**: las llamadas cruzadas dentro de ciclos restantes deben
   ser **diferidas** (no leer bindings del mismo SCC durante la evaluación).
3. **Guardias automáticas**: `check-imports` (todo import resuelve) y
   `check-scc` (cero ciclos + ningún módulo lee bindings de su SCC al
   evaluarse), ambos en `pnpm run check` y en CI.

## Consecuencias
- El grafo es **verificable por máquina**: un ciclo nuevo falla el CI antes
  de mergear.
- Costo: el patrón de inyección es inusual para quien entra al proyecto
  (compensado por el comentario en `main.js` y esta ADR).
