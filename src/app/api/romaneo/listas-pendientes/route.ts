import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'
import { createLogger } from '@/lib/logger'

const log = createLogger('app.api.romaneo.listas-pendientes.route')

// GET - Listas de faena con resumen de estado de romaneo
// Cuenta pesados reales: garrones que tienen AMBAS medias en MediaRes vinculadas a la lista
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeRomaneo')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const dias = parseInt(searchParams.get('dias') || '90')

    const fechaLimite = new Date()
    fechaLimite.setDate(fechaLimite.getDate() - dias)
    fechaLimite.setHours(0, 0, 0, 0)

    // Obtener listas de faena con asignaciones y tropas
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
            id: true,
            garron: true,
            completado: true,
            tropaCodigo: true
          }
        }
      },
      orderBy: { numero: 'desc' }
    })

    // Para cada lista, contar pesados reales buscando romaneos + MediaRes
    // Hacemos una consulta por lista para obtener datos reales
    const listaIds = listas.map(l => l.id)

    // Un bulk query: todos los romaneos vinculados a estas listas con sus medias
    const romaneosConMedias = await db.romaneo.findMany({
      where: {
        listaFaenaId: { in: listaIds }
      },
      include: {
        mediasRes: {
          select: { lado: true }
        }
      }
    })

    // Agrupar por listaFaenaId: contar garrones que tienen ambas medias
    const completadosPorLista = new Map<string, number>()
    const pesadosParcialPorLista = new Map<string, number>()

    for (const rom of romaneosConMedias) {
      if (!rom.listaFaenaId) continue
      const medias = rom.mediasRes
      const tieneDer = medias.some(m => m.lado === 'DERECHA')
      const tieneIzq = medias.some(m => m.lado === 'IZQUIERDA')

      if (tieneDer && tieneIzq) {
        completadosPorLista.set(
          rom.listaFaenaId,
          (completadosPorLista.get(rom.listaFaenaId) || 0) + 1
        )
      } else if (tieneDer || tieneIzq) {
        pesadosParcialPorLista.set(
          rom.listaFaenaId,
          (pesadosParcialPorLista.get(rom.listaFaenaId) || 0) + 1
        )
      }
    }

    const result = listas.map(lista => {
      const totalGarrones = lista.asignaciones.length
      const completados = completadosPorLista.get(lista.id) || 0
      const pesadosParcial = pesadosParcialPorLista.get(lista.id) || 0
      const pendientes = totalGarrones - completados - pesadosParcial
      const porcentaje = totalGarrones > 0 ? Math.round((completados / totalGarrones) * 100) : 0

      // Obtener tropas unicas
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
        pesadosParcial,
        pendientes: Math.max(0, pendientes),
        porcentaje,
        tropas
      }
    })

    const listasConPendientes = result.filter(l => l.pendientes > 0).length

    log.info('Listas pendientes consultadas', { total: result.length, conPendientes: listasConPendientes, dias })

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