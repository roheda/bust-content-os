# BUST Content OS — BUST It Now real UI v2

Esta versión corrige la integración para parecerse al flujo real de BUST It Now, no una adaptación simplificada.

## Cambios clave

### Assets del cliente
- Carga múltiple real.
- Lista de assets pendientes antes de subir.
- Metadata individual por archivo:
  - nombre,
  - tipo,
  - categoría,
  - tags,
  - notas.
- Botón para aplicar tipo a todos.
- Assets destacados.
- Biblioteca visual por cliente.

Ruta:
`/dashboard/clientes/[clientId]/assets`

Colección:
`clientAssets`

### Generador
Se rehizo con estilo visual tipo BUST It Now:
- header oscuro,
- cards redondeadas,
- historial de briefs recientes arriba,
- pasos del brief,
- selector de cliente,
- Brand Brain leído,
- bloques oficiales,
- roles de texto,
- prioridades,
- emociones,
- elementos visuales,
- modelo,
- variantes,
- referencia puntual,
- logo overlay,
- tamaño y posición de logo,
- assets seleccionables,
- prompt construido,
- generación de imagen,
- descargas.

### Flujo extra de Content OS
Desde Tareas se puede enviar una solicitud y abrirla dentro del generador real como brief prellenado.

## Datos
Usa las mismas colecciones de Firebase:
- clients
- clientAssets
- generationRequests
- contentRequests
- systemFeedback
