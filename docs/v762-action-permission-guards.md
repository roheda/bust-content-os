# v7.6.2 Action Permission Guards

Objetivo: evitar que usuarios con permiso únicamente de `view` puedan ejecutar acciones operativas desde los módulos aunque vean la pantalla.

## Ajustes incluidos

- Hook común `components/useModulePermissions.ts` para detectar usuario activo y permisos por módulo.
- Asignación: bloqueo de reasignar, cambiar área/responsable/prioridad, acciones masivas, devoluciones, eliminaciones y limpieza de huérfanos si no tiene `assign`, `edit`, `delete` o `configure` según acción.
- Aprobaciones: bloqueo de aprobar/devolver si no tiene `approve`.
- Contenidos: bloqueo de editar copy, finalizar copy o generar copys con IA si no tiene `edit`/`generate`.
- Tareas: bloqueo de cambio de estado, comentarios, link de entrega y envío a aprobación si no tiene `edit`.
- Usuarios: bloqueo de crear, sincronizar, cargar equipo, resetear accesos o eliminar si no tiene `configure`.
- Creador de solicitudes: bloqueo de crear/publicar/generar/eliminar drafts si no tiene permisos de creación/generación/eliminación.
- Clientes: bloqueo de crear/editar/analizar/limpiar/archivar si no tiene permiso correspondiente.
- Configuración: bloqueo de reglas/capacidades/overrides si no tiene `configure`.
- Producciones: bloqueo de crear/editar producciones y materiales si no tiene `create`/`edit`.
- Generador: bloqueo de generación, edición, guardado de briefs, logos y capas si no tiene `generate`/`edit`.

## Validación

- `npx tsc --noEmit` pasó correctamente.
- El build compiló y pasó TypeScript; en este sandbox se quedó esperando en `Collecting page data using 36 workers`, por límite del entorno. Vercel debe ejecutar el build completo.
