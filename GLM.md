# Revisión del proyecto — Mini 3D (MiniStudio 3D)

> Informe de revisión realizado por GLM el 2026-08-21.
>
> **Actualización 2026-08-23 (ZCode)**: verificado en navegador (carga sin errores,
> ~112 FPS, UI funcional). Realizada la limpieza pendiente: eliminados `app.js`,
> `node_modules/` y los bindings huérfanos de cinemática (detalle en
> `CHANGELOG.md`). Los ítems resueltos están tachados.
>
> **Actualización 2026-08-23 (Docs)**: se preparó la documentación base del
> proyecto y se agregó un `README.md` con la visión general, objetivos y guía
> de ejecución. El repositorio queda claro y listo para continuar el desarrollo
> de MiniStudio 3D como proyecto open-source ligero y orientado a producción de
> clips 3D.
>
> **Actualización 2026-08-23 (Branding)**: se incorporó una portada visual en
> `assets/mini3d-cover.svg` y se renovó la presentación del repositorio para un
> tono más premium y profesional, manteniendo el enfoque técnico y abierto del
> proyecto.
>
> **Actualización 2026-08-27 (Estado)**: oficina poblada con 9 empleados
> (5 nuevos, sentados tipeando en sus PCs), cocina/comedor mudada a la oficina
> este, recepción/sala de espera junto a la oficina del jefe (donde estaba la
> cocina) y casa del hacker a cielo abierto (sin techo). Detalle en
> `CHANGELOG.md`.
>
> **Actualización 2026-08-27 (Catálogo Cocina)**: las piezas de la cocina
> (mesada, heladera, dispenser, máquina de golosinas y mesa de comedor) se
> extrajeron como fábricas y quedaron disponibles en el catálogo bajo la
> categoría `🍽️ Cocina`. Detalle en `CHANGELOG.md`.
>
> **Actualización 2026-08-27 (Catálogo Lounge/Gerencia)**: se extrajeron y
> catalogaron las piezas de juntas y gerencia (mesa de juntas, chesterfield,
> mesa ratona, barra, escritorio/silla gerencia, silla de invitado, cuadros y
> reloj) bajo la categoría `🛋️ Lounge/Gerencia`. Detalle en `CHANGELOG.md`.
>
> **Actualización 2026-08-27 (Creador de personajes)**: los proyectos nuevos
> arrancan sin personajes por defecto. Se agregó el botón “➕ Añadir Personaje”
> con editor 3D (nombre, piel, peinado, ropa y zapatos), cámara libre en la
> vista previa y persistencia de personajes personalizados en el JSON.
> Detalle en `CHANGELOG.md`.
>
> **Actualización 2026-08-28 (Catálogo Red)**: se extrajeron y catalogaron las
> piezas de red (AP WiFi de pared, tablero eléctrico, canaleta de cables y
> puesto de red+electricidad de piso) bajo la categoría `📡 Red`; el catálogo
> pasa de 28 a 32 piezas. Además, la canaleta ahora se puede **dibujar punto a
> punto** (`js/trayDraw.js`): click marca el inicio y cada click agrega un tramo
> con ghost transparente, ESC o click derecho termina, y el tramo queda como un
> objeto seleccionable y serializable. El dibujo es **ortogonal** (sin
> diagonales) y tiene **imán** que se conecta a la red existente resolviendo
> continuación recta, esquina en 90° o unión en "T". El mini rack queda pendiente
> (`Lote 3b`) por su puerta interactiva. Al backlog se sumaron el ítem "Terminal
> en pantalla / screencast" y el capstone "AI Director local (Ollama)". Detalle
> en `CHANGELOG.md`.
>
> **Actualización 2026-08-28 (reorganización Fases 1 y 2)**: la raíz quedó
> limpia (15 archivos; logs borrados y reglas consolidadas en `AGENTS.md`) y
> `js/` se organizó en capas: `characters/`, `cinema/`, `ui/` y `media/`
> junto al núcleo (core/state/render/collision/etc.) y `office/` que ya
> existía. ~120 imports reescritos; validadores `check-imports`, `check-scc`,
> `p7-test`, `p7-loadtest` y `test-geo-cache` en verde. Detalle en
> `CHANGELOG.md`.
>
> **Actualización 2026-08-28 (Fase 3 — grafo acíclico)**: el último ciclo de
> dependencias (projectFiles ↔ catalog ↔ undo) se rompió inyectando las
> funciones de serialización en `initUndo` desde main.js; `check-scc` reporta
> cero SCCs. Nuevos comandos npm: `verify` (todo), `check` (grafo) y `test`
> (suite). Detalle en `CHANGELOG.md`.
>
> **Actualización 2026-08-28 (Lote 3b — Mini Rack, cierra el Lote 3)**: el mini
> rack de pared ahora es una pieza del catálogo (`createMiniRack` en
> `js/office/network.js`, categoría `📡 Red`, 33 piezas en total). Su puerta es
> multi-instancia: cada rack (el fijo de la sala de juntas + los spawneados)
> registra la suya en `group.js` y el ticker anima todas con estado propio; el
> botón de la UI opera sobre el rack activo y el flag `openDoor` de las tomas
> abre todas. Detalle en `CHANGELOG.md`.
>
> **Actualización 2026-08-28 (Gestos de un disparo)**: los personajes ahora
> "actúan" con 6 gestos one-shot (señalar, saludar, encogerse de hombros, negar
> con la cabeza, aplaudir, mirar el reloj) que se reproducen una vez y vuelven
> solos a la acción base. Se activan desde la grilla "Gestos" del panel o con
> eventos de waypoint `gesture:*` (`GESTURE_DEFS` en `js/characters.js`). Las
> acciones sostenidas en bucle se mantienen intactas. Detalle en `CHANGELOG.md`.

## Arquitectura general

Aplicación web estática sin framework (vanilla JS + ES Modules), servida con `serve.py`
(servidor HTTP simple sin cache, con búsqueda de puerto libre) o cualquier servidor estático.
Three.js r0.185 se carga vía import map desde `vendor/three.module.js` + `vendor/jsm/`
(copia local, única en uso).

Módulos activos (`index.html` carga `js/main.js`, que importa todo en orden):

| Módulo | Líneas | Rol |
|---|---|---|
| `js/core.js` | 32 | Renderer WebGL, escena, cámara, OrbitControls, PMREM. Singleton. |
| `js/state.js` | 54 | Estado mutable compartido (`store`, `cinema`, `cinemaPaths`, `playbackInstances`, `view`, `recorderState`, `interactiveRegistry`). |
| `js/selection.js` | 144 | Registro de objetos seleccionables + anillo de selección + `setActiveTarget`. |
| `js/gizmo.js` | 384 | Flechas de traslación, raycasting, arrastre libre por plano. |
| `js/characters.js` | 755 | Rigs procedurales de 3 humanos, perro y gato con animaciones por código (sin AnimationMixer). |
| `js/office/` (11 módulos) | ~3.450 | Oficina moderna con sala de servidores. Split P1: `group.js` (grupos/escalera/mini rack/LEDs), `walls.js` (tabiques, puertas, texturas), `materials.js`, `furniture.js` (fábricas de mobiliario), `serverRoom.js` (sala de sistemas), `lounge.js` (juntas, jefe, cocina), `network.js` (cableado, mini rack, APs), `city.js` (calle), `alarm.js`, `hackerHouse.js`, `index.js` (orquestador). |
| `js/park.js` | 147 | Parque (día/atardecer/noche). |
| `js/lights.js` | 78 | Iluminación. |
| `js/environment.js` | 120 | Switcher de 5 ambientes (estudio, oficina, parque día/tarde/noche). |
| `js/cinematics.js` | 574 | Recorridos por waypoints (curva CatmullRom) + vistas de cámara. |
| `js/ui.js` | 286 | Outliner, sliders de transformación, bindings de botones. |
| `js/viewport.js` | 75 | Toggles de grilla/ejes, vistas rápidas, resize. |
| `js/recorder.js` | 66 | Grabación de video con MediaRecorder. |
| `js/render.js` | 127 | Loop de animación central (anima rigs, cinemáticas, LEDs, timing de grabación, HUD). |
| `js/timeline.js` | ~490 | Secuenciador de escenas: tomas de cámara arrastrables, eventos de waypoint, grabación de escena. |
| `js/subtitles.js` | 120 | Subtítulos dibujados dentro del canvas WebGL (visibles en pantalla y en el video grabado). |
| `js/demoScene.js` | 87 | Escena demo de 15s con un clic (botón "🎬 Escena Demo"): recorrido + tomas + subtítulos. |
| `js/catalog.js` | ~180 | Catálogo de piezas (P7): spawn/duplicar/borrar objetos (+ persistencia de instanciados). |
| `js/multiselect.js` | ~230 | Selección múltiple (Ctrl+clic, marquesina), mover en bloque y borrado de grupo. |

**`app.js` (3.126 líneas, ~107KB) es código muerto**: es el monolito original del cual se
extrajeron los módulos de `js/`. No lo referencia ningún HTML (solo figura como `"main"`
en `package.json`, irrelevante para una app web). Duplica casi todo el código actual.

## Funcionalidades existentes (hoy)

- **Personajes**: 3 humanos (Alex, Carlos, Elena — estilo low-poly/blocky), perro y gato.
  Animaciones en bucle por código: `idle, talk, sit, sit_typing, lay, walk, run` (humanos);
  `idle, sit, lay, walk, run` (mascotas).
- **Equipos IT**: switch, router, torre PC, laptop — alineados con el tema de redes.
- **5 ambientes**: oficina moderna (con sala de servidores y LEDs parpadeantes), estudio
  con grilla, parque día/atardecer/noche con farolas emisivas.
- **Posicionamiento**: sliders XYZ + rotación, gizmo de flechas 3D, arrastre libre con
  click, atajos "sentar en escritorio / sala servidores / reunión", "mirar cámara", reset.
- **Cinemática de recorridos**: por personaje, waypoints clickeables/arrastrables sobre el
  suelo, curva CatmullRom, velocidad ajustable (0.5–6 m/s), invertir, loop, reproducción
  simultánea de varios personajes, persistencia por objeto durante la sesión (`cinemaPaths`).
- **Vistas de cámara**: órbita libre, 1ª persona, 3ª persona, persecución, y 3 ángulos
  "cine" fijos relativos al personaje, con lerp suave. Vistas rápidas frontal/superior/lateral.
- **Grabación**: `canvas.captureStream(fps)` + MediaRecorder → descarga WebM (VP9/VP8),
  duración 1–60 s y FPS 1–60 configurables.
- Outliner jerárquico, HUD (FPS, posición de cámara, selección).

## Estado de las funciones clave para el objetivo (videos educativos de YouTube)

**Animación de personajes — funcional pero limitada.** Solo bucles procedurales no
sincronizables entre sí; no hay timeline, no hay gestos puntuales (señalar, saludar),
no hay lip-sync, no hay poses keyframeables, no hay transiciones entre acciones
(el cambio es instantáneo). El detalle por acción es razonable para estilo blocky.

**Cámaras/ángulos — decente para tomas simples.** Órbita + 6 modos de seguimiento.
Pero las cámaras cine son offsets fijos sin parámetros editables, no hay múltiples
cámaras conmutables durante una toma ni keyframes de cámara.

**Grabación/exportación — funcional pero frágil.** Graba en tiempo real el canvas
(una toma continua). Limitaciones para YouTube: solo WebM (habría que convertir a MP4),
sin resolución configurable (depende del viewport), sin audio, sin secuenciador de
escenas/tomas, y el timing depende de que no haya caídas de FPS.

## Problemas técnicos

1. ~~**`app.js` gigante y muerto (3.126 líneas)**~~ — **RESUELTO (2026-08-23)**:
   eliminado (ningún HTML lo cargaba); `package.json` ya no lo apunta.
2. ~~**Duplicación Three.js**: `vendor/` y `node_modules/`~~ — **RESUELTO
   (2026-08-23)**: eliminados `node_modules/` y `package-lock.json`; la única
   copia es `vendor/`.
3. ~~**Wiring de UI huérfano** (`btnCinemaToggle`, `btnCinemaClear`,
   `btnCinemaPlay` sin ID en `index.html`)~~ — **RESUELTO (2026-08-23)**:
   handlers muertos de `ui.js` y lookups muertos de `cinematics.js` eliminados.
   El play individual sigue disponible en la lista por personaje.
4. **Menús no funcionales**: "Editar / Agregar / Vista" siguen decorativos.
   (Archivo ya es funcional desde el 2026-08-21: Abrir/Guardar/Guardar como.)
5. **Sin persistencia**: recargar la página pierde posiciones, recorridos y acciones.
   No hay guardado/carga de proyectos (JSON).
6. **~~Bug potencial en `js/render.js:94-99`~~ (mitigado 2026-08-23)**: la duración se mide con `dt` del clock; si la pestaña pierde foco el reloj se congela. Ahora `dt` está acotado a 1/20 s en el loop, por lo que los saltos ya no desincronizan la grabación (queda pendiente el reloj determinista total, ej. timestamp fijo).
7. **Inicialización frágil**: `viewport.js:72-75` llama `onResize` con 3 timeouts como
   workaround de layout.
8. **Toggle de vistas raro** (`js/ui.js:283-285`): clicar la vista activa vuelve a órbita,
   pero el botón "Libre (Órbita)" nunca aparece visualmente activo salvo por CSS inicial.

## Qué falta para el objetivo (videos de redes/ciberseguridad para YouTube)

1. ~~Secuenciador de tomas / timeline~~ **HECHO (2026-08-21)**: `js/timeline.js`
   con tomas de cámara arrastrables, eventos de waypoint (acción + espera) y
   grabación de la escena completa en un WebM.
2. **Keyframes de acción y transiciones**: más gestos de un disparo (señalar,
   saludar) y transiciones suaves entre acciones.
3. **Audio/lip-sync mínimo**: narración o al menos boca animada al hablar.
4. **Exportación MP4** (WebCodecs o ffmpeg.wasm) y resolución/framerate fijos (1080p)
   grabando offscreen para evitar drops.
5. ~~Guardar/cargar escenas (JSON)~~ **HECHO (2026-08-21)**: menú Archivo con
   Abrir/Guardar/Guardar como (`js/projectFiles.js`); serializa posiciones,
   acciones, recorridos con eventos y tomas de la timeline.
6. **Cámaras colocables** con parámetros (FOV, altura, distancia): los offsets
   cine son fijos.
7. **Más props educativos**: pizarra/pantalla con texto o diagramas de red,
   paquetes de datos animados viajando entre dispositivos.
8. ~~Limpieza: borrar `app.js`, `node_modules` y los bindings huérfanos.~~
   **HECHO (2026-08-23)**.

## Fortalezas

- Refactor modular reciente y bien hecho (`js/*`): responsabilidades claras, estado
  centralizado, sin dependencias circulares visibles.
- El dominio ya apunta al objetivo: oficina con sala de servidores, props de redes,
  personajes tipo "equipo IT" con acciones de teclear/hablar.
- Sistema de cinemática por waypoints bastante completo.
- 7 vistas de cámara incluyendo 1ª/3ª persona y persecución.
- Exportación de video básica ya funciona.
- Setup cero-fricción: sin build, `serve.py` incluido, vendor local, UI en español
  estilo Blender.

## Recomendación de próximos pasos

1. Guardar/cargar escenas (JSON) — barato y protege el trabajo.
2. Secuenciador de tomas — lo que más acerca a producir un video real.
3. ~~Limpieza de `app.js`, `node_modules` y bindings huérfanos (trivial).~~ Hecho
   (2026-08-23).
