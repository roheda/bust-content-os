# v68 · Planeación automática de solicitudes y tareas

## Objetivo
Convertir el Creador de Solicitudes y Tareas en un flujo operativo que calcule viabilidad, costos, fechas internas, fecha máxima de producción, capacidad diaria y cuellos de botella.

## Cambios principales

### Creador de Solicitudes
- Agrega panel derecho de **Planeación viva**.
- Calcula en vivo:
  - costo estimado de la solicitud,
  - horas estimadas,
  - unidades operativas,
  - fecha viable,
  - fecha interna,
  - fecha máxima para producción,
  - carga por área,
  - semáforo de riesgo.
- Si la fecha no es viable, exige justificación para forzar la fecha.
- No crea nuevos tipos de contenido; usa los tipos existentes y sus reglas configuradas.

### Configuración
- Agrega configuración de **capacidad diaria por persona**.
- Cada persona tiene área y unidades máximas por día.
- La capacidad default es 5 unidades por día.

### Asignación
- Al asignar una solicitud, el sistema calcula:
  - fecha interna,
  - fecha final al cliente,
  - día programado de trabajo,
  - peso operativo,
  - semáforo de riesgo.
- El día programado se asigna según la capacidad disponible del responsable.

### Tareas
- La fecha principal en tareas ahora es el **día programado de trabajo**.
- También se muestra la fecha interna y la fecha final al cliente.
- Si una tarea no se cerró en su día programado, se arrastra automáticamente al día actual.
- La tarea arrastrada consume capacidad del día siguiente.
- Se agrega semáforo de carga diaria por persona:
  - Verde: sano
  - Amarillo: lleno
  - Naranja: sobrecarga
  - Rojo: cuello de botella

### Producciones
- Las solicitudes pendientes de producción muestran fecha interna y fecha máxima de producción.

## Campos nuevos en ContentRequest
- `clientDueDate`
- `internalDueDate`
- `plannedWorkDate`
- `productionDueDate`
- `operationalCost`
- `operationalHours`
- `operationalWeight`
- `operationalRisk`
- `forcedDate`
- `forcedDateReason`
- `forcedDateNotes`
- `carriedOver`
- `carriedOverFromDate`
- `carriedOverDays`

## Build
Verificado con:

```bash
NEXT_TELEMETRY_DISABLED=1 npm run build
```
