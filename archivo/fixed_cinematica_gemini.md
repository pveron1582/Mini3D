# Diagnóstico y Plan de Solución: Cinemáticas Estáticas y Reunión del Jefe

**Fecha:** 2026-09-03  
**Archivo afectado:** `scenes/reunion_prioridades_jefe.json`  
**Módulos involucrados:** `js/cinema/timeline.js`, `js/cinema/cinematics.js`, `js/cinema/navigation.js`, `js/render.js`

---

## 1. Resumen Ejecutivo del Problema

En la escena `scenes/reunion_prioridades_jefe.json`, los personajes deben permanecer en posiciones fijas en la oficina del jefe:
- **Carlos (el jefe):** Sentado en su silla de gerencia (`execChair`), de espaldas a la pared norte y mirando hacia el frente de su escritorio (`rotY: 3.14159`, pose `sit`).
- **Alex y Elena:** De pie frente al escritorio mirando hacia el jefe (`rotY: -0.28` y `0.28`, pose `idle`).
- **Perro:** Sentado frente a la heladera en la cocina (`rotY: -1.57`, pose `sit`).

Al cargar el archivo JSON en el editor, todos aparecen en sus posiciones correctas. Sin embargo, al presionar **Play** para reproducir la cinemática:
1. Los personajes cambian inmediatamente de lugar y terminan en posiciones erráticas.
2. Se giran 90° hacia la pared lateral (Oeste) dándole la espalda o el perfil a la escena.
3. El jefe se levanta, camina o se sienta de forma defectuosa atravesando el asiento hacia el piso.

---

## 2. Diagnóstico Técnico Detallado (Causa Raíz)

### A. La limitación disparadora en `timeline.js`
En `js/cinema/timeline.js` (líneas 120-127):
```javascript
const playable = [];
cinemaPaths.forEach((stored, id) => {
  if (stored.waypoints && stored.waypoints.length >= 2) playable.push(id);
});
if (playable.length === 0) {
  setStatus('No hay recorridos configurados: marca al menos un camino para armar la escena.');
  return false;
}
```
`playScene()` **se niega a reproducir** si no hay al menos un recorrido cinemático con $\ge 2$ waypoints. Para saltar esta restricción y lograr que los personajes hablaran en momentos específicos (`events: { action: "talk", wait: ... }`), en el JSON se crearon **falsos recorridos con micro-desplazamientos de 4 centímetros**:
```json
"waypoints": [[-9.0, 0, 9.6], [-9.04, 0, 9.6], [-9.0, 0, 9.62], [-8.96, 0, 9.6], ...]
```

### B. El sistema A* de esquivado de obstáculos (`navigation.js` / `solvePath`)
En `js/cinema/cinematics.js:402`, al arrancar el playback se invoca:
```javascript
const solved = solvePath(waypoints, planeY);
```
`solvePath` consulta `collectObstacles()` en `js/cinema/navigation.js`. Como el escritorio gerencial (`execDesk`) y la silla (`execChair`) son objetos colisionables estáticos, los micro-waypoints caen dentro de su radio de colisión. El algoritmo A* interpreta que el personaje está **atascado dentro de un obstáculo** y calcula una ruta de escape rodeando el escritorio, insertando waypoints intermedios que hacen que los personajes salten a cualquier parte de la habitación.

### C. Rotación forzada por la tangente en cada frame (`render.js`)
En `js/render.js` (líneas 117-124):
```javascript
pos = inst.curve.getPointAt(cu);
tan = inst.curve.getTangentAt(cu);
obj.position.set(pos.x, inst.planeY, pos.z);
obj.rotation.y = Math.atan2(tan.x, tan.z);
```
El motor asume que todo recorrido es una caminata y orienta al personaje según la dirección del movimiento (`tan`). Al moverse de `[-9.0, 9.6]` a `[-9.04, 9.6]`, el vector apunta hacia $-X$ ($dx = -0.04, dz = 0$). `Math.atan2(-0.04, 0)` equivale a $-\pi/2$ ($-90^\circ$, **Oeste**).
* **Consecuencia:** En el instante de dar Play, tanto Carlos como Alex y Elena se giran 90° hacia la pared oeste, ignorando por completo el `rotY` asignado en el JSON.

### D. Pérdida de la altura de asiento (`planeY: 0`)
`render.js:123` aplica:
```javascript
obj.position.set(pos.x, inst.planeY, pos.z);
```
Como en el JSON se definió `"planeY": 0`, el jefe pierde su elevación sobre el asiento (`y = 0.06`, que surge de `seatY - 0.48 = 0.54 - 0.48`) y se hunde al nivel del piso ($y=0$), atravesando la base de la silla.

### E. Acción forzada a `walk`
En `js/cinema/cinematics.js:418-425`:
```javascript
moveAction = baseSpeed >= 3.5 ? 'run' : 'walk';
if (!(delay > 0)) {
  entry.rig.setAction(moveAction);
  entry.rig.cadence = cadence;
}
```
`startPlayback` pone al personaje inmediatamente en pose `'walk'`. Como en `human2` (el jefe) los eventos de waypoint empezaban en el índice `"1"` (se omitió el evento para el punto `"0"`), el jefe se para de la silla y camina en el aire antes de llegar al punto 1.

---

## 3. Coordenadas y Orientaciones Correctas de Referencia

Basado en la regla 7 de `SKILL.md` (un rig con `rotY = 0` mira al SUR `+z`, `rotY = π` mira al NORTE `-z`), las anclas de `js/office/lounge.js` y `js/characters/characters.js`:

1. **Carlos (Jefe) en Silla Gerencia:**
   - Objeto silla: `execChair` en `[-9.0, 0, 9.6]`, `rotY = 0`.
   - Ancla de asiento: `seat_execChair` con `seatY = 0.54`.
   - Posición exacta: `[-9.0, 0.06, 9.6]`
   - Rotación exacta: `3.14159` ($\pi$, mirando al Norte hacia el escritorio).
   - Acción inicial: `"sit"`

2. **Alex (Frente al escritorio, lado este):**
   - Posición: `[-8.3, 0, 7.2]`
   - Rotación: `-0.28` (mirando hacia el jefe/escritorio).
   - Acción inicial: `"idle"`

3. **Elena (Frente al escritorio, lado oeste):**
   - Posición: `[-9.7, 0, 7.2]`
   - Rotación: `0.28` (mirando hacia el jefe/escritorio).
   - Acción inicial: `"idle"`

4. **Perro (Cocina, frente a la heladera):**
   - Posición: `[5.85, 0, 7.1]`
   - Rotación: `-1.57` ($-\pi/2$, mirando hacia la heladera).
   - Acción inicial: `"sit"`

---

## 4. Plan de Solución

### Paso 1: Mejoras en el Motor
1. **Permitir reproducir escenas sin recorridos de movimiento:**
   En `js/cinema/timeline.js`: Si `playable.length === 0` pero existen tomas (`timeline.shots.length > 0`), permitir que `playScene()` se ejecute con normalidad para controlar cámaras, subtítulos, audio y carteles.
2. **Detección y soporte de personajes estáticos:**
   En `js/cinema/cinematics.js` y `js/render.js`:
   - Si un recorrido tiene waypoints estacionarios (distancia total $< 0.2$ m o `speed === 0`):
     - **No invocar `solvePath`** (evita la evasión A* con muebles).
     - **No forzar la acción `walk`** en `startPlayback`.
     - **No sobreescribir `rotation.y`** con la tangente de la curva.
     - **No sobreescribir `position.y`** con `0` si el personaje está en una silla (`seatPose` o `pos.y > 0`).

### Paso 2: Corrección en `scenes/reunion_prioridades_jefe.json`
- Corregir el objeto `paths` para que los personajes que no se desplazan no generen oscilaciones de spline ni tangentes anómalas.
- Asignar el ancla de asiento `seat_execChair` para Carlos o asegurar que el evento 0 mantenga la pose `sit` a altura real.
- Sincronizar los eventos de habla (`talk` / `idle` / `sit`) respetando la orientación fija de cada participante.

### Paso 3: Verificación
- Ejecutar la suite de tests del proyecto: `npm run verify`.
- Probar la carga y reproducción de `reunion_prioridades_jefe.json` verificando que al dar Play:
  - Ningún personaje se teletransporte ni cambie de posición.
  - El jefe permanezca sentado mirando al frente.
  - Alex y Elena permanezcan de pie frente al escritorio mirando al jefe.
  - El lip-sync se active en cada parlamento según los subtítulos.
