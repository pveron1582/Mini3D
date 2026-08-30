# Changelog — MiniStudio 3D

Registro de cambios del proyecto. Formato: fecha + cambio. Las entradas más
recientes van arriba.
## [2026-08-28] — pnpm documentado como runner de los validadores

- **`README.md`**: comandos de verificación actualizados a `pnpm run verify /
  check / test` (npm sigue funcionando igual); nota de que el proyecto no
  tiene dependencias (no hace falta install); fila nueva en el stack
  tecnológico (Node + pnpm para validadores).
- **`SKILL.md`**: regla 6 nueva — correr `pnpm run verify` antes de dar por
  terminada una tarea de desarrollo; `pnpm run check` como verificación
  rápida del grafo.

## [2026-08-28] — Fase 3 de reorganización: grafo 100% acíclico + npm verify

- **Último ciclo de imports roto** (`js/undo.js` + `js/main.js`): undo.js ya
  no importa projectFiles.js; `initUndo({ serialize, apply })` recibe las
  funciones por inyección desde main.js. El grafo queda **sin ningún ciclo**
  (`check-scc`: "SCCs con ciclo: ninguno" — antes quedaba
  projectFiles ↔ catalog ↔ undo).
- **`package.json`**: comandos npm — `verify` (todo: imports + ciclos + suite
  + loadtest + geo-cache), `check` (imports + ciclos), `test` (p7-test),
  `test:load` y granulares `check:imports` / `check:scc`. Se retiró la
  referencia al validate-office.cjs borrado en la Fase 2.
- **`README.md`**: nueva sección "Comandos de verificación" con los tres
  comandos principales.

## [2026-08-28] — Fase 2 de reorganización: js/ en subcarpetas por capa

- **`js/` pasa de 34 archivos sueltos a 4 subcarpetas + núcleo** (18 módulos
  core quedan en la raíz de js/):
  - `js/characters/` — characters.js, characterCreator.js, anchors.js
  - `js/cinema/` — cinematics.js, timeline.js, quizTrack.js, wizard.js, navigation.js
  - `js/ui/` — ui.js, gizmo.js, selection.js, multiselect.js, viewport.js
  - `js/media/` — recorder.js, subtitles.js, quiz.js
- **~120 imports reescritos** en 28 archivos (rutas relativas recalculadas
  según el origen: misma carpeta `./`, hermana `../sub/`, raíz `../`).
  `index.html` no cambió (entra por `js/boot.js`, que no se movió).
- **`tools/p7-test.mjs`**: paths de import actualizados a las subcarpetas.
- **`tools/validate-office.cjs` borrado** (deprecado): analizaba nombres por
  regex sin resolver rutas — daba falsos positivos (un comentario que
  mencionaba `createMiniRack` lo rompía). `check-imports.cjs` (resolución real
  de rutas, recursivo), `check-scc.js` y `p7-test.mjs` cubren todo.
- **`SKILL.md`**: sección "Estructura del código" reescrita con el árbol nuevo
  por capas (y limpieza de entradas de archivos ya inexistentes).
- Validadores en verde: `check-imports`, `check-scc`, `p7-test`, `p7-loadtest`,
  `test-geo-cache`.

## [2026-08-28] — Fase 1 de reorganización: limpieza de la raíz

- **Borrados**: `server_err.txt` / `server_out.txt` (logs vacíos de serve.py;
  el `.gitignore` ahora los cubre junto con `*.log`) y `mejoras_glm.md`
  (informe de arquitectura histórico: todos sus ítems P1–P8 estaban resueltos
  y solo P9 quedó parcial; su contenido vivo vive en `GLM.md` —informe de
  estado— y `mini3d_mejoras.md` —backlog—).
- **Reglas consolidadas**: `AGENTS.md` queda como la única fuente de las reglas
  de trabajo; `CLAUDE.md`, `.cursorrules` y `.windsurfrules` pasan a ser
  punteros/alias de una línea (los requieren las herramientas por nombre, no
  valía borrarlos).
- La raíz queda en 15 archivos (antes 19), todos con rol claro:
  app (index/style/serve), docs (README/SKILL/GLM/CHANGELOG/backlog/reglas),
  config (LICENSE/package/.gitignore).

## [2026-08-28] — Carteles de pregunta (quiz): pista propia, varios por escena, en modo 📝 Textos

- El modo **Subtítulos pasó a llamarse 📝 Textos** (abarca subtítulos y carteles
  de pregunta). El cartel de quiz ya no está anclado a una toma: vive como
  bloque en la **nueva pista 📋 QUIZ** de la línea de tiempo (bajo subtítulos,
  bloques violetas seleccionables/arrastrables, con su rótulo propio).
- **Varios carteles por escena**: se pueden intercalar en cualquier momento
  (uno a mitad de escena, otro al final, los que quieran), con su tramo
  [inicio, fin] propio. Se crean con "➕ Nuevo cartel" (arranca en el cabezal).
- **Editor en el modo Textos** (`#quizEditPanel`): pregunta, 3 opciones, correcta
  (A/B/C), tiempo del reloj, inicio/fin — todo se guarda mientras se escribe,
  igual que los subtítulos. Se elige el bloque en la pista y se edita.
- **Coexistencia con subtítulos**: mientras un cartel está en pantalla, los
  subtítulos de ese tramo NO se dibujan (uno u otro). Cuando el reloj del
  cartel termina y se oculta, los subtítulos vuelven.
- **Disparo por tramo** (no por toma): al reproducir o hacer scrub, el cartel
  del tramo actual aparece con su reloj; cada bloque se muestra una vez por
  pasada. Los clicks fuera de la sección Textos des-seleccionan el bloque.
- **Compatibilidad**: los proyectos viejos con `shot.quiz` (ej.
  `alarma_en_la_red.json`) se migran automáticamente a la pista al abrirlos
  (bloque con el tramo de esa toma). Serialización nueva: `quizzes[]` en el
  JSON del proyecto.

## [2026-08-28] — Bloques de toma/subtítulo: sin bloqueo visual, selección por sección

- **Sin bloqueos ni recuadros blancos** (`js/timeline.js` + `style.css`): se
  eliminó el sistema `shot-view-lock` / `sub-edit-lock` que oscurecía la UI y
  remarcaba con recuadro blanco al elegir una toma o un subtítulo. Ahora, con
  las secciones de edición por modo, elegir un bloque no bloquea nada.
- **Selección pegajosa solo dentro de su sección** (`js/ui.js`): con un bloque
  de toma (cinemática) o de subtítulo elegido, los cambios en su sección se
  aplican EN VIVO al bloque (vista de cámara → toma; texto/fuente/tamaño →
  subtítulo). Si el click cae FUERA de esa sección (viewport, otro panel,
  timeline, etc.), el bloque se deselecciona solo y todo queda libre. Cambiar
  de editor (Personajes/Objetos/…) también suelta la selección.
- **`style.css`**: ~100 líneas de reglas de bloqueo eliminadas.

## [2026-08-28] — Modo Cinemática: lista de personajes al entrar + scroll

- **`js/ui.js`**: al entrar al modo Editar→Cinemática se refresca la lista
  "Recorridos por personaje" (antes quedaba desactualizada hasta tocar algo
  en la escena). La lista trae, como originalmente: el nombre del personaje,
  ▶ para reproducir SOLO su recorrido (habilitado si tiene uno), 🎬 para
  activar/desactivar la grabación del recorrido de ese personaje, y ✖ para
  borrar su cinemática.
- **`js/cinematics.js`**: `updateCinemaCharList` ahora excluye personajes
  ocultos/borrados (en un proyecto nuevo sin defaults no aparecen filas de
  personajes que no existen en la escena).
- **`style.css`**: la lista de recorridos es scrolleable (`max-height` 240px)
  para que el panel no crezca indefinidamente con muchos personajes custom.

## [2026-08-28] — Panel Personajes: Transformación arriba, justo después de los personajes

- **`index.html`**: la sección "Transformación 3D" (Posición X/Y/Z, Giro y
  Escala) se movió para quedar INMEDIATAMENTE después de la lista de
  personajes y su botón ➕ Añadir — antes de las Animaciones. Orden nuevo:
  Personajes → Posición/Tamaño → Animaciones en bucle → Gestos → Ánimo.
  (La sección es la misma, sin cambios internos; el flujo queda "primero
  quién es y dónde está, después cómo actúa".)

## [2026-08-28] — Creador: preset femenino completo + nombres únicos

- **Preset por género** (`js/characterCreator.js`): al elegir Mujer el modelo
  llega YA configurado con un look femenino claramente distinto al hombre:
  pelo largo castaño, piel clara, remera violeta, pantalón oscuro y
  zapatillas rosadas (FEMALE_PRESET); el hombre mantiene el look por defecto
  (MALE_PRESET). Cambiar de género aplica el preset, regenera el nombre y
  refresca la vista previa — todo sigue editable.
- **Nombres únicos**: no se puede crear un personaje con un nombre que ya
  exista en la escena (comparación sin mayúsculas/minúsculas). Al aceptar con
  un nombre repetido, avisa "Ya existe X en la escena", selecciona el campo
  y no crea nada hasta cambiarlo. El generador 🎲 también evita nombres ya
  usados al azar.

## [2026-08-28] — UX: creador se resetea, escala solo por panel, personajes se apoyan y no atraviesan paredes al soltar

- **Creador de personajes** (`js/characterCreator.js`): al abrir SIEMPRE arranca
  con los valores por defecto (no conserva la última configuración) + nombre
  aleatorio. Crear uno lo agrega y reinicia el formulario para el siguiente.
  Cerrar (✖ o click afuera) PREGUNTA "¿Abandonar la creación sin guardar?".
- **Escala solo desde el panel izquierdo**: se quitó el escalado con la banda
  del anillo azul (molestaba al mover). Nuevo slider "Escala" (0.5–2) en la
  sección de transformación junto a X/Y/Z/Rot — única vía para escalar,
  personajes y objetos.
- **Personajes se apoyan al mover** (`js/gizmo.js` `updateAirDrag`): durante el
  arrastre con el anillo, el personaje no flota — se mantiene en el piso, o
  ENCIMA del mueble que quede debajo (mesa/silla/sillón: sube a la altura de
  su tapa automáticamente). Sentados/acostados conservan su altura. Objetos
  conservan su Y.
- **Paredes/puertas al arrastrar** (`js/collision.js` + `js/gizmo.js`): durante
  el drag el personaje puede ATRAVESAR paredes (para pasarlo de un ambiente al
  otro); al SOLTAR, `resolveDropAfterDrag()` lo acomoda pegado al lado más
  cercano — nunca queda incrustado a mitad de pared. Vía `store.dragTargetId`.

## [2026-08-28] — Creador de personajes: género, nombres, vestimenta y accesorios + cámara viaja al objetivo

- **Creador (`index.html` + `js/characterCreator.js`)**:
  - **Género** con radio Hombre/Mujer (Hombre por defecto). Elegir Mujer
    regenera el nombre acorde y activa pelo largo en la vista previa.
  - **Nombre al azar** según el género (listas de 20 nombres cada una en
    `characterCreator.js`), editable; botón 🎲 para generar otro.
  - **Vestimenta**: Informal (default), Traje de oficina, Empleado de
    limpieza, Cocinero y **Mameluco** (traje de una pieza). Cada una aplica
    su paleta de colores sugerida a los pickers (el traje de oficina activa
    la corbata); todo editable después.
  - **Accesorios**: Corbata, 🕶️ Anteojos de sol, 🎩 Sombrero y 🧢 Gorra
    (además del peinado con gorra). Los zapatos siguen siendo configurables.
- **Modelo humano (`js/characters.js`)**: outfits low-poly (pechera con
  tirantes del mameluco, delantal de limpieza, chaqueta de chef con botones y
  pañuelo) y accesorios 3D (anteojos con patillas, sombrero de copa con ala,
  gorra con visera). Todo persiste en `characters[].colors` del proyecto JSON.
- **Cámara viaja al objetivo (`js/viewport.js`)**: `flyToTarget(id)` vuela
  suavemente (~0.85 s con easing) hasta el personaje/objeto y lo deja a un
  **acercamiento intermedio** (≈4.5 m, un poco elevado). Se dispara al elegir
  un personaje de la lista del panel y al elegir un objeto de la lista del
  modo Objetos.

## [2026-08-28] — Cinemática: movida al modo Editar→Cinemática (ya no en Personajes)

- **`js/ui.js`**: la sección "Cinemática (Recorrido)" — recorridos por
  personaje, reproducir todas, vistas de cámara, invertir/velocidad/bucle y
  eventos de waypoint — ya no se muestra en el modo Personajes; ahora es el
  contenido del modo **Editar→Cinemática** (tal cual está, sin cambios internos).
  El panel de Personajes queda enfocado en personajes (selección, acciones,
  gestos, ánimo, sliders y outliner).

## [2026-08-28] — UX: selección se limpia al cambiar de editor + anillo azul arrastra por el piso

- **`js/ui.js`**: al cambiar de modo de edición (`setEditMode`) se quita la
  selección del objeto/personaje activo (`clearActiveTarget`), así cada editor
  arranca limpio — ya no queda un objetivo seleccionado "fantasma" al pasar de
  Personajes a Objetos/Edificio/Subtítulos (y viceversa).
- **`js/gizmo.js`**: el arrastre del círculo interior del anillo azul vuelve a
  comportarse como el "piso" del objeto. Antes el plano de arrastre era
  perpendicular a la cámara (movimiento libre X/Y/Z, el objeto podía quedar
  flotando/clavado en altura); ahora el plano es HORIZONTAL a la altura del
  objeto: arrastrar el anillo mueve el objeto por el suelo (X/Z) conservando su
  altura de apoyo. La altura se sigue cambiando con el gizmo Y o los sliders.
  Aplica igual a personajes (conservan su `groundY`) y a objetos.

## [2026-08-28] — Subtítulos: panel propio en el modo Editar→Subtítulos

- **`index.html`**: el editor de subtítulos (`#subtitleEditPanel`, texto, ícono,
  fuente, tamaño, color, inicio/fin, borrar/nuevo) se movió de la sección
  Cinemática (donde se veía en todos los modos) a su propio panel
  `#subtitlesPanel`, visible **solo** en el modo Editar→Subtítulos. Los campos
  se habilitan igual: clic en un bloque de la pista de subtítulos (línea de
  tiempo) y todo se guarda mientras se escribe.
- **`js/ui.js`**: `applyEditMode()` ahora maneja el modo `subtitulos`: muestra
  únicamente el panel de subtítulos (oculta personajes, objetos, transform,
  cinemática, outliner y paredes). En Objetos/Personajes el editor de
  subtítulos ya no aparece.
- **`js/timeline.js`**: comentario del submenú actualizado (el panel ya no vive
  "siempre visible" bajo la Vista de Cámara).

## [2026-08-28] — Modo Objetos: lista de escena + catálogo con buscador + sliders

- **`index.html`**: nuevo panel `#objectsPanel` para el modo Editar→Objetos, con
  el mismo patrón que los gestos: botón **➕ Añadir Objeto**, buscador
  (`#objectSearch`) y lista scrollable (`#sceneObjectsList`) con los objetos de
  la escena (props + mobilario, sin personajes ni construcción). Al elegirlo
  desde el botón se abre un **modal del catálogo** (`#objectCatalogModal`) con
  las 33 piezas agrupadas por categoría y buscador propio (`#catalogSearch`);
  clic en una pieza la agrega a la escena. La canaleta sigue abriendo el modo
  dibujo punto a punto. En modo objetos el panel muestra también los **sliders
  de Posición X/Y/Z + Giro** (el mismo `#section-transform` de personajes).
- **`js/ui.js`**: `refreshSceneObjectsList()` lista/filtra los objetos de la
  escena (resalta el activo, clic selecciona); `openObjectCatalog()` /
  `renderCatalogList()` arman el modal con filtro sin acentos. `applyEditMode()`
  muestra el panel de objetos + transform en modo `objetos` (ocultando
  personajes), y `setEditMode('objetos')` enciende `store.editObjects` para que
  el gizmo pueda seleccionar/mover props (reemplaza al botón "✏️ Editar
  Objetos" que se quitó antes). La lista se refresca al cambiar la selección.
- **`index.html`**: se quitaron del panel de transformación los botones
  👀 Mirar Cámara, ⌖ Reset Posición, ⧉ Duplicar, 🗑️ Borrar y 🗑️ Borrar selección
  múltiple (pedido explícito: no se agregaron al panel nuevo de objetos).

## [2026-08-28] — Catálogo: Lote 3b — Mini Rack multi-instancia (cierra el Lote 3)

- **`js/office/network.js`**: el mini rack de pared pasa de código suelto a la
  fábrica `createMiniRack(id, name, x, z, rotY, y)` (geometría completa: carcasa
  abierta, montantes 19", patch panels, switches con LEDs y puerta de vidrio con
  bisagra). El rack FIJO de la sala de juntas sale de la misma fábrica, y se
  registró en el catálogo bajo `📡 Red` (`baseY` 2.3). El catálogo llega a 33 piezas.
- **`js/office/group.js`**: la puerta ya no es un singleton. `registerMiniRack()`
  agrega cada instancia a una lista, y `updateMiniRackDoor()` anima TODAS las
  puertas con estado propio (`doorOpen`/`doorAngle` por rack). Nueva
  `openAllRackDoors(open)` para la timeline. Se eliminó el export `miniRack`
  (nadie lo importa ya).
- **`js/ui.js`**: el botón "🚪 Abrir/Cerrar puerta" ya no está hardcodeado al id
  `miniRack`: aparece al seleccionar CUALQUIER objeto con `doorHinge` y opera
  sobre el activo.
- **`js/timeline.js`**: el flag `openDoor` de las tomas usa `openAllRackDoors()`
  en vez del singleton importado.
- **`js/catalog.js`**: prefijo `minirack` en `PREFIX_MAP` (duplicar el fijo).
- **`tools/p7-test.mjs`**: valida registro en catálogo, spawn con puerta a
  `baseY`, puerta del rack fijo, instancias distintas y estado independiente.

## [2026-08-28] — Sillas del comedor rotadas 180° + regla de orientación eliminada

- **`SKILL.md`**: se eliminó la regla 5 (orientación de mesas/sillas), ya sin
  importancia. La regla 6 pasa a ser la 5.
- **`js/office/lounge.js`**: las 6 sillas del comedor quedaban al revés (el
  respaldo apuntaba hacia la mesa). Se rotaron 180°: `lunchChair1–3` (lado
  norte) pasan de `0` a `Math.PI`; `lunchChair4–6` (lado sur) de `Math.PI` a `0`.
- **`tools/p7-test.mjs`**: el test de gestos usaba `human1Rig`, que ya no se
  exporta (los personajes default ahora se crean de forma lazy en `characters.js`).
  Se cambió a crear un rig de prueba con `addHumanCharacter`.

## [2026-08-28] — Cocina: rotada 90° antihorario (junto a la pared oeste)

La cocina ya está en la oficina derecha; ahora todo el conjunto se rotó 90° en
sentido antihorario, de modo que la fila que corría de este a oeste sobre la
pared sur pasa a correr de sur a norte sobre la **pared oeste** de esa sala,
manteniendo el mismo orden: máquina → heladera → dispenser → mesada.
- `js/office/lounge.js`: `createVendingMachine` (4.85,5.8), `createFridge`
  (4.85,7.1), `createWaterDispenser` (4.85,7.9), `createKitchenCounter`
  (4.85,9.3), las cuatro con `rotY = 0` (frente hacia la sala / este). La
  mesada (3.2 m) queda al sur sobre la pared opaca del fondo.
- Mesa de comedor y sillas sin cambios. Validado sintaxis + mojibake + tests.

## [2026-08-28] — Cocina: reacomodada en la oficina derecha (frente al jefe)

Se movió el conjunto de la cocina a la **oficina vacía que queda a la derecha de
la entrada** (con la oficina del jefe a la izquierda), contra la **pared opaca
del fondo** (la del sur, opuesta a la puerta), NO sobre la de vidrio, en línea y
con el mismo orden pedido: máquina de golosinas → heladera → dispenser → mesada
(con alacena).
- `js/office/lounge.js`: `createVendingMachine` (7.5,10.2), `createFridge`
  (9.0,10.2), `createWaterDispenser` (9.8,10.2), `createKitchenCounter`
  (12.0,10.2), todas con `rotY = π/2` (frente orientado hacia la sala; la
  espalda apoya en la pared sur z=11).
- La mesa de comedor y sus sillas se mantienen en su lugar (no estaban en la
  lista). Validado sintaxis + mojibake + tests.

## [2026-08-28] — Modos Editar: Subtítulos y Cinemática

- El selector **Editar** (menú desplegable superior + carrusel de la izquierda)
  ahora tiene 5 modos: Edificio, Objetos, Personajes, **Subtítulos** y
  **Cinemática**.
- **`index.html`**: dos opciones nuevas en el menú Editar (`mnuEditSubtitulos`
  💬, `mnuEditCinematica` 🎬).
- **`js/ui.js`**: `EDIT_MODES`/`EDIT_LABELS` ampliados a 5; marcado activo del
  dropdown ahora por `EDIT_MENU_IDS`; handlers de los dos botones nuevos.
- Al elegir Subtítulos o Cinemática (desde el menú o con las flechas `‹ ›` del
  carrusel) se muestra el título en el carrusel y el panel queda vacío por
  ahora — igual que Edificio/Objetos. Listo para que cada modo edite después
  su contenido.

## [2026-08-28] — Facepalm: antebrazo más encogido para llegar a la cara

La mano seguía quedando lejos de la cara. Con el brazo ya subido (pivot.x≈-1.5),
se aumenta la flexión del codo de `-0.9` a `-1.8` y la rotación de palma a
`-0.35`, de modo que el antebrazo se encoge y la palma apoya en la frente.

## [2026-08-28] — Gestos: aplaudir lateral (altura fija) + facepalm con brazo subido

- `clap` (👏): el "sacudir arriba/abajo" venía de aplicar el beat al CODO
  (cambiaba la altura del antebrazo). Ahora pivot.x y codo quedan FIJOS (el
  brazo adelante, antebrazo a la altura del pecho) y el beat varía únicamente
  el rotation.y de los hombros: cerca (±0.5) = palmas juntas frente al pecho,
  lejos (±1.0) = abiertas. Las palmas se chocan lateralmente sin subir/bajar.
- `facepalm` (🤦): la mano estaba muy abajo (casi centro del cuerpo). Se sube
  el brazo (pivot.x ≈ -1.5 → adelante/arriba, mano a la altura de la cara) y
  el codo flexiona menos (elbow.x ≈ -0.9) para que la PALMA apoye en la frente.

## [2026-08-28] — Gestos: rework con cinemática derivada (clap + facepalm)

- `clap` (👏): rehago con el cálculo del brazo (cuelga en -y desde el hombro
  ±0.38): pivot.x ≈ -1.0 (brazo adelante) + pivot.y ≈ ∓0.55 (derecho -0.55 /
  izquierdo +0.55 → mano en x≈0) + codo flexionado que levanta los antebrazos.
  El beat abre/cierra las palmas para que se junten frente al pecho.
- `facepalm` (🤦): rot.z negativa acerca el brazo derecho al centro/hacia la
  cara, rot.x lo trae al frente y el codo flexiona (elbow.x ≈ -1.6) levantando
  la PALMA a la frente; cabeza baja a la mano.

## [2026-08-28] — Gestos: facepalm con la palma + aplaudir que choca las manos

- `facepalm` (🤦): ahora el CODO flexiona llevando la **palma** a la frente (el
  antebrazo queda doblado hacia arriba y no barre la cara como antes). El brazo
  va un poco al frente/centro y la cabeza se inclina hacia la mano.
- `clap` (👏 Aplaudir): se corrigió la causa por la que las manos no se
  chocaban. En este rig el brazo cuelga en `-y`, por lo que `rotation.y` no
  mueve un brazo colgado al plano horizontal. Ahora el brazo primero va hacia
  adelante (`rotation.x ≈ -1.3`) y recién ahí `rotation.y ≈ ∓0.55` lo barre
  hacia el centro (cálculo: mano en x ≈ -0.03), donde **las palmas se juntan
  en el centro al frente**. El codo bombea al ritmo del beat para que se
  toquen y se aparten.

## [2026-08-28] — Gestos: fix de signo en elevación de brazos (saludar/encogerse)

El brazo cuelga en -y desde el pivote (en `±0.38`). Para que la mano DERECHA
suba hacia afuera (lado +x) la rotación en `z` debe ser POSITIVA, y negativa
en la izquierda. Estaba invertido, por eso los brazos se balanceaban hacia
adentro (chocando cara/cuerpo).
- `wave` (👋 Saludar): `armR.rotation.z → +2.4` (+ oscilación pequeña), mano
  arriba-afuera del hombro; brazo casi recto, no cruza la cara.
- `shrug` (🤷 Encogerse): brazos abiertos hacia AFUERA (derecho +0.8, izquierdo
  -0.8) con codos doblados; hombros suben con el torso, vaivén de "no sé".

## [2026-08-28] — Gestos: brazos sin atravesar el cuerpo (hombros fijos)

- `clap` (👏 Aplaudir): los hombros quedan fijos en su sitio (±0.38, ya no se
  separan ni entran al cuerpo). El aplauso ahora se logra rotando los brazos
  hacia adelante y cerrándolos hacia adentro desde afuera (rotation.y), con
  manos que se juntan al frente en golpes marcados.
- `wave` (👋 Saludar): brazo arriba y afuera (z≈-2.6) con antebrazo alineado a
  la vertical, de modo que la mano oscila por fuera del cuerpo sin cruzar la
  cara.
- `shrug` (🤷 Encogerse): brazos abiertos hacia afuera (y hacia fuera) con
  hombros en su sitio; los antebrazos ya no cruzan el torso ni la cabeza.
- `celebrate` (🎉 Festejo): los puños rotan hacia ADELANTE (x≈-2.7) y se
  abren/cierran con rotation.y moderado; hombros fijos, sin atravesar el cuerpo
  ni la cabeza.
- Regla general aplicada a toda la `GESTURE_DEFS`: `h_armX.position` se deja en
  su valor de reposo (±0.38) y todo el movimiento de brazos se hace con
  rotaciones que mantienen la mano por fuera.

## [2026-08-28] — Gestos: mejoras, 3 nuevos, buscador y lista scrollable

- **Nuevos gestos** (`js/characters.js` → `GESTURE_DEFS`):
  - `yes` — ✅ **Asentir con la cabeza**: doble cabeceo afirmativo, el torso
    acompaña el movimiento.
  - `facepalm` — 🤦 **Facepalm**: la mano sube rápido a la frente y queda
    apoyada, con cabeza gacha y torso encorvado (vergüenza/desesperación).
  - `celebrate` — 🎉 **Festejo**: saltitos con los puños arriba bombeando los
    brazos (estilo gol/Logro), mirando hacia arriba y pecho afuera.
- **Gestos mejorados**:
  - `clap` (👏 Aplaudir): ritmo real de aplausos (las manos se juntan y separan
    con golpes marcados), brazos con codos más flexionados y torso/cabeza que
    rebotan levemente con cada aplauso.
  - `watch` (⌚ Mirar el reloj): antebrazo cruzando el pecho, dos pasadas de
    mirada a la muñeca, cuerpo ladeado y pie derecho tamborileando.
  - `shrug` (🤷 Encogerse): hombros más arriba, vaivén de "no sé" en brazos y
    cabeza.
- **UI de gestos** (`index.html` + `style.css` + `js/ui.js`):
  - Un gesto **por fila** (antes grilla de 2 columnas).
  - Lista **scrollable** (`.gesture-list`, máx. ~170px) lista para sumar gestos.
  - **Buscador** arriba del cuadro (`#gestureSearch`): filtra mientras se
    escribe por substring, ignorando mayúsculas y acentos ("apla" → Aplaudir).
  - `js/selection.js`: muestra/oculta el buscador junto a la lista.

## [2026-08-28] — Cargar proyecto antes de abrir el editor + reparación de mojibake

- **Flujo "📂 Cargar proyecto…"** (`js/boot.js`): ahora **pide el archivo JSON
  ANTES de cargar el editor**. Si el usuario cancela el selector, no se carga
  nada y se vuelve a la pantalla inicial. Solo tras elegir un archivo válido se
  importa `main.js` y se aplica el proyecto. Desde una sesión ya abierta
  (Archivo ▸ Nuevo… → preguntar si guardar → Cargar), el selector aparece con
  el editor a la vista, como antes.
  - `js/projectFiles.js`: nueva exportación `openProjectHandle(handle)` (lógica
    extraída de `openProjectPicker`, que ahora la reutiliza).
  - Fallback para navegadores sin File System Access API: input de archivo
    temporal creado por boot.js.
- **Reparación de mojibake** (causa de los "botones rotos" y textos corruptos en
  subtítulos/cinemática tras cargar un JSON): las reescrituras previas con
  PowerShell releían UTF-8 sin BOM como ANSI y regrababan los textos
  ("Diseñadora" → "DiseÃ±adora", "👋" → "ðŸ‘‹", etc.), dañando etiquetas de
  acciones, nombres y emojis usados por timeline/cinemáticas.
  - Nuevo `tools/fix-encoding.mjs`: invierte la doble codificación por runs de
    caracteres Windows-1252/Latin-1 con validación UTF-8 (roundtrip estable),
    preservando emojis ya correctos. Reparó 24 archivos, 2 pasadas.
  - Verificado: 0 marcadores de mojibake restantes, 0 errores de sintaxis,
    etiquetas restauradas ('👋 Saludar', '⌚ Mirar el reloj', 'Diseñadora', etc.).

## [2026-08-28] — Bugfix: vista vacía al crear proyecto + arranque sin personajes

- **Vista en negro** (`js/boot.js`): el canvas se dimensionaba a 0×1 mientras
  estaba oculto por `body.booting` (los reintentos de `onResize` de core.js a
  0/100/500 ms ya se habían disparado antes de que el usuario elija una opción
  del pop-up). Fix: al mostrar el editor se despacha `window 'resize'` (más un
  segundo despacho a los 100 ms) para recalcular la resolución del renderer.
- **Proyecto nuevo arranca vacío** (`js/characters.js`): los 9 humanos + perro
  + gato por defecto ya no se crean al importar el módulo. Ahora viven en
  `ensureDefaultCharacters()` (creación perezosa, única fuente) y sus tickers
  se registran ahí.
  - `clearDefaultCharacters()` (proyecto nuevo) solo marca el flag: escena sin
    personajes y panel de cinemáticas vacío; se agregan a medida que se suman
    desde el editor (`addHumanCharacter`).
  - `restoreDefaultCharacters()` SÍ los crea si no existen → los proyectos
    viejos guardados con los personajes por defecto visibles siguen abriendo
    igual (compatibilidad total con JSONs anteriores: `hideDefaultCharacters`
    y `characters[]` no cambian de formato).
- **`js/state.js`**: `store.activeTarget` inicial `null` (antes 'human1').
- **`js/main.js`**: sin selección inicial; `syncSlidersFromTarget()` es
  null-safe y el gizmo se oculta si no hay objetivo.

## [2026-08-28] — Pantalla de arranque: fondo con gradiente + escena decorativa animada

- **`style.css`**: fondo nuevo para `#startupModal` con gradiente tecnológico
  (azul profundo → violeta → petróleo) + tres halos radiales de color y una
  **grilla tenue tipo viewport 3D** (con máscara radial). Scoped a
  `#startupModal.startup-overlay` para que el wizard (misma clase overlay) siga
  dejando ver el editor detrás.
- **`index.html`**: escena SVG decorativa en la base del pop-up, con figuras al
  estilo del programa: **rack de servidores con LEDs parpadeantes**, dos
  **personajes blocky** (uno saludando, otro sentado frente al monitor),
  **escritorio con monitor encendido**, planta, **cámara de video en trípode** y
  **primitivas 3D flotantes** (cubo, esfera, pirámide) con animaciones suaves.
- Animaciones CSS: `suBlink` (LEDs), `suBob` (personajes), `suFloat`
  (primitivas), `suFlicker` (pantalla del monitor). Respetan
  `prefers-reduced-motion`.
- `z-index` de la tarjeta (2) sobre la escena (1): nunca se tapan.

## [2026-08-28] — Arranque con pop-up único + Archivo ▸ Nuevo…

- **`js/boot.js`** (nuevo, punto de entrada en `index.html`): al abrir la página
  se ve **solo el pop-up de inicio** (nuevo / cargar proyecto). El editor, la
  vista 3D y el resto de los módulos se cargan con `import('./main.js')`
  dinámico **después** de que el usuario elige. Una vez cargado, el mismo modal
  se reutiliza (los imports dinámicos devuelven las instancias ya evaluadas).
  - Flujo "Crear": aplica el escenario elegido en el formulario, `newProject`
    (nombre del input) e `initUndo`.
  - Flujo "Cargar": oculta el modal y abre el selector nativo de proyectos.
  - Muestra "⏳ Cargando editor…" y reporta errores en `#err`.
- **`index.html`**: `<body class="booting">` + nueva opción **📄 Nuevo…** en el
  menú **Archivo**; el script de entrada pasa de `main.js` a `boot.js`.
- **`style.css`**: regla `body.booting #app-container > *:not(#startupModal)`
  que oculta todo el editor hasta elegir una opción del pop-up.
- **`js/startup.js`** (refactor): ya no atiende el arranque inicial (lo hace
  boot.js). Mantiene: 💾 guardar rápido, Ctrl+S, 📄 nuevo (barra) y el nuevo
  **Archivo ▸ Nuevo…**, que preguntan "¿Guardar los cambios?" (Sí guarda / No
  continúa sin guardar) y reabren la pantalla principal de arranque.
  Exporta `showStartup()` para reabrir el modal.

## [2026-08-28] — UI: selector Editar (Edificio/Objetos/Personajes) + panel vacío

- **Menú superior "Editar"** ahora es dropdown con 3 opciones: 🏗️ Edificio,
  📦 Objetos y 🧍 Personajes (`index.html: #menuEditar`).
- **Panel izquierdo**: nuevo selector "Editar" siempre visible con texto y caja
  de modo + flechas `‹ ›` (`#editModeSelector`, `#btnEditModePrev/Next`,
  `#editModeName`). Todo el contenido previo quedó envuelto en `#editContent` y
  solo se muestra en modo **Personajes**; en Edificio/Objetos el panel queda
  vacío salvo el selector (pedido "por ahora").
- **Removidos** botones `✏️ Editar Objetos` y `🏗️ Modo Construcción` y su
  handler `btnConstruction` en `js/ui.js`; `store.editMode` (`'personajes'` por
  defecto) en `js/state.js` gobierna la visibilidad. `applyEditMode()` / `setEditMode()` /
  `cycleEditMode()` en `js/ui.js`.

## [2026-08-28] — P5 (futuro): SCC de imports verificado-benigno + guardia `check-scc`

- **`tools/check-scc.js`** (nuevo): construye el grafo de imports (js/ +
  js/office/), calcula los SCC con Tarjan y audita que **ningún módulo en
  ciclo lea bindings de su mismo SCC durante su evaluación** (la única forma
  real de que un ciclo explote). Acepta patrones seguros: cierres no
  invocados, listeners, `queueMicrotask`/`setTimeout`, primitivos.
- **`js/ui.js`**: `onTrayCreated(() => populateOutliner())` diferido con
  `queueMicrotask` — era el único hallazgo real del auditor (seguro hoy por
  hoisting, pero frágil si se convierte en `const`).
- **`package.json`**: `"type": "module"` y `npm test` corre los 4
  verificadores. `tools/check-imports.cjs` y `tools/validate-office.cjs`
  renombrados (eran CommonJS).
- Resultado: SCC de 19 módulos verificado sin lecturas prematuras. El ítem
  "futuro" de P5 queda cerrado: en vez del refactor masivo `init()`, la
  invariante queda garantizada por test y no por convención.

## [2026-08-28] — P6 (diferido): lookups de DOM agrupados en `js/dom.js`

- **`js/dom.js`** (nuevo): acceso centralizado al DOM.
  - `byId(id)`: memoizado — solo cachea resultados no nulos (si un elemento
    aparece más tarde en el DOM se lo encuentra en la siguiente llamada).
  - `qs(sel)` / `qsa(sel)`: wrappers sin caché (por contenido dinámico).
- **15 módulos** (ui, timeline, selection, wizard, characterCreator, startup,
  projectFiles, viewport, cinematics, render, undo, environment, recorder,
  gizmo, core): conversión mecánica de `document.getElementById(...)` →
  `byId(...)`, `document.querySelector(...)` → `qs(...)` y
  `document.querySelectorAll(...)` → `qsa(...)` (204 usos). Nombres elegidos
  para no chocar con variables locales `el` existentes.
- Antes: ~175 llamadas dispersas por módulo (62 en ui.js, 40 en timeline.js).
  Ahora todo pasa por un único punto con caché, fácil de perfilar o invalidar.
- Validado: `node --check` en todos los módulos, `tools/check-imports.js`,
  `tools/validate-office.js` y `tools/test-geo-cache.js` sin errores.

## [2026-08-28] — P9: caché de geometrías compartidas en `js/office/`

- **`js/office/geoCache.js`** (nuevo): caché memoizada de primitivas Three.js
  (`box`, `cylinder`, `sphere`, `plane`, `cone`, `ring`, `torus`, `circle`,
  `capsule` y poliedros). Las fábricas repiten primitivas idénticas; ahora las
  llamadas iguales devuelven la MISMA instancia de geometría. Compartir
  geometría es seguro para el editor (cada mesh conserva su transformación,
  selección, gizmo y colisión propias — a diferencia de InstancedMesh/merge).
  Regla documentada: no mutar geometrías cacheadas (`.translate()`/`.dispose()`).
- **`js/office/*`** (10 módulos: furniture, lounge, serverRoom, network, city,
  hackerHouse, walls, index, floor, alarm): conversión mecánica de
  `new THREE.XGeometry(...)` → `geo.X(...)` (335 llamadas; ~60% de las 421 del
  proyecto). Excluidos a propósito los módulos que disponen geometrías
  (`characters.js`, `cinematics.js`, `characterCreator.js`, `construction.js`)
  para no romper el caché compartido.
- **`tools/test-geo-cache.js`** (nuevo): smoke test Node de la caché
  (deduplicación + aislamiento por argumentos). `node_modules/three` es un shim
  local que apunta a `vendor/three.module.js`, solo para tests Node.
- Validado: `node --check` en todos los módulos, `tools/validate-office.js` y
  `tools/check-imports.js` sin errores.
- Pendiente de la P9 (futuro): evaluar `InstancedMesh`/merge SOLO en decoración
  estática no seleccionable, y opcionalmente extender el caché a material.

## [2026-08-28] — Personajes: gestos de un disparo (backlog #1)

- **`js/characters.js`**: nuevo sistema de gestos one-shot `GESTURE_DEFS` con 6
  gestos: señalar 👉, saludar 👋, encogerse de hombros 🤷, negar con la cabeza
  🙅, aplaudir 👏 y mirar el reloj ⌚. Cada gesto usa tiempo local y una
  envolvente (entra y sale suave de la pose).
  - `rig.playGesture(nombre)` lanza un gesto; `setAction('gesture:<nombre>')` lo
    rutea. Se reproducen UNA vez y vuelven solos a la acción base (que queda
    intacta en `currentAction`). Una acción sostenida cancela el gesto en curso.
  - Las acciones sostenidas existentes (`wave`/`clap`/`point` en bucle) se
    mantienen intactas para no romper escenas como `el_ransomware_del_jefe.json`
    (que usa `point` sostenido durante el quiz).
- **`index.html`**: grilla "Gestos (se ejecutan una vez)" en el panel de
  acciones humanas + 6 opciones `gesture:*` en el editor de eventos de waypoint.
- **`js/selection.js`**: muestra/oculta la grilla de gestos según el tipo de
  objetivo (solo humanos).
- **`tools/p7-test.mjs`**: valida `GESTURE_DEFS`, ruteo de `setAction('gesture:*')`,
  cancelación por acción sostenida y `playGesture`.

## [2026-08-28] — Catálogo: Lote 3 — Red + dibujo de canaleta punto a punto

- **`js/office/network.js`**: se extrajeron como fábricas exportables y se
  registraron en el catálogo bajo la nueva categoría `📡 Red`:
  - `createWallAP` (AP WiFi de pared, `baseY` 2.25) — ya existía como fábrica,
    ahora integrada al catálogo.
  - `createElecPanel` (tablero eléctrico, `baseY` 1.5).
  - `createCableTray` (canaleta de cables con 3 cables de colores, `baseY` 3.42).
  - `createFloorOutlet` (puesto de red+electricidad de piso).
- Materiales `trayMat`/`cableMats` a nivel de módulo para que las fábricas los
  reutilicen. La oficina queda igual: `buildNetwork()` llama a las fábricas con
  las mismas posiciones.
- **Dibujo de canaleta punto a punto** (`js/trayDraw.js`): al elegir "Canaleta
  de Cables" en el catálogo se entra en modo dibujo en vez de spawnear una pieza
  fija. Click marca el inicio y cada click agrega un tramo; un ghost transparente
  sigue al mouse sobre un plano a la altura de la canaleta; ESC o click derecho
  termina. El resultado es UN objeto seleccionable, movible con el gizmo y
  serializable. Detalles:
  - `createCableTrayRun` (en `network.js`) construye el tramo desde una lista de
    puntos y guarda los puntos relativos en `userData.spawnData`.
  - `catalog.js` usa `entry.rebuild` si existe (recrea el tramo desde sus puntos);
    `projectFiles.js` serializa `spawnData` como `data`.
  - `gizmo.js` ignora clicks mientras `store.trayDrawing` está activo, para que
    colocar un punto no seleccione/deseleccione; la cámara (orbitar/volar) sigue
    funcionando porque se distingue click de arrastre.
  - **Routing ortogonal + imán a la red**: los tramos siempre son rectos (nunca
    diagonales); el ghost se ajusta al punto recto más cercano según la dirección
    dominante del mouse. Un "imán" engancha el dibujo a la red existente
    (instalación fija u otros tramos dibujados, a la misma altura) y resuelve la
    conexión ortogonalmente: continuación recta, esquina en 90° o unión en "T" a
    un tramo recto. `network.js` expone `getFixedTraySegments()` como destinos y
    el ghost se pinta verde + resalta el punto cuando engancha.
- **`js/catalog.js`**: prefijos `ap`/`elecpanel`/`flooroutlet` en `PREFIX_MAP`
  para poder duplicar los objetos de red originales de la escena.
- **Mini rack** se deja para una sesión dedicada (`Lote 3b`): su puerta
  interactiva está acoplada a `group.js`/`ui.js`/`timeline.js`; generalizarla a
  múltiples instancias sin romper la escena de alarma requiere trabajo propio.
- **`tools/p7-test.mjs`**: valida registro y spawn de las 4 piezas (el catálogo
  pasa de 28 a 32).
- **Backlog** (`mini3d_mejoras.md`): se agregó el ítem 11 "Terminal en pantalla /
  screencast" y el capstone "AI Director local (Ollama)".

## [2026-08-27] — Personajes: proyectos vacíos + creador de personajes

- **Proyectos nuevos sin personajes**: al crear un proyecto nuevo (incluye
  🌱 Terreno) ya no aparecen los 9 humanos ni las mascotas por defecto. Las
  escenas existentes que no traen `hideDefaultCharacters` los restauran al
  abrirlas, así los JSON viejos no cambian.
- **Nuevo botón “➕ Añadir Personaje”** en el panel izquierdo: abre un modal
  con vista previa 3D central (`js/characterCreator.js`) y cámara libre
  (OrbitControls: arrastrar rota, rueda zoom, botón derecho paneo).
- **Editor de personaje**: personaje genérico parado y animado; opciones de
  nombre, tono de piel, peinado (corto/largo/gorra/capucha), color de pelo,
  remera, pantalón, zapatos y corbata. Al aceptar se agrega cerca del centro
  de la vista, queda seleccionado y aparece en el outliner y en la lista de
  personajes.
- **`js/characters.js`**: `createHumanoidModel` acepta modo preview sin
  registro; nuevas APIs `addHumanCharacter`, `syncCustomCharacters`,
  `clearCustomCharacters`, `clearDefaultCharacters`,
  `restoreDefaultCharacters`.
- **`js/projectFiles.js`**: los personajes personalizados viajan en
  `characters[]`; el estado “sin personajes por defecto” viaja en
  `hideDefaultCharacters`.
- **`js/ui.js`**: los botones de personajes se ocultan si el personaje está
  borrado; lista dinámica de personajes personalizados.
- **`tools/p7-test.mjs`**: verifica proyecto nuevo sin personajes y
  serialización de personajes personalizados.
- **Fix**: el perro y el gato también se ocultan en proyectos nuevos. Sus rigs
  no tenían `id`, por lo que `setDefaultCharactersVisible` los salteaba; ahora
  el id se resuelve también desde `root.userData.id`. El test ahora cubre
  `human1`, `dog` y `cat`.

## [2026-08-27] — Catálogo de objetos: Lote 2 — Lounge/Gerencia

- **`js/office/lounge.js`**: se extrajeron como fábricas exportables las piezas
  de juntas y gerencia: `createConferenceTable`, `createChesterfield`,
  `createBossTable`, `createBar`, `createExecDesk`, `createExecChair`,
  `createGuestChair`, `createPainting` y `createWallClock`. La oficina queda
  igual: `buildLounge()` las llama con las mismas posiciones/rotaciones.
- **Nueva categoría `🛋️ Lounge/Gerencia`** en el catálogo (`➕ Agregar Objeto`),
  con 9 piezas.
- **`js/catalog.js`**: las entradas del catálogo pueden declarar `baseY`; el
  spawn sin posición explícita usa esa altura (cuadro y reloj aparecen a
  altura de pared). `PREFIX_MAP` aprendió los prefijos de lounge/gerencia.
- **Migración de origen**: `confTable` y `bossTable` ahora son grupos con
  origen en el piso (la superficie queda dentro del grupo). Las escenas
  guardadas ajustan `pos[1]` a `0` para mantener la altura visual.
- **`tools/p7-test.mjs`**: verifica las 9 piezas nuevas y el spawn de cuadro
  con `baseY`.

## [2026-08-27] — Catálogo de objetos: Lote 1 — Cocina

- **`js/office/lounge.js`**: las piezas inline de la cocina se extrajeron como
  fábricas exportables: `createKitchenCounter`, `createFridge`,
  `createWaterDispenser`, `createVendingMachine`, `createLunchTable`.
  La oficina queda igual: `buildLounge()` las llama con las mismas posiciones
  y rotaciones originales.
- **Nueva categoría `🍽️ Cocina`** en el catálogo (`➕ Agregar Objeto`):
  mesada, heladera, dispenser, máquina de golosinas y mesa de comedor.
  El registro se hace desde `buildLounge()` siguiendo el patrón de
  `serverRoom.js` (sin sumar un import circular desde `catalog.js`).
- **`js/catalog.js`**: `PREFIX_MAP` aprendió los prefijos de cocina para que
  las piezas fijas de la oficina se puedan duplicar desde el catálogo.
- **Migración de origen**: `lunchTable` ahora es un grupo con origen en el
  piso (la tapa queda a `y=0.74` dentro del grupo), como el resto de las
  piezas spawneables. Las escenas guardadas ajustan `lunchTable.pos[1]` de
  `0.74` a `0` en `scenes/alarma_en_la_red.json` y
  `scenes/alarma_en_la_red (1).json` para mantener la altura visual.
- **`js/ui.js`**: las suscripciones top-level a `onTargetSelected` se difieren
  con `queueMicrotask` (mismo patrón que `gizmo.js`), para que el grafo de
  módulos cargue en cualquier orden.
- **`tools/p7-test.mjs`**: ahora verifica las 5 piezas de Cocina y el spawn de
  `lunchTable` con origen en el piso.

## [2026-08-27] — Editor de escenas: Terreno + Modo Construcción (Fase 1-2)

Primera entrega del nuevo editor de escenas (capa de construcción independiente
de la oficina). Falta: redimensionar piso/pared por bordes (Fase 3) y más
diseños de piso/pared/puerta/ventana (Fase 5).

- **Nuevo ambiente "🌱 Terreno"** (`js/terrain.js`): lote vacío de 60×60 m con
  césped procedural. Se elige en el modal de arranque junto a Oficina/Estudio/
  Parque. Preset data-driven en `environment.js` (cielo, niebla y luz exteriores).
- **Nueva capa de construcción** (`js/construction.js`): grupo independiente
  (`constructionGroup`) donde viven los pisos, paredes, puertas y ventanas que
  edifica el usuario. Reutiliza las fábricas de `office/walls.js` (ahora con
  parámetro `parent`/`id`, retrocompatible) y las texturas de `floor.js`.
- **Modo Construcción** (antes "Editar Edificio"): al activarlo **reemplaza todo
  el panel izquierdo** por un menú de construcción (Piso · Paredes · Aberturas ·
  Ver · Salir). Al entrar cambia al ambiente Terreno; al salir restaura el panel
  normal. Herramientas: añadir piso (con tipo), pared, puerta y ventana; "solo
  edificio" para ocultar personajes.
- **Piso de construcción**: losa con textura a elección; el texturado se repite a
  tamaño constante (baldosas de 2 m) en vez de estirarse, base de la Fase 3.
- **Persistencia**: las piezas de construcción viajan en el JSON del proyecto
  (campo `construction[]`) y se recrean al abrir; `newProject()` vacía la capa.
- **Selección/gizmo**: el tipo `floor` se suma a los elementos "building"
  (editable solo en Modo Construcción); outliner agrupa piso/pared/puerta/ventana.
- `selection.js`: nuevo `unregisterSelectable()` para limpiar la capa al cargar.

## [2026-08-27] — P6: Limpieza menor

- **Borrado `studio.html`**: era solo un redirect a `index.html` y nada en el
  código lo referenciaba (punto de entrada huérfano).
- **`js/quiz.js`**: `QW`/`QH`/`duration` movidos a constantes con nombre arriba
  del archivo (`QUIZ_WIDTH`, `QUIZ_HEIGHT`, `QUIZ_DURATION_SECONDS`), sin cambio
  de comportamiento.
- **Evaluado y conservado** `scenes/alarma_en_la_red (1).json`: no es un
  duplicado idéntico del principal (difiere en 213 líneas; es una copia antigua,
  el principal es más nuevo). Se mantiene por decisión del usuario.
- **Diferida** la agrupación de las ~175 llamadas `getElementById/querySelector`
  por módulo (concentradas en `ui.js` y `timeline.js`): se hará al dividir
  `ui.js`; refactor grande de bajo beneficio inmediato.

## [2026-08-27] — P5: Romper ciclos de import nombrados (DI + estado central)

Se rompen los ciclos directos que señalaba `mejoras_glm.md` usando inyección de
dependencias y estado central, sin refactor masivo:

- **`gizmo ↔ selection`** roto: `selection.js` ya no importa `gizmo.js`. El
  gizmo se auto-posiciona registrando `onTargetSelected(() =>
  updateGizmoPosition())` (`js/gizmo.js`); se quita el import y las 2 llamadas
  directas en `selection.js`. Como `render.js` ya re-posiciona el gizmo cada
  frame, el comportamiento no cambia.
- **`ui ↔ gizmo`** roto: `ui.js` ya no importa `gizmo.js`. Se quita la llamada
  redundante a `updateGizmoPosition()` en `applySlidersToTarget()` (el gizmo se
  auto-sincroniza cada frame y con `onTargetSelected`).
- **`timeline ↔ projectFiles`** roto: el nombre del proyecto vive ahora en
  `store.projectName` (`js/state.js`). `projectFiles.js` lo mantiene y
  `timeline.js` lo lee desde el estado, sin importar `projectFiles.js`.
- Se elimina la variable interna `currentFileName` de `projectFiles.js` (todo
  pasa a `store.projectName`).
- **`selection ↔ ui`** roto (cierre de P5): `selection.js` ya no importa `ui.js`.
  Los paneles de animación/mood/sliders/muro se refrescan vía
  `onTargetSelected(refreshTargetPanels)` suscrito en `js/ui.js`, que replica la
  lógica que antes estaba inline en `setActiveTarget`/`clearActiveTarget`.
- **Fix TDZ**: el registro `onTargetSelected(() => updateGizmoPosition())` en
  `gizmo.js` se difirió con `queueMicrotask`, porque al evaluarse ese módulo dentro
  del ciclo `selection→cinematics→gizmo→selection` la llamada top-level disparaba
  "Cannot access 'targetListeners' before initialization". Tras el diferido, el
  grafo de módulos ya está inicializado.

**Nota**: el grafo de imports completo sigue teniendo un SCC más amplio
(catalog/cinematics/gizmo/multiselect/projectFiles/selection/timeline/ui/undo),
conectado por otras aristas. Es **benigno hoy** (todas las llamadas cruzadas son
diferidas, ninguna evalúa `const x = f()` de otro módulo en init). Disolverlo del
todo requiere el patrón `init()` explícito que sugiere el propio doc; queda como
trabajo futuro.

## [2026-08-27] — P4: Anclas de personajes + límites de navegación (A*) del ambiente

- **Nuevo `js/anchors.js`**: registro de anclas nombradas de mobiliario
  (`registerAnchor`, `getAnchor`, `anchorPose`). Cada silla registra su ancla
  `seat_<id>` con su posición+rotación.
- **`js/office/furniture.js`**: `createChair()` ahora registra `seat_<id>` como
  ancla del asiento.
- **`js/characters.js`**: los personajes sentados (Sofi→chair1, Nico→chair4,
  Marta→chairE3, Leo→chairN2, Valen→chair6) se colocan desde su ancla
  (`anchorPose('seat_chairX')`) en vez de coordenadas hardcodeadas, con
  fallback a los valores previos. Si se mueve una silla en el código, el
  personaje la sigue sin tocar sus coordenadas (previene el "bug de sillas").
- **`js/navigation.js`** (A*): los límites de la grilla de navegación ahora se
  derivan del Box3 del ambiente activo (oficina/parque/estudio) + margen, con
  caché por visibilidad. Antes eran fijos `-14.5..14.5 / -10.5..10.5`, que
  rompían la navegación en el parque/casa del hacker (z≈-27).

## [2026-08-27] — P3: Presets data-driven en environment.js

- **`js/environment.js`**: se reemplaza la cadena if/else de 5 ambientes por un
  objeto `ENV_PRESETS` data-driven. Cada preset define: grupos visibles
  (office/park/studio), color de fondo, niebla, luces (hemisférica,
  direccional + posición, relleno) y estado de los faroles del parque.
- `setEnvironment()` ahora solo busca el preset y lo aplica en ~30 líneas. Se
  eliminan ~120 líneas de valores mágicos repetidos.
- Se conserva el comportamiento exacto (el preset `office` no toca el emisivo
  de los faroles; el resto sí, como antes). Exporta `environmentNames`.

## [2026-08-27] — P2: Registro de "tickers" por-frame (render.js desacoplado)

- **Nuevo `js/tickers.js`**: sistema de registro de funciones por-frame
  `registerTicker(fn)` con la firma `fn(simDt, globalTime, dt)`.
- **`js/render.js`**: el loop ahora solo hace `tickers.forEach(t => t(simDt,
  globalTime, dt))`. Deja de importar 13 módulos y de listar los rigs uno por
  uno. Se eliminan las 11 filas `humanXRig.run(globalTime + offset)` y las
  llamadas a `updateMiniRackDoor`, `updateAlarm`, `updateHackerHouse` y al
  parpadeo de LEDs (que pasan a tickers propios).
- **Módulos que se auto-registran**:
  - `js/characters.js`: los 11 rigs con sus offsets (en `RIG_OFFSETS`).
  - `js/office/group.js`: `updateMiniRackDoor(dt)` + parpadeo de LEDs.
  - `js/office/alarm.js`: `updateAlarm(dt)`.
  - `js/office/hackerHouse.js`: `updateHackerHouse(camera.position)`.
- Resultado: agregar un personaje/prop animable nuevo ya no requiere tocar el
  loop de render; se registra un ticker en su propio módulo.

## [2026-08-27] — P8: Editor de edificio avanzado (vista solo edificio, ventanas, puertas, pisos)

- **Fix crash** (`js/gizmo.js`): faltaba `multiCount` en el import desde
  `./multiselect.js`. Al seleccionar escritorios (Ctrl+clic o marquesina) y
  arrastrar el bloque, `multiCount()` no estaba definido. Se agrega al import.
- **Nuevo `js/office/floor.js`** (P8) — pisos editables:
  - Presets procedurales de material de piso (mismo sistema `texCanvas` que
    las paredes): *Piso de oficina*, *Losa de cemento*, *Madera clara* y
    *Piso técnico (gris)*.
  - `setFloorMesh()`/`applyFloorTexture()`/`getFloorTexture()` y
    `buildDefaultFloor()` (el piso del entorno ahora lo arma este módulo).
- **Ventanas** (`js/office/walls.js`, P8):
  - Se extrae la fábrica `createWindow` (antes interna de `lounge.js`) a
    `walls.js` como **fábrica paramétrica** (id, nombre, x, y, z, rotY, w, h,
    parent). Se registra seleccionable (tipo `window`) y viaja en `windowGroups`.
  - `lounge.js` ahora la importa (la ventana de gerencia usa `bossGroup`).
  - `addWindow()` spawnea ventanas nuevas frente a la vista; `syncWindows()`
    las recrea/oculta al cargar un proyecto.
- **Puertas spawneables** (`js/office/walls.js`, P8): `addDoor()` equivale a la
  `createDoor` interna de `buildWalls`, exportada para poder agregar puertas
  nuevas. Nacen cerradas.
- **UI** (`index.html`, `js/ui.js`, P8):
  - Panel "🏢 Editar Edificio" ampliado: botón **👁️ Solo edificio** (oculta
    mobiliario/equipos para editar paredes), selector de **Piso** y botones
    **🪟 Añadir ventana** / **🚪 Añadir puerta** (spawnan frente a la vista,
    seleccionadas con el gizmo).
  - `state.store.buildingOnly` para la vista "solo edificio".
  - Ventanas (tipo `window`) se incluyen en la categoría EDIFICIO del outliner
    y respetan el modo "Editar Edificio" (selection.js y gizmo.js).
- **Persistencia** (`js/projectFiles.js`, P8): el JSON de proyecto ahora
  guarda `floorTex` y `windows[]`; se restauran en `applyProject`.

## [2026-08-27] — Fix crash "multi is not defined" al cargar oficina vacía + sombra

- **Fix crash** (`js/gizmo.js`): faltaba `multi` en el import desde
  `./multiselect.js`. Los listeners de `pointermove` y `pointerup` usaban
  `multi.dragging` y `multi.marqueeActive` pero la importación solo traía las
  funciones. Se agrega `multi` al import existente; ahora la marquesina y
  el arrastre de bloque funcionan.
- **Fix deprecation** (`js/core.js`): `PCFSoftShadowMap` quedó deprecado en
  Three.js r0.185 (cae a `PCFShadowMap` con un warning). Se usa
  `PCFShadowMap` directamente. La advertencia de `THREE.Clock` queda solo
  como warning (no rompe nada).

## [2026-08-27] — Fix bug laptop + selección múltiple, mover bloque y borrar con tecla

- **Fix bug "se rompe al elegir laptop"** (`js/office/furniture.js`): `createPCTower`
  y `createLaptop` ahora son **fábricas paramétricas** `(id, nombre, x, y, z,
  rotY)`. Antes registraban IDs fijos `it_pc`/`it_laptop`, así que al
  instanciar una desde el catálogo **sobrescribían el registro del objeto
  original** del escritorio y rompían la escena. Ahora cada instancia (la
  original y las del catálogo) usa su propio id. Test: `spawn de laptop no
  toca it_laptop original`.
- **Nuevo `js/multiselect.js`** — selección múltiple y mover en bloque:
  - **Ctrl+clic**: suma/quita objetos de la selección (mantiene la previa).
  - **Marquesina**: with `Ctrl` + arrastrar en el vacío se dibuja un
    rectángulo y se capturan todos los objetos que quedan dentro.
  - **Mover el bloque**: con 2+ seleccionados (caja azul), arrastrar sobre
    uno de ellos mueve todo el grupo juntos (mismo delta XZ; undo en un paso).
  - Caja visual alrededor de la selección (LineSegments azul).
  - **`deleteMultiSelection()`** borra todo el grupo (borrado suave + undo).
- **Borrar con teclado**: `Supr` o `Backspace` borran el objeto activo o toda
  la selección múltiple (se ignora si el foco está en un input de texto).
  (`js/ui.js`)
- **Botón** "🗑️ Borrar selección múltiple" en el panel de transformación
  (`index.html`).
- Integración en `js/gizmo.js` (pointerdown/move/up) y `js/main.js` (import).
  La marquesina se dispara con Ctrl para no chocar con la órbita de la cámara.
- Validado en Node (`tools/p7-test.mjs`): bug laptop + toggle + mover bloque +
  borrar grupo — todo pasa.

## [2026-08-27] — P7: catálogo de objetos ("➕ Agregar", duplicar, borrar) + persistencia

**Nuevo `js/catalog.js`** (catálogo + spawn + borrado/duplicado):
- **Panel "➕ Agregar Objeto"** en `index.html`, visible al activar "✏️ Editar
  Objetos" (JS en `ui.js`), con categorías **🪑 Mobiliario** y **💻
  Equipamiento IT**.
- **Catálogo de 14 piezas**: escritorio, silla, sillón, planta, archivero,
  fotocopiadora, mesa multiuso, torre PC, laptop (de `furniture.js`) + rack
  19", firewall, carro KVM, estante de repuestos y banco de trabajo (de
  `serverRoom.js`, registradas desde `buildServerRoom()`).
- **`spawnCatalogItem(catId, opts)`**: instancia la pieza con ID único
  (`desk_spawn1`, …), en un punto libre cerca de la vista (grilla 0.5m), la
  selecciona con el gizmo y confirma en el historial (undo). Respalda rotación
  y escala del spawn (las fábricas de `serverRoom.js` no reciben `rotY`).
- **`deleteActiveObject()`**: borrado suave (oculta + flag `deleted`), deshace
  con `Ctrl+Z`; **`duplicateActiveObject()`**: copia con offset. Botones
  `⧉ Duplicar` / `🗑️ Borrar` en la sección de transformación del panel.
- **Outliner**: los objetos borrados se ocultan de la lista.
- **Persistencia** (`projectFiles.js`): los spawneados se serializan en
  `spawned[]` (`catalog`, id, nombre, transformación) y el flag `deleted` por
  objeto; `syncSpawned()` los recrea/oculta al cargar un proyecto o al
  deshacer/rehacer (undo por snapshots JSON). Esto hace que el catálogo sea
  100% compatible con guardar/abrir/undo.
- **validación en Node** (`tools/p7-test.mjs` + `tools/p7-loader.mjs`, stubs de
  WebGL/DOM): evalúa el grafo completo (incluido `main.js` y `office/index.js`)
  y prueba spawn → duplicar → borrar → serializar → restaurar → persistencia de
  escala/rotación. Todo pasa.
- `SKILL.md` (estructura), `GLM.md` y `mejoras_glm.md` (P7 marcado ✅)
  actualizadas.

## [2026-08-27] — Plan P7/P8: catálogo de objetos y editor de edificio avanzado

- `mejoras_glm.md`: nuevos ítems **P7** (panel "➕ Agregar" con catálogo de
  piezas reutilizando las fábricas de `js/office/`, spawn genérico con ID
  único + undo, gizmo de rotación, slider de escala, borrar/duplicar en el
  outliner, persistencia) y **P8** (vista "solo edificio", ventanas
  paramétricas sobre paredes, pisos editables, puertas spawneables). Orden de
  ejecución actualizado: P7 → P8 → P2 → P3 → P4 → P5 → P6.
- Diagnóstico: mover/escalar ya existen (gizmo con banda de escala, sliders
  XYZ + RotY); el editor de edificio ya tiene agregar pared, texturas,
  vidrio↔sólido y puertas. Lo faltante es el catálogo de agregación y las
  transformaciones de rotación/gizmo.


## [2026-08-27] — P1: dividido el monolito `js/office.js` (2.838 líneas) en `js/office/`

- **Split sin cambios de comportamiento** (`mejoras_glm.md` P1): el monolito
  `office.js` (138 KB, `buildOfficeEnvironment()` con ~2.400 líneas y ~205
  bloques internos) se dividió en 11 módulos por subsistema, extrayendo los
  rangos de líneas exactos con un script (sin reescribir código):
  - `js/office/group.js` — `officeGroup`, `serverLedMaterials`, escalera de
    apoyo (`stepLadder`, `STEP_LADDER_ORIGIN`), `miniRack`,
    `updateMiniRackDoor`.
  - `js/office/alarm.js` — balizas de emergencia (`setAlarm`, `updateAlarm`,
    `createAlarmBeacon`).
  - `js/office/walls.js` — tabiques y puertas (colliders, `setWallKind`,
    `addWall`, `setDoorState`), texturas procedurales de pared y el bloque de
    construcción de paredes/puertas como `buildWalls()`.
  - `js/office/materials.js` — materiales compartidos (piso, mobiliario,
    `rackMat`, `goldMat`, `steelMat`, `glassMat`).
  - `js/office/furniture.js` — fábricas reutilizables: `createDesk`,
    `createChair`, `createSofa`, `createPlant`, `createFileCabinet`,
    `createCopier`, `createEmptyTable`, `createPCTower`, `createLaptop`.
  - `js/office/serverRoom.js` — sala de servidores completa (`buildServerRoom`):
    racks, firewall, carro KVM, bancos, estantes, rincón de recambio y
    construcción de la escalera.
  - `js/office/lounge.js` — sala de juntas, oficina del jefe, bar, vending y
    cocina (`buildLounge`).
  - `js/office/network.js` — cableado estructurado, canales de piso, mini rack
    de la sala de juntas y APs WiFi (`buildNetwork`, `createWallAP`).
  - `js/office/city.js` — calle/vereda exterior: árboles, arbustos, cruces,
    semáforos, faroles (`buildCity`).
  - `js/office/hackerHouse.js` — estado y helpers de la casa del hacker +
    interior (`buildHackerHouseInterior`).
  - `js/office/index.js` — orquestador (171 líneas): piso, tabiques, espacio
    central, recepción y los llamados `buildWalls/buildServerRoom/buildLounge/
    buildNetwork/buildCity/buildHackerHouseInterior` en el orden original.
- **Consumidores actualizados**: `characters.js`, `cinematics.js`,
  `collision.js`, `environment.js`, `gizmo.js`, `navigation.js`,
  `projectFiles.js`, `render.js`, `timeline.js`, `ui.js` y `main.js` ahora
  importan de los módulos específicos (`./office/group.js`, `./office/walls.js`,
  etc.). `js/office.js` eliminado.
- **Validación**: sintaxis ESM OK en los 11 módulos (`node --check`), validación
  cruzada de imports/exports sin errores (`tools/validate-office.js`) y todas
  las rutas de import del proyecto resuelven (`tools/check-imports.js`).
  Guardado/carga de proyectos (JSON) no cambia: los IDs de objetos son los
  mismos. Pendiente: confirmación visual en el navegador.
- Documentación actualizada: `SKILL.md` (estructura), `GLM.md` (tabla de
  módulos), `mejoras_glm.md` (P1 marcado como hecho).

## [2026-08-27] — Informe de arquitectura `mejoras_glm.md`

- **Nueva documentación** (`mejoras_glm.md`): revisión general de arquitectura
  con diagnóstico y plan priorizado. Hallazgos principales: `office.js` volvió
  a ser un monolito (2.838 líneas, `buildOfficeEnvironment()` con ~205 bloques
  internos → dividir en `js/office/`); ciclos de dependencia `ui ↔ gizmo`,
  `gizmo ↔ selection`, `timeline ↔ projectFiles`; `render.js` acoplado a los
  11 rigs a mano (→ registro de tickers); hardcodeo de posiciones de
  personajes acopladas al layout de la oficina (→ anclas nombradas); cadena
  if/else de ambientes (→ presets data-driven); limpieza menor (duplicado
  `scenes/alarma_en_la_red (1).json`, `studio.html`).
- Sin cambios de código: solo documentación. El plan de corrección se ejecuta
  por partes (ver orden recomendado en el propio informe).

## [2026-08-27] — 5 empleados nuevos, cocina mudada a la oficina este y recepción para clientes

- **5 personajes nuevos** (`js/characters.js`, `js/render.js`, `js/ui.js`,
  `index.html`, `js/wizard.js`): más gente trabajando en la oficina, cada uno
  **sentado tipeando en su PC** con cargos y personalidades distintas:
  Sofi (Diseñadora, feliz), Nico (Soporte IT, con gorra), Marta (Contabilidad,
  preocupada), Leo (Ventas, con corbata) y Valen (RR.HH.). Se sientan en sillas
  de escritorios libres (central, este, norte y oeste). Aparecen como objetivos,
  en el asistente de diálogos y en la lista de recorridos.
- **Personajes sentados bien apoyados**: para que el sentado quede en la silla
  (asiento a y≈0.48) y no flote, los personajes sentados/acostados pueden bajar
  su origen a y=0 (`js/collision.js`, `js/gizmo.js`, `js/ui.js`).
- **Cocina mudada a la oficina privada este** (`js/office.js`): se quitó el
  escritorio privado (privateDesk) y ahí se armó la cocina/comedor de empleados:
  mesada con alacena, heladera, dispenser de agua, máquina de golosinas y mesa
  de comedor con 6 sillas. Todo el conjunto queda **suelto en la sala**, sin
  apoyarlo contra la pared de vidrio (tabique) que mira al espacio central.
- **Recepción / sala de espera** (`js/office.js`): donde estaba la cocina
  (corredor oeste, junto a la oficina del jefe) ahora hay una sala de espera
  para recibir clientes y socios: alfombra, dos sillones enfrentados, mesa
  ratona + mesitas redondas y plantas en las esquinas.
- **Casa del hacker sin techo**: se eliminó el techo (quedó a cielo abierto,
  siempre se ve el interior) y su lógica de ocultado.

## [2026-08-26] — Casa del hacker (2 ambientes, interior visible) + nuevo personaje Mike

- **Casa del hacker** (`js/office.js`, `js/render.js`, `js/collision.js`): nueva
  casa afuera de la oficina (al norte, cruzando la calle), estilo "casa de
  muñecas" para que siempre se vea el interior: la pared que queda entre la
  cámara y la casa se oculta, y el techo se oculta al mirar desde arriba. Tiene
  **dos ambientes**: la "guarida hacker" (escritorio con 3 monitores de código,
  silla, torre/servidor con LED, caja de pizza) y un estar/dormitorio (sofá,
  mesita, alfombra). Incluye puerta de entrada, ventanas, tabique interior con
  abertura y una luz cálida por ambiente. Las paredes bloquean a los personajes
  (colisión), con paso libre por la puerta y la abertura del tabique.
- **Nuevo personaje: Mike (Hacker)** (`js/characters.js`, `js/render.js`,
  `js/ui.js`, `index.html`, `js/wizard.js`): cuarto humano, el ciberdelincuente
  que intentará atacar la empresa. Viste la típica **sudadera negra con capucha**
  (capucha sobre la cabeza, bolsillo canguro, cordones, mangas largas). Aparece
  como objetivo seleccionable, en el asistente de diálogos y en la lista de
  recorridos; arranca dentro de la guarida de la casa del hacker.

## [2026-08-26] — Apertura de "Alarma en la red" sin corrida inicial + balizas de alarma rojas

- **Apertura corregida** (`js/cinematics.js`, `scenes/alarma_en_la_red.json`):
  Alex y Elena ahora aparecen **hablando quietos desde el comienzo** en la sala
  de sistemas. El evento de "hablar" se ancló en el primer punto del recorrido
  (índice 0) y se permitió que los eventos en u=0 se disparen en el primer
  frame (antes arrancaban corriendo ~1s por un desfase de parametrización de la
  curva).
- **Alarma de emergencia** (`js/office.js`, `js/render.js`, `js/timeline.js`,
  `js/projectFiles.js`): nuevas balizas rojas de pared (5, repartidas por la
  oficina) que parpadean con luz roja cuando la escena lo indica. Las tomas de
  la línea de tiempo aceptan el flag `alarm: true/false` para encenderla o
  apagarla; el estado sigue a la cabeza de reproducción al reproducir y al
  hacer scrub, y se apaga al detener o al cargar un proyecto.
- **Escena "Alarma en la red"** (`scenes/alarma_en_la_red.json`): la alarma se
  enciende en la toma del aviso (3.2s) y se apaga cuando se restaura el enlace
  (29.2s), mientras van a ver al jefe a la sala del mini rack.

## [2026-08-26] — Cámara libre siempre movable, recuerdo de encuadre por toma y arreglo de escenas

- **Cámara libre movable al cargar** (`js/projectFiles.js`): al abrir un
  proyecto la cámara queda en el encuadre de la primera toma pero en Vista
  Libre, así se puede mover de inmediato (antes, si la primera toma era de
  seguimiento —ej. Cine 2 en la cinemática del ransomware— la cámara quedaba
  trabada siguiendo al personaje).
- **Regla de cámara**: la cámara libre se mueve cuando quieras; al reproducir
  o mover la barra roja vuelve al encuadre configurado de cada toma. Solo si
  hay un bloque de cinemática seleccionado y movés la cámara, ese encuadre
  pasa a ser el de la toma (`js/timeline.js`, listener `end` de OrbitControls):
  queda configurado temporalmente y se conserva al Guardar; si no guardás, al
  recargar el JSON vuelve el encuadre original.
- **Escena "Alarma en la red"** (`scenes/alarma_en_la_red.json`): Alex y Elena
  ahora arrancan dentro de la sala de sistemas (coincide con el inicio de su
  recorrido). Se elimina el hueco inicial donde no se veía a nadie y el salto
  brusco con el que aparecían.
- **Nombre del proyecto en la barra superior** (`index.html`, `style.css`,
  `js/projectFiles.js`): junto a los botones de vista se muestra el archivo
  abierto (📄 nombre), para saber en qué proyecto se está trabajando.

## [2026-08-26] — Guardar silencioso, limpieza de botones y Exportar 1080p 60 fps

- **Guardar ya no pide ubicación** (`js/projectFiles.js`, `js/startup.js`):
  con la File System Access API el archivo queda definido al ABRIR un proyecto
  o al GUARDAR por primera vez; desde ahí "Guardar" (menú, 💾 o Ctrl+S)
  reescribe el archivo en silencio. "Guardar como…" sigue permitiendo elegir
  otra ruta. Los navegadores sin la API mantienen la descarga clásica.
- **Botones quitados de la barra de la línea de tiempo** (`index.html`,
  `js/timeline.js`, `js/main.js`): se eliminaron ⏺ grabar escena, ＋ agregar
  toma de 3s, 🎬 escena demo y 🦠 cinemática ransomware (junto con el módulo
  `js/demoScene.js`, ya sin uso). Queda solo el asistente 🪄.
- **⬇ Exportar** (`index.html`, `js/recorder.js`, `js/timeline.js`,
  `js/render.js`, `js/viewport.js`): el botón del pie ahora dice solo
  "Exportar" y genera el video de la película completa (reproduce la escena
  desde el inicio y la graba) en formato único 1080p (1920×1080) a 60 fps,
  con el nombre del proyecto. Durante la exportación el canvas se fuerza a
  1920×1080 y se restaura al terminar; se quitaron los campos de duración y
  FPS del pie (las opciones volverán más adelante).

## [2026-08-26] — Edición de toma: selección fija, cámara libre recordada y estados de personaje

- **Selección de toma "pegajosa"** (`js/ui.js`, `js/timeline.js`): una vez
  elegido un bloque de cinemática, el modo de edición de bloque se mantiene
  pase lo que pase (seleccionar un personaje, hacer scrub, etc.) y solo se sale
  con el botón ✕ del bloque.
- **Cámara de Vista Libre recordada** (`js/timeline.js`, `js/cinematics.js`):
  al salir con ✕ de una toma en Vista Libre se guarda el encuadre actual de la
  cámara en la toma; al volver a ella con la barra roja (scrub) o al
  reproducir, se restaura exactamente ese encuadre en vez de seguir al sujeto.
- **Estados de personaje al editar una toma** (`style.css`): en el modo de
  edición de toma queda operable el panel de Animaciones/Ánimo (con recuadro
  blanco), para elegir cualquier personaje y cambiarle el ánimo o la acción
  (hablar, teclear, etc.).

## [2026-08-26] — Botón ✕ para salir de la edición de toma + monitores y canaleta en sistemas

- **Botón ✕ en el bloque de cinemática** (`js/timeline.js`, `style.css`):
  aparece en la toma seleccionada y al hacer click quita la selección/foco,
  volviendo a la edición normal. Además los clicks en el viewport ya no
  deseleccionan la toma (`js/ui.js`), para poder mover la cámara libre.
- **Monitores de la sala de sistemas** (`js/office.js`): los dos monitores de
  los bancos de trabajo ahora tienen base + cuello y están apoyados sobre la
  mesa (ya no flotaban); la pantalla de la consola KVM junto a la impresora se
  separó del bisel para evitar z-fighting.
- **Canaleta de la fotocopiadora de sistemas**: se agregó una bajada desde la
  canaleta de la pared oeste hasta el tope de la impresora (`cableDrop`).

## [2026-08-26] — Scrub en tiempo real + edición de cinemática desde una toma

- **La aguja roja ahora reconstruye la escena** (`js/timeline.js` +
  `js/cinematics.js`): al arrastrarla/avanzar/retroceder se evalúan los
  recorridos en ese instante (posición, rotación, acción, esperas, delay,
  bucles y estado de la escalera), además de subtítulos, quiz y cámara de la
  toma. Al soltar, la cámara queda en Vista Libre para orbitar desde ahí.
- Al reproducir de nuevo, `playScene()` vuelve a mostrar la escena diseñada
  desde el comienzo; la edición manual no cambia la escena salvo que se
  edite un bloque seleccionado desde el panel.
- **Selección de toma de cinemática** (`style.css`, `js/ui.js`,
  `js/timeline.js`): al seleccionar un bloque de la pista 🎬 se habilitan con
  recuadro blanco la lista de personajes y los controles de recorrido; si la
  toma tiene sujeto, ese personaje queda marcado. Desde ahí se puede activar,
  ver, modificar, agregar puntos o borrar su cinemática.
- `cinemaStorePath()` conserva `speed`/`delay`/`loop` al editar un recorrido,
  y Guardar/Guardar como almacena el recorrido activo antes de serializar
  (`js/projectFiles.js`), por lo que los cambios quedan en el JSON.

## [2026-08-26] — Playhead de timeline más visible y arrastrable

- La línea roja de reproducción ahora vive en `.tl-body` (`index.html`), por lo
  que atraviesa regla, pista de cinemática y pista de subtítulos, y se dibuja
  con `z-index: 50` por encima de bloques y encabezados (`style.css`).
- El cabezal rojo es más grande (27×27 px, borde blanco) y queda por encima de
  los segundos de la regla para poder agarrarlo cómodamente; el arrastre se
  conectó directamente al knob (`js/timeline.js`).

## [2026-08-26] — Fix carga de escenas + mascotas reubicadas en "Alarma en la red"

- **Fix al abrir/cargar un proyecto** (`js/projectFiles.js`): ahora se llama a
  `stopAllPlaybacks()` antes de aplicar el nuevo proyecto, para que recorridos
  activos de otra cinemática no sigan moviendo/posando personajes.
- **Fix de reset de recorrido** (`js/cinematics.js`): `startPlayback()` recoloca
  el personaje usando el primer waypoint resuelto (evita errores de curva al
  reiniciar).
- `js/demoScene.js`: la escena demo también guarda `initialState` de los
  personajes para que Play/Stop/Bucle los devuelva correctamente.
- **`scenes/alarma_en_la_red.json`**: perro y gato reubicados en el sector
  norte del open space, con recorridos propios distintos de la cinemática del
  ransomware. Alex, Elena y el jefe mantienen sus posiciones y recorridos
  originales de "Alarma en la red"; se agregó `speed: 1.0` al jefe.

## [2026-08-26] — Reset de personajes al repetir + perro sin choques + botón de bucle + pistas de timeline

- **Repetición de escena**: `playScene()` y `stopScene()` devuelven a los
  personajes/mascotas a su estado inicial (`js/timeline.js` +
  `js/projectFiles.js` guarda `entry.initialState` al abrir un proyecto).
  Además `startPlayback()` recoloca el objeto en el primer punto del recorrido
  (`js/cinematics.js`), por lo que Alex vuelve a su origen aunque tenga delay.
- **Perro** en `scenes/el_ransomware_del_jefe.json`: ahora camina por el
  corredor sur libre (`x: -3.2..3.2`, `z: 5.4..9.4`), sin mesitas ni sillones;
  su cámara fija se reencuadró para verlo desde el norte.
- **Botón 🔁** junto a Play/Stop (`index.html` + `js/timeline.js`): activa o
  desactiva el bucle de reproducción. Si está activo, la escena vuelve a
  empezar al terminar; se detiene con Stop, Pausa o al desactivar el botón.
- **Timeline**: los encabezados `🎬 CINEMÁTICA` y `💬 SUBTÍTULOS` quedan en un
  margen izquierdo propio y los bloques/recorridos empiezan a la derecha
  (`LANE_LABEL_W = 116` en `js/timeline.js`, ajustes en `style.css`).

## [2026-08-26] — Semáforos alineados + cámaras fijas de mascotas + caminos sin choques

- **Semáforos**: la luz amarilla quedó centrada entre la roja y la verde en
  `js/office.js` (`trafficLight`), pasando el desplazamiento vertical de
  `0.16` a `0.0`.
- **`scenes/el_ransomware_del_jefe.json`**:
  - Las tomas del **perro** y del **gato** ahora usan `camMode: "fixed"` con
    `camPos`/`target` propios, para verlos caminar con cámara fija.
  - **Perro**: recorrido movido a un rectángulo abierto del espacio central
    (`x: -2.25..2.3`, `z: -3.4..2.6`) para no chocar con los sillones del área
    de descanso ni con la mesita de centro.
  - **Gato**: recorrido movido al pasillo oeste de la sala de juntas
    (`x: 7.5..8.3`, `z: -9.5..-5.5`) para no atravesar la mesa de juntas ni
    las sillas.
  - **Alex**: camino corregido para salir por la puerta NO (`x≈-9.25`), bajar
    por el corredor este de la mesa de comedor (`x≈-8.7`) y entrar a la
    oficina del jefe sin chocar con la mesa de comedor ni las sillas.

## [2026-08-25] — Escalera tamaño real al hombro + reset de origen + mascotas en la cinemática

- **La escalera que se lleva ahora es TAMAÑO REAL** (`js/characters.js`,
  `heldLadder`): se reconstruyó con la misma geometría que la del piso
  (`stepLadder`, 1.83 m, patas en "A", 4 peldaños y bisagra superior). Al
  cargarla al hombro el arco superior queda a la altura del hombro y la base
  cuelga cerca del piso → se ve creíble.
- `grab_ladder`/`carry_ladder`/`drop_ladder` quedan como **alias** de
  `shoulder_lift`/`shoulder_carry`/`shoulder_drop` (misma postura), así no hay
  una escalera gigante mal posicionada si se usan esos botones.
- **Al (re)producir una escena, la escalera vuelve a su origen**
  (`js/office.js` exporta `STEP_LADDER_ORIGIN`; `js/timeline.js` → `playScene`
  la reposiciona y la hace visible): cuando alex la deja frente al rack, al
  dar play de nuevo reaparece en la sala de sistemas.
- **Perro y gato participan de la cinemática** (`scenes/alarma_en_la_red.json`):
  recorridos propios para `dog` (camina 6 puntos, se sienta 6 s y se acuesta) y
  `cat` (camina, se sienta y se acuesta), con velocidad lenta (walk) para que
  se muevan por el espacio mientras avanza la historia.

- En `scenes/alarma_en_la_red.json`, cuando Alex va por la escalera la **carga
  al hombro** (waypoint 13 = `shoulder_lift`), **la lleva al hombro mientras
  camina** de regreso y **la deja** en el piso frente al mini rack (waypoint
  19 = `shoulder_drop`, con un waypoint final 20 = idle para terminar de pie).
- En `js/render.js`, el motor de playback cambia la acción de movimiento según
  el evento de escalera: al cruzar `shoulder_lift` pasa a `shoulder_carry`
  (caminar portando la escalera, en vez de run), y al cruzar `shoulder_drop`
  vuelve a `walk` (la escalera real queda en el piso). La distancia/velocidad
  del recorrido no cambia (mantiene `speed: 4.5`), así el ritmo de las tomas
  de la timeline no se desfasa.
- (Soporta tanto `shoulder_*` como `carry_ladder`/`drop_ladder` genéricos.)

- **3 animaciones de HOMBRO nuevas** para los personajes humanos (Alex y
  cualquiera) en `js/characters.js` + botones en `index.html`
  (`#humanActionsGrid`):
  - **🪜 Cargar al hombro** (`shoulder_lift`): agarra la escalera y la levanta
    apoyando el arco superior sobre el hombro derecho; un brazo la sujeta por
    el arco y el otro la equilibra.
  - **🪜 Caminar con escalera** (`shoulder_carry`): misma postura de carga
    pero con el ciclo de piernas del caminar (zancada sincronizada con la
    cadencia del recorrido). Es la que sirve para MOVERLA de un lugar a otro.
  - **🪜 Bajar del hombro** (`shoulder_drop`): desciende y la deja en el piso
    frente al personaje (la escalera real aparece abajo y la mini desaparece).
- **Visibilidad de la escalera generalizada** (`onLadderActionChange`):
  ahora reconoce las 3 acciones de hombro además de grab/carry/drop. En
  `shoulder_drop` (y ya `drop_ladder`) la mini escalera se oculta y la escalera
  real `stepLadder` aparece en el piso frente a Alex; en las de llevar, la
  mini aparece y la real se oculta. Para otros personajes solo alterna la mini.
- Botones nuevos disponibles para **cualquier** humano (la mini escalera ya
  existe en todos los rigs).

## [2026-08-25] — Fix: personajes quedaban en el CENTRO al cargar una escena

- **Causa raíz** (`js/characters.js`): `resetHumanPose()` (corre cada frame)
  hacía `parts.h_root.position.set(0, 0.17, 0)`. Como `h_root` **ES el grupo**
  raíz del personaje (`parts.h_root: g` y `entry.group === g`), cada frame se
  reiniciaba su X/Z a (0,0) — por eso al cargar un JSON los 3 humanos quedaban
  apilados en el CENTRO aunque `applyProject` los hubiera ubicado bien.
  La cinemática "funcionaba" porque su loop fija `obj.position` DESPUÉS de
  `run()`, tapando el reset en cada frame durante el playback.
- **Fix**: `resetHumanPose()` ahora conserva el X/Z actual de `h_root`
  (restaura solo la altura base Y=0.17). La X/Z la determinan la escena
  cargada o el gizmo sin ser pisados. Se mantienen las lecturas de la escalera
  (X/Z) y el ascenso/descenso de la trepada (solo Y).

- **Mini rack: los 2 switches ya no atraviesan la puerta de vidrio**
  (`js/office.js`, `makeMiniSwitch`): estaban montados en z=0.30 y su cuerpo
  llegaba a z≈0.64 con los LEDs en z≈0.645 — cruzaban la puerta de vidrio
  (z≈0.44). Se retrajeron a `sw.position.z=0.06`: el frente del cuerpo queda en
  z≈0.40 y los LEDs en z≈0.405, **detrás** del vidrio, visibles a través de él
  sin atravesarlo.
- **Al cargar una escena, la cámara encuadra la PRIMERA toma**
  (`js/projectFiles.js` → `applyProject`): antes la cámara quedaba en la vista
  por defecto del centro del edificio, por lo que al abrir
  `scenes/alarma_en_la_red.json` no se veían los personajes hablando en la sala
  de sistemas (parecía que estaban "en el centro"). Ahora tras aplicar el JSON
  se salta a la toma inicial (usa `cutCameraToShot`) y se re-habilita la órbita
  para que el usuario pueda moverse con libertad.
## [2026-08-25] — Delay de recorridos + cámaras del ransomware

- **Motor**: los recorridos ahora soportan `"delay"` (segundos que el personaje
  espera antes de arrancar; mientras tanto mantiene su acción actual). Se lee y
  guarda en el JSON (`js/cinematics.js`, `js/projectFiles.js`).
- **Escena del ransomware**: Alex permanece trabajando en sistemas y recién sale
  cuando el jefe lo llama (`delay: 20.5`); su caminata a la oficina se ve con
  cámara desde arriba (`top`). La cámara de Elena ahora la toma desde atrás, un
  poco hacia su derecha.

## [2026-08-25] — Segunda cinemática "El Ransomware del Jefe" (archivo JSON)

- **Cinemática como archivo JSON**: `scenes/el_ransomware_del_jefe.json`, con la
  misma estructura que `scenes/alarma_en_la_red.json` (objects, paths, subtitles,
  timeline.shots con quiz). Se carga con el botón 🦠 (que hace `applyProject` del
  JSON) o con el menú 📂 Abrir proyecto.
- Mismos 5 personajes: perro y gato dan vueltas por el lugar (recorridos con
  `"loop": true`); Alex trabaja en la sala de sistemas; Elena en la máquina de
  golosinas; Carlos (jefe) teclea en su oficina, llama a Alex, Alex va y ve un
  ransomware en el monitor.
- **Cartel de preguntas (quiz)**: al final aparece la placa tipo quiz (igual que
  en la primera cinemática) con la pregunta del ransomware, 3 opciones y el
  reloj de 10s que marca la correcta (aislar la PC) en verde.
- `js/projectFiles.js`: `applyProject` ahora lee `"loop"` de cada recorrido.
- `js/timeline.js`: `playScene` respeta el `loop` de cada recorrido (perro/gato
  dan vueltas sin parar durante la escena).

## [2026-08-25] — Mini rack visible + puerta + animaciones de escalera

- **Mini rack de red**: reconstruido con carcasa abierta por delante (sin cara
  frontal) y **2 switches de red con LEDs** montados en los montantes, así se
  ven los equipos por dentro. La puerta es de **vidrio transparente** y ahora
  tiene **bisagra**: se puede abrir/cerrar con animación suave (botón "🚪
  Abrir/Cerrar puerta" en el panel del objeto al seleccionar el mini rack).
- **Escalera (Alex)**: 4 animaciones nuevas en `humanActionsGrid`:
  `grab_ladder` (agacharse y tomarla), `carry_ladder` (llevarla al pecho),
  `drop_ladder` (dejarla en el piso frente a Alex) y `climb_ladder` (trepar,
  el cuerpo sube y baja mientras las piernas alternan). Mientras Alex la lleva,
  la escalera real se oculta y aparece una mini escalera en sus manos; al
  soltarla vuelve al piso.

## [2026-08-25] — Deselección por click fuera del elemento

- **Deselección por defecto al hacer click fuera del elemento**: al hacer click
  en el viewport (canvas) fuera de cualquier objeto/gizmo/anillo, el personaje,
  objeto o pared seleccionado se deselecciona automáticamente (respeta los modos
  "Editar Objetos" / "Editar Edificio").
- **Bloques de la línea de tiempo**: al hacer click en cualquier lado que no sea
  la edición de la toma o del subtítulo, éstos dejan de estar seleccionados
  (`js/selection.js:clearActiveTarget`, `js/gizmo.js`, `js/timeline.js`,
  `js/ui.js`).

## [2026-08-25] — Escena del patchcord escrita en alarma_en_la_red.json

- **Historia extendida en `scenes/alarma_en_la_red.json`** (15s → 31.2s): tras
  "el cable estaba desconectado", el jefe ordena traer la llave del rack y la
  escalera; Alex vuelve corriendo a sistemas por la escalera (nuevo tramo de
  waypoints con espera para "agarrarla"), regresa a juntas y reconecta el
  patchcord frente al mini rack alto.
- **Recorrido de Alex ampliado**: 20 waypoints (ida por el pasillo norte,
  escalera en (-7.35,-5.05), vuelta y llegada al pie del mini rack en
  (13.7,-9.55)); eventos re-tiempo: espera 6.8s en juntas hasta la orden,
  1.5s agarrando la escalera.
- **Subtítulos nuevos**: la orden del jefe, el viaje por la escalera, abrir la
  puerta de vidrio con la llave, reconectar el patchcord y el cierre
  "✅ Listo, jefe. Enlace restaurado."
- **Tomas nuevas** (8 más, total 17): orden del jefe (cine2), POV corriendo,
  plano fijo de la escalera en sistemas, aérea de regreso, seguimiento de
  Alex, primer plano de la puerta de vidrio del rack y plano final. Los dos
  planos viejos que apuntaban a la posición ANTERIOR del mini rack
  ([14.2,-10.42]) fueron corregidos a su ubicación actual (14.48, -9.45).
- Carga verificada headless: 17 tomas, 31.2s, 14 subtítulos, reproducción sin
  errores.

## [2026-08-25] — Mini rack con puerta de vidrio, montado alto + escalera (escena del patchcord)

- **Mini rack montado BIEN ARRIBA** (y=2.30, tope a 2.8 m): ya no se alcanza
  de un salto — hace falta la escalera, como pide la historia.
- **Puerta de vidrio ahumado con cerradura**: panel translúcido con manija
  metálica y cerradura dorada al costado (se abre con "la llave del rack").
  Los patch panels y sus LEDs quedaron DETRÁS del vidrio, con capas separadas
  (paneles z=0.38 → LEDs 0.41 → marco 0.45 → vidrio 0.475) sin solapes.
- **Cableado ajustado**: la bajada de canaleta ahora termina en el nuevo tope
  del rack (y=2.80).
- **Escalera de apoyo tipo tijera** nueva en la sala de sistemas (tabique sur,
  al este de la puerta): patas en A con bisagra superior, 4 peldaños con
  huella antideslizante y cruceta trasera. Seleccionable como
  "🪜 Escalera de Apoyo".
- Con esto queda armado el set para la escena: Alex dice que es el cable →
  el jefe lo manda por la llave del rack y la escalera → reconecta el
  patchcord del mini rack.

## [2026-08-25] — Recuadro blanco también para la edición de subtítulos

- Al elegir un bloque de subtítulo se activa el mismo tratamiento que con las
  tomas: TODO el menú izquierdo se oscurece a 22% (incluida la Vista de
  Cámara) y el panel "💬 Editar Subtítulo" queda dentro de un RECUADRO blanco
  de 2px con brillo, con sus campos habilitados.
- Selección mutuamente exclusiva: elegir subtítulo libera la toma (y su
  bloqueo de vistas) y viceversa; click en el fondo de la línea de tiempo
  deselecciona y libera todo.

## [2026-08-25] — Máquina de golosinas y bloqueo de menú más claro

- **Máquina de golosinas automática** (`js/office.js`): en la pared oeste,
  justo al lado del dispenser de agua (entre el dispenser y la heladera).
  Cuerpo rojo con zócalo, vitrina con interior iluminado, 3 estantes con
  golosinas de colores detrás de vidrio transparente, panel de teclas con
  monedero, tapa de retiro y franja luminosa superior. Seleccionable como
  "🍫 Máquina de Golosinas".
- **Bloqueo al elegir una toma, más claro**: TODAS las secciones del menú
  izquierdo se oscurecen a 22% (antes 45%) MENOS la Vista de Cámara — dentro
  de Cinemática también se oscurecen el botón de reproducir, la lista de
  recorridos y el submenú de subtítulos (antes el brillo del padre tapaba el
  efecto).
- **Recuadro blanco alrededor de TODAS las opciones de vista**: al editar una
  toma, el bloque "🎥 Vista de Cámara" entero se enmarca con borde blanco de
  2px + brillo, marcando lo único disponible para editar.
- **Vista Libre y Aérea rediseñadas**: fila simétrica de 2 columnas, cada
  botón ocupa la mitad del ancho (antes colgaban de una grilla de 3 y
  quedaban desparejos).

## [2026-08-24] — Timeline: edición en vivo, bloques de subtítulo gemelos y nombres de pista

- **Submenú de subtítulos SIEMPRE visible**: sin botones "Aplicar" ni
  "Cerrar". Sin selección los campos se ven deshabilitados (no ocultos); al
  hacer click en un bloque se habilitan. TODO se guarda solo mientras se
  escribe o ajusta (texto, íconos, fuente, tamaño, color, inicio y fin) —
  sin pasar por ningún botón.
- **La vista de las tomas ya quedaba guardada al instante** (click en una
  opción de "🎥 Vista de Cámara" reconfigura la toma sin botones): se
  mantiene así.
- **Bloques de subtítulo con el MISMO formato que los de cinemática**: mismo
  alto (34px), forma, etiqueta blanca y manijas de arrastre (mover y estirar
  bordes), pero con UN SOLO color fijo dorado (#a8822e) para toda la pista.
  La pista de subtítulos ahora tiene el mismo alto que la de tomas.
- **Nombres de pista adelante de todo**: "🎬 CINEMÁTICA" sobre la pista de
  tomas y "💬 SUBTÍTULOS" sobre la de subtítulos (chips fijos a la izquierda,
  no se borran al redibujar).
- Selección exclusiva: elegir un subtítulo libera la toma seleccionada y
  viceversa; el bloqueo de vistas se libera igual.

## [2026-08-24] — Sala de juntas y oficina del jefe: reubicaciones y ventana nueva

- **Mini rack movido de pared** (`js/office.js`): salió de la pared norte de
  vidrio de la sala de juntas y ahora está montado en la PARED ESTE, justo al
  lado norte de la TV grande, con el frente mirando a la mesa (rotY -90°).
  **Su cableado lo acompañó**: la bajada de canaleta ahora cae por la pared
  este directo sobre el rack (`cableDrop(14.84, -9.45, 2.05)`); el resto del
  recorrido de canaletas sigue igual.
- **Oficina del jefe — ventanas imposibles eliminadas**: las dos ventanas que
  colgaban sobre el vidrio de la pared sur ya no existen (ventana sobre
  ventana no tiene sentido).
- **Reloj reubicado y reorientado**: estaba en la pared sur de vidrio y
  miraba hacia AFUERA (al revés). Ahora cuelga del TABIQUE ESTE de la
  oficina (el liso que estaba vacío), mirando hacia la sala.
- **Cuadro verde movido**: el que estaba junto al AP WiFi (pared oeste) ahora
  comparte el tabique este con el reloj.
- **Ventana restante rediseñada** (pared oeste, junto al AP): marco de
  aluminio oscuro en 4 piezas reales (antes era un cajón macizo), vidrio
  empotrado con tinte oscuro semitransparente y reflejos
  (MeshPhysicalMaterial, envMapIntensity 1.4), travesaño central fino y
  alféizar interior con sombra.

## [2026-08-24] — UI: ánimos en 2 columnas, edición de vistas sin fila extra y submenú de subtítulos

- **Estados de ánimo en grilla de 2 columnas** igual que las animaciones
  (`index.html` sin display:flex inline + `js/selection.js` muestra la grilla
  con `grid` en vez de `flex`).
- **Eliminada la fila extra del editor de tomas** (`#shotEditor`): al
  seleccionar una toma ya no aparece ninguna fila debajo de la línea de
  tiempo. En su lugar, las opciones de "🎥 Vista de Cámara" del menú izquierdo
  se ILUMINAN con borde blanco brillante (`.shot-editing`) para remarcar que
  la vista de esa toma se cambia desde ahí, y el RESTO de la interfaz queda
  bloqueado (opacidad 45% + pointer-events none) hasta deseleccionar haciendo
  click en el fondo de la línea de tiempo. El inicio/duración se sigue
  editando arrastrando los bloques.
- **Submenú "💬 Editar Subtítulo"** debajo de Vista de Cámara: click en un
  bloque de la pista de subtítulos lo abre para editar texto (con íconos
  rápidos que se insertan al cursor), fuente, tamaño, color, inicio y fin;
  botones Aplicar / Borrar / Cerrar y "➕ Nuevo en el cabezal" (crea un cue en
  el instante actual). Los bloques de la pista ahora son clickeables con
  resaltado del seleccionado.
- **Estilos por subtítulo** (`js/subtitles.js`): cada cue acepta `font`,
  `size` y `color` opcionales (por defecto Segoe UI 30px blanco); el overlay
  se redibuja cuando cambia el estilo (`refreshSubtitles()`).

## [2026-08-24] — Rincón de recambio IT en la sala de sistemas

- Nuevo grupo `itJunkCorner` (seleccionable/movible) en la esquina norte de la
  sala de sistemas, entre los racks y los estantes: 3 CPUs apiladas acostadas
  (con frente y rejillas), 2 monitores viejos apilados mirando al techo, un
  monitor parado con base y cuello, cajas de cartón (dos cerradas apiladas con
  cinta + una abierta con bobinas de cable adentro y otra suelta al lado).
  Todo apoyado en el piso, típico desorden de sala de sistemas.

## [2026-08-24] — Eliminados router y switch flotantes en la sala de servidores

- El `it_switch` (-6.2, 0.79, -7.4) y el `it_router` (-5.6, 0.79, -7.0)
  quedaron a ~0,8 m de altura sin ningún mueble debajo (sobrantes de un
  mueble eliminado). Eliminados por pedido del usuario junto con sus
  funciones (`createNetworkSwitch`/`createRouter`); los racks de 19" con su
  switch y patch panel siguen intactos.

## [2026-08-24] — Ajustes de la vía pública (feedback)

- **Semáforos reorientados 45°**: ahora las luces miran EN CONTRA del sentido
  de llegada (de cara al tramo recto que alimenta cada esquina), no hacia
  adentro del terreno. El que maneja hacia la esquina ve las tres luces
  de frente.
- **Cebras giradas 90°**: barras paralelas al eje de la calle (los autos
  pasan por encima de cada barra a lo largo), repetidas a lo ancho de la
  calzada — zebra real, antes eran rieles continuos atravesados.
- **Esquinas del anillo limpias**: las calles norte/sur medían 44 y sobresalían
  0,4 m del borde externo de las este/oeste (pestañas deformes). Ahora miden
  43.2 y los bordes externos de las 4 calles quedan alineados (|x|=21.6,
  |z|=19.1): rectángulo perfecto, sin solapes.
- **Línea de carril recortada**: la amarilla central ahora termina antes de
  las esquinas/intersecciones (tramos rectos: N/S largo 33, E/O largo 28) —
  antes cruzaba las juntas de las esquinas.

## [2026-08-24] — Exterior: calles completas, arbolado en el verde y mobiliario urbano

- **Calle perimetral cerrada** (`js/office.js`): las calles norte/sur ahora
  cruzan de punta a punta (largo 44, incluyen las 4 esquinas) y las este/oeste
  se apoyan justo entre ellas — antes quedaban muescas abiertas en las
  esquinas del anillo. Línea amarilla central N/S alargada a 44.
- **Veredas cierran el anillo peatonal**: 4 cuadrados de hormigón (1.7×1.5)
  completan las esquinas entre veredas N/S y E/O.
- **Árboles fuera de la calzada**: los 4 que estaban DENTRO de las calles
  este/oeste (x=±20/21) se reubicaron al césped exterior (|x|>22, |z|>19.5).
- **Arbustos cuadrados vereda-calle**: setos de cajas (0.95×0.55 + copa
  chiquita) como barrera, SOLO en tramos: norte ×2, sur ×1, oeste ×1, este ×1.
- **Cruces peatonales**: cebras blancas en las 4 calles cerca de las esquinas
  (6 en total).
- **Semáforos**: uno por esquina del anillo (4), con las 3 luces emisivas,
  mirando hacia el cruce.
- **Alumbrado público**: 8 farolas (poste 4.2 m + brazo volando a la calzada)
  en el borde externo de cada tramo; registradas en `lampLights`/`lampMeshes`
  para encenderse con el modo nocturno.
- Fix: el import de `renderer` en `office.js` había quedado sin aplicar
  (ReferenceError al cargar); restituido.

## [2026-08-24] — Fix: estática tipo "TV sin señal" en paredes sólidas

Tres causas encontradas y corregidas (diagnóstico con raycast + capturas
headless):

- **Marco coplanar con el panel** (`js/office.js` `createWall`): en paredes
  orientadas sobre Z (tabiques y paredes este/oeste) los rieles y montantes
  del marco terminaban EXACTAMENTE en las caras del panel (misma profundidad)
  → z-fighting a pantalla completa = ruido tipo estática que además se notaba
  más al pasar la pared a sólida. Ahora el marco sobresale de las caras del
  panel en los 3 ejes (px 2 cm, py 1 cm, profundidad +14 cm), los rieles van
  ENTRE los montantes y sus caras internas quedan enterradas en el panel.
  Verificado por raycast: ya no hay dos superficies a la misma distancia.
- **Bajada de canaleta duplicada** (`cableDrop(0, -10.78)` estaba llamada dos
  veces): dos ductos idénticos superpuestos en el centro de la pared norte →
  z-fighting en la franja vertical blanca/azul/naranja/roja. Se eliminó el
  duplicado (queda una sola bajada, que es decoración intencional).
- **Texturas de pared mal filtradas** (`texCanvas`): sin `colorSpace` sRGB
  (colores lavados — el ladrillo se veía blanco) y con `anisotropy=1`
  (las motas de `noise()` y las juntas parpadean tipo estática en GPU real al
  mirar la pared en ángulo rasante). Ahora `colorSpace = SRGBColorSpace` y
  `anisotropy = getMaxAnisotropy()`.

## [2026-08-24] — Fix: árbol apilado en el centro de la oficina

- **Los árboles del exterior nacían todos en (0,0)** (`js/office.js`):
  `parkTree(x, z, s)` recibía las coordenadas pero jamás las asignaba — solo
  hacía `position.y`, así que los 10 árboles del perímetro quedaban apilados en
  el origen, dentro de la oficina (visible al cargar cualquier proyecto con
  ambiente Oficina, p. ej. `alarma_en_la_red.json`). Ahora tronco y copa usan
  `position.set(x, ..., z)` y se reparten por el césped como corresponde.
- Verificado con captura headless (vista aérea) antes y después del fix.

## [2026-08-24] — Fix definitivo del glitch de vidrio + puertas de vidrio

- **Vidrio sin parpadeo al mover la cámara** (`js/office.js`): los materiales
  translúcidos (`glassWallMat`, `doorGlassMat`) pasan a `side: FrontSide` +
  `depthWrite: false`. Antes el panel renderizaba su cara cercana Y lejana
  (DoubleSide) y el orden de las transparencias cambiaba con la cámara →
  parpadeo. Ahora cada panel se dibuja una sola vez y se mezcla estable.
- **Puertas convertidas en puertas de vidrio**: se eliminó el panel opaco que
  iba DETRÁS del vidrio de la hoja (sobresalía 2,5 mm → caras casi coplanares
  con z-fighting fuerte). La hoja ahora ES el panel de vidrio, con su manija.
- **Exterior sin solapes**: las calles este/oeste ya no se superponen con la
  norte/sur en las esquinas (misma altura = z-fighting); veredas ajustadas.
- Árboles, casa y comercio apoyados sobre el césped (antes flotaban 6 cm).

## [2026-08-24] — Puertas abiertas por defecto, fix de glitch y escenario exterior

- **Puertas nacen ABIERTAS** (`js/office.js`): `createDoor` ahora arranca en
  estado `abierto` (hoja rotada), para el tránsito habitual. Se sigue pudiendo
  cambiar a cerrado/entreabierto con el modo edificio.
- **Eliminadas las 2 puertas del centro** (`door_e`/`door_o`) que quedaban
  junto al pasillo/alfombra gris central: no van en ese lugar. Quedan solo las
  4 del exterior (NO/NE/SO/SE). Sin referencias residuales.
- **Fix del parpadeo (glitch) en las paredes de vidrio** al mover la cámara:
  - Se quitó el travesaño central del marco (era la cara larga coplanar con
    el vidrio que provocaba z-fighting).
  - Los marcos ahora sobresalen un poco más que el vidrio (sus caras dejan de
    ser coplanares con la hoja translúcida).
- **Escenario exterior alrededor del edificio** (oficina), estático:
  - Césped que rodea el predio + **veredas/acera** de hormigón en los 4 lados.
  - **Calle perimetral** de asfalto con línea discontinua amarilla central.
  - **Árboles de parque** (tronco + copa) en el césped.
  - **Construcciones a lo lejos**: una casa (techo a dos aguas, puerta y
    ventanas) y un pequeño **comercio con toldo y vidriera** al otro lado de
    la calle.

## [2026-08-24] — Oficina con paneles de vidrio, puertas con estados y modo "Editar Edificio"

- **Paredes de la oficina ahora son PANELES DE VIDRIO** (`js/office.js`): todas
  las paredes de este modelo pasan a material translúcido (blue/gris) con marcos
  de aluminio delgado (travesaños, montantes y cruz central). Sigue siendo
  posible elegir textura según queda detallado abajo.
- **Tipo de panel configurable por pared**: panel 🧱 Pared ahora tiene un selector
  **Tipo de panel (🪟 Vidrio / 🧱 Sólido-con-textura)**. En "Sólido" se usa la
  textura elegida de siempre; en "Vidrio" el panel translúcido.
- **Construir paredes nuevas**: botón **➕ Añadir pared** agrega un panel de
  vidrio nuevo, enfocado listo para mover con el gizmo (colisionable).
- **Puertas con estados**: se agregaron **6 puertas** (accesos NO/NE/SO/SE y 2
  interiores) con hoja que rota sobre una bisagra. Cada puerta tiene estado
  `cerrado` / `entreabierto` / `abierto`, editable desde el panel 🚪.
- **Modo "🏢 Editar Edificio"** (nuevo botón, independiente de "✏️ Editar
  Objetos"): **solo con este modo activado** se pueden seleccionar/mover
  paredes y puertas, cambiar el tipo de panel y el estado de las puertas. Sin
  él, paredes y puertas quedan inertes (solo visibles).
- **Selección/UI** (`js/gizmo.js`, `js/selection.js`, `js/ui.js`):
  - `getIntersectedObjectId` permite clickear paredes/puertas solo si
    `store.editBuilding` está ON.
  - `setActiveTarget` bloquea la selección de paredes/puertas fuera del modo.
  - Outliner nueva categoría **🏢 EDIFICIO (PAREDES Y PUERTAS)** con iconos.
  - Panel de pared ampliado (tipo, añadir pared) + selector de estado de
    puerta; todo verificado contra `store.editBuilding`.
- **Colisiones** (`js/collision.js`): las puertas cerradas y entreabiertas
  bloquear el paso (AABB propia según estado); las abiertas dejan pasar.
  Paredes y puertas se excluyen de la colisión "círculo" (se resuelven por AABB).
- `js/state.js`: nuevo flag `store.editBuilding`.
## [2026-08-24] — Personajes más expresivos: nuevas animaciones y estados de ánimo

- **Más detalle facial estilo game** (`js/characters.js`): los humanos ahora
  tienen **cejas articulables** y una **boca delgada** en la cara, que se
  mueven por separado (base para la expresión y mejor acabado visual).
- **Nuevas animaciones de acción** para humanos, disponibles en botones y en
  los eventos de waypoint:
  - `wave` 👋 Saludar (brazo derecho en alto, mecerse).
  - `clap` 👏 Aplaudir (manos al frente, chocando con ritmo).
  - `point` 👉 Señalar (brazo derecho extendido, cuerpo girado).
  - `hold` 📦 Llevar/agarrar objeto (aparece una caja en las manos y los
    brazos se curvan alrededor para portarla).
- **Estados de ánimo (expresión)** de humanos: `neutral`, `happy` (contento),
  `angry` (enojado), `sad` (triste) y `worried` (preocupado). Se aplican sobre
  cejas y boca cada frame, encima de la acción actual, vía `rig.mood` /
  `rig.setMood(m)`.
- **UI** (`index.html`): 4 botones de acción nuevos + una grilla de estado de
  ánimo para humanos. Se marca activo el del ánimo actual y se oculta en
  personajes no-humano/mobiliario.
- **Interacción** (`js/ui.js`, `js/selection.js`): clic de ánimo persiste con
  undo (`pushHistory`), refresco del botón activo y visibilidad por tipo.
- **Timeline** (`js/timeline.js` / `index.html`): las nuevas acciones
  aparecen como opciones en el panel de evento de waypoint.
- Sin cambios en la altura de la estructura del cuerpo: los pies siguen
  apoyando en el piso y las sillas/escritorios existentes no se desplazan.
## [2026-08-23] — Tomas 2 y 4 de "¡Alarma en la red!" reencuadradas

- La toma 2 (plano de Alex hablando) era **Cine 1**, cuya cámara cae del
  otro lado del tabique sur de la sala → se veía la pared. Reemplazada por
  una **fija** con plano medio de Alex (y a Elena entrando en cuadro).
- La toma 4 (alarma) acercada: ahora es un plano medio a 1.5 m de ambos,
  bien legible, en vez de un general lejano desde el rincón.
- Mismo fix en la toma inicial de `incidente_servidor.json` (mismo problema).

## [2026-08-23] — Cámaras de las escenas de ejemplo: fuera de paredes

- **Fix en `alarma_en_la_red.json` e `incidente_servidor.json`**: la toma
  fija de la alarma y la toma final quedaban con la cámara del otro lado de
  un tabique (se veía la pared en vez de la escena). Reubicadas en puntos
  interiores con línea de vista despejada:
  - plano de la alarma: esquina NO de la sala de sistemas mirando a los
    personajes;
  - toma final: rincón oeste de la sala de juntas mirando a la mesa.

## [2026-08-23] — Cambio de cámara en vivo sin cortar la cinemática

- **Fix importante**: cambiar la cámara de una toma mientras la escena está
  reproduciéndose estaba bloqueado, y al detener/reiniciar los personajes
  perdían lo que estaban haciendo. Ahora el cambio de cámara es **en vivo**:
  - click en un bloque durante la reproducción = corte manual a esa cámara
  - cambiar cámara/sujeto desde el editor o el menú también funciona en
    caliente
  - los recorridos, esperas y animaciones de los personajes NO se
    interrumpen ni se reinician: siguen haciendo exactamente lo que hacían.

## [2026-08-23] — Selección de tomas arreglada + vista configurable por toma

- **Fix**: los bloques de la línea de tiempo a veces no se seleccionaban con
  click — el arrastre marcaba "arrastrado" con cualquier micro-movimiento del
  mouse (1px) y anulaba el click. Ahora solo cuenta como arrastre si se
  mueve más de 3px, y el commit de edición ocurre solo si hubo movimiento.
- **Toma seleccionada bien visible**: borde blanco + contorno y brillo
  suave (`z-index` encima de las demás).
- **Los botones de vista del panel reconfiguran la toma seleccionada**:
  con una toma elegida, tocar 1ª persona / 3ª / Cine / Aérea cambia ESA toma,
  muestra la vista al instante y queda guardada así (con historial para
  undo). Sin toma seleccionada, siguen cambiando la vista global.

## [2026-08-23] — UX de tomas y barra superior

- **Click en una toma de la línea de tiempo**: el bloque se resalta en el
  contorno y la **cámara salta a esa toma** (vista previa inmediata; las
  fijas usan su camPos/target). Cambiar la cámara o el sujeto desde el
  editor de la toma ya la reconfiguraba — ahora también se ve al instante.
- **⏹ Detener movido a la izquierda del ▶** en la barra de transporte.
- **Bloque central en el header**: 💾 guardar · 📄 nuevo · ↩ deshacer ·
  ↪ rehacer, agrupados y centrados entre el menú Archivo y las herramientas
  de vista.

## [2026-08-23] — Asistente de escenas 🪄 (plantilla: Diálogo a dos)

- **Nuevo wizard de escenas** (botón 🪄 en la barra de la línea de tiempo,
  módulo `js/wizard.js`): elegís dos personajes, pegás el guion de cada uno
  (una frase por línea) y el asistente genera la escena completa:
  - personajes enfrentados y mirándose, acción `talk`
  - duración automática de cada réplica según su cantidad de palabras
  - estilos de cámara: alterno cerrado (plano/contraplano), plano medio por
    réplica o general único; opcional plano general de apertura
  - subtítulos sincronizados con el nombre del personaje que habla
  - estimación de duración en vivo mientras se escribe el guion
- Primer paso del backlog "biblioteca de plantillas" (`mini3d_mejoras.md`).

## [2026-08-23] — Flujo de proyecto: modal de arranque + barra superior

- **Modal de inicio** al cargar el programa: elegir **📄 Proyecto nuevo**
  (pide nombre del .json y escenario — los selectores de ambiente se mudaron
  ahí desde la barra superior, con previsualización en vivo al tocarlos) o
  **📂 Cargar proyecto** (abre el selector de archivos existente).
- **Barra superior rediseñada**: 💾 guardar cambios (Ctrl+S; si no hay nombre
  ofrece Guardar como), 📄 proyecto nuevo (si hay cambios sin guardar,
  pregunta antes de descartarlos/guardarlos), ↩ deshacer y ↪ rehacer
  (ahora solo íconos).
- **Detección de cambios sin guardar** (`sessionDirty`): se marca con cada
  edición y se limpia al guardar/abrir/crear.
- Nuevo módulo `js/startup.js`; `projectFiles.js` expone `newProject()`,
  `getProjectName()` y `setCurrentFileName()`.

## [2026-08-23] — Scrubbing de la línea de tiempo con cabezal arrastrable

- **Click en la regla de segundos o el fondo de la pista**: la línea roja
  salta exactamente a donde se hizo click (sin redondeo).
- **Cabezal rojo agarrable** en la cabeza de reproducción: arrastrándolo,
  sigue al mouse a cualquier velocidad (pointer capture global), aplicando
  en vivo el corte de cámara y los subtítulos del instante. No funciona
  durante la reproducción (primero pausar o detener).

## [2026-08-23] — Transporte de la línea de tiempo estilo reproductor

- **Botones solo íconos** con tooltip al pasar el mouse (los textos fueron
  removidos: es intuitivo y alcanza).
- **Play/Pausa alternado**: el botón ▶ se convierte en ⏸ mientras corre; la
  pausa CONGELA toda la simulación (personajes, recorridos, esperas,
  subtítulos) sin perder la posición, y reanuda desde ahí.
- **⏹ Detener vuelve la línea roja al comienzo** (también al terminar
  naturalmente la escena).
- **Nuevos botones de avance/retroceso**: ⏪/⏩ saltan ±10 segundos y
  ⏴/⏵ avanzan o retroceden 1 frame (1/30 s). Mueven la cabeza de la línea
  de tiempo y aplican el corte de cámara del instante; los subtítulos se
  ven también en este modo scrubbing.

## [2026-08-23] — Subtítulos: tamaño normal + pista en la línea de tiempo

- **Fix de tamaño**: los subtítulos se veían GIGANTES porque el lienzo del
  overlay era una franja de 180px estirada a toda la pantalla. Ahora el
  lienzo representa la pantalla completa (1024×576) con la franja de texto
  abajo: letra ~5% de la altura de pantalla, fondo semi-transparente y borde
  fino, como en una película/serie.
- **Pista de subtítulos en la línea de tiempo**: nueva fila bajo las tomas
  (`#subtitleLane`) donde cada cue aparece como un bloque amarillo alineado
  con la misma escala px/seg, con tooltip de tiempos y texto completo.

## [2026-08-23] — Plan de mejoras del producto

- **Nuevo documento `mini3d_mejoras.md`**: backlog priorizado de mejoras
  (gestos de un disparo, lip-sync, audio por escena, sentarse real,
  transiciones suaves, cámara con movimiento en la toma, render
  determinista/1080p, navegador de escenas, props narrativos) con impacto,
  esfuerzo y módulos a tocar. Será el roadmap de trabajo del producto.

## [2026-08-23] — Control de velocidad de reproducción

- **Nuevo control ⏱ en la barra de la línea de tiempo** (0.25× a 2×): escala
  TODO el reloj de simulación de forma proporcional — recorridos (con su
  cadencia de zancadas), esperas de waypoints, cortes de la timeline,
  animaciones y subtítulos. Sirve para ver las escenas más lento/rápido sin
  romper la sincronización del guion.
- **Grabación coherente**: al grabar, el video dura
  `duración_de_escena ÷ velocidad` (a 0.5× un video de 15s se graba en 30s,
  en cámara lenta).

## [2026-08-23] — Escena "¡Alarma en la red!" (15s, guion completo)

- Nueva escena incluida: **`scenes/alarma_en_la_red.json`** — Alex y Elena
  discuten en la sala de sistemas (plano general + plano de cada uno), suena
  la alarma y **corren a la sala de reuniones** con planos fijo, aéreo y POV
  en primera persona del recorrido; llegan donde el jefe (Carlos), que los
  ve, gira hacia el mini rack y lo señala; cierre con plano medio y **zoom**
  al mini rack y remate. 8 subtítulos con el diálogo inventado.
- "Aérea" agregada a los nombres de toma en la línea de tiempo.

## [2026-08-23] — Macetas depuradas + canal perimetral oeste hasta la impresora

- **Macetas del espacio central**: queda **una por cada esquina de la
  alfombra** (±3.6, ±3.6). Eliminadas las plantas 5 y 6 extra.
- **Canal de red perimetral**: desde los racks de sistemas, cierra el rincón
  NO y recorre la pared OESTE completa hacia el sur y la pared SUR, rodeando
  la oficina del jefe. Dentro de ella, un ramal corre por el borde superior
  del tabique norte (z=4.5) hasta el eje de la impresora del jefe (x=−10.4),
  donde baja un canal directo sobre la impresora.

## [2026-08-23] — Ajustes de cocina y comedor

- **Sillas del comedor**: corregidas (miran hacia la mesa) y, junto con la
  mesa grande, **rotadas 90°** — la mesa queda larga en sentido norte–sur con
  3 sillas a cada costado (oeste y este).
- **Dispenser de agua movido**: pegado a la pared oeste (x=−14.67) y al lado
  de la heladera.

## [2026-08-23] — Fix: sillas de los puestos Este giradas 180°

- **Las 8 sillas de los escritorios Este (E1–E8) estaban mirando al revés**:
  giradas 180° para que quien se sienta quede de frente al monitor de su PC
  (regla de orientación de SKILL.md). Mesas sin cambios.

## [2026-08-23] — Comedor en la cocina + canaletas a los puestos nuevos

- **Mesa de Comedores** (`lunchTable`): mesa grande igual a la de la sala de
  juntas (5.2×1.9 m) con **6 sillas**, en el sector de la cocina, para que los
  empleados vayan a comer.
- **Nueva derivación de canaletas de colores desde el mini rack** (sala de
  juntas) hacia los puestos nuevos Este (E5–E8): sale del rack por la parte
  superior, recorre la pared ESTE interior de la sala hacia el sur,
  **atraviesa el tabique que cierra el contorno de la sala** (z=−4.5) mediante
  un pasamuros con anillos (mismo estilo que el de la pared norte), y **sigue
  por la misma pared este (la que hace de borde con el exterior) hasta su
  MITAD** (z=0, el centro de los puestos nuevos), donde baja un canal hasta
  el piso.

## [2026-08-23] — Copia de los pares Este (8 puestos, simétricos)

- **4 escritorios Este nuevos** (`deskE5`–`deskE8` + sus sillas): copia
  idéntica de los 4 existentes, pegada del lado OESTE (el este lo limita la
  pared), desplazada exactamente una profundidad de mesa (0.95 m) para que
  los bordes queden apoyados. Mismo orden y orientación: todo simétrico.
  Tomas de piso nuevas bajo las 4 mesas copiadas.

## [2026-08-23] — Pares Este rotados 90°

- **Cada par de escritorios Este rotado 90° sobre su propio centro** (mesas y
  sillas juntas): ahora las mesas quedan alineadas norte–sur, con las espaldas
  juntas en el medio del par (z=∓1.5, x=13.35), monitores hacia afuera
  (norte/sur) y las dos personas de cada par una frente a la otra.
  Tomas de piso reubicadas bajo las mesas.

## [2026-08-23] — Hilera ESTE: pares enfrentados cerca del fondo

- **Los 4 escritorios Este reordenados de a pares enfrentados**, manteniéndolos
  hacia el fondo (cerca de la pared este): cada par con las espaldas de las
  mesas juntas en el medio (x=12.9 y x=13.8), monitores hacia afuera y las dos
  personas una frente a la otra. Par 1 en z=−1.5, par 2 en z=+1.5.
  Tomas de piso actualizadas bajo cada mesa.


## [2026-08-23] — Hilera ESTE pegada a la pared del fondo

- **Los 4 escritorios Este alejados de los sillones verdes**: dejaron el
  centro del pocket y ahora forman una fila apoyada en la **pared este**
  (cara interior x=14.9), espalda al muro, monitores hacia el ambiente y
  sillas del lado del teclado mirando sus pantallas. Posiciones
  x=14.4, z=−2.85/−0.95/+0.95/+2.85; tomas de piso actualizadas debajo.
  El pocket entre la sala de juntas y la oficina privada queda despejado.


## [2026-08-23] — Escena "Incidente en el servidor" (JSON cargable) + tomas fijas

### Nueva toma de cámara "Fija / Zoom" (`js/cinematics.js`, `js/timeline.js`)
- Nuevo modo `fixed` para tomas de la línea de tiempo: la toma define su
  propia **posición de cámara y punto objetivo** (`camPos` / `target`),
  pensado para planos cerrados y zooms de detalle (ej. el mini rack).
  La cámara queda clavada durante la toma; al cortar, salta a la siguiente.
- Los cortes de cámara ahora reciben la toma completa (todos los sitios de
  llamada en `timeline.js`). Nombre visible: "Fija / Zoom".

### Velocidad por recorrido (`js/cinematics.js`, `js/projectFiles.js`)
- Los recorridos guardados pueden llevar una **velocidad propia** (`speed`,
  en m/s): ≥3.5 hace que el personaje CORRA con cadencia sincronizada.
  La escena del JSON la usa para las corridas.

### Guardar/cargar subtítulos y tomas fijas (`js/projectFiles.js`)
- El proyecto JSON ahora serializa la **pista de subtítulos** y los campos
  `camPos`/`target`/velocidad; al abrir se restauran completos.

### Escena incluida: `scenes/incidente_servidor.json` (~15 s)
- Historia: Alex y Carlos discuten en la sala de sistemas → suena la alarma →
  corren por el pasillo central hasta la sala de juntas → el jefe los espera →
  plano fijo del mini rack con zoom en dos cortes → remate cómico
  ("el cable del patch panel estaba suelto").
- 7 tomas (cine, 3ª persona y 2 fijas), 2 recorridos con eventos de espera
  sincronizados con la alarma y 6 subtítulos.
- Uso: menú Archivo → Abrir… → elegir `scenes/incidente_servidor.json`;
  luego ▶ Reproducir Escena o ⏺ Grabar Escena.


## [2026-08-23] — Reacomodamiento de mobiliario de la oficina

### Oficina del jefe
- **Impresora del jefe movida**: de la esquina SO (-14.4, 9.8) a **al lado de
  la puerta de su oficina** (abertura del tabique norte, x∈[-10,-8.5]),
  SIEMPRE dentro de la oficina: contra ese tabique, a la izquierda de quien
  entra, en (-10.4, 5.0) mirando al interior.

### Sala de sistemas
- **Estantes de Repuestos 1 y 2 vueltos a la sala de sistemas** (estaban en la
  oficina este, que solo tiene una mesa de PC): apoyados de nuevo en el
  tabique ESTE de la sala (cara interior x=-4.575), la misma pared donde está
  el AP WiFi Servidores (`ap3`): (-4.8, -7.9) y (-4.8, -9.3), frente mirando
  al oeste hacia la sala.

### Entrada y espacio este
- **"Mesa de Trabajo IT" eliminada** (`emptyTable` + `chairIT`): sobraba al
  lado de la puerta de entrada. También se eliminó su toma de piso para no
  dejar conexiones huérfanas.
- **Hilera ESTE reacomodada con el patrón de las PCs del norte (N5–N8)**:
  las 3 mesas en columna que estaban junto a los sillones de la alfombra
  ahora son **2 pares enfrentados espalda contra espalda** (4 puestos, se
  agregó `deskE4`) en el pocket entre la sala de juntas y la oficina privada:
  escritorios en x=5.65/6.55, filas z=∓1.5, monitores al ambiente y cada
  silla del lado del teclado mirando sus monitores.
- Tomas de piso actualizadas bajo los 4 escritorios Este.


## [2026-08-23] — Escena Demo + sistema de subtítulos

### Nuevo módulo `js/subtitles.js`
- **Subtítulos dibujados DENTRO del canvas WebGL** (pase ortográfico encima
  del render principal): un `<div>` HTML no sirve porque
  `canvas.captureStream` solo captura el contenido del canvas y el video
  saldría sin subtítulos.
- Pista de subtítulos con cues `{ start, end, text }`; texto blanco con borde
  negro sobre franja semi-transparente redondeada en la parte baja, con ajuste
  de línea automático. API: `setSubtitles(cues)`, `clearSubtitles()`,
  `renderSubtitleOverlay(t)`.
- Se muestran durante la reproducción/grabación de la escena
  (`js/render.js`, después del render principal).

### Nuevo módulo `js/demoScene.js` + botón "🎬 Escena Demo"
- **Escena de ejemplo de 15 segundos** ("Un lunes cualquiera en Sistemas")
  armada con un clic usando solo funciones existentes:
  - Alex (human1) camina desde el este hasta el escritorio de Carlos;
    evento en el punto final lo deja **hablando** al llegar (usa el
    `endAction` agregado hoy).
  - Carlos (human2) tecleando en su puesto del centro; Elena (human3) de pie
    hablando en el open space; perro junto a la mesita de centro y gato
    tumbado cerca de los sillones norte.
  - 4 tomas de cámara en la línea de tiempo (3ª persona ×2, Cine 1, Cine 2)
    que suman 15s.
  - 5 subtítulos sincronizados con la historia.
- Botón "🎬 Escena Demo" agregado a la barra de la línea de tiempo
  (`index.html`). Después de armarla: ▶ para verla, ⏺ para grabar el WebM.


## [2026-08-23] — Flujo caminar→hablar→cámara→grabar

### Acción final persistente en recorridos
- **Nuevo `endAction` en las reproducciones cinemáticas** (`js/cinematics.js`,
  `js/render.js`): si hay un evento con acción sobre el último punto del
  recorrido (u > 0.9), esa acción **persiste al terminar el recorrido** en vez
  de volver a la acción previa. Permite el caso central del proyecto: "Alex
  camina hasta su escritorio y queda sentado/hablando".
- **La espera en el punto final ya no reanuda la caminata** (`js/render.js`):
  si el evento con espera está al final del recorrido, al agotarse el tiempo el
  personaje permanece quieto haciendo su acción final (antes volvía a caminar
  un tramo mínimo hasta u=1 y terminaba en idle).
- Detener manualmente un recorrido sigue restaurando la acción previa
  (comportamiento sin cambios).

### Grabación más robusta (dt acotado)
- **`dt` acotado a 1/20 s en el loop** (`js/render.js`): si la pestaña pierde
  foco o hay una caída de FPS durante la grabación, el reloj ya no salta; la
  escena grabada no se desincroniza de la línea de tiempo. Mitiga el problema
  #6 de GLM.md (video no determinista).



## [2026-08-23] — Documentación premium del repositorio

### Portada visual y README refinado
- **Se agregó la portada visual** en `assets/mini3d-cover.svg`, con un estilo
  premium oscuro, luces de acento, composición 3D y branding del proyecto.
- **Se mejoró `README.md`** para lucir como un repositorio más pulido y
  profesional, con hero section, descripción clara del objetivo, stack, casos de
  uso, roadmap y guía de ejecución.
- Se mantuvo el enfoque del proyecto como una herramienta ligera y abierta para
  la producción de clips 3D narrativos y educativos, sin fines de lucro.
- **Se actualizó `GLM.md`** con una nota de estado que refleja esta mejora de
  presentación y documentación del repositorio.
- **Se preparó la primera versión pública del repositorio** con `LICENSE`,
  `.gitignore` y `package.json` actualizado a `0.1.0` con licencia MIT.

## [2026-08-23] — Cambios

### Limpieza: código muerto, bindings huérfanos y fix del changelog
- **Eliminado `app.js`** (107 KB, monolito original previo al refactor; ningún
  HTML lo cargaba). También **`node_modules/`** y **`package-lock.json`**
  (Three.js duplicado; la única copia en uso es `vendor/`). `package.json`
  actualizado: sin `"main"` ni dependencias.
- **Bindings huérfanos eliminados**: los handlers de `btnCinemaToggle`,
  `btnCinemaClear` y `btnCinemaPlay` en `js/ui.js` y sus lookups/actualizaciones
  muertas en `js/cinematics.js` (`cinemaSetMode`, `refreshCinemaUI`)
  referenciaban IDs que ya no existen en `index.html`. Imports de `ui.js`
  ajustados a los símbolos realmente usados. El play individual por personaje
  (lista de recorridos) no se tocó.
- **Fix de este changelog**: la entrada "Bifurcación central (x=0.0)" de hoy
  estaba duplicada; se fusionó en una sola.
- **`GLM.md` actualizado**: ítems de limpieza marcados como resueltos y nota de
  verificación 2026-08-23 (menú Archivo ya funcional).
- Verificado en navegador: la app carga y renderiza sin errores tras la limpieza.

### Revert: Hilera NORTE vuelve al arreglo de 8 (tabiques + centro)
- **Deshecho el arreglo de 8 escritorios pegados a la pared norte** (bucle
  `northX`, z=−10.4): se restauró el arreglo previo. `N1/N2` contra el
  tabique oeste (x=−4.0) y `N3/N4` contra el tabique este (x=+4.0), espalda al
  muro y monitores al ambiente; `N5`–`N8` en el centro (x=±0.45) enfrentados.
  Todas las sillas del lado del monitor. (La entrada "8 puestos pegados a la
  pared norte" de más abajo ya no aplica.)
- **Se mantienen** las bajadas de cables en la pared norte (x=−4/0/+4).

### Hilera NORTE: 8 puestos pegados a la pared norte
- **Todas las PCs y sillas de la Hilera NORTE (`N1`–`N8`) movidas contra la
  pared norte (z=−11)**, en una sola hilera debajo de la canaleta de cables
  de colores, para quedar cerca de las 3 bajadas (x=−4, 0, +4). Ahora todas
  tienen rotación 0 (espalda al muro, monitores al sur/ambiente) y las sillas
  al sur, mirando al norte hacia la PC (enfrente del monitor). Posiciones x=
  [−7.7, −5.5, −3.3, −1.1, 1.1, 3.3, 5.5, 7.7], escritorios z=−10.4 y
  sillas z=−9.7. Se eliminó el antiguo espejo hacia el centro (ya no aplica).

### Hilera NORTE: bajada de cables a altura de tomacorriente
- **Nueva bifurcación de cable** en la pared norte (sobre los puestos de la
  sala de sistemas): `cableDrop(-4.0, -10.78, 0.10, TRAY_Y_OUT)` baja de la
  canaleta de cables de colores hasta **y=0.10** (~10 cm antes del piso, altura
  de tomacorriente), sin llegar al suelo. Posición x=−4 provisional (lado
  oeste); se puede mover o duplicar por grupo de ser necesario.
- **Bifurcación espejo del otro lado** (lado este, x=+4.0):
  `cableDrop(4.0, -10.78, 0.0, TRAY_Y_OUT)` baja de la misma canaleta pero
  **hasta el piso** (y=0).
- **Bifurcación central** (x=0.0): `cableDrop(0.0, -10.78, 0.0, TRAY_Y_OUT)`
  en el centro de la pared norte para alimentar las PCs del medio (`N5`–`N8`),
  baja de la misma canaleta **hasta el piso** (y=0).

### Hilera NORTE: bocas de red eliminadas
- **Eliminadas las 4 bocas de red/piso de la Hilera NORTE** (`floorOutlet` en
  (−2,−7.5)/(−2,−8.5)/(+2,−7.5)/(+2,−8.5)): al mover los escritorios `N1`–`N4`
  a los tabiques (x=±4.0) quedaron en el medio del pasillo, entre las sillas,
  así que se quitaron (coincide con la regla de no dejar bocas huérfanas).

### Hilera NORTE: filas originales pegadas a las paredes
- **`deskN1/N2` y `N3/N4` movidos a los tabiques** (x=±4.5) de la Hilera
  NORTE, con sus sillas, **espalda a la pared y monitores al ambiente** (se
  mantuvo la rotación original; solo se cambió la posición). `N1/N2` ahora en
  x=−4.0 (silla en x=−3.3) y `N3/N4` en x=+4.0 (silla en x=+3.3), a ~0.08 m de
  los tabiques. Las sillas quedan enfrente de sus monitores.
- **Los 4 escritorios centrales (`deskN5`–`deskN8`) no se tocaron** (quedan
  donde estaban, en el centro del pasillo).

### Hilera NORTE: espejo hacia el centro (4 escritorios nuevos)
- **4 escritorios nuevos enfrentados a los originales** (`deskN5`–`deskN8` +
  `chairN5`–`chairN8`) en la Hilera NORTE: `deskN5/N6` al este de `N1/N2`
  (monitores al oeste, mirando a los originales) y `deskN7/N8` al oeste de
  `N3/N4` (monitores al este). Cada silla queda del lado del monitor
  (enfrente de la pantalla, nunca detrás), cumpliendo la regla de orientación.
- **Nota de colisión**: el pasillo es angosto, así que `chairN5/N6` rozan
  levemente a `chairN1` y `chairN7/N8` rozan a `chairN3` (opción "espejo hacia
  el centro" elegida por el usuario, que aceptaba roce en el centro). Los
  escritorios nuevos solo se tocan en el centro del pasillo (sin interpenetrar).

### Fix: sillas invertidas en la Hilera NORTE (pasillo sala de sistemas ↔ juntas)
- **Sillas `chairN1`–`chairN4` giradas/movidas**: estaban del lado exterior
  (x=±2.7) mirando hacia afuera, de espaldas a los monitores. Ahora quedan del
  lado interior del pasillo (x=±1.3, lado del teclado) y miran a la PC, cumpliendo
  la regla de orientación (quien se sienta tiene los monitores en frente). Los
  escritorios `deskN1`–`deskN4` no se tocaron (ya miraban al centro).

### Escritorios en los pasillos este y norte + tomas de red/elec mejoradas
- **Hilera ESTE** (pasillo entre sala de juntas y oficina privada):
  3 escritorios con PC (`deskE1-3` + `chairE1-3`) en columna en x=6.3,
  monitores mirando al este y sillas al oeste mirando a la PC.
- **Hilera NORTE** (pasillo entre sala de sistemas y sala de juntas):
  2 hileras enfrentadas de 2 puestos (`deskN1-4` + `chairN1-4`) en x=±2.0
  (z -7.5 y -8.5), monitores mirando al centro del pasillo (enfrentadas).
- **Tomas de red/electricidad rediseñadas** (`floorOutlet`, `js/office.js`):
  base **hexagonal** con tapa metálica bruñida y placa retráctil, **2 puertos
  RJ45** con LEDs de actividad (verde/ámbar) y **2 enchufes de electricidad**
  argentinos (tres patas) + etiqueta. Se integran al parpadeo de
  `serverLedMaterials`.
- **SIN canales blancos en el piso para las hileras nuevas**: se eliminaron
  los tramos de canal (`floorChannel`) que iban a las hileras este y norte.
  Solo se conservan **las tomas de piso** junto a cada PC nuevo. Los canales
  blancos del espacio central (los 6 originales) se mantienen intactos.
- **Mesa de Trabajo IT movida** (`emptyTable` + `chairIT`): ahora al lado de
  la puerta de entrada (x=3.5, z=8.9), orientada para que quien entra se
  sienta (silla en z=8.2) y mire hacia la pared sur. Con su toma de piso.
- **Estantes de repuestos movidos** (`shelfSR1-2`): ahora en la pared ESTE
  del espacio central (x=14.7, z 7.0 y 8.4), apoyados en la pared real.

### Oficina del jefe renovada (silla ejecutiva, lámpara y ambientación)
- **Silla ejecutiva imponente de capitoné** (`execChair`, `js/office.js`):
  asiento grande acolchado con cojín, **respaldo alto de capitoné con 12
  botones dorados** (3 columnas x 4 filas) y cabecera, **apoyabrazos
  acolchados** sobre postes dorados, y **base de 5 patas con ruedas**.
- **Silla ejecutiva bien orientada**: ahora queda al SUR del escritorio
  (z=9.6, mirando al norte hacia los monitores), cumpliendo la regla de
  orientación del proyecto: quien se sienta debe tener los monitores en
  frente. *(Antes quedaba al norte, del lado de la pantalla.)*
- **Silla de invitado** (`guestChair`, `js/office.js`): silla de oficina
  nueva al NORTE del escritorio (frente al jefe, entre el monitor y la
  pared), mirando al sur para conversar cara a cara.
- **Lámpara de escritorio arreglada** (antes se veía deforme): ahora es una
  lámpara clásica con base de bronce, vástago, **brazo articulado** de dos
  segmentos y **pantalla de tela cónica** con bombilla emisiva que ilumina
  hacia el escritorio.
- **Ambientación de la oficina del jefe mejorada**:
  - 🌿 **Planta grande de interior** (`bossPlant`): maceta rojiza, tronco y
    follaje verdes en la esquina NO, junto a la pared sud.
  - 🕰️ **Reloj de pared** (`bossClock`): esfera clara con marco dorado,
    12 marcas horarias y agujas, montado en la pared sur entre ambas
    ventanas.
- Ambos props nuevos son seleccionables.

### Sala de servidores con detalle técnico + ciberseguridad
- **Racks de servidor renovados** (los 3 de la sala NE): rack de 19" con
  rails de montaje, **patch panel 24 puertos** con organizador de cables,
  **switch gestionable 24p** con LEDs y LED de estado, **4 blades** con
  bahías de disco y LEDs de actividad + cables de red al patch, **UPS 3U**
  con pantalla LCD y conectores, **base con ruedas** y **organizador
  vertical** con mazos de cables de colores (`createServerRack` en
  `js/office.js`). Todos los LEDs se integran al parpadeo de
  `serverLedMaterials`.
- **Equipamiento de ciberseguridad nuevo en la sala de servidores**:
  - 🔥 **Firewall / Security Appliance** (`secFirewall`): appliance 19" con
    puertos, LEDs de estado verde/rojo y pantallita LCD de monitoreo.
  - 🖥️ **Consola KVM** (`kvmCart`): carrito con ruedas, teclado y monitor
    para administrar los servidores.
  - 🧯 **Extintor de pared** (`fireExtinct`): montado en la pared norte de
    la sala (apoyado en tramo real), con soporte y rótulo.
  - 🎛️ **Cartel "Sala de Servidores"** (`serverSign`): placa con icono de
    escudo/lock (ciberseguridad) y LED verde, montada en la pared oeste de
    la sala de sistemas.
- Todos los props son seleccionables (aparecen en el outliner y se pueden
  mover con el gizmo/sliders).

## [2026-08-22] — Cambios (14)

### Tendido: transversal extendida
- **Transversal extendida hasta z=2.32**: ahora también conecta el ramal del
  escritorio 6 (el que estaba aislado cerca del gato) con el resto del
  tendido. Todos los ramales quedan unidos.

## [2026-08-22] — Cambios (13)

### Tendido conectado
- **Ramal del escritorio 5 reconectado**: ahora va desde la transversal
  (x=-2) hasta la boca junto a la PC — ya no queda el tramo aislado.

## [2026-08-22] — Cambios (12)

### Tendido: transversal + ramal 5 corregido
- **Transversal nueva** que une los 3 ramales horizontales del tendido
  (escritorios 1-2, 3-4 y 5) en x=-2.
- **Ramal del escritorio 5** movido al lado derecho de la PC (tramo corto,
  ya no se extiende hacia el oeste).

## [2026-08-22] — Cambios (11)

### Modo "Editar Objetos" + paredes fijas + ajustes
- **Paredes ya no seleccionables**: quedan fijas, no se pueden clickear ni
  mover (el panel 🧱 Pared queda para un plan futuro).
- **Nuevo botón "✏️ Editar Objetos"** en el menú lateral: con OFF los
  muebles/objetos no se pueden seleccionar ni mover (quedan estáticos); con
  ON recién ahí se pueden clickear y mover. **Excepción: los 5 personajes
  siempre se pueden clickear y mover**, sin importar el modo.
- **Tendido completado**: ramal de red para el escritorio 6 (igual al del 5)
  y canal hasta la fotocopiadora, cada uno con su puesto de red.
- **Perro reubicado** (estaba atravesando un sillón): ahora en zona abierta
  del centro mirando a la entrada.
- **Alex reubicado** a un espacio despejado al este de las mesas centrales.
- **Textura de pared más elegante**: greige cálido con degradado sutil y
  paneles grandes de juntas finas (aspecto oficina moderna).

## [2026-08-22] — Cambios (10)

### Corrección del tendido
- **Eliminada la columna principal visible** que cruzaba la alfombra hasta la
  roseta (la línea blanca de la foto), junto con la roseta. Quedan solo los
  tramos cortos de canal ocultos bajo las mesas, junto a la torre de cada PC.

## [2026-08-22] — Cambios (9)

### Rueda = vuelo adelante/atrás + limpieza
- **Rueda del mouse ya no hace zoom**: ahora desplaza la cámara hacia
  adelante o atrás según el punto de vista (dolly libre), igual que en un
  editor 3D. El zoom de OrbitControls quedó desactivado.
- **Canal de piso del escritorio 6 eliminado** (el tramo blanco suelto que se
  veía cerca del gato) junto con su puesto de red.

## [2026-08-22] — Cambios (8)

### Fix: error de carga
- **Fix**: la pared de herramientas usaba `cableMats` antes de su declaración
  (TDZ → ReferenceError al cargar). Reemplazado por colores literales.

## [2026-08-22] — Cambios (7)

### Correcciones visuales, personajes y cámara inicial
- **Cuadro junto a la puerta del jefe**: movido al tramo real de pared
  (x=-11.5) — ya no sobresale en la abertura.
- **Cajoneras de la mesa ejecutiva**: reubicadas bajo la tapa (antes
  sobresalían flotando fuera del escritorio).
- **Cuadro chico junto al WiFi eliminado**.
- **Glitches corregidos**: alfombra del jefe separada de su borde dorado
  (z-fighting) y vidrio/travesaños de las ventanas con separación suficiente.
- **Personajes reubicados**:
  - Alex: espacio central, junto al escritorio 2, mirando a su PC.
  - Carlos: oficina del jefe, frente a sus monitores.
  - Elena: sala de juntas, frente a la mesa y la TV.
  - Perro: zona de sillones del centro; Gato: lado oeste cerca de la cocina.
- **Cámara inicial elevada** (0, 13, 9 mirando al centro): se ve toda la
  oficina al cargar. El botón "🎯 Reset Vista" usa la misma vista.

## [2026-08-22] — Cambios (6)

### Tendido nuevo + sala de sistemas equipada
- **Tendido de red por el piso reconstruido para las 6 PCs del centro**:
  roseta en el tabique sur, columna principal y ramales que llegan justo a la
  torre de cada PC (escritorios 1–6), con un puesto de red junto a cada torre.
  Nada huérfano: cada boca tiene su PC al lado.
- **Fotocopiadora** devuelta al espacio central (entre escritorios 5 y 6).
- **Sala de sistemas ampliada**:
  - 2 bancos de trabajo con PC completa sobre la mesa (torre, monitor,
    teclado) + sillas.
  - Fotocopiadora propia en la pared oeste.
  - 2 estantes metálicos con cajas de repuestos y bobinas de cable
    (tabique este).
  - Pared de herramientas: tablón perforado con llaves/destornilladores/
    martillo colgados, bobinas de cable de colores, cajones organizadores,
    mesa con caja de herramientas y bandeja de repuestos.

## [2026-08-22] — Cambios (5)

### Limpieza total de la red por el piso
- **Eliminado TODO el tendido de red del piso central**: roseta, canales y
  los 3 puestos de red restantes. Ya no queda ninguna boca de red huérfana
  en el espacio central (las PCs se conectan por WiFi / sin cable visible).

## [2026-08-22] — Cambios (4)

### Correcciones de la oficina del jefe y limpieza final
- **AP central**: movido a la derecha de la puerta (x=2.6, y=2.25), totalmente
  apoyado en la pared — ya no sobresale sobre el marco.
- **Escritorio del jefe girado 180°** (monitores hacia el norte) y **silla
  ejecutiva** reubicada al lado sur del escritorio, mirando a las pantallas;
  se eliminó el cilindro extraño del respaldo.
- **Bocas de red huérfanas del centro ELIMINADAS definitivamente**: quitados
  los puestos de (-2.05, 1.6) y (-2.6, 2.3) (lado de Alex). Quedan solo los
  que acompañan PCs.
- **WiFi propio en la oficina del jefe** (pared oeste).
- **SKILL.md**: nuevas reglas 5 (orientación mesas/sillas: el sentado debe
  tener los monitores en frente) y 6 (nada flotando ni sockets sin equipo).

## [2026-08-22] — Cambios (3)

### Oficina del Jefe + ajustes
- **Puesto de red huérfano eliminado**: el que quedó al lado de Alex (vieja
  conexión de la impresora) ya no existe.
- **AP WiFi Central arriba de la puerta de entrada** (y=2.65), cubriendo toda
  la sala grande (`createWallAP` ahora acepta altura).
- **Mesa de Juntas acercada a la TV**: mesa y 6 sillas movidas 3 m hacia el
  este (x=11.5), quedando frente a la pantalla.
- **Oficina del Jefe renovada** (SO, frente a sistemas):
  - Escritorio ejecutivo grande de 2.8 m con tapa de cuero, frente panelado,
    cajoneras con manijas doradas, monitor dual, lámpara verde y teléfono.
  - Silla ejecutiva de cuero con detalles dorados.
  - 2 sillones Chesterfield de cuero (respaldo capitoné con botones,
    apoyabrazos enrollados) + mesa ratona.
  - Alfombra grande bordeada en dorado.
  - 3 cuadros con marco dorado.
  - 3 ventanas importantes (marco oscuro, vidrio celeste, travesaños).
  - Barra de bebidas propia con botellas, vasos y baranda dorada.
  - Impresora propia del jefe (la fotocopiadora se mudó del espacio central).

## [2026-08-22] — Cambios (2)

### Ajustes de orientación, zoom e instalaciones
- **Zoom con rueda más rápido**: `zoomSpeed` 1.2 → 2.2 (`js/core.js`).
- **Escritorios 1–4**: rotación corregida para que las pantallas queden bien
  respecto de las sillas (que no se tocaron).
- **Sillas 5 y 6 movidas al lado este de sus mesas** (lado del teclado),
  mirando a la PC — antes quedaron del lado de la pared/cocina.
- **AP WiFi Central reubicado**: estaba flotando en el aire (el tabique oeste
  no existe en z=-2). Ahora pegado a la pared sur exterior en x=-6, mirando
  al norte hacia el espacio central.
- **Ramal de red por el piso**: el tramo que iba al viejo puesto del
  escritorio 5 ahora llega hasta la fotocopiadora (canal + puesto de red en
  (-3.72, 0)).

## [2026-08-22] — Cambios

### Navegación y mobiliario (ajustes del usuario)
- **Vuelo real con botón derecho** (`js/core.js`): el paneo de OrbitControls
  escalaba la velocidad con la distancia al objetivo (lentísimo al acercarse).
  Se reemplazó por un desplazamiento propio a velocidad constante
  (~0.02 m/píxel) en el plano de la pantalla: un arrastre cruza toda la
  oficina sin importar el zoom. `contextmenu` prevenido (el clic derecho ya
  no "hace click" ni abre menú).
- **Escritorios 1–6 rotados 180°**: ahora cada monitor mira hacia su silla y
  las parejas quedan enfrentadas a través del divisor. Las sillas no se
  tocaron (ya miraban bien).
- **Fotocopiadora** confirmada centrada entre los escritorios 5 y 6.
- **Sillones 3, 4 y 5 reubicados contra paredes blancas reales**: antes
  "flotaban" en z=±4.03 donde no hay pared (ahí están las aberturas de paso).
  Ahora: Sillón 3 en el tabique norte (segmento oeste), Sillón 4 en el
  tabique sur (segmento este) y Sillón 5 en el tabique este del espacio
  central, todos con el respaldo apoyado al ras, como la puerta de acceso.
- Nota: las opciones de menú viejas ("Sentar en Escritorio", etc.) ya no
  existen en el código; si se ven en pantalla es caché del navegador
  (Ctrl+F5).

## [2026-08-21] — Cambios

### UX de cámara, limpieza y reorganización del mobiliario
- **Cámara con botón derecho más rápida y ágil**: `screenSpacePanning`
  (el desplazamiento va en el plano de la pantalla, moverse "por el aire"),
  `panSpeed` 2.2 y `zoomSpeed` 1.2 (`js/core.js`).
- **Eliminados los atajos de ubicación inútiles**: "Sentar en Escritorio",
  "Ir a Servidores IT", "Ir a Sala de Reuniones", "Elevar a Mesa" y
  "Bajar al Suelo" (botones y handlers). El movimiento directo con gizmo +
  imán de alturas los reemplaza.
- **Mesas centrales enfrentadas**: las 4 mesas y sillas del centro rotadas
  180° — cada persona mira hacia el interior y las parejas quedan
  enfrentadas a través del divisor (como en una oficina real). Los
  escritorios 5 y 6 (oeste) también rotados 180°, con sus sillas del otro
  lado, mirando al centro.
- **Fotocopiadora** ubicada entre los escritorios 5 y 6, pegada al tabique.
- **Sillones nuevos pegados a las paredes** del espacio central: uno en la
  pared norte y dos en la pared sur, al ras como la puerta de acceso.

### Ambientación: centro despejado y sector de cocina
- **Franjas azules del cuadrado central eliminadas** (los "barrotes" sobre
  los tabiques).
- **Mini rack**: misma profundidad que los racks principales (0.9 m) y mudado
  al extremo este de la pared norte de juntas, lejos de la TV; la canaleta
  norte se extendió hasta él.
- **Pantalla TV** mudada a la pared este de la oficina de juntas (con marco),
  mirando a la mesa grande.
- **3 sillones verdes más** pegados a los tabiques del espacio central
  (2 al norte, 1 al sur) y **3 plantas más** (6 en total).
- **Sector de comidas y bebidas** junto al dispenser (pared oeste): mesada
  de 3.2 m con puertas y manijas, bacha con grifería, alacena superior y
  heladera side-by-side de acero con LED — seleccionables.

### Cablerío estructurado realista
- **Eliminadas todas las canaletas que rodeaban el cuadrado central** (se veían
  como cables por el aire). El recorrido ahora es único y solo por paredes de
  oficinas: de la sala de racks (NO) a la oficina de la mesa grande (NE) por
  la pared norte exterior, atravesando los tabiques de las oficinas con
  **pasamuros** (sleeves metálicos con anillo, como en cablerío estructurado
  real).
- Bajadas: al tope del primer rack (con tramo corto horizontal) y al mini
  rack en juntas. El conduit del tablero eléctrico llega a esta canaleta.
- **Mini rack mudado a la oficina de la mesa grande** (pared norte) y con más
  profundidad (0.5 m): marco frontal, puerta de vidrio ahumado semi-
  transparente, patch panel más grande con más puertos.
- Los puestos de red del piso central ahora se alimentan de una **roseta de
  red baja** en el tabique sur (el cable llega por dentro de la pared, sin
  canaleta aérea) — seleccionable.

### Guías visuales de snap, red por el piso y modelos mejorados
- **Guías del imán**: al mover un objeto y pegarse a una referencia, aparecen
  líneas finas cian en el piso marcando la posición donde actuó el imán. Al
  rotar, un aviso flotante muestra el ángulo exacto (ej. "90°") cuando se
  imanta a un múltiplo de 15°; al escalar, muestra el múltiplo (ej. "1.25x")
  (`js/gizmo.js`, estilo `.snap-badge`).
- **Cableado reenrutado**: canaletas pegadas al borde superior exacto de los
  tabiques (3.42 m) y nada cruzando el aire. Nueva distribución central por
  el piso: bajada por el tabique sur hasta el suelo, canales planos sobre el
  piso y **6 puestos de red** (floor boxes con puertos RJ45 y LEDs verdes/
  ámbar) junto a cada PC de los escritorios — seleccionables.
  Bajada al switch de la mesa IT a la altura de la mesa.
- **Escritorios más reales**: monitor con base, cuello, bisel y pantalla
  emisiva; teclado bicolor con teclas y mouse; panel trasero (modesty);
  cajonera de 3 cajones con manijas; torre de PC debajo de cada mesa con LED
  de encendido.
- **Torre PC IT mejorada**: botón de encendido con LED y rejillas de
  ventilación en el frente.
- **APs WiFi reubicados** en la zona lisa de las paredes (2.25 m, debajo de
  la franja azul de acento).

### Snap magnético y bordes de pared estirables
- **Snap (imán) en toda la edición** (`js/gizmo.js`): al mover objetos con
  flechas, arrastre libre o arrastre por el aire, las caras del objeto se
  pegan magnéticamente (radio 12 cm) a las caras de las paredes y a los
  centros de otros objetos — dos paredes quedan perfectamente pegadas, un
  mueble se alinea a la pared o a otro mueble. En altura, los objetos
  (no personajes) se pegan a alturas comunes: piso (0), asiento (0.45),
  tapa de escritorio (0.76). La rotación con anillos tiene imán a
  múltiplos de 15° y la escala a múltiplos de 0.25.
- **Bordes de pared estirables**: con una pared seleccionada, al acercar el
  mouse a un borde lateral o al borde superior, el borde **se ilumina en
  amarillo**; agarrarlo y arrastrarlo estira SOLO esa parte — el extremo
  opuesto (o la base) queda fijo. Funciona en cualquier orientación de la
  pared y se integra con el panel 🧱 Pared, el historial de undo y el
  guardado JSON.

### Paredes editables + APs de pared + canaletas al borde
- **Paredes más altas**: exteriores 3.7 m, tabiques interiores 3.5 m.
- **APs WiFi de pared estilo Cisco** (reemplazan a los de techo): caja blanca
  con 3 antenas exteriores grandes inclinadas y LED azul parpadeante;
  montados en altura mirando al espacio que cubren (central, juntas,
  servidores) (`js/office.js`).
- **Canaletas pegadas al borde superior de las paredes** (nada de cableado
  por el aire): recorren tabiques a 3.3 m y paredes exteriores a 3.55 m,
  con bajadas verticales al mini rack, tablero y mesa IT.
- **Paredes editables**: cada pared es ahora un objeto seleccionable
  (aparece en el outliner como "Pared N"). Al seleccionarla se muestra el
  panel 🧱 Pared con **Largo**, **Alto** y **Espesor** (sliders + valores
  numéricos) y **Textura** elegible entre 6 procedurales: Paneles claros,
  Cemento, Ladrillo, Madera, Azul corporativo y Rayas grises. Se mueven con
  el gizmo/anillo/sliders como cualquier objeto; colisionan como cajas AABB
  dinámicas (se recalculan al moverlas o redimensionarlas, también para la
  navegación A*). Las dimensiones y textura se guardan en el JSON y en el
  historial de undo (`js/office.js`, `js/ui.js`, `js/collision.js`,
  `js/navigation.js`, `js/projectFiles.js`).
- Fix: ciclo de imports ui↔office resuelto poblando el dropdown de texturas
  de forma diferida.

### Ambientación de la oficina: entrada, texturas e instalaciones
- **Puerta doble de vidrio** en la entrada (pared sur): marco de aluminio,
  dos hojas con manijas y barra central (`js/office.js`).
- **Paredes con textura procedural** (paneles con juntas + ruido sutil,
  generadas en canvas sin assets) y franja de acento azul en los tabiques
  centrales.
- **Instalación de red visible**: mini rack de pared (oficina de gerencia)
  con patch panel y puertos, canaletas metálicas recorriendo los tabiques
  con mazos de cables de colores (azul/amarillo/rojo) y bajadas verticales.
  Las canaletas conectan: sala de servidores, mesa IT, sala de juntas y el
  mini rack.
- **Tablero eléctrico** en el pasillo norte (puerta con manija, piloto verde
  y conduit que sube hasta la canaleta).
- **3 Access Points WiFi** de techo (disco blanco con anillo LED azul que
  parpadea con los LEDs de servidores): central, sala de juntas y sala de
  servidores. Todos seleccionables.
- Los elementos montados en altura (APs, mini rack, tablero) no bloquean la
  navegación ni las colisiones a nivel de piso (filtro y > 1.0 en
  `collision.js` y `navigation.js`).

### Fixes visuales y Undo/Redo
- **Fix glitch en la frente de Elena**: el bloque de pelo femenino tenía su
  cara frontal coplanar con la frente (mismo plano z) y producía
  z-fighting — parpadeo tipo "TV sin señal". Corregido separando el plano
  (`js/characters.js`).
- **Undo/Redo** (nuevo `js/undo.js`): botones "↩ Deshacer" / "↪ Rehacer" en
  la barra superior + atajos Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z). Cada cambio
  confirmado guarda una foto completa de la escena (posiciones, acciones,
  recorridos, tomas) y deshacer/rehacer restaura ese estado. Se registra
  historia al: arrastrar con gizmo/anillo (mover, rotar, escalar), cambiar
  sliders, cambiar acción de personaje, atajos de ubicación, crear/editar/
  borrar puntos de recorrido, eventos de waypoint, y crear/editar/borrar
  tomas. Máximo 60 pasos. Verificado en navegador.

### Pies, colisión con paredes y navegación automática
- **El piso es límite absoluto**: y = 0 se aplica a TODOS los objetos en cada
  frame (`resolveCollisions` en `js/collision.js`), sin importar cómo se
  muevan (gizmo, sliders, arrastre libre, reproducción, archivos cargados).
  Nada puede quedar por debajo del piso. Las paredes, en cambio, solo
  bloquean a los personajes: el usuario puede mover objetos a través de
  ellas a propósito.
- **Piso propio por personaje** (`rig.groundY`): el origen de los personajes
  queda por encima de sus pies (por el offset interno del rig), así que
  bajarlos a y=0 los enterraba 14–17 cm. Ahora cada rig define su altura
  mínima (humanos 0.17, perro 0.05, gato 0.02) y TODOS los límites la
  respetan: física del loop, sliders, flecha Y del gizmo y arrastre libre.
- **Fix pies hundidos**: margen extra de altura en los rigs (humanos +0.03,
  perro +0.03, gato +0.02) para que el calzado no se hunda visualmente en el
  piso (`js/characters.js`).
- **Colisión con paredes**: las paredes de la oficina se registran como
  cajas AABB (`officeWallColliders` en `js/office.js`) y los personajes ya
  no las atraviesan — se empuja al personaje fuera de la pared por la cara
  más cercana (`resolveAABB` en `js/collision.js`).
- **Navegación automática de recorridos** (nuevo `js/navigation.js`): al
  reproducir una cinemática, si un tramo del camino cruza una pared u
  objeto, se calcula una ruta alternativa (grilla + A* + suavizado por
  línea de vista) y se insertan puntos intermedios automáticamente para
  rodear el obstáculo. El punto final (rojo) siempre se respeta. Los
  obstáculos considerados: paredes del ambiente activo y mobiliario/equipos
  visibles; los demás personajes se apartan por colisión en tiempo real.

### Nuevas interacciones del gizmo
- **Escalado con la banda del anillo azul**: agarrar la banda del anillo de
  selección y arrastrar hacia afuera agranda la figura, hacia adentro la
  achica (escala uniforme, rango 0.2x–4x). El círculo interior sigue siendo
  movimiento libre (`js/gizmo.js`).
- El anillo de selección acompaña el tamaño escalado del objeto
  (`js/selection.js`) y la escala se guarda/carga en el JSON del proyecto
  (`js/projectFiles.js`).
- **Rotación con el anillo azul de selección**: hacer click en la banda del
  anillo y arrastrar gira el objeto alrededor de su eje central (Y); el
  objeto sigue el movimiento del mouse (`js/gizmo.js`).
  *(Ajuste posterior: el anillo azul ya NO rota — quedó solo para mover la
  figura; la rotación es exclusiva de los anillos del gizmo.)*
- **Anillos de rotación por eje**: doble click en una flecha del gizmo
  (X/Y/Z) muestra un anillo de rotación orientado según ese eje; arrastrar
  sobre el anillo gira la pieza en ese eje. Doble click de nuevo (o en otra
  flecha) lo oculta/cambia.
- **Movimiento libre por el aire**: mantener presionado el círculo interior
  del anillo de selección y arrastrar mueve la pieza libremente en un plano
  perpendicular a la cámara (X, Y y Z a la vez, útil para levantar objetos);
  al soltar queda donde se dejó. Igual que los demás movimientos, no baja
  del piso (Y >= 0).
- Verificado: la app carga sin errores tras los cambios.

### Edición de tomas, scrub y guardar/abrir escenas
- **Scrub en la línea de tiempo**: click en la regla de segundos (o en el
  fondo de la pista) mueve el playhead a ese punto exacto; el reloj muestra
  la posición. Independiente de la reproducción (`js/timeline.js`).
- **Preview de cámara al editar una toma**: elegir la vista o el personaje en
  el editor de tomas aplica esa cámara de inmediato (si no se está
  reproduciendo).
- **"Vista Libre" en las tomas** (antes "Aérea" en la timeline): la cámara
  queda exactamente donde el usuario la dejó al momento del corte — se
  posiciona la cámara en órbita y la escena se ve desde ahí (`cutCameraToShot`
  en `js/cinematics.js`). El botón 🚁 Aérea manual del panel se mantiene.
- **Menú Archivo funcional** (antes decorativo) con **Abrir…**, **Guardar
  como…** y **Guardar** (bloqueado hasta que exista un archivo guardado):
  nuevo módulo `js/projectFiles.js`. La escena completa se serializa a JSON
  (posiciones, rotaciones y acciones de todos los objetos, recorridos con
  eventos de waypoint, tomas de la timeline y ambiente) y se descarga como
  archivo; Abrir restaura todo.
- Verificado en navegador: menú, scrub, selección de tomas y editor OK.

### Rediseño de la oficina y posiciones
- **Oficinas de esquina más chicas**: tabiques interiores movidos a |x| ≥ 4.5
  y |z| ≥ 4.5, dejando un espacio central abierto mucho más grande (~9×8 m)
  (`js/office.js`).
- **Mobiliario nuevo en el espacio central**: 2 escritorios extra con sillas
  (lado oeste), área de descanso con 2 sillones y mesita de centro (lado
  este), alfombra central, 3 plantas de interior, 2 archiveros y una
  fotocopiadora. Todos seleccionables y con colisión.
- **Posiciones iniciales de los personajes repartidas**: Alex en el espacio
  central, Carlos en la oficina de gerencia (SO), Elena en la sala de juntas
  (NE), perro y gato en el espacio central (`js/characters.js`).
- **Fix sillas invertidas**: las 6 sillas de la sala de juntas y la del
  puesto IT miraban hacia afuera de la mesa; ahora miran hacia la mesa por
  defecto (`js/office.js`).
- **Cámara 1ª persona de mascotas**: antes a altura humana (1.65 m); ahora
  0.65 m, cerca del piso (`js/cinematics.js`).

### Secuenciador de escenas (línea de tiempo de tomas)
- **Nuevo módulo `js/timeline.js`**: línea de tiempo global de tomas de cámara
  para componer la escena completa y grabarla como un único clip:
  - Tomas (bloques arrastrables) sobre una franja bajo el viewport con regla
    en segundos y playhead. Arrastrar el bloque lo mueve; arrastrar sus
    bordes cambia inicio/duración. Click en una toma la edita (cámara,
    personaje, inicio, duración, duplicar, borrar).
  - Modos de cámara por toma: Aérea (nueva, vista alta del centro de la
    escena), 1ª Persona, 3ª Persona, Perseguir, Cine 1-3.
  - "▶ Reproducir Escena": reinicia todos los recorridos (sin bucle) y aplica
    los cortes de cámara en tiempo real. "⏺ Grabar Escena": reproduce y graba
    la escena completa en un único WebM. "⏹ Detener" interrumpe.
- **Eventos de waypoint** (acción + espera): doble click en un punto del
  recorrido en modo edición abre un panel para definir que al llegar a ese
  punto el personaje cambie de acción (ej. hablar) y espere N segundos antes
  de seguir caminando (`cinema.events` en `state.js`, aplicado en el loop de
  `render.js`). Permite la escena de conversación: ambos personajes llegan a
  su punto, hablan un rato y siguen.
- `cinematics.js`: cámara generalizada con sujeto propio por vista
  (`view.subjectId`, la timeline puede seguir a cualquier personaje sin
  cambiar la selección), modo `aerial`, cortes instantáneos
  (`cutCameraToShot`), `startPlayback` acepta opciones (`loop`, `speed`) y
  calcula la posición u de los eventos; exportadas `startPlayback`/
  `stopPlayback`.
- `recorder.js`: `startRecording` acepta duración por código (para grabar
  exactamente la duración de la escena).
- UI: botón "🚁 Aérea" en las vistas de cámara, sección `#scene-timeline` y
  panel `#waypointEventPanel` en `index.html`; estilos en `style.css`.
- Verificado en navegador: carga sin errores, alta/edición de tomas y
  mensajes de guardia funcionan.

### Velocidad de recorrido constante
- La velocidad de reproducción siempre fue constante en m/s (la duración crece
  con el largo del recorrido), pero las piernas animaban a cadencia fija y a
  velocidades altas las zancadas no coincidían (parecía correr/patinar).
  Ahora la cadencia de caminar/correr se sincroniza con la velocidad real del
  slider: por debajo de ~3.5 m/s camina, por encima corre, y el ritmo de las
  zancadas se ajusta en humanos, perro y gato (`rig.cadence` en
  `js/characters.js`, configurado en `startPlayback` en `js/cinematics.js`).

### Colisiones y pisada correcta
- **Fix pies bajo el piso**: los humanos tenían los pies 14cm por debajo del
  piso y el perro 2cm (los rigs se construyeron apoyando en un suelo que ya no
  tiene altura). Corregido elevando el grupo interno de cada rig
  (`js/characters.js`). El gato ya apoyaba correctamente.
- **Nuevo sistema de colisiones** (`js/collision.js`, integrado al loop en
  `js/render.js`): cada objeto se aproxima por un círculo en el plano del
  suelo. Los personajes (humanos/mascotas) ya no atraviesan mobiliario,
  equipos ni otros personajes. Se permite un solapamiento parcial (75% de la
  suma de radios) para que puedan pasar uno al lado del otro rozándose.
  Los objetos estáticos no se mueven: solo se empuja al personaje. Los
  personajes sentados o acostados no se empujan (colocación intencional junto
  a escritorios/sillas). También se limita Y >= 0 para no atravesar el piso.

### UX de cinemática
- **Fix bug de inserción cerca del punto final**: al hacer clic muy cerca del
  punto rojo (final), el punto nuevo se insertaba después de él — el nuevo
  pasaba a ser el "rojo" y el original quedaba como amarillo en el lugar del
  rojo. Ahora los puntos intermedios nunca se insertan después del final ni
  antes del inicio; los extremos solo se mueven arrastrándolos
  (`cinemaInsertWaypoint` en `js/cinematics.js`).
- **Reproducir disponible en cuanto hay camino**: el recorrido se guarda
  automáticamente al colocar el punto final (rojo) — y con cada edición
  posterior de puntos — por lo que el botón ▶ queda habilitado de inmediato
  sin necesidad de salir del modo edición (`cinemaRebuildVisuals` en
  `js/cinematics.js`).
- El botón 🎬 de cada personaje en la lista de recorridos ahora funciona como
  **toggle**: activa la cinemática y, si ya está activa para ese personaje, la
  desactiva guardando el recorrido (antes solo se podía salir con el botón
  "✖ Salir de Cinemática", que sigue existiendo). Cuando la cinemática está
  activa, el botón del personaje cambia a 🎥 con estilo resaltado (`js/cinematics.js`).
- Fix: al cambiar de personaje con la cinemática activa, ahora se guarda el
  recorrido del personaje anterior (antes se perdían las ediciones sin guardar)
  (`cinemaLoadTarget`).

## [2026-08-21] — Inicial

### Inicial
- Proyecto ya generado: MiniStudio 3D, editor web para crear videos con animaciones
  3D (Three.js, sin framework, sin build). Incluye: personajes procedurales
  (3 humanos + mascotas), 5 ambientes (oficina con sala de servidores, estudio,
  parque día/tarde/noche), props de redes (switch, router, PC, laptop), recorridos
  cinemáticos por waypoints, 7 vistas de cámara y grabación básica a WebM.

### Revisión del estado (GLM)
- Revisión completa del código. Hallazgos principales:
  - `app.js` (3.126 líneas) es código muerto del monolito original previo al
    refactor modular en `js/` — pendiente de eliminar.
  - Three.js duplicado en `vendor/` y `node_modules/` — solo se usa `vendor/`.
  - Bindings huérfanos en `js/ui.js` (`btnCinemaToggle`, `btnCinemaClear`,
    `btnCinemaPlay` ya no existen en el HTML).
  - Sin persistencia (recargar pierde todo), sin secuenciador de tomas,
    exportación solo WebM dependiente del viewport y de FPS estables.
  - Informe completo en `GLM.md`.

### Documentación
- Creado `GLM.md` — informe de revisión del proyecto.
- Creado `SKILL.md` — descripción del proyecto, tecnologías, estructura y reglas
  de trabajo (incluye la regla de registrar todo cambio en este changelog).
- Creado `CHANGELOG.md` — este archivo.
- Creados archivos puente para que las herramientas de IA carguen el contexto del
  proyecto automáticamente: `AGENTS.md`, `CLAUDE.md`, `.cursorrules`,
  `.windsurfrules` — todos dirigen a `SKILL.md` y a las reglas de trabajo.
