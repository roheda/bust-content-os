# v85 - Producción por lotes y selección masiva

## Cambios

- En `/dashboard/producciones`, las solicitudes pendientes de producción ahora se agrupan por lote en bloques desplegables, igual que en Asignación.
- Cada bloque de lote muestra cliente, total de solicitudes, cantidad de piezas de video, cantidad de piezas estáticas/foto y solicitudes seleccionadas.
- Cada bloque tiene checkbox para seleccionar/deseleccionar todas las solicitudes del lote.
- Agregado checkbox global “Seleccionar visibles” para seleccionar todas las solicitudes filtradas.
- Se conservan filtros por cliente, lote y rango de entrega interna.
- Se conservan botones de abrir/cerrar lotes.
- El detalle de solicitud sigue disponible desde cada tarjeta.

## Validación

- `npx tsc --noEmit` pasó correctamente.
- `npm run build` compiló y pasó TypeScript; el entorno se cortó por timeout durante `Collecting page data`, igual que en versiones anteriores.
