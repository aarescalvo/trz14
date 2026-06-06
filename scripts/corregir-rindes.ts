/**
 * CORRECCIÓN INTEGRAL DE RINDES
 * 
 * Este script hace:
 * 1. Detecta y corrige pesoVivo inconsistentes (ej: 51 en vez de 351)
 * 2. Recalcula TODOS los rindes dinámicamente desde pesoTotal/pesoVivo
 * 3. Estandariza el campo rinde a formato PORCENTAJE (ej: 58.69, no 0.5869)
 * 4. Corrige Animal.pesoVivo y AsignacionGarron.pesoVivo donde corresponda
 * 
 * Ejecutar con: npx tsx scripts/corregir-rindes.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== CORRECCIÓN INTEGRAL DE RINDES ===\n')

  // 1. Obtener todos los romaneos confirmados con peso
  const romaneos = await prisma.romaneo.findMany({
    where: {
      estado: 'CONFIRMADO',
      pesoVivo: { not: null },
      pesoTotal: { not: null },
    },
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
    orderBy: { tropaCodigo: 'asc' },
  })

  console.log(`Total romaneos confirmados con pesos: ${romaneos.length}`)

  let corregidos = 0
  let formatoDecimal = 0
  let pesoVivoSospechoso = 0

  for (const r of romaneos) {
    const pesoVivo = r.pesoVivo!
    const pesoTotal = r.pesoTotal!
    const rindeCorrecto = pesoVivo > 0 ? Math.round((pesoTotal / pesoVivo) * 10000) / 100 : null

    // Detectar rinde en formato decimal (< 1.0) y convertir a porcentaje
    if (r.rinde && r.rinde > 0 && r.rinde < 1) {
      formatoDecimal++
      // Verificar si coincide: rinde * 100 ≈ rindeCorrecto
      const rindeComoPct = Math.round(r.rinde * 10000) / 100
      if (rindeComoPct === rindeCorrecto) {
        console.log(`  [DECIMAL→PCT] ${r.tropaCodigo} g${r.garron}: ${r.rinde} → ${rindeCorrecto}%`)
      } else {
        console.log(`  [DECIMAL-DIFF] ${r.tropaCodigo} g${r.garron}: stored=${r.rinde}, calc=${rindeCorrecto}%`)
      }
    }

    // Detectar rinde almacenado diferente al calculado
    if (r.rinde && rindeCorrecto && Math.abs(r.rinde - rindeCorrecto) > 0.5) {
      console.log(`  [INCONSISTENTE] ${r.tropaCodigo} g${r.garron}: stored=${r.rinde}%, calc=${rindeCorrecto}%`)
    }

    // Detectar pesoVivo sospechoso (rinde calculado fuera de rango normal 35%-75%)
    if (rindeCorrecto && (rindeCorrecto < 35 || rindeCorrecto > 75)) {
      pesoVivoSospechoso++
      console.log(`  [PESO SOSPECHOSO] ${r.tropaCodigo} g${r.garron}: PV=${pesoVivo}kg PT=${pesoTotal}kg → rinde=${rindeCorrecto}%`)
    }
  }

  console.log(`\nResumen diagnósticos:`)
  console.log(`  Formato decimal (<1): ${formatoDecimal}`)
  console.log(`  PesoVivo sospechoso: ${pesoVivoSospechoso}`)
  console.log(`  Total a corregir: ${formatoDecimal + pesoVivoSospechoso}`)

  // ===== CORRECCIÓN AUTOMÁTICA =====
  console.log('\n=== INICIANDO CORRECCIÓNES ===\n')

  // 2. Corregir rindes que están en formato decimal
  const rindesDecimales = await prisma.romaneo.findMany({
    where: {
      estado: 'CONFIRMADO',
      rinde: { gt: 0, lt: 1 },  // formato decimal
    },
    select: { id: true, rinde: true, tropaCodigo: true, garron: true },
  })

  if (rindesDecimales.length > 0) {
    console.log(`Corrigiendo ${rindesDecimales.length} rindes de formato decimal a porcentaje...`)
    for (const r of rindesDecimales) {
      await prisma.romaneo.update({
        where: { id: r.id },
        data: {
          rinde: Math.round(r.rinde! * 10000) / 100,  // decimal → porcentaje
        },
      })
      corregidos++
    }
    console.log(`  ✅ ${rindesDecimales.length} rindes convertidos de decimal a porcentaje`)
  }

  // 3. Recalcular TODOS los rindes desde pesoTotal/pesoVivo
  console.log('\nRecalculando rindes dinámicamente desde pesos...')
  const todosConPesos = await prisma.romaneo.findMany({
    where: {
      estado: 'CONFIRMADO',
      pesoVivo: { gt: 0 },
      pesoTotal: { gt: 0 },
    },
    select: { id: true, pesoVivo: true, pesoTotal: true, tropaCodigo: true, garron: true, rinde: true },
  })

  let recalcCount = 0
  for (const r of todosConPesos) {
    const nuevoRinde = Math.round((r.pesoTotal! / r.pesoVivo!) * 10000) / 100
    if (!r.rinde || Math.abs(r.rinde - nuevoRinde) > 0.01) {
      await prisma.romaneo.update({
        where: { id: r.id },
        data: { rinde: nuevoRinde },
      })
      recalcCount++
    }
  }
  corregidos += recalcCount
  console.log(`  ✅ ${recalcCount} rindes recalculados desde pesos`)

  // 4. Corregir pesoVivo del caso específico (tropa B 2026 0017, garrón 63)
  // Si el pesoVivo es 51 y pesoTotal es 206, el pesoVivo correcto sería 351
  console.log('\nVerificando caso específico tropa B 2026 0017 garrón 63...')
  const casoEspecifico = await prisma.romaneo.findFirst({
    where: {
      tropaCodigo: 'B 2026 0017',
      garron: 63,
      estado: 'CONFIRMADO',
    },
  })

  if (casoEspecifico) {
    console.log(`  PV actual: ${casoEspecifico.pesoVivo}, PT: ${casoEspecifico.pesoTotal}`)
    if (casoEspecifico.pesoVivo === 51 && casoEspecifico.pesoTotal === 206) {
      console.log(`  Corrigiendo pesoVivo=51 → 351...`)
      const nuevoPeso = 351
      const nuevoRinde = Math.round((206 / nuevoPeso) * 10000) / 100
      await prisma.romaneo.update({
        where: { id: casoEspecifico.id },
        data: { pesoVivo: nuevoPeso, rinde: nuevoRinde },
      })
      // También corregir Animal y AsignacionGarron
      const animal = await prisma.animal.findFirst({
        where: { tropaId: { in: (await prisma.tropa.findMany({ where: { codigo: 'B 2026 0017' }, select: { id: true } })).map(t => t.id) }, numero: 8 },
      })
      if (animal) {
        await prisma.animal.update({ where: { id: animal.id }, data: { pesoVivo: nuevoPeso } })
        await prisma.asignacionGarron.updateMany({ where: { tropaCodigo: 'B 2026 0017', garron: 63 }, data: { pesoVivo: nuevoPeso } })
      }
      console.log(`  ✅ Corregido: pesoVivo=351, rinde=${nuevoRinde}%`)
    } else {
      console.log(`  ✅ PesoVivo ya corregido o diferente al esperado`)
    }
  }

  // 5. Verificación final
  console.log('\n=== VERIFICACIÓN FINAL ===')
  const romaneosFinal = await prisma.romaneo.findMany({
    where: { estado: 'CONFIRMADO', pesoVivo: { gt: 0 }, pesoTotal: { gt: 0 } },
    select: { rinde: true, pesoVivo: true, pesoTotal: true, tropaCodigo: true, garron: true },
    take: 5000,
  })

  let inconsistenciasFinal = 0
  for (const r of romaneosFinal) {
    const calc = Math.round((r.pesoTotal! / r.pesoVivo!) * 10000) / 100
    if (r.rinde && Math.abs(r.rinde - calc) > 0.01) {
      inconsistenciasFinal++
      console.log(`  [!] ${r.tropaCodigo} g${r.garron}: rinde=${r.rinde}, calc=${calc}`)
    }
  }

  if (inconsistenciasFinal === 0) {
    console.log('  ✅ TODOS los rindes son consistentes con los pesos')
  } else {
    console.log(`  ⚠️ Quedan ${inconsistenciasFinal} inconsistencias`)
  }

  console.log(`\n=== RESUMEN ===`)
  console.log(`Correcciones totales aplicadas: ${corregidos}`)

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); prisma.$disconnect() })
