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
- `js/main.js` — punto de entrada, importa y inicializa todo.
- `js/core.js` — renderer, escena, cámara, OrbitControls.
- `js/state.js` — estado central compartido.
- `js/characters.js` — rigs procedurales (humanos y mascotas) y sus animaciones.
- `js/office.js`, `js/park.js`, `js/lights.js`, `js/environment.js` — escenarios y luces.
- `js/cinematics.js` — recorridos por waypoints y vistas de cámara.
- `js/timeline.js` — secuenciador de escenas: línea de tiempo de tomas de
  cámara, eventos de waypoint (acción + espera) y grabación de la escena.
- `js/gizmo.js`, `js/selection.js`, `js/ui.js`, `js/viewport.js` — interacción y UI.
- `js/render.js` — loop de animación central.
- `js/recorder.js` — grabación de video.
- `vendor/` — Three.js local (única copia en uso).
- `GLM.md` — informe de revisión del estado del proyecto.
- `CHANGELOG.md` — registro de cambios (ver abajo).

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
5. **Orientación de mesas y sillas** (error común): las mesas/escritorios deben
   orientarse de modo que la persona sentada en su silla tenga **en frente el o
   los monitores**. Convención en `createDesk`: el monitor está del lado local
   -z y la pantalla mira hacia local -z. **Lado correcto de la silla**: quien
   usa el escritorio se sienta del lado opuesto al bisel/monitor (donde está el
   teclado, local +z) y mira hacia la pantalla. Al rotar una mesa 180°, la
   silla debe acompañar el giro y quedar SIEMPRE del lado del teclado, mirando
   a los monitores; nunca del lado del monitor (detrás de la pantalla). Para
   oficinas con escritorio administrativo (ej. del jefe), la silla principal va
   en el lado del teclado mirando a la pantalla, y una **silla de invitado**
   opcional se coloca del lado del monitor, frente al ocupante, para conversar
   cara a cara.
6. **Nada "flotando" ni sockets huérfanos**: todo objeto montado en una pared
   debe estar apoyado sobre un tramo de pared real (verificar coordenadas);
   las bocas/puestos de red del piso solo se dejan si hay un equipo conectado
   junto a ellos. Si el equipo se mueve o se elimina, mover/eliminar también su
   conexión.
