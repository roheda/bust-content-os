# v57 · Corrección de fuentes en editor de texto editable

- El editor de texto editable ahora registra las fuentes del cliente con `@font-face` dinámico y también con `FontFace`.
- Al cambiar la fuente de un bloque, la vista previa vuelve a renderizarse y muestra el estado: cargando, cargada o error.
- La descarga/exportación espera a que la fuente seleccionada esté disponible antes de pintar el texto en canvas.
- Si una fuente falla por archivo corrupto, enlace sin permisos o CORS, el editor muestra aviso y usa fuente de respaldo.
