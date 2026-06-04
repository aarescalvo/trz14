/**
 * Script: Separar tickets compartidos de pesaje de camión
 * 
 * 1. Corrige tickets con errores de tipeo (tropas con ticket equivocado)
 * 2. Separa tickets duplicados asignando sufijos B, C, D...
 * 
 * Correcciones conocidas:
 *   Tropa 9:   0001-00014469 → 0001-00014468
 *   Tropa 12:  0001-00014472 → 0001-00014471
 *   Tropa 188: 0001-00015033 → 0001-00015032
 * 
 * USO:
 *   npx tsx scripts/separar-tickets-compartidos.ts
 *   npx tsx scripts/separar-tickets-compartidos.ts --dry-run
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

// Correcciones de tipeo: tropaNumero → ticket correcto
const CORRECCIONES_TICKET: Record<number, string> = {
  9: '0001-00014468',
  12: '0001-00014471',
  188: '0001-00015032',
}

async function main() {
  console.log('============================================')
  console.log('  SEPARAR TICKETS COMPARTIDOS DE PESAJE')
  console.log('============================================')
  console.log(`Modo: ${dryRun ? 'DRY RUN (sin cambios)' : 'EJECUCIÓN'}`)
  console.log('')

  // ── PASO 0: Corregir errores de tipeo ──
  console.log('0. Corrigiendo errores de tipeo en tickets...')
  let corregidos = 0
  for (const [tropaNum, ticketCorrecto] of Object.entries(CORRECCIONES_TICKET)) {
    const tropa = await db.tropa.findFirst({
      where: { numero: parseInt(tropaNum) },
      include: { pesajeCamion: { select: { id: true, numeroTicket: true } } }
    })
    if (!tropa?.pesajeCamionId || !tropa.pesajeCamion) {
      console.log(`   ⚠️ Tropa ${tropaNum}: sin pesaje camión, salteando`)
      continue
    }
    const ticketActual = tropa.pesajeCamion.numeroTicket
    if (ticketActual === ticketCorrecto) {
      console.log(`   ℹ️ Tropa ${tropaNum}: ya tiene ticket correcto "${ticketCorrecto}"`)
      continue
    }
    console.log(`   Tropa ${tropaNum}: "${ticketActual}" → "${ticketCorrecto}"`)
    if (!dryRun) {
      await db.pesajeCamion.update({
        where: { id: tropa.pesajeCamion.id },
        data: {
          numeroTicket: ticketCorrecto,
          observaciones: tropa.pesajeCamion.numeroTicket !== ticketActual
            ? `[Corregido de ${ticketActual}]`
            : undefined
        }
      })
      corregidos++
    }
  }
  console.log(`   Correcciones aplicadas: ${dryRun ? '(dry-run)' : corregidos}`)

  // ── PASO 1: Encontrar tickets duplicados ──
  console.log('\n1. Buscando tickets compartidos...')
  const duplicados = await db.$queryRawUnsafe<Array<{ numeroTicket: string; count: bigint }>>(`
    SELECT "numeroTicket", COUNT(*) as count
    FROM "PesajeCamion"
    GROUP BY "numeroTicket"
    HAVING COUNT(*) > 1
    ORDER BY "numeroTicket"
  `)
  
  console.log(`   Encontrados ${duplicados.length} tickets compartidos`)
  
  if (duplicados.length === 0) {
    console.log('   No hay tickets compartidos para separar.')
    console.log('\n=== FIN ===')
    return
  }

  // ── PASO 2: Listar detalles ──
  for (const dup of duplicados) {
    const pesajes = await db.pesajeCamion.findMany({
      where: { numeroTicket: dup.numeroTicket },
      include: {
        tropa: {
          select: { id: true, numero: true, codigo: true }
        }
      },
      orderBy: { fecha: 'asc' }
    })
    
    console.log(`\n   Ticket "${dup.numeroTicket}" (${dup.count} pesajes):`)
    for (const p of pesajes) {
      const tropaStr = p.tropa ? `Tropa ${p.tropa.numero} (${p.tropa.codigo})` : 'Sin tropa'
      console.log(`     - ${tropaStr}: bruto=${p.pesoBruto ?? 'null'}, tara=${p.pesoTara ?? 'null'}, neto=${p.pesoNeto ?? 'null'}`)
    }
  }

  if (dryRun) {
    console.log('\n   --- DRY RUN: no se aplican cambios ---')
    console.log('\n=== FIN ===')
    return
  }

  // ── PASO 3: Separar tickets ──
  console.log('\n3. Separando tickets...')
  let separados = 0
  let errores = 0

  for (const dup of duplicados) {
    const pesajes = await db.pesajeCamion.findMany({
      where: { numeroTicket: dup.numeroTicket },
      include: {
        tropa: {
          select: { id: true, numero: true, codigo: true }
        }
      },
      orderBy: { fecha: 'asc' }
    })

    if (pesajes.length < 2) continue

    const ticketOriginal = dup.numeroTicket
    const sufijos = ['B', 'C', 'D', 'E', 'F', 'G', 'H']

    console.log(`\n   Ticket "${ticketOriginal}":`)

    for (let i = 0; i < pesajes.length; i++) {
      const pesaje = pesajes[i]

      if (i === 0) {
        // Primera tropa: queda con el ticket original
        console.log(`     ✅ ${pesaje.tropa ? `Tropa ${pesaje.tropa.numero}` : 'Sin tropa'}: mantiene ticket "${ticketOriginal}"`)
        continue
      }

      // Tropas 2+: asignar ticket con sufijo
      const nuevoTicket = ticketOriginal + sufijos[i - 1]
      const tropaStr = pesaje.tropa ? `Tropa ${pesaje.tropa.numero} (${pesaje.tropa.codigo})` : 'Sin tropa'
      
      try {
        await db.$transaction(async (tx) => {
          // Actualizar pesaje con nuevo ticket
          await tx.pesajeCamion.update({
            where: { id: pesaje.id },
            data: {
              numeroTicket: nuevoTicket,
              pesoBruto: null,
              pesoTara: null,
              pesoNeto: null,
              estado: 'ABIERTO',
              observaciones: pesaje.observaciones
                ? `${pesaje.observaciones} [Ticket original: ${ticketOriginal}]`
                : `Ticket original: ${ticketOriginal}`
            }
          })
          
          // Actualizar pesos en tropa vinculada
          if (pesaje.tropa) {
            await tx.tropa.update({
              where: { id: pesaje.tropa.id },
              data: {
                pesoBruto: null,
                pesoTara: null,
                pesoNeto: null
              }
            })
          }
        })
        
        console.log(`     ✅ ${tropaStr}: ticket → "${nuevoTicket}" (pesos limpiados)`)
        separados++
      } catch (err: any) {
        errores++
        console.log(`     ❌ ${tropaStr}: error - ${err.message}`)
      }
    }
  }

  // ── PASO 4: Resumen ──
  console.log('\n============================================')
  console.log('  RESUMEN')
  console.log('============================================')
  console.log(`Correcciones de tipeo: ${corregidos}`)
  console.log(`Tickets compartidos encontrados: ${duplicados.length}`)
  console.log(`Pesajes separados: ${separados}`)
  console.log(`Errores: ${errores}`)

  // ── PASO 5: Verificación ──
  console.log('\n--- Verificación post-migración ---')
  const dupPost = await db.$queryRawUnsafe<Array<{ numeroTicket: string; count: bigint }>>(`
    SELECT "numeroTicket", COUNT(*) as count
    FROM "PesajeCamion"
    GROUP BY "numeroTicket"
    HAVING COUNT(*) > 1
    ORDER BY "numeroTicket"
  `)
  
  if (dupPost.length === 0) {
    console.log('   ✅ No quedan tickets compartidos')
  } else {
    console.log(`   ⚠️ Quedan ${dupPost.length} tickets compartidos:`)
    for (const d of dupPost) {
      console.log(`     - "${d.numeroTicket}" (${d.count} pesajes)`)
    }
  }

  console.log('\n=== FIN ===')
}

main()
  .catch(e => { console.error('ERROR FATAL:', e); process.exit(1) })
  .finally(() => db.$disconnect())
