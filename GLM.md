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
| `js/office.js` | 373 | Oficina moderna con sala de servidores. |
| `js/park.js` | 147 | Parque (día/atardecer/noche). |
| `js/lights.js` | 78 | Iluminación. |
| `js/environment.js` | 120 | Switcher de 5 ambientes (estudio, oficina, parque día/tarde/noche). |
| `js/cinematics.js` | 574 | Recorridos por waypoints (curva CatmullRom) + vistas de cámara. |
| `js/ui.js` | 286 | Outliner, sliders de transformación, bindings de botones. |
| `js/viewport.js` | 75 | Toggles de grilla/ejes, vistas rápidas, resize. |
| `js/recorder.js` | 66 | Grabación de video con MediaRecorder. |
| `js/render.js` | 127 | Loop de animación central (anima rigs, cinemáticas, LEDs, timing de grabación, HUD). |

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
6. **Bug potencial en `js/render.js:94-99`**: la duración se mide con `dt` del clock;
   si la pestaña pierde foco el reloj se congela; el video no es determinista.
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
