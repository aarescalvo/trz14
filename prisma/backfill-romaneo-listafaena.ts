/**
 * Script para backfill: propagar listaFaenaId desde AsignacionGarron a Romaneo
 * 
 * Estrategia: Match directo por garron.
 * Cada AsignacionGarron ya tiene listaFaenaId y el garron coincide
 * exactamente con el numero de garron del Romaneo.
 * Solo copiamos el listaFaenaId de la asignacion al romaneo.
 * 
 * Uso: npx tsx prisma/backfill-romaneo-listafaena.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('=== Backfill listaFaenaId en Romaneos (match por garron) ===\n')

  // 1. Diagnostico
  const totalRomaneos = await db.romaneo.count()
  const romaneosConLista = await db.romaneo.count({ where: { listaFaenaId: { not: null } } })
  const romaneosSinLista = await db.romaneo.count({ where: { listaFaenaId: null } })
  const asignacionesConLista = await db.asignacionGarron.count({ where: { listaFaenaId: { not: null } } })
  
  console.log('--- Diagnostico ---')
  console.log(`Romaneos totales: ${totalRomaneos}`)
  console.log(`Romaneos CON listaFaenaId: ${romaneosConLista}`)
  console.log(`Romaneos SIN listaFaenaId: ${romaneosSinLista}`)
  console.log(`Asignaciones CON listaFaenaId: ${asignacionesConLista}`)
  console.log('')

  if (romaneosSinLista === 0) {
    console.log('No hay romaneos para actualizar. Todo OK.')
    return
  }

  // 2. Cargar todas las asignaciones con listaFaenaId, indexadas por garron
  console.log('Cargando asignaciones con listaFaenaId...')
  const asignaciones = await db.asignacionGarron.findMany({
    where: { listaFaenaId: { not: null } },
    select: {
      garron: true,
      listaFaenaId: true,
      tropaCodigo: true,
    },
  })
  console.log(`Asignaciones cargadas: ${asignaciones.length}`)

  // Indexar por garron -> listaFaenaId
  // Si un mismo garron aparece en multiples asignaciones, tomamos la ultima
  const garronToLista = new Map<number, string>()
  for (const a of asignaciones) {
    garronToLista.set(a.garron as number, a.listaFaenaId!)
  }
  console.log(`Garrones unicos en asignaciones: ${garronToLista.size}`)

  // 3. Procesar romaneos sin listaFaenaId
  console.log('\nProcesando romaneos...')
  let actualizados = 0
  let sinMatch = 0
  let errores = 0
  const BATCH_SIZE = 500
  let skip = 0

  while (true) {
    const romaneos = await db.romaneo.findMany({
      where: { listaFaenaId: null },
      select: { id: true, garron: true },
      skip,
      take: BATCH_SIZE,
    })

    if (romaneos.length === 0) break

    for (const romaneo of romaneos) {
      const listaId = garronToLista.get(romaneo.garron as number)

      if (listaId) {
        try {
          await db.romaneo.update({
            where: { id: romaneo.id },
            data: { listaFaenaId: listaId },
          })
          actualizados++
        } catch (e) {
          errores++
          if (errores <= 5) {
            console.error(`  ERROR actualizando romaneo ${romaneo.id}:`, e)
          }
        }
      } else {
        sinMatch++
      }
    }

    skip += romaneos.length
    console.log(`  Procesados ${skip}/${romaneosSinLista} (actualizados: ${actualizados}, sin match: ${sinMatch})`)

    if (romaneos.length < BATCH_SIZE) break
  }

  console.log(`\n=== Resumen Final ===`)
  console.log(`Total romaneos sin listaFaenaId: ${romaneosSinLista}`)
  console.log(`Actualizados: ${actualizados}`)
  console.log(`Sin match (garron sin asignacion): ${sinMatch}`)
  console.log(`Errores: ${errores}`)
  
  const quedanSinLista = await db.romaneo.count({ where: { listaFaenaId: null } })
  console.log(`Romaneos que quedan sin listaFaenaId: ${quedanSinLista}`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
