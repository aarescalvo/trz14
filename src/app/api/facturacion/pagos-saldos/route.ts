import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// ==================== TYPES ====================

type EstadoPago = 'PAGADO' | 'VENCIDO' | 'PENDIENTE'

interface FacturaConCalculos {
  id: string
  numero: string
  fecha: Date
  total: number
  estado: string
  plazoPagoDias: number
  observaciones: string | null
  clienteId: string
  cliente: { id: string; nombre: string; cuit: string | null }
  pagosFactura: { id: string; fecha: Date; monto: number; metodoPago: string; referencia: string | null }[]
  planillasFactura?: { numeroTropa: number }[]
  totalPagado: number
  saldoPendiente: number
  diasTranscurridos: number
  estadoPago: EstadoPago
}

interface KPIs {
  totalFacturado: number
  totalCobrado: number
  saldoTotalPendiente: number
  facturasVencidas: number
  montoVencido: number
  facturasProximasVencer: number
  pagosHoy: number
}

// ==================== HELPERS ====================

function calcularEstadoPago(
  saldoPendiente: number,
  diasTranscurridos: number,
  plazoPagoDias: number
): EstadoPago {
  if (saldoPendiente <= 0) return 'PAGADO'
  if (diasTranscurridos > plazoPagoDias) return 'VENCIDO'
  return 'PENDIENTE'
}

function enrichFactura(factura: any): FacturaConCalculos {
  const totalPagado = factura.pagosFactura.reduce(
    (sum: number, p: any) => sum + p.monto,
    0
  )
  const saldoPendiente = factura.total - totalPagado
  const diasTranscurridos = Math.floor(
    (Date.now() - new Date(factura.fecha).getTime()) / (1000 * 60 * 60 * 24)
  )
  const plazoPagoDias = factura.plazoPagoDias ?? 30

  return {
    id: factura.id,
    numero: factura.numero,
    fecha: factura.fecha,
    total: factura.total,
    estado: factura.estado,
    plazoPagoDias,
    observaciones: factura.observaciones,
    clienteId: factura.clienteId,
    cliente: factura.cliente,
    pagosFactura: factura.pagosFactura,
    planillasFactura: factura.planillasFactura,
    totalPagado,
    saldoPendiente,
    diasTranscurridos,
    estadoPago: calcularEstadoPago(saldoPendiente, diasTranscurridos, plazoPagoDias),
  }
}

// ==================== GET ====================

export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const clienteId = searchParams.get('clienteId')
    const paginaParam = searchParams.get('pagina') || '1'
    const limiteParam = searchParams.get('limite') || '50'
    const soloVencidas = searchParams.get('soloVencidas') === 'true'

    const pagina = Math.max(1, parseInt(paginaParam, 10))
    const limite = Math.min(200, Math.max(1, parseInt(limiteParam, 10)))

    // Base where: only EMITIDA (not PAGADA or ANULADA)
    const where: Record<string, unknown> = {
      estado: 'EMITIDA',
    }

    if (clienteId) {
      where.clienteId = clienteId
    }

    // ==================== FETCH: Tabla Factura (facturas generales) ====================
    const facturasGenerales = await db.factura.findMany({
      where,
      include: {
        cliente: {
          select: { id: true, nombre: true, cuit: true },
        },
        pagosFactura: {
          select: {
            id: true,
            fecha: true,
            monto: true,
            metodoPago: true,
            referencia: true,
          },
        },
        planillasFactura: {
          select: {
            id: true,
            numeroTropa: true,
            usuario: true,
          },
        },
      },
      orderBy: { fecha: 'desc' },
    })

    // ==================== FETCH: PlanillaServicioFaena (planillas facturadas) ====================
    const planillaWhere: Record<string, unknown> = { estado: 'FACTURADO' }
    if (clienteId) {
      planillaWhere.usuarioFaenaId = clienteId
    }

    const planillasFacturadas = await db.planillaServicioFaena.findMany({
      where: planillaWhere,
      include: {
        usuarioFaena: {
          select: { id: true, nombre: true, cuit: true },
        },
      },
      orderBy: { numeroTropa: 'asc' },
    })

    // Convertir planillas al formato compatible con enrichFactura
    const planillasComoFacturas = planillasFacturadas.map(p => ({
      id: p.id,
      numero: p.numeroFactura || '-',
      fecha: p.fechaFactura || p.fechaFaena,
      total: p.totalFacturaImp,
      estado: (p.montoDepositado != null && p.montoDepositado >= p.totalFacturaImp) ? 'PAGADA' : 'EMITIDA',
      plazoPagoDias: p.plazoPagoDias ?? 30,
      observaciones: p.observaciones,
      clienteId: p.usuarioFaenaId || '',
      cliente: p.usuarioFaena ? { id: p.usuarioFaena.id, nombre: p.usuarioFaena.nombre, cuit: p.usuarioFaena.cuit } : null,
      pagosFactura: (p.montoDepositado && p.montoDepositado > 0 && p.fechaPago) ? [{
        id: p.id + '-pago',
        fecha: p.fechaPago,
        monto: p.montoDepositado,
        metodoPago: p.observaciones || 'DEPOSITO',
        referencia: null,
      }] : [],
      planillasFactura: [{ id: p.id, numeroTropa: p.numeroTropa, usuario: p.usuario }],
    }))

    // Combinar ambas fuentes
    const todasLasFacturas = [...planillasComoFacturas, ...facturasGenerales]

    // Enrich with calculations
    const facturasConCalculos = todasLasFacturas.map(enrichFactura)

    // ==================== KPIs (computed on the full set) ====================
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const maniana = new Date(hoy)
    maniana.setDate(maniana.getDate() + 1)

    let totalFacturado = 0
    let totalCobrado = 0
    let facturasVencidas = 0
    let montoVencido = 0
    let facturasProximasVencer = 0
    let pagosHoy = 0

    for (const f of facturasConCalculos) {
      totalFacturado += f.total
      totalCobrado += f.totalPagado

      if (f.estadoPago === 'VENCIDO') {
        facturasVencidas++
        montoVencido += f.saldoPendiente
      }

      // Próximas a vencer: within 5 days of deadline, not yet VENCIDO and not PAGADO
      if (
        f.estadoPago === 'PENDIENTE' &&
        f.diasTranscurridos >= f.plazoPagoDias - 5
      ) {
        facturasProximasVencer++
      }

      // Pagos hoy
      for (const p of f.pagosFactura) {
        const fechaPago = new Date(p.fecha)
        if (fechaPago >= hoy && fechaPago < maniana) {
          pagosHoy++
        }
      }
    }

    const kpis: KPIs = {
      totalFacturado,
      totalCobrado,
      saldoTotalPendiente: totalFacturado - totalCobrado,
      facturasVencidas,
      montoVencido,
      facturasProximasVencer,
      pagosHoy,
    }

    // ==================== Filtering & Sorting ====================
    let resultado = facturasConCalculos

    // Filter by soloVencidas
    if (soloVencidas) {
      resultado = resultado.filter((f) => f.estadoPago === 'VENCIDO')
    }

    // Sort: VENCIDO first, then by numeroTropa asc, then by diasTranscurridos desc
    resultado.sort((a, b) => {
      const prioridadA = a.estadoPago === 'VENCIDO' ? 0 : 1
      const prioridadB = b.estadoPago === 'VENCIDO' ? 0 : 1
      if (prioridadA !== prioridadB) return prioridadA - prioridadB
      // Ordenar por tropa
      const tropaA = a.planillasFactura?.[0]?.numeroTropa
      const tropaB = b.planillasFactura?.[0]?.numeroTropa
      if (tropaA != null && tropaB != null) return tropaA - tropaB
      if (tropaA != null) return -1
      if (tropaB != null) return 1
      return b.diasTranscurridos - a.diasTranscurridos
    })

    // ==================== Pagination ====================
    const total = resultado.length
    const totalPaginas = Math.max(1, Math.ceil(total / limite))
    const skip = (pagina - 1) * limite
    const paginadas = resultado.slice(skip, skip + limite)

    return NextResponse.json({
      success: true,
      data: paginadas,
      kpis,
      paginacion: {
        pagina,
        limite,
        total,
        totalPaginas,
      },
    })
  } catch (error) {
    console.error('[pagos-saldos] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener datos de pagos y saldos' },
      { status: 500 }
    )
  }
}

// ==================== POST ====================

export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeFacturacion')
  if (authError) return authError

  try {
    const body = await request.json()
    const {
      facturaId,
      monto,
      metodoPago,
      fecha,
      referencia,
      banco,
      observaciones,
    } = body as {
      facturaId: string
      monto: number
      metodoPago?: string
      fecha?: string
      referencia?: string
      banco?: string
      observaciones?: string
    }

    // Validate required fields
    if (!facturaId) {
      return NextResponse.json(
        { success: false, error: 'facturaId es requerido' },
        { status: 400 }
      )
    }
    if (typeof monto !== 'number' || monto <= 0) {
      return NextResponse.json(
        { success: false, error: 'El monto debe ser un número positivo' },
        { status: 400 }
      )
    }

    // Get factura
    const factura = await db.factura.findUnique({
      where: { id: facturaId },
      include: {
        pagosFactura: { select: { monto: true } },
      },
    })

    if (!factura) {
      return NextResponse.json(
        { success: false, error: 'Factura no encontrada' },
        { status: 404 }
      )
    }

    if (factura.estado !== 'EMITIDA') {
      return NextResponse.json(
        {
          success: false,
          error: `La factura está en estado ${factura.estado}. Solo se pueden registrar pagos en facturas EMITIDA.`,
        },
        { status: 400 }
      )
    }

    // Create payment and update factura in a transaction
    const resultado = await db.$transaction(async (tx) => {
      // Get operadorId from headers
      const operadorId = request.headers.get('x-operador-id') || undefined

      // Create the payment
      const pago = await tx.pagoFactura.create({
        data: {
          facturaId,
          monto,
          metodoPago: metodoPago || 'EFECTIVO',
          fecha: fecha ? new Date(fecha) : new Date(),
          referencia: referencia || null,
          banco: banco || null,
          observaciones: observaciones || null,
          operadorId,
        },
        include: {
          factura: {
            include: {
              cliente: {
                select: { id: true, nombre: true, cuit: true },
              },
            },
          },
          operador: {
            select: { id: true, nombre: true },
          },
        },
      })

      // Calculate new total paid
      const totalPagado = factura.pagosFactura.reduce(
        (sum, p) => sum + p.monto,
        0
      )
      const nuevoTotalPagado = totalPagado + monto
      const nuevoSaldo = factura.total - nuevoTotalPagado

      // If fully paid, update factura estado to PAGADA
      if (nuevoSaldo <= 0) {
        await tx.factura.update({
          where: { id: facturaId },
          data: {
            estado: 'PAGADA',
            fechaPago: new Date(),
          },
        })
      }

      return pago
    })

    return NextResponse.json({
      success: true,
      data: resultado,
      message: 'Pago registrado exitosamente',
    })
  } catch (error) {
    console.error('[pagos-saldos] POST error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al registrar pago' },
      { status: 500 }
    )
  }
}
