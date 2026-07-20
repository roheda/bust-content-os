# v8.6 — Orden inteligente de producción

## Objetivo
Convertir la selección de visuales en Producción nueva en una lista real de rodaje/fotografía, con orden manual e IA operativa.

## Cambios principales

### Producciones / Producción nueva
- Nueva sección **Orden de producción** dentro del modal de producción nueva.
- Campo de instrucciones para producción, por ejemplo: primero ambiente, luego bebidas, y platillos calientes al salir de cocina.
- Botón **Ordenar con IA** para sugerir el orden de los visuales seleccionados.
- Botón **Ordenar manualmente** para limpiar sugerencias y acomodar a mano.
- Botones **Subir**, **Bajar** y **Quitar** por visual.
- La IA clasifica solicitudes por grupo, momento ideal, prioridad y captura inmediata.
- Muestra explicación operativa del orden sugerido.

### Criterios de IA
La IA considera:
- Tipo de contenido.
- Idea visual.
- Notas de producción.
- Copy / mensaje / CTA.
- Formato visual.
- Si es video, foto, story o reel.
- Si menciona ambiente, bebida, platillo frío, platillo caliente, preparación, modelo o mesa completa.
- Brand Brain y reglas del cliente.
- Instrucciones manuales del equipo.

### Guardado
Al crear producción se guarda:
- `productionOrder`
- `productionOrderReasons`
- `productionOrderGroups`
- `productionOrderMoments`
- `productionOrderPriorities`
- `productionOrderImmediate`
- `productionOrderMode`
- `productionOrderInstructions`

También se actualizan las solicitudes con:
- `productionOrder`
- `productionOrderReason`
- `productionOrderGroup`
- `productionOrderMoment`
- `productionPriority`
- `requiresImmediateCapture`
- `aiSuggestedOrder`
- `manualOrderEdited`

### Brief de producción
El brief ahora respeta el orden guardado y muestra:
- Número de orden.
- Grupo.
- Momento ideal.
- Motivo del orden.
- Badge de captura inmediata.

## API nueva
- `/api/suggest-production-order`
- Usa OpenAI si está disponible.
- Usa Gemini como fallback.
- Si no hay proveedores configurados, usa un algoritmo local operativo para ordenar por categorías gastronómicas/productivas.

## Compatibilidad Vercel Hobby
Se mantiene el cron diario compatible:

```json
"schedule": "0 5 * * *"
```
