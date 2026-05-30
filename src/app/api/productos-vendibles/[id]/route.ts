import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// GET - Obtener un producto vendible por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await checkPermission(request, 'puedeStock')
  if (authError) return authError
  try {
    const { id } = await params

    const producto = await db.productoVendible.findUnique({
      where: { id },
      include: {
        preciosHistorico: {
          orderBy: { fechaVigencia: 'desc' },
          take: 10
        },
        preciosCliente: {
          include: {
            cliente: true
          }
        },
        _count: {
          select: {
            preciosCliente: true,
            preciosHistorico: true
          }
        }
      }
    })

    if (!producto) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    // Obtener último precio
    const ultimoPrecio = await db.historicoPrecioProducto.findFirst({
      where: { productoVendibleId: id },
      orderBy: { fechaVigencia: 'desc' }
    })

    return NextResponse.json({
      success: true,
      data: {
        ...producto,
        precioActual: ultimoPrecio?.precioNuevo || producto.precioBase || producto.precioArs || 0
      }
    })
  } catch (error) {
    console.error('Error obteniendo producto vendible:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener producto: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}

// PUT - Actualizar producto vendible
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await checkPermission(request, 'puedeStock')
  if (authError) return authError
  try {
    const { id } = await params
    const body = await request.json()

    // Verificar que el producto existe
    const existente = await db.productoVendible.findUnique({
      where: { id }
    })

    if (!existente) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    // Si se cambia el código, verificar que no exista otro con ese código
    if (body.codigo && body.codigo !== existente.codigo) {
      const conEseCodigo = await db.productoVendible.findUnique({
        where: { codigo: body.codigo }
      })
      if (conEseCodigo) {
        return NextResponse.json(
          { success: false, error: 'Ya existe un producto con ese código' },
          { status: 400 }
        )
      }
    }

    // Preparar datos de actualización
    const updateData: Record<string, unknown> = {
      updatedAt: new Date()
    }

    // Campos básicos
    const camposSimples = [
      'codigo', 'nombre', 'descripcion', 'subcategoria', 'especie', 'tipo',
      'delCuarto', 'tipificacion', 'unidadMedida', 'categoria', 'tipoVenta',
      'descripcionCircular', 'moneda', 'producidoParaCliente', 'tipoTrabajo',
      'idiomaEtiqueta', 'formatoEtiqueta', 'textoEtiqueta', 'textoEspanol',
      'textoIngles', 'textoTercerIdioma', 'textoRubroPieza', 'textoTipoTrabajoLabel',
      'temperaturaTransporte', 'tipoConsumo',
      'empresa', 'tipoTrabajoId', 'tipoCarne', 'numeroRegistroSenasa'
    ]

    camposSimples.forEach(campo => {
      if (body[campo] !== undefined) {
        updateData[campo] = body[campo]
      }
    })

    // Campos numéricos
    const camposNumericos = [
      'tara', 'vencimientoDias', 'cantidadEtiquetas', 'precioBase',
      'precioDolar', 'precioEuro', 'precioArs', 'alicuotaIva'
    ]

    camposNumericos.forEach(campo => {
      if (body[campo] !== undefined) {
        updateData[campo] = body[campo] ? parseFloat(body[campo]) : 0
      }
    })

    // Campos booleanos
    const camposBooleanos = [
      'tieneTipificacion', 'productoGeneral', 'productoReporteRinde',
      'activo', 'requiereTrazabilidad', 'esVendible'
    ]

    camposBooleanos.forEach(campo => {
      if (body[campo] !== undefined) {
        updateData[campo] = Boolean(body[campo])
      }
    })

    // Actualizar precioActual si se actualiza precioArs
    if (body.precioArs !== undefined) {
      updateData.precioActual = parseFloat(body.precioArs) || 0
    } else if (body.precioBase !== undefined) {
      updateData.precioActual = parseFloat(body.precioBase) || 0
    }

    const producto = await db.productoVendible.update({
      where: { id },
      data: updateData
    })

    // Si cambió el precio, crear registro en historico
    const nuevoPrecio = body.precioArs || body.precioBase
    if (nuevoPrecio && parseFloat(nuevoPrecio) !== existente.precioArs) {
      await db.historicoPrecioProducto.create({
        data: {
          productoVendibleId: id,
          precioAnterior: existente.precioArs || existente.precioBase,
          precioNuevo: parseFloat(nuevoPrecio),
          moneda: body.moneda || 'ARS',
          motivo: body.motivoCambioPrecio || 'Actualización de precio',
          operadorId: body.operadorId || null
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: producto,
      message: `Producto ${producto.nombre} actualizado`
    })
  } catch (error) {
    console.error('Error actualizando producto vendible:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar producto: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}

// DELETE - Desactivar producto vendible
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await checkPermission(request, 'puedeStock')
  if (authError) return authError
  try {
    const { id } = await params

    // Verificar que el producto existe
    const existente = await db.productoVendible.findUnique({
      where: { id }
    })

    if (!existente) {
      return NextResponse.json(
        { success: false, error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    // En lugar de eliminar, desactivamos
    await db.productoVendible.update({
      where: { id },
      data: { activo: false }
    })

    return NextResponse.json({
      success: true,
      message: `Producto ${existente.nombre} desactivado`
    })
  } catch (error) {
    console.error('Error desactivando producto vendible:', error)
    return NextResponse.json(
      { success: false, error: 'Error al desactivar producto: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}
