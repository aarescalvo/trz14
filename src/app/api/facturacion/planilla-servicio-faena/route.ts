import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET — Listar planillas con filtros
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const desde = searchParams.get('desde') || undefined
    const hasta = searchParams.get('hasta') || undefined
    const usuarioId = searchParams.get('usuarioId') || undefined
    const tropaDesde = searchParams.get('tropaDesde') ? parseInt(searchParams.get('tropaDesde')!) : undefined
    const tropaHasta = searchParams.get('tropaHasta') ? parseInt(searchParams.get('tropaHasta')!) : undefined
    const estadoPago = searchParams.get('estadoPago') // "PAGADO", "PENDIENTE", "TODOS"
    const pagina = searchParams.get('pagina') ? parseInt(searchParams.get('pagina')!) : 1
    const limite = searchParams.get('limite') ? parseInt(searchParams.get('limite')!) : 200

    const where: any = {}

    if (desde || hasta) {
      where.fechaFaena = {}
      if (desde) where.fechaFaena.gte = new Date(desde + 'T00:00:00')
      if (hasta) where.fechaFaena.lte = new Date(hasta + 'T23:59:59')
    }

    if (usuarioId) where.usuarioFaenaId = usuarioId

    if (tropaDesde !== undefined || tropaHasta !== undefined) {
      where.numeroTropa = {}
      if (tropaDesde !== undefined) where.numeroTropa.gte = tropaDesde
      if (tropaHasta !== undefined) where.numeroTropa.lte = tropaHasta
    }

    if (estadoPago === 'PAGADO') {
      where.estadoPago = 0
    } else if (estadoPago === 'PENDIENTE') {
      where.estadoPago = { not: 0 }
    }

    const [planillas, total] = await Promise.all([
      db.planillaServicioFaena.findMany({
        where,
        include: {
          tropa: { select: { id: true, numero: true, codigo: true, estado: true } },
          usuarioFaena: { select: { id: true, nombre: true, razonSocial: true, cuit: true } },
        },
        orderBy: [{ numeroTropa: 'asc' }],
        skip: (pagina - 1) * limite,
        take: limite,
      }),
      db.planillaServicioFaena.count({ where }),
    ])

    // Resumen/KPIs
    const allFiltered = await db.planillaServicioFaena.findMany({
      where,
      select: {
        totalFacturaImp: true,
        montoDepositado: true,
        estadoPago: true,
        cantidadAnimales: true,
        kgGancho: true,
        precioServicioKg: true,
        numeroTropa: true,
        usuario: true,
        usuarioFaenaId: true,
      },
    })

    const totalFacturado = allFiltered.reduce((s, r) => s + r.totalFacturaImp, 0)
    const totalDepositado = allFiltered.reduce((s, r) => s + (r.montoDepositado || 0), 0)
    const saldoPendiente = allFiltered.reduce((s, r) => s + r.estadoPago, 0)
    const totalTropas = allFiltered.length
    const totalCabezas = allFiltered.reduce((s, r) => s + r.cantidadAnimales, 0)
    const totalKgGancho = allFiltered.reduce((s, r) => s + r.kgGancho, 0)
    const pagadas = allFiltered.filter(r => r.estadoPago === 0).length
    const pendientes = allFiltered.filter(r => r.estadoPago !== 0).length
    const promPrecioKg = totalKgGancho > 0
      ? allFiltered.reduce((s, r) => s + r.precioServicioKg, 0) / allFiltered.length
      : 0

    // Resumen por cliente
    const porCliente: Record<string, { tropas: number; cabezas: number; totalFacturado: number; totalDepositado: number; saldo: number }> = {}
    for (const r of allFiltered) {
      const key = r.usuario
      if (!porCliente[key]) {
        porCliente[key] = { tropas: 0, cabezas: 0, totalFacturado: 0, totalDepositado: 0, saldo: 0 }
      }
      porCliente[key].tropas++
      porCliente[key].cabezas += r.cantidadAnimales
      porCliente[key].totalFacturado += r.totalFacturaImp
      porCliente[key].totalDepositado += r.montoDepositado || 0
      porCliente[key].saldo += r.estadoPago
    }

    return NextResponse.json({
      success: true,
      data: planillas,
      paginacion: { pagina, limite, total, totalPaginas: Math.ceil(total / limite) },
      resumen: {
        totalFacturado,
        totalDepositado,
        saldoPendiente,
        totalTropas,
        totalCabezas,
        totalKgGancho,
        pagadas,
        pendientes,
        promPrecioKg,
      },
      porCliente,
    })
  } catch (error: any) {
    console.error('Error GET planilla-servicio-faena:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST — Crear nuevo registro
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Buscar tropa por numeroTropa
    let tropaId: string | null = null
    if (body.numeroTropa) {
      const tropa = await db.tropa.findFirst({
        where: { numero: body.numeroTropa },
        select: { id: true },
      })
      if (tropa) tropaId = tropa.id
    }

    // Buscar cliente por nombre
    let usuarioFaenaId: string | null = null
    if (body.usuario) {
      const cliente = await db.cliente.findFirst({
        where: { nombre: body.usuario.trim() },
        select: { id: true },
      })
      if (cliente) usuarioFaenaId = cliente.id
    }

    const planilla = await db.planillaServicioFaena.create({
      data: {
        tropaId,
        numeroTropa: body.numeroTropa,
        usuarioFaenaId,
        usuario: body.usuario?.trim() || '',
        cantidadAnimales: body.cantidadAnimales || 0,
        kgPie: body.kgPie || 0,
        fechaFaena: body.fechaFaena ? new Date(body.fechaFaena) : new Date(),
        kgGancho: body.kgGancho || 0,
        rindePorcentaje: body.rindePorcentaje || 0,
        precioServicioKg: body.precioServicioKg || 0,
        precioServicioKgConRecupero: body.precioServicioKgConRecupero ?? null,
        totalServicioIva: body.totalServicioIva || 0,
        tasaInspeccionVet: body.tasaInspeccionVet || 0,
        arancelIpcva: body.arancelIpcva || 0,
        totalFacturaImp: body.totalFacturaImp || 0,
        numeroFactura: body.numeroFactura || null,
        fechaFactura: body.fechaFactura ? new Date(body.fechaFactura) : null,
        fechaPago: body.fechaPago ? new Date(body.fechaPago) : null,
        diasPago: body.diasPago ?? null,
        montoDepositado: body.montoDepositado ?? null,
        estadoPago: body.estadoPago || 0,
        observaciones: body.observaciones || null,
      },
      include: {
        tropa: { select: { id: true, numero: true, codigo: true } },
        usuarioFaena: { select: { id: true, nombre: true } },
      },
    })

    return NextResponse.json({ success: true, data: planilla })
  } catch (error: any) {
    console.error('Error POST planilla-servicio-faena:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
