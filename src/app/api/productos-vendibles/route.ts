import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { checkPermission } from '@/lib/auth-helpers'

// GET - Listar productos vendibles
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeStock')
  if (authError) return authError
  try {
    const { searchParams } = new URL(request.url)
    const categoria = searchParams.get('categoria')
    const activo = searchParams.get('activo')
    const search = searchParams.get('search')
    const productoGeneral = searchParams.get('productoGeneral')
    const productoReporteRinde = searchParams.get('productoReporteRinde')

    const where: Prisma.ProductoVendibleWhereInput = {}

    if (categoria) {
      where.categoria = categoria
    }

    if (activo !== null && activo !== undefined) {
      where.activo = activo === 'true'
    }

    if (productoGeneral !== null && productoGeneral !== undefined) {
      where.productoGeneral = productoGeneral === 'true'
    }

    if (productoReporteRinde !== null && productoReporteRinde !== undefined) {
      where.productoReporteRinde = productoReporteRinde === 'true'
    }

    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: 'insensitive' } },
        { nombre: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: search, mode: 'insensitive' } },
        { numeroRegistroSenasa: { contains: search, mode: 'insensitive' } }
      ]
    }

    const productos = await db.productoVendible.findMany({
      where,
      include: {
        _count: {
          select: {
            preciosCliente: true,
            preciosHistorico: true
          }
        }
      },
      orderBy: [
        { categoria: 'asc' },
        { nombre: 'asc' }
      ]
    })

    // Obtener último precio de cada producto
    const productosConPrecio = await Promise.all(
      productos.map(async (producto) => {
        const ultimoPrecio = await db.historicoPrecioProducto.findFirst({
          where: { productoVendibleId: producto.id },
          orderBy: { fechaVigencia: 'desc' }
        })

        return {
          ...producto,
          precioActual: ultimoPrecio?.precioNuevo || producto.precioBase || producto.precioArs || 0,
          ultimoCambioPrecio: ultimoPrecio?.createdAt || null
        }
      })
    )

    return NextResponse.json({
      success: true,
      data: productosConPrecio
    })
  } catch (error) {
    console.error('Error fetching productos vendibles:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener productos vendibles: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}

// POST - Crear producto vendible
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeStock')
  if (authError) return authError
  try {
    const body = await request.json()
    const {
      codigo,
      nombre,
      descripcion,
      // Datos básicos
      tara,
      vencimientoDias,
      numeroRegistroSenasa,
      // Unidades y etiquetas
      unidadMedida,
      cantidadEtiquetas,
      // Tipificación
      tieneTipificacion,
      tipificacion,
      // Clasificación
      categoria,
      subcategoria,
      especie,
      tipo,
      delCuarto,
      // Tipo de venta
      tipoVenta,
      // Descripciones
      descripcionCircular,
      // Precios
      precioBase,
      precioDolar,
      precioEuro,
      precioArs,
      moneda,
      alicuotaIva,
      // Cliente y reportes
      producidoParaCliente,
      productoGeneral,
      productoReporteRinde,
      // Trabajo y etiquetado
      tipoTrabajo,
      idiomaEtiqueta,
      formatoEtiqueta,
      textoEtiqueta,
      // Textos multiidioma
      textoEspanol,
      textoIngles,
      textoTercerIdioma,
      textoRubroPieza,
      textoTipoTrabajoLabel,
      // Logística
      temperaturaTransporte,
      tipoConsumo,
      empresa,
      // Tipos adicionales
      tipoTrabajoId,
      tipoCarne,
      // Control
      activo,
      requiereTrazabilidad,
      esVendible
    } = body

    // Verificar que el código no exista
    const existente = await db.productoVendible.findUnique({
      where: { codigo }
    })

    if (existente) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un producto con ese código' },
        { status: 400 }
      )
    }

    const producto = await db.productoVendible.create({
      data: {
        codigo,
        nombre,
        descripcion: descripcion || null,
        // Datos básicos
        tara: tara ? parseFloat(tara) : 0,
        vencimientoDias: vencimientoDias ? parseInt(vencimientoDias) : 0,
        numeroRegistroSenasa: numeroRegistroSenasa || null,
        // Unidades y etiquetas
        unidadMedida: unidadMedida || 'KG',
        cantidadEtiquetas: cantidadEtiquetas ? parseInt(cantidadEtiquetas) : 1,
        // Tipificación
        tieneTipificacion: tieneTipificacion || false,
        tipificacion: tipificacion || null,
        // Clasificación
        categoria,
        subcategoria: subcategoria || null,
        especie: especie || null,
        tipo: tipo || null,
        delCuarto: delCuarto || null,
        // Tipo de venta
        tipoVenta: tipoVenta || 'POR_KG',
        // Descripciones
        descripcionCircular: descripcionCircular || null,
        // Precios
        precioBase: precioBase ? parseFloat(precioBase) : null,
        precioDolar: precioDolar ? parseFloat(precioDolar) : 0,
        precioEuro: precioEuro ? parseFloat(precioEuro) : 0,
        precioArs: precioArs ? parseFloat(precioArs) : 0,
        moneda: moneda || 'ARS',
        alicuotaIva: alicuotaIva ? parseFloat(alicuotaIva) : 21,
        // Cliente y reportes
        producidoParaCliente: producidoParaCliente || null,
        productoGeneral: productoGeneral || false,
        productoReporteRinde: productoReporteRinde || false,
        // Trabajo y etiquetado
        tipoTrabajo: tipoTrabajo || null,
        idiomaEtiqueta: idiomaEtiqueta || 'ES',
        formatoEtiqueta: formatoEtiqueta || null,
        textoEtiqueta: textoEtiqueta || null,
        // Textos multiidioma
        textoEspanol: textoEspanol || null,
        textoIngles: textoIngles || null,
        textoTercerIdioma: textoTercerIdioma || null,
        textoRubroPieza: textoRubroPieza || null,
        textoTipoTrabajoLabel: textoTipoTrabajoLabel || null,
        // Logística
        temperaturaTransporte: temperaturaTransporte || null,
        tipoConsumo: tipoConsumo || null,
        empresa: empresa || null,
        // Tipos adicionales
        tipoTrabajoId: tipoTrabajoId || null,
        tipoCarne: tipoCarne || null,
        // Control
        activo: activo !== undefined ? activo : true,
        requiereTrazabilidad: requiereTrazabilidad || false,
        esVendible: esVendible !== undefined ? esVendible : true,
        precioActual: precioArs ? parseFloat(precioArs) : (precioBase ? parseFloat(precioBase) : 0)
      }
    })

    // Si hay precio base, crear registro en historico
    const precioInicial = precioArs || precioBase
    if (precioInicial && parseFloat(precioInicial) > 0) {
      await db.historicoPrecioProducto.create({
        data: {
          productoVendibleId: producto.id,
          precioNuevo: parseFloat(precioInicial),
          moneda: moneda || 'ARS',
          motivo: 'Precio inicial'
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: producto,
      message: `Producto ${nombre} creado exitosamente`
    })
  } catch (error) {
    console.error('Error creating producto vendible:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear producto vendible: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}
