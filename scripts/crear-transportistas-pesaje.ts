/**
 * Crea registros de Transportista a partir de la planilla Excel de pesaje
 * y vincula los PesajeCamion existentes con el transportistaId correcto.
 *
 * Problema: Al importar los pesajes (tropas 1-41), la tabla Transportista estaba vacía,
 * por lo que todos los PesajeCamion quedaron con transportistaId = null.
 *
 * Solución: Lee los datos del Excel, crea los Transportistas faltantes y vincula.
 *
 * Uso:
 *   bun scripts/crear-transportistas-pesaje.ts
 *   bun scripts/crear-transportistas-pesaje.ts --dry-run
 */
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const db = new PrismaClient()

// ─── Datos de transportista por tropa (extraídos del Excel) ───
// Formato: tropa → nombre transportista
const TROPAS_TRANSPORTISTA: Record<number, string> = {
  1: 'MORAGA',
  2: 'LOGISTICA LIBERTAD',
  3: 'EST. NUEVA AURORA S.A GANADERA',
  4: 'LOGISTICA LIBERTAD',
  5: 'S Y V',
  6: 'S Y V',
  7: 'DON RAMIRO',
  8: 'DON RAMIRO',
  9: 'DON RAMIRO',
  10: 'MORAGA',
  11: 'LASTRA',
  12: 'TASSILE JUAN ALAN',
  13: 'PATAGONIA',
  14: 'DON ANTONIO',
  15: 'LIBERTAD',
  16: 'MORAGA',
  17: '6 DE FEBRERO',
  18: 'LIBERTAD',
  19: 'LIBERTAD',
  20: 'LASTRA',
  21: 'PATAGONIA',
  22: 'PATAGONIA',
  23: 'PATAGONIA',
  24: 'DON ANTONIO',
  25: 'LA CORRALERA',
  26: 'GALLUCCI',
  27: 'SARSA',
  28: 'LIBERTAD',
  29: 'LASTRA',
  30: 'LIBERTAD',
  31: 'DON RAMIRO',
  32: 'BABBONEY',
  33: 'DON ANTONIO',
  34: 'LIBERTAD',
  35: 'SARSA',
  36: 'SARSA',
  37: 'LASTRA',
  38: 'LIBERTAD',
  39: 'LIBERTAD',
  40: 'FERNANDEZ',
  41: 'ARANEDA',
}

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  CREAR TRANSPORTISTAS Y VINCULAR PESAJES')
  console.log('═══════════════════════════════════════════════════\n')

  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  if (dryRun) {
    console.log('🔍 MODO DRY-RUN: No se ejecutarán cambios.\n')
  }

  // ─── 1. Verificar Transportistas existentes ───
  console.log('── VERIFICANDO ESTADO ACTUAL ──')
  const transportistasExistentes = await db.transportista.findMany({ orderBy: { nombre: 'asc' } })
  console.log(`Transportistas en DB: ${transportistasExistentes.length}`)

  // Map nombre → id (existente)
  const existentesMap = new Map<string, string>()
  for (const t of transportistasExistentes) {
    existentesMap.set(t.nombre.toUpperCase().trim(), t.id)
  }

  // ─── 2. Determinar transportistas a crear ───
  const nombresUnicos = [...new Set(Object.values(TROPAS_TRANSPORTISTA))]
  const aCrear = nombresUnicos.filter(n => !existentesMap.has(n.toUpperCase().trim()))
  const yaExisten = nombresUnicos.filter(n => existentesMap.has(n.toUpperCase().trim()))

  console.log(`\nTransportistas únicos en planilla: ${nombresUnicos.length}`)
  console.log(`  Ya existen en DB: ${yaExisten.length}`)
  console.log(`  A crear: ${aCrear.length}`)

  if (yaExisten.length > 0) {
    console.log('\n  Ya existentes:')
    for (const n of yaExisten) {
      const id = existentesMap.get(n.toUpperCase().trim())
      console.log(`    ✓ ${n} (${id})`)
    }
  }

  if (aCrear.length > 0) {
    console.log('\n  A crear:')
    for (const n of aCrear) {
      console.log(`    + ${n}`)
    }
  }

  // ─── 3. Verificar PesajeCamion por tropa ───
  console.log('\n── VERIFICANDO PESAJES EXISTENTES ──')
  const tropasNumeros = Object.keys(TROPAS_TRANSPORTISTA).map(Number)
  const tropas = await db.tropa.findMany({
    where: { numero: { in: tropasNumeros } },
    include: { pesajeCamion: true },
    orderBy: { numero: 'asc' }
  })

  console.log(`Tropas encontradas: ${tropas.length}/${tropasNumeros.length}`)
  const conPesaje = tropas.filter(t => t.pesajeCamion).length
  const sinPesaje = tropas.filter(t => !t.pesajeCamion).length
  console.log(`Con PesajeCamion: ${conPesaje}`)
  console.log(`Sin PesajeCamion: ${sinPesaje}`)

  // Mostrar cuáles tienen/sin transportistaId
  const pesajesSinTransportista = tropas.filter(t => t.pesajeCamion && !t.pesajeCamion!.transportistaId)
  const pesajesConTransportista = tropas.filter(t => t.pesajeCamion && t.pesajeCamion!.transportistaId)
  console.log(`Pesajes SIN transportistaId: ${pesajesSinTransportista.length}`)
  console.log(`Pesajes CON transportistaId: ${pesajesConTransportista.length}`)

  if (dryRun) {
    console.log('\n── DRY-RUN: RESUMEN DE ACCIONES ──')
    console.log(`1. Crear ${aCrear.length} Transportistas: ${aCrear.join(', ')}`)
    console.log(`2. Actualizar ${pesajesSinTransportista.length} PesajeCamion con transportistaId`)
    console.log('\nDetalle de vinculación:')
    for (const tropa of tropas) {
      if (!tropa.pesajeCamion) continue
      const nombre = TROPAS_TRANSPORTISTA[tropa.numero]
      console.log(`  Tropa ${tropa.numero}: PesajeCamion ${tropa.pesajeCamion!.id.slice(0,8)}... → Transportista "${nombre}"`)
    }
    console.log('\n✅ DRY-RUN completado. No se hicieron cambios.')
    process.exit(0)
  }

  // ─── 4. CREAR TRANSPORTISTAS ───
  console.log('\n═══════════════════════════════════════════════════')
  console.log('  CREANDO TRANSPORTISTAS...')
  console.log('═══════════════════════════════════════════════════\n')

  const nombreAId = new Map<string, string>(existentesMap) // Copiar existentes

  for (const nombre of aCrear) {
    try {
      const transportista = await db.transportista.create({
        data: { nombre: nombre.trim() }
      })
      nombreAId.set(nombre.toUpperCase().trim(), transportista.id)
      console.log(`  ✅ Creado: ${nombre} → ${transportista.id}`)
    } catch (err: any) {
      console.error(`  ❌ Error creando "${nombre}": ${err.message}`)
      // Intentar buscar si ya existe con otro nombre similar
      const existente = await db.transportista.findFirst({
        where: { nombre: { contains: nombre.trim(), mode: 'insensitive' } }
      })
      if (existente) {
        nombreAId.set(nombre.toUpperCase().trim(), existente.id)
        console.log(`     → Usando existente similar: ${existente.nombre} (${existente.id})`)
      }
    }
  }

  // ─── 5. VINCULAR PESAJES ───
  console.log('\n═══════════════════════════════════════════════════')
  console.log('  VINCULANDO PESAJES CON TRANSPORTISTAS...')
  console.log('═══════════════════════════════════════════════════\n')

  let vinculados = 0
  let errores = 0

  for (const tropa of tropas) {
    if (!tropa.pesajeCamion) continue

    const nombreTransportista = TROPAS_TRANSPORTISTA[tropa.numero]
    if (!nombreTransportista) continue

    const transportistaId = nombreAId.get(nombreTransportista.toUpperCase().trim())
    if (!transportistaId) {
      console.log(`  ⚠️  Tropa ${tropa.numero}: No se encontró transportista "${nombreTransportista}"`)
      errores++
      continue
    }

    // Si ya tiene el mismo transportistaId, saltar
    if (tropa.pesajeCamion!.transportistaId === transportistaId) {
      continue
    }

    try {
      await db.pesajeCamion.update({
        where: { id: tropa.pesajeCamion!.id },
        data: { transportistaId }
      })

      // También actualizar el vehículo si existe la misma patente
      const vehiculo = await db.vehiculo.findUnique({
        where: { patente: tropa.pesajeCamion!.patenteChasis }
      })
      if (vehiculo && !vehiculo.transportistaId) {
        await db.vehiculo.update({
          where: { id: vehiculo.id },
          data: { transportistaId }
        })
        console.log(`  ✅ Tropa ${String(tropa.numero).padStart(3)}: Vinculado pesaje + vehículo ${tropa.pesajeCamion!.patenteChasis} → "${nombreTransportista}"`)
      } else {
        console.log(`  ✅ Tropa ${String(tropa.numero).padStart(3)}: Vinculado pesaje → "${nombreTransportista}"`)
      }

      vinculados++
    } catch (err: any) {
      console.error(`  ❌ Tropa ${tropa.numero}: ${err.message}`)
      errores++
    }
  }

  // ─── 6. RESUMEN FINAL ───
  console.log('\n═══════════════════════════════════════════════════')
  console.log('  RESUMEN FINAL')
  console.log('═══════════════════════════════════════════════════')
  console.log(`  Transportistas creados: ${aCrear.length}`)
  console.log(`  Transportistas totales:  ${aCrear.length + transportistasExistentes.length}`)
  console.log(`  Pesajes vinculados:     ${vinculados}`)
  console.log(`  Errores:                ${errores}`)
  console.log('═══════════════════════════════════════════════════')

  // ─── 7. Verificación ───
  console.log('\n── VERIFICACIÓN FINAL ──')
  const todasTropas = await db.tropa.findMany({
    where: { numero: { in: tropasNumeros } },
    include: {
      pesajeCamion: { include: { transportista: true } }
    },
    orderBy: { numero: 'asc' }
  })

  for (const t of todasTropas) {
    if (!t.pesajeCamion) continue
    const p = t.pesajeCamion
    console.log(
      `  Tropa ${String(t.numero).padStart(3)} | ` +
      `Tk:${p.numeroTicket} | ` +
      `${p.patenteChasis} | ` +
      `Transportista: ${p.transportista?.nombre || 'SIN VINCULAR'}`
    )
  }
}

main()
  .catch(err => {
    console.error('❌ Error fatal:', err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
