# v71 — Fechas de publicación en fin de semana

## Cambio
Las fechas de publicación en el Creador de Solicitudes ya pueden caer en sábado o domingo.

## Lógica operativa
- El equipo no programa trabajo operativo en sábado o domingo.
- Las publicaciones sí pueden estar calendarizadas en fin de semana.
- La fecha final/publicación puede ser sábado o domingo.
- Las tareas, producción, revisión interna y cambios se calculan hacia atrás en días hábiles.

## Cambios aplicados
- Se quitó la validación que bloqueaba `publishDate` en sábado/domingo.
- Se quitó la validación de lote que rechazaba solicitudes con publicación en fin de semana.
- La generación IA de propuestas ya puede sugerir sábado o domingo cuando convenga.
- La primera fecha de publicación de propuestas IA ya no se fuerza a día hábil.
- El fallback de IA usa separación por días calendario para publicación, no solo días hábiles.

## Resultado esperado
Si una publicación se pide para sábado o domingo, el sistema la acepta y calcula las fechas internas de trabajo en días hábiles previos.
