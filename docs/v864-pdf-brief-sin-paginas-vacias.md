# v8.6.4 - PDF brief de producción sin páginas vacías

Corrección del exportador de brief de producción.

## Cambios

- El botón de imprimir agrega una clase temporal `printing-production-brief` antes de llamar a `window.print()`.
- En impresión se oculta con `display:none` todo el contenido normal del dashboard que quedaba ocupando espacio invisible.
- El modal del brief queda en posición estática, sin alto mínimo, sin overlay y sin centrado de pantalla.
- Se conservan las tarjetas del brief, notas de producción, número interno del lote y orden de producción.

## Problema corregido

El PDF exportado generaba hojas iniciales vacías porque elementos invisibles del dashboard seguían ocupando espacio en el layout de impresión.
