# BUST Content OS — BUST It Now real UI v2

Esta versión corrige la integración para parecerse al flujo real de BUST It Now, no una adaptación simplificada.

## Cambios clave

### Assets del cliente
- Carga múltiple real.
- Lista de assets pendientes antes de subir.
- Metadata individual por archivo:
  - nombre,
  - tipo,
  - categoría,
  - tags,
  - notas.
- Botón para aplicar tipo a todos.
- Assets destacados.
- Biblioteca visual por cliente.

Ruta:
`/dashboard/clientes/[clientId]/assets`

Colección:
`clientAssets`

### Generador
Se rehizo con estilo visual tipo BUST It Now:
- header oscuro,
- cards redondeadas,
- historial de briefs recientes arriba,
- pasos del brief,
- selector de cliente,
- Brand Brain leído,
- bloques oficiales,
- roles de texto,
- prioridades,
- emociones,
- elementos visuales,
- modelo,
- variantes,
- referencia puntual,
- logo overlay,
- tamaño y posición de logo,
- assets seleccionables,
- prompt construido,
- generación de imagen,
- descargas.

### Flujo extra de Content OS
Desde Tareas se puede enviar una solicitud y abrirla dentro del generador real como brief prellenado.

## Datos
Usa las mismas colecciones de Firebase:
- clients
- clientAssets
- generationRequests
- contentRequests
- systemFeedback


## Patch 2.0.1 — Dedupe de clientes por nombre

Se agregó `dedupeBrandsByName()` y `listUniqueBrands()` en `lib/data.ts`.

Ahora el Creador de Solicitudes y módulos operativos usan `listUniqueBrands()` para:
- ocultar clientes con `status: "deleted"`,
- evitar duplicados por nombre,
- conservar el cliente más completo cuando hay dos documentos con el mismo nombre.

Esto corrige casos como:
- Acerofertas duplicado después de migración.


## v3 — Request original de generación

Se agregó la ruta:

```txt
/dashboard/generador/[requestId]
```

Esta pantalla replica el flujo mostrado en BUST It Now original:

- resumen del brief,
- prompt final,
- copiar prompt,
- descargar prompt,
- selector exclusivo Gemini:
  - Gemini Pro Imagen,
  - Gemini 3.1 Flash Imagen,
  - Gemini 2.5 Flash Imagen,
- 1, 2 o 4 variantes,
- activar/desactivar referencias visuales reales,
- generar imagen,
- resultados,
- insertar logo después como overlay de vista previa.

También queda preparada la API:

```txt
/api/apply-logo-overlay
```

Por ahora el overlay posterior funciona en vista previa. Para quemar el logo dentro del PNG final, se debe activar procesamiento server-side con Sharp.


## v4 — Punto 4 restaurado en el brief

Se restauró el bloque visual:

- **4. Referencia específica de esta pieza**
- Imagen puntual
- Nombre del archivo
- Rol de la imagen
- Instrucción sobre este archivo
- Quitar referencia puntual

Además esa referencia puntual se guarda también en `requestAttachments` del request.


## v5 — Fix deploy + historial feed

Se corrigió el error de build en `app/dashboard/generador/page.tsx` reescribiendo el JSX completo y bien cerrado.

Cambios:
- Se quitó "Historial de briefs recientes" del tab Generador / Brief.
- El historial vive solo en el tab Historial.
- El tab Historial ahora es un feed tipo Instagram.
- Cada card muestra imagen generada si existe en `generatedImages`.
- Se conserva el punto 4: Referencia específica de esta pieza.


## v5.1 — Fix TypeScript GenerationRequest

Se corrigió el error de deploy:

```txt
Object literal may only specify known properties, and 'requestAttachments' does not exist in type 'GenerationRequest'
```

Cambio aplicado:
- `GenerationRequest` ahora incluye `requestAttachments?: any[]`.


## v5.2 — Fix getDoc import

Se corrigió el error de deploy:

```txt
Cannot find name 'getDoc'. Did you mean 'getDocs'?
```

Cambio:
- Se agregó `getDoc` al import de `firebase/firestore` en `lib/data.ts`.
