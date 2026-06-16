# BUST Content OS — BUST It Now exacto v1

Esta versión integra BUST It Now como debe funcionar: no solo un generador, sino el flujo completo.

## Clientes
Ahora se crean como en BUST It Now e inicializan:
- `brandBrain`
- conexión con Assets
- alta única para toda la plataforma

## Brand Brain
Ruta: `/dashboard/clientes/[clientId]`

Campos:
- descripción de marca
- tono
- colores
- tipografía
- estilo visual
- DO
- DON'T
- modelos recomendados

## Assets
Ruta: `/dashboard/clientes/[clientId]/assets`

Colección: `clientAssets`

Permite subir y administrar:
- logo
- referencia
- producto
- elemento gráfico
- stock aprobado

Cada asset incluye:
- type
- category
- tags
- notes
- fileUrl
- storagePath
- mimeType
- isFeatured

## BUST It Now
Módulo interno con:
- Generador / Brief
- Solicitudes desde Tareas
- Historial
- Integración

El generador lee:
- `clients.brandBrain`
- `clientAssets`
- assets seleccionados
- textos oficiales
- emociones
- elementos visuales
- instrucciones
- logo overlay

## Historial
Colección: `generationRequests`

Permite reusar/editar briefs.
