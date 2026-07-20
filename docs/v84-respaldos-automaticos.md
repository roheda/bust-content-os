# v8.4 Respaldos automáticos configurables

## Alcance

- Nueva sección **Configuración → Respaldos del sistema**.
- Respaldos manuales desde la interfaz.
- Respaldos automáticos configurables por:
  - activo/inactivo,
  - frecuencia diaria o semanal,
  - hora del día,
  - zona horaria,
  - cantidad de respaldos a conservar,
  - incluir o excluir eliminados/papelera.
- Historial de respaldos con descarga JSON, restauración y eliminación.
- Respaldo preventivo automático antes de restaurar un respaldo.
- Endpoint de cron: `/api/admin/run-auto-backup`.
- Vercel Cron configurado para revisar cada hora y ejecutar solo cuando coincide con la hora guardada.

## Colecciones incluidas

- clients
- clientAssets
- requestBatches
- contentRequests
- plannerDrafts
- productions
- operationalContentRules
- clientOperationalOverrides
- teamDailyCapacities
- generationRequests
- generatedImages
- bustItNowJobs
- systemFeedback
- platformUsers
- userAccess
- systemSettings

## Requisitos para automático

Configurar en Vercel una variable:

- `CRON_SECRET`, o
- `BACKUP_CRON_SECRET`

El endpoint acepta el secreto por `Authorization: Bearer <secret>`, `x-backup-secret` o query `?secret=`.

## Notas

- Los archivos JSON se guardan en Firebase Storage dentro de `system-backups/`.
- La metadata se guarda en `systemBackups`.
- Las reglas Firestore y Storage se actualizaron para esta nueva colección/carpeta.
- La restauración escribe documentos con los mismos IDs del respaldo. Antes de restaurar se genera un respaldo preventivo del estado actual.
