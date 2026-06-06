/**
 * Diagnóstico: Verificar consistencia de rindes en romaneos
 * - Detecta rindes almacenados en formato decimal vs porcentaje
 * - Detecta pesoVivo inconsistentes (donde pesoTotal/pesoVivo no coincide con rinde)
 * - Detecta rindes imposibles (< 30% o > 80%)
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== DIAGNÓSTICO DE CONSISTENCIA DE RINDES ===\n')

  // 1. Verificar formato de rinde (decimal vs porcentaje)
  const todosRomaneos = await prisma.romaneo.findMany({
    where: { estado: 'CONFIRMADO', pesoVivo: { not: null }, pesoTotal: { not: null } },
    select: {
      id: true,
      tropaCodigo: true,
      garron: true,
      pesoVivo: true,
      pesoTotal: true,
      rinde: true,
      pesoMediaIzq: true,
      pesoMediaDer: true,
    },
    orderBy: { tropaCodigo: 'asc' }
  })

  console.log(`Total romaneos confirmados con pesoVivo y pesoTotal: ${todosRomaneos.length}`)

  // 2. Analizar cada romaneo
  let decimalCount = 0
  let porcentajeCount = 0
  let sinRinde = 0
  let inconsistentes: {
    tropa: string
    garron: number
    pesoVivo: number
    pesoTotal: number
    rindeStored: number | null
    rindeCalcFromStored: number | null
    rindeCalcReal: number
    formato: string
    diff: number
  }[] = []
  let rindesImposibles: {
    tropa: string
    garron: number
    rindeStored: number | null
    rindeReal: number
    tipo: string
  }[] = []

  for (const r of todosRomaneos) {
    const rindeReal = r.pesoVivo! > 0 ? Math.round((r.pesoTotal! / r.pesoVivo!) * 10000) / 100 : 0

    if (!r.rinde) {
      sinRinde++
      inconsistentes.push({
        tropa: r.tropaCodigo || '?',
        garron: r.garron,
        pesoVivo: r.pesoVivo!,
        pesoTotal: r.pesoTotal!,
        rindeStored: null,
        rindeCalcFromStored: null,
        rindeReal,
        formato: 'SIN RINDE',
        diff: rindeReal
      })
      continue
    }

    // Determinar formato: si rinde < 1, es decimal; si >= 1, es porcentaje
    if (r.rinde < 1) {
      decimalCount++
      // rinde almacenado como decimal, el real sería rinde * 100
      const rindeFromStored = Math.round(r.rinde * 10000) / 100
      const diff = Math.abs(rindeFromStored - rindeReal)
      if (diff > 0.5) {
        inconsistentes.push({
          tropa: r.tropaCodigo || '?',
          garron: r.garron,
          pesoVivo: r.pesoVivo!,
          pesoTotal: r.pesoTotal!,
          rindeStored: r.rinde,
          rindeCalcFromStored: rindeFromStored,
          rindeReal,
          formato: `DECIMAL (${r.rinde})`,
          diff: Math.round(diff * 100) / 100
        })
      }
    } else {
      porcentajeCount++
      // rinde almacenado como porcentaje
      const diff = Math.abs(r.rinde - rindeReal)
      if (diff > 0.5) {
        inconsistentes.push({
          tropa: r.tropaCodigo || '?',
          garron: r.garron,
          pesoVivo: r.pesoVivo!,
          pesoTotal: r.pesoTotal!,
          rindeStored: r.rinde,
          rindeCalcFromStored: r.rinde,
          rindeReal,
          formato: `PORCENTAJE (${r.rinde})`,
          diff: Math.round(diff * 100) / 100
        })
      }
    }

    // Detectar rindes imposibles (calculado desde pesoVivo y pesoTotal)
    if (rindeReal < 30 || rindeReal > 80) {
      rindesImposibles.push({
        tropa: r.tropaCodigo || '?',
        garron: r.garron,
        rindeStored: r.rinde,
        rindeReal,
        tipo: rindeReal < 30 ? 'MUY BAJO (<30%)' : 'MUY ALTO (>80%)'
      })
    }
  }

  console.log('\n--- FORMATO DE RINDE ---')
  console.log(`En formato DECIMAL (< 1): ${decimalCount}`)
  console.log(`En formato PORCENTAJE (>= 1): ${porcentajeCount}`)
  console.log(`Sin rinde: ${sinRinde}`)

  if (inconsistentes.length > 0) {
    console.log(`\n--- ${inconsistentes.length} RINDES INCONSISTENTES (diff > 0.5%) ---`)
    for (const i of inconsistentes.slice(0, 30)) {
      console.log(`  Tropa ${i.tropa} garrón ${i.garron}: PV=${i.pesoVivo}kg PT=${i.pesoTotal}kg | Almacenado=${i.rindeStored} (${i.formato}) | Real=${i.rindeReal}% | Diff=${i.diff}%`)
    }
    if (inconsistentes.length > 30) {
      console.log(`  ... y ${inconsistentes.length - 30} más`)
    }
  } else {
    console.log('\n✅ Todos los rindes almacenados son consistentes con los pesos')
  }

  if (rindesImposibles.length > 0) {
    console.log(`\n--- ${rindesImposibles.length} RINDES IMPOSIBLES (calculado <30% o >80%) ---`)
    for (const r of rindesImposibles) {
      console.log(`  Tropa ${r.tropa} garrón ${r.garron}: Almacenado=${r.rindeStored} | Real=${r.rindeReal}% [${r.tipo}]`)
    }
  } else {
    console.log('\n✅ No se detectaron rindes imposibles')
  }

  // 3. Verificar pesoVivo específico de tropa B 2026 0017 garrón 63
  console.log('\n--- CASO ESPECÍFICO: Tropa B 2026 0017 Garrón 63 ---')
  const casoEspecifico = todosRomaneos.find(
    r => r.tropaCodigo === 'B 2026 0017' && r.garron === 63
  )
  if (casoEspecifico) {
    const rindeReal = casoEspecifico.pesoVivo! > 0 
      ? Math.round((casoEspecifico.pesoTotal! / casoEspecifico.pesoVivo!) * 10000) / 100 
      : 0
    console.log(`  pesoVivo: ${casoEspecifico.pesoVivo} kg`)
    console.log(`  pesoMediaIzq: ${casoEspecifico.pesoMediaIzq} kg`)
    console.log(`  pesoMediaDer: ${casoEspecifico.pesoMediaDer} kg`)
    console.log(`  pesoTotal: ${casoEspecifico.pesoTotal} kg`)
    console.log(`  rinde almacenado: ${casoEspecifico.rinde}`)
    console.log(`  rinde calculado real: ${rindeReal}%`)
    console.log(`  Si pesoVivo fuera 351: rinde = ${Math.round((casoEspecifico.pesoTotal! / 351) * 10000) / 100}%`)
  }

  // 4. Resumen por tropa con inconsistentes
  console.log('\n--- TROPAS CON MÁS INCONSISTENCIAS ---')
  const porTropa = new Map<string, number>()
  for (const i of inconsistentes) {
    porTropa.set(i.tropa, (porTropa.get(i.tropa) || 0) + 1)
  }
  const sorted = [...porTropa.entries()].sort((a, b) => b[1] - a[1])
  for (const [tropa, count] of sorted.slice(0, 10)) {
    console.log(`  ${tropa}: ${count} inconsistentes`)
  }

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); prisma.$disconnect() })
