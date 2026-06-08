/**
 * Script para backfill: propagar listaFaenaId desde AsignacionGarron a Romaneo
 * 
 * Estrategia v3: Match EXACTO por garrón + tropaCodigo
 * El romaneo y la asignación deben coincidir en:
 *   - MISMO número de garrón
 *   - MISMO código de tropa
 * Los datos deben ser ciertos, no aproximados por fecha.
 * 
 * Uso: npx tsx prisma/backfill-romaneo-listafaena.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('=== Backfill listaFaenaId en Romaneos (v3 - match exacto) ===\n')

  // 1. Diagnóstico
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
    console.log('ERROR: No hay asignaciones con listaFaenaId.')
    console.log('No se puede vincular nada sin asignaciones que tengan listaFaenaId.')
    
    // Mostrar sample de asignaciones para diagnosticar
    const sample = await db.asignacionGarron.findMany({
      take: 10,
      select: { garron: true, tropaCodigo: true, listaFaenaId: true, horaIngreso: true },
      orderBy: { horaIngreso: 'desc' },
    })
    console.log('\nSample de asignaciones (últimas 10):')
    for (const s of sample) {
      console.log(`  Garrón ${s.garron} | Tropa ${s.tropaCodigo || 'SIN-TROPA'} | listaFaenaId: ${s.listaFaenaId || 'NULL'} | ${s.horaIngreso}`)
    }
    return
  }

  // 2. Cargar todas las asignaciones con listaFaenaId
  console.log('Cargando asignaciones con listaFaenaId...')
  const asignaciones = await db.asignacionGarron.findMany({
    where: { listaFaenaId: { not: null } },
    select: {
      id: true,
      garron: true,
      tropaCodigo: true,
      listaFaenaId: true,
      horaIngreso: true,
    },
    orderBy: { horaIngreso: 'desc' },
  })
  console.log(`Asignaciones cargadas: ${asignaciones.length}`)

  // 3. Indexar por clave compuesta: "GARRON|TROPA" -> listaFaenaId
  // Si un mismo garrón+tropa aparece en múltiples listas (reabierta), tomar la más reciente
  const index = new Map<string, { listaFaenaId: string; horaIngreso: Date }>()
  for (const a of asignaciones) {
    const g = a.garron as number
    const t = a.tropaCodigo || 'SIN-TROPA'
    const key = `${g}|${t}`
    
    if (!index.has(key)) {
      index.set(key, { listaFaenaId: a.listaFaenaId!, horaIngreso: a.horaIngreso })
    }
    // Si ya existe, la que ya está es más reciente (ordenamos desc)
  }
  console.log(`Claves únicas garrón|tropa: ${index.size}`)

  // 4. Mostrar distribución de tropas en asignaciones
  const tropasEnAsignaciones = new Set<string>()
  for (const a of asignaciones) {
    tropasEnAsignaciones.add(a.tropaCodigo || 'SIN-TROPA')
  }
  console.log(`Tropas distintas en asignaciones: ${tropasEnAsignaciones.size}`)

  // 5. Mostrar distribución de tropas en romaneos sin lista
  const romaneosSample = await db.romaneo.findMany({
    where: { listaFaenaId: null },
    select: { garron: true, tropaCodigo: true },
    take: 20,
    distinct: ['tropaCodigo'],
  })
  const tropasEnRomaneos = new Set(romaneosSample.map(r => r.tropaCodigo || 'SIN-TROPA'))
  console.log(`Tropas distintas en romaneos sin lista (sample): ${tropasEnRomaneos.size}`)
  
  // Verificar overlap
  let overlap = 0
  for (const t of tropasEnRomaneos) {
    if (tropasEnAsignaciones.has(t)) overlap++
  }
  console.log(`Tropas en común: ${overlap}/${tropasEnRomaneos.size}`)
  
  if (overlap === 0) {
    console.log('\n⚠️  ADVERTENCIA: No hay tropas en común entre romaneos y asignaciones.')
    console.log('Mostrando tropas en asignaciones:')
    for (const t of [...tropasEnAsignaciones].sort().slice(0, 20)) {
      console.log(`  - ${t}`)
    }
    console.log('Mostrando tropas en romaneos:')
    for (const t of [...tropasEnRomaneos].sort().slice(0, 20)) {
      console.log(`  - ${t}`)
    }
    console.log('\nNo se puede hacer el backfill. Las tropas no coinciden.')
    return
  }

  // 6. Procesar romaneos con match exacto: garrón + tropaCodigo
  console.log('\nProcesando romaneos sin listaFaenaId (match exacto garrón + tropa)...')
  let actualizados = 0
  let sinMatch = 0
  let sinTropa = 0
  let errores = 0
  const BATCH_SIZE = 500
  let skip = 0

  while (true) {
    const romaneos = await db.romaneo.findMany({
      where: { listaFaenaId: null },
      select: {
        id: true,
        garron: true,
        tropaCodigo: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: BATCH_SIZE,
    })

    if (romaneos.length === 0) break

    for (const romaneo of romaneos) {
      const g = romaneo.garron as number
      const t = romaneo.tropaCodigo || 'SIN-TROPA'
      const key = `${g}|${t}`

      if (!romaneo.tropaCodigo) {
        sinTropa++
      }

      const match = index.get(key)

      if (match) {
        try {
          await db.romaneo.update({
            where: { id: romaneo.id },
            data: { listaFaenaId: match.listaFaenaId },
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
    console.log(`  Procesados ${skip}/${romaneosSinLista} (actualizados: ${actualizados}, sin match: ${sinMatch}, sin tropa: ${sinTropa})`)

    if (romaneos.length < BATCH_SIZE) break
  }

  console.log(`\n=== Resumen Final ===`)
  console.log(`Total romaneos sin listaFaenaId: ${romaneosSinLista}`)
  console.log(`Actualizados (match exacto garrón+tropa): ${actualizados}`)
  console.log(`Sin match: ${sinMatch}`)
  console.log(`Sin tropaCodigo: ${sinTropa}`)
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
