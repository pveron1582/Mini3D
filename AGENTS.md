# MiniStudio 3D

Antes de trabajar en este proyecto, leer **`SKILL.md`**: describe de qué trata el
proyecto (estudio de video con animaciones 3D para generar clips educativos de
redes y ciberseguridad), las tecnologías usadas, la estructura del código y las
reglas de trabajo.

Puntos clave:

- Filosofía: estilo Blender pero ligero de recursos, sin framework, sin build,
  la mejor calidad posible dentro de esa restricción.
- La lógica vive en `js/*.js` (módulos con responsabilidades claras).
  `app.js` en la raíz es código muerto — no usarlo como referencia.
- Three.js se carga desde `vendor/` (única copia en uso).
- **Obligatorio**: luego de generar cualquier cambio, registrar una entrada en
  `CHANGELOG.md` (fecha + qué se hizo). Informe de estado del proyecto: `GLM.md`.
- **Spec-first (regla 8 de `SKILL.md`)**: `docs/specs/` es la fuente de verdad
  de QUÉ se construye. Todo cambio de producto empieza creando/editando el RF
  ahí (formato en `plantilla_spec.md`); sin spec `aprobada` no se
  implementa — si el pedido no existe en una spec, el primer paso es
  redactarla como `borrador` y pedir confirmación. Al cerrar: criterios
  marcados, estado del RF actualizado y entrada en `CHANGELOG.md`
  referenciando el `RF-XX`.
