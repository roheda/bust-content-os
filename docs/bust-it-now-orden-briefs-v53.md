# v53 · Orden de briefs en BUST It Now

La sección **Briefs** de BUST It Now ahora ordena los briefs por actividad reciente:

1. `generatedAt` cuando exista.
2. `updatedAt` cuando el brief fue usado o generado.
3. `createdAt` cuando solo fue guardado.
4. `id` como respaldo si no hay fecha disponible.

Objetivo: que el último brief generado/guardado aparezca primero.
