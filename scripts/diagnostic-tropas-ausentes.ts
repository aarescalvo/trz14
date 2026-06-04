/**
 * Script de diagnóstico: ¿Por qué no se ven las tropas 192-203 en rindes?
 * Y ¿por qué tropa 175 muestra 0% de rinde?
 * 
 * Ejecutar con: npx tsx scripts/diagnostic-tropas-ausentes.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('============================================')
  console.log('  DIAGNÓSTICO: TROPAS AUSENTES EN RINDES')
  console.log('============================================\n')

  // 1) ¿Existen las tropas 192-203 en la tabla Tropa?
  console.log('--- 1) TROPAS 192-203 en tabla Tropa ---')
  const tropas192_203 = await prisma.tropa.findMany({
    where: { numero: { gte: 192, lte: 203 } },
    select: { id: true, numero: true, codigo: true, cantidadCabezas: true, fechaRecepcion: true, anio: true },
    orderBy: { numero: 'asc' }
  })
  console.log(`Encontradas: ${tropas192_203.length} tropas`)
  for (const t of tropas192_203) {
    console.log(`  Tropa ${t.numero}: codigo="${t.codigo}", cabezas=${t.cantidadCabezas}, fecha=${t.fechaRecepcion?.toISOString().split('T')[0]}`)
  }

  // 2) ¿Tienen romaneos esas tropas?
  if (tropas192_203.length > 0) {
    const codigos = tropas192_203.map(t => t.codigo)
    console.log(`\n--- 2) ROMANEOS para tropas 192-203 (codigos: ${codigos.length}) ---`)
    const romaneos = await prisma.romaneo.findMany({
      where: { tropaCodigo: { in: codigos } },
      select: { id: true, tropaCodigo: true, estado: true, pesoVivo: true, pesoTotal: true, garron: true, pesoMediaIzq: true, pesoMediaDer: true },
      orderBy: [{ tropaCodigo: 'asc' }, { garron: 'asc' }]
    })
    console.log(`Total romaneos encontrados: ${romaneos.length}`)
    
    // Agrupar por estado
    const byEstado: Record<string, number> = {}
    for (const r of romaneos) {
      byEstado[r.estado] = (byEstado[r.estado] || 0) + 1
    }
    console.log('Por estado:', byEstado)
    
    // Agrupar por tropa
    const byTropa: Record<string, number> = {}
    for (const r of romaneos) {
      const cod = r.tropaCodigo || 'sin-codigo'
      byTropa[cod] = (byTropa[cod] || 0) + 1
    }
    console.log('Por tropaCodigo:')
    for (const [cod, qty] of Object.entries(byTropa).sort()) {
      console.log(`  ${cod}: ${qty} romaneos`)
    }
    
    // Mostrar primeros 10 romaneos
    console.log('\nPrimeros 10 romaneos:')
    for (const r of romaneos.slice(0, 10)) {
      console.log(`  tropa=${r.tropaCodigo} garron=${r.garron} estado=${r.estado} pesoVivo=${r.pesoVivo} mediaIzq=${r.pesoMediaIzq} mediaDer=${r.pesoMediaDer} pesoTotal=${r.pesoTotal}`)
    }
  } else {
    console.log('\n⚠️ No se encontraron tropas 192-203 en la tabla Tropa')
    
    // Ver cuál es la máxima tropa
    const maxTropa = await prisma.tropa.findFirst({
      orderBy: { numero: 'desc' },
      select: { numero: true, codigo: true }
    })
    console.log(`Tropa máxima en tabla Tropa: ${maxTropa?.numero} (${maxTropa?.codigo})`)
  }

  // 3) ¿Cuáles son las últimas tropas que SÍ tienen romaneos?
  console.log('\n--- 3) ÚLTIMAS 20 tropas con romaneos ---')
  const lastTropasWithRomaneos = await prisma.romaneo.groupBy({
    by: ['tropaCodigo'],
    _count: { id: true },
    orderBy: { tropaCodigo: 'desc' },
    take: 20
  })
  for (const t of lastTropasWithRomaneos) {
    console.log(`  ${t.tropaCodigo}: ${t._count.id} romaneos`)
  }

  // 4) ¿Y en la tabla Tropa, cuáles son las últimas?
  console.log('\n--- 4) ÚLTIMAS 20 tropas en tabla Tropa ---')
  const lastTropas = await prisma.tropa.findMany({
    select: { numero: true, codigo: true, cantidadCabezas: true },
    orderBy: { numero: 'desc' },
    take: 20
  })
  for (const t of lastTropas) {
    console.log(`  Tropa ${t.numero}: codigo="${t.codigo}", cabezas=${t.cantidadCabezas}`)
  }

  // 5) Tropa 175 - diagnóstico de rinde 0%
  console.log('\n============================================')
  console.log('  DIAGNÓSTICO: TROPA 175 - RINDE 0%')
  console.log('============================================\n')
  
  const tropa175 = await prisma.tropa.findMany({
    where: { numero: 175 },
    select: { id: true, numero: true, codigo: true, cantidadCabezas: true }
  })
  
  if (tropa175.length > 0) {
    console.log(`Tropa 175: codigo="${tropa175[0].codigo}", cabezas=${tropa175[0].cantidadCabezas}`)
    
    const rom175 = await prisma.romaneo.findMany({
      where: { tropaCodigo: tropa175[0].codigo },
      select: { id: true, estado: true, pesoVivo: true, pesoTotal: true, garron: true, pesoMediaIzq: true, pesoMediaDer: true, fecha: true },
      orderBy: { garron: 'asc' }
    })
    console.log(`\nTotal romaneos: ${rom175.length}`)
    
    let totalPesoVivo = 0
    let totalPesoTotal = 0
    let sinPesoVivo = 0
    let sinPesoTotal = 0
    
    for (const r of rom175) {
      const tienePesoVivo = r.pesoVivo && r.pesoVivo > 0
      const tienePesoTotal = r.pesoTotal && r.pesoTotal > 0
      if (!tienePesoVivo) sinPesoVivo++
      if (!tienePesoTotal) sinPesoTotal++
      totalPesoVivo += r.pesoVivo || 0
      totalPesoTotal += r.pesoTotal || 0
      
      console.log(`  garron=${r.garron} estado=${r.estado} pesoVivo=${r.pesoVivo} mediaIzq=${r.pesoMediaIzq} mediaDer=${r.pesoMediaDer} pesoTotal=${r.pesoTotal} ${!tienePesoVivo ? '⚠️ SIN PESO VIVO' : ''} ${!tienePesoTotal ? '⚠️ SIN PESO TOTAL' : ''}`)
    }
    
    const rindeCalc = totalPesoVivo > 0 ? (totalPesoTotal / totalPesoVivo * 100).toFixed(2) : '0'
    console.log(`\nResumen: pesoVivoTotal=${totalPesoVivo}, pesoTotalTotal=${totalPesoTotal}, rinde=${rindeCalc}%`)
    console.log(`Sin pesoVivo: ${sinPesoVivo}, Sin pesoTotal: ${sinPesoTotal}`)
  } else {
    console.log('⚠️ Tropa 175 no encontrada')
    // Buscar por codigo que contenga 175
    const tropas175 = await prisma.tropa.findMany({
      where: { codigo: { contains: '175' } },
      select: { id: true, numero: true, codigo: true }
    })
    console.log('Tropas con "175" en codigo:', tropas175)
  }

  console.log('\n============================================')
  console.log('  FIN DEL DIAGNÓSTICO')
  console.log('============================================')
}

main()
  .catch(e => { console.error('ERROR:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
