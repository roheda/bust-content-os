# v8.6.2 — Numeración fija por lote + orden de producción separado

## Objetivo
Mantener el número interno de cada post dentro del lote aunque el equipo cambie el orden operativo de producción.

## Cambios
- Producción Nueva muestra dos referencias independientes:
  - `Post #N`: número fijo de la solicitud dentro del lote.
  - `Orden producción N`: posición operativa para grabar/fotografiar.
- El drag & drop solo cambia el orden de producción.
- El número interno del lote no se renumera ni cambia al reordenar.
- El brief/hoja de producción muestra ambos números.
- Al crear producción se guarda:
  - `productionOrder`
  - `productionLotSequenceNumbers`
  - `lotSequenceNumber` en la solicitud, usando el `number` ya existente como base.
- Se mantiene cron diario compatible con Vercel Hobby.

## Regla operativa
El equipo puede seguir diciendo “el post 10” aunque ese post se grabe primero, segundo o al final.
