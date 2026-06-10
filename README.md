# BUST Content OS — Planeador Firestore

## Qué cambia

Esta versión reinicia el Planeador IA en forma más estable:

- Borradores guardados en Firestore (`plannerDrafts`)
- Publicación de lotes completos a:
  - `requestBatches`
  - `contentRequests`
- Referencias con Firebase Storage
- Preview de imágenes
- Manual + IA en el mismo borrador
- Sin dependencia de localStorage

## Flujo

1. Crear cliente.
2. Crear borrador en Planeador IA.
3. Agregar propuestas IA y/o manuales.
4. Guardar borrador.
5. Abrir borrador después si hace falta.
6. Enviar a Solicitudes.
