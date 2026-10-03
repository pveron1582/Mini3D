# Roadmap de mejoras — MiniStudio 3D

> Documento único con (I) los hallazgos de la revisión general del proyecto
> (2026-10-01), (II) el diagnóstico de madurez frente al Spec-Driven
> Development y (III) el plan para adoptarlo. Fuente de verdad para planificar;
> la implementación de cada ítem se registra en `CHANGELOG.md` y el detalle
> operativo sigue en `mini3d_mejoras.md`.

---

## Parte I — Revisión general del proyecto

### ✅ Fortalezas verificadas

1. **Suite de verificación en verde** — `pnpm run verify` pasa completo:
   imports resueltos, grafo sin ciclos (`check-scc`, incluye detección de
   lectura de bindings en evaluación), suite funcional (34 piezas de catálogo),
   load-test (`main.js` carga en ~790 ms) y geo-cache.
2. **Arquitectura coherente con la filosofía** — 56 módulos JS / ~796 KB,
   sin framework, sin build, Three.js vendorizado. Capas claras
   (`characters/`, `cinema/`, `ui/`, `media/`, `office/` + núcleo), estado
   centralizado en `state.js`, `main.js` como orquestador que rompe ciclos por
   inyección (`initUndo`).
3. **Documentación por encima del promedio** — `SKILL.md` con reglas aprendidas
   (el caso del `atan2` invertido), `GLM.md` como informe de estado vivo,
   `CHANGELOG.md` obligatorio, backlog priorizado en `mini3d_mejoras.md`.
4. **Soluciones técnicas pragmáticas** — renderer offscreen 1920×1080 con
   `output.renderer` para exportación independiente del tamaño de ventana;
   overlays (subtítulos/quiz) leen siempre `output.renderer`.
5. **Historial de git con mensajes descriptivos** (qué + por qué).

### 🔴 P0 — Higiene del repositorio (urgente)

| # | Hallazgo | Acción |
|---|---|---|
| P0-1 ✅ | **HEAD posiblemente roto**: `js/office/sceneCameras.js` estaba sin trackear pero `main.js` lo importa → un `clone` no cargaba. Además 9 archivos modificados sin commit. | **RESUELTO (2026-10-01)**: commits `4e30c6a` + `3138ae5` + `2df70f7`, pusheados. |
| P0-2 ✅ | **14 archivos de debug en la raíz** sin trackear: `_probe*.html`, `_dom_*.html`, `_idscheck.cjs`, `_proberun.cjs`, `_tmp_scan.py`, `_probe_err.txt`, más `tools/_scc2.cjs`. | **RESUELTO (2026-10-01)**: borrados; `.gitignore` excluye `/_*` y `tools/_scc*`. |
| P0-3 ✅ | Worktree `.kilo/worktrees/dent-article/` con copia completa del proyecto. | **RESUELTO (2026-10-01)**: worktree limpio y en ancestro de main → `git worktree remove` sin pérdida. |

### 🟡 P1 — Deuda técnica

| # | Hallazgo | Acción |
|---|---|---|
| P1-1 ✅ | **Sin CI** — el repo tiene `origin` en GitHub y scripts de verify listos. | **RESUELTO (2026-10-01)**: `.github/workflows/verify.yml` — `npm run verify` en push/PR a main; run #2 en verde. Nota: `test-geo-cache.js` ahora usa `p7-loader.mjs` (antes dependía del shim gitignorado de `node_modules/three`). |
| P1-2 ✅ | **`THREE.Clock` deprecado** en Three.js r0.185 — avisa en cada corrida y hace que PowerShell trate el stderr como error de la suite. | **RESUELTO (2026-10-01)**: migrado a `THREE.Timer` en `js/render.js` (`timer.update()` por frame + `connect(document)` para Page Visibility). Warning eliminado de la salida de tests. |
| P1-3 ✅ | **Tests sesgados al catálogo** — spawn/persistencia/carga bien cubiertos; timeline, imán (`tlSnap`), bloques de movimiento y A* con poca cobertura. | **RESUELTO (2026-10-01)**: +19 asserts — primeros tests de `navigation.js` (A*: desvío, fallback, multi-waypoint, guard clauses) y ampliación de tlSnap (exclude + subtítulos/quiz). Timeline y bloques ya tenían cobertura amplia (30+ secciones en `p7-test.mjs`). **P1 completo.** |

### 🟢 P2 — Arquitectura a futuro

| # | Hallazgo | Acción |
|---|---|---|
| P2-1 | Archivos que pesan: `characters.js` **75 KB**, `charTrack.js` 67 KB, `cinematics.js` 63 KB, `timeline.js` 59 KB, `ui.js` 48 KB. El split ya funcionó con `office/`. | Partir al tocarlos (regla: no refactor proactivo, refactor al editar). Candidatos: `characters/` → rigs/gestos/acciones; `charTrack.js` → bloques/movimiento/chooser. |
| P2-2 | Sin spec del formato JSON del proyecto (definido implícitamente en `projectFiles.js`). | Ver Parte II, spec `formato-json`. |

### 🔵 P3 — Menores

- `GLM.md`: ítem 7 "Más props educativos" duplicado consecutivo (~líneas 250/254).
- Typo `main.js:5`: "evaluución" → "evaluación".
- `archivo/` (docs históricos de Gemini): mover a `docs/historial/`.
- Raíz con 11 archivos `.md`: considerar consolidar tras la adopción SDD (ver Fase B).

---

## Parte II — Diagnóstico: madurez Spec-Driven Development

**Veredicto: ~30-40% de madurez.** Hay disciplina documental alta, pero la
documentación es **descriptiva e histórica** (qué se hizo) en lugar de
**prescriptiva** (qué se debe hacer, verificable). Flujo actual:
`código → CHANGELOG → informe`. Flujo SDD: `spec → código → test → CHANGELOG`.

### Qué existe ya (semillas de SDD)

| Artefacto | Rol actual | Qué le falta para SDD |
|---|---|---|
| `SKILL.md` | Guía técnica + reglas de trabajo. Lo más cercano a una spec. | Describe el sistema *como es*, no requisitos verificables *debe ser*. Sin IDs ni criterios de aceptación. |
| `mini3d_mejoras.md` | Backlog priorizado con ítems y criterios implícitos. | Sin IDs de requisitos, sin estado (borrador/aprobado/implementado/verificado), sin trazabilidad a tests. |
| `AGENTS.md` | Reglas de proceso para agentes. | Reglas *para* trabajar, pero sin artefactos *sobre* qué construir ni proceso "spec primero". |
| `CHANGELOG.md` | Trazabilidad de cambios de código (ejemplar). | No vincula cada cambio con la spec que lo autoriza. |
| `p7-test.mjs` | Criterios de aceptación ejecutables. | Huérfanos: ningún documento de requisitos los referencia. |
| `README.md` / `GLM.md` | Visión / estado. | Se solapan entre sí (síntoma de fuentes de verdad múltiples; ej. ítem 7 duplicado en GLM). |

### Qué falta (el salto real)

1. **`docs/specs/`** — estructura de especificaciones por dominio con plantilla
   común. Es el artefacto central del SDD.
2. **IDs de requisitos** (RF-01, RNF-01, ADR-01…) → trazabilidad
   `spec → test → CHANGELOG`.
3. **Spec del formato JSON del proyecto** — hoy el formato de archivo está
   definido *implícitamente* en `projectFiles.js`; cualquier agente que toque
   el serializador/deserializador puede romper escenas guardadas sin saberlo.
4. **Requisitos no funcionales medibles** — "pocos recursos" es filosofía, no
   criterio. Falta: fps objetivo, presupuesto de memoria, límite de
   dependencias, tamaño aceptable de arranque.
5. **ADRs** — decisiones clave ("sin build", "estado mutable central",
   "inyección para romper ciclos", "renderer offscreen 1080p fijo") viven en
   comentarios de código, no como decisiones justificadas que evitan
   re-discutirse.
6. **Proceso spec-first** — no existe la regla "todo cambio empieza tocando la
   spec". Hoy empieza en el chat (vibecoding): el conocimiento queda en
   conversaciones descartables y cada agente re-descubre decisiones.

### Qué NO hace falta (evitar burocracia)

- No hace falta un tool de specs (YAML/Gherkin, Cucumber, etc.): Markdown con
  plantilla y IDs basta, coherente con "sin dependencias".
- No hace falta reescribir todo: las specs se **extraen del material existente**
  (backlog, SKILL, GLM, tests) — es una reorganización, no escritura nueva.
- No hace falta specs para experimentación: mantener una zona "borrador" donde
  el vibecoding libre sigue siendo válido; la disciplina aplica al
  **mainstream del producto**.

---

## Parte III — Plan de adopción del Spec-Driven Development

### Fase A — Estructura base (1 sesión)

Crear:

```
docs/
├── specs/
│   ├── plantilla_spec.md        # formato estándar de toda spec
│   ├── 00-vision.md             # extraer de README (+ SKILL + GLM)
│   ├── 01-requisitos.md         # RF-01…RF-nn: funcionalidades + backlog
│   ├── 02-no-funcionales.md     # RNF-01…: fps, memoria, dependencias, arranque
│   ├── 03-formato-json.md       # esquema del proyecto JSON (leer projectFiles.js)
│   └── 04-flujos-usuario.md     # crear escena → timeline → exportar
└── adr/
    ├── 0001-sin-build.md
    ├── 0002-estado-central-mutable.md
    ├── 0003-ciclos-rotos-por-inyeccion.md
    └── 0004-renderer-offscreen-1080p.md
```

**Plantilla de spec** (mínima y efectiva):

```markdown
# RF-XX — <nombre>
Estado: borrador | aprobado | implementado | verificado
Spec: qué debe hacer el sistema (prescriptivo, no "qué se hizo")
Criterios de aceptación:
- [ ] verificable concretamente (ideal: test o paso manual único)
Depende de: RF-YY
Trazabilidad: test(s) que lo cubren / CHANGELOG de implementación
```

### Fase B — Extracción y consolidación (1-2 sesiones)

1. **`01-requisitos.md`**: convertir los ítems de `mini3d_mejoras.md` y las
   funcionalidades ya implementadas en RFs numerados (`verificado` si tiene
   test, `implementado` si existe sin test).
2. **`02-no-funcionales.md`**: convertir la filosofía en criterios medibles
   (ej. ≥60 fps en oficina poblada, 0 dependencias npm en runtime, arranque
   <2 s, proyecto JSON <1 MB).
3. **`03-formato-json.md`**: documentar el esquema actual leyendo
   `serializeProject`/`applyProject` — prioridad alta por el riesgo de rotura
   silenciosa de escenas guardadas.
4. **Consolidar fuentes**: `README` (visión pública), `SKILL.md` (guía de
   trabajo), `GLM.md` (estado) — la spec manda; los demás apuntan a
   `docs/specs/`. Arreglar el ítem 7 duplicado de GLM en el camino.
5. **Vincular tests**: cada bloque de `p7-test.mjs` referenciar el RF-XX que
   valida (comentario de una línea).

### Fase C — Proceso spec-first (reglas, no herramientas)

Agregar a `AGENTS.md` + `SKILL.md`:

1. **Todo cambio de producto empieza tocando la spec** (crear/editar un RF en
   `docs/specs/`) antes de escribir código: estado `borrador` → `aprobado`
   antes de implementar.
2. **El agente implementa contra la spec, no contra el chat**: si el pedido no
   existe en una spec, el primer paso es escribirla (o marcarla `borrador` y
   pedir confirmación).
3. **Cierre de ciclo obligatorio**: criterios marcados, estado de la spec
   actualizado, entrada en `CHANGELOG.md` referenciando el RF-XX. (La regla
   del CHANGELOG ya existe; se agrega el referenciamiento.)
4. **Zona libre**: experimentos pueden vivir sin spec (rama o estado
   `borrador`); nada mergea a main sin spec `aprobado`.

### Fase D — Mantenimiento y enforcement (continuo) ✅ HECHA (2026-10-01)

- CI (P1-1): `pnpm run verify` en GitHub Actions. ✅
- Check en `tools/`: **`tools/check-specs.cjs`** — estados de RF válidos,
  cero IDs fantasma (RF/RNF referenciados inexistentes), entradas del
  CHANGELOG desde 2026-10-01 con `RF-XX` o `(infra)`. Corre en
  `pnpm run check`/`verify` → CI.
- Regla "refactor al editar" para P2-1: **`SKILL.md` regla 9**. ✅

### Orden de ejecución recomendado

```
1. P0-1 (commit del lote pendiente)        ← bloquea todo lo demás
2. P0-2 (limpiar temporales + gitignore)
3. Fase A (estructura docs/specs + plantilla + ADRs base)  ✅ HECHA (2026-10-01)
4. Fase B.3 (spec del formato JSON)        ← ✅ ADELANTADA: `docs/specs/03-formato-json.md`
5. P1-1 (CI) + P1-2 (THREE.Timer)
6. Fase B resto (requisitos, no funcionales, trazabilidad de tests)  ✅ HECHA (2026-10-01: 59 secciones de p7-test etiquetadas RF-XX + consolidación de fuentes)
7. Fase C (reglas spec-first en AGENTS/SKILL)  ✅ HECHA (2026-10-01: regla 8)
8. P1-3 (tests timeline/A*) + P2-1 (refactor bajo demanda)
9. P3 (menores) + Fase D (enforcement continuo)
```

### Definición de hecho (todo ítem de este roadmap)

- [ ] Spec relacionada en estado `verificado` (o ítem sin componente de spec).
- [ ] `pnpm run verify` en verde.
- [ ] Entrada en `CHANGELOG.md` referenciando el RF-XX o el ítem del roadmap.
