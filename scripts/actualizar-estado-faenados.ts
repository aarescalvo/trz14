/**
 * Script: Actualizar estado de animales que tienen romaneo pero siguen en RECIBIDO/PESADO
 * 
 * Problema: Animales de tropas faenadas (con romaneo cargado) siguen apareciendo
 * en stock corrales porque su estado nunca fue actualizado del flujo normal.
 * 
 * Lo que hace:
 * 1. Busca todos los romaneos con tropaCodigo
 * 2. Busca los animales de esas tropas que estén en estado RECIBIDO o PESADO
 * 3. Los actualiza a FAENADO
 * 4. Actualiza el estado de las tropas correspondientes
 * 5. NO toca animales que ya estén en otro estado
 *
 * Ejecutar con: npx tsx scripts/actualizar-estado-faenados.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('============================================')
  console.log('  ACTUALIZAR ESTADO: ANIMALES FAENADOS')
  console.log('============================================\n')

  // 1. Find all romaneos and get unique tropa codes
  console.log('1. Buscando tropas con romaneos...')
  const romaneos = await prisma.romaneo.findMany({
    select: { tropaCodigo: true },
    distinct: ['tropaCodigo']
  })
  
  const tropaCodigos = romaneos.map(r => r.tropaCodigo)
  console.log(`   ${tropaCodigos.length} tropas con romaneos: ${tropaCodigos.slice(0, 5).join(', ')}...${tropaCodigos.length > 5 ? ` (+${tropaCodigos.length - 5} más)` : ''}`)

  // 2. Find animals in RECIBIDO or PESADO state for these tropas
  console.log('\n2. Buscando animales en estado RECIBIDO/PESADO de esas tropas...')
  const animalesActualizar = await prisma.animal.findMany({
    where: {
      tropa: {
        codigo: { in: tropaCodigos }
      },
      estado: { in: ['RECIBIDO', 'PESADO'] }
    },
    select: {
      id: true,
      numero: true,
      estado: true,
      corralId: true,
      tropa: {
        select: {
          codigo: true,
          numero: true,
          estado: true
        }
      }
    },
    orderBy: [
      { tropa: { codigo: 'asc' } },
      { numero: 'asc' }
    ]
  })

  console.log(`   ${animalesActualizar.length} animales encontrados en estado RECIBIDO/PESADO\n`)

  if (animalesActualizar.length === 0) {
    console.log('✅ No hay animales para actualizar.')
    return
  }

  // 3. Group by tropa for summary
  const byTropa = new Map<string, typeof animalesActualizar>()
  for (const a of animalesActualizar) {
    const code = a.tropa.codigo
    if (!byTropa.has(code)) byTropa.set(code, [])
    byTropa.get(code)!.push(a)
  }

  console.log('3. Detalle por tropa:')
  for (const [codigo, animales] of byTropa) {
    const t = animales[0].tropa
    const sinCorral = animales.filter(a => !a.corralId).length
    console.log(`   Tropa ${t.numero} (${codigo}): ${animales.length} animales [${animales[0].estado}]${sinCorral > 0 ? ` ⚠️ ${sinCorral} sin corral` : ''}`)
    // Show first 3 and last 1
    if (animales.length <= 4) {
      for (const a of animales) {
        console.log(`      Animal #${a.numero} (corralId=${a.corralId || 'SIN CORRAL'})`)
      }
    } else {
      for (const a of animales.slice(0, 3)) {
        console.log(`      Animal #${a.numero} (corralId=${a.corralId || 'SIN CORRAL'})`)
      }
      console.log(`      ... y ${animales.length - 3} más`)
      const last = animales[animales.length - 1]
      console.log(`      Animal #${last.numero} (corralId=${last.corralId || 'SIN CORRAL'})`)
    }
  }

  // 4. Update animals to FAENADO
  console.log('\n4. Actualizando animales a FAENADO...')
  const animalIds = animalesActualizar.map(a => a.id)
  
  const updateResult = await prisma.animal.updateMany({
    where: {
      id: { in: animalIds },
      estado: { in: ['RECIBIDO', 'PESADO'] }
    },
    data: {
      estado: 'FAENADO'
    }
  })
  console.log(`   ✅ ${updateResult.count} animales actualizados a FAENADO`)

  // 5. Update tropa states
  console.log('\n5. Actualizando estado de tropas...')
  const tropasActualizar = await prisma.tropa.findMany({
    where: {
      codigo: { in: tropaCodigos },
      estado: { in: ['RECIBIDO', 'EN_CORRAL', 'EN_PESAJE', 'PESADO', 'LISTO_FAENA', 'EN_FAENA'] }
    },
    select: { id: true, codigo: true, numero: true, estado: true }
  })

  if (tropasActualizar.length > 0) {
    const tropaUpdateResult = await prisma.tropa.updateMany({
      where: {
        id: { in: tropasActualizar.map(t => t.id) }
      },
      data: {
        estado: 'FAENADO'
      }
    })
    console.log(`   ✅ ${tropaUpdateResult.count} tropas actualizadas a FAENADO`)
    
    for (const t of tropasActualizar) {
      console.log(`      Tropa ${t.numero} (${t.codigo}): ${t.estado} → FAENADO`)
    }
  } else {
    console.log('   (no hay tropas para actualizar)')
  }

  // 6. Verify
  console.log('\n6. Verificación final...')
  const restantes = await prisma.animal.count({
    where: {
      tropa: { codigo: { in: tropaCodigos } },
      estado: { in: ['RECIBIDO', 'PESADO'] }
    }
  })
  console.log(`   Animales restantes en RECIBIDO/PESADO con romaneo: ${restantes}`)

  // 7. Recalcular stock de corrales
  console.log('\n7. Recalculando stock de corrales...')
  const corrales = await prisma.corral.findMany()
  let corralesActualizados = 0
  
  for (const corral of corrales) {
    const bovinosEnCorral = await prisma.animal.count({
      where: {
        corralId: corral.id,
        estado: { in: ['RECIBIDO', 'PESADO'] },
        tropa: { especie: 'BOVINO' }
      }
    })
    
    const equinosEnCorral = await prisma.animal.count({
      where: {
        corralId: corral.id,
        estado: { in: ['RECIBIDO', 'PESADO'] },
        tropa: { especie: 'EQUINO' }
      }
    })
    
    if (corral.stockBovinos !== bovinosEnCorral || corral.stockEquinos !== equinosEnCorral) {
      console.log(`   Corral ${corral.nombre}: bovinos ${corral.stockBovinos}→${bovinosEnCorral}, equinos ${corral.stockEquinos}→${equinosEnCorral}`)
      await prisma.corral.update({
        where: { id: corral.id },
        data: { stockBovinos: bovinosEnCorral, stockEquinos: equinosEnCorral }
      })
      corralesActualizados++
    }
  }
  console.log(`   ✅ ${corralesActualizados} corrales actualizados`)

  console.log('\n============================================')
  console.log('  RESUMEN')
  console.log('============================================')
  console.log(`Animales actualizados:  ${updateResult.count}`)
  console.log(`Tropas afectadas:       ${byTropa.size}`)
  console.log(`Animales restantes:     ${restantes}`)
  console.log('============================================')
}

main()
  .catch(e => { console.error('ERROR FATAL:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
