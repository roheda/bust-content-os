# v7.8 — Rebotes, costeo y arrastre operativo

## Objetivo
Registrar cuántos cambios/rebotes genera cada publicación y a qué responsable se le regresó la pieza, para medir calidad operativa y reflejar el costo/tiempo extra en reportes y costeo.

## Cambios principales
- Nuevo historial `revisionHistory` por solicitud con persona, área, motivo, etapa, autor y fecha del rebote.
- Nuevo contador `revisionCount` por post.
- Cada rebote mueve la tarea al día actual (`plannedWorkDate`, `dueDate`, `internalDueDate`) para que no se pierda en días pasados.
- Las tareas rebotadas suben a prioridad Alta y se marcan como arrastradas.
- Tareas rebotadas tienen estilo visual prioritario en Tareas.
- Reportes muestra:
  - cambios registrados,
  - costo extra por rebotes,
  - horas extra por rebotes,
  - tabla de rebotes por editor/responsable,
  - costo y horas de rebote en CSV.
- Costeo usa los rebotes dentro de `estimateRequestCost`, por lo que costo y tiempo total ya incluyen ajustes de cambio.
- Configuración permite definir por tipo de contenido:
  - costo de rebote como % del costo base,
  - tiempo de rebote como % del tiempo de edición.
- Ajustes por cliente también pueden sobrescribir los porcentajes de rebote.

## Defaults
- Costo rebote: 25% de la pieza.
- Tiempo rebote: 25% de horas de edición.

Estos defaults pueden modificarse en Configuración por contenido o por cliente.
