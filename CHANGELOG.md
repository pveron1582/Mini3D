# Changelog — MiniStudio 3D

Registro de cambios del proyecto. Formato: fecha + cambio. Las entradas más
recientes van arriba.
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
