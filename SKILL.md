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

- `index.html` — UI principal (import map, paneles, menús).
- `js/boot.js` — punto de entrada: muestra solo el pop-up de inicio (nuevo /
  cargar) y carga el editor (`main.js`) recién después de elegir.
- `js/main.js` — orquestador del editor: importa e inicializa todo.
- `js/core.js` — renderer, escena, cámara, OrbitControls.
- `js/state.js` — estado central compartido.
- `js/characters.js` — rigs procedurales (humanos y mascotas) y sus animaciones.
- `js/office/` — entorno oficina, dividido por subsistema (split P1):
  `group.js` (grupos compartidos: officeGroup, escalera, mini rack, LEDs),
  `walls.js` (tabiques, puertas, texturas de pared), `materials.js` (materiales),
  `furniture.js` (fábricas de escritorios/sillas/sillones/PCs), `serverRoom.js`
  (sala de servidores + escalera + rincón de recambio), `lounge.js` (sala de
  juntas, oficina del jefe, bar, cocina), `network.js` (mini rack, canales de
  cableado, APs WiFi), `city.js` (calle/vereda exterior), `alarm.js` (balizas),
  `hackerHouse.js` (casa del hacker), `geoCache.js` (caché de primitivas
  compartidas, P9) e `index.js` (orquestador del layout).
- `js/catalog.js` — catálogo de piezas (P7): spawn/duplicar/borrar objetos del
  panel "➕ Agregar Objeto" y su persistencia en el JSON de proyecto.
- `js/multiselect.js` — selección múltiple: Ctrl+clic, marquesina, mover en
  bloque y borrado de grupo.
- `js/park.js`, `js/lights.js`, `js/environment.js` — escenarios y luces.
- `js/cinematics.js` — recorridos por waypoints y vistas de cámara.
- `js/timeline.js` — secuenciador de escenas: línea de tiempo de tomas de
  cámara, eventos de waypoint (acción + espera) y grabación de la escena.
- `js/subtitles.js` — subtítulos dibujados dentro del canvas WebGL (salen en
  el video grabado); pista de cues `{ start, end, text }`.
- `js/demoScene.js` — escena de ejemplo de 15s (botón "🎬 Escena Demo").
- `js/dom.js` — lookups DOM centralizados (`byId` memoizado + `qs`/`qsa`).
- `js/gizmo.js`, `js/selection.js`, `js/ui.js`, `js/viewport.js` — interacción y UI.
- `js/render.js` — loop de animación central.
- `js/recorder.js` — grabación de video.
- `js/startup.js` — modal de arranque (nuevo/cargar proyecto) y accesos
  rápidos de la barra superior (guardar, nuevo, undo/redo).
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
