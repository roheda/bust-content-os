# BUST Content OS — Plataforma unificada v1

## Cambio conceptual

BUST Content OS es la plataforma única.

BUST It Now ya no funciona como sistema externo ni separado. Ahora es un módulo interno dentro de BUST Content OS usando la misma base de datos.

## Firestore compartido

Colecciones compartidas:

- `clients`: base única de clientes
- `contentRequests`: solicitudes, tareas, calendario y aprobaciones
- `bustItNowJobs`: trabajos internos del módulo BUST It Now
- `systemFeedback`: mejoras internas del sistema

## Módulo BUST It Now

El módulo ahora tiene pestañas:

- Bandeja desde Tareas
- Trabajos BUST It Now
- Nuevo trabajo
- Mapa de integración

## Flujo

### Desde Tareas
Una tarea se puede mandar a BUST It Now.

Esa pieza aparece en Bandeja desde Tareas.

Desde ahí se puede convertir a un job interno sin duplicar cliente.

### Desde BUST It Now
También se puede crear un trabajo nuevo seleccionando un cliente existente de la misma base `clients`.

## Objetivo

Un solo login, una sola base de clientes, una sola operación, varios módulos.
