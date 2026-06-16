# BUST Content OS — Operational v2.5

## Producciones: material por post

Se mantiene el link general de producción, pero ahora también se puede capturar un link por cada solicitud/post incluido en la producción.

### Lógica

- Link general: carpeta completa de producción.
- Link por post: material exacto para cada solicitud.
- Al marcar Material entregado:
  - cada solicitud recibe su link individual.
  - si no tiene link individual, toma el link general como respaldo.
  - si no hay link individual ni general, el sistema bloquea la entrega.

Esto evita que una solicitud quede con una carpeta genérica cuando realmente necesita el asset exacto.
