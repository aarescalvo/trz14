import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// POST - Corregir correlatividad de garrones (renumerar según orden)
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeListaFaena')
  if (authError) return authError
  try {
    const body = await request.json()
    const { operadorId, fecha } = body

    const fechaRef = fecha ? new Date(fecha) : new Date()
    fechaRef.setHours(0, 0, 0, 0)

    // Obtener todas las asignaciones del día (fecha indicada o hoy) ordenadas por hora de ingreso
    const asignaciones = await db.asignacionGarron.findMany({
      where: {
        horaIngreso: {
          gte: fechaRef,
          lt: new Date(fechaRef.getTime() + 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { horaIngreso: 'asc' }
    })

    // Verificar si hay huecos en la numeración
    const garronesActuales = asignaciones.map(a => a.garron).sort((a, b) => a - b)
    const huecosEncontrados: number[] = []
    
    for (let i = 0; i < garronesActuales.length; i++) {
      const esperado = i + 1
      const actual = garronesActuales[i]
      if (actual !== esperado) {
        huecosEncontrados.push(actual)
      }
    }

    if (huecosEncontrados.length === 0) {
      return NextResponse.json({
        success: true,
        data: { corregidos: 0, mensaje: 'No hay huecos en la correlatividad' }
      })
    }

    // Crear mapa de renumeración
    const renumeracion = new Map<number, number>()
    asignaciones.forEach((a, idx) => {
      const nuevoGarron = idx + 1
      if (a.garron !== nuevoGarron) {
        renumeracion.set(a.garron, nuevoGarron)
      }
    })

    // Ejecutar renumeración en transacción
    let corregidos = 0

    for (const [garronViejo, garronNuevo] of renumeracion) {
      // Actualizar asignación
      const asignacion = await db.asignacionGarron.findFirst({
        where: { garron: garronViejo }
      })

      if (asignacion) {
        // Temporalmente cambiar a número negativo para evitar conflicto de unique
        await db.asignacionGarron.update({
          where: { id: asignacion.id },
          data: { garron: -garronViejo }
        })

        // Luego asignar el nuevo número
        await db.asignacionGarron.update({
          where: { id: asignacion.id },
          data: { garron: garronNuevo }
        })

        // Actualizar romaneo
        await db.romaneo.updateMany({
          where: { garron: garronViejo },
          data: { garron: garronNuevo }
        })

        // Actualizar medias reses (códigos de barras)
        const medias = await db.mediaRes.findMany({
          where: { romaneo: { garron: garronNuevo } }
        })

        for (const media of medias) {
          // Actualizar código de barras
          const nuevoCodigo = media.codigo.replace(
            /-\d{4}-([DI])-/,
            `-${garronNuevo.toString().padStart(4, '0')}-$1-`
          )
          
          await db.mediaRes.update({
            where: { id: media.id },
            data: { codigo: nuevoCodigo }
          })
        }

        corregidos++
      }
    }

    return NextResponse.json({
      success: true,
      data: { 
        corregidos,
        mensaje: `Se renumeraron ${corregidos} garrones para corregir la correlatividad`
      }
    })

  } catch (error) {
    console.error('Error corrigiendo correlatividad:', error)
    return NextResponse.json(
      { success: false, error: 'Error al corregir correlatividad' },
      { status: 500 }
    )
  }
}
