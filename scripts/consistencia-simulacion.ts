/**
 * Script de consistencia general para simulación postdatada
 * 
 * Funciones:
 * 1. Actualizar estados de animales que tienen romaneo pero siguen como RECIBIDO/PESADO → FAENADO
 * 2. Recalcular stock de corrales (contadores denormalizados)
 * 3. Recalcular pesoTotalIndividual de tropas
 * 4. Backdatear romaneos/mediaRes con fecha real de faena (opcional)
 * 
 * USO:
 *   npx tsx scripts/consistencia-simulacion.ts
 *   npx tsx scripts/consistencia-simulacion.ts --backdate 2025-01-15
 *   npx tsx scripts/consistencia-simulacion.ts --backdate-tropa "B 2026 0017" --fecha 2025-01-15
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const args = process.argv.slice(2)
const backdateAll = args.includes('--backdate')
const dryRun = args.includes('--dry-run')

// Parsear argumentos nombrados
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined
}

const backdateTropa = getArg('backdate-tropa')
const backdateFecha = getArg('fecha')

async function main() {
  console.log('=== SCRIPT DE CONSISTENCIA PARA SIMULACIÓN ===')
  console.log(`Modo: ${dryRun ? 'DRY RUN (sin cambios)' : 'EJECUCIÓN'}`)
  console.log('')

  // 1. ACTUALIZAR ESTADOS DE ANIMALES FAENADOS
  console.log('--- PASO 1: Actualizar animales con romaneo a estado FAENADO ---')
  
  const animalesConRomaneo = await db.animal.findMany({
    where: {
      estado: { in: ['RECIBIDO', 'PESADO', 'EN_FAENA'] },
      // Tiene romaneo confirmado o con medias
      romaneos: {
        some: {
          estado: { in: ['CONFIRMADO', 'PENDIENTE'] }
        }
      }
    },
    include: {
      tropa: true,
      romaneos: {
        take: 1,
        where: { estado: { in: ['CONFIRMADO', 'PENDIENTE'] } }
      }
    }
  })

  console.log(`Animales encontrados con romaneo pero estado incorrecto: ${animalesConRomaneo.length}`)

  if (!dryRun && animalesConRomaneo.length > 0) {
    // Agrupar por tropa para actualizar también la tropa
    const tropasActualizar = new Set<string>()
    
    for (const animal of animalesConRomaneo) {
      await db.animal.update({
        where: { id: animal.id },
        data: { estado: 'FAENADO' }
      })
      if (animal.tropaId) tropasActualizar.add(animal.tropaId)
    }

    // Actualizar tropas a FAENADO
    for (const tropaId of tropasActualizar) {
      // Verificar si todos los animales de la tropa están faenados
      const totalAnimales = await db.animal.count({
        where: { tropaId, estado: { not: 'FAENADO' } }
      })
      
      if (totalAnimales === 0) {
        await db.tropa.update({
          where: { id: tropaId },
          data: { estado: 'FAENADO' }
        })
        const tropa = await db.tropa.findUnique({ where: { id: tropaId } })
        console.log(`  Tropa ${tropa?.codigo} → FAENADO`)
      } else {
        const tropa = await db.tropa.findUnique({ where: { id: tropaId } })
        console.log(`  Tropa ${tropa?.codigo} → EN_FAENA (quedan ${totalAnimales} animales sin faenar)`)
      }
    }
    
    console.log(`✅ ${animalesConRomaneo.length} animales actualizados a FAENADO`)
  }

  // 2. RECALCULAR STOCK DE CORRALES
  console.log('')
  console.log('--- PASO 2: Recalcular stock de corrales (contadores denormalizados) ---')
  
  const corrales = await db.corral.findMany()
  
  for (const corral of corrales) {
    // Contar animales activos en este corral (RECIBIDO + PESADO)
    const bovinosEnCorral = await db.animal.count({
      where: {
        corralId: corral.id,
        estado: { in: ['RECIBIDO', 'PESADO'] },
        tropa: { especie: 'BOVINO' }
      }
    })
    
    const equinosEnCorral = await db.animal.count({
      where: {
        corralId: corral.id,
        estado: { in: ['RECIBIDO', 'PESADO'] },
        tropa: { especie: 'EQUINO' }
      }
    })

    const diffBovinos = bovinosEnCorral - corral.stockBovinos
    const diffEquinos = equinosEnCorral - corral.stockEquinos

    if (diffBovinos !== 0 || diffEquinos !== 0) {
      console.log(`  Corral ${corral.nombre}: bovinos ${corral.stockBovinos}→${bovinosEnCorral} (${diffBovinos > 0 ? '+' : ''}${diffBovinos}), equinos ${corral.stockEquinos}→${equinosEnCorral} (${diffEquinos > 0 ? '+' : ''}${diffEquinos})`)
      
      if (!dryRun) {
        await db.corral.update({
          where: { id: corral.id },
          data: {
            stockBovinos: bovinosEnCorral,
            stockEquinos: equinosEnCorral
          }
        })
      }
    }
  }

  console.log('✅ Stock de corrales verificado')

  // 3. RECALCULAR PESO TOTAL INDIVIDUAL DE TROPAS
  console.log('')
  console.log('--- PASO 3: Recalcular pesoTotalIndividual de tropas ---')
  
  const tropas = await db.tropa.findMany({
    where: { estado: { in: ['RECIBIDO', 'EN_CORRAL', 'EN_PESAJE', 'PESADO', 'LISTO_FAENA'] } }
  })
  
  let tropasRecalc = 0
  for (const tropa of tropas) {
    const totalPeso = await db.pesajeIndividual.aggregate({
      where: {
        animal: { tropaId: tropa.id }
      },
      _sum: { peso: true }
    })
    
    const nuevoTotal = totalPeso._sum.peso || 0
    
    if (tropa.pesoTotalIndividual !== nuevoTotal) {
      console.log(`  Tropa ${tropa.codigo}: pesoTotalIndividual ${tropa.pesoTotalIndividual}→${nuevoTotal}`)
      
      if (!dryRun) {
        await db.tropa.update({
          where: { id: tropa.id },
          data: { pesoTotalIndividual: nuevoTotal }
        })
      }
      tropasRecalc++
    }
  }
  
  console.log(`✅ ${tropasRecalc} tropas con peso recalculado`)

  // 4. BACKDATEAR ROMANEOS (opcional)
  if (backdateAll && backdateFecha) {
    console.log('')
    console.log('--- PASO 4: Backdatear TODOS los romaneos existentes ---')
    console.log(`Fecha destino: ${backdateFecha}`)
    
    if (!backdateFecha) {
      console.log('❌ ERROR: Debe especificar --fecha YYYY-MM-DD para backdatear')
      process.exit(1)
    }
    
    const fechaDestino = new Date(backdateFecha)
    fechaDestino.setHours(12, 0, 0, 0) // Mediodía para evitar problemas de zona horaria
    
    const romaneos = await db.romaneo.findMany({
      where: { estado: { in: ['PENDIENTE', 'CONFIRMADO'] } }
    })
    
    console.log(`Romaneos a backdatear: ${romaneos.length}`)
    
    if (!dryRun) {
      for (const romaneo of romaneos) {
        await db.romaneo.update({
          where: { id: romaneo.id },
          data: { fecha: fechaDestino }
        })
        
        // También actualizar mediasRes (createdAt)
        const medias = await db.mediaRes.findMany({
          where: { romaneoId: romaneo.id }
        })
        
        for (const media of medias) {
          // Recalcular código de barras con la nueva fecha
          const codigoBase = `${fechaDestino.getFullYear().toString().slice(-2)}${(fechaDestino.getMonth() + 1).toString().padStart(2, '0')}${fechaDestino.getDate().toString().padStart(2, '0')}-${romaneo.garron.toString().padStart(4, '0')}-${media.lado.charAt(0)}`
          
          await db.mediaRes.update({
            where: { id: media.id },
            data: { codigo: `${codigoBase}-A` }
          })
        }
      }
      console.log(`✅ ${romaneos.length} romaneos backdateados a ${backdateFecha}`)
    }
  }
  
  // 4b. BACKDATEAR POR TROPA ESPECÍFICA
  if (backdateTropa && backdateFecha) {
    console.log('')
    console.log(`--- PASO 4b: Backdatear romaneos de tropa ${backdateTropa} ---`)
    console.log(`Fecha destino: ${backdateFecha}`)
    
    const fechaDestino = new Date(backdateFecha)
    fechaDestino.setHours(12, 0, 0, 0)
    
    const romaneos = await db.romaneo.findMany({
      where: {
        tropaCodigo: backdateTropa,
        estado: { in: ['PENDIENTE', 'CONFIRMADO'] }
      }
    })
    
    console.log(`Romaneos encontrados para ${backdateTropa}: ${romaneos.length}`)
    
    if (!dryRun && romaneos.length > 0) {
      for (const romaneo of romaneos) {
        await db.romaneo.update({
          where: { id: romaneo.id },
          data: { fecha: fechaDestino }
        })
        
        const medias = await db.mediaRes.findMany({
          where: { romaneoId: romaneo.id }
        })
        
        for (const media of medias) {
          const codigoBase = `${fechaDestino.getFullYear().toString().slice(-2)}${(fechaDestino.getMonth() + 1).toString().padStart(2, '0')}${fechaDestino.getDate().toString().padStart(2, '0')}-${romaneo.garron.toString().padStart(4, '0')}-${media.lado.charAt(0)}`
          
          await db.mediaRes.update({
            where: { id: media.id },
            data: { codigo: `${codigoBase}-A` }
          })
        }
      }
      console.log(`✅ ${romaneos.length} romaneos de ${backdateTropa} backdateados a ${backdateFecha}`)
    }
  }

  // RESUMEN FINAL
  console.log('')
  console.log('=== RESUMEN DE CONSISTENCIA ===')
  
  // Contar estados actuales
  const estados = await db.animal.groupBy({
    by: ['estado'],
    _count: { id: true }
  })
  
  console.log('Animales por estado:')
  for (const e of estados) {
    console.log(`  ${e.estado}: ${e._count.id}`)
  }

  const tropasEstados = await db.tropa.groupBy({
    by: ['estado'],
    _count: { id: true }
  })
  
  console.log('Tropas por estado:')
  for (const e of tropasEstados) {
    console.log(`  ${e.estado}: ${e._count.id}`)
  }
  
  // Stock total en corrales
  const totalStock = await db.corral.aggregate({
    _sum: { stockBovinos: true, stockEquinos: true }
  })
  console.log(`Stock total corrales: ${totalStock._sum.stockBovinos} bovinos, ${totalStock._sum.stockEquinos} equinos`)
  
  // Animales con estado activo vs stock en corrales
  const animalesActivos = await db.animal.count({
    where: { estado: { in: ['RECIBIDO', 'PESADO'] } }
  })
  const animalesSinCorral = await db.animal.count({
    where: { 
      estado: { in: ['RECIBIDO', 'PESADO'] },
      corralId: null
    }
  })
  console.log(`Animales activos (RECIBIDO+PESADO): ${animalesActivos}`)
  console.log(`Animales activos sin corral asignado: ${animalesSinCorral}`)
  
  if (animalesActivos !== totalStock._sum.stockBovinos) {
    console.log(`⚠️ DISCREPANCIA: Animales activos (${animalesActivos}) ≠ Stock corrales (${totalStock._sum.stockBovinos})`)
  } else {
    console.log('✅ Stock de corrales consistente con animales activos')
  }

  console.log('')
  console.log('=== FIN ===')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
