# BUST It Now - fix build v64

Se corrigió un error de TypeScript en `app/dashboard/generador/[requestId]/page.tsx`.

## Problema

En `buildPromptForMode` se usaba `currentRequest` sin declararlo dentro de esa función, lo que causaba:

```txt
Type error: Cannot find name 'currentRequest'.
```

## Ajuste

Ahora la función valida `request` y crea una constante local segura:

```ts
if (!request) return "";
const currentRequest = request;
```

Después usa `currentRequest` para construir el prompt.

## Resultado

El build ya no debe fallar por `currentRequest` no definido en `buildPromptForMode`.
