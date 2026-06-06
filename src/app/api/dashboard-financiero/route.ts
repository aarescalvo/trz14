import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// Dashboard financiero - Solo para usuarios autorizados
export async function GET(request: NextRequest) {
  try {
    const authError = await checkPermission(request, 'puedeDashboardFinanciero')
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')

    // Fechas por defecto: mes actual
    const hoy = new Date()
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const desde = fechaDesde ? new Date(fechaDesde) : primerDiaMes
    const hasta = fechaHasta ? new Date(fechaHasta) : hoy

    // Obtener métricas financieras
    const [
      facturas,
      romaneos,
      pesajesCamion,
      clientesActivos,
      tropas
    ] = await Promise.all([
      // Facturas del período
      db.factura.findMany({
        where: {
          fecha: {
            gte: desde,
            lte: hasta
          },
          estado: { not: 'ANULADA' }
        },
        include: {
          cliente: {
            select: { nombre: true, condicionIva: true }
          },
          detalles: true
        }
      }),
      // Romaneos del período
      db.romaneo.findMany({
        where: {
          fecha: {
            gte: desde,
            lte: hasta
          },
          estado: { in: ['CONFIRMADO', 'PENDIENTE'] }
        }
      }),
      // Pesajes de camión del período
      db.pesajeCamion.findMany({
        where: {
          fecha: {
            gte: desde,
            lte: hasta
          },
          estado: 'CERRADO'
        }
      }),
      // Clientes activos
      db.cliente.count({
        where: { activo: true }
      }),
      // Tropas procesadas
      db.tropa.findMany({
        where: {
          fechaRecepcion: {
            gte: desde,
            lte: hasta
          }
        },
        include: {
          tiposAnimales: true
        }
      })
    ])

    // Calcular métricas
    const totalFacturado = facturas.reduce((sum, f) => sum + (f.total || 0), 0)
    const totalPendiente = facturas
      .filter(f => f.estado === 'PENDIENTE' || f.estado === 'EMITIDA')
      .reduce((sum, f) => sum + (f.total || 0), 0)
    const totalCobrado = facturas
      .filter(f => f.estado === 'PAGADA')
      .reduce((sum, f) => sum + (f.total || 0), 0)

    // Animales faenados
    const totalAnimalesFaenados = romaneos.length
    const pesoTotalFaena = romaneos.reduce((sum, r) => sum + (r.pesoTotal || 0), 0)
    const pesoVivoTotal = romaneos.reduce((sum, r) => sum + (r.pesoVivo || 0), 0)
    
    // Rinde promedio
    const rindePromedio = pesoVivoTotal > 0 
      ? (pesoTotalFaena / pesoVivoTotal) * 100 
      : 0

    // Pesaje de camiones
    const totalPesajeCamiones = pesajesCamion.reduce((sum, p) => sum + (p.pesoNeto || 0), 0)

    // Facturación por cliente (top 10)
    const facturacionPorCliente = new Map<string, { nombre: string; total: number; cantidad: number }>()
    facturas.forEach(f => {
      const nombre = f.cliente?.nombre || 'Sin cliente'
      const existing = facturacionPorCliente.get(nombre) || { nombre, total: 0, cantidad: 0 }
      existing.total += f.total || 0
      existing.cantidad += 1
      facturacionPorCliente.set(nombre, existing)
    })
    const topClientes = Array.from(facturacionPorCliente.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)

    // Facturación por día (últimos 30 días)
    const facturacionPorDia = new Map<string, { fecha: string; total: number; cantidad: number }>()
    facturas.forEach(f => {
      const fecha = f.fecha.toISOString().split('T')[0]
      const existing = facturacionPorDia.get(fecha) || { fecha, total: 0, cantidad: 0 }
      existing.total += f.total || 0
      existing.cantidad += 1
      facturacionPorDia.set(fecha, existing)
    })
    const facturacionDiaria = Array.from(facturacionPorDia.values())
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(-30)

    // Tropas procesadas
    const totalCabezas = tropas.reduce((sum, t) => sum + t.cantidadCabezas, 0)

    // Resumen por tipo de factura
    const facturasPorTipo = {
      pendientes: facturas.filter(f => f.estado === 'PENDIENTE').length,
      emitidas: facturas.filter(f => f.estado === 'EMITIDA').length,
      pagadas: facturas.filter(f => f.estado === 'PAGADA').length,
      anuladas: facturas.filter(f => f.estado === 'ANULADA').length
    }

    // Calcular promedios
    const ticketPromedio = facturas.length > 0 ? totalFacturado / facturas.length : 0
    const pesoPromedioAnimal = totalAnimalesFaenados > 0 ? pesoTotalFaena / totalAnimalesFaenados : 0

    return NextResponse.json({
      success: true,
      data: {
        periodo: {
          desde: desde.toISOString().split('T')[0],
          hasta: hasta.toISOString().split('T')[0]
        },
        resumen: {
          totalFacturado,
          totalPendiente,
          totalCobrado,
          clientesActivos,
          ticketPromedio
        },
        faena: {
          totalAnimalesFaenados,
          pesoTotalFaena,
          pesoVivoTotal,
          rindePromedio,
          pesoPromedioAnimal,
          totalCabezasRecibidas: totalCabezas
        },
        pesaje: {
          totalPesajeCamiones,
          cantidadPesajes: pesajesCamion.length
        },
        facturacion: {
          porCliente: topClientes,
          porDia: facturacionDiaria,
          porEstado: facturasPorTipo,
          totalFacturas: facturas.length
        },
        indicadores: {
          porcentajeCobrado: totalFacturado > 0 ? (totalCobrado / totalFacturado) * 100 : 0,
          porcentajePendiente: totalFacturado > 0 ? (totalPendiente / totalFacturado) * 100 : 0
        }
      }
    })

  } catch (error) {
    console.error('Error en dashboard financiero:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Error al obtener datos del dashboard' 
    }, { status: 500 })
  }
}
