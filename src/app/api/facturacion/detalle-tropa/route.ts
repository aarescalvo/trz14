import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const MESES_NOMBRES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
]

// Calcula el mes en español desde una fecha
function calcularMesDesdeFecha(fecha: string | null | undefined): string | null {
  if (!fecha) return null
  const d = new Date(fecha)
  if (isNaN(d.getTime())) return null
  return MESES_NOMBRES[d.getMonth()] || null
}

// GET — Listar detalles con filtros
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filtroDesde = searchParams.get('desde') || ''
    const filtroHasta = searchParams.get('hasta') || ''
    const filtroUsuario = searchParams.get('usuario') || ''
    const filtroPeriodo = searchParams.get('periodo') || '' // SEMANAL, MENSUAL, ANUAL
    const filtroMes = searchParams.get('mes') || ''
    const filtroAnio = searchParams.get('anio') || ''
    const filtroTropa = searchParams.get('tropa') || ''
    const conSubproductos = searchParams.get('subproductos') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '500')

    // Build where clause
    const where: any = {}

    // Filtro por tropa individual
    if (filtroTropa) {
      where.numeroTropa = parseInt(filtroTropa)
    }

    // Filtro por usuario
    if (filtroUsuario) {
      where.usuario = { contains: filtroUsuario, mode: 'insensitive' }
    }

    // Filtro por mes
    if (filtroMes) {
      where.mes = filtroMes.toUpperCase()
    }

    // Filtros por fecha (usamos fechaFaena de la tropa relacionada)
    if (filtroDesde || filtroHasta) {
      where.tropa = {}
      if (filtroDesde) {
        where.tropa.fechaFaena = { ...where.tropa.fechaFaena, gte: new Date(filtroDesde) }
      }
      if (filtroHasta) {
        where.tropa.fechaFaena = { ...where.tropa.fechaFaena, lte: new Date(filtroHasta + 'T23:59:59') }
      }
    }

    // Filtro por periodo
    if (filtroPeriodo === 'SEMANAL') {
      // Última semana
      const now = new Date()
      const semanaAtras = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      where.tropa = { ...where.tropa, fechaFaena: { ...where.tropa?.fechaFaena, gte: semanaAtras } }
    } else if (filtroPeriodo === 'MENSUAL') {
      // Mes actual
      const now = new Date()
      const primerDiaMes = new Date(now.getFullYear(), now.getMonth(), 1)
      where.tropa = { ...where.tropa, fechaFaena: { ...where.tropa?.fechaFaena, gte: primerDiaMes } }
    } else if (filtroPeriodo === 'ANUAL') {
      // Año actual
      const now = new Date()
      const primerDiaAnio = new Date(now.getFullYear(), 0, 1)
      where.tropa = { ...where.tropa, fechaFaena: { ...where.tropa?.fechaFaena, gte: primerDiaAnio } }
    } else if (filtroAnio) {
      // Año específico
      const primerDiaAnio = new Date(parseInt(filtroAnio), 0, 1)
      const ultimoDiaAnio = new Date(parseInt(filtroAnio), 11, 31)
      where.tropa = { ...where.tropa, fechaFaena: { gte: primerDiaAnio, lte: ultimoDiaAnio } }
    }

    // Fetch
    const [detalles, total] = await Promise.all([
      prisma.detalleTropaFaena.findMany({
        where,
        include: {
          tropa: {
            select: {
              id: true,
              codigo: true,
              fechaFaena: true,
              cantidadCabezas: true,
              estado: true,
              usuarioFaena: {
                select: { id: true, nombre: true, cuit: true }
              },
              planillasServicioFaena: {
                select: { fechaFaena: true },
                take: 1,
                orderBy: { fechaFaena: 'desc' }
              }
            }
          }
        },
        orderBy: { numeroTropa: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.detalleTropaFaena.count({ where })
    ])

    // Calcular total operación + mes desde fechaFaena para cada registro
    // Prioridad: 1) PlanillaServicioFaena.fechaFaena, 2) Tropa.fechaFaena, 3) campo manual
    const detallesConTotal = detalles.map(d => {
      const planillaFecha = d.tropa?.planillasServicioFaena?.[0]?.fechaFaena
      const tropaFecha = d.tropa?.fechaFaena
      const mesCalculado = calcularMesDesdeFecha(planillaFecha?.toISOString()) ||
                            calcularMesDesdeFecha(tropaFecha?.toISOString())
      return {
        ...d,
        mes: mesCalculado || d.mes,
        totalOperacion: d.valorServicioFaena + d.servicioDespostada + d.factCompraMenudencia +
          d.factVentaMenudencia + d.ventaChinchulin + d.montoHueso + d.montoDesperdicio +
          d.montoGrasa + d.montoCuero + d.montoGrasaDressing,
      }
    })

    // Resumen
    const resumen = {
      totalRegistros: total,
      totalKgGancho: detalles.reduce((s, d) => s + d.kgGancho, 0),
      totalValorServicio: detalles.reduce((s, d) => s + d.valorServicioFaena, 0),
      totalDespostada: detalles.reduce((s, d) => s + d.servicioDespostada, 0),
      totalSubproductos: detalles.reduce((s, d) => s + d.montoHueso + d.montoDesperdicio + d.montoGrasa + d.montoCuero + d.montoGrasaDressing + d.ventaChinchulin, 0),
      totalOperacion: detallesConTotal.reduce((s, d) => s + (d as any).totalOperacion, 0),
      totalAnimales: detalles.reduce((s, d) => s + d.cantidadAnimales, 0),
    }

    // Agrupación por usuario
    const porUsuario = await prisma.detalleTropaFaena.groupBy({
      by: ['usuario'],
      where: where,
      _sum: {
        kgGancho: true,
        valorServicioFaena: true,
        servicioDespostada: true,
        montoHueso: true,
        montoDesperdicio: true,
        montoGrasa: true,
        montoCuero: true,
        montoGrasaDressing: true,
        ventaChinchulin: true,
        cantidadAnimales: true,
      },
      _count: { numeroTropa: true },
      orderBy: { _count: { numeroTropa: 'desc' } }
    })

    // Agrupación subproductos
    const subproductosResumen = {
      hueso: detalles.reduce((s, d) => s + d.montoHueso, 0),
      desperdicio: detalles.reduce((s, d) => s + d.montoDesperdicio, 0),
      grasa: detalles.reduce((s, d) => s + d.montoGrasa, 0),
      cuero: detalles.reduce((s, d) => s + d.montoCuero, 0),
      grasaDressing: detalles.reduce((s, d) => s + d.montoGrasaDressing, 0),
      chinchulin: detalles.reduce((s, d) => s + d.ventaChinchulin, 0),
      menudenciaCompra: detalles.reduce((s, d) => s + d.factCompraMenudencia, 0),
      menudenciaVenta: detalles.reduce((s, d) => s + d.factVentaMenudencia, 0),
    }

    // Precio tiers
    const precioTiers = await prisma.detalleTropaFaena.groupBy({
      by: ['precioServicio'],
      _count: { numeroTropa: true },
      orderBy: { precioServicio: 'asc' }
    })

    return NextResponse.json({
      success: true,
      data: detallesConTotal,
      resumen,
      porUsuario,
      subproductos: subproductosResumen,
      precioTiers,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    })
  } catch (error: any) {
    console.error('Error detalle-tropa GET:', error)
    return NextResponse.json({ success: false, error: error.message || 'Error al obtener detalles' }, { status: 500 })
  }
}

// POST — Crear registro de detalle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tropaId, numeroTropa, mes, usuario, cantidadAnimales, precioServicio, kgGancho,
      valorServicioFaena, servicioDespostada, factCompraMenudencia, factVentaMenudencia,
      ventaChinchulin, montoHueso, montoDesperdicio, montoGrasa, montoCuero, montoGrasaDressing } = body

    // Verify tropa exists (include planilla para obtener fechaFaena)
    const tropa = await prisma.tropa.findUnique({
      where: { id: tropaId },
      include: {
        planillasServicioFaena: {
          select: { fechaFaena: true },
          take: 1,
          orderBy: { fechaFaena: 'desc' }
        }
      }
    })
    if (!tropa) {
      return NextResponse.json({ success: false, error: 'Tropa no encontrada' }, { status: 404 })
    }

    // Check if detalle already exists for this tropa
    const existente = await prisma.detalleTropaFaena.findUnique({ where: { tropaId } })
    if (existente) {
      return NextResponse.json({ success: false, error: 'Ya existe un detalle para esta tropa' }, { status: 400 })
    }

    // Auto-calcular mes desde fechaFaena (prioridad: planilla > tropa > manual)
    const planillaFecha = tropa.planillasServicioFaena?.[0]?.fechaFaena
    const tropaFecha = tropa.fechaFaena
    const mesFinal = mes ||
      calcularMesDesdeFecha(planillaFecha?.toISOString()) ||
      calcularMesDesdeFecha(tropaFecha?.toISOString()) ||
      null

    const detalle = await prisma.detalleTropaFaena.create({
      data: {
        tropaId, numeroTropa, mes: mesFinal, usuario, cantidadAnimales, precioServicio,
        kgGancho, valorServicioFaena, servicioDespostada: servicioDespostada || 0,
        factCompraMenudencia: factCompraMenudencia || 0, factVentaMenudencia: factVentaMenudencia || 0,
        ventaChinchulin: ventaChinchulin || 0, montoHueso: montoHueso || 0,
        montoDesperdicio: montoDesperdicio || 0, montoGrasa: montoGrasa || 0,
        montoCuero: montoCuero || 0, montoGrasaDressing: montoGrasaDressing || 0,
      },
      include: { tropa: { select: { codigo: true, fechaFaena: true } } }
    })

    return NextResponse.json({ success: true, data: detalle })
  } catch (error: any) {
    console.error('Error detalle-tropa POST:', error)
    return NextResponse.json({ success: false, error: error.message || 'Error al crear detalle' }, { status: 500 })
  }
}

// PUT — Actualizar registro de detalle
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...data } = body

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })
    }

    // Auto-calcular mes desde fechaFaena al actualizar
    // Prioridad: planilla > tropa > mantener actual
    const detalleActual = await prisma.detalleTropaFaena.findUnique({
      where: { id },
      include: {
        tropa: {
          select: {
            fechaFaena: true,
            planillasServicioFaena: {
              select: { fechaFaena: true },
              take: 1,
              orderBy: { fechaFaena: 'desc' }
            }
          }
        }
      }
    })
    if (detalleActual?.tropa) {
      const planillaFecha = detalleActual.tropa.planillasServicioFaena?.[0]?.fechaFaena
      const tropaFecha = detalleActual.tropa.fechaFaena
      const mesCalculado = calcularMesDesdeFecha(planillaFecha?.toISOString()) ||
                            calcularMesDesdeFecha(tropaFecha?.toISOString())
      if (mesCalculado) {
        data.mes = mesCalculado
      }
    }

    const detalle = await prisma.detalleTropaFaena.update({
      where: { id },
      data,
      include: { tropa: { select: { codigo: true, fechaFaena: true } } }
    })

    return NextResponse.json({ success: true, data: detalle })
  } catch (error: any) {
    console.error('Error detalle-tropa PUT:', error)
    return NextResponse.json({ success: false, error: error.message || 'Error al actualizar detalle' }, { status: 500 })
  }
}

// DELETE — Eliminar registro
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 })
    }

    await prisma.detalleTropaFaena.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'Detalle eliminado' })
  } catch (error: any) {
    console.error('Error detalle-tropa DELETE:', error)
    return NextResponse.json({ success: false, error: error.message || 'Error al eliminar detalle' }, { status: 500 })
  }
}
