import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// ==================== TYPES ====================
interface CargaBody {
  id: string
  precioServicioKg: number
  tasaInspeccionVet: number
  arancelIpcva: number
  plazoPagoDias: number
  numeroFactura: string
  fechaFactura?: string
  observaciones?: string
  itemsExtras?: { id: string; precioUnitario: number }[]
  operadorId?: string
}

// ==================== GET — List APROBADO planillas with suggested prices ====================
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || undefined
    const pagina = searchParams.get('pagina') ? parseInt(searchParams.get('pagina')!) : 1
    const limite = searchParams.get('limite') ? parseInt(searchParams.get('limite')!) : 50

    // Build where clause: only APROBADO
    const where: any = { estado: 'APROBADO' }

    if (search) {
      const term = search.trim().toLowerCase()
      where.OR = [
        { usuario: { contains: term, mode: 'insensitive' as const } },
        { numeroTropa: { equals: !isNaN(Number(term)) ? Number(term) : undefined } },
        { usuarioFaena: { nombre: { contains: term, mode: 'insensitive' as const } } },
        { usuarioFaena: { razonSocial: { contains: term, mode: 'insensitive' as const } } },
      ]
    }

    // Fetch APROBADO planillas with related data
    const [planillas, total] = await Promise.all([
      db.planillaServicioFaena.findMany({
        where,
        include: {
          tropa: {
            select: {
              id: true,
              numero: true,
              codigo: true,
              estado: true,
            },
          },
          usuarioFaena: {
            select: {
              id: true,
              nombre: true,
              razonSocial: true,
              cuit: true,
            },
          },
          itemsExtras: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: [{ numeroTropa: 'desc' }],
        skip: (pagina - 1) * limite,
        take: limite,
      }),
      db.planillaServicioFaena.count({ where }),
    ])

    // For each planilla, compute suggested price + suggested tasa/arancel
    const enriched = await Promise.all(
      planillas.map(async (p) => {
        // 1. Smart suggested precioServicioKg
        let precioSugerido: number | null = null
        let tasaSugerida: number | null = null

        // Step 1: Last precioServicioKg from same client's FACTURADO planillas
        if (p.usuarioFaenaId) {
          const lastFacturada = await db.planillaServicioFaena.findFirst({
            where: {
              usuarioFaenaId: p.usuarioFaenaId,
              estado: 'FACTURADO',
              precioServicioKg: { gt: 0 },
            },
            select: { precioServicioKg: true, tasaInspeccionVet: true },
            orderBy: { createdAt: 'desc' },
          })
          if (lastFacturada) {
            precioSugerido = lastFacturada.precioServicioKg
            if (lastFacturada.tasaInspeccionVet > 0) {
              tasaSugerida = lastFacturada.tasaInspeccionVet
            }
          }
        }

        // Step 2: PrecioServicio model for this client
        if (precioSugerido === null && p.usuarioFaenaId) {
          const precioServicio = await db.precioServicio.findFirst({
            where: {
              clienteId: p.usuarioFaenaId,
              fechaHasta: null,
            },
            select: { precio: true },
            orderBy: { fechaDesde: 'desc' },
          })
          if (precioServicio) {
            precioSugerido = precioServicio.precio
          }
        }

        // Step 3: General tarifa from PrecioServicio (latest for any client — general reference)
        if (precioSugerido === null) {
          const generalTarifa = await db.precioServicio.findFirst({
            where: {
              fechaHasta: null,
            },
            select: { precio: true },
            orderBy: { fechaDesde: 'desc' },
          })
          if (generalTarifa) {
            precioSugerido = generalTarifa.precio
          }
        }

        return {
          ...p,
          precioSugerido,
          tasaSugerida,
        }
      }),
    )

    // KPIs
    const totalAprobados = await db.planillaServicioFaena.count({ where: { estado: 'APROBADO' } })

    // Facturadas hoy
    const hoy = new Date()
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
    const finHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59, 999)
    const facturadasHoy = await db.planillaServicioFaena.count({
      where: {
        estado: 'FACTURADO',
        fechaFactura: { gte: inicioHoy, lte: finHoy },
      },
    })

    // Monto total pendiente (sum of totalFacturaImp for APROBADO, estimated with suggested prices or existing)
    const aprobadosAll = await db.planillaServicioFaena.findMany({
      where: { estado: 'APROBADO' },
      select: { kgGancho: true, cantidadAnimales: true, usuarioFaenaId: true },
    })
    let montoPendienteEstimado = 0
    for (const a of aprobadosAll) {
      // Get suggested price for this planilla
      let precio: number | null = null
      if (a.usuarioFaenaId) {
        const last = await db.planillaServicioFaena.findFirst({
          where: { usuarioFaenaId: a.usuarioFaenaId, estado: 'FACTURADO', precioServicioKg: { gt: 0 } },
          select: { precioServicioKg: true },
          orderBy: { createdAt: 'desc' },
        })
        if (last) precio = last.precioServicioKg
      }
      if (precio === null) {
        const ps = await db.precioServicio.findFirst({
          where: { fechaHasta: null },
          select: { precio: true },
          orderBy: { fechaDesde: 'desc' },
        })
        if (ps) precio = ps.precio
      }
      if (precio !== null) {
        montoPendienteEstimado += a.kgGancho * precio * 1.21
      }
    }

    return NextResponse.json({
      success: true,
      data: enriched,
      paginacion: {
        pagina,
        limite,
        total,
        totalPaginas: Math.ceil(total / limite),
      },
      kpis: {
        totalAprobados,
        facturadasHoy,
        montoPendienteEstimado: Math.round(montoPendienteEstimado),
      },
    })
  } catch (error: any) {
    console.error('Error GET planilla-servicio-faena/carga:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// ==================== PUT — Update planilla with pricing and generate factura ====================
export async function PUT(request: NextRequest) {
  try {
    const body: CargaBody = await request.json()

    const {
      id,
      precioServicioKg,
      tasaInspeccionVet,
      arancelIpcva,
      plazoPagoDias,
      numeroFactura,
      fechaFactura,
      observaciones,
      itemsExtras,
      operadorId,
    } = body

    // Validate required fields
    if (!id || !numeroFactura || !precioServicioKg) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos obligatorios: id, numeroFactura, precioServicioKg' },
        { status: 400 },
      )
    }

    // Check that the planilla exists and is APROBADO
    const planilla = await db.planillaServicioFaena.findUnique({
      where: { id },
      include: {
        tropa: { select: { id: true, numero: true, codigo: true } },
        usuarioFaena: { select: { id: true, nombre: true, razonSocial: true, cuit: true } },
        itemsExtras: true,
      },
    })

    if (!planilla) {
      return NextResponse.json(
        { success: false, error: 'Planilla no encontrada' },
        { status: 404 },
      )
    }

    if (planilla.estado !== 'APROBADO') {
      return NextResponse.json(
        { success: false, error: `La planilla no está en estado APROBADO (estado actual: ${planilla.estado})` },
        { status: 400 },
      )
    }

    // Check that numeroFactura is unique
    const existingFactura = await db.factura.findUnique({
      where: { numero: numeroFactura },
    })
    if (existingFactura) {
      return NextResponse.json(
        { success: false, error: `Ya existe una factura con el número ${numeroFactura}` },
        { status: 400 },
      )
    }

    // Calculate totals
    const kgGancho = planilla.kgGancho || 0
    const cantidadAnimales = planilla.cantidadAnimales || 0

    const totalServicioIva = kgGancho * precioServicioKg * 1.21
    const totalFacturaImp =
      totalServicioIva +
      tasaInspeccionVet * cantidadAnimales +
      arancelIpcva * cantidadAnimales

    // Extract IVA
    const subtotalServicio = kgGancho * precioServicioKg
    const iva = subtotalServicio * 0.21
    const subtotalItemsExtras = itemsExtras
      ? itemsExtras.reduce((sum, ie) => {
          const item = planilla.itemsExtras.find((e) => e.id === ie.id)
          return sum + (item ? item.cantidadKg * ie.precioUnitario : 0)
        }, 0)
      : 0

    const subtotal = subtotalServicio + subtotalItemsExtras
    const total = totalFacturaImp + subtotalItemsExtras

    // Get clienteId for the factura
    const clienteId = planilla.usuarioFaenaId

    if (!clienteId) {
      return NextResponse.json(
        { success: false, error: 'La planilla no tiene un cliente (usuarioFaena) asociado. No se puede generar la factura.' },
        { status: 400 },
      )
    }

    // Generate numeroInterno from Numerador
    const year = new Date().getFullYear()
    const numeradorName = `FACTURA_SERVICIO_FAENA_${year}`
    const numerador = await db.numerador.upsert({
      where: { nombre: numeradorName },
      update: { ultimoNumero: { increment: 1 } },
      create: { nombre: numeradorName, anio: year, ultimoNumero: 1 },
    })
    const numeroInterno = numerador.ultimoNumero

    // Use a transaction for atomicity
    const result = await db.$transaction(async (tx) => {
      // 1. Update items extras precios first
      if (itemsExtras && itemsExtras.length > 0) {
        await Promise.all(
          itemsExtras.map((ie) =>
            tx.itemExtraPlanilla.update({
              where: { id: ie.id },
              data: {
                precioUnitario: ie.precioUnitario,
                subtotal: (() => {
                  const item = planilla.itemsExtras.find((e) => e.id === ie.id)
                  return item ? item.cantidadKg * ie.precioUnitario : 0
                })(),
              },
            }),
          ),
        )
      }

      // 2. Create the Factura
      const factura = await tx.factura.create({
        data: {
          numero: numeroFactura,
          numeroInterno,
          clienteId,
          fecha: fechaFactura ? new Date(fechaFactura + 'T12:00:00') : new Date(),
          subtotal,
          iva,
          total,
          estado: 'EMITIDA',
          plazoPagoDias,
          observaciones: observaciones || null,
          operadorId: operadorId || null,
        },
      })

      // 3. Build DetalleFactura entries
      const detallesData: {
        tipoProducto: any
        descripcion: string
        cantidad: number
        unidad: string
        precioUnitario: number
        subtotal: number
        tropaCodigo?: string
      }[] = []

      // Line 1: Servicio de Faena
      detallesData.push({
        tipoProducto: 'OTRO',
        descripcion: `Servicio de Faena - Tropa ${planilla.numeroTropa}`,
        cantidad: kgGancho,
        unidad: 'KG',
        precioUnitario: precioServicioKg,
        subtotal: subtotalServicio,
        tropaCodigo: planilla.tropa?.codigo || undefined,
      })

      // Line 2: Tasa Inspección Veterinaria
      if (tasaInspeccionVet > 0) {
        detallesData.push({
          tipoProducto: 'OTRO',
          descripcion: 'Tasa Inspección Veterinaria',
          cantidad: cantidadAnimales,
          unidad: 'UN',
          precioUnitario: tasaInspeccionVet,
          subtotal: tasaInspeccionVet * cantidadAnimales,
          tropaCodigo: planilla.tropa?.codigo || undefined,
        })
      }

      // Line 3: Arancel IPCVA
      if (arancelIpcva > 0) {
        detallesData.push({
          tipoProducto: 'OTRO',
          descripcion: 'Arancel IPCVA',
          cantidad: cantidadAnimales,
          unidad: 'UN',
          precioUnitario: arancelIpcva,
          subtotal: arancelIpcva * cantidadAnimales,
          tropaCodigo: planilla.tropa?.codigo || undefined,
        })
      }

      // Lines 4+: Items Extras
      if (itemsExtras && itemsExtras.length > 0) {
        for (const ie of itemsExtras) {
          const item = planilla.itemsExtras.find((e) => e.id === ie.id)
          if (item) {
            detallesData.push({
              tipoProducto: 'OTRO',
              descripcion: item.descripcion || item.tipoItem,
              cantidad: item.cantidadKg,
              unidad: 'KG',
              precioUnitario: ie.precioUnitario,
              subtotal: item.cantidadKg * ie.precioUnitario,
              tropaCodigo: planilla.tropa?.codigo || undefined,
            })
          }
        }
      }

      // Create all DetalleFactura
      await tx.detalleFactura.createMany({
        data: detallesData.map((d) => ({
          facturaId: factura.id,
          ...d,
        })),
      })

      // 4. Update planilla
      const updatedPlanilla = await tx.planillaServicioFaena.update({
        where: { id },
        data: {
          precioServicioKg,
          totalServicioIva,
          tasaInspeccionVet,
          arancelIpcva,
          totalFacturaImp,
          estado: 'FACTURADO',
          plazoPagoDias,
          numeroFactura,
          fechaFactura: fechaFactura ? new Date(fechaFactura + 'T12:00:00') : new Date(),
          observaciones: observaciones || null,
          facturaId: factura.id,
          estadoPago: total, // Set saldo to the total amount
        },
        include: {
          tropa: { select: { id: true, numero: true, codigo: true } },
          usuarioFaena: { select: { id: true, nombre: true, razonSocial: true, cuit: true } },
          itemsExtras: true,
          factura: true,
        },
      })

      return { updatedPlanilla, factura }
    })

    return NextResponse.json({
      success: true,
      message: `Factura ${numeroFactura} generada exitosamente para Tropa N° ${planilla.numeroTropa}`,
      data: result.updatedPlanilla,
      factura: result.factura,
    })
  } catch (error: any) {
    console.error('Error PUT planilla-servicio-faena/carga:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
