# BUST Content OS — Tareas y Aprobaciones v2

## Estados corregidos

### En Tareas
Los estados operativos ahora son:

- Asignada
- En revisión
- Rebotada
- En aprobación

El usuario ya no puede marcar una tarea como Finalizada desde Tareas.

### Enviar a aprobación
Desde Tareas, el usuario debe pegar el link final de Drive y dar clic en:

Enviar a aprobación

Esto genera automáticamente un comentario/log:

Enviado a aprobación. Link final: ...

### En Aprobaciones
Aprobaciones es el único módulo que puede dar el último check.

Si aprueba:
- estado pasa a `finalizada`
- approvalStatus pasa a `aprobada`
- se agrega log: "Aprobado. Tarea finalizada."

Si no aprueba:
- estado pasa a `rebotada`
- approvalStatus pasa a `rechazada`
- se agrega log: "Rebotado por [motivo]."

## Log de movimientos
Cada movimiento importante queda registrado como comentario de sistema dentro de la tarea:
- cambio de estado
- envío a aprobación
- aprobación
- rechazo/rebote
