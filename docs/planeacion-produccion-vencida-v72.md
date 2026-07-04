# v72 - Producción vencida en planeación viva

Ajuste en Creador de Solicitudes para evitar que el panel de Planeación viva muestre una fecha máxima de producción anterior al día actual como si todavía fuera viable.

## Cambios

- Si una pieza requiere producción y la fecha máxima calculada ya pasó, el panel muestra `Ya no viable` en lugar de la fecha vencida.
- La solicitud cambia a riesgo rojo.
- Se muestra una alerta indicando que debe moverse la fecha de publicación o trabajarse con material disponible.
- Al enviar el lote se bloquea si hay piezas con producción vencida, para evitar que llegue a Producciones una producción imposible.

## Criterio operativo

La fecha de publicación puede ser sábado o domingo, pero el trabajo interno y producción se calculan en días hábiles. Si el tiempo ya no alcanza para producir, el contenido debe cambiar a material disponible, banco de assets, contenido existente, stock o generación IA, o debe moverse la publicación.
