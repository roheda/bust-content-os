# v60 · BUST It Now sin placeholders en texto editable

Ajuste para el modo **Texto editable por BUST It Now**.

## Problema
El modelo podía insertar textos genéricos como `CTA NOW` aunque el modo pedía una base sin texto.

## Cambio
- El prompt ahora usa modo absoluto sin texto.
- Se prohíben placeholders como `CTA`, `CTA NOW`, `SALE`, `PROMO`, `HEADLINE`, `TEXT`, etc.
- Los bloques de texto se usan solamente como mapa de composición.
- Si se requiere un área de CTA, debe ser un contenedor visual vacío sin letras.
- Elementos visuales dependientes de texto se filtran en modo editable.

## Resultado esperado
La imagen base debe salir limpia y lista para que el editor monte los bloques con fuentes reales desde assets.
