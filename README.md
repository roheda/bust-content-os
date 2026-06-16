# BUST Content OS — Integración BUST It Now v1

## Borradores del Creador
Se agregó botón para eliminar borradores guardados con confirmación.

## Eliminación de solicitudes
Las solicitudes ya no se borran físicamente. Ahora `deleteRequest` hace soft delete:
- status: `eliminada`
- deletedAt
- deletedReason

Las vistas operativas ocultan eliminadas, pero queda rastreabilidad en `/dashboard/eliminadas`.

## Clientes compartidos
El módulo de Clientes queda como base compartida entre BUST Content OS y BUST It Now.

## Generador BUST It Now
Se agregó módulo en menú izquierdo debajo de Tareas: `Generador`.

Desde Tareas se puede enviar una tarea/post al Generador.

En Generador se puede:
- filtrar por cliente,
- ver enviadas/en proceso/generadas,
- cambiar estado del trabajo,
- ver contexto del post.
