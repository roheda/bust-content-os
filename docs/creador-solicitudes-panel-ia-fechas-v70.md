# v70 · Creador de Solicitudes: panel vivo fijo, IA completa y fechas importantes

## Cambios principales

### Panel derecho completo flotante
- El panel derecho del Creador de Solicitudes ahora queda fijo completo mientras el usuario trabaja el lote.
- La Planeación viva y el Calendario del lote se mueven juntos.
- Si el panel es más alto que la pantalla, el scroll ocurre dentro del propio panel para no quedarse atorado en Borradores o Lotes anteriores.
- En tablet/móvil vuelve a comportamiento normal para evitar problemas de altura.

### Generar publicaciones completas con IA
- El botón de IA ahora genera propuestas completas, no solo ideas base.
- Llena: tipo, objetivo, plataformas, formato, ubicación feed, buyer persona, tema, idea creativa, mensaje clave, copy in, CTA, fecha, área, producción/material y notas de producción.
- Si el modelo externo no responde, usa un fallback completo para no bloquear el flujo.
- La primera fecha es obligatoria para poder calendarizar correctamente las publicaciones generadas.

### Campos obligatorios de solicitud
- Se reforzó la validación para que las solicitudes no pasen incompletas.
- Ahora se valida área, plataformas, formato visual, tema, mensaje clave, CTA y notas de producción cuando aplique.

### Fechas importantes en Brand Brain
- Se agregó el campo `importantDates` dentro de Brand Brain.
- En Clientes > Brand Brain se pueden capturar fechas importantes una por línea.
- El generador de publicaciones completas considera estas fechas al crear solicitudes.
- BUST It Now también recibe esas fechas como contexto de marca.

### Tipografía del Brand Brain
- La tipografía queda como referencia visual/de marca.
- Se reforzó que no debe usarse como titular, etiqueta o copy dentro de imágenes generadas.
