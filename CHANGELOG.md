# Changelog — MiniStudio 3D

Registro de cambios del proyecto. Formato: fecha + cambio. Las entradas más
recientes van arriba.
## [2026-09-08] — Audio por escena: música + efectos (backlog #3)

- Sección 🔊 Audio: pistas con tipo, volumen, inicio y loop; suenan al
  reproducir (WebAudio) y salen en el WebM exportado en una sola pasada
  (`MediaStreamAudioDestinationNode` al stream del canvas).
- El audio va embebido en el JSON (`audio` + `audioData`, máx. 20 MB/pista);
  el undo guarda solo la metadata. Nuevo `js/media/audio.js`.
## [2026-09-08] — Fix aguja más allá del 0 + reproducción siempre funciona

- La aguja quedaba a la izquierda de la marca 0s (offset del padding de la
  sección): ahora compensa la posición de la pista y el 0 es el tope real.
- `playScene` ya no exige tomas: reproduce con cualquier contenido
  (recorridos, bloques/acción base, subtítulos o carteles); la duración
  cubre todo (antes solo las tomas, con 0 bloques no arrancaba).
## [2026-09-08] — Bloques de personajes guardan lugar + acción + ánimo

- El 💾 del cuadro captura también DÓNDE está el personaje (posición +
  rotación) además de la acción y el ánimo del panel (`charPoseAt` nuevo en
  `js/cinema/charTrack.js`, aplicado en `evaluateAllPathsAt`).
- En reproducción/scrub cada cuadro muestra al personaje tal como quedó
  (salto entre cuadros incluido) y al terminar la escena conserva el último
  lugar y acción; sin camino el bloque manda, con camino manda el recorrido.
- El bloque inicial y el ＋ nacen con la pose actual. Tests nuevos en la suite.
## [2026-09-08] — Personaje nuevo: bloque inicial de 3 s (no toda la escena)

- Al ➕ Añadir Personaje se crea un bloque "De pie" de 3 s al inicio
  (`createInitialCharBlock` en `js/cinema/charTrack.js`): desde ahí se estira
  o se agregan más bloques; para toda la escena sigue el botón dedicado.
## [2026-09-08] — Modo 🐢 Suave aún más lento (~1/5 de la velocidad normal)
## [2026-09-08] — Botón 🐢 Suave: movimiento de cámara preciso

- Un solo interruptor junto a Frontal/Superior/Lateral (`smoothMoveBtn`):
  con modo suave la rueda (dolly), el botón derecho (vuelo) y el botón
  izquierdo (rotación) van a ~1/3 de velocidad para más precisión
  (`setSmoothMove` en `js/core.js`); apagado = velocidades actuales.
## [2026-09-08] — Cerrar proyecto + atajos Ctrl+N / Ctrl+Q

- **✖ Cerrar** en Archivo y botón junto al 💾 (`btnCloseProject`, `mnuClose`):
  pregunta si hay cambios sin guardar y vuelve al menú inicial.
- **Ctrl+N** nuevo (no existía): pregunta si guardar y va directo al
  formulario de proyecto nuevo (para abrir uno está Abrir…).
- **Ctrl+Q** cerrar. Nota: algunos navegadores reservan Ctrl+N/Ctrl+Q.
## [2026-09-08] — Directorio `archivo/` para notas de diagnóstico

- Nuevo `archivo/` con `fixed_cinematica_gemini.md` y `mejoras_gemini.md`
  (antes sueltos en la raíz); la raíz vuelve a quedar limpia.
## [2026-09-08] — Pista PERSONAJES + reproducción determinista + guardado directo

- **Nueva pista 🧍 PERSONAJES** (`js/cinema/charTrack.js`, nuevo): una lane por
  personaje con bloque base de toda la escena (`charFullRange`), bloques de
  acción por tramo y bloque 🧍 CAMINO para el recorrido; click abre el editor
  de waypoints clásico sobre el piso. Persistencia en el JSON (`charBlocks`,
  `charFullRange` en `js/state.js` + `js/projectFiles.js`).
- **Imán entre pistas** (`js/cinema/tlSnap.js`, nuevo): al arrastrar/estirar,
  los bordes se alinean a ~8 px de otras pistas (tomas, personajes,
  subtítulos, quiz). Paso 0,1 s.
- **Reproducción determinista**: `updateTimeline` + `playScene/stopScene/scrub`
  usan `evaluateAllPathsAt(t)` (`js/cinema/timeline.js`); la aguja es la fuente
  de verdad, sin `startPlayback` ni `resetCharactersToInitialState`. La aguja
  queda limitada al tramo del bloque en edición.
- **Cámaras**: modos `front`/`Perfil` en tomas; sección "Cámara (Tomas)" con
  sujeto+vitsa por toma; `saveSelectedFrame` persiste el encuadre.
- **Guardado directo**: handle de archivo persistido en IndexedDB
  (`js/projectFiles.js`); "Guardar" reescribe sin diálogo tras recargar.
  Botón 💾 siempre habilitado; proyecto nuevo sugiere `proyecto_nuevo`.
- **Construcción**: borrar ventana cierra su hueco (`clearWallHoleFor`,
  `js/catalog.js`); mejoras en `js/construction.js`, `js/office/walls.js`,
  `js/collision.js` (ley del piso) y `js/office/furniture.js`/`lounge.js`.
- **UI**: paneles redimensionables (`js/ui/panelResize.js`, nuevo, con
  memoria en localStorage); botón `sit_talk`; editor de bloque de personajes.
- **Limpieza**: eliminada `scenes/alarma_en_la_red (1).json` (duplicado con
  sufijo de Windows); `node tools/fix-encoding.mjs` sin mojibake.
- Tests `tools/p7-test.mjs` ampliados (diálogo jefe, imán, tomas frontales).

## [2026-08-30/31] — Consolidado (commits ya en git, no registrados antes)

- Reorganización Fase 2 (`js/` en `characters/`, `cinema/`, `ui/`, `media/`) y
  Fase 3 (grafo acíclico, `check-scc` en verde); scripts `verify`/`check`/`test`
  y `pnpm` documentado; `README` con estructura por capas.
- Lip-sync mínimo (#2), sentarse real `sit_at` con animación + menú
  contextual + giro 180° + sillones de 2 lugares; canaletas con pasamuros;
  alarma visible con pulso; fix de eventos sin espera.
- Editor por secciones, creador de personajes v2, quiz multi-carteles,
  miniaturas de escenario, branding, hints; panel de acciones + modal
  avanzadas; menús unificados y exclusivos.
- Convención de orientación (`rotYToLookAt`), `standInFrontOf`/`standFacing`,
  `seatY` real, `fixCameraVisibility`; cinemática "Reunión de Prioridades del
  Jefe" (45 s) + resector de posiciones; tomas corregidas.
- Timeline: edición pegajosa con ✕, botón ＋ por pista con 💾/✕, ＋ al final
  con drag/clamp anti-solape, FPV→Libre reencuadra, Fase A cámara por
  personaje (1P/3P con `subjectId`).
## [2026-08-28] — Pistas: botón ＋ para crear bloques + 💾 guarda / ✕ descarta

- **Botón ＋ junto al rótulo de cada pista** (🎬 CINEMÁTICA, 💬 SUBTÍTULOS,
  📋 QUIZ): crea un bloque nuevo vacío del estilo de la pista, ubicado en el
  cabezal de reproducción y SELECCIONADO para editarlo en vivo:
  - Toma: Vista Libre de 2s (elegir vista/cámara, personaje y duración).
  - Subtítulo: "Nuevo subtítulo" de 2s con el texto listo para escribir.
  - Quiz: "¿Pregunta?" con 3 opciones de 10s, editor abierto.
- **💾 (disquete) en el bloque seleccionado**: GUARDA la mini-edición — en la
  toma, también la cinemática grabada (cinemaStorePath) y el encuadre Libre;
  registra el historial.
- **✕ ahora DESCARTA**: restaura el bloque al snapshot tomado al
  seleccionarlo (tiempos, texto/pregunta, cámara…, según la pista) y, en la
  toma, cierra la cinemática en edición SIN guardar el recorrido nuevo.
  El resto de la escena (personajes movidos, etc.) no se toca.
- Exports: `discardSelection` (timeline), `cinemaClearVisuals/All` (cinematics).

## [2026-08-28] — Bloques de la timeline: edición pegajosa con ✕ que guarda (toma / subtítulo / quiz)

- **Selección pegajosa**: al hacer click en un bloque (toma de cinemática,
  subtítulo o cartel de quiz), queda seleccionado con un **✕** en el bloque
  mientras se sigue editando la escena libremente (mover personajes, agregar
  objetos, activar cinemática…). Se quitó la des-selección por click afuera.
- **El ✕ es el commit**: al cerrar, guarda lo hecho en esa mini-edición:
  - **Toma**: si había un recorrido cinemático en grabación, se guarda
    (`cinemaDeactivate` → `cinemaStorePath`) y se reproduce con la escena; si
    era Vista Libre, también guarda el encuadre. Todo al historial.
  - **Subtítulo / quiz**: liberan su editor y registran el historial.
- **Exclusividad entre pistas**: elegir un bloque libera el anterior (toma ↔
  subtítulo ↔ quiz) — el quiz avisa por evento `quiz-block-selected` para no
  crear ciclo de imports con la timeline.
- **✕ nuevos en bloques de subtítulo y quiz** (la toma ya lo tenía): misma
  pastilla `.tl-shot-close`, visible solo en el bloque seleccionado.

## [2026-08-28] — Personajes en oficina: "standInFrontOf", "standFacing", "sitAtAnchor"

- `standInFrontOf` y `standFacing`: posicionan a un personaje junto a un
  mueble/mesa mirándolo — corrigen el problema sistemático de "mal quedando
  encima" por órbitas vilabóricas.
- `sitAtAnchor` usa la altura del asiento que toma (seatY del objeto).
- `fixCameraVisibility` (cinematics.js): tomas fijas no quedan atrás de pared.
- Tests: pruebas de `standInFrontOf` para muebles + la silla sentada bien.

## [2026-08-28] — Fix avisar al personaje que se ubica en "modo saber cuál es mi español"

---

## [2026-08-28] — Convención de orientación unificada (fix definitivo de "dados vuelta")

## [2026-08-28] — Personajes: frente a muebles + sentado con altura real + cámaras limpias

- **`standInFrontOf`** (nueva, `js/characters/characters.js`): posiciona a un
  personaje de pie junto a un mueble usando su ancla registrada y mirando su
  cara de uso. No más personajes "parados cerca de mesas" mal ubicados — se
  para al lado correcto y lo mira.
- **`sitAtAnchor` con altura real del asiento**: cada mueble registra su
  altura (`seatY`) — silla de comedor 0.48, gerencia 0.54, invitado 0.50,
  sillón verde 0.44, chesterfield 0.47 — y el personaje se posiciona allí
  (ni arriba flotando ni hundido). En la animación el descenso va a la misma.
- **`fixCameraVisibility`** (nueva, `js/cinema/cinematics.js`): al crear/editar
  tomas de cámara fija, detecta si el rayo cámara→objetivo atraviesa una
  pared o un mueble y acerca la cámara hasta que la línea de vista quede
  limpia (así no hay tomas "desde afuera").

## [2026-08-28] — Fix menú contextual: animación sin error, asiento funcional + sillas iluminadas
