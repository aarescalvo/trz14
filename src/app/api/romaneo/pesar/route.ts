import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TipoAnimal } from '@prisma/client'
import { checkPermission } from '@/lib/auth-helpers'
import { createLogger } from '@/lib/logger'
import { generarCodigoMediaRes } from '@/lib/codigo-media-res'
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
      fecha, // Permite post-datado (simulación)
      listaFaenaId // ID de lista de faena para buscar asignación correcta
    } = body

    log.info('=== INICIO PESAJE ===')
    log.info('Datos recibidos:', { garron, lado, peso, camaraId, denticion, tipificadorId, operadorId, fecha, listaFaenaId })

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

      // Buscar la asignación del garrón
      const fechaRef = fecha ? new Date(fecha) : new Date()
      fechaRef.setHours(0, 0, 0, 0)

      let asignacion
      if (listaFaenaId) {
        // Si hay listaFaenaId, buscar por lista + garron (sin filtro de fecha)
        asignacion = await tx.asignacionGarron.findFirst({
          where: {
            listaFaenaId,
            garron: parseInt(garron)
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
        log.info(`Asignación por listaFaenaId=${listaFaenaId}, garron=${garron}: ${asignacion ? 'ENCONTRADA' : 'NO ENCONTRADA'}`)
      } else {
        // Sin listaFaenaId, buscar por fecha (comportamiento original)
        asignacion = await tx.asignacionGarron.findFirst({
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
        log.info(`Asignación por fecha, garron=${garron}: ${asignacion ? 'ENCONTRADA' : 'NO ENCONTRADA'}`)
      }

      log.info(`Asignación encontrada: ${asignacion ? `ID: ${asignacion.id}` : 'No encontrada'}`)

      // IMPORTANTE: Verificar si la asignación YA tiene esta media pesada
      // Verificar consistencia: si el flag dice "ya pesada" pero no hay media real, permitir
      if (asignacion) {
        const flagLado = lado === 'DERECHA' ? asignacion.tieneMediaDer : asignacion.tieneMediaIzq
        
        // Buscar romaneo temporal para verificar si realmente tiene la media
        const romaneoCheck = await tx.romaneo.findFirst({
          where: {
            garron: parseInt(garron),
            ...(listaFaenaId ? { listaFaenaId } : {
              createdAt: {
                gte: fechaRef,
                lt: new Date(fechaRef.getTime() + 24 * 60 * 60 * 1000)
              }
            })
          },
          include: { mediasRes: true }
        })
        const tieneMediaReal = romaneoCheck?.mediasRes.some(m => m.lado === lado)
        
        if (flagLado && !tieneMediaReal) {
          // Flag inconsistente: dice que tiene media pero no existe realmente
          log.warn(`Flag inconsistente en asignacion garron ${garron} ${lado}: flag=true pero no hay MediaRes. Resetenando flag.`)
          await tx.asignacionGarron.update({
            where: { id: asignacion.id },
            data: lado === 'DERECHA' ? { tieneMediaDer: false, completado: false } : { tieneMediaIzq: false, completado: false }
          })
        } else if (flagLado && tieneMediaReal && !sobrescribir) {
          throw new Error(`MEDIA_YA_EXISTE:${lado}:${garron}`)
        }
      }

      // Verificar si ya existe romaneo para este garrón en ESTA lista
      let romaneo
      if (listaFaenaId) {
        // Buscar SOLO por lista + garron + tropaCodigo (triple match)
        // NUNCA reutilizar romaneos de otras listas ni sin listaFaenaId
        const tropaRef = asignacion?.tropaCodigo || null
        romaneo = await tx.romaneo.findFirst({
          where: { 
            garron: parseInt(garron),
            listaFaenaId,
            ...(tropaRef ? { tropaCodigo: tropaRef } : {})
          },
          include: { mediasRes: true }
        })
        log.info(`Romaneo buscado (listaFaenaId=${listaFaenaId}, garron=${garron}, tropa=${tropaRef}): ${romaneo ? 'ENCONTRADO ' + romaneo.id : 'NO ENCONTRADO - se creará nuevo'}`)
      } else {
        // Buscar por fecha (comportamiento original)
        romaneo = await tx.romaneo.findFirst({
          where: { 
            garron: parseInt(garron),
            createdAt: {
              gte: fechaRef,
              lt: new Date(fechaRef.getTime() + 24 * 60 * 60 * 1000)
            }
          },
          include: { mediasRes: true }
        })
      }

      if (!romaneo) {
        // Crear nuevo romaneo
        const animal = asignacion?.animal
        
        log.info('Creando nuevo romaneo con datos:', {
          garron: parseInt(garron),
          tropaCodigo: animal?.tropa?.codigo || asignacion?.tropaCodigo,
          numeroAnimal: animal?.numero || asignacion?.animalNumero,
          pesoVivo: animal?.pesoVivo || animal?.pesajeIndividual?.peso || asignacion?.pesoVivo,
          listaFaenaId: listaFaenaId || asignacion?.listaFaenaId || null
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
            listaFaenaId: listaFaenaId || asignacion?.listaFaenaId || null,
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

      // Generar código unificado para la media
      const especieMedia = asignacion?.animal?.tropa?.especie || 'BOVINO'
      const codigoMedia = generarCodigoMediaRes({
        tropaCodigo: romaneo.tropaCodigo,
        especie: especieMedia,
        garron: parseInt(garron),
        lado: lado as 'IZQUIERDA' | 'DERECHA'
      })

      // NUNCA reasignar MediaRes de otros romaneos. Siempre crear nueva.
      // Verificar duplicado SOLO dentro de este romaneo
      let mediaRes
      const codigoDuplicado = await tx.mediaRes.findFirst({
        where: { 
          codigo: codigoMedia,
          romaneoId: romaneo.id 
        }
      })

      if (codigoDuplicado && !sobrescribir) {
        throw new Error(`MEDIA_YA_EXISTE:${lado}:${garron}`)
      } else if (codigoDuplicado && sobrescribir) {
        mediaRes = await tx.mediaRes.update({
          where: { id: codigoDuplicado.id },
          data: { peso: pesoNum, camaraId }
        })
      } else {
        // Crear la media res nueva
        mediaRes = await tx.mediaRes.create({
          data: {
            romaneoId: romaneo.id,
            lado: lado as 'IZQUIERDA' | 'DERECHA',
            sigla: 'A',
            peso: pesoNum,
            codigo: codigoMedia,
            estado: 'EN_CAMARA',
            camaraId
          }
        })
      }

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
