---
Task ID: 1
Agent: Main Agent
Task: Corregir error al crear productor - modelo ProductorConsignatario faltante

Work Log:
- Investigado el error: el modelo ProductorConsignatario y el enum TipoProductor no existían en prisma/schema.prisma activo
- Verificado que la API route /api/productores usa db.productorConsignatario.create()
- Encontrado el modelo en schema-postgresql-original.prisma pero no migrado al schema activo
- Agregado el modelo ProductorConsignatario con todos sus campos al schema.prisma activo
- Agregado el enum TipoProductor (PRODUCTOR, CONSIGNATARIO, AMBOS)
- Relaciones de Tropa/DeclaracionJurada no incluidas para evitar conflicto con Cliente
- Generado Prisma client exitosamente (prisma@6 generate)
- Creada migración SQL manual en prisma/migrations/20260515_add_productor_consignatario/migration.sql
- Commit creado localmente: "fix: agregar modelo ProductorConsignatario faltante al schema.prisma"
- Push falló por falta de credenciales GitHub en este entorno

Stage Summary:
- El modelo ProductorConsignatario fue agregado al schema.prisma y el Prisma client regenerado
- Se necesita: (1) push al repo, (2) ejecutar la migración SQL en la base de datos PostgreSQL del usuario, (3) reiniciar la app

---
Task ID: 2
Agent: Main Agent
Task: Fix ListaFaena historial no muestra datos + mejorar historial

Work Log:
- Descubierto que los cambios de la sesión anterior (seed ListaFaena PASO 13) estaban en rama `main`, pero la rama por defecto es `master`
- Las ramas `master` y `main` tienen historias NO relacionadas (unrelated histories)
- Verificada la API `/api/lista-faena` - hace findMany SIN filtros, debería devolver todas las listas
- Verificado el componente frontend - el historial muestra `listas.map()` correctamente
- Mejorado el componente historial: ahora muestra N° de lista, fecha completa, cantidad de tropas, cantidad total, con scroll de 500px
- Agregado click en fila para ver detalle de la lista en tab "Lista Actual"
- Commiteado y subido a `origin/main` (commit 7b56850)

Stage Summary:
- El problema era que el usuario está en `master` pero los cambios están en `main`
- El usuario debe cambiar a rama `main` con: `git checkout main && git pull origin main`
- Luego ejecutar seed: `bun run db:seed` para generar las 71 listas históricas
- Historial mejorado con: N° lista, fecha, tropas, cantidad, scroll, click para detalle
