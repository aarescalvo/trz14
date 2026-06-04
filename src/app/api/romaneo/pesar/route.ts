import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TipoAnimal } from '@prisma/client'
import { checkPermission } from '@/lib/auth-helpers'
import { createLogger } from '@/lib/logger'
const log = createLogger('app.api.romaneo.pesar.route')

// POST - Registrar pesaje de media res (con transacción para multi-usuario)
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeRomaneo')
  if (authError) return authError
  try {
    const body = await request.json()
    const { 
      garron, 
      lado, 
      peso, 
      siglas, 
      denticion, 
      tipificadorId, 
      camaraId, 
      operadorId,
      sobrescribir = false, // Nuevo parámetro para modo edición
      fecha // Permite post-datado (simulación)
    } = body

    log.info('=== INICIO PESAJE ===')
    log.info('Datos recibidos:', { garron, lado, peso, camaraId, denticion, tipificadorId, operadorId, fecha })

    if (!garron || !lado || !peso || !camaraId) {
      log.info('Error: Faltan datos requeridos')
      return NextResponse.json(
        { success: false, error: 'Faltan datos requeridos: garron, lado, peso, camaraId' },
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

    // Validar peso
    const pesoNum = parseFloat(peso)
    if (isNaN(pesoNum) || pesoNum <= 0) {
      return NextResponse.json(
        { success: false, error: 'Peso debe ser un número positivo' },
        { status: 400 }
      )
    }

    // USAR TRANSACCIÓN para evitar race conditions en multi-usuario
    const result = await db.$transaction(async (tx) => {
      // Validar que el operador existe (si se proporciona)
      let validOperadorId: string | null = null
      if (operadorId) {
        const operadorExists = await tx.operador.findUnique({
          where: { id: operadorId }
        })
        if (operadorExists) {
          validOperadorId = operadorId
        }
      }

      // Validar que el tipificador existe (si se proporciona)
      let validTipificadorId: string | null = null
      if (tipificadorId) {
        const tipificadorExists = await tx.tipificador.findUnique({
          where: { id: tipificadorId }
        })
        if (tipificadorExists) {
          validTipificadorId = tipificadorId
        }
      }

      // Buscar la asignación del garrón para la fecha indicada (o hoy)
      const fechaRef = fecha ? new Date(fecha) : new Date()
      fechaRef.setHours(0, 0, 0, 0)

      const asignacion = await tx.asignacionGarron.findFirst({
        where: {
          garron: parseInt(garron),
          horaIngreso: {
            gte: fechaRef,
            lt: new Date(fechaRef.getTime() + 24 * 60 * 60 * 1000)
          }
        },
        include: {
          animal: {
            include: {
              tropa: true,
              pesajeIndividual: true
            }
          }
        }
      })

      log.info(`Asignación encontrada: ${asignacion ? `ID: ${asignacion.id}` : 'No encontrada'}`)

      // IMPORTANTE: Verificar si la asignación YA tiene esta media pesada
      // Si sobrescribir es true, permitimos editar medias existentes
      if (!sobrescribir && asignacion) {
        if (lado === 'DERECHA' && asignacion.tieneMediaDer) {
          throw new Error(`MEDIA_YA_EXISTE:${lado}:${garron}`)
        }
        if (lado === 'IZQUIERDA' && asignacion.tieneMediaIzq) {
          throw new Error(`MEDIA_YA_EXISTE:${lado}:${garron}`)
        }
      }

      // Verificar si ya existe romaneo para este garrón de la fecha indicada
      // Filtrar por fecha para no encontrar romaneos de días anteriores
      let romaneo = await tx.romaneo.findFirst({
        where: { 
          garron: parseInt(garron),
          createdAt: {
            gte: fechaRef,
            lt: new Date(fechaRef.getTime() + 24 * 60 * 60 * 1000)
          }
        },
        include: { mediasRes: true }
      })

      if (!romaneo) {
        // Crear nuevo romaneo
        const animal = asignacion?.animal
        
        log.info('Creando nuevo romaneo con datos:', {
          garron: parseInt(garron),
          tropaCodigo: animal?.tropa?.codigo || asignacion?.tropaCodigo,
          numeroAnimal: animal?.numero || asignacion?.animalNumero,
          pesoVivo: animal?.pesoVivo || animal?.pesajeIndividual?.peso || asignacion?.pesoVivo
        })

        romaneo = await tx.romaneo.create({
          data: {
            garron: parseInt(garron),
            tropaCodigo: animal?.tropa?.codigo || asignacion?.tropaCodigo || null,
            numeroAnimal: animal?.numero || asignacion?.animalNumero || null,
            tipoAnimal: (animal?.tipoAnimal || asignacion?.tipoAnimal) as TipoAnimal | null || null,
            pesoVivo: animal?.pesoVivo || animal?.pesajeIndividual?.peso || asignacion?.pesoVivo || null,
            denticion: denticion || null,
            tipificadorId: validTipificadorId,
            operadorId: validOperadorId,
            estado: 'PENDIENTE'
          },
          include: { mediasRes: true }
        })
        
        log.info(`Romaneo creado: ${romaneo.id}`)
      }

      // Actualizar dentición si se proporciona
      if (denticion) {
        await tx.romaneo.update({
          where: { id: romaneo.id },
          data: { denticion, tipificadorId: validTipificadorId }
        })
      }

      // Verificar si ya existe esta media (dentro de la transacción para evitar duplicados)
      const mediaExistente = await tx.mediaRes.findFirst({
        where: {
          romaneoId: romaneo.id,
          lado: lado as 'IZQUIERDA' | 'DERECHA'
        }
      })

      // Si existe y estamos en modo sobrescribir, eliminar la media existente
      if (mediaExistente && sobrescribir) {
        log.info(`Eliminando media existente para sobrescribir: ${mediaExistente.id}`)
        
        // Actualizar stock de la cámara VIEJA (reducir el peso y cantidad anterior)
        // BUG FIX: usar mediaExistente.camaraId (cámara vieja), no camaraId (cámara nueva)
        if (mediaExistente.camaraId) {
          const tropaCodigo = romaneo.tropaCodigo || 'SIN-TROPA'
          const stockExistente = await tx.stockMediaRes.findFirst({
            where: {
              camaraId: mediaExistente.camaraId,
              tropaCodigo,
              especie: 'BOVINO'
            }
          })
          
          if (stockExistente) {
            await tx.stockMediaRes.update({
              where: { id: stockExistente.id },
              data: {
                cantidad: { decrement: 1 },
                pesoTotal: { decrement: mediaExistente.peso }
              }
            })
          }
        }
        
        // Eliminar la media existente
        await tx.mediaRes.delete({
          where: { id: mediaExistente.id }
        })
        
        log.info('Media eliminada, procediendo a crear la nueva')
      } else if (mediaExistente && !sobrescribir) {
        throw new Error(`MEDIA_YA_EXISTE:${lado}:${garron}`)
      }

      // Generar código para la media (usar fecha indicada o actual)
      const fechaCodigo = fecha ? new Date(fecha) : new Date()
      const codigoBase = `${fechaCodigo.getFullYear().toString().slice(-2)}${(fechaCodigo.getMonth() + 1).toString().padStart(2, '0')}${fechaCodigo.getDate().toString().padStart(2, '0')}-${garron.toString().padStart(4, '0')}-${lado.charAt(0)}`

      // Crear la media res
      const mediaRes = await tx.mediaRes.create({
        data: {
          romaneoId: romaneo.id,
          lado: lado as 'IZQUIERDA' | 'DERECHA',
          sigla: 'A', // Por defecto A
          peso: pesoNum,
          codigo: `${codigoBase}-A`,
          estado: 'EN_CAMARA',
          camaraId
        }
      })

      log.info(`MediaRes creada: ${mediaRes.id}`)

      // Actualizar stock de la cámara
      const tropaCodigo = romaneo.tropaCodigo || 'SIN-TROPA'
      
      const stockExistente = await tx.stockMediaRes.findFirst({
        where: {
          camaraId,
          tropaCodigo,
          especie: 'BOVINO'
        }
      })

      if (stockExistente) {
        await tx.stockMediaRes.update({
          where: { id: stockExistente.id },
          data: {
            cantidad: { increment: 1 },
            pesoTotal: { increment: pesoNum }
          }
        })
        log.info(`Stock actualizado: ${stockExistente.id}`)
      } else {
        const nuevoStock = await tx.stockMediaRes.create({
          data: {
            camaraId,
            tropaCodigo,
            especie: 'BOVINO',
            cantidad: 1,
            pesoTotal: pesoNum
          }
        })
        log.info(`Stock creado: ${nuevoStock.id}`)
      }

      // Registrar movimiento de cámara
      await tx.movimientoCamara.create({
        data: {
          camaraDestinoId: camaraId,
          producto: 'Media Res',
          cantidad: 1,
          peso: pesoNum,
          tropaCodigo: romaneo.tropaCodigo,
          mediaResId: mediaRes.id,
          operadorId: operadorId || null,
          observaciones: `Ingreso garrón ${garron} - ${lado}`
        }
      })
      log.info('Movimiento de cámara registrado')

      // Actualizar asignación del garrón
      if (asignacion) {
        if (lado === 'DERECHA') {
          await tx.asignacionGarron.update({
            where: { id: asignacion.id },
            data: { tieneMediaDer: true }
          })
        } else {
          await tx.asignacionGarron.update({
            where: { id: asignacion.id },
            data: { tieneMediaIzq: true }
          })
        }
      }

      // Verificar si ya tiene ambas medias
      const todasLasMedias = await tx.mediaRes.findMany({
        where: { romaneoId: romaneo.id }
      })

      log.info(`Total medias: ${todasLasMedias.length}`)

      // Si tiene ambas medias, actualizar romaneo con totales
      if (todasLasMedias.length === 2) {
        const mediaIzq = todasLasMedias.find(m => m.lado === 'IZQUIERDA')
        const mediaDer = todasLasMedias.find(m => m.lado === 'DERECHA')
        
        if (mediaIzq && mediaDer) {
          const pesoTotal = mediaIzq.peso + mediaDer.peso
          const rinde = romaneo.pesoVivo ? (pesoTotal / romaneo.pesoVivo) * 100 : null

          await tx.romaneo.update({
            where: { id: romaneo.id },
            data: {
              pesoMediaIzq: mediaIzq.peso,
              pesoMediaDer: mediaDer.peso,
              pesoTotal,
              rinde,
              estado: 'PENDIENTE'
            }
          })

          // Marcar asignación como completada
          if (asignacion) {
            await tx.asignacionGarron.update({
              where: { id: asignacion.id },
              data: { completado: true }
            })
          }
          
          log.info('Romaneo completado con ambas medias')
        }
      }

      return { mediaRes, romaneo }
    })

    log.info('=== FIN PESAJE EXITOSO ===')

    return NextResponse.json({
      success: true,
      data: {
        id: result.mediaRes.id,
        garron,
        lado,
        peso: pesoNum,
        codigo: result.mediaRes.codigo,
        romaneoId: result.romaneo.id
      }
    })

  } catch (error: unknown) {
    console.error('=== ERROR EN PESAJE ===')
    console.error('Error completo:', error)
    
    // Manejar errores específicos
    if (error instanceof Error && error.message.startsWith('MEDIA_YA_EXISTE:')) {
      const parts = error.message.split(':')
      const lado = parts[1]
      const garronNum = parts[2]
      return NextResponse.json(
        { success: false, error: `Ya existe media ${lado?.toLowerCase()} para el garrón ${garronNum}` },
        { status: 409 } // Conflict
      )
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error al registrar pesaje',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
