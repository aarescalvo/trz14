import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET — Listar items extras de una planilla de servicio faena
// URL param: id (planillaServicioFaenaId)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const planilla = await db.planillaServicioFaena.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!planilla) {
      return NextResponse.json({ success: false, error: 'Planilla no encontrada' }, { status: 404 })
    }

    const items = await db.itemExtraPlanilla.findMany({
      where: { planillaServicioFaenaId: id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ success: true, data: items })
  } catch (error: any) {
    console.error('Error GET items-extras:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST — Crear un item extra para una planilla
// URL param: id (planillaServicioFaenaId)
// Body: { tipoItem: string, cantidadKg: number, descripcion?: string }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { tipoItem, cantidadKg, descripcion } = body

    if (!tipoItem || typeof tipoItem !== 'string' || tipoItem.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'tipoItem es obligatorio y debe ser un string no vacío.' },
        { status: 400 },
      )
    }

    if (cantidadKg === undefined || cantidadKg === null || typeof cantidadKg !== 'number' || cantidadKg < 0) {
      return NextResponse.json(
        { success: false, error: 'cantidadKg es obligatorio y debe ser un número >= 0.' },
        { status: 400 },
      )
    }

    // Validate planilla exists
    const planilla = await db.planillaServicioFaena.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!planilla) {
      return NextResponse.json({ success: false, error: 'Planilla no encontrada' }, { status: 404 })
    }

    const item = await db.itemExtraPlanilla.create({
      data: {
        planillaServicioFaenaId: id,
        tipoItem: tipoItem.trim(),
        cantidadKg,
        descripcion: descripcion?.trim() || null,
        precioUnitario: 0,
        subtotal: 0,
      },
    })

    return NextResponse.json({ success: true, data: item }, { status: 201 })
  } catch (error: any) {
    console.error('Error POST items-extras:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// PUT — Actualizar un item extra
// Body: { id: string, tipoItem?: string, cantidadKg?: number, descripcion?: string, precioUnitario?: number }
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, tipoItem, cantidadKg, descripcion, precioUnitario } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'El campo id es obligatorio.' },
        { status: 400 },
      )
    }

    // Validate item exists
    const existing = await db.itemExtraPlanilla.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Item extra no encontrado' }, { status: 404 })
    }

    // Build update data
    const data: any = {}

    if (tipoItem !== undefined) {
      if (typeof tipoItem !== 'string' || tipoItem.trim() === '') {
        return NextResponse.json(
          { success: false, error: 'tipoItem debe ser un string no vacío.' },
          { status: 400 },
        )
      }
      data.tipoItem = tipoItem.trim()
    }

    if (cantidadKg !== undefined) {
      if (typeof cantidadKg !== 'number' || cantidadKg < 0) {
        return NextResponse.json(
          { success: false, error: 'cantidadKg debe ser un número >= 0.' },
          { status: 400 },
        )
      }
      data.cantidadKg = cantidadKg
    }

    if (descripcion !== undefined) {
      data.descripcion = descripcion?.trim() || null
    }

    if (precioUnitario !== undefined) {
      if (typeof precioUnitario !== 'number' || precioUnitario < 0) {
        return NextResponse.json(
          { success: false, error: 'precioUnitario debe ser un número >= 0.' },
          { status: 400 },
        )
      }
      data.precioUnitario = precioUnitario
      // Recalculate subtotal using the new precioUnitario and the effective cantidadKg
      const effectiveCantidadKg = cantidadKg !== undefined ? cantidadKg : existing.cantidadKg
      data.subtotal = effectiveCantidadKg * precioUnitario
    }

    const updated = await db.itemExtraPlanilla.update({
      where: { id },
      data,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Error PUT items-extras:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// DELETE — Eliminar un item extra
// Body: { id: string }
// Solo permite eliminar si la planilla padre está en estado BORRADOR o APROBADO
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id } = body

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'El campo id es obligatorio.' },
        { status: 400 },
      )
    }

    // Validate item exists and get parent planilla
    const item = await db.itemExtraPlanilla.findUnique({
      where: { id },
      include: {
        planillaServicioFaena: {
          select: { id: true, estado: true },
        },
      },
    })

    if (!item) {
      return NextResponse.json({ success: false, error: 'Item extra no encontrado' }, { status: 404 })
    }

    // Only allow deletion if planilla is BORRADOR or APROBADO
    if (item.planillaServicioFaena.estado === 'FACTURADO') {
      return NextResponse.json(
        {
          success: false,
          error: 'No se puede eliminar un item extra de una planilla en estado FACTURADO.',
        },
        { status: 400 },
      )
    }

    await db.itemExtraPlanilla.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, message: 'Item extra eliminado correctamente.' })
  } catch (error: any) {
    console.error('Error DELETE items-extras:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
