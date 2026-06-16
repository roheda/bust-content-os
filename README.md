# BUST Content OS — Operational v2.1

## Fechas

Ahora se separan dos fechas:

1. **Fecha límite del lote** (`batchDueDate`)
   - Se define en Creador de Solicitudes.
   - Es la fecha operativa de entrega del paquete completo.
   - Asignación y Calendario usan esta fecha como fecha principal de trabajo.

2. **Fecha de publicación** (`publishDate`)
   - Se define individualmente por cada pieza.
   - Sirve para construir el calendario editorial.

## Flujo

Creador de Solicitudes:
- Nombre del lote
- Fecha límite del lote
- Fecha de publicación por pieza

Asignación:
- Muestra fecha límite del lote
- Permite ajustar fecha límite interna por persona si hace falta

Calendario:
- Ordena por fecha operativa
- Conserva visible la fecha de publicación individual
