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

---
Task ID: 3
Agent: Main Agent
Task: Fix control de pH - tropas no encontradas + filtros en reportes + productor dropdown

Work Log:
- Investigado el bug "no se encontraron tropas" en control de pH
- Causa 1: La API /api/tropas ignoraba el parámetro fechaDesde (no se usaba en la query)
- Causa 2: La API /api/medias-res requería permiso puedeRomaneo pero los usuarios de Calidad solo tienen puedeCalidad
- Fix 1: Agregado soporte para fechaDesde/fechaHasta en /api/tropas (filtra por fechaFaena o createdAt)
- Fix 1b: Refactorizado la construcción del where clause en /api/tropas para combinar correctamente condiciones AND/OR
- Fix 2: Cambiado permiso de /api/medias-res GET de checkPermission('puedeRomaneo') a checkAnyPermission(['puedeRomaneo', 'puedeCalidad', 'puedeReportes'])
- Fix 3: Mejorado API /api/calidad-ph/reportes para que los filtros de peso (kg), clasificación pH, tipo animal y rango pH funcionen en TODOS los sub-tabs (resumen, detalle, dfd-productor, control-estadistico)
- Antes solo funcionaban en el sub-tab "detalle", ahora generanResumen, generarCorrelacionDFD y generarControlEstadistico usan buildCommonWhere
- Fix 4: Agregado endpoint dedicado /api/calidad-ph/reportes?modo=productores para cargar la lista de productores del dropdown
- Fix 5: Actualizado el componente ReportesPHTab para enviar todos los filtros a todos los sub-tabs (no solo a detalle)
- Fix 6: Actualizado la carga de productores para usar el nuevo endpoint dedicado (más eficiente)

Archivos modificados:
- src/app/api/tropas/route.ts (fechaDesde filter + where clause refactor)
- src/app/api/medias-res/route.ts (permiso puedeCalidad)
- src/app/api/calidad-ph/reportes/route.ts (filtros globales + endpoint productores)
- src/components/calidad-ph/index.tsx (filtros globales + productor endpoint)

Stage Summary:
- El bug "no se encontraron tropas" debería estar resuelto con los dos fixes (fechaDesde + permisos)
- Los filtros de reportes (peso, clasificación, tipo animal, pH) ahora funcionan en todos los sub-tabs
- El dropdown de productores usa un endpoint dedicado más eficiente
- Pendiente: push a GitHub trz11
---
Task ID: 1
Agent: main
Task: Revision completa, corregir .env, arreglar build, y push a GitHub

Work Log:
- Descubierto que .env estaba cometido en git con config SQLite del servidor, sobrescribiendo la config PostgreSQL del usuario
- .env.example no tenia JWT_SECRET ni otras variables necesarias
- stocks-corrales/index.tsx tenia error TypeScript (null no asignable a Partial<Fill>)
- Removido .env del tracking de git (git rm --cached)
- Actualizado .env.example con todas las variables: DATABASE_URL, JWT_SECRET, COOKIE_SECURE, NEXT_PUBLIC_APP_URL, ENCRYPTION_KEY, BACKUP_DIR
- Corregido stocks-corrales: null->undefined en setCell, parametros opcionales
- Build compila exitosamente
- Commit 198c3cf push a GitHub

Stage Summary:
- .env removido del tracking git (ya no sobrescribe al usuario)
- .env.example actualizado con todas las variables necesarias
- stocks-corrales TypeScript fix aplicado
- Build exitoso, subido a GitHub
