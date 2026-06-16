# BUST Content OS — Tareas y Aprobaciones v1

## Cambios principales

### Calendario → Tareas
La sección ahora se llama **Tareas**.

Mantiene:
- Vista calendario semanal/mensual
- Vista lista de tareas
- Vista por persona

### Tareas vencidas
- Las tareas con fecha operativa vencida aparecen en rojo.
- Se agregó filtro para ver solo vencidas.

### Abrir tarea
Al abrir una tarea se puede:
- Ver detalle del post
- Ver referencias y material
- Ver el lote completo al que pertenece
- Comentar dudas con @menciones
- Cambiar estado de trabajo

### Finalizar tarea
Para finalizar se debe poner link final de Drive.
Al finalizar:
- Estado pasa a `pendiente_aprobacion`
- Se manda a Aprobaciones

### Aprobaciones
Nueva lógica:
- Ver pendientes de aprobación
- Abrir link final
- Aprobar
- No aprobar con motivo:
  - Errores ortográficos
  - Copy no alineado
  - Diseño no alineado a marca
  - Formato incorrecto
  - Material incorrecto
  - Falta información
  - No cumple objetivo
  - Baja calidad visual
  - Otro

Si no se aprueba, regresa a `en_revision`.
