# v56 · Tipografías como assets para texto editable

## Objetivo
Permitir que las fuentes de cada cliente se suban desde **Clientes → Assets** y que BUST It Now las use en el editor de texto editable.

## Flujo
1. Abrir cliente.
2. Entrar a **Assets**.
3. Subir archivo `.otf`, `.ttf`, `.woff` o `.woff2`.
4. El sistema lo detecta como **Tipografía / fuente**.
5. En BUST It Now, al abrir **Editar texto**, las capas ofrecen esas fuentes en el selector.
6. Al exportar PNG, el canvas intenta cargar la fuente real del asset.

## Notas
- Las fuentes se guardan en Firebase Storage como asset del cliente.
- El editor mantiene Arial como fallback si la fuente no carga.
- Los assets de tipografía no se mandan como referencia visual al generador de imágenes.
- La fuente aplica al modo **Texto editable por BUST It Now**.
