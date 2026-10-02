# ADR-0004 — Renderer de salida offscreen 1080p fijo

Estado: aceptado | Fecha: 2026-10-01 (implementado 2026-09-18)
Relacionado: `js/core.js` (`output.renderer`), `js/media/recorder.js`, RF-40, RF-41, RNF-06

## Contexto
Antes, el video se grababa desde el canvas de la ventana: la resolución del
video dependía del tamaño del viewport del editor y exportar tocaba el canvas
de edición.

## Decisión
- Existe `output.renderer`: normalmente es el renderer de la ventana; durante
  la exportación apunta a un **renderer offscreen propio de 1920×1080**
  (creado en la primera exportación y reutilizado después).
- Los overlays (subtítulos, quiz) y el loop de render leen SIEMPRE
  `output.renderer`, nunca `renderer` directamente — así salen en el video.
- Simulación por pasos fijos `SIM_STEP` (1/30 s); el dt real solo decide
  cuántos pasos tocan por frame.

## Consecuencias
- Pros: video 1080p60 fijo e independiente de la ventana; exportación
  determinista (misma trayectoria en cada exportación).
- Contras: segundo contexto WebGL durante la exportación (costo temporal);
  quien no exporta no lo paga.
