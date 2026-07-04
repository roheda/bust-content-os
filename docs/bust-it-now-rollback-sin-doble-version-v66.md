# BUST It Now v66 — Regreso a generación tradicional

## Cambio principal
Se elimina el modo de doble versión (`referencia + editable`) de la interfaz y del flujo de generación.

Ahora BUST It Now vuelve a generar una sola salida por acción:

1. **IA genera texto**: la IA compone la imagen y puede incluir los bloques oficiales de texto.
2. **Solo composición / texto editable**: la IA genera una base visual sin texto; los bloques se colocan después con el editor.

## Ajustes de prompt
- Ya no se solicita una referencia y una base editable al mismo tiempo.
- En modo editable, el prompt mantiene la indicación de no escribir texto ni placeholders.
- En modo editable, la IA usa los textos solo como contexto de intención, no como instrucciones para crear cajas o espacios rígidos.

## Tipografía del Brand Brain
Para evitar que el modelo escriba nombres de fuentes dentro de la imagen:

- Los nombres/campos de tipografía del Brand Brain ya no se envían como palabras visibles al prompt.
- Las fuentes cargadas en Assets se excluyen del prompt de imagen.
- Las fuentes siguen disponibles únicamente para el editor de texto editable.

## Assets
Los assets de tipografía quedan fuera de las referencias visuales para generación. Solo las imágenes visuales seleccionadas se mandan como referencias.
