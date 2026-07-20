# v8.6.1 — Orden de producción práctico con drag & drop

## Objetivo
Hacer más práctico el acomodo de 20+ solicitudes dentro de Producción nueva.

## Cambios

- Se reemplaza el flujo principal de botones **Subir/Bajar** por tarjetas arrastrables con **drag & drop**.
- Se conserva el botón **Quitar** por visual.
- Se agregan acomodos rápidos:
  - **Fotos primero**
  - **Videos primero**
  - **Orden del lote**
- La IA se conserva, pero ahora se presenta como apoyo para revisar y ordenar, no como única forma de acomodo.
- El prompt de IA ahora revisa mejor el contenido interno de cada solicitud: objetivo, tema, idea visual, copy, CTA, notas de producción, referencias, archivos y material.
- Se mantiene cron diario compatible con Vercel Hobby.

## Campos existentes
Se conserva el guardado de:

- `productionOrder`
- `productionOrderReasons`
- `productionOrderGroups`
- `productionOrderMoments`
- `productionOrderPriorities`
- `productionOrderImmediate`
- `productionOrderMode`
- `productionOrderInstructions`

