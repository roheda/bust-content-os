# v8.6.6 — Ajustes Asignación / Producción / Material por track

## Asignación

- Las solicitudes dentro de cada lote se ordenan ascendentemente por número interno del lote: Post #1, Post #2, Post #3...
- El drawer de Detalle Operativo ahora muestra el número de contenido en el encabezado.
- En el listado de Solicitudes para asignar se le da prioridad visual al Tema/Publicación.
- El cliente baja de protagonismo porque ya aparece en el bloque del lote.
- El objetivo queda como información secundaria.
- Se agregó bloqueo visual y lógico para evitar que se pueda dar clic varias veces en Asignar y duplicar pendientes.
- La asignación masiva también se bloquea mientras está ejecutándose.

## Producciones

- En Links por solicitud se prioriza el número de contenido y el Tema/Publicación.
- El objetivo deja de ser el dato principal en esta tabla.
- Se separó la captura de material por solicitud en tres campos:
  - Foto / Diseño.
  - Video / Audiovisual.
  - Link final opcional.
- Las publicaciones mixtas muestran estado separado de foto y video.
- Se agregó botón Guardar avances para que fotografía o audiovisual puedan cargar su link sin esperar al otro equipo.
- Al marcar material entregado, el sistema valida los tracks que correspondan según la solicitud.

## Cron

- Se conserva el cron diario compatible con Vercel Hobby: `0 5 * * *`.
