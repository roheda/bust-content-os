# BUST Content OS — Integración BUST It Now v1.1

## Fix de deploy

Se corrigió error en Creador de Solicitudes:

`loadDrafts` no existía en esta versión del archivo.

Ahora, al eliminar un borrador, recarga la página después de eliminar para actualizar la lista sin romper el build.

Mantiene:
- botón de eliminar borradores con confirmación,
- soft delete de solicitudes,
- clientes compartidos con BUST It Now,
- módulo Generador,
- envío desde Tareas al Generador.
