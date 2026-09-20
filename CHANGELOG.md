# Changelog — MiniStudio 3D

Registro de cambios del proyecto. Formato: fecha + cambio. Las entradas más
recientes van arriba.
## [2026-09-20] — Botón ⧉ Duplicar en bloques de personajes

- Cada cuadro seleccionado ofrece ⧉: copia idéntica (acción, ánimo, lugar,
  movimiento) ubicada al final de su lane, esté el original último o antes.
  Sirve para repetir tramos (mascotas en loop) o extender quietos.
## [2026-09-20] — Cabezal más chico y sin línea sobre la botonera

- El cuadradito rojo baja de 27 a 22 px y la línea arranca en la regla
  (nada de rojo sobre play y compañía, ni aunque scrollee la línea).
## [2026-09-20] — Escenas viejas: caminar vuelve a animarse (migración real)

- Alarma/ransomware/incidente no traían bloques: se migraban con tiempos
  ficticios que pisaban el caminar (deslizaban en idle). Ahora los bloques
  cubren las esperas reales del recorrido y el walk/run lo pone el camino.
## [2026-09-20] — Bloques de desplazamiento: verde→rojo con duración auto

- El ＋ de personajes ofrece **estático** (lo de siempre) o
  **desplazamiento**: se marcan inicio (verde) y fin (rojo) en el piso y la
  duración sale sola (distancia/velocidad); al editarla, la velocidad se
  adapta. Animación obligatoria (caminar/correr): sin ella no guarda.
- En reproducción el personaje viaja (manda sobre camino y pose) y al
  terminar conserva lugar y acción; puntos intermedios quedan pendientes.
## [2026-09-20] — Paquetes suben por las bajadas (red conexa)

- El tramo del rack terminaba en la pared (callejón): la norte ahora llega
  hasta la bajada y los datos SUBEN por ella y siguen el recorrido.
- El grafo soporta tramos verticales (risers en las 8 bajadas: racks, mini
  rack, piso, jefe, fotocopiadora, 3 norte) y parte tramos en uniones en T.
- Tests de conectividad del grafo en la suite.
## [2026-09-18] — Playhead: cabezal a la altura de la regla + tope visible en 0s

- **Cabezal más abajo (a la altura de los segundos)**: el cálculo usaba
  `ruler.offsetTop`, pero la regla vive dentro de `.tl-body` (que es
  `position: relative`), así que el valor siempre era 0 y el cabezal quedaba
  ~40 px arriba, sobre la barra de herramientas. Ahora se posiciona con las
  medidas reales (rectángulo de la regla relativo al panel del playhead),
  centrado en los segundos; si el cuerpo scrolleó, se ancla arriba del área
  visible (`positionPlayheadKnob` en `js/cinema/timeline.js`).
- **Tope duro y visible en el segundo 0**: la aguja ya hace tope en 0 (no va
  más atrás y el tiempo nunca es negativo), pero al llegar exactamente a 0 el
  playhead se ocultaba (`display:none`) y parecía que se metía detrás de las
  pistas. Nueva bandera `playheadUsed`: apenas se arrastra el cabezal, se
  mueve la aguja con los botones o se toca Play, la aguja queda visible —al
  llevarla al 0 se detiene ahí y se queda dibujada; al mover el mouse de nuevo
  para adelante sigue el recorrido normal.
- `pnpm run verify` en verde.

- **#1 — Exportación MP4**: el contenedor se elige con `isTypeSupported`
  (preferencia MP4/H.264 → WebM VP9 → VP8). Nuevo selector "Formato" junto a
  ⬇ Exportar (`Auto (MP4/WebM)` / `WebM`) que se auto-explica según lo que
  soporte el navegador, y el archivo baja con la extensión correcta. La
  elección vive en `pickExportMime()` (pura y cubierta por tests).
- **#2 — Salida 1080p fija OFFLINE**: el video ya no se renderiza en el canvas
  de edición estirado a 1920×1080, sino en un canvas/renderer propios de
  1920×1080 reutilizados entre exportaciones (`js/media/recorder.js`). Nuevo
  `output.renderer` en `js/core.js`: el loop de render, los subtítulos y el
  quiz escriben ahí, así el video sale en 1080p fijo sin depender de la
  ventana y sin tocar el viewport (que se muestra encima, en vivo, con el
  mismo letterbox 16:9). Si no se puede crear el segundo contexto WebGL, cae
  automáticamente al comportamiento anterior.
- **#3 — Cámaras colocables**: nuevo prop `📷 Cámara` (`js/office/sceneCameras.js`,
  catálogo `📡 Red`): cuerpo low-poly con trípode, seleccionable/movible como
  cualquier pieza y con **FOV propio** (slider 20°–100° en el panel 🎥).
  Nueva vista de toma **“📷 Cámara puesta”**: la toma mira con la posición,
  orientación y FOV del prop (el encuadre se define en la cámara, no en la
  toma, así se reutiliza en varias tomas). El FOV persiste en el JSON
  (`spawnData.fov` + `rebuild`).
- Tests nuevos en la suite: FOV por defecto/clamp/persistencia, corte de toma
  a cámara puesta (posición, altura de óptica 1,5 m, sur con `rotY=0`), y la
  elección de contenedor MP4/WebM en sus cuatro casos. `pnpm run verify` verde.
## [2026-09-18] — GLM #4: paquetes de datos animados por las canaletas

- Nuevo `js/office/packets.js`: 6 pulsos luminosos (esfera emisiva + estela
  tenue, en cian/verde/ámbar) viajan a 2,4 m/s por la red de canaletas —
  la instalación fija (`fixedTraySegs`) MÁS los tramos dibujados punto a
  punto con la herramienta de canaletas.
- Navegación por grafo: los extremos de tramo que se tocan forman esquinas;
  al llegar a un nodo el paquete elige otra arista (nunca vuelve por donde
  vino salvo callejón). Velocidad real en m/s (constante en tramos cortos y
  largos), respeta pausa y velocidad de reproducción y sale determinista en
  la exportación (usa `simDt`).
- Auto-reconexión: una firma de la red (nº de fijos + id/posición de runs
  visibles) se relee cada frame; si agregás, movés o borrás una canaleta el
  grafo se reconstruye sin reiniciar los paquetes en vuelo.
- Cuelgan de `officeGroup` (desaparecen fuera del ambiente oficina) y se
  ocultan en la vista "👁 Solo edificio". Nada se serializa: decoración de
  escena, no contenido del proyecto. Geometría vía `geoCache`.
- Tests: el módulo carga en la suite y mantiene el registro de tickers.
  `pnpm run verify` en verde.
## [2026-09-18] — GLM #7 y #8: viewport sin timeouts + toggle de vistas

- **#7 (inicialización frágil)**: `js/ui/viewport.js` ya no llama `onResize`
  con 3 timeouts (0/100/500 ms) adivinando cuándo asienta el layout. Ahora un
  `ResizeObserver` sobre `#viewport-container` dispara el ajuste ante cada
  cambio real de tamaño (arranque, paneles redimensionados, ventana); el
  evento `resize` global queda como fallback donde no haya `ResizeObserver`
  (p. ej. los tests de Node).
- **#8 (toggle de vistas raro)**: no era un bug visual sino código muerto —
  el panel de botones `.view-btn` (órbita/1ª/3ª/persecución/cine) se quitó en
  la Fase A y las vistas viven en el `<select>` de la toma y en los botones
  1P/3P por personaje. Eliminados: el marcado de `.view-btn` en `setCamView`
  (cinematics.js), el wiring de clicks en ui.js, el import huérfano de
  `applyViewToSelectedShot` y los estilos `.view-btn*` de style.css.
- `pnpm run verify` en verde tras ambos cambios.
## [2026-09-18] — Limpieza de código muerto y basura (revisión general)

- Eliminado `js/ui/compass.js`: módulo huérfano (nadie lo importaba) y roto
  (usaba `THREE` sin importarlo); sus elementos (`compassRoot/Needle/Label`)
  no existen en `index.html`.
- Retirados los lookups/handlers de elementos que ya no están en el HTML:
  `cinemaEditControls` (cinematics), `cameraViewControls` (cinematics y
  timeline), `btnCinemaExit`, `btnResetTargetPos`, `btnFaceCamera`,
  `btnDeleteObj`, `btnDuplicateObj`, `btnDeleteMulti` y `btnConstruction`
  (ui). `updateCameraViewVisibility` quedó como no-op documentado (la llaman
  selection.js/viewport.js); import de `duplicateActiveObject` limpiado.
- Borrados `viewport_fixed.tmp` (0 bytes) y `__pycache__/` de la raíz.
- `tools/fix-encoding.mjs` ahora recorre `js/` recursivo (characters/,
  cinema/, ui/, media/, office/) y los `.css` de la raíz; con eso se reparó
  el mojibake pendiente de los comentarios de `style.css` (la herramienta
  antes solo miraba js/ y js/office/).
- `pnpm run verify` en verde tras la limpieza.
## [2026-09-08] — Render determinista en exportación (backlog #7)

- Exportando, la sim avanza por pasos fijos de 1/30 s (acumulador sobre el
  reloj real): sin saltos por drops y misma trayectoria en cada video. En
  vivo todo igual. Tests del reloj en la suite.
## [2026-09-08] — Construcción Fase 3–5 completa (editor de escenas)

- **Fase 3**: pisos y paredes se redimensionan arrastrando sus 4 bordes
  (solo ese lado se mueve); el texturado va por baldosas, no se estira.
- **Fase 4**: las puertas tienen imán a pared y abren su hueco (ventanas ya
  lo tenían), botón 🧲 Pegar a pared, y los huecos persisten en el JSON
  (fix: soltar una abertura crasheaba por `clearWallHole` inexistente).
- **Fase 5**: 3 diseños de puerta (vidrio/madera/doble) y 3 de ventana
  (clásica/panorámica/persiana) con selector al crear y en el panel.
- Higiene: ya no se hace dispose de geometrías compartidas de geoCache.
## [2026-09-08] — Cabezal a la regla + lugar auto-guardado en el cuadro

- El cabezal rojo va anclado a la regla de segundos (antes flotaba arriba
  del panel); se reancla si cambia el layout.
- Definir acción/ánimo en el cuadro también guarda el lugar actual (antes
  solo el 💾); aviso al abrir el editor.
## [2026-09-08] — Fix "todo a destiempo": escala única + duración al día

- Cada pista dibujaba con su escala (personajes/quiz al doble que las
  tomas, quiz 6px corrido): nuevo `js/cinema/tlScale.js` con píxeles-por-
  segundo y rótulo únicos para todas.
- La duración y la regla se recalculan al crear/mover/borrar bloques, al
  confirmar tomas y al dar play (antes la regla quedaba vieja).
## [2026-09-08] — Dolly/zoom dentro de la toma (backlog #6)

- La toma guarda encuadre de FIN ("📍 Marcar fin aquí" en 🎥 Cámara):
  durante el plano viaja inicio→fin (libre/fija, con smoothstep); se ve en
  la aguja, persiste en el JSON y el ✕ lo descarta. Botón ✕ Quitar.
## [2026-09-08] — Transiciones suaves entre acciones (backlog #5)

- Al cambiar de acción cada articulación interpola 0.3 s (smoothstep +
  slerp) en humanos, perro y gato; gestos también entran suave. La raíz no
  se mezcla. Tests nuevos (muestras de lip-sync movidas fuera de la ventana).
## [2026-09-08] — Perros y gatos en el creador, con 3 variantes cada uno

- El ➕ Añadir personaje ahora ofrece 🧍 Persona, 🐕 Perro y 🐈 Gato; las
  mascotas tienen 3 variantes de pelaje, vista previa y nombres al azar.
- Las mascotas persisten en el JSON (especie + colores) y aparecen en los
  botones de personajes; las fábricas aceptan colores sin cambiar los
  defaults.
## [2026-09-08] — Todo lo nuevo aparece en el centro de la vista

- Nuevo `viewCenterGround()` (`js/core.js`): rayo cámara→piso. Personajes,
  piezas del catálogo y construcción spawnean donde mirás (antes al objetivo
  de órbita, que no siempre coincide). Duplicar sigue al lado del original.
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
