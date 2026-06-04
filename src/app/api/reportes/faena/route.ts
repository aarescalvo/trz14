import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// GET - Reporte de Faena Diaria
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeReportes')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const fecha = searchParams.get('fecha') || new Date().toISOString().split('T')[0]
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')

    // Construir filtro de fechas
    const fechaInicio = fechaDesde ? new Date(fechaDesde) : new Date(fecha + 'T00:00:00')
    const fechaFin = fechaHasta ? new Date(fechaHasta + 'T23:59:59') : new Date(fecha + 'T23:59:59')

    // Obtener romaneos del período
    const romaneos = await db.romaneo.findMany({
      where: {
        fecha: {
          gte: fechaInicio,
          lte: fechaFin
        }
      },
      include: {
        tipificador: { select: { nombre: true, apellido: true, matricula: true } },
        mediasRes: {
          include: {
            camara: { select: { nombre: true } }
          }
        }
      },
      orderBy: { garron: 'asc' }
    })

    // Obtener lista de faena
    const listaFaena = await db.listaFaena.findFirst({
      where: {
        fecha: {
          gte: fechaInicio,
          lte: fechaFin
        }
      },
      include: {
        tropas: {
          include: {
            tropa: {
              include: {
                productor: { select: { nombre: true } },
                usuarioFaena: { select: { nombre: true } }
              }
            }
          }
        },
        asignaciones: {
          include: {
            animal: {
              include: {
                tropa: {
                  include: {
                    productor: { select: { nombre: true } },
                    usuarioFaena: { select: { nombre: true } }
                  }
                }
              }
            }
          }
        }
      }
    })

    // Calcular estadísticas
    const totalAnimales = romaneos.length
    const totalPesoVivo = romaneos.reduce((acc, r) => acc + (r.pesoVivo || 0), 0)
    const totalPesoCanal = romaneos.reduce((acc, r) => acc + (r.pesoTotal || 0), 0)
    const promedioRinde = totalPesoVivo > 0 
      ? ((totalPesoCanal / totalPesoVivo) * 100).toFixed(2) 
      : '0'

    // Agrupar por tropa
    const porTropa: Record<string, { cantidad: number; pesoVivo: number; pesoCanal: number; productor?: string; usuarioFaena?: string }> = {}

    // Agrupar por tipo de animal
    const porTipoAnimal: Record<string, number> = {}

    romaneos.forEach(r => {
      // Por tropa
      const tropaCodigo = r.tropaCodigo || 'Sin tropa'
      if (!porTropa[tropaCodigo]) {
        porTropa[tropaCodigo] = { cantidad: 0, pesoVivo: 0, pesoCanal: 0 }
      }
      porTropa[tropaCodigo].cantidad++
      porTropa[tropaCodigo].pesoVivo += r.pesoVivo || 0
      porTropa[tropaCodigo].pesoCanal += r.pesoTotal || 0

      // Por tipo de animal
      const tipo = r.tipoAnimal || 'SIN_TIPO'
      porTipoAnimal[tipo] = (porTipoAnimal[tipo] || 0) + 1
    })

    // Detalle de medias reses
    const medias = romaneos.flatMap(r => r.mediasRes.map(m => ({
      garron: r.garron,
      tropaCodigo: r.tropaCodigo,
      lado: m.lado,
      peso: m.peso,
      sigla: m.sigla,
      camara: m.camara?.nombre
    })))

    // Estadísticas de medias
    const totalMedias = medias.length
    const pesoTotalMedias = medias.reduce((acc, m) => acc + (m.peso || 0), 0)
    const pesoPromedioMedia = totalMedias > 0 ? pesoTotalMedias / totalMedias : 0

    return NextResponse.json({
      success: true,
      data: {
        fecha,
        fechaDesde: fechaDesde || fecha,
        fechaHasta: fechaHasta || fecha,
        resumen: {
          totalAnimales,
          totalPesoVivo,
          totalPesoCanal,
          promedioRinde: parseFloat(promedioRinde),
          totalMedias,
          pesoTotalMedias,
          pesoPromedioMedia
        },
        porTipoAnimal,
        porTropa: Object.entries(porTropa).map(([codigo, datos]) => ({
          tropaCodigo: codigo,
          ...datos
        })),
        romaneos: romaneos.map(r => ({
          garron: r.garron,
          tropaCodigo: r.tropaCodigo,
          numeroAnimal: r.numeroAnimal,
          tipoAnimal: r.tipoAnimal,
          raza: r.raza,
          pesoVivo: r.pesoVivo,
          pesoMediaIzq: r.pesoMediaIzq,
          pesoMediaDer: r.pesoMediaDer,
          pesoTotal: r.pesoTotal,
          rinde: (r.pesoVivo && r.pesoVivo > 0 && r.pesoTotal && r.pesoTotal > 0)
            ? Math.round((r.pesoTotal / r.pesoVivo) * 10000) / 100
            : r.rinde,
          denticion: r.denticion,
          tipificador: r.tipificador ? `${r.tipificador.nombre} ${r.tipificador.apellido}` : null,
          estado: r.estado,
          medias: r.mediasRes.length
        })),
        listaFaena: listaFaena ? {
          id: listaFaena.id,
          fecha: listaFaena.fecha.toISOString(),
          estado: listaFaena.estado,
          cantidadTotal: listaFaena.cantidadTotal,
          tropas: listaFaena.tropas.map(t => ({
            tropaCodigo: t.tropa.codigo,
            cantidad: t.cantidad,
            productor: t.tropa.productor?.nombre,
            usuarioFaena: t.tropa.usuarioFaena?.nombre
          }))
        } : null
      }
    })
  } catch (error) {
    console.error('[Reporte Faena API] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al generar reporte de faena' },
      { status: 500 }
    )
  }
}
