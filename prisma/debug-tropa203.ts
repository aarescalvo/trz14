/**
 * Debug: Verificar datos de tropa 203
 * Ejecutar: npx tsx prisma/debug-tropa203.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('=== DEBUG TROPA 203 ===\n')

  // 1. Buscar tropa 203
  const tropa = await db.tropa.findFirst({
    where: { numero: 203 },
    select: { id: true, numero: true, codigo: true, fechaFaena: true }
  })
  console.log('TROPA:', tropa)

  if (!tropa) {
    console.log('No se encontró tropa 203')
    return
  }

  // 2. Buscar planilla de servicio faena para tropa 203
  const planilla = await db.planillaServicioFaena.findFirst({
    where: { numeroTropa: 203 },
    select: { id: true, numeroTropa: true, tropaId: true, usuario: true, fechaFaena: true }
  })
  console.log('\nPLANILLA SERVICIO FAENA:', planilla)

  // 3. Buscar planillas vinculadas por tropaId
  const planillasVinculadas = await db.planillaServicioFaena.findMany({
    where: { tropaId: tropa.id },
    select: { id: true, numeroTropa: true, tropaId: true, usuario: true, fechaFaena: true }
  })
  console.log('\nPLANILLAS VINCULADAS (por tropaId):', planillasVinculadas)

  // 4. Buscar detalle tropa
  const detalle = await db.detalleTropaFaena.findFirst({
    where: { numeroTropa: 203 },
    select: { id: true, tropaId: true, numeroTropa: true, mes: true, usuario: true }
  })
  console.log('\nDETALLE TROPA:', detalle)

  // 5. Todas las planillas con numeroTropa 200-203
  const planillasRango = await db.planillaServicioFaena.findMany({
    where: { numeroTropa: { gte: 195, lte: 203 } },
    select: { numeroTropa: true, fechaFaena: true, tropaId: true, usuario: true },
    orderBy: { numeroTropa: 'asc' }
  })
  console.log('\nPLANILLAS 195-203:')
  for (const p of planillasRango) {
    const fecha = p.fechaFaena ? p.fechaFaena.toISOString().split('T')[0] : 'SIN FECHA'
    console.log(`  Tropa ${p.numeroTropa}: ${fecha} | tropaId: ${p.tropaId || 'NULL'} | usuario: ${p.usuario}`)
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
