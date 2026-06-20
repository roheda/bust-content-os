# v49 · Doble aprobación y módulo Contenidos

## Flujo operativo

1. Tareas envía una pieza a aprobación.
2. Content revisa primero: si aprueba, pasa a KAM.
3. KAM revisa después: si aprueba, pasa a Contenidos.
4. En Contenidos se escribe el copy final, se copia, se exporta y se finaliza.

## Estados principales

- `pendiente_aprobacion`: pendiente de aprobación Content.
- `pendiente_aprobacion_kam`: pendiente de aprobación KAM.
- `aprobada_pendiente_copyout`: lista en Contenidos.
- `finalizada`: cerrada y lista para historial/reportes.
- `rebotada`: devuelta con motivo.

## Permisos

Se agregó el módulo `contenidos` a usuarios y permisos.
Los usuarios existentes que no tengan el módulo guardado en su matriz usarán el fallback del rol base para no quedarse sin acceso.
