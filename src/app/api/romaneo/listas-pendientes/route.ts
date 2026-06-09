import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'
import { createLogger } from '@/lib/logger'
import { Prisma } from '@prisma/client'

const log = createLogger('app.api.romaneo.listas-pendientes.route')

// GET - Listas de faena con resumen de estado de romaneo (últimos 30 días)
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeRomaneo')
  if (authError) return authError

  try {
    const fechaLimite = new Date()
    fechaLimite.setDate(fechaLimite.getDate() - 30)
    fechaLimite.setHours(0, 0, 0, 0)

    // Obtener listas de faena de los últimos 30 días (ABIERTA, EN_PROCESO, CERRADA)
    const listas = await db.listaFaena.findMany({
      where: {
        fecha: { gte: fechaLimite },
        estado: { in: ['ABIERTA', 'EN_PROCESO', 'CERRADA'] }
      },
      include: {
        tropas: {
          include: {
            tropa: {
              select: { codigo: true, codigoSimplificado: true }
            }
          }
        },
        asignaciones: {
          select: {
            completado: true,
            tropaCodigo: true
          }
        }
      },
      orderBy: { numero: 'desc' }
    })

    const result = listas.map(lista => {
      const totalGarrones = lista.asignaciones.length
      const completados = lista.asignaciones.filter(a => a.completado).length
      const pendientes = totalGarrones - completados
      const porcentaje = totalGarrones > 0 ? Math.round((completados / totalGarrones) * 100) : 0

      // Obtener tropas únicas (usar tropaCodigo de asignaciones, o tropas relacionadas)
      const tropasFromAsignaciones = lista.asignaciones
        .map(a => a.tropaCodigo)
        .filter((c): c is string => !!c)
      const tropasFromRelaciones = lista.tropas.map(t => t.tropa.codigoSimplificado || t.tropa.codigo)
      const tropasSet = new Set([...tropasFromAsignaciones, ...tropasFromRelaciones])
      const tropas = Array.from(tropasSet).sort()

      return {
        id: lista.id,
        numero: lista.numero,
        fecha: lista.fecha.toISOString(),
        estado: lista.estado,
        totalGarrones,
        completados,
        pendientes,
        porcentaje,
        tropas
      }
    })

    // Contar cuántas listas tienen pendientes
    const listasConPendientes = result.filter(l => l.pendientes > 0).length

    log.info('Listas pendientes consultadas', { total: result.length, conPendientes: listasConPendientes })

    return NextResponse.json({
      success: true,
      data: result,
      resumen: {
        total: result.length,
        conPendientes: listasConPendientes
      }
    })
  } catch (error) {
    log.error('Error al consultar listas pendientes', error)
    return NextResponse.json(
      { success: false, error: 'Error al consultar listas pendientes' },
      { status: 500 }
    )
  }
}
