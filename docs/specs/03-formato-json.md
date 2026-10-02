# 03 — Formato de archivo de proyecto (JSON)

Estado: `aprobado` (documentado desde el código real, 2026-10-01)
Fuente de verdad del código: `serializeProject()` / `applyProject()` en
`js/projectFiles.js`. **Este documento describe lo que el código DEBE
garantizar; si el código y este doc difieren, es bug de uno de los dos.**

## Reglas generales

1. `app` es siempre `"MiniStudio 3D"` (firma del formato).
2. `version` es entero; hoy es `1`. Cambios **incompatibles** suben la
   versión y `applyProject` debe migrar proyectos viejos (ej. la migración
   actual: `charBlocks` generados desde `paths[].events` de proyectos sin
   pista de personajes; compatibilidad de `shot.quiz` → `quizzes[]`).
3. Todo número se redondea a 2 decimales (`round2`) al serializar.
4. Campos opcionales se **omiten** (no van `undefined`/`null`) para mantener
   el JSON limpio: si el valor es por defecto, la clave no aparece.
5. Las claves de `objects`/`spawned[].id`/`characters[].id` son IDs únicos
   estables (los personajes por defecto: `human1..3`, `dog`, `cat`; los
   spawneados: autogenerados, ej. `desk_spawn1`).

## Esquema (versión 1)

```jsonc
{
  "app": "MiniStudio 3D",
  "version": 1,
  "env": "office",              // ambiente activo: office | park | terrain | hacker | studio
  "floorTex": "alfombra",       // textura del piso del ambiente
  "description": "…",           // texto libre de la escena (presente en las escenas
                                //  de ejemplo; serializeProject NO lo emite aún —
                                //  si se agrega, debe documentarse aquí primero)

  "objects": {                  // todos los objetos del registry (personajes, piezas fijas)
    "human1": {
      "pos": [x, y, z],         // posición redondeada a 2 decimales
      "rotY": 0.0,              // radianes; convención: 0 mira al SUR (+z)
      "scale": 1.0,             // solo si ≠ 1
      "action": "idle",         // acción base actual (rigs)
      "wall": { "w": 2, "h": 3, "d": 0.1, "tex": "ladrillo" },  // solo piezas de pared
      "deleted": true           // soft-delete (borrado lógico)
    }
  },

  "spawned": [                  // piezas del catálogo (P7) — solo si hay ≥1
    { "catalog": "desk", "id": "desk_spawn1", "name": "Escritorio",
      "pos": [x, y, z], "rotY": 0, "scale": 1,
      "data": { }               // spawnData paramétrico (p.ej. puntos de canaleta dibujada, fov de 📷)
    }
  ],
  "hideDefaultCharacters": true,      // solo si los personajes por defecto están ocultos
  "characters": [               // personajes custom del creador — solo si hay ≥1
    { "id": "p_ana", "name": "Ana", "pos": [x,y,z], "rotY": 0,
      "colors": { },            // piel/ropa/zapatos/peinado según characterCreator
      "kind": "human",          // human | pet
      "pet": { }                // variantes de perro/gato (solo kind=pet)
    }
  ],
  "windows": [                  // ventanas agregadas desde el panel de edificio
    { "id": "win1", "name": "Ventana", "pos": [x,y,z], "rotY": 0, "w": 1.2, "h": 1.2, "design": "panoramica" }
  ],
  "construction": [ /* pisos/paredes/puertas de js/construction.js — ver serializeConstruction() */ ],

  "paths": {                    // recorridos (cinemática) por id de objeto
    "human1": {
      "waypoints": [[x, y, z], …],   // ≥2 para recorrer
      "planeY": 0,
      "events": { "1": { "action": "talk", "wait": 2 } },  // por índice de waypoint
      "loop": true,             // solo si true
      "delay": 0, "speed": 2    // solo si ≠ default
    }
  },

  "charBlocks": [               // pista 🧍 PERSONAJES: bloques de acción
    { "id": "cb_alex_1", "start": 0, "duration": 9.4,
      "actions": { "human1": { "action": "talk" } } }    // acción + ánimo (mood) opcional
  ],
  "charFullRange": {            // acción de TODA la escena por personaje
    "dog": { "action": "sit", "mood": null }
  },

  "audio": [ /* metadata de pistas (música/efectos): nombre, tipo, tramos */ ],
  "audioData": { },             // dataURLs embebidos — SOLO al guardar archivo, NUNCA en snapshots de undo

  "subtitles": [ { "start": 0.4, "end": 4.2, "text": "…" } ],
  "quizzes": [                  // carteles de pregunta (pista 📋)
    { "id": "q1", "question": "¿…?", "options": ["A","B"], "correct": 0,
      "duration": 10, "start": 5, "end": 15 }
  ],
  "laneVis": {                  // ojitos de pistas — solo lo no predeterminado
    "chars": ["dog"],           // personajes ocultos
    "camera": false, "subs": false, "quiz": false
  },

  "timeline": {
    "time": 0,                  // posición de la aguja
    "shots": [
      { "start": 0, "duration": 4.6,
        "camMode": "front",     // libre | fpv | third | top | cine1..3 | aerial | sceneCam | front | …
        "subjectId": "human1",  // sujeto de la toma (si aplica)
        "camPos": [x,y,z], "target": [x,y,z],       // toma fija (encuadre guardado)
        "camPosEnd": [x,y,z], "targetEnd": [x,y,z], // dolly inicio→fin
        "openDoor": true,       // abre puertas de mini rack en la toma
        "alarm": true           // balizas de alarma durante la toma
      }
    ]
  }
}
```

## Compatibilidad obligatoria

- **Proyectos viejos abren siempre**: campos faltantes → defaults.
- **Migraciones documentadas** en `applyProject` con comentario que apunte
  a este archivo (ej. `charBlocks` desde `paths[].events`).
- Toda pieza del catálogo que agregue `spawnData` nuevo debe documentar su
  forma aquí (`spawned[].data`).
- `scenes/*.json` de ejemplo deben pasar `applyProject` sin errores —
  cubierto por `p7-test` (flujo proyecto vacío + escenas de referencia).
