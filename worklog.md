---
Task ID: 1
Agent: Super Z (main)
Task: Implementar módulo DETALLE dentro de Facturación con datos de 203 tropas

Work Log:
- Leído Excel "detalle modelo kevin.xlsx" (hoja DETALLE) con 437 filas, 203 tropas válidas
- Extraídos datos a JSON: /download/detalle_tropas.json
- Creado modelo Prisma `DetalleTropaFaena` con relación a Tropa
- Creado API route `/api/facturacion/detalle-tropa` con GET/POST/PUT/DELETE
- API soporta filtros: desde, hasta, usuario, periodo (SEMANAL/MENSUAL/ANUAL), mes, año, tropa
- Creado seed script `prisma/seed-detalle.ts` que carga 203 tropas y registra precios históricos
- Creado componente `DetalleTropaTab.tsx` con tabla completa, KPIs, resumen por usuario, subproductos
- Integrado tab DETALLE en FacturacionModule (grid-cols-7)
- Agregado BarChart3 a imports de facturacion/index.tsx
- TypeScript compila sin errores
- Next.js build exitoso

Stage Summary:
- Archivos creados: schema.prisma (modelo), api route, seed script, componente DetalleTropaTab
- Archivos modificados: facturacion/index.tsx (import, tab, TabsList cols)
- Datos JSON listos: /download/detalle_tropas.json (203 registros)
- Precios: $335 (ene-abr), $420 (may-jun), $440 (jul-ago), $500 (sep-dic)
- Seed script: `npx tsx prisma/seed-detalle.ts` (ejecutar en máquina del usuario)
- Migration: `npx prisma db push` (ejecutar en máquina del usuario)
