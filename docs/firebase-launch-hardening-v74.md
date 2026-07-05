# Firebase Launch Hardening v7.4

Esta versión agrega reglas reales de Firestore/Storage y una colección espejo `userAccess/{authUid}` para que Firebase pueda validar permisos por usuario autenticado.

## Qué protege

- Bloquea lecturas/escrituras si no hay sesión de Firebase Auth.
- Usa `userAccess/{uid}` como documento de permisos para reglas de Firebase.
- Restringe usuarios, configuración y borrados a usuarios con permiso `usuarios.configure`, `configuracion.configure` o master.
- Protege rutas API de IA cuando `NEXT_PUBLIC_AUTH_ENFORCED=true`.
- Agrega botón en Usuarios: **Sincronizar Firebase** para crear/actualizar `userAccess` a partir de `platformUsers`.
- Agrega endpoint server-side: `/api/admin/sync-firebase-access`.

## Flujo recomendado antes de publicar reglas

1. En Vercel confirma variables:
   - `NEXT_PUBLIC_AUTH_ENFORCED=true`
   - `FIREBASE_ADMIN_PROJECT_ID`
   - `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `FIREBASE_ADMIN_PRIVATE_KEY`
   - `AUTH_SETUP_TOKEN`
   - `OPENAI_API_KEY` y/o `GEMINI_API_KEY`

2. Haz deploy del código a Vercel.

3. Entra a `/dashboard/usuarios` como master/admin.

4. Presiona **Sincronizar Firebase**.
   - Si todavía no tienes sesión admin, usa el `AUTH_SETUP_TOKEN`.
   - Esto crea/actualiza documentos en `userAccess/{authUid}`.

5. Ya con `userAccess` sincronizado, publica reglas:

```cmd
cd /d C:\Users\rodri\bust-content-os
npx firebase-tools login
npx firebase-tools use bust-content-os
npm run firebase:deploy:rules
```

También puedes copiar manualmente `firestore.rules` y `storage.rules` en Firebase Console.

## Importante

No publiques las reglas antes de sincronizar `userAccess`, porque las reglas dependen de esa colección para reconocer usuarios activos.

Si alguien no puede entrar después de publicar reglas:

1. Verifica que su usuario exista en Firebase Auth.
2. Verifica que `platformUsers` tenga su `authUid`.
3. Verifica que exista `userAccess/{authUid}`.
4. Presiona **Sincronizar Firebase** otra vez desde Usuarios o llama `/api/admin/sync-firebase-access` con `AUTH_SETUP_TOKEN`.

## Colecciones protegidas

- `clients`
- `clientAssets`
- `plannerDrafts`
- `requestBatches`
- `contentRequests`
- `productions`
- `operationalContentRules`
- `clientOperationalOverrides`
- `teamDailyCapacities`
- `generationRequests`
- `generatedImages`
- `bustItNowJobs`
- `systemFeedback`
- `platformUsers`
- `userAccess`

## Storage protegido

- `clients/{clientId}/...`
- `content-request-references/...`
- `generated-images/...`

Todo lo demás queda cerrado por default.
