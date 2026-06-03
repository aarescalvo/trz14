/**
 * Corregir campo "mes" en DetalleTropaFaena basándose en PlanillaServicioFaena.fechaFaena
 * 
 * SEGURIDAD: Solo actualiza el campo "mes", no toca ningún otro dato.
 * Ejecutar: npx tsx prisma/fix-mes-detalle.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const MESES_NOMBRES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
]

async function main() {
  console.log('=== CORRECCIÓN DE MES EN DETALLE TROPA ===\n')

  // Obtener todos los detalles con su planilla
  const detalles = await db.detalleTropaFaena.findMany({
    select: {
      id: true,
      numeroTropa: true,
      mes: true,
      tropaId: true,
    }
  })

  console.log(`Total detalles encontrados: ${detalles.length}\n`)

  let corregidos = 0
  let sinCambios = 0
  let sinFecha = 0

  for (const det of detalles) {
    // Buscar fecha de faena: prioridad planilla > tropa
    const planilla = await db.planillaServicioFaena.findFirst({
      where: {
        OR: [
          { tropaId: det.tropaId },
          { numeroTropa: det.numeroTropa }
        ]
      },
      select: { fechaFaena: true }
    })

    let fechaStr: string | null = null
    if (planilla?.fechaFaena) {
      fechaStr = planilla.fechaFaena.toISOString()
    } else {
      // Fallback: tropa.fechaFaena
      const tropa = await db.tropa.findUnique({
        where: { id: det.tropaId },
        select: { fechaFaena: true }
      })
      fechaStr = tropa?.fechaFaena?.toISOString() || null
    }

    if (!fechaStr) {
      sinFecha++
      console.log(`  Tropa ${det.numeroTropa}: SIN FECHA (se mantiene "${det.mes || 'VACÍO'}")`)
      continue
    }

    const d = new Date(fechaStr)
    const mesCalculado = MESES_NOMBRES[d.getMonth()]

    if (det.mes === mesCalculado) {
      sinCambios++
      continue
    }

    // Actualizar
    const mesAnterior = det.mes || 'VACÍO'
    await db.detalleTropaFaena.update({
      where: { id: det.id },
      data: { mes: mesCalculado }
    })
    corregidos++
    console.log(`  Tropa ${det.numeroTropa}: "${mesAnterior}" → "${mesCalculado}" (fecha: ${fechaStr.split('T')[0]})`)
  }

  console.log('\n=== RESUMEN ===')
  console.log(`Corregidos: ${corregidos}`)
  console.log(`Sin cambios (ya correctos): ${sinCambios}`)
  console.log(`Sin fecha (no se modificaron): ${sinFecha}`)
  console.log(`Total: ${detalles.length}`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
