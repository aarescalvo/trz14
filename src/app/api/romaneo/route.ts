import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// GET - Obtener romaneos
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeRomaneo')
  if (authError) return authError
  try {
    const { searchParams } = new URL(request.url)
    const garron = searchParams.get('garron')
    const tropaCodigo = searchParams.get('tropaCodigo')
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')
    const estado = searchParams.get('estado')
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000)
    const offset = parseInt(searchParams.get('offset') || '0')

    const where: any = {}

    if (garron) where.garron = parseInt(garron)
    if (tropaCodigo) where.tropaCodigo = tropaCodigo
    if (estado) where.estado = estado.toUpperCase()
    if (fechaDesde || fechaHasta) {
      where.fecha = {}
      if (fechaDesde) where.fecha.gte = new Date(fechaDesde)
      if (fechaHasta) {
        const hasta = new Date(fechaHasta)
        hasta.setHours(23, 59, 59, 999)
        where.fecha.lte = hasta
      }
    }

    const [romaneos, total] = await Promise.all([
      db.romaneo.findMany({
        where,
        include: {
          tipificador: true,
          operador: {
            select: { nombre: true, rol: true }
          },
          mediasRes: {
            include: { camara: true }
          }
        },
        orderBy: { fecha: 'desc' },
        take: limit,
        skip: offset
      }),
      db.romaneo.count({ where })
    ])

    return NextResponse.json({
      success: true,
      data: romaneos.map(r => ({
        id: r.id,
        garron: r.garron,
        tropaCodigo: r.tropaCodigo,
        numeroAnimal: r.numeroAnimal,
        tipoAnimal: r.tipoAnimal,
        raza: r.raza,
        pesoVivo: r.pesoVivo,
        pesoMediaIzq: r.pesoMediaIzq,
        pesoMediaDer: r.pesoMediaDer,
        pesoTotal: r.pesoTotal,
        rinde: (r.pesoVivo && r.pesoVivo > 0 && r.pesoTotal && r.pesoTotal > 0)
          ? Math.round((r.pesoTotal / r.pesoVivo) * 10000) / 100
          : r.rinde,
        denticion: r.denticion,
        estado: r.estado,
        fecha: r.fecha.toISOString(),
        tipificador: r.tipificador,
        operador: r.operador,
        mediasRes: r.mediasRes.map(m => ({
          id: m.id,
          lado: m.lado,
          peso: m.peso,
          sigla: m.sigla,
          codigo: m.codigo,
          estado: m.estado,
          camara: m.camara?.nombre
        }))
      })),
      pagination: { total, limit, offset, pages: Math.ceil(total / limit) }
    })
  } catch (error) {
    console.error('Error fetching romaneos:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener romaneos' },
      { status: 500 }
    )
  }
}

// POST - Crear romaneo
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeRomaneo')
  if (authError) return authError
  try {
    const body = await request.json()
    const {
      garron,
      tropaCodigo,
      numeroAnimal,
      tipoAnimal,
      raza,
      pesoVivo,
      pesoMediaIzq,
      pesoMediaDer,
      denticion,
      tipificadorId,
      operadorId,
      listaFaenaId
    } = body

    if (!garron) {
      return NextResponse.json(
        { success: false, error: 'garron es requerido' },
        { status: 400 }
      )
    }

    // Calcular peso total y rinde
    const pesoIzq = parseFloat(pesoMediaIzq) || 0
    const pesoDer = parseFloat(pesoMediaDer) || 0
    const pesoTotal = pesoIzq + pesoDer
    const pesoVivoNum = parseFloat(pesoVivo) || 0
    const rinde = pesoVivoNum > 0 ? (pesoTotal / pesoVivoNum) * 100 : null

    const romaneo = await db.romaneo.create({
      data: {
        garron: parseInt(garron),
        tropaCodigo,
        numeroAnimal: numeroAnimal ? parseInt(numeroAnimal) : null,
        tipoAnimal,
        raza,
        pesoVivo: pesoVivoNum || null,
        pesoMediaIzq: pesoIzq || null,
        pesoMediaDer: pesoDer || null,
        pesoTotal: pesoTotal || null,
        rinde,
        denticion,
        tipificadorId,
        operadorId,
        listaFaenaId,
        estado: 'PENDIENTE'
      },
      include: {
        tipificador: true
      }
    })

    return NextResponse.json({
      success: true,
      data: romaneo
    })
  } catch (error) {
    console.error('Error creating romaneo:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear romaneo' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar romaneo
export async function PUT(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeRomaneo')
  if (authError) return authError
  try {
    const body = await request.json()
    const {
      id,
      pesoMediaIzq,
      pesoMediaDer,
      denticion,
      tipificadorId,
      estado
    } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID es requerido' },
        { status: 400 }
      )
    }

    // Calcular nuevos valores si hay pesos
    const updateData: Record<string, unknown> = {}
    
    if (pesoMediaIzq !== undefined) updateData.pesoMediaIzq = parseFloat(pesoMediaIzq) || null
    if (pesoMediaDer !== undefined) updateData.pesoMediaDer = parseFloat(pesoMediaDer) || null
    if (denticion !== undefined) updateData.denticion = denticion
    if (tipificadorId !== undefined) updateData.tipificadorId = tipificadorId
    if (estado !== undefined) updateData.estado = estado

    // Recalcular peso total y rinde
    const romaneoActual = await db.romaneo.findUnique({ where: { id } })
    if (romaneoActual) {
      const pesoIzq = pesoMediaIzq != null ? parseFloat(pesoMediaIzq) : (romaneoActual.pesoMediaIzq || 0)
      const pesoDer = pesoMediaDer != null ? parseFloat(pesoMediaDer) : (romaneoActual.pesoMediaDer || 0)
      updateData.pesoTotal = pesoIzq + pesoDer
      if (romaneoActual.pesoVivo && (pesoIzq + pesoDer) > 0) {
        updateData.rinde = ((pesoIzq + pesoDer) / romaneoActual.pesoVivo) * 100
      }
    }

    const romaneo = await db.romaneo.update({
      where: { id },
      data: updateData,
      include: { tipificador: true }
    })

    return NextResponse.json({ success: true, data: romaneo })
  } catch (error) {
    console.error('Error updating romaneo:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar romaneo' },
      { status: 500 }
    )
  }
}
