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
> eventos de waypoint `gesture:*` (`GESTURE_DEFS` en `js/characters/characters.js`). Las
> acciones sostenidas en bucle se mantienen intactas. Detalle en `CHANGELOG.md`.
>
> **Actualización 2026-08-30/31 (consolidado)**: reorganización Fase 2/3 ya
> incluida arriba; lip-sync mínimo, `sit_at` real con menú contextual,
> canaletas con pasamuros, alarma visible, editor por secciones + creador v2,
> orientación unificada (`rotYToLookAt`), `standInFrontOf`/`seatY` real,
> cinemática "Reunión de Prioridades del Jefe" (45 s) y timeline con edición
> pegajosa + botón ＋ + Fase A cámara por personaje. Estaba en git pero sin
> entrada de CHANGELOG hasta 2026-09-08.
>
> **Actualización 2026-09-08 (pista PERSONAJES + determinismo)**: nueva pista
> 🧍 PERSONAJES (`js/cinema/charTrack.js`: lane por personaje, bloque base,
> bloques por tramo, bloque camino), imán entre pistas (`js/cinema/tlSnap.js`),
> paneles redimensionables (`js/ui/panelResize.js`), reproducción determinista
> (`evaluateAllPathsAt`, la aguja manda), guardado directo con handle en
> IndexedDB y cámara `front`/`profile` por toma. Eliminada
> `scenes/alarma_en_la_red (1).json` (duplicado). `verify` en verde. Detalle
> en `CHANGELOG.md`.

## Arquitectura general

Aplicación web estática sin framework (vanilla JS + ES Modules), servida con `serve.py`
(servidor HTTP simple sin cache, con búsqueda de puerto libre) o cualquier servidor estático.
Three.js r0.185 se carga vía import map desde `vendor/three.module.js` + `vendor/jsm/`
(copia local, única en uso).

Módulos activos (`index.html` carga `js/main.js`, que importa todo en orden):

| Módulo | Rol |
|---|---|
| `js/core.js` | Renderer WebGL, escena, cámara, OrbitControls, PMREM. Singleton. |
| `js/state.js` | Estado mutable compartido (`store`, `cinema`, `cinemaPaths`, `timeline`, `charBlocks`/`charFullRange`, `quizTrack`, `view`, `recorderState`, `interactiveRegistry`, buses). |
| `js/ui/selection.js` | Registro de objetos seleccionables + anillo de selección + `setActiveTarget`. |
| `js/ui/gizmo.js` | Flechas de traslación, raycasting, arrastre libre por plano. |
| `js/ui/viewport.js` | Toggles de grilla/ejes, vistas rápidas, resize. |
| `js/ui/ui.js` | Outliner, sliders de transformación, bindings de botones. |
| `js/ui/multiselect.js` | Selección múltiple (Ctrl+clic, marquesina), mover en bloque y borrado de grupo. |
| `js/ui/panelResize.js` | Paneles redimensionables (timeline + panel izquierdo, con localStorage). |
| `js/characters/characters.js` | Rigs procedurales de humanos, perro y gato con animaciones por código (sin AnimationMixer) + gestos one-shot + lip-sync + `standInFrontOf`/`sitAtAnchor`. |
| `js/characters/characterCreator.js` | Modal de creación (género/vestimenta/accesorios) + persistencia en JSON. |
| `js/characters/anchors.js` | Anclas de asiento (`seat_<id>` + `seatY`). |
| `js/office/` (~12 módulos) | Oficina moderna con sala de servidores: `group.js`, `walls.js`, `materials.js`, `furniture.js`, `serverRoom.js`, `lounge.js`, `network.js` (mini rack multi-instancia, canaletas, APs), `city.js`, `alarm.js`, `hackerHouse.js`, `geoCache.js`, `index.js`. |
| `js/park.js` / `js/lights.js` / `js/terrain.js` / `js/environment.js` | Escenarios y luces; switcher de 5 ambientes. |
| `js/cinema/cinematics.js` | Recorridos por waypoints (CatmullRom) + vistas de cámara + `evaluateAllPathsAt` + `fixCameraVisibility`. |
| `js/cinema/timeline.js` | Secuenciador: tomas arrastrables, reproducción determinista, scrub limitado al bloque, grabación de escena. |
| `js/cinema/charTrack.js` | Pista 🧍 PERSONAJES: lanes por personaje, bloques base/por tramo/camino. |
| `js/cinema/tlSnap.js` | Imán de alineación entre pistas (~8 px, paso 0,1 s). |
| `js/cinema/quizTrack.js` | Pista de carteles de pregunta. |
| `js/cinema/wizard.js` / `js/cinema/navigation.js` | Asistente de escenas + A* de recorridos. |
| `js/media/recorder.js` | Grabación de video con MediaRecorder. |
| `js/media/subtitles.js` | Subtítulos en canvas WebGL (visibles en pantalla y video). |
| `js/media/quiz.js` | Cartel de pregunta con reloj. |
| `js/render.js` / `js/tickers.js` | Loop central + registro de animaciones por frame. |
| `js/catalog.js` | Catálogo de piezas (33): spawn/duplicar/borrar + persistencia. |
| `js/trayDraw.js` | Dibujo de canaletas punto a punto (ortogonal + imán). |
| `js/construction.js` | Capa de construcción (pisos/paredes/aberturas). |
| `js/projectFiles.js` | Guardar/abrir JSON + handle persistido en IndexedDB. |
| `js/undo.js` / `js/collision.js` / `js/dom.js` | Historial, ley del piso, lookups DOM. |

> Nota histórica: `app.js` (monolito original, ~3.100 líneas) fue eliminado el
> 2026-08-23; ningún HTML lo referencia. No usarlo como referencia.

## Funcionalidades existentes (hoy)

- **Personajes**: 3 humanos (Alex, Carlos, Elena — estilo low-poly/blocky), perro y gato,
  más personalizados del creador. Acciones: `idle, talk, sit, sit_typing, sit_talk,
  type_standing, lay, walk, run, hold` + 6 gestos one-shot (`gesture:point/wave/
  shrug/no/clap/watch`) + lip-sync en `talk`/`sit_talk`. `sit_at` con silla elegida,
  `standInFrontOf`/`standFacing`, `rotYToLookAt` (0=SUR, π=NORTE).
- **Equipos IT**: switch, router, torre PC, laptop — alineados con el tema de redes.
- **5 ambientes**: oficina moderna (con sala de servidores y LEDs parpadeantes), estudio
  con grilla, parque día/atardecer/noche con farolas emisivas.
- **Posicionamiento**: sliders XYZ + rotación, gizmo de flechas 3D, arrastre libre con
  click, menú contextual (animar / gesto / elegir asiento), "mirar cámara", reset.
- **Cinemática de recorridos**: por personaje, waypoints clickeables/arrastrables sobre el
  suelo, curva CatmullRom, velocidad ajustable (0.5–6 m/s), invertir, loop, reproducción
  simultánea, eventos por waypoint (acción + espera + `sit_at`), persistencia (`cinemaPaths`).
- **Timeline**: tomas arrastrables + pista 🧍 PERSONAJES (lanes, bloques base/por tramo/
  camino) + subtítulos + quiz multi-carteles, con imán entre pistas (`tlSnap`),
  edición pegajosa con 💾/✕ y reproducción determinista (`evaluateAllPathsAt`, la aguja manda).
- **Vistas de cámara**: órbita libre, 1ª/3ª persona, persecución, 3 cines, fija/zoom,
  aérea, frente/perfil, con `fixCameraVisibility`. Vistas rápidas frontal/superior/lateral.
- **Grabación**: `canvas.captureStream(fps)` + MediaRecorder → descarga WebM (VP9/VP8),
  duración 1–60 s y FPS 1–60 configurables.
- **Proyectos**: guardar/abrir JSON + handle persistido en IndexedDB (guardado directo);
  catálogo de 33 piezas; outliner jerárquico, HUD, paneles redimensionables.

## Estado de las funciones clave para el objetivo (videos educativos de YouTube)

**Animación de personajes — funcional, con actuación básica.** Timeline por personaje,
gestos one-shot, lip-sync y `sit_at` reales; faltan transiciones suaves (~0,3 s),
poses keyframeables e interacción con objetos. El cambio de acción sigue en seco.

**Cámaras/ángulos — bueno para tomas con corte.** Tomas conmutables con sujeto/vista
por toma y encuadre guardado; falta dolly/zoom dentro de la toma (`camPosEnd`) y
cámaras colocables con FOV/distancia editables.

**Grabación/exportación — funcional pero con techo.** Escena completa con cortes,
subtítulos embebidos y control de velocidad; pendiente: solo WebM (falta MP4),
resolución del viewport (falta 1080p fijo offscreen), sin audio y reloj por
wall-clock (no determinista total).

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
4. ~~**Menús no funcionales**~~ — **RESUELTO (2026-08-30/31)**: menús de la barra
   exclusivos y unificados, editor por secciones; Archivo funcional (Abrir/Guardar/
   Guardar como + guardado directo con IndexedDB).
5. ~~**Sin persistencia**~~ — **RESUELTO**: guardar/abrir JSON (`js/projectFiles.js`)
   con posiciones, acciones, recorridos, tomas, subtítulos, quiz, bloques de
   personajes y spawns del catálogo.
6. **~~Bug potencial en `js/render.js`~~ (mitigado 2026-08-23)**: `dt` acotado a 1/20 s;
   la reproducción de escena ahora es determinista por aguja (`evaluateAllPathsAt`);
   queda pendiente el reloj fijo total (frame 1/30 s + 1080p offscreen).
7. **Inicialización frágil**: `js/ui/viewport.js` llama `onResize` con 3 timeouts como
   workaround de layout.
8. **Toggle de vistas raro** (`js/ui/ui.js`): clicar la vista activa vuelve a órbita,
   pero el botón "Libre (Órbita)" nunca aparece visualmente activo salvo por CSS inicial.
9. ~~**Escena duplicada `scenes/alarma_en_la_red (1).json`**~~ — **RESUELTO
   (2026-09-08)**: eliminada (sufijo de Windows); queda `scenes/alarma_en_la_red.json`.

## Qué falta para el objetivo (videos de redes/ciberseguridad para YouTube)

1. ~~Secuenciador de tomas / timeline~~ **HECHO (2026-08-21)**: `js/timeline.js`
   con tomas de cámara arrastrables, eventos de waypoint (acción + espera) y
   grabación de la escena completa en un WebM.
2. ~~**Gestos de un disparo**~~ **HECHO (2026-08-28)** + **sentarse real
   `sit_at` (2026-08-30)**: 6 gestos + silla elegida con animación. Pendiente:
   transiciones suaves (~0,3 s) y poses keyframeables.
3. ~~**Lip-sync mínimo**~~ **HECHO (2026-08-30)**: boca en `talk`/`sit_talk`.
   Pendiente: **audio por escena** (música + efectos, `js/audio.js`, WebAudio →
   `MediaStreamAudioDestinationNode`).
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

- Refactor modular por capas (`js/characters|cinema|ui|media|office/`): grafo
  acíclico verificado (`check-scc` en verde), estado centralizado.
- El dominio ya apunta al objetivo: oficina con sala de servidores, props de redes,
  personajes tipo "equipo IT" con acciones de teclear/hablar.
- Cinemática por waypoints + pista PERSONAJES + imán + reproducción determinista.
- 9+ vistas de cámara incluyendo 1ª/3ª persona, persecución, frente/perfil.
- Exportación de video con cortes, subtítulos embebidos y guardado directo.
- Setup cero-fricción: sin build, `serve.py` incluido, vendor local, UI en español
  estilo Blender.

## Recomendación de próximos pasos

1. Audio por escena (`mini3d_mejoras.md` #3) — lo que más acerca a video publicable.
2. Transiciones suaves entre acciones (~0,3 s) — pulido actoral barato.
3. Cámara con dolly/zoom dentro de la toma (`camPosEnd`) + 1080p determinista.
