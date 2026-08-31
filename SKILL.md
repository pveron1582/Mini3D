# MiniStudio 3D — Guía del proyecto

## De qué trata

**MiniStudio 3D** es un estudio de video con animaciones 3D para generar clips,
orientado a producir videos educativos de **redes y ciberseguridad** para YouTube:
situaciones con personajes 3D desde diferentes ángulos, con toques de comedia
y situaciones divertidas.

La filosofía del proyecto:

- **Estilo Blender**: interfaz tipo editor 3D (outliner, gizmos, vistas de cámara,
  panel de propiedades), pero mucho más simple.
- **Pocos recursos de PC**: sin build, sin framework, sin dependencias pesadas;
  debe correr fluido en máquinas modestas.
- **La mejor calidad posible** dentro de esa restricción: render cuidado,
  animaciones procedurales limpias, estilo low-poly/blocky consistente.

## Tecnologías

| Tecnología | Uso |
|---|---|
| **HTML / CSS / Vanilla JS (ES Modules)** | Toda la aplicación. Sin framework, sin bundler. |
| **Three.js r0.185** (local en `vendor/`) | Render 3D, import map desde `index.html`. |
| **MediaRecorder + canvas.captureStream** | Grabación y exportación de video (WebM). |
| **Python (`serve.py`)** | Servidor de desarrollo estático (opcional). |

## Estructura del código

> Fase 2 de reorganización (2026-08-28): `js/` pasó de 34 archivos sueltos a
> 4 subcarpetas por capa + el núcleo en la raíz de js/.

- `index.html` — UI principal (import map, paneles, menús).
- `js/boot.js` — punto de entrada: muestra solo el pop-up de inicio (nuevo /
  cargar) y carga el editor (`main.js`) recién después de elegir.
- `js/main.js` — orquestador del editor: importa e inicializa todo.
- `js/core.js` — renderer, escena, cámara, OrbitControls.
- `js/state.js` — estado central compartido.
- `js/dom.js` — lookups DOM centralizados (`byId` memoizado + `qs`/`qsa`).
- `js/render.js` — loop de animación central; `js/tickers.js` — registro de
  animaciones por frame; `js/collision.js` — colisiones y ley del piso;
  `js/undo.js` — historial (snapshots JSON); `js/trayDraw.js` — dibujo de
  canaletas punto a punto; `js/anchors.js` (en characters/) — anclas de asiento.
- `js/characters/` — personajes: `characters.js` (rigs procedurales humanos y
  mascotas + gestos one-shot), `characterCreator.js` (modal de creación con
  género/vestimenta/accesorios) y `anchors.js`.
- `js/cinema/` — narrativa temporal: `cinematics.js` (recorridos por waypoints
  y vistas de cámara), `timeline.js` (secuenciador de tomas + eventos de
  waypoint), `quizTrack.js` (pista de carteles de pregunta), `wizard.js`
  (asistente de escenas) y `navigation.js` (A* de recorridos).
- `js/ui/` — interacción: `ui.js` (paneles y selector Editar), `gizmo.js`
  (flechas/anillo de transformación), `selection.js` (registro de
  seleccionables), `multiselect.js` (Ctrl+clic, marquesina, grupo) y
  `viewport.js` (vistas de cámara + vuelo al objetivo).
- `js/media/` — capas sobre el video: `recorder.js` (grabación/export),
  `subtitles.js` (subtítulos en canvas WebGL) y `quiz.js` (cartel de pregunta
  con reloj).
- `js/office/` — entorno oficina, dividido por subsistema (split P1):
  `group.js` (grupos compartidos: officeGroup, escalera, registro de mini
  racks), `walls.js` (tabiques, puertas, texturas de pared), `materials.js`
  (materiales), `furniture.js` (fábricas de escritorios/sillas/sillones/PCs),
  `serverRoom.js` (sala de servidores + escalera + rincón de recambio),
  `lounge.js` (sala de juntas, oficina del jefe, bar, cocina), `network.js`
  (mini rack con puerta multi-instancia, canaletas, APs WiFi), `city.js`
  (calle/vereda exterior), `alarm.js` (balizas), `hackerHouse.js` (casa del
  hacker), `geoCache.js` (caché de primitivas, P9) e `index.js` (orquestador).
- `js/catalog.js` — catálogo de piezas (P7): spawn/duplicar/borrar objetos y su
  persistencia en el JSON de proyecto.
- `js/park.js`, `js/lights.js`, `js/terrain.js`, `js/environment.js` —
  escenarios y luces.
- `js/construction.js` — capa de construcción (pisos/paredes/aberturas).
- `js/projectFiles.js` — guardar/abrir proyectos JSON.
- `js/startup.js` — modal de arranque y accesos de la barra superior.
- `vendor/` — Three.js local (única copia en uso).
- `GLM.md` — informe de revisión del estado del proyecto.
- `CHANGELOG.md` — registro de cambios (ver abajo).
- `mini3d_mejoras.md` — backlog priorizado de mejoras del producto
  (gestos, audio, lip-sync, etc.).

⚠️ `app.js` en la raíz es **código muerto** (el monolito original previo al refactor
modular). No usarlo como referencia de arquitectura.

## Reglas de trabajo

1. **Mantener la filosofía**: pocos recursos, sin build, sin dependencias nuevas a la
   ligera. Antes de agregar una librería, evaluar costo/beneficio.
2. **Código modular**: la lógica vive en `js/*.js` con responsabilidades claras;
   no volver a un monolito tipo `app.js`.
3. **Español en la UI** y comentarios/nombres descriptivos, como el resto del código.
4. **Registrar cambios**: luego de generar cualquier cambio en el proyecto, agregar
   una entrada en `CHANGELOG.md` describiendo qué se hizo (fecha + cambio).
   Esto es obligatorio al final de cada tarea de desarrollo.
5. **Nada "flotando" ni sockets huérfanos**: todo objeto montado en una pared
   debe estar apoyado sobre un tramo de pared real (verificar coordenadas);
   las bocas/puestos de red del piso solo se dejan si hay un equipo conectado
   junto a ellos. Si el equipo se mueve o se elimina, mover/eliminar también su
   conexión.
6. **Verificar antes de dar por terminada una tarea**: correr `pnpm run verify`
   (imports + ciclos + suite funcional + carga + geo-cache). El proyecto no
   tiene dependencias, así que no hace falta instalar nada — solo Node y pnpm.
   Verificación rápida del grafo: `pnpm run check`.
7. **Orientación de personajes y muebles (error recurrente)**: un rig con
   `rotY = 0` mira al **SUR (+z)**; `rotY = π` mira al **NORTE (-z)**; `±π/2`
   mira al **ESTE/OESTE**. Para "que mire hacia X", usar SIEMPRE
   `rotYToLookAt(fromX, fromZ, toX, toZ)` de `js/characters/characters.js`
   (= `atan2(dx, dz)`) — NUNCA calcular un `atan2` a mano: invertir el orden
   de los ejes deja a personajes/sillas de espaldas (bug que se repitió
   varias veces). Los asientos con ancla (`sitAtAnchor`) ya aplican
   `rotY_silla + 180°` internamente.
