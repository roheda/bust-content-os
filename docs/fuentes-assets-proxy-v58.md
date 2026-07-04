# v58 · Proxy de fuentes para assets tipográficos

Las fuentes OTF/TTF/WOFF cargadas en Assets del cliente pueden fallar en navegador por CORS al consumirse directo desde Firebase Storage.

Esta versión agrega `/api/font-proxy`, que obtiene el archivo desde el servidor y lo entrega al navegador con headers correctos para `@font-face` y `FontFace`.

El editor de texto editable de BUST It Now ahora usa esa ruta proxy para registrar y cargar fuentes del cliente.
