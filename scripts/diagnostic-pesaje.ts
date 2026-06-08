/**
 * Diagnóstico: verificar qué constraints/índices existen en PesajeCamion
 * y probar inserción directa via SQL para las 6 tropas faltantes.
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  DIAGNÓSTICO: Constraints en PesajeCamion')
  console.log('═══════════════════════════════════════════\n')

  // 1) Listar TODOS los constraints de la tabla
  console.log('── CONSTRAINTS EN "PesajeCamion" ──')
  const constraints = await db.$queryRawUnsafe(`
    SELECT
      c.conname AS name,
      c.contype AS type,
      pg_get_constraintdef(c.oid) AS definition,
      array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum)) AS columns
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = '"PesajeCamion"'::regclass
    GROUP BY c.conname, c.contype, c.oid
    ORDER BY c.contype, c.conname
  `)
  console.log(JSON.stringify(constraints, null, 2))

  // 2) Listar TODOS los índices de la tabla
  console.log('\n── ÍNDICES EN "PesajeCamion" ──')
  const indexes = await db.$queryRawUnsafe(`
    SELECT
      i.indexname AS name,
      i.indexdef AS definition
    FROM pg_indexes i
    WHERE i.tablename = 'PesajeCamion'
      AND i.schemaname = 'public'
    ORDER BY i.indexname
  `)
  console.log(JSON.stringify(indexes, null, 2))

  // 3) Verificar si hay índices unique sobre numeroTicket
  console.log('\n── ÍNDICES UNIQUE CON numeroTicket ──')
  const uniqueIdx = await db.$queryRawUnsafe(`
    SELECT
      i.relname AS index_name,
      ix.indisunique AS is_unique,
      array_agg(a.attname ORDER BY array_position(ix.indkey::int[], a.attnum)) AS columns
    FROM pg_index ix
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = ANY(ix.indkey)
    WHERE ix.indrelid = '"PesajeCamion"'::regclass
      AND ix.indisunique = true
    GROUP BY i.relname, ix.indisunique
    ORDER BY i.relname
  `)
  console.log(JSON.stringify(uniqueIdx, null, 2))

  // 4) Probar inserción directa via raw SQL con un ticket duplicado (ticket 14463 ya existe)
  console.log('\n── PRUEBA DE INSERCIÓN DIRECTA VIA RAW SQL ──')
  try {
    const tropa3 = await db.tropa.findFirst({ where: { numero: 3 } })
    if (tropa3) {
      console.log(`Tropa 3 encontrada: id=${tropa3.id}`)
      console.log('Intentando INSERT directo con numeroTicket=14463 (duplicado)...')

      const result = await db.$executeRawUnsafe(`
        INSERT INTO "PesajeCamion" (
          id, tipo, "numeroTicket", "patenteChasis", "patenteAcoplado",
          "choferNombre", "choferDni", "pesoBruto", "pesoTara", "pesoNeto",
          estado, fecha, "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid()::text, 'INGRESO_HACIENDA', 14463, 'HQX098', 'IEJ607',
          'ROMERO EMANUEL', NULL, 30740, 15460, 15280,
          'CERRADO', '2026-01-03T18:30:00.000Z', NOW(), NOW()
        ) RETURNING id, "numeroTicket"
      `)
      console.log('✅ INSERT directo EXITOSO:', result)
    } else {
      console.log('⚠️ Tropa 3 no encontrada')
    }
  } catch (err: any) {
    console.log(`❌ INSERT directo FALLÓ: ${err.message}`)
    console.log(`   Código: ${err.code}`)
    console.log(`   Detalle: ${err.detail}`)
    console.log(`   Constraint: ${err.constraint}`)
  }

  // 5) Listar pesajes existentes con los tickets duplicados
  console.log('\n── PESAJES EXISTENTES CON TICKETS DUPLICADOS ──')
  const dupes = await db.$queryRawUnsafe(`
    SELECT "numeroTicket", COUNT(*) as qty
    FROM "PesajeCamion"
    WHERE "numeroTicket" IN (14463, 14468, 14469, 14472, 14498)
    GROUP BY "numeroTicket"
    ORDER BY "numeroTicket"
  `)
  console.log(JSON.stringify(dupes, null, 2))

  console.log('\n═══════════════════════════════════════════')
  console.log('  FIN DEL DIAGNÓSTICO')
  console.log('═══════════════════════════════════════════')
}

main()
  .catch(err => {
    console.error('❌ Error fatal:', err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
