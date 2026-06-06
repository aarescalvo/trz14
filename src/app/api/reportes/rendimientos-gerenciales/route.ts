import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'
import { createLogger } from '@/lib/logger'

const logger = createLogger('API:ReportesRendimientos')

// GET - Reporte de Rendimientos Gerenciales
export async function GET(request: NextRequest) {
  try {
    const authError = await checkPermission(request, 'puedeReportes')
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')
    const especie = searchParams.get('especie') || 'todas'

    const hoy = new Date()
    const fechaInicio = fechaDesde
      ? new Date(fechaDesde + 'T00:00:00')
      : new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const fechaFin = fechaHasta
      ? new Date(fechaHasta + 'T23:59:59')
      : new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59)

    // Obtener romaneos confirmados con datos de tropa
    const romaneos = await db.romaneo.findMany({
      where: {
        fecha: { gte: fechaInicio, lte: fechaFin },
        estado: { in: ['CONFIRMADO', 'PENDIENTE'] },
        pesoTotal: { gt: 0 },
        pesoVivo: { gt: 0 },
      },
      orderBy: { fecha: 'asc' },
    })

    // Obtener tropas para asociar productor y especie
    const tropaCodigos = [...new Set(romaneos.map(r => r.tropaCodigo).filter((c): c is string => !!c))]
    const tropas = await db.tropa.findMany({
      where: { codigo: { in: tropaCodigos } },
      include: {
        productor: { select: { nombre: true } },
      },
    })

    const tropaMap = new Map(tropas.map(t => [t.codigo, t]))

    // Agrupar por tropa
    const tropasData = new Map<string, {
      tropaCodigo: string
      productor: string
      cabezas: number
      kgVivo: number
      kgCanal: number
      rinde: number
      fecha: string
      especie: string
    }>()

    for (const r of romaneos) {
      const cod = r.tropaCodigo || `Sin-Tropa-${r.id}`
      if (!tropasData.has(cod)) {
        const tropa = tropaMap.get(r.tropaCodigo || '')
        tropasData.set(cod, {
          tropaCodigo: cod,
          productor: tropa?.productor?.nombre || 'Sin productor',
          cabezas: 0,
          kgVivo: 0,
          kgCanal: 0,
          rinde: 0,
          fecha: r.fecha.toISOString().split('T')[0],
          especie: tropa?.especie || 'BOVINO',
        })
      }

      const entry = tropasData.get(cod)!
      entry.cabezas++
      entry.kgVivo += r.pesoVivo || 0
      entry.kgCanal += r.pesoTotal || 0
    }

    // Calcular rinde por tropa y filtrar por especie
    let detalles = Array.from(tropasData.values()).map(d => ({
      ...d,
      rinde: d.kgVivo > 0 ? (d.kgCanal / d.kgVivo) * 100 : 0,
    }))

    if (especie !== 'todas') {
      detalles = detalles.filter(d => d.especie === especie)
    }

    // Calcular totales
    const totalCabezas = detalles.reduce((sum, d) => sum + d.cabezas, 0)
    const rindePromedio = detalles.length > 0
      ? detalles.reduce((sum, d) => sum + d.rinde, 0) / detalles.length
      : 0
    const mejorTropa = detalles.length > 0
      ? detalles.reduce((best, d) => d.rinde > best.rinde ? d : best, detalles[0])
      : null
    const peorTropa = detalles.length > 0
      ? detalles.reduce((worst, d) => d.rinde < worst.rinde ? d : worst, detalles[0])
      : null

    return NextResponse.json({
      success: true,
      data: {
        detalles,
        resumen: {
          totalTropas: detalles.length,
          totalCabezas,
          rindePromedio: Math.round(rindePromedio * 100) / 100,
          mejorTropa: mejorTropa ? {
            tropaCodigo: mejorTropa.tropaCodigo,
            productor: mejorTropa.productor,
            rinde: Math.round(mejorTropa.rinde * 100) / 100,
          } : null,
          peorTropa: peorTropa ? {
            tropaCodigo: peorTropa.tropaCodigo,
            productor: peorTropa.productor,
            rinde: Math.round(peorTropa.rinde * 100) / 100,
          } : null,
        },
      },
    })
  } catch (error) {
    logger.error('Error en reporte de rendimientos', error)
    return NextResponse.json(
      { success: false, error: 'Error al generar reporte de rendimientos' },
      { status: 500 }
    )
  }
}
