# Plantilla de spec — MiniStudio 3D

> Toda spec de requisitos (RF/RNF) en `docs/specs/` usa este formato.
> Formato Markdown puro, sin herramientas externas (coherente con "sin
> dependencias"). Ver `AGENTS.md` para el proceso spec-first.

```markdown
# RF-XX — <nombre corto y descriptivo>

Estado: borrador | aprobado | implementado | verificado

## Qué debe hacer

<Prescriptivo: qué hace el sistema, no qué se hizo. Una o dos frases.>

## Criterios de aceptación

- [ ] <Verificable: un assert de p7-test, o un paso manual único y observables>
- [ ] ...

## Justificación

<¿Por qué lo queremos? Contexto de producto. Obligatorio: es la respuesta a
"¿por qué existe este requisito?" cuando alguien lo pregunte en el futuro.>

Depende de: RF-YY (opcional)

Trazabilidad:
- Test(s): <archivo + sección, o "sin test aún">
- CHANGELOG: <fecha de la entrada que lo implementó, o "-">
```

## Estados (y quién los mueve)

| Estado | Significado | Quién lo pone |
|---|---|---|
| `borrador` | Escrito, sin confirmar. Puede experimentarse en ramas. | Agente al redactar; usuario al proponer |
| `aprobado` | El usuario confirmó que así se quiere. **Requisito para implementar.** | Usuario |
| `implementado` | Existe en código, sin test que lo cubra. | Agente al cerrar la tarea |
| `verificado` | Existe y tiene criterio de aceptación automatizado en `tools/p7-test.mjs` (o equivalente). | Agente al agregar el test |

## Reglas

1. Un RF = una capacidad. Si crece demasiado, se parte (RF-XX.1, RF-XX.2…).
2. Los criterios de aceptación son la contracta: si no se puede verificar,
   no es un criterio — se reescribe.
3. Cada cambio de código referencía su RF en el CHANGELOG (`RF-XX`).
4. Prohibido implementar un RF `aprobado → implementado` sin actualizar esta
   spec en el mismo commit.
