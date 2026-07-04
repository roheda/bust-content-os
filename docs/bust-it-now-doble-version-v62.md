# BUST It Now v62 · Doble versión referencia + editable

## Objetivo

Permitir que una generación produzca una referencia creativa con texto IA y una base limpia editable para que diseño pueda usar la primera como guía visual y la segunda como arte final con tipografías reales del cliente.

## Modos disponibles

1. **Solo referencia con texto IA**: la IA genera la propuesta completa con textos dentro de la imagen.
2. **Solo base editable**: la IA genera una base visual sin texto y el editor monta los bloques editables.
3. **Doble versión: referencia + editable**: genera ambas versiones hermanas. Es el modo recomendado.

## Cambio de prompt en base editable

La base editable ya no pide espacios específicos, cajas, botones, viñetas o zonas reservadas para cada texto. La IA lee los bloques para entender la intención, pero debe generar una composición libre, visualmente completa y sin texto legible.

## Historial

Las imágenes se guardan con metadatos:
- `variantKind`: `reference-ai` o `editable-base`
- `variantLabel`: `Referencia IA` o `Base editable`
- `variantPairIndex`: número de par

