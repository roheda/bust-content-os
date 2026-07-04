# v65 - Fix tipo GenerationRequest

Se agregaron al tipo `GenerationRequest` los campos usados por el modo doble de BUST It Now:

- `referenceGeneratedPrompt?: string`
- `editableGeneratedPrompt?: string`

Esto corrige el error de deploy donde TypeScript rechazaba esos campos al guardar un brief/generación.

También se verificó el build local con `NEXT_TELEMETRY_DISABLED=1 npm run build`.
