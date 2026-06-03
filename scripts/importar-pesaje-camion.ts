/**
 * Importa datos de Pesaje de Camión (tropas 1-41) a la base de datos.
 * SOLO crea PesajeCamion y actualiza pesos en tropas EXISTENTES.
 * No duplica tropas, animales, ni documentos (DTE, guía ya cargados).
 *
 * Datos incluidos: fecha/hora ingreso, patentes, chofer, DNI, transportista,
 *                 ticket balanza, pesos bruto/tara/neto, observaciones.
 *
 * Uso:
 *   bun scripts/importar-pesaje-camion.ts
 *   bun scripts/importar-pesaje-camion.ts --dry-run
 */
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const db = new PrismaClient()

// ─── DATOS DE PESAJE (tropas 1 a 41) ───
// Extraídos de "Copia de PLANTILLA_PESAJE_CAMION.xlsx"
const PESAJE_DATA = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pesaje-tropas-1-41.json'), 'utf-8')
)

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  IMPORTACIÓN DE PESAJE DE CAMIÓN')
  console.log('  Tropas 1 a 41 - Solo datos faltantes')
  console.log('═══════════════════════════════════════════\n')

  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  if (dryRun) {
    console.log('🔍 MODO DRY-RUN: No se ejecutarán cambios.\n')
  }

  // ─── 1. Verificar estado actual de la DB ───
  console.log('── VERIFICANDO BASE DE DATOS ──')

  const tropasExistentes = await db.tropa.findMany({
    where: { numero: { in: PESAJE_DATA.map((d: any) => d.tropa) } },
    include: { pesajeCamion: true },
    orderBy: { numero: 'asc' }
  })

  console.log(`Tropas 1-41 en DB: ${tropasExistentes.length}`)
  const conPesaje = tropasExistentes.filter(t => t.pesajeCamion).length
  const sinPesaje = tropasExistentes.filter(t => !t.pesajeCamion).length
  console.log(`Con PesajeCamion: ${conPesaje}`)
  console.log(`Sin PesajeCamion: ${sinPesaje}`)

  if (conPesaje > 0) {
    console.log('\nℹ️  Tropas que YA tienen pesaje (se saltarán):')
    for (const t of tropasExistentes.filter(t => t.pesajeCamion)) {
      console.log(`   Tropa ${t.numero} (${t.codigo}) → Ticket #${t.pesajeCamion!.numeroTicket}`)
    }
  }

  // Tropas a importar (las que no tienen pesaje)
  const tropasAImportar = tropasExistentes.filter(t => !t.pesajeCamion)
  if (tropasAImportar.length === 0) {
    console.log('\n✅ Todas las tropas 1-41 ya tienen PesajeCamion asociado. No hay nada que importar.')
    process.exit(0)
  }

  console.log(`\n📋 Tropas a importar: ${tropasAImportar.map(t => t.numero).join(', ')}`)

  // ─── 2. Obtener último número de ticket ───
  const lastPesaje = await db.pesajeCamion.findFirst({
    orderBy: { numeroTicket: 'desc' }
  })
  let nextTicket = (lastPesaje?.numeroTicket || 0) + 1
  console.log(`📋 Último ticket en DB: ${lastPesaje?.numeroTicket ?? 0}, siguiente: ${nextTicket}`)

  // ─── 3. Mapeo de tickets usados para evitar duplicados ───
  const ticketsUsados = new Set<number>()
  // Cargar tickets ya existentes
  const allTickets = await db.pesajeCamion.findMany({ select: { numeroTicket: true } })
  for (const t of allTickets) ticketsUsados.add(t.numeroTicket)

  // ─── 4. Obtener transportistas para matching por nombre ───
  const transportistas = await db.transportista.findMany()
  const transportistaMap = new Map<string, string>()
  for (const t of transportistas) {
    transportistaMap.set(t.nombre.toLowerCase().trim(), t.id)
  }
  console.log(`📋 Transportistas en DB: ${transportistas.length}`)

  // ─── 5. Obtener operador ───
  const operador = await db.operador.findFirst()
  const operadorId = operador?.id

  // ─── 6. Resumen de lo que se va a importar ───
  console.log('\n── RESUMEN DE IMPORTACIÓN ──')
  for (const d of PESAJE_DATA) {
    const tropa = tropasExistentes.find(t => t.numero === d.tropa)
    if (!tropa || tropa.pesajeCamion) continue

    const ticket = d.ticketOriginal || nextTicket
    console.log(
      `  Tropa ${String(d.tropa).padStart(3)} | ` +
      `Fecha: ${d.fechaHora} | ` +
      `Chasis: ${d.patenteChasis} | Acopl: ${d.patenteAcoplado || '-'} | ` +
      `Chofer: ${d.chofer || '-'} | DNI: ${d.dni || '-'} | ` +
      `Transp: ${d.transportista || '-'} | ` +
      `Ticket: ${ticket} | ` +
      `B: ${d.pesoBruto ?? '-'} T: ${d.pesoTara ?? '-'} N: ${d.pesoNeto ?? '-'}`
    )
  }

  if (dryRun) {
    console.log('\n✅ DRY-RUN completado. No se hicieron cambios.')
    process.exit(0)
  }

  // ─── 7. EJECUTAR IMPORTACIÓN ───
  console.log('\n═══════════════════════════════════════════')
  console.log('  EJECUTANDO IMPORTACIÓN...')
  console.log('═══════════════════════════════════════════\n')

  let importadas = 0
  let errores = 0

  for (const d of PESAJE_DATA) {
    try {
      // Buscar tropa existente
      const tropa = tropasExistentes.find(t => t.numero === d.tropa)
      if (!tropa) {
        console.log(`⚠️  Tropa ${d.tropa} NO encontrada en DB. Saltando.`)
        errores++
        continue
      }
      if (tropa.pesajeCamion) {
        continue // ya tiene, saltar silenciosamente
      }

      // Determinar número de ticket (manejar duplicados)
      let ticketNum = d.ticketOriginal || nextTicket
      // Si el ticket ya fue usado, asignar uno nuevo
      let intentos = 0
      while (ticketsUsados.has(ticketNum) && intentos < 10) {
        ticketNum = nextTicket
        nextTicket++
        intentos++
      }
      ticketsUsados.add(ticketNum)
      if (!d.ticketOriginal) nextTicket++

      // Determinar transportista
      let transportistaId: string | undefined
      if (d.transportista) {
        const key = d.transportista.toLowerCase().trim()
        transportistaId = transportistaMap.get(key)
        if (!transportistaId) {
          // Buscar parcial
          for (const [nombre, id] of transportistaMap) {
            if (nombre.includes(key) || key.includes(nombre)) {
              transportistaId = id
              break
            }
          }
        }
      }

      // Determinar estado
      const estado = (d.pesoBruto && d.pesoTara) ? 'CERRADO' : 'ABIERTO'

      // Parsear fecha
      const fecha = new Date(d.fechaHora)

      // Crear PesajeCamion + actualizar tropa en transacción
      await db.$transaction(async (tx) => {
        const pesaje = await tx.pesajeCamion.create({
          data: {
            tipo: 'INGRESO_HACIENDA',
            numeroTicket: ticketNum,
            patenteChasis: d.patenteChasis,
            patenteAcoplado: d.patenteAcoplado,
            choferNombre: d.chofer,
            choferDni: d.dni,
            transportistaId: transportistaId,
            pesoBruto: d.pesoBruto,
            pesoTara: d.pesoTara,
            pesoNeto: d.pesoNeto,
            observaciones: d.observaciones,
            estado: estado,
            fecha: fecha,
            fechaTara: d.pesoTara ? fecha : null,
            operadorId: operadorId,
          }
        })

        await tx.tropa.update({
          where: { id: tropa.id },
          data: {
            pesajeCamionId: pesaje.id,
            pesoBruto: d.pesoBruto,
            pesoTara: d.pesoTara,
            pesoNeto: d.pesoNeto,
          }
        })
      })

      importadas++
      console.log(
        `✅ Tropa ${String(d.tropa).padStart(3)} (${tropa.codigo}): ` +
        `Ticket #${ticketNum} | ` +
        `${fecha.toLocaleDateString('es-AR')} ${fecha.toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit'})} | ` +
        `Chasis: ${d.patenteChasis}${d.patenteAcoplado ? '+' + d.patenteAcoplado : ''} | ` +
        `Chofer: ${d.chofer || '-'}${d.dni ? ' (' + d.dni + ')' : ''} | ` +
        `B: ${d.pesoBruto} T: ${d.pesoTara} N: ${d.pesoNeto} | ` +
        `${transportistaId ? 'Transp: vinculado' : 'Transp: ' + (d.transportista || '-')}` +
        ` | ${estado}`
      )
    } catch (err: any) {
      errores++
      console.log(`❌ Error en Tropa ${d.tropa}: ${err.message}`)
    }
  }

  // ─── 8. Resumen final ───
  console.log('\n═══════════════════════════════════════════')
  console.log('  RESUMEN FINAL')
  console.log('═══════════════════════════════════════════')
  console.log(`  ✅ Pesajes importados: ${importadas}`)
  console.log(`  ℹ️  Ya existían:       ${conPesaje}`)
  console.log(`  ❌ Errores:            ${errores}`)
  console.log(`  📊 Total tropas 1-41:  ${tropasExistentes.length}`)
  console.log('═══════════════════════════════════════════')

  // ─── 9. Verificación ───
  if (importadas > 0) {
    console.log('\n── VERIFICACIÓN POST-IMPORTACIÓN ──')
    const verificadas = await db.tropa.findMany({
      where: { numero: { in: PESAJE_DATA.map((d: any) => d.tropa) } },
      include: { pesajeCamion: true },
      orderBy: { numero: 'asc' }
    })

    const conP = verificadas.filter(t => t.pesajeCamion).length
    const sinP = verificadas.filter(t => !t.pesajeCamion).length
    console.log(`Tropas con pesaje: ${conP}/${verificadas.length}`)
    if (sinP > 0) {
      console.log(`Tropas SIN pesaje: ${verificadas.filter(t => !t.pesajeCamion).map(t => t.numero).join(', ')}`)
    }

    console.log('\nDetalle:')
    for (const t of verificadas) {
      const p = t.pesajeCamion
      if (p) {
        console.log(
          `  ${String(t.numero).padStart(3)} ${t.codigo} | ` +
          `Tk:${p.numeroTicket} | ` +
          `B:${t.pesoBruto ?? '-'} T:${t.pesoTara ?? '-'} N:${t.pesoNeto ?? '-'} | ` +
          `${p.patenteChasis} | ${p.choferNombre || '-'} | ${p.fecha.toLocaleDateString('es-AR')}`
        )
      } else {
        console.log(`  ${String(t.numero).padStart(3)} ${t.codigo} | SIN PESAJE`)
      }
    }
  }
}

main()
  .catch(err => {
    console.error('❌ Error fatal:', err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
