# v76 — Protección de rutas y dashboard por permisos

## Objetivo
Evitar que un usuario sin permiso para un módulo pueda entrar desde accesos directos del Dashboard o escribiendo la URL manualmente.

## Cambios
- `AppShell` ahora detecta el módulo actual por `pathname` y valida `view` con `canUser`.
- Si el usuario no tiene permiso, la pantalla muestra un bloqueo de acceso y no renderiza el contenido del módulo.
- El Dashboard ahora muestra únicamente cards de módulos disponibles para el rol activo.
- El botón principal de “Crear solicitudes” solo aparece si el usuario tiene permiso `view` y `create` sobre `creador`.
- `canUser` ya no devuelve `true` cuando no hay usuario activo.
- Se agregó `moduleKeyForPath()` como helper central para mapear rutas del dashboard a módulos de permisos.

## Impacto operativo
No cambia el flujo de trabajo. Solo endurece la navegación para que los permisos configurados en Usuarios coincidan con el menú, el Dashboard y las rutas directas.
