/**
 * Script para backfill: propagar listaFaenaId desde AsignacionGarron a Romaneo
 * 
 * Los romaneos creados antes del fix no tienen listaFaenaId.
 * Este script los vincula usando el garrón + fecha.
 * 
 * Uso: npx tsx prisma/backfill-romaneo-listafaena.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('=== Backfill listaFaenaId en Romaneos ===\n')

  // Buscar todos los romaneos que NO tienen listaFaenaId
  const romaneosSinLista = await db.romaneo.findMany({
    where: {
      listaFaenaId: null,
    },
    select: {
      id: true,
      garron: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  console.log(`Se encontraron ${romaneosSinLista.length} romaneos sin listaFaenaId`)

  let actualizados = 0
  let sinAsignacion = 0

  for (const romaneo of romaneosSinLista) {
    // Buscar la AsignacionGarron para este garrón en la misma fecha
    const fechaRef = new Date(romaneo.createdAt)
    fechaRef.setHours(0, 0, 0, 0)

    const asignacion = await db.asignacionGarron.findFirst({
      where: {
        garron: romaneo.garron,
        horaIngreso: {
          gte: fechaRef,
          lt: new Date(fechaRef.getTime() + 24 * 60 * 60 * 1000),
        },
        listaFaenaId: { not: null },
      },
      select: {
        id: true,
        garron: true,
        listaFaenaId: true,
      },
    })

    if (asignacion && asignacion.listaFaenaId) {
      await db.romaneo.update({
        where: { id: romaneo.id },
        data: { listaFaenaId: asignacion.listaFaenaId },
      })
      actualizados++
      console.log(`  ✓ Romaneo ${romaneo.id} (garrón ${romaneo.garron}) → listaFaenaId: ${asignacion.listaFaenaId}`)
    } else {
      sinAsignacion++
      console.log(`  ✗ Romaneo ${romaneo.id} (garrón ${romaneo.garron}) sin asignación con listaFaenaId`)
    }
  }

  console.log(`\n=== Resumen ===`)
  console.log(`Total procesados: ${romaneosSinLista.length}`)
  console.log(`Actualizados: ${actualizados}`)
  console.log(`Sin asignación: ${sinAsignacion}`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
