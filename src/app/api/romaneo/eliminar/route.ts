import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'
import { createLogger } from '@/lib/logger'
const log = createLogger('app.api.romaneo.eliminar.route')

// DELETE - Eliminar última media pesada
export async function DELETE(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeRomaneo')
  if (authError) return authError
  try {
    const body = await request.json()
    const { garron, lado, fecha } = body

    log.info('=== INICIO ELIMINACIÓN ===')
    log.info('Datos recibidos:', { garron, lado, fecha } as Record<string, unknown>)

    if (!garron || !lado) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos requeridos: garron, lado' },
        { status: 400 }
      )
    }

    // Validar lado
    if (lado !== 'IZQUIERDA' && lado !== 'DERECHA') {
      return NextResponse.json(
        { success: false, error: 'Lado debe ser IZQUIERDA o DERECHA' },
        { status: 400 }
      )
    }

    const result = await db.$transaction(async (tx) => {
      // Buscar el romaneo del garrón
      const romaneo = await tx.romaneo.findFirst({
        where: { garron: parseInt(garron) },
        include: { mediasRes: true }
      })

      if (!romaneo) {
        throw new Error('ROMANEO_NO_ENCONTRADO')
      }

      // Buscar la media a eliminar
      const media = await tx.mediaRes.findFirst({
        where: {
          romaneoId: romaneo.id,
          lado: lado as 'IZQUIERDA' | 'DERECHA'
        }
      })

      if (!media) {
        throw new Error('MEDIA_NO_ENCONTRADA')
      }

      // Buscar asignación del garrón para la fecha indicada (o hoy)
      const fechaRef = fecha ? new Date(fecha) : new Date()
      fechaRef.setHours(0, 0, 0, 0)

      const asignacion = await tx.asignacionGarron.findFirst({
        where: {
          garron: parseInt(garron),
          horaIngreso: {
            gte: fechaRef,
            lt: new Date(fechaRef.getTime() + 24 * 60 * 60 * 1000)
          }
        }
      })

      // Eliminar movimiento de cámara relacionado
      await tx.movimientoCamara.deleteMany({
        where: { mediaResId: media.id }
      })

      // Actualizar stock de la cámara
      if (media.camaraId && romaneo.tropaCodigo) {
        const stock = await tx.stockMediaRes.findFirst({
          where: {
            camaraId: media.camaraId,
            tropaCodigo: romaneo.tropaCodigo,
            especie: 'BOVINO'
          }
        })

        if (stock) {
          if (stock.cantidad > 1) {
            await tx.stockMediaRes.update({
              where: { id: stock.id },
              data: {
                cantidad: { decrement: 1 },
                pesoTotal: { decrement: media.peso }
              }
            })
          } else {
            // Si es el último, eliminar el stock
            await tx.stockMediaRes.delete({
              where: { id: stock.id }
            })
          }
        }
      }

      // Eliminar la media
      await tx.mediaRes.delete({
        where: { id: media.id }
      })

      // Actualizar asignación del garrón
      if (asignacion) {
        if (lado === 'DERECHA') {
          await tx.asignacionGarron.update({
            where: { id: asignacion.id },
            data: { 
              tieneMediaDer: false,
              completado: false
            }
          })
        } else {
          await tx.asignacionGarron.update({
            where: { id: asignacion.id },
            data: { 
              tieneMediaIzq: false,
              completado: false
            }
          })
        }
      }

      // Verificar si el romaneo quedó sin medias
      const mediasRestantes = await tx.mediaRes.findMany({
        where: { romaneoId: romaneo.id }
      })

      if (mediasRestantes.length === 0) {
        // Si no quedan medias, eliminar el romaneo
        await tx.romaneo.delete({
          where: { id: romaneo.id }
        })
      } else {
        // Actualizar estado del romaneo
        await tx.romaneo.update({
          where: { id: romaneo.id },
          data: {
            estado: 'PENDIENTE',
            // Resetear pesos si corresponde
            ...(lado === 'IZQUIERDA' ? { pesoMediaIzq: null } : { pesoMediaDer: null }),
            pesoTotal: mediasRestantes.reduce((acc, m) => acc + m.peso, 0),
            rinde: null
          }
        })
      }

      return { media, romaneo, asignacion }
    })

    log.info('=== FIN ELIMINACIÓN EXITOSA ===')

    return NextResponse.json({
      success: true,
      data: {
        garron,
        lado,
        mediaId: result.media.id
      }
    })

  } catch (error: unknown) {
    console.error('=== ERROR EN ELIMINACIÓN ===')
    console.error('Error:', error)

    if (error instanceof Error) {
      if (error.message === 'ROMANEO_NO_ENCONTRADO') {
        return NextResponse.json(
          { success: false, error: 'No se encontró el romaneo para este garrón' },
          { status: 404 }
        )
      }
      if (error.message === 'MEDIA_NO_ENCONTRADA') {
        return NextResponse.json(
          { success: false, error: 'No se encontró la media para eliminar' },
          { status: 404 }
        )
      }
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Error al eliminar media',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
