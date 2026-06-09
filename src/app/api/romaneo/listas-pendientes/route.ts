import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'
import { createLogger } from '@/lib/logger'

const log = createLogger('app.api.romaneo.listas-pendientes.route')

// GET - Listas de faena con resumen de estado de romaneo
// Usa flags de AsignacionGarron (tieneMediaDer/izq) que siempre estan vinculados a la lista
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeRomaneo')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const dias = parseInt(searchParams.get('dias') || '90')

    const fechaLimite = new Date()
    fechaLimite.setDate(fechaLimite.getDate() - dias)
    fechaLimite.setHours(0, 0, 0, 0)

    // Obtener listas de faena con asignaciones (flags de pesaje) y tropas
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
            garron: true,
            tieneMediaDer: true,
            tieneMediaIzq: true,
            tropaCodigo: true
          }
        }
      },
      orderBy: { numero: 'desc' }
    })

    // Obtener cantidad de cabezas por lista (animales unicos en las tropas)
    // Las cabezas = cantidad de animales asignados a garrones en la lista
    const listaIds = listas.map(l => l.id)

    // Contar cabezas reales: animales distintos en las tropas de cada lista
    const cabezasPorLista = new Map<string, number>()
    if (listaIds.length > 0) {
      const tropasDeListas = await db.listaFaenaTropa.findMany({
        where: { listaFaenaId: { in: listaIds } },
        select: { listaFaenaId: true, cantidad: true }
      })
      for (const tl of tropasDeListas) {
        cabezasPorLista.set(
          tl.listaFaenaId,
          (cabezasPorLista.get(tl.listaFaenaId) || 0) + (tl.cantidad || 0)
        )
      }
    }

    const result = listas.map(lista => {
      const asignaciones = lista.asignaciones
      const totalGarrones = asignaciones.length

      // Contar usando los flags de AsignacionGarron (siempre vinculados a la lista correcta)
      const completados = asignaciones.filter(a => a.tieneMediaDer && a.tieneMediaIzq).length
      const pesadosParcial = asignaciones.filter(a =>
        (a.tieneMediaDer && !a.tieneMediaIzq) || (!a.tieneMediaDer && a.tieneMediaIzq)
      ).length
      const sinPesar = asignaciones.filter(a => !a.tieneMediaDer && !a.tieneMediaIzq).length
      const pendientes = sinPesar + pesadosParcial
      const porcentaje = totalGarrones > 0 ? Math.round((completados / totalGarrones) * 100) : 0

      // Cabezas de la lista
      const cabezas = cabezasPorLista.get(lista.id) || 0

      // Obtener tropas unicas
      const tropasFromAsignaciones = asignaciones
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
        cabezas,
        completados,
        pesadosParcial,
        sinPesar,
        pendientes,
        porcentaje,
        tropas
      }
    })

    const listasConPendientes = result.filter(l => l.pendientes > 0).length

    log.info('Listas pendientes', { total: result.length, conPendientes: listasConPendientes, dias })

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