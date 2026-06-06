import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// GET - Obtener pesajes individuales
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedePesajeIndividual')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const animalId = searchParams.get('animalId')
    const tropaId = searchParams.get('tropaId')
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')
    const limit = parseInt(searchParams.get('limit') || '100')

    const where: any = {}

    if (animalId) where.animalId = animalId
    if (fechaDesde || fechaHasta) {
      where.fecha = {}
      if (fechaDesde) where.fecha.gte = new Date(fechaDesde)
      if (fechaHasta) {
        const hasta = new Date(fechaHasta)
        hasta.setHours(23, 59, 59, 999)
        where.fecha.lte = hasta
      }
    }

    const pesajes = await db.pesajeIndividual.findMany({
      where,
      include: {
        animal: {
          include: {
            tropa: {
              include: {
                productor: true,
                usuarioFaena: true
              }
            }
          }
        },
        operador: {
          select: { nombre: true, rol: true }
        }
      },
      orderBy: { fecha: 'desc' },
      take: limit
    })

    // Filtrar por tropaId después de obtener (ya que es una relación anidada)
    const filtrados = tropaId
      ? pesajes.filter(p => p.animal?.tropaId === tropaId)
      : pesajes

    return NextResponse.json({
      success: true,
      data: filtrados.map(p => ({
        id: p.id,
        peso: p.peso,
        caravana: p.caravana,
        observaciones: p.observaciones,
        fecha: p.fecha.toISOString(),
        operador: p.operador,
        animal: p.animal ? {
          id: p.animal.id,
          numero: p.animal.numero,
          codigo: p.animal.codigo,
          tipoAnimal: p.animal.tipoAnimal,
          raza: p.animal.raza,
          tropa: p.animal.tropa ? {
            id: p.animal.tropa.id,
            codigo: p.animal.tropa.codigo,
            especie: p.animal.tropa.especie,
            productor: p.animal.tropa.productor,
            usuarioFaena: p.animal.tropa.usuarioFaena
          } : null
        } : null
      }))
    })
  } catch (error) {
    console.error('Error fetching pesajes individuales:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener pesajes individuales' },
      { status: 500 }
    )
  }
}

// POST - Crear pesaje individual
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedePesajeIndividual')
  if (authError) return authError

  try {
    const body = await request.json()
    const { animalId, peso, caravana, observaciones, operadorId, fecha } = body

    if (!animalId || !peso) {
      return NextResponse.json(
        { success: false, error: 'animalId y peso son requeridos' },
        { status: 400 }
      )
    }

    const pesoParsed = parseFloat(peso)
    if (isNaN(pesoParsed) || pesoParsed <= 0) {
      return NextResponse.json({ error: 'El peso debe ser un valor positivo mayor a 0' }, { status: 400 })
    }

    // Crear pesaje, actualizar animal y tropa todo en transacción
    const result = await db.$transaction(async (tx) => {
      const pesaje = await tx.pesajeIndividual.create({
        data: {
          animalId,
          peso: parseFloat(peso),
          caravana,
          observaciones,
          operadorId,
          ...(fecha ? { fecha: new Date(fecha) } : {})
        },
        include: {
          animal: {
            include: { tropa: true }
          }
        }
      })

      const animal = await tx.animal.update({
        where: { id: animalId },
        data: { 
          pesoVivo: parseFloat(peso),
          estado: 'PESADO'
        }
      })

      // Actualizar peso total individual de la tropa (dentro de la transacción)
      if (animal.tropaId) {
        const totalPeso = await tx.pesajeIndividual.aggregate({
          where: {
            animal: { tropaId: animal.tropaId }
          },
          _sum: { peso: true }
        })
        
        await tx.tropa.update({
          where: { id: animal.tropaId },
          data: { pesoTotalIndividual: totalPeso._sum.peso || 0 }
        })
      }

      return pesaje
    })

    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        peso: result.peso,
        caravana: result.caravana,
        animal: result.animal
      }
    })
  } catch (error) {
    console.error('Error creating pesaje individual:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear pesaje individual' },
      { status: 500 }
    )
  }
}

// PUT - Actualizar pesaje individual
export async function PUT(request: NextRequest) {
  const authError = await checkPermission(request, 'puedePesajeIndividual')
  if (authError) return authError

  try {
    const body = await request.json()
    const { id, peso, caravana, observaciones } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID es requerido' },
        { status: 400 }
      )
    }

    if (peso !== undefined) {
      const pesoParsed = parseFloat(peso)
      if (isNaN(pesoParsed) || pesoParsed <= 0) {
        return NextResponse.json({ error: 'El peso debe ser un valor positivo mayor a 0' }, { status: 400 })
      }
    }

    const result = await db.$transaction(async (tx) => {
      const pesaje = await tx.pesajeIndividual.update({
        where: { id },
        data: {
          peso: peso !== undefined ? parseFloat(peso) : undefined,
          caravana,
          observaciones
        },
        include: {
          animal: {
            include: { tropa: true }
          }
        }
      })

      // Si cambió el peso, actualizar el animal y recalcular pesoTotalIndividual de la tropa
      if (peso !== undefined) {
        const animal = await tx.animal.update({
          where: { id: pesaje.animalId },
          data: { pesoVivo: parseFloat(peso) },
          include: { tropa: true }
        })

        // Recalcular peso total individual de la tropa
        if (animal.tropaId) {
          const totalPeso = await tx.pesajeIndividual.aggregate({
            where: {
              animal: { tropaId: animal.tropaId }
            },
            _sum: { peso: true }
          })

          await tx.tropa.update({
            where: { id: animal.tropaId },
            data: { pesoTotalIndividual: totalPeso._sum.peso || 0 }
          })
        }
      }

      return pesaje
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Error updating pesaje individual:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar pesaje' },
      { status: 500 }
    )
  }
}
