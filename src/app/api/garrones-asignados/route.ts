import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'
import { createLogger } from '@/lib/logger'
const log = createLogger('app.api.garrones-asignados.route')

// GET - Obtener garrones asignados con su estado de pesaje
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeListaFaena')
  if (authError) return authError
  try {
    const { searchParams } = new URL(request.url)
    const fecha = searchParams.get('fecha')
    const listaId = searchParams.get('listaId')
    
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    
    const fechaFiltro = fecha ? new Date(fecha) : hoy

    // Construir filtro
    const whereClause: any = {
      horaIngreso: {
        gte: fechaFiltro,
        lt: new Date(fechaFiltro.getTime() + 24 * 60 * 60 * 1000)
      }
    }
    
    // Si se pasa listaId, filtrar por esa lista
    if (listaId) {
      whereClause.listaFaenaId = listaId
    }

    // Buscar asignaciones de garrones del día
    const asignaciones = await db.asignacionGarron.findMany({
      where: whereClause,
      include: {
        animal: {
          include: {
            tropa: true,
            pesajeIndividual: true
          }
        },
        listaFaena: {
          select: {
            id: true,
            numero: true,
            fecha: true,
            estado: true
          }
        }
      },
      orderBy: { garron: 'asc' }
    })

    // Obtener info de la lista de faena (si hay asignaciones)
    let listaFaenaInfo: { id: string; numero: number; fecha: Date; estado: string } | null = null
    if (asignaciones.length > 0 && asignaciones[0].listaFaena) {
      const lf = asignaciones[0].listaFaena
      listaFaenaInfo = { id: lf.id, numero: lf.numero, fecha: lf.fecha, estado: lf.estado }
    }

    // Obtener todas las listas disponibles (últimos 30 días para el dropdown)
    const listasDisponibles = await db.listaFaena.findMany({
      where: {
        estado: { in: ['ABIERTA', 'EN_PROCESO', 'CERRADA'] },
        tropas: { some: {} },
        fecha: {
          gte: new Date(fechaFiltro.getTime() - 30 * 24 * 60 * 60 * 1000),
          lt: new Date(fechaFiltro.getTime() + 1 * 24 * 60 * 60 * 1000)
        }
      },
      select: { id: true, numero: true, fecha: true, estado: true },
      orderBy: { numero: 'desc' }
    })

    // Formatear respuesta usando los campos del schema
    const data = asignaciones.map(a => {
      return {
        garron: a.garron,
        animalId: a.animalId,
        animalCodigo: a.animal?.codigo || null,
        tropaCodigo: a.tropaCodigo || a.animal?.tropa?.codigo || null,
        tipoAnimal: a.tipoAnimal || a.animal?.tipoAnimal?.toString() || null,
        pesoVivo: a.pesoVivo || a.animal?.pesoVivo || a.animal?.pesajeIndividual?.peso || null,
        tieneMediaDer: a.tieneMediaDer,
        tieneMediaIzq: a.tieneMediaIzq,
        completado: a.completado
      }
    })

    return NextResponse.json({
      success: true,
      data,
      listaFaena: listaFaenaInfo,
      listasDisponibles
    })

  } catch (error) {
    console.error('Error obteniendo garrones asignados:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener garrones' },
      { status: 500 }
    )
  }
}

// POST - Asignar garrón a un animal (con transacción para multi-usuario)
// Puede recibir:
// - animalId: ID específico del animal
// - tropaCodigo: Código de tropa para buscar primer animal disponible
// - sinIdentificar: true si es animal sin identificar
// - listaFaenaId: ID de la lista de faena (obligatorio para evitar conflictos entre listas)
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeListaFaena')
  if (authError) return authError
  try {
    const body = await request.json()
    const { garron, animalId, tropaCodigo, sinIdentificar, operadorId, listaFaenaId } = body

    if (!garron) {
      return NextResponse.json(
        { success: false, error: 'Número de garrón requerido' },
        { status: 400 }
      )
    }

    if (!listaFaenaId) {
      return NextResponse.json(
        { success: false, error: 'ID de lista de faena requerido' },
        { status: 400 }
      )
    }

    // USAR TRANSACCIÓN para evitar race conditions en multi-usuario
    const result = await db.$transaction(async (tx) => {
      // Buscar si ya existe una asignación para este garrón en ESTA lista de faena
      const existente = await tx.asignacionGarron.findUnique({
        where: {
          listaFaenaId_garron: {
            listaFaenaId,
            garron
          }
        },
        include: {
          animal: true
        }
      })

      // Si existe y tiene animal asignado, no permitir sobrescribir
      if (existente && existente.animalId) {
        throw new Error('GARRON_YA_ASIGNADO')
      }

      let animalData: { id: string; codigo: string; tropaCodigo: string; tipoAnimal: string; pesoVivo: number | undefined; numero: number } | null = null
      let animalAsignadoId = animalId || null

      // Si se proporciona tropaCodigo pero no animalId, buscar primer animal disponible
      if (tropaCodigo && !animalId && !sinIdentificar) {
        // Buscar animal de esta tropa que no tenga garrón asignado
        const animalDisponible = await tx.animal.findFirst({
          where: {
            tropa: { codigo: tropaCodigo },
            estado: { in: ['PESADO', 'RECIBIDO'] },
            asignacionGarron: null // Sin garrón asignado
          },
          include: {
            tropa: true,
            pesajeIndividual: true
          },
          orderBy: { numero: 'asc' }
        })

        if (animalDisponible) {
          animalAsignadoId = animalDisponible.id
          animalData = {
            id: animalDisponible.id,
            codigo: animalDisponible.codigo,
            tropaCodigo: animalDisponible.tropa?.codigo || '',
            tipoAnimal: animalDisponible.tipoAnimal?.toString() || '',
            pesoVivo: animalDisponible.pesoVivo || animalDisponible.pesajeIndividual?.peso,
            numero: animalDisponible.numero
          }
        } else {
          // No hay animal disponible, crear asignación sin animal
          log.info(`'[garrones] No hay animal disponible en tropa:' tropaCodigo`)
        }
      }
      // Si se proporciona animalId directo
      else if (animalId) {
        const animal = await tx.animal.findUnique({
          where: { id: animalId },
          include: {
            tropa: true,
            pesajeIndividual: true
          }
        })
        
        if (animal) {
          animalData = {
            id: animal.id,
            codigo: animal.codigo,
            tropaCodigo: animal.tropa?.codigo || '',
            tipoAnimal: animal.tipoAnimal?.toString() || '',
            pesoVivo: animal.pesoVivo || animal.pesajeIndividual?.peso,
            numero: animal.numero
          }
        }
      }

      let asignacion

      if (existente) {
        // Si existe pero no tiene animal (era "sin identificar"), actualizar
        asignacion = await tx.asignacionGarron.update({
          where: { id: existente.id },
          data: {
            animalId: animalAsignadoId,
            tropaCodigo: tropaCodigo || animalData?.tropaCodigo || existente.tropaCodigo,
            animalNumero: animalData?.numero || null,
            tipoAnimal: animalData?.tipoAnimal || null,
            pesoVivo: animalData?.pesoVivo || null,
            operadorId: operadorId || null,
            horaIngreso: new Date()
          }
        })
      } else {
        // Crear nueva asignación
        asignacion = await tx.asignacionGarron.create({
          data: {
            garron,
            animalId: animalAsignadoId,
            listaFaenaId,
            tropaCodigo: tropaCodigo || animalData?.tropaCodigo || null,
            animalNumero: animalData?.numero || null,
            tipoAnimal: animalData?.tipoAnimal || null,
            pesoVivo: animalData?.pesoVivo || null,
            operadorId: operadorId || null,
            tieneMediaDer: false,
            tieneMediaIzq: false,
            completado: false,
            horaIngreso: new Date()
          }
        })
      }

      // Si hay animal asignado, actualizar su estado
      if (animalAsignadoId) {
        await tx.animal.update({
          where: { id: animalAsignadoId },
          data: { estado: 'EN_FAENA' }
        })
      }

      return { asignacion, animalData, esActualizacion: !!existente }
    })

    return NextResponse.json({
      success: true,
      data: {
        id: result.asignacion.id,
        garron: result.asignacion.garron,
        animalId: result.asignacion.animalId,
        animalCodigo: result.animalData?.codigo || null,
        tropaCodigo: result.asignacion.tropaCodigo,
        sinIdentificar: !result.animalData && sinIdentificar,
        esActualizacion: result.esActualizacion
      }
    })

  } catch (error: unknown) {
    console.error('Error asignando garrón:', error)
    
    // Manejar error específico de garrón ya asignado
    if (error instanceof Error && error.message === 'GARRON_YA_ASIGNADO') {
      return NextResponse.json(
        { success: false, error: 'El garrón ya tiene un animal asignado' },
        { status: 409 } // Conflict
      )
    }
    
    return NextResponse.json(
      { success: false, error: 'Error al asignar garrón' },
      { status: 500 }
    )
  }
}
