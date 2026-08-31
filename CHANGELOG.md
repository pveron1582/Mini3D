# Changelog — MiniStudio 3D

# Changelog — MiniStudio 3D

Registro de cambios del proyecto. Formato: fecha + cambio. Las entradas más
recientes van arriba.

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
