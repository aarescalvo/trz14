import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET — Obtener un registro por ID
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const planilla = await db.planillaServicioFaena.findUnique({
      where: { id },
      include: {
        tropa: { select: { id: true, numero: true, codigo: true, estado: true } },
        usuarioFaena: { select: { id: true, nombre: true, razonSocial: true, cuit: true } },
      },
    })
    if (!planilla) {
      return NextResponse.json({ success: false, error: 'Registro no encontrado' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: planilla })
  } catch (error: any) {
    console.error('Error GET planilla by id:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// PUT — Editar un registro
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = await db.planillaServicioFaena.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Registro no encontrado' }, { status: 404 })
    }

    // Build update data (only include fields that are provided)
    const data: any = {}
    const fields = [
      'usuario', 'cantidadAnimales', 'kgPie', 'fechaFaena', 'kgGancho', 'rindePorcentaje',
      'precioServicioKg', 'precioServicioKgConRecupero', 'totalServicioIva',
      'tasaInspeccionVet', 'arancelIpcva', 'totalFacturaImp',
      'numeroFactura', 'fechaFactura', 'fechaPago', 'diasPago',
      'montoDepositado', 'estadoPago', 'observaciones',
    ]

    for (const field of fields) {
      if (body[field] !== undefined) {
        if (['fechaFaena', 'fechaFactura', 'fechaPago'].includes(field)) {
          data[field] = body[field] ? new Date(body[field]) : null
        } else {
          data[field] = body[field]
        }
      }
    }

    // Re-link tropa if numeroTropa changed
    if (body.numeroTropa !== undefined && body.numeroTropa !== existing.numeroTropa) {
      data.numeroTropa = body.numeroTropa
      const tropa = await db.tropa.findFirst({
        where: { numero: body.numeroTropa },
        select: { id: true },
      })
      data.tropaId = tropa?.id || null
    }

    // Re-link cliente if usuario changed
    if (body.usuario !== undefined && body.usuario !== existing.usuario) {
      const cliente = await db.cliente.findFirst({
        where: { nombre: (body.usuario || '').trim() },
        select: { id: true },
      })
      data.usuarioFaenaId = cliente?.id || null
    }

    const updated = await db.planillaServicioFaena.update({
      where: { id },
      data,
      include: {
        tropa: { select: { id: true, numero: true, codigo: true } },
        usuarioFaena: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Error PUT planilla by id:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// DELETE — Eliminar un registro
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const existing = await db.planillaServicioFaena.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Registro no encontrado' }, { status: 404 })
    }
    await db.planillaServicioFaena.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'Registro eliminado' })
  } catch (error: any) {
    console.error('Error DELETE planilla by id:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
