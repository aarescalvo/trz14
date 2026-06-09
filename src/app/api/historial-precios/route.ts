import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// GET - Obtener historial de precios
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeStock')
  if (authError) return authError
  try {
    const { searchParams } = new URL(request.url)
    const productoId = searchParams.get('productoId')
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')
    const limite = parseInt(searchParams.get('limite') || '100')

    const where: Record<string, unknown> = {}

    if (productoId) {
      where.productoVendibleId = productoId
    }

    if (fechaDesde || fechaHasta) {
      where.fechaVigencia = {}
      if (fechaDesde) {
        where.fechaVigencia = { ...where.fechaVigencia as object, gte: new Date(fechaDesde) }
      }
      if (fechaHasta) {
        where.fechaVigencia = { ...where.fechaVigencia as object, lte: new Date(fechaHasta) }
      }
    }

    // Obtener historial
    const historial = await db.historicoPrecioProducto.findMany({
      where,
      include: {
        productoVendible: {
          select: {
            id: true,
            codigo: true,
            nombre: true,
            categoria: true,
            unidadMedida: true
          }
        }
      },
      orderBy: {
        fechaVigencia: 'desc'
      },
      take: limite
    })

    // Obtener productos con sus precios actuales
    const productos = await db.productoVendible.findMany({
      where: { activo: true },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        categoria: true,
        unidadMedida: true,
        precioActual: true,
        moneda: true,
        _count: {
          select: { preciosHistorico: true }
        }
      },
      orderBy: { nombre: 'asc' }
    })

    // Calcular estadísticas de cambios
    const productosConEstadisticas = await Promise.all(
      productos.map(async (producto) => {
        const precios = await db.historicoPrecioProducto.findMany({
          where: { productoVendibleId: producto.id },
          orderBy: { fechaVigencia: 'desc' },
          take: 2
        })

        const precioActual = precios[0]?.precioNuevo || producto.precioActual || 0
        const precioAnterior = precios[1]?.precioNuevo || precios[0]?.precioAnterior || 0
        
        let variacion = 0
        let variacionPorcentaje = 0
        if (precioAnterior > 0) {
          variacion = precioActual - precioAnterior
          variacionPorcentaje = ((precioActual - precioAnterior) / precioAnterior) * 100
        }

        return {
          ...producto,
          precioActual,
          precioAnterior,
          variacion,
          variacionPorcentaje: variacionPorcentaje.toFixed(2),
          totalCambios: producto._count.preciosHistorico
        }
      })
    )

    // Resumen general
    const totalProductos = productos.length
    const productosConCambios = productosConEstadisticas.filter(p => p.totalCambios > 0).length
    const productosSinCambios = totalProductos - productosConCambios

    // Calcular variación promedio
    const variacionPromedio = productosConEstadisticas
      .filter(p => p.variacionPorcentaje !== '0.00')
      .reduce((acc, p) => acc + parseFloat(p.variacionPorcentaje), 0) / 
      (productosConEstadisticas.filter(p => p.variacionPorcentaje !== '0.00').length || 1)

    return NextResponse.json({
      success: true,
      data: historial,
      productos: productosConEstadisticas,
      resumen: {
        totalProductos,
        productosConCambios,
        productosSinCambios,
        variacionPromedio: variacionPromedio.toFixed(2)
      }
    })
  } catch (error) {
    console.error('Error al obtener historial de precios:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener historial de precios' },
      { status: 500 }
    )
  }
}

// POST - Registrar nuevo precio (actualiza historial)
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeStock')
  if (authError) return authError
  try {
    const body = await request.json()
    const { productoVendibleId, precioNuevo, motivo, operadorId } = body

    if (!productoVendibleId || precioNuevo === undefined) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos: productoVendibleId, precioNuevo' },
        { status: 400 }
      )
    }

    // Obtener precio actual
    const ultimoPrecio = await db.historicoPrecioProducto.findFirst({
      where: { productoVendibleId },
      orderBy: { fechaVigencia: 'desc' }
    })

    const precioAnterior = ultimoPrecio?.precioNuevo || 0

    // Cerrar el período del precio anterior
    if (ultimoPrecio && !ultimoPrecio.fechaVigencia) {
      await db.historicoPrecioProducto.update({
        where: { id: ultimoPrecio.id },
        data: { fechaVigencia: new Date() }
      })
    }

    // Crear nuevo registro de precio
    const nuevoPrecio = await db.historicoPrecioProducto.create({
      data: {
        productoVendibleId,
        precioAnterior,
        precioNuevo: parseFloat(precioNuevo),
        moneda: 'ARS',
        motivo: motivo || 'Actualización de precio',
        operadorId
      }
    })

    // Actualizar precio actual en el producto
    await db.productoVendible.update({
      where: { id: productoVendibleId },
      data: { precioActual: parseFloat(precioNuevo) }
    })

    return NextResponse.json({
      success: true,
      data: nuevoPrecio,
      message: `Precio actualizado de $${precioAnterior} a $${precioNuevo}`
    })
  } catch (error) {
    console.error('Error al registrar precio:', error)
    return NextResponse.json(
      { success: false, error: 'Error al registrar nuevo precio' },
      { status: 500 }
    )
  }
}
