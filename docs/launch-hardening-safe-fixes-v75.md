# v7.5 Launch hardening safe fixes

Ajustes aplicados a partir de la auditoría externa, sin cambiar el flujo operativo principal:

- Auth queda seguro por default: si `NEXT_PUBLIC_AUTH_ENFORCED` no está definido, se comporta como seguro. El modo prueba solo queda disponible en desarrollo local con `NEXT_PUBLIC_AUTH_ENFORCED=false`.
- Las APIs ya no omiten validación en producción aunque el flag esté mal configurado.
- `generate-copy` ahora intenta OpenAI primero y Gemini como respaldo; si ambos fallan usa plantilla y devuelve `mode: fallback`.
- Contenidos muestra si el copy vino de OpenAI, Gemini o plantilla de respaldo.
- Generación masiva de copys muestra progreso y confirma antes de sobrescribir borradores no guardados.
- Se eliminó el roster con correos personales hardcodeados de `seed-bust-users`; la carga masiva ahora depende de `BUST_SEED_USERS_JSON` temporal.
- `AUTH_SETUP_TOKEN` puede expirar usando `AUTH_SETUP_TOKEN_EXPIRES_AT`.
- `package-lock.json` queda limpio con registry público y deja de estar ignorado por Git.
- `firestore.rules` elimina función sin uso para evitar warning.
- Se centralizó helper `isBrandActive` y se agregó `eliminada` a `requestStates`.
- Se corrigió el activo visual de la pantalla de solicitudes eliminadas.
