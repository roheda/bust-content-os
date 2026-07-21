# v8.6.3 — Doble envío, notas de producción y eliminadas

## Creador de solicitudes
- Se agregó bloqueo inmediato al enviar lote para evitar doble clic.
- El botón cambia a “Enviando lote...” y usa un candado local con `useRef` para bloquear el segundo clic antes de que React actualice estado.
- Se agregó `submissionKey` estable por lote y guardado transaccional en Firestore con `requestBatchSubmissions` para evitar duplicados incluso desde dos pestañas.
- Si el sistema detecta un lote ya enviado, muestra aviso y no duplica solicitudes.

## Producción nueva
- En el listado de posts se mantiene lo que ya aparecía y se agregan Notas de producción visibles.
- Cada post puede expandirse en línea para ver información completa sin salir del listado.
- El detalle expandido muestra idea visual, notas de producción, copy/mensaje/CTA, fechas, plataformas y referencias.
- El ordenador de IA mantiene las notas de producción como referencia fuerte.

## Producciones eliminadas
- Se agregó botón Eliminar en el calendario de producciones.
- La eliminación es suave: cambia a `status: eliminada`, agrega `deletedAt` y `deletedReason`.
- Las producciones eliminadas se ocultan del calendario normal.
- La sección Eliminadas ahora muestra solicitudes y producciones eliminadas.
- Limpieza y retención ahora también borra producciones eliminadas después de los días configurados.

## Firebase
- Se agregó regla para `requestBatchSubmissions`.
- Se mantiene cron diario compatible con Vercel Hobby.
