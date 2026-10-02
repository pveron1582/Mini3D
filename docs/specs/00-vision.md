# 00 — Visión del producto

Estado: aprobado (derivado de README.md y SKILL.md, existentes desde el inicio)
Fuentes: `README.md`, `SKILL.md`, `GLM.md` — ante conflicto, manda este documento.

## Qué es MiniStudio 3D

Estudio de video con animaciones 3D para generar clips cortos, orientado al
contenido educativo de **redes y ciberseguridad para YouTube**: situaciones con
personajes 3D desde diferentes ángulos, con toques de comedia.

No pretende reemplazar a Blender: es una **alternativa directa y ligera** para
producir escenas 3D con estilo propio, bajo consumo de sistema y curva de
trabajo simple.

## Filosofía (restricciones de diseño, no sugerencias)

1. **Estilo Blender pero ligero**: outliner, gizmos, vistas de cámara, panel
   de propiedades — pero mucho más simple.
2. **Pocos recursos de PC**: sin framework, sin build, sin dependencias
   pesadas; debe correr fluido en máquinas modestas.
3. **La mejor calidad posible dentro de esa restricción**: render cuidado,
   animaciones procedurales limpias, estilo low-poly/blocky consistente.
4. **UI y documentación en español** (comentarios y nombres descriptivos).

## Usuario y caso de uso principal

- Creador individual de contenido educativo (no experto en 3D).
- Flujo real: montar una escena de oficina/sala de servidores → escribir el
  diálogo en subtítulos → sincronizar acciones de personajes en la línea de
  tiempo → componer tomas → exportar un clip de ~30-60 s en MP4 1080p.

## Alcance actual (qué SÍ es el producto hoy)

- Editor 3D con 5 ambientes (oficina, parque, terreno de construcción,
  casa del hacker, estudio).
- Personajes procedurales (humanos + mascotas) con acciones, gestos,
  lip-sync y sentarse en anclas.
- Línea de tiempo multi-pista: tomas de cámara, bloques de personaje,
  subtítulos, carteles de quiz; imán de alineación; escala única.
- Guardar/cargar proyectos JSON; undo/redo.
- Exportación de video 1080p 60 fps (MP4 H.264 con respaldo WebM), audio
  mezclado, subtítulos embebidos.

## Fuera de alcance (por ahora)

- Reemplazar a Blender o un pipeline profesional de 3D.
- Modelado de mallas (todo es procedural/primitivas).
- Ejecución real de comandos en las pantallas (los "screencasts" serán
  guionados, ver RF borradores).
- Multiusuario, nube, cuentas.

## Criterio de éxito del producto

Un clip educativo completo (escena → diálogo → tomas → export) se produce en
una sola sesión de trabajo sin salir del editor, en una PC modesta.
