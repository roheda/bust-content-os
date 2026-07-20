# v80 Material de producción y referencias

Ajustes para asegurar que las solicitudes que viajan a Producción conserven y muestren todo el contexto operativo.

## Cambios

- Producciones ahora muestra la solicitud completa desde el detalle: solicitud inicial, copy, mensaje, CTA, notas de producción, referencias visuales, archivos y links.
- En Completar material de producción se pueden cargar archivos generales de producción.
- Cada solicitud incluida tiene botón para ver la solicitud completa sin exportar el brief.
- Al marcar material entregado, cada solicitud hereda:
  - link específico por pieza,
  - link general de la producción,
  - archivos generales de producción,
  - fecha/hora de entrega del material.
- Asignación y Tareas muestran claramente el material entregado por producción, incluyendo producción ligada, link específico, link general y fecha de entrega.
- El material se mantiene visible en `materialLinks` y `materialFiles` para compatibilidad con módulos existentes.

## Objetivo operativo

Evitar que Foto, Producción, Audiovisual, Diseño o Content pierdan referencias, imágenes o links al mover una solicitud entre Producciones, Asignación y Tareas.
