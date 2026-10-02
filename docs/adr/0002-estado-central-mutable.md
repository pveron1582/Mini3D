# ADR-0002 — Estado central compartido y mutable

Estado: aceptado | Fecha: 2026-10-01
Relacionado: `js/state.js`, `js/main.js` (orquestador)

## Contexto
56 módulos con responsabilidades claras necesitan compartir selección activa,
ambiente, cinemática, timeline y registry sin pasar todo por parámetros ni
crear un store reactivo (framework = prohibido por ADR-0001).

## Decisión
- `js/state.js` como único estado central, **mutable por diseño**.
- Convención (documentada en el propio archivo):
  - primitivos que se reasignan viven en `store` (el binding se muta a través
    del objeto importado);
  - singletons tipo objeto (Mapas, `cinema`, `view`, `timeline`) se exportan
    directos y se mutan in-place.
- `main.js` solo orquesta: importa módulos (construyen escena y listeners
  por efecto de evaluación) e inyecta dependencias transversales.

## Consecuencias
- Pros: sin boilerplate, cualquier módulo lee/escribe con un import; estado
  serializable de forma directa (`serializeProject` lee el mismo estado).
- Contras: mutación global = hay que seguir la convención; un módulo nuevo
  que "guarde estado local duplicado" genera divergencias (revisar en PR).
