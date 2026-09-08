# Diagnóstico y Plan de Mejoras: Altura del Suelo, Ley de Piso Sólido y Corrección de Asientos

**Fecha:** 2026-09-05  
**Proyecto:** MiniStudio 3D  
**Archivos involucrados:**  
- `js/characters/characters.js`  
- `js/office/lounge.js`  
- `js/office/furniture.js`  
- `js/projectFiles.js`  
- `js/collision.js`  
- `js/cinema/cinematics.js`  
- `js/ui/gizmo.js`  
- `js/ui/ui.js`  
- `scenes/*.json` (ej. `el_ransomware_del_jefe.json`, `reunion_prioridades_jefe.json`)

---

## 1. Diagnóstico del Problema de Fondo

### A. ¿Dónde está el piso en el sistema de coordenadas?
En el motor 3D, el piso físico y estructural está modelado como un plano horizontal en:
$$\mathbf{Y = 0}$$
- **Oficina:** `floor.position.y = 0` (`js/office/floor.js`).
- **Terreno / Parque:** `ground.position.y = 0` (`js/terrain.js`).
- **Alfombras:** Capas visualmente delgadas situadas ligeramente por encima para evitar *z-fighting* (parpadeo visual):
  - Alfombra central: $Y = 0.012$
  - Alfombra de gerencia (jefe): $Y = 0.022$
  - Baldosa de construcción: $Y = 0.020$

El piso **no tiene una altura fantasma ni está elevado**. El suelo de referencia es $Y = 0$.

---

### B. Causa Raíz 1: El desfase de origen (pivote) en los modelos 3D

En Three.js, la propiedad `position` de un `THREE.Group` mueve el punto de pivote $(0,0,0)$ de ese grupo.

1. **Humanoides (`createHumanoidModel` en `characters.js`):**
   - El pivote del rig humanoide no está en la suela del calzado, sino a la altura de los tobillos.
   - Las piernas y los zapatos se extienden hacia abajo hasta **$Y = -0.17\text{ m}$** relativo al origen local.
   - **Consecuencia:** Para que las suelas de los zapatos queden apoyadas exactamente sobre el piso ($Y = 0$), el grupo debe colocarse en:
     $$\mathbf{Y = 0.17\text{ m}} \quad (\text{definido en el rig como } \texttt{groundY: 0.17})$$
   - Si a un personaje se le asigna $Y = 0$, sus pies y tobillos quedan **enterrados 17 cm bajo el suelo**.

2. **Mascotas:**
   - **Perro (`dog`):** Sus patas terminan en $Y = -0.05\text{ m}$ respecto a su pivote (`groundY: 0.05`). Si se pone en $Y = 0$, se le hunden 5 cm las patas.
   - **Gato (`cat`):** Sus patitas terminan en $Y = -0.02\text{ m}$ respecto a su pivote (`groundY: 0.02`). En $Y = 0$, se hunden 2 cm.

3. **Mobiliario y Objetos:**
   - La mayoría del mobiliario estándar (mesas, armarios, copiadoras) tiene su base modelada en su pivote local $Y = 0$.
   - Sin embargo, al colocarse sobre alfombras ($Y = 0.012$ a $0.022$) o losas de construcción ($Y = 0.02$), su base matemática queda $1.2\text{ a }2.2\text{ cm}$ por debajo de la superficie visible, pudiendo generar solapamiento o z-fighting.

---

### C. Causa Raíz 2: El caso del Jefe sentado en su silla de gerencia

El caso del jefe enterrado en su sillón es el resultado de la acumulación de tres discrepancias matemáticas:

1. **La cinemática de sentarse asume una altura genérica de 48 cm:**
   En `characters.js` (acciones `sit`, `sit_typing`, `sit_talk`):
   ```javascript
   const seatH = 0.48;
   parts.h_legL.position.set(-0.16, seatH, 0);
   parts.h_legR.position.set(0.16, seatH, 0);
   parts.h_torso.position.y = seatH + 0.38;
   ```
   La pose flexiona las rodillas a $0.48\text{ m}$ por encima del origen del rig.

2. **La silla de gerencia (`execChair`) es mucho más alta que una silla estándar:**
   En `js/office/lounge.js`:
   - El asiento de madera (`ecSeat`) está en $Y = 0.54\text{ m}$ (grosor 0.14 $\rightarrow$ tope superior en $Y = 0.61$).
   - Encima tiene un almohadón de cuero (`ecCush`) centrado en $Y = 0.62\text{ m}$ (grosor 0.06 $\rightarrow$ **superficie superior de apoyo en $Y = 0.65\text{ m}$**).
   - Sin embargo, el ancla de la silla se configuró incorrectamente como:
     ```javascript
     g.userData.seatY = 0.54; // ¡Ignoró los 11 cm del almohadón!
     ```

3. **Los JSON de escenas guardan al jefe con $Y = 0$ o mal compensado:**
   - En `scenes/el_ransomware_del_jefe.json`:
     ```json
     "human2": { "pos": [-9.0, 0, 9.2], "rotY": 3.14, "action": "sit_typing" }
     ```
     - Altura del grupo del jefe: $Y = 0$
     - Altura de sus muslos/glúteos en el mundo: $0 + 0.48 = \mathbf{0.48\text{ m}}$
     - Altura de la superficie del almohadón: $\mathbf{0.65\text{ m}}$
     - **Resultado:** ¡El jefe queda **17 cm hundido** dentro del almohadón y la estructura de la silla!
     - Además, la silla está en $Z = 9.6$, pero el jefe se guardó en $Z = 9.2$ (desfasado 40 cm hacia el borde delantero).

---

### D. Causa Raíz 3: Fugas en la "Ley del Piso" existente

Ya existía en el código la intención de mantener a los personajes sobre el piso (`applyFloorLaw` y `resolveCollisions`), pero tiene las siguientes fallas:

1. **`applyProject` (Carga de archivos JSON):**
   En `js/projectFiles.js`:
   ```javascript
   entry.group.position.set(o.pos[0], o.pos[1], o.pos[2]);
   ```
   Aplica directamente el vector del archivo JSON sin normalizar contra `groundY`. Si el archivo dice $Y=0$, el personaje se renderiza enterrado hasta que se inicia la cinemática o se mueve manualmente.

2. **Excepción ciega para personajes sentados o acostados:**
   En `collision.js`, `gizmo.js`, `cinematics.js` y `ui.js`:
   ```javascript
   const seated = act.startsWith('sit') || act === 'lay';
   const minY = entry.rig.groundY && !seated ? entry.rig.groundY : 0;
   ```
   Al detectar que el personaje está sentado (`seated === true`), desactiva el mínimo y permite $Y = 0$. Como no calcula la altura de la silla debajo, el personaje cae al nivel del piso ($Y=0$) y atraviesa el asiento.

---

## 2. Plan de Solución Integral

### Paso 1: Establecer la Regla de Suelo Sólido Universal

Crear una función centralizada de validación de nivel de suelo (`getMinGroundY(entry, x, z)`) que calcule el piso mínimo garantizado para cualquier entidad:
- Si es un humano de pie: $Y \ge 0.17$.
- Si es un perro de pie: $Y \ge 0.05$.
- Si es un gato de pie: $Y \ge 0.02$.
- Si hay una losa de construcción o alfombra debajo: sumar el offset correspondiente ($+0.02$).
- Si es mobiliario u objeto general: $Y \ge 0$.

Aplicar esta validación en:
- `applyProject` (`js/projectFiles.js`): Al abrir cualquier escena, ningún personaje ni objeto puede quedar por debajo de su suelo mínimo.
- `addHumanCharacter` y `characterCreator.js`: Todo personaje nuevo nace apoyado en el suelo.
- `applySlidersToTarget` (`js/ui/ui.js`) y `gizmo.js`: Durante la manipulación en el editor.

---

### Paso 2: Corrección de Alturas de Asiento (`seatY`) y Física de Sentado

1. **Corregir las anclas de mobiliario en `lounge.js` y `furniture.js`:**
   - **Silla de Gerencia (`execChair`):**
     `g.userData.seatY = 0.65;` (superficie real superior del almohadón).
   - **Silla de Invitado (`guestChair`):**
     `g.userData.seatY = 0.54;` (superficie del asiento en $0.5 + 0.04$).
   - **Chesterfield / Sillones:**
     `g.userData.seatY = 0.53;` (superficie del cojín).
   - **Silla estándar de comedor / oficina (`chair`):**
     `chair.userData.seatY = 0.52;` (superficie del asiento en $0.48 + 0.04$).

2. **Cálculo exacto para personajes sentados:**
   La fórmula física de elevación para sentarse sobre un asiento de altura $seatY$ es:
   $$Y_{\text{personaje}} = seatY - 0.48$$
   - En la silla del jefe: $Y = 0.65 - 0.48 = \mathbf{0.17\text{ m}}$.
   - Con $Y = 0.17$, los muslos del jefe quedan en $0.17 + 0.48 = \mathbf{0.65\text{ m}}$, posados con exactitud milimétrica sobre la parte superior del almohadón.

3. **Protección para personajes sentados sin ancla:**
   Si un personaje está en pose `sit` o `sit_typing` pero no está vinculado a una silla específica, su piso mínimo no debe ser $0$, sino al menos $Y = 0$ (o $0.17$ si se desea evitar que los pies atraviesen el piso si no hay banqueta).

---

### Paso 3: Corrección en Archivos de Escenas JSON

Actualizar las escenas predeterminadas para corregir las coordenadas del jefe y evitar desfasajes:
- En `scenes/el_ransomware_del_jefe.json`:
  ```json
  "human2": {
    "pos": [-9.0, 0.17, 9.6],
    "rotY": 3.14159,
    "action": "sit_typing"
  }
  ```
  *(Posición $Z=9.6$ alineada con el centro de la silla `execChair`, y $Y=0.17$ apoyado sobre el almohadón).*

- En `scenes/reunion_prioridades_jefe.json`:
  Actualizar `pos` y waypoints del jefe de $Y=0.06$ a $Y=0.17$.

---

## 3. Matriz de Coordenadas de Referencia

| Entidad | Tipo | Origen Rig / Base | Altura de Apoyo en Suelo ($Y$) | Contacto Real con Piso |
| :--- | :--- | :--- | :--- | :--- |
| **Humano (Alex, Elena, Carlos de pie)** | Personaje | Tobillos ($-0.17$) | **$0.17\text{ m}$** | Suela en $Y = 0.00$ |
| **Carlos (Jefe sentado en Silla Gerencia)** | Personaje | Tobillos ($-0.17$) | **$0.17\text{ m}$** | Muslos en $Y = 0.65$ (sobre almohadón) |
| **Perro** | Mascota | Patas ($-0.05$) | **$0.05\text{ m}$** | Puntas de patas en $Y = 0.00$ |
| **Gato** | Mascota | Patas ($-0.02$) | **$0.02\text{ m}$** | Almohadillas en $Y = 0.00$ |
| **Escritorio Gerencia (`execDesk`)** | Mueble | Base patas | **$0.00\text{ m}$** | Apoya en suelo plano |
| **Silla Gerencia (`execChair`)** | Mueble | Ruedas base | **$0.00\text{ m}$** | Ruedas apoyan en suelo plano |
| **Laptop / Torre sobre escritorio** | Prop / IT | Base equipo | **$0.78\text{ m}$** | Tapa del escritorio |

---

## 4. Plan de Verificación

1. **Pruebas automáticas (`tools/p7-test.mjs`):**
   - Verificar que `alex.group.position.y >= 0.17`.
   - Verificar que `boss` sentado en `execChair` mantenga $Y \approx 0.17$.
   - Verificar que las anclas de `execChair`, `guestChair`, `chair` y `chesterfield` retornen sus alturas de almohadón correctas.
2. **Pruebas en el navegador:**
   - Cargar `el_ransomware_del_jefe.json` y constatar visualmente que el jefe está sentado perfectamente sobre el almohadón de cuero y que Alex, Elena, el perro y el gato no tienen los pies hundidos en la alfombra ni el suelo.
   - En el creador de personajes, crear un nuevo humano y verificar que al insertarlo caiga apoyado en sus pies sin enterrarse.
