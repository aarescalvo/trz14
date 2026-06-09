import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const ahora = new Date()

  // 1. Actualizar todas las tropas del 1 al 203 a estado DESPACHADO
  console.log('=== Actualizando tropas 1-203 a DESPACHADO ===')
  const resultTropas = await db.tropa.updateMany({
    where: {
      numero: { gte: 1, lte: 203 }
    },
    data: {
      estado: 'DESPACHADO'
    }
  })
  console.log(`Tropas actualizadas: ${resultTropas.count}`)

  // 2. Obtener todas las listas de faena vinculadas a esas tropas
  console.log('\n=== Buscando listas de faena de esas tropas ===')
  const listasTropas = await db.listaFaenaTropa.findMany({
    where: {
      tropa: { numero: { gte: 1, lte: 203 } }
    },
    select: { listaFaenaId: true }
  })
  const listaIds = [...new Set(listasTropas.map(lt => lt.listaFaenaId))]
  console.log(`Listas de faena encontradas: ${listaIds.length}`)

  // 3. Actualizar VB Romaneo en esas listas
  if (listaIds.length > 0) {
    console.log('\n=== Otorgando VB Romaneo ===')
    const resultVB = await db.listaFaena.updateMany({
      where: { id: { in: listaIds } },
      data: {
        vbRomaneo: true,
        vbRomaneoFecha: ahora,
        estado: 'CERRADA'
      }
    })
    console.log(`Listas actualizadas con VB: ${resultVB.count}`)
  }

  // 3b. También actualizar listas que no tengan tropas vinculadas pero pertenezcan al rango
  console.log('\n=== Verificando listas sin tropas vinculadas ===')
  const listasDirectas = await db.listaFaena.findMany({
    where: {
      id: { notIn: listaIds },
      asignaciones: {
        some: {
          tropaCodigo: { not: null }
        }
      }
    },
    select: { id: true, numero: true, asignaciones: { select: { tropaCodigo: true }, take: 1 } }
  })

  // Resumen final
  console.log('\n=== RESUMEN ===')
  const tropasFinal = await db.tropa.count({ where: { numero: { gte: 1, lte: 203 }, estado: 'DESPACHADO' } })
  const listasVB = await db.listaFaena.count({ where: { vbRomaneo: true } })
  console.log(`Tropas DESPACHADO (1-203): ${tropasFinal}`)
  console.log(`Total listas con VB otorgado: ${listasVB}`)

  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})