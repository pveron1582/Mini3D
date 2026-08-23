# Changelog — MiniStudio 3D

Registro de cambios del proyecto. Formato: fecha + cambio. Las entradas más
recientes van arriba.

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
