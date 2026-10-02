# 04 — Flujos de usuario (caso de uso principal)

Estado: `aprobado` (describen lo que el editor ya permite, 2026-10-01)
RFs involucrados: ver `01-requisitos.md`.

## F1 — Producir un clip educativo (flujo completo)

1. **Arranque**: popup de inicio → "proyecto nuevo" (RF-54, RF-01).
2. **Ambientar**: elegir ambiente (oficina por defecto); opcional: Modo
   Construcción para pisos/paredes propios (RF-30, RF-31).
3. **Poblar**: "➕ Añadir Personaje" (creador, RF-10) + piezas del catálogo
   (RF-32); ubicar con gizmo (RF-04). Nada flotando ni sockets huérfanos
   (SKILL.md regla 5).
4. **Escribir el diálogo**: bloques de subtítulos en la pista con los
   parlamentos (RF-25); opcional: carteles de quiz (RF-26).
5. **Actuar**: pista 🧍 con bloques de acción por personaje alineados a los
   subtítulos — el imán (RF-23) facilita "k habla cuando empieza su subtítulo";
   lip-sync automático en `talk` (RF-12); recorridos opcionales con
   eventos (RF-20), el A* resuelve desvíos (RF-28).
6. **Componer tomas**: Tomas en la timeline con sujeto/vista/encuadre,
   cortes alineados a los bloques (RF-22); dolly dentro de la toma si hace
   falta.
7. **Revisar**: Play de la escena con rate ajustable (RF-43).
8. **Exportar**: grabar → MP4 1080p60 offscreen con audio y subtítulos
   embebidos (RF-40, RF-41, RF-42) → archivo de video.
9. **Guardar** el proyecto JSON para retomarlo (RF-02).

- Criterio global: el flujo completo se hace sin salir del editor (visión).

## F2 — Retomar un proyecto guardado

1. Abrir (picker de archivo o handle recordado) → `applyProject` restaura
   escena, recorridos, bloques, tomas, subtítulos, quiz y spawns (RF-02).
2. El undo parte del estado cargado (RF-03): el primer Ctrl+Z no "borra" nada.
3. Editar → Guardar (directo o descarga) (RF-44).

## F3 — Armar una cinemática con recorridos

1. Seleccionar personaje → modo cinemática → marcar waypoints en el plano.
2. Ajustar eventos por waypoint (acción + espera, RF-20).
3. El A* inserta desvíos si el tramo cruza paredes/objetos (RF-28).
4. Previsualizar con recorridos múltiples simultáneos (`playbackInstances`);
   loop/velocidad por recorrido.

## F4 — Construir un ambiente desde cero

1. Arrancar en el terreno (Modo Construcción, RF-31).
2. Pisos → paredes (con imán y huecos) → puertas/ventanas con diseño.
3. Resize por bordes: la textura re-tilea, no se estira.
4. Amoblar con el catálogo (RF-32) y guardar (RF-02).
