# MiniStudio 3D — Plan de mejoras (mini3d_mejoras.md)

> Objetivo: hacer el producto más **usable** para producir videos educativos
> de redes/ciberseguridad de forma repetible. Este documento es el backlog
> vivo: acá se anotan las mejoras pendientes, ordenadas por impacto vs.
> esfuerzo. Al completar una, tacharla y registrarla en `CHANGELOG.md`.

## Estado actual (qué ya funciona)

- Pipeline completo de producción: escena JSON → timeline → grabación WebM
  con cortes de cámara (cine, 3ª persona, POV, aérea, fijas con zoom),
  subtítulos embebidos en el video y control de velocidad (⏱ 0.25×–2×).
- 5 ambientes, personajes procedurales con acciones básicas, recorridos con
  eventos por waypoint (acción + espera + acción final persistente).
- Guardar/cargar proyectos JSON (incluye subtítulos y tomas fijas).
- Dos escenas de ejemplo en `scenes/` que demuestran el formato.

## Límite actual

El motor cuenta historias de "gente que camina, habla y reacciona", pero la
**actuación** es limitada (poses fijas), es **mudo**, y los personajes no
interactúan con los objetos. El techo no es técnico: es vocabulario actoral
y audio.

---

## En curso: Editor de escenas (Modo Construcción)

Mejorar el editor para armar escenas desde cero. Capa de construcción
independiente de la oficina (`js/construction.js`), terreno con césped
(`js/terrain.js`).

- [x] **Fase 1** — Terreno limpio con césped como ambiente de arranque.
- [x] **Fase 2** — "Modo Construcción" (ex "Editar Edificio"): reemplaza todo el
      panel izquierdo; añadir piso/pared/puerta/ventana; persistencia en el JSON.
- [ ] **Fase 3** — Redimensionar piso y pared **arrastrando uno de los 4 bordes**
      (solo ese lado se mueve; el texturado no se estira, se forman baldosas).
- [ ] **Fase 4** — Editor de paredes completo + colocar puertas/ventanas sobre ellas.
- [ ] **Fase 5** — 2–3 diseños distintos de piso, pared, puerta y ventana.

### Catálogo de objetos por lotes

- [x] **Lote 1 — Cocina**: mesada, heladera, dispenser, máquina de golosinas y
      mesa de comedor (`js/office/lounge.js` + categoría `🍽️ Cocina`).
- [x] **Lote 2 — Lounge/Gerencia**: mesa de juntas, chesterfield, mesa ratona,
      barra de bebidas, escritorio/silla gerencia, silla de invitado, cuadros y
      reloj (`baseY` para piezas de pared).
- [x] **Lote 3 — Red**: AP de pared, tablero eléctrico, canaleta de
      cables y puesto de red+elec de piso (categoría `📡 Red` en
      `js/office/network.js`).
- [x] **Lote 3b — Mini Rack**: extraído como pieza del catálogo
      (`createMiniRack` en `js/office/network.js`). La puerta es
      multi-instancia: cada rack registra la suya en `group.js`
      (`registerMiniRack`), el ticker anima todas, y el botón de la UI opera
      sobre el rack activo (cualquiera con `doorHinge`). El flag `openDoor`
      de las tomas abre todas las puertas vía `openAllRackDoors()`.
- [x] **Dibujo de canaleta punto a punto**: al elegir "Canaleta de Cables" se
      entra en modo dibujo (click marca el inicio y cada click agrega un tramo,
      ghost transparente sigue al mouse, ESC o click derecho termina). El tramo
      queda como UN objeto seleccionable, movible y serializable
      (`js/trayDraw.js` + `createCableTrayRun` en `js/office/network.js`).
      Incluye **routing ortogonal** (sin diagonales) e **imán a la red existente**
      que resuelve la conexión: continuación recta, esquina en 90° o unión en "T".

### Personajes personalizables

- [x] **MVP**: proyectos nuevos sin personajes; botón “➕ Añadir Personaje”;
      editor 3D con cámara libre, nombre, piel, peinado, ropa y zapatos;
      persistencia en `characters[]`.
- [ ] Editar/borrar personajes existentes, más opciones de vestuario/props y
      plantillas de personajes.

---

## Backlog priorizado

### 1. ~~Gestos de un disparo~~ ✅ (2026-08-28)
HECHO: 6 gestos one-shot (`GESTURE_DEFS` en `js/characters.js`): señalar 👉,
saludar 👋, encogerse de hombros 🤷, negar con la cabeza 🙅, aplaudir 👏 y
mirar el reloj ⌚. Se activan con `setAction('gesture:<nombre>')` o
`rig.playGesture(...)`, se reproducen una vez y vuelven solos a la acción base.
Botones en el panel (grilla "Gestos") y opciones `gesture:*` en los eventos de
waypoint. Las acciones sostenidas existentes (wave/clap/point en bucle) se
mantienen intactas.

### 2. Lip-sync mínimo (ALTO impacto / esfuerzo muy bajo)
Boca abre/cierra mientras dura `talk` (escala con seno del tiempo).
- Dónde: `js/characters.js` (cabeza ya tiene partes; agregar mandíbula o
  escala Y de la boca).
- Ganancia: quien habla "parece" hablar aunque sea mudo.

### 3. Audio por escena (ALTO impacto / esfuerzo medio)
Campo opcional `audio` en el proyecto JSON: música de fondo + efectos
(alarma, pasos) con volumen y momento. Mezclar al exportar.
- Opciones: mezclar post-graba con WebCodecs/ffmpeg.wasm, o reproducir vía
  WebAudio y capturar con `MediaStreamAudioDestinationNode` combinado con el
  stream del canvas (recomendada: sale sincronizado en un solo paso).
- Dónde: nuevo módulo `js/audio.js`; `recorder.js` combina pistas.

### 4. ~~Sentarse real en sillas~~ ✅ (2026-08-28)
HECHO (mejorado sobre la propuesta original): acción `sit_at` en eventos de
waypoint con **dropdown de sillas** por nombre (no "la más cercana": la que
se elige), **animación suave** de 0.8 s hasta el asiento (easing, giro corto,
se dobla a mitad de camino) y termina sentado mirando como la silla. Además,
**menú contextual de click derecho** sobre un humano: Animar (sostenidas),
Acción única (gestos) y "🪑 Elegir asiento…" → click en la silla lo posiciona
DIRECTO (sin animación) para posar la escena. Anclas `seat_<id>` en todas las
sillas (oficina, comedor, gerencia, invitado, sillones).

### 5. Transiciones suaves entre acciones (MEDIO impacto / esfuerzo medio)
Hoy las poses cambian en seco. Interpolar ángulos de articulaciones durante
~0.3 s entre acción previa y nueva.
- Dónde: `js/characters.js` (blending por rig; cuidado con el costo en PCs
  modestas — es solo lerp, debería estar bien).

### 6. Cámara con movimiento dentro de la toma (MEDIO impacto / esfuerzo medio)
Tomas fijas con dolly/zoom gradual: campos opcionales `camPosEnd` /
`targetEnd` y la cámara interpola durante la toma (acercarse al rack EN el
plano, no con dos cortes).
- Dónde: `js/timeline.js` (motor de tomas) + `js/cinematics.js`.

### 7. Render determinista + exportación 1080p fijo (MEDIO alto / esfuerzo medio)
Reloj de simulación por frame fijo (1/30 s simulados por frame renderizado)
en vez de wall-clock, y grabar offscreen a resolución fija.
- Dónde: `js/render.js`, `js/recorder.js`. Elimina drops y hace el video
  idéntico siempre.

### 8. Biblioteca / navegador de escenas (UX)
Con varias escenas en `scenes/`, un panel "Escenas" que liste los JSON del
directorio y los cargue con un clic (hoy hay que ir a Archivo → Abrir).
- Dónde: `index.html` + nuevo `js/sceneBrowser.js` (fetch del listado via
  `serve.py`).

### 9. Más props narrativos (contenido)
Pizarra/pantalla con texto editable (diagramas de red), paquetes de datos
animados viajando entre dispositivos, celular en la mano.
- Dónde: `js/office.js` (props seleccionables) + texto dinámico vía canvas
  texture.

### 10. Exterior utilizable (postergado)
El parque existe pero sin narrativa. Si las historias lo requieren:
bancos, camino, farolas ya están; falta mobiliario narrativo y razones
para filmar ahí.

### 11. Terminal en pantalla / screencast (contenido)
Escena de alguien tipeando en una PC con la pantalla mostrando comandos
(Linux/PowerShell, ej. `nmap`) y su salida. Reproducción guionada, no
ejecución real.
- Ya existe: animación `sit_typing` (`js/characters.js`), monitor en
  `createDesk` (`js/office/furniture.js`), y el patrón texto→`CanvasTexture`
  (subtítulos/quiz).
- Falta: módulo `js/terminal.js` (canvas con prompt + tipeo letra a letra +
  salida scrolleando, guionado en el JSON) + mostrarlo en el monitor 3D y/o
  como quad "media pantalla" tipo screencast (capturable por el grabador).

---

## Capstone: AI Director local (Ollama)

> Ítem de cierre: depende de tener completas las herramientas de edición
> (catálogo, construcción, personajes, cinemáticas). Recién ahí la IA tiene
> vocabulario para armar escenas sola.

Módulo `js/aiDirector.js` que permite pedirle a una IA **local** (Gemma 3,
Llama, Phi vía Ollama) que arme una escena con lenguaje natural, usando las
herramientas del editor como funciones (tool-calling). Es replicar el flujo
"leo estado → elijo herramienta → la ejecuto" pero con un modelo local.

- **Modelo**: Ollama en `localhost:11434` (API HTTP, compatible OpenAI). La
  app ya corre en localhost vía `serve.py`, así que el `fetch()` pasa sin
  CORS. Cero dependencias nuevas (nada de WebGPU en el browser).
- **Esquema de herramientas** (mapeado a funciones existentes):
  `set_environment`, `add_object` (→ `spawnCatalogItem`), `add_character`
  (→ `addHumanCharacter`), `move_object`, `add_wall/floor/door/window`
  (construcción), `add_cinematic`, `add_shot`, `add_subtitle`, `save_project`.
- **Flujo**: system prompt con estado de escena + esquema → el modelo devuelve
  un plan JSON de tool-calls → un runner lo ejecuta contra el editor.
- **Dificultades y mitigaciones**:
  - Razonamiento espacial: usar helpers de alto nivel ("poné un escritorio
    contra la pared norte") + `findFreeSpot` + colisión, no coordenadas crudas.
  - Capacidad del modelo: 4B–8B cuantizado; esquema JSON estricto + validación.
  - UX iterativa: la IA propone el plan → se muestra → se confirma → ejecuta;
    cada paso pasa por el undo existente.

---

## Reglas para trabajar el backlog

1. Una mejora por vez, verificada en navegador antes de pasar a la siguiente.
2. Mantener la filosofía: sin build, sin dependencias pesadas, todo vanilla.
3. Toda mejora debe ser serializable en el proyecto JSON cuando aplique
   (como hicieron subtítulos y tomas fijas).
4. Registrar cada cambio en `CHANGELOG.md` y tachar el ítem acá.
