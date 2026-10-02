# 01 — Requisitos funcionales (RF)

Estado: mixto — cada RF indica el suyo. Plantilla en `plantilla_spec.md`.
Leyenda de estados: `verificado` (test automatizado) · `implementado` (existe,
sin test) · `borrador` (pendiente de aprobación).

## A. Proyecto y edición base

### RF-01 — Proyecto nuevo vacío
Estado: `verificado`
Debe abrir un escenario sin personajes ni objetos spawneados, con undo
reiniciado y `sessionDirty` en falso.
- [ ] `newProject()` deja registry sin personajes y el historial con un único snapshot
- [ ] Abrir un proyecto resetea el undo (el primer Ctrl+Z no "borra" la escena cargada)
- Test: `p7-test` "carga de proyecto vacío" + "undo: historial se resetea"
- CHANGELOG: 2026-08-27, 2026-09-23

### RF-02 — Guardar y abrir proyecto JSON
Estado: `verificado`
Serializa/ resta la escena completa (ver `03-formato-json.md`) con guardar
directo (File System Access) y respaldo por descarga.
- [ ] Round-trip: serializar → aplicar reproduce posiciones, acciones, tomas, subtítulos y spawns
- [ ] Si falla el guardado directo, cae a descarga con mensaje de estado
- Test: `p7-test` "serialización"; `03-formato-json.md` es la contracta
- CHANGELOG: 2026-08-21

### RF-03 — Undo/Redo (historial de escena)
Estado: `verificado`
Snapshots JSON con base write-through: toda edición con la aguja en t>0
guarda el estado base (`syncBasePose`) antes del push.
- [ ] Mover personaje con la aguja en t>0 se puede deshacer
- [ ] Las operaciones compuestas (wizard, discard de camino, cambio de modo de cámara) son UN solo paso
- Test: `p7-test` "undo con la aguja en t>0: base write-through"
- CHANGELOG: 2026-09-23

### RF-04 — Selección, gizmo y multiselección
Estado: `verificado`
Clic selecciona; Ctrl+clic agrupa; marquesina; gizmo XYZ con flechas dobles;
anillo de selección sigue al objetivo tras cualquier movimiento.
- [ ] El anillo se reposiciona ante cualquier cambio de posición (reproducción, scrub, undo, drop)
- [ ] Supr borra la selección múltiple completa
- Test: `p7-test` "multiselección", "anillo de selección"
- CHANGELOG: 2026-08-28

### RF-05 — Colisiones y ley de piso
Estado: `implementado`
Personajes no atraviesan mobiliario ni entre sí; nadie queda bajo su suelo
mínimo (pies apoyados según tipo: humano 0.17, perro 0.05, gato 0.02).
- [ ] Al soltar tras un arrastre se resuelve la posición al lado más cercano (`resolveDropAfterDrag`)
- Sin test automatizado aún — candidato a P1-3 extendido

## B. Personajes

### RF-10 — Creador de personajes
Estado: `verificado`
Modal con género/vestimenta/accesorios, cámara libre en la previa, persistencia
en el JSON (`characters[]`).
- [ ] Outfit y accesorios persisten tras guardar y reabrir
- [ ] 3 variantes de perro y 3 de gato
- Test: `p7-test` "creador: outfit + accesorios", "mascotas del creador"
- CHANGELOG: 2026-08-27

### RF-11 — Acciones y gestos one-shot
Estado: `verificado`
Catálogo de acciones (idle, talk, typing, sit…) + 6 gestos que se reproducen
una vez y vuelven a la acción base.
- [ ] Un gesto termina solo y restaura la acción anterior
- Test: `p7-test` "gestos de un disparo"
- CHANGELOG: 2026-08-28

### RF-12 — Lip-sync en talk/sit_talk
Estado: `verificado`
La boca abre/cierra mientras dura la acción de hablar.
- [ ] Durante un bloque `talk` la boca anima; fuera de él, no
- Test: `p7-test` "lip-sync", "evento SIN espera mantiene su acción"
- CHANGELOG: 2026-08-30

### RF-13 — Sentarse real (`sit_at`)
Estado: `verificado`
Elegir silla con ancla; el personaje camina, se sienta con animación y aplica
`rotY_silla + 180°` internamente.
- [ ] El personaje sentado no se para al cambiar de acción por evento
- Test: `p7-test` "sit_talk: hablando SENTADO", "sentarse en asiento (sit_at)"
- CHANGELOG: 2026-08-30

### RF-14 — Transiciones suaves entre acciones
Estado: `verificado`
Interpolación de pose de 0,3 s al cambiar de acción (nada "en seco").
- [ ] El cambio de acción interpola ~0,3 s sin pops
- Test: `p7-test` "transiciones suaves"
- CHANGELOG: 2026-09-08

### RF-15 — Orientación determinista
Estado: `verificado`
Convención: `rotY=0` mira al SUR (+z); para "que mire hacia X" usar SIEMPRE
`rotYToLookAt()` — prohibido `atan2` a mano (bug recurrente histórico).
- [ ] Test anti "dados vuelta" para la convención de orientación
- Test: `p7-test` "convención de orientación (blindaje anti dados vuelta)"
- SKILL.md regla 7

### RF-16 — Pose de bloque y base write-through
Estado: `verificado`
Cada bloque de la pista 🧍 guarda la pose (lugar + rotación) y la reproduce;
las ediciones de aguja escriben la base viva.
- [ ] Bloque reproduce su pose guardada; bloque expirado no pisa el caminar
- Test: `p7-test` "bloques guardan pose", "bloque expirado no desliza"


## C. Cinemática y línea de tiempo

### RF-20 — Recorridos por waypoints con eventos
Estado: `verificado`
Camino punto a punto con acciones y esperas por waypoint; al pasar por el
punto el personaje actúa y espera el tiempo indicado (con acción final
persistente).
- [ ] Un evento `wait` detiene al personaje el tiempo exacto; la acción final queda fija
- Test: `p7-test` "camino: ⧉ duplica waypoints + eventos"
- CHANGELOG: 2026-08-21

### RF-21 — Bloques de personaje (pista 🧍)
Estado: `verificado`
Bloques estáticos (acción/todo el tramo) y de desplazamiento (verde→rojo con
duración auto e interpolación en curva). El camino es editable (insertar/
arrastrar puntos con toggle).
- [ ] Duplicar un recorrido lo camina dos veces; la selección abraza el tramo visible
- Test: `p7-test` "bloques de desplazamiento", "camino por tramos", "extender bloque"
- CHANGELOG: 2026-08-28

### RF-22 — Tomas de cámara con corte (y dolly)
Estado: `verificado`
Tomas arrastrables en la timeline con sujeto, vista y encuadre por toma;
dolly interpola inicio→fin dentro de la toma (`camPosEnd`); el ✕ de la toma
hace commit de la cinemática activa.
- [ ] Reproducción con solo bloques (sin tomas) siempre funciona
- [ ] Toma frontal arranca alineada al bloque de habla de su sujeto
- Test: `p7-test` "dolly dentro de la toma", "✕ de la toma = commit", "reproducción con solo bloques", "Escena estática"
- CHANGELOG: 2026-08-21

### RF-23 — Imán de alineación (tlSnap)
Estado: `verificado`
Al arrastrar/estirar un bloque, sus bordes se pegan a ±8 px de bordes de
otras pistas (paso 0.1 s). Refs de tomas, bloques, subtítulos y quiz.
- [ ] Cerca del borde se alinea exacto; el bloque arrastrado no es referencia de sí mismo
- Test: `p7-test` "Imán de alineación" + "imán tlSnap: exclude propio"
- CHANGELOG: 2026-08-28

### RF-24 — Escala única de pista (tlScale)
Estado: `verificado`
Todas las pistas comparten los mismos píxeles-por-segundo y alinean el 0s
con el borde del panel: los bloques coinciden entre pistas.
- Test: `p7-test` "escala única de la timeline"

### RF-25 — Pista de subtítulos
Estado: `verificado`
Bloques de texto con tramo [start, end], seleccionables, duplicables,
restaurables y borrables desde la barra 🎬.
- Test: `p7-test` "barra de bloques" (sección subtítulos)
- Los subtítulos se renderizan en canvas WebGL y se graban en el video (ver RF-41)

### RF-26 — Pista de carteles de pregunta (quizTrack)
Estado: `verificado`
Carteles con pregunta, opciones, correcta, duración y tramo; sincronizables
con un clic (vale en pausa); reloj en el prop 3D.
- Test: `p7-test` "ojito quiz", "barra de bloques" (sección quiz)

### RF-27 — Ojitos de pista (visibilidad)
Estado: `verificado`
Cada pista tiene ojito: ocultar no borra. El scrub y la cámara respetan los
ojos tachados.
- [ ] Ocultar no borra (datos intactos); cámara libre fuerza órbita con ojito tachado
- Test: `p7-test` "ojitos de pistas", "ojito cámara", "Regla de segundos sticky"
- CHANGELOG: 2026-09-18

### RF-28 — Navegación automática A* en recorridos
Estado: `verificado`
Si un tramo atraviesa pared/objeto, se calcula desvío (grilla 0.5 m + A* +
suavizado por línea de vista) e inserta puntos intermedios. El punto final
siempre se respeta; sin solución se conserva el directo.
- [ ] Intermedios fuera del radio efectivo y con `y === planeY`
- Test: `p7-test` "navegación A*" (P1-3, 2026-10-01)
- CHANGELOG: 2026-10-01

### RF-29 — Asistente de escenas (wizard.js)
Estado: `implementado`
Diálogo a dos: posiciones enfrentadas en el área libre + tomas sugeridas;
entra al undo como un solo paso.
- Sin test automatizado aún

## D. Entornos y objetos

### RF-30 — Ambientes y switcher
Estado: `implementado`
5 ambientes (oficina, parque, terreno, casa del hacker, estudio) con
`setEnvironment()` y grupos excluyentes. La grilla de la timeline se deriva
del ambiente activo.
- CHANGELOG: 2026-08-28 (lounge, gerencia, categorías)

### RF-31 — Modo construcción
Estado: `verificado`
Añadir piso/pared/puerta/ventana con persistencia en `construction[]`;
resize por bordes con retiling de textura (baldosas, no estirado); puertas
con imán a pared y hueco; diseños de puerta (3) y ventana (3).
- Test: `p7-test` "Fase 3: resize por bordes", "Fase 4: puertas y ventanas", "Fase 5: diseños"
- CHANGELOG: 2026-09-08

### RF-32 — Catálogo de piezas
Estado: `verificado`
34+ piezas spawn/duplicar/borrar con persistencia en `spawned[]` y `rebuild`
por fábrica; IDs autogenerados (`desk_spawn1`).

## E. Exportación de video

### RF-40 — Grabación 1080p 60 fps (MP4 con respaldo WebM)
Estado: `verificado`
La escena completa se graba con cortes, a 1920×1080 60 fps fijos y offscreen
(`output.renderer`), independientes del tamaño de la ventana; selector de
formato (H.264 con respaldo VP9/VP8).
- Test: `p7-test` "exportación 1080p fija y contenedor MP4/WebM"
- CHANGELOG: 2026-09-18

### RF-41 — Subtítulos, overlays y quiz en el video
Estado: `implementado`
Los overlays (subtítulos, quiz) leen siempre `output.renderer`, así que salen
en la exportación aunque se vean sobre el viewport.
- Sin test automatizado de píxeles (verificación manual por grabación)

### RF-42 — Audio por escena (música + efectos)
Estado: `verificado`
Pistas con metadata siempre en snapshots (`audio[]`) y `data` embebido solo
al guardar (`audioData`); mezcla WebAudio → export combinado.
- Test: `p7-test` "audio por escena"
- Serialización en `03-formato-json.md`

### RF-43 — Reloj determinista de exportación
Estado: `verificado`
La simulación avanza por pasos fijos `SIM_STEP = 1/30 s` acumulados sobre el
reloj real (rate 0.25×–2×); tope anti-espiral de 4 pasos por frame.
- Test: `p7-test` "reloj fijo de exportación" (1 frame = 1 paso, drop, rate 2×, tope, pausa)

### RF-44 — Guardado directo de archivo
Estado: `implementado`
File System Access API (reutiliza el handle del archivo abierto) con respaldo
a descarga clásica si no está disponible.
- Mensajes de estado claros en cada rama (error → indicación al usuario)

## F. Interfaz del editor

### RF-50 — Vistas de cámara (9+)
Estado: `implementado`
Órbita, 1ª/3ª persona, persecución, frente/perfil, top, cine 1-3, aérea y
"📷 Cámara puesta"; toggle raro documentado (clicar vista activa → órbita).
- Test parcial: "ojito cámara" (scrub/órbita); GLM.md #6 documentado

### RF-51 — Outliner y panel de propiedades
Estado: `implementado`
Jerarquía completa con sliders de transformación sincronizados al objetivo;
vuelo suave al objetivo (`flyTo`).
- Test: "spawn en el centro de la vista" (usan `viewCenterGround`)

### RF-52 — Menú contextual de objetos
Estado: `implementado`
Acciones por clic derecho (acción base, sentarse con elección de silla,
eliminar); todas deshacibles con `pushHistory` antes de mutar.

### RF-53 — Barra de bloques de la timeline
Estado: `verificado`
Selección por pista (toma/bloque/subtítulo/quiz), barra 🎬↻⧉🗑✕📌 + pin rojo,
duplicar/restablecer/borrar por tipo.
- Test: `p7-test` "barra de bloques" (sección completa)

### RF-54 — Pantalla de arranque (boot)
Estado: `implementado`
Pop-up inicial: proyecto nuevo o abrir existente; el editor carga solo tras
elegir (`boot.js` → `main.js`).
- Proyecto nuevo arranca vacío (RF-01)

---

## G. Backlog (borradores — pendientes de aprobación)

Fuente: `mini3d_mejoras.md`. Al aprobarse pasan a su sección con criterio de
aceptación y RF numerado definitivo.

### RF-60 — Pizarra/pantalla con texto editable
Estado: `borrador`
Prop educativo con diagramas de red/texto editable (patrón canvas→texture de
subtítulos/quiz). Lo más pedido para clips de redes (GLM.md #9).

### RF-61 — Terminal en pantalla / screencast
Estado: `borrador`
Monitor con prompt + tipeo letra a letra + salida scrolleando, guionado en el
JSON (nmap, ssh…); mostrar en monitor 3D y/o quad media pantalla capturable.
Patrón texto→CanvasTexture ya existente.

### RF-62 — Poses keyframeables
Estado: `borrador`
Techo actoral restante: poses configurables por instante (hoy solo gestos
fijos + transiciones). Depende de: RF-11, RF-14.

### RF-63 — WebCodecs para la exportación
Estado: `borrador`
Bitrate/resolución a medida en la exportación (hoy 1080p60 fijo).
Depende de: RF-40.

### RF-64 — Navegador de escenas integrado
Estado: `borrador`
Panel "Escenas" que lista los JSON del directorio (vía `serve.py`) y los
carga con un clic (hoy: Archivo → Abrir).

### RF-65 — AI Director local (Ollama) — capstone
Estado: `borrador`
Módulo que arma escenas con lenguaje natural usando las herramientas del
editor como funciones (tool-calling), con plan JSON confirmable por el
usuario y cada paso por undo. Requiere vocabulario completo de edición
(catálogo, construcción, personajes, cinemáticas) — ver `mini3d_mejoras.md`
para el esquema de herramientas y mitigaciones.

- Test: `p7-test` (núcleo del archivo: catálogo, spawn, duplicar, escala/rotación, bug laptop)
- CHANGELOG: 2026-08-28

### RF-33 — Canaleta dibujada punto a punto
Estado: `verificado`
Click marca inicio, cada click agrega tramo ortogonal (sin diagonales) con
ghost; imán a la red resolviendo recta/esquina 90°/unión "T"; tramo como
objeto seleccionable y serializable (puntos en `spawnData`).
- Test: `p7-test` "canaleta dibujada", "pasamuros", "routing ortogonal"
- CHANGELOG: 2026-08-28

### RF-34 — Cámaras colocables con FOV
Estado: `verificado`
Prop 📷 con posición/orientación/FOV propios (20°–100°, en `spawnData.fov`);
la vista de toma "📷 Cámara puesta" la usa como encuadre.
- Test: `p7-test` "cámaras colocables"
- CHANGELOG: 2026-09-18

### RF-35 — Paquetes de datos por canaletas
Estado: `verificado`
Pulsos luminosos con estela recorren la red fija + dibujada; reconexión
automática al agregar/mover/borrar; la red es un grafo conexo (suben por
las bajadas).
- Test: `p7-test` "paquetes de datos", "grafo conexo"
- CHANGELOG: 2026-09-18

### RF-36 — Alarma de emergencia
Estado: `implementado`
Balizas rojas en toma (`alarm: true` en el shot): teñido pulsante de escena.
- Expuesto en tomas; usado en la escena de ejemplo

### RF-37 — Mini rack con puerta multi-instancia
Estado: `verificado`
Puerta interactiva por rack (registro en `group.js`, ticker anima todas;
`openDoor` de la toma las abre todas).
- Test: `p7-test` "mini rack (Lote 3b)"
- CHANGELOG: 2026-09-18
