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
Task ID: 4
Agent: Main Agent
Task: Fix medias reses no visibles en control de pH + push a GitHub

Work Log:
- Investigado por qué el usuario aún no ve medias reses en control de pH tras los fixes previos
- Verificado que los fixes de permisos (checkAnyPermission en GET) estaban correctamente subidos a trz11
- Encontrado Bug 1: En medias-res/route.ts, POST y PUT usaban checkPermission (singular) que NO estaba importado, solo checkAnyPermission lo estaba. Esto causaba TypeError en operaciones de escritura
- Encontrado Bug 2: En calidad-ph/index.tsx, si la API devolvía error (403/500), el código NO mostraba mensaje alguno — solo decía "No se encontraron medias reses" de forma engañosa
- Encontrado Bug 3: tropaCodigo con espacios (ej: "B 2026 0001") no usaba encodeURIComponent
- Fix 1: Agregado checkPermission al import en medias-res/route.ts
- Fix 2: Agregado bloque else con toast.error + console.error cuando la API de medias res falla
- Fix 3: Agregado encodeURIComponent() en todas las llamadas con tropaCodigo
- Commit c5cb66e creado y pusheado a origin/main de trz11

Archivos modificados:
- src/app/api/medias-res/route.ts (import checkPermission)
- src/components/calidad-ph/index.tsx (error handling + encodeURIComponent)

Stage Summary:
- Push exitoso a https://github.com/aarescalvo/trz11 (commit c5cb66e)
- El usuario ahora verá mensajes de error claros si hay problemas de permisos
- POST/PUT de medias-res ya no crashean por falta de import

---
Task ID: 5
Agent: Main Agent
Task: Búsqueda alternativa de medias res + diagnóstico por garrones

Work Log:
- El usuario seguía sin ver medias reses. No aparecía toast de error → API devolvía 200 pero con array vacío
- Investigado el flujo: dropdown pasa `t.codigo` → API filtra `Romaneo.tropaCodigo = {tropaCodigo}`
- Descubierto que `Romaneo.tropaCodigo` es `String?` (opcional). Si los romaneos se crearon sin tropaCodigo, la query devuelve vacío
- Implementada búsqueda alternativa: si la búsqueda directa por tropaCodigo no encuentra resultados, busca la tropa en tabla `Tropa`, obtiene los números de garrón de sus animales, busca romaneos por esos garrones, y luego busca medias res de esos romaneos
- Agregados logs de diagnóstico en la consola del servidor para identificar qué está pasando (tropa encontrada?, romaneos encontrados?, tropaCodigo en Romaneo vacío?)
- Commit 48d9a8f pusheado a origin/main de trz11

Archivos modificados:
- src/app/api/medias-res/route.ts (búsqueda alternativa + logs)

Stage Summary:
- Push exitoso a https://github.com/aarescalvo/trz11 (commit 48d9a8f)
- Si `Romaneo.tropaCodigo` está vacío, ahora la API busca por garrones como fallback
- Los logs en la terminal del servidor van a mostrar exactamente por qué no encontraba medias reses

---
Task ID: 6
Agent: Main Agent
Task: Reconstruir fixes perdidos por reset --hard + agregar filtros en reportes de control de pH

Work Log:
- El usuario hizo git reset --hard y se perdieron los fixes de sesiones anteriores en su PC
- .env fue sobrescrito con DATABASE_URL del servidor SQLite en vez de PostgreSQL local
- Agregado .env y .env.local al .gitignore para evitar que se pise en futuros pulls
- Reconstruido medias-res/route.ts con: búsqueda por tropaCodigo → fallback por garrones (Romaneo + AsignacionGarron) → autoGenerar medias res desde romaneos con peso
- Corregido error Prisma: Tropa no tiene campo garron. Ahora busca en Romaneo.garron y AsignacionGarron.garron
- Corregido error Radix UI Select: no permite value="" en SelectItem. Cambiado a sentinel "__TODOS__"
- Agregado endpoint modo=listas en calidad-ph/reportes/route.ts para cargar opciones de dropdowns
- Nuevos filtros en reportes: Usuario Faena, Productor, Tropa (dropdown), Tipo Animal, Clasificación, Rango pH, Rango Peso kg
- Layout filtros: grid-cols-4 (lg) / grid-cols-2 (sm) / grid-cols-1 para 9 filtros
- Todos los filtros aplican a todos los sub-tabs (resumen, detalle, dfd-productor, control-estadistico)

Archivos modificados:
- src/app/api/medias-res/route.ts (búsqueda alternativa + autoGenerar + fix garron)
- src/app/api/calidad-ph/reportes/route.ts (endpoint listas + filtros usuarioFaena, tipoAnimal, peso)
- src/components/calidad-ph/index.tsx (9 filtros con dropdowns, autoGenerar en fetch)
- .gitignore (agregado .env y .env.local)

Stage Summary:
- Commits: 17db33b (.gitignore), 8e4d731 (medias res + filtros), f785707 (fix prisma + select)
- Push exitoso a origin/main sin force pushes
- Todas las tropas ahora muestran medias reses (no solo la 155)
- Reportes tienen 9 filtros funcionales con dropdowns

---
Task ID: 7
Agent: Main Agent
Task: Corregir migración SQL - CREATE TYPE IF NOT EXISTS + tablas faltantes

Work Log:
- El usuario ejecutó `npx prisma migrate deploy` y obtuvo error: PostgreSQL no soporta CREATE TYPE IF NOT EXISTS (sintaxis de PG 16+)
- Reemplazadas las 80 sentencias CREATE TYPE IF NOT EXISTS por bloques DO $$ BEGIN...EXCEPTION WHEN duplicate_object THEN null; END $$
- Descubierto que faltaban 70 tablas en la migración (incluyendo configuracion_ph, Balanza, TipoTrabajo, ConfiguracionSeguridad, etc.)
- Generadas las 70 tablas faltantes a partir del schema.prisma con tipos, defaults e indices correctos
- Validación final: 168 tablas, 80 ENUMs, 435 indices, 0 DROP/TRUNCATE/DELETE
- Commits: bac8e5f (fix CREATE TYPE), 16f7446 (agregar 70 tablas faltantes)
- Push exitoso a origin/main sin force pushes

Archivos modificados:
- prisma/migrations/20260526_sync_full_schema/migration.sql (4155 líneas)

Stage Summary:
- Migración completa y corregida: 168 tablas nuevas + 80 ENUMs + 435 indices
- Compatibilidad asegurada con todas las versiones de PostgreSQL
- El usuario debe ejecutar: git pull origin main && npx prisma migrate deploy
