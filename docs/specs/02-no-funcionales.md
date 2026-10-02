# 02 — Requisitos no funcionales (RNF)

Estado: `borrador` (pendiente de aprobación; ver `plantilla_spec.md`)
Cada RNF tiene **verificación**: cómo se comprueba hoy.

## RNF-01 — Cero dependencias en runtime
El proyecto no instala nada para ejecutarse: `package.json` no tiene
`dependencies`/`devDependencies`; Three.js vive en `vendor/`.
- Justificación: filosofía "sin dependencias pesadas"; arranque instantáneo
  y offline.
- Verificación: `package.json` sin claves de dependencias (revisión manual
  en cada PR que toque el archivo).

## RNF-02 — Sin build ni bundler
Todo son ES Modules nativos servidos tal cual; `index.html` usa import map
hacia `vendor/`. Prohibido introducir Webpack/Vite/Rollup/esbuild.
- Justificación: filosofía "sin build"; depuración directa en DevTools.
- Verificación: no existen archivos de config de bundler; `check-imports`
  valida el grafo de imports directo.

## RNF-03 — Rendimiento en edición ≥60 fps
La oficina poblada (9+ personajes, props, luces) debe mantener ≥60 fps en
una PC modesta (referencia medida: ~112 fps en 2026-08-23, GLM.md).
- Verificación: HUD de fps del editor (`hudFps`) en escena poblada;
  regressión a investigar si cae de forma sostenida.

## RNF-04 — Arranque < 2 s
Desde `boot.js` hasta el editor usable (proyecto nuevo).
- Verificación: `tools/p7-loadtest.mjs` (hoy `main.js` carga en ~0,5-0,8 s
  en Node; el CI lo vigila).

## RNF-05 — Proyecto JSON < 1 MB sin audio embebido
Los proyectos sin `audioData` deben ser pequeños (la escena de referencia
`alarma_en_la_red.json` pesa ~34 KB) para diffs y sharing.
- Verificación: revisar tamaño al agregar campos nuevos al serializador.

## RNF-06 — Export 1080p 60 fps fija
El video se renderiza offscreen a 1920×1080 con pasos de simulación de
1/30 s, independiente del tamaño de la ventana.
- Verificación: `p7-test` cubre `SIM_STEP` y `consumeSimTime`; ver
  RF de exportación en `01-requisitos.md`.

## RNF-07 — Sin regresiones sin cubrir: `verify` en verde
Todo cambio mergea con `pnpm run verify` en verde (imports + ciclos +
suite funcional + carga + geo-cache), local y en CI (GitHub Actions).
- Verificación: workflow `verify.yml` en cada push/PR a `main`.

## RNF-08 — Un solo Three.js, vendorizado
`vendor/` es la única copia en uso (import map + loader de tests).
Prohibido importar Three.js desde CDN o npm.
- Verificación: `check-imports` + revisión de `index.html`/`p7-loader.mjs`.

## RNF-09 — Corre en cualquier servidor estático
No hay backend: basta un static host (`serve.py`, nginx, GitHub Pages).
Los endpoints opcionales (listado de `scenes/`) degradan con `file://` o
hosts sin director listing.
- Verificación: carga del editor sin `serve.py` no debe romper (modo degradado).

## RNF-10 — UI en español
Todos los textos de interfaz, mensajes de estado y comentarios en español.
- Verificación: revisión manual en PR (no hay i18n por diseño).
