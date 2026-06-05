import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { EstadoPlanillaServicio } from '@prisma/client'

// GET — Listar planillas para la vista de Visto Bueno
// Filtra por estado (BORRADOR | APROBADO), incluye datos de tropa/romaneo, items extras,
// soporta paginación y búsqueda, y devuelve conteos por estado (KPI badges).
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const estado = (searchParams.get('estado') as EstadoPlanillaServicio) || 'BORRADOR'
    const search = searchParams.get('search') || undefined
    const pagina = searchParams.get('pagina') ? parseInt(searchParams.get('pagina')!) : 1
    const limite = searchParams.get('limite') ? parseInt(searchParams.get('limite')!) : 50

    // Validate estado
    if (!['BORRADOR', 'APROBADO', 'FACTURADO'].includes(estado)) {
      return NextResponse.json(
        { success: false, error: 'Estado inválido. Use BORRADOR, APROBADO o FACTURADO.' },
        { status: 400 },
      )
    }

    // Build where clause
    const where: any = { estado }

    if (search) {
      const term = search.trim().toLowerCase()
      where.OR = [
        { usuario: { contains: term, mode: 'insensitive' as const } },
        { numeroTropa: { equals: !isNaN(Number(term)) ? Number(term) : undefined } },
        { usuarioFaena: { nombre: { contains: term, mode: 'insensitive' as const } } },
        { usuarioFaena: { razonSocial: { contains: term, mode: 'insensitive' as const } } },
      ]
    }

    // Fetch planillas with related data
    const [planillas, total] = await Promise.all([
      db.planillaServicioFaena.findMany({
        where,
        include: {
          tropa: {
            select: {
              id: true,
              numero: true,
              codigo: true,
              estado: true,
              cantidadCabezas: true,
              kgGancho: true,
            },
          },
          usuarioFaena: {
            select: {
              id: true,
              nombre: true,
              razonSocial: true,
              cuit: true,
            },
          },
          itemsExtras: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: [{ numeroTropa: 'desc' }],
        skip: (pagina - 1) * limite,
        take: limite,
      }),
      db.planillaServicioFaena.count({ where }),
    ])

    // For each planilla, enrich with romaneo data from the tropa if available
    // This gives us the "official" kgGancho and rinde from the romaneo process
    const enrichedPlanillas = await Promise.all(
      planillas.map(async (planilla) => {
        let romaneoKgGancho: number | null = null
        let romaneoRinde: number | null = null

        if (planilla.tropa?.codigo) {
          try {
            // Try to find the latest romaneo for this tropa to get official kgGancho and rinde
            const romaneo = await db.romaneo.findFirst({
              where: { tropaCodigo: planilla.tropa.codigo },
              select: {
                pesoTotal: true,
                rinde: true,
              },
              orderBy: { fecha: 'desc' },
            })
            if (romaneo) {
              romaneoKgGancho = romaneo.pesoTotal
              romaneoRinde = romaneo.rinde
            }
          } catch {
            // Silently ignore if romaneo query fails
          }
        }

        // Merge: prefer romaneo data if available, otherwise use planilla data
        const effectiveKgGancho = romaneoKgGancho ?? planilla.kgGancho ?? planilla.tropa?.kgGancho ?? null
        const effectiveRinde = romaneoRinde ?? planilla.rindePorcentaje ?? null

        return {
          ...planilla,
          romaneoKgGancho,
          romaneoRinde,
          effectiveKgGancho,
          effectiveRinde,
        }
      }),
    )

    // Badge counts — total by estado (across ALL planillas, not just filtered)
    const countsPromise = db.planillaServicioFaena.groupBy({
      by: ['estado'],
      _count: { estado: true },
    })

    const [counts] = await Promise.all([countsPromise])

    const countsMap: Record<string, number> = {
      BORRADOR: 0,
      APROBADO: 0,
      FACTURADO: 0,
    }
    for (const c of counts) {
      countsMap[c.estado] = c._count.estado
    }

    return NextResponse.json({
      success: true,
      data: enrichedPlanillas,
      paginacion: {
        pagina,
        limite,
        total,
        totalPaginas: Math.ceil(total / limite),
      },
      counts: countsMap,
    })
  } catch (error: any) {
    console.error('Error GET planilla-servicio-faena/vb:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// POST — Aprobar o Desaprobar planillas (Visto Bueno)
// Body: { ids: string[], action: 'APROBAR' | 'DESAPROBAR' }
// - APROBAR: cambia estado a APROBADO para los ids dados
// - DESAPROBAR: cambia estado a BORRADOR solo si no están FACTURADO
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids, action } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Debe proporcionar un array de IDs no vacío.' },
        { status: 400 },
      )
    }

    if (!['APROBAR', 'DESAPROBAR'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Acción inválida. Use APROBAR o DESAPROBAR.' },
        { status: 400 },
      )
    }

    if (action === 'APROBAR') {
      // Only approve BORRADOR planillas
      const updated = await db.planillaServicioFaena.updateMany({
        where: {
          id: { in: ids },
          estado: 'BORRADOR',
        },
        data: { estado: 'APROBADO' },
      })

      // Fetch and return the updated records
      const records = await db.planillaServicioFaena.findMany({
        where: { id: { in: ids } },
        include: {
          tropa: {
            select: {
              id: true,
              numero: true,
              codigo: true,
              estado: true,
              cantidadCabezas: true,
              kgGancho: true,
            },
          },
          usuarioFaena: {
            select: {
              id: true,
              nombre: true,
              razonSocial: true,
              cuit: true,
            },
          },
          itemsExtras: true,
        },
      })

      return NextResponse.json({
        success: true,
        message: `${updated.count} planilla(s) aprobada(s).`,
        count: updated.count,
        data: records,
      })
    }

    // DESAPROBAR: revert to BORRADOR only if not FACTURADO
    // First check which ones are FACTURADO (cannot be disapproved)
    const facturadas = await db.planillaServicioFaena.findMany({
      where: {
        id: { in: ids },
        estado: 'FACTURADO',
      },
      select: { id: true, numeroTropa: true },
    })

    if (facturadas.length > 0) {
      const numeros = facturadas.map((f) => f.numeroTropa).join(', ')
      return NextResponse.json(
        {
          success: false,
          error: `No se pueden desaprobar las siguientes tropas porque ya están FACTURADO: ${numeros}. Revise primero la factura.`,
        },
        { status: 400 },
      )
    }

    // Update APROBADO → BORRADOR
    const updated = await db.planillaServicioFaena.updateMany({
      where: {
        id: { in: ids },
        estado: 'APROBADO',
      },
      data: { estado: 'BORRADOR' },
    })

    // Fetch and return updated records
    const records = await db.planillaServicioFaena.findMany({
      where: { id: { in: ids } },
      include: {
        tropa: {
          select: {
            id: true,
            numero: true,
            codigo: true,
            estado: true,
            cantidadCabezas: true,
            kgGancho: true,
          },
        },
        usuarioFaena: {
          select: {
            id: true,
            nombre: true,
            razonSocial: true,
            cuit: true,
          },
        },
        itemsExtras: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: `${updated.count} planilla(s) revertida(s) a BORRADOR.`,
      count: updated.count,
      data: records,
    })
  } catch (error: any) {
    console.error('Error POST planilla-servicio-faena/vb:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
