import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST — Importar registros desde JSON (masivo)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { registros, operadorId } = body

    if (!registros || !Array.isArray(registros) || registros.length === 0) {
      return NextResponse.json({ success: false, error: 'No se proporcionaron registros para importar' }, { status: 400 })
    }

    // Precargar todas las tropas y clientes para vincular
    const allTropas = await db.tropa.findMany({
      select: { id: true, numero: true },
    })
    const allClientes = await db.cliente.findMany({
      select: { id: true, nombre: true },
    })

    const tropaMap = new Map(allTropas.map(t => [t.numero, t.id]))
    const clienteMap = new Map(allClientes.map(c => [c.nombre.trim().toUpperCase(), c.id]))

    let creados = 0
    let actualizados = 0
    let errores: string[] = []

    // Procesar en lotes de 50
    const batchSize = 50
    for (let i = 0; i < registros.length; i += batchSize) {
      const batch = registros.slice(i, i + batchSize)

      const operations = batch.map(async (rec: any) => {
        try {
          const numeroTropa = parseInt(rec.numeroTropa) || rec.numeroTropa
          const usuario = (rec.usuario || '').trim()

          // Buscar existente por numeroTropa
          const existing = await db.planillaServicioFaena.findFirst({
            where: { numeroTropa },
          })

          if (existing) {
            // Actualizar existente
            await db.planillaServicioFaena.update({
              where: { id: existing.id },
              data: {
                usuario,
                usuarioFaenaId: clienteMap.get(usuario.toUpperCase()) || null,
                cantidadAnimales: rec.cantidadAnimales || 0,
                kgPie: rec.kgPie || 0,
                fechaFaena: rec.fechaFaena ? new Date(rec.fechaFaena) : existing.fechaFaena,
                kgGancho: rec.kgGancho || 0,
                rindePorcentaje: rec.rindePorcentaje || 0,
                precioServicioKg: rec.precioServicioKg || 0,
                precioServicioKgConRecupero: rec.precioServicioKgConRecupero ?? null,
                totalServicioIva: rec.totalServicioIva || 0,
                tasaInspeccionVet: rec.tasaInspeccionVet || 0,
                arancelIpcva: rec.arancelIpcva || 0,
                totalFacturaImp: rec.totalFacturaImp || 0,
                numeroFactura: rec.numeroFactura || null,
                fechaFactura: rec.fechaFactura ? new Date(rec.fechaFactura) : null,
                fechaPago: rec.fechaPago ? new Date(rec.fechaPago) : null,
                diasPago: rec.diasPago ?? null,
                montoDepositado: rec.montoDepositado ?? null,
                estadoPago: rec.estadoPago || 0,
                observaciones: rec.observaciones || null,
              },
            })
            actualizados++
          } else {
            // Crear nuevo
            await db.planillaServicioFaena.create({
              data: {
                tropaId: tropaMap.get(numeroTropa) || null,
                numeroTropa,
                usuario,
                usuarioFaenaId: clienteMap.get(usuario.toUpperCase()) || null,
                cantidadAnimales: rec.cantidadAnimales || 0,
                kgPie: rec.kgPie || 0,
                fechaFaena: rec.fechaFaena ? new Date(rec.fechaFaena) : new Date(),
                kgGancho: rec.kgGancho || 0,
                rindePorcentaje: rec.rindePorcentaje || 0,
                precioServicioKg: rec.precioServicioKg || 0,
                precioServicioKgConRecupero: rec.precioServicioKgConRecupero ?? null,
                totalServicioIva: rec.totalServicioIva || 0,
                tasaInspeccionVet: rec.tasaInspeccionVet || 0,
                arancelIpcva: rec.arancelIpcva || 0,
                totalFacturaImp: rec.totalFacturaImp || 0,
                numeroFactura: rec.numeroFactura || null,
                fechaFactura: rec.fechaFactura ? new Date(rec.fechaFactura) : null,
                fechaPago: rec.fechaPago ? new Date(rec.fechaPago) : null,
                diasPago: rec.diasPago ?? null,
                montoDepositado: rec.montoDepositado ?? null,
                estadoPago: rec.estadoPago || 0,
                observaciones: rec.observaciones || null,
              },
            })
            creados++
          }
        } catch (err: any) {
          errores.push(`Tropa ${rec.numeroTropa}: ${err.message}`)
        }
      })

      await Promise.all(operations)
    }

    return NextResponse.json({
      success: true,
      message: `Importación completada: ${creados} creados, ${actualizados} actualizados, ${errores.length} errores`,
      creados,
      actualizados,
      errores,
      cantidadErrores: errores.length,
    })
  } catch (error: any) {
    console.error('Error POST import planilla:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
