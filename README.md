# BUST Content OS — BUST It Now real integrado v1

## Integración real

Se tomó la lógica clave de BUST It Now y se integró dentro de BUST Content OS como módulo interno.

## Incluye

### API de generación
Ruta nueva:

`/api/generate-image`

Usa Gemini con variable de entorno:

`GEMINI_API_KEY`

### Constructor de prompt
Archivo nuevo:

`lib/build-generation-prompt.ts`

Incluye reglas reales de:
- formato,
- objetivo,
- tipo de contenido,
- textos oficiales dentro de imagen,
- jerarquía por prioridad,
- instrucciones exactas,
- Brand Brain,
- elementos visuales,
- tono/emoción,
- reglas de logo,
- reglas de seguridad visual.

### Módulo BUST It Now
Ahora tiene:
- Bandeja desde Tareas
- Trabajos
- Nuevo trabajo
- Estudio generador
- Mapa

### Estudio generador
Permite:
- abrir un job,
- configurar formato,
- objetivo,
- tipo,
- modelo,
- variantes,
- textos oficiales,
- emociones,
- elementos visuales,
- instrucciones,
- construir prompt,
- generar imagen,
- descargar imagen generada.

## Base compartida
Sigue usando:
- clients
- contentRequests
- bustItNowJobs
- systemFeedback
