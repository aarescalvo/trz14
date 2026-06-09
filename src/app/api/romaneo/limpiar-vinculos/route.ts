import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createLogger } from '@/lib/logger'
const log = createLogger('app.api.romaneo.limpiar-vinculos')

// POST - Limpiar romaneos que fueron incorrectamente vinculados a listas
// Un romaneo está incorrectamente vinculado si su (garron, tropaCodigo) no coincide
// con ninguna asignacion de la lista a la que apunta su listaFaenaId
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { listaFaenaId } = body

    if (!listaFaenaId) {
      return NextResponse.json({ success: false, error: 'listaFaenaId requerido' }, { status: 400 })
    }

    log.info('=== INICIO LIMPIEZA DE VINCULOS ===')
    log.info('Lista a verificar: %s', listaFaenaId)

    // 1. Obtener las asignaciones validas de esta lista
    const asignaciones = await db.asignacionGarron.findMany({
      where: { listaFaenaId },
      select: { garron: true, tropaCodigo: true }
    })

    // Construir set de claves validas
    const clavesValidas = new Set<string>()
    for (const a of asignaciones) {
      clavesValidas.add(`${a.garron}|${a.tropaCodigo || ''}`)
    }

    log.info('Asignaciones validas', { total: asignaciones.length, claves: [...clavesValidas].join(', ') })

    // 2. Buscar todos los romaneos vinculados a esta lista
    const romaneosDeLista = await db.romaneo.findMany({
      where: { listaFaenaId },
      select: { id: true, garron: true, tropaCodigo: true, pesoMediaDer: true, pesoMediaIzq: true }
    })

    log.info('Romaneos con listaFaenaId', { listaFaenaId, total: romaneosDeLista.length })

    let desvinculados = 0
    const detalles: Array<{ id: string; garron: number; tropa: string | null; razon: string }> = []

    // 3. Para cada romaneo, verificar si coincide con una asignacion
    for (const r of romaneosDeLista) {
      const key = `${r.garron}|${r.tropaCodigo || ''}`
      if (!clavesValidas.has(key)) {
        // Este romaneo NO corresponde a esta lista - desvincular
        log.warn('DESCARTADO: romaneo no coincide con asignaciones', {
          romaneoId: r.id, garron: r.garron, tropa: r.tropaCodigo
        })

        await db.romaneo.update({
          where: { id: r.id },
          data: { listaFaenaId: null }
        })
        desvinculados++
        detalles.push({
          id: r.id,
          garron: r.garron,
          tropa: r.tropaCodigo,
          razon: `garron ${r.garron} + tropa ${r.tropaCodigo || '(vacia)'} no pertenece a esta lista`
        })
      }
    }

    log.info('=== FIN LIMPIEZA ===', { desvinculados })

    return NextResponse.json({
      success: true,
      listaFaenaId,
      totalRomaneos: romaneosDeLista.length,
      desvinculados,
      detalles
    })

  } catch (error) {
    log.error('Error en limpieza:', error)
    return NextResponse.json(
      { success: false, error: 'Error al limpiar vinculos' },
      { status: 500 }
    )
  }
}