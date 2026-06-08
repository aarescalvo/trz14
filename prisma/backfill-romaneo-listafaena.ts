/**
 * Script para backfill: propagar listaFaenaId desde AsignacionGarron a Romaneo
 * 
 * Estrategia v2:
 * 1. Obtener TODAS las AsignacionGarron que tienen listaFaenaId (en un solo query)
 * 2. Agruparlas por garron, quedándose con la más cercana en fecha al romaneo
 * 3. Batch update de romaneos
 * 
 * Uso: npx tsx prisma/backfill-romaneo-listafaena.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('=== Backfill listaFaenaId en Romaneos (v2) ===\n')

  // 1. Primero: diagnóstico rápido
  const totalRomaneos = await db.romaneo.count()
  const romaneosConLista = await db.romaneo.count({ where: { listaFaenaId: { not: null } } })
  const romaneosSinLista = await db.romaneo.count({ where: { listaFaenaId: null } })
  const asignacionesConLista = await db.asignacionGarron.count({ where: { listaFaenaId: { not: null } } })
  const asignacionesSinLista = await db.asignacionGarron.count({ where: { listaFaenaId: null } })
  
  console.log('--- Diagnóstico ---')
  console.log(`Romaneos totales: ${totalRomaneos}`)
  console.log(`Romaneos CON listaFaenaId: ${romaneosConLista}`)
  console.log(`Romaneos SIN listaFaenaId: ${romaneosSinLista}`)
  console.log(`Asignaciones CON listaFaenaId: ${asignacionesConLista}`)
  console.log(`Asignaciones SIN listaFaenaId: ${asignacionesSinLista}`)
  console.log('')

  if (romaneosSinLista === 0) {
    console.log('No hay romaneos para actualizar. Todo OK.')
    return
  }

  if (asignacionesConLista === 0) {
    console.log('ERROR: No hay asignaciones con listaFaenaId. No se puede vincular nada.')
    console.log('Primero hay que ejecutar un backfill de listaFaenaId en AsignacionGarron.')
    return
  }

  // 2. Obtener todas las asignaciones con listaFaenaId (cargado en memoria)
  console.log('Cargando asignaciones con listaFaenaId...')
  const asignaciones = await db.asignacionGarron.findMany({
    where: { listaFaenaId: { not: null } },
    select: {
      id: true,
      garron: true,
      listaFaenaId: true,
      horaIngreso: true,
    },
    orderBy: { horaIngreso: 'desc' },
  })
  console.log(`Asignaciones cargadas: ${asignaciones.length}`)

  // 3. Indexar por garron: Map<garron, AsignacionGarron[]>
  const asignacionesPorGarron = new Map<number, typeof asignaciones>()
  for (const a of asignaciones) {
    const g = a.garron as number
    if (!asignacionesPorGarron.has(g)) {
      asignacionesPorGarron.set(g, [])
    }
    asignacionesPorGarron.get(g)!.push(a)
  }
  console.log(`Garrones con asignación: ${asignacionesPorGarron.size}`)

  // 4. Obtener romaneos sin listaFaenaId (paginado para no saturar memoria)
  console.log('Procesando romaneos sin listaFaenaId...')
  let actualizados = 0
  let sinMatch = 0
  let errores = 0
  const BATCH_SIZE = 500
  let skip = 0

  while (true) {
    const romaneos = await db.romaneo.findMany({
      where: { listaFaenaId: null },
      select: {
        id: true,
        garron: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: BATCH_SIZE,
    })

    if (romaneos.length === 0) break

    for (const romaneo of romaneos) {
      const g = romaneo.garron as number
      // Buscar la asignación más cercana en tiempo para este garrón
      const candidates = asignacionesPorGarron.get(g)
      
      if (!candidates || candidates.length === 0) {
        sinMatch++
        continue
      }

      // Buscar la asignación más cercana en fecha al romaneo
      let best: typeof asignaciones[0] | null = null
      let bestDiff = Infinity
      for (const c of candidates) {
        const diff = Math.abs(romaneo.createdAt.getTime() - c.horaIngreso.getTime())
        // Solo considerar asignaciones dentro de 48 horas
        if (diff < 48 * 60 * 60 * 1000 && diff < bestDiff) {
          bestDiff = diff
          best = c
        }
      }

      if (best) {
        try {
          await db.romaneo.update({
            where: { id: romaneo.id },
            data: { listaFaenaId: best.listaFaenaId! },
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

  console.log(`\n=== Resumen ===`)
  console.log(`Total romaneos sin listaFaenaId: ${romaneosSinLista}`)
  console.log(`Actualizados: ${actualizados}`)
  console.log(`Sin asignación cercana: ${sinMatch}`)
  console.log(`Errores: ${errores}`)
  
  // Verificación final
  const quedanSinLista = await db.romaneo.count({ where: { listaFaenaId: null } })
  console.log(`Romaneos que quedan sin listaFaenaId: ${quedanSinLista}`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
