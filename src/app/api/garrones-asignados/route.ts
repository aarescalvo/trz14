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
    const whereClause: any = {}
    
    // Si se pasa listaId, filtrar por esa lista (sin filtro de fecha)
    if (listaId) {
      whereClause.listaFaenaId = listaId
    } else {
      // Si no hay listaId, filtrar por fecha
      whereClause.horaIngreso = {
        gte: fechaFiltro,
        lt: new Date(fechaFiltro.getTime() + 24 * 60 * 60 * 1000)
      }
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
    // Incluir datos de romaneos existentes si los hay
    const garronesNums = asignaciones.map(a => a.garron as number)
    const listaIdRef = listaId || asignaciones[0]?.listaFaenaId

    // Para garrones sin romaneo vinculado, hacer linking por garron + tropa
    // Esto es para romaneos viejos creados antes de que exista listaFaenaId
    if (listaIdRef && garronesNums.length > 0) {
      const garronesSinRomaneo: number[] = []
      
      // Verificar cuales garrones ya tienen romaneo vinculado a esta lista
      const romaneosVinculados = await db.romaneo.findMany({
        where: {
          listaFaenaId: listaIdRef,
          garron: { in: garronesNums }
        },
        select: { garron: true }
      })
      const garronesConRomaneo = new Set(romaneosVinculados.map(r => r.garron as number))
      
      for (const a of asignaciones) {
        const gn = a.garron as number
        if (!garronesConRomaneo.has(gn) && a.tropaCodigo) {
          garronesSinRomaneo.push(gn)
        }
      }
      
      // Para cada garron faltante, buscar romaneo sin listaFaenaId que coincida en tropa
      if (garronesSinRomaneo.length > 0) {
        // Obtener las tropas de los garrones faltantes
        const tropaPorGarron = new Map<number, string>()
        for (const a of asignaciones) {
          const gn = a.garron as number
          if (garronesSinRomaneo.includes(gn) && a.tropaCodigo) {
            tropaPorGarron.set(gn, a.tropaCodigo)
          }
        }
        
        // Buscar romaneos candidatos: garron SIN listaFaenaId + tropa que coincida
        // Agrupar por (garron, tropa) para buscar en batch
        const paresGarronTropa = Array.from(tropaPorGarron.entries())
        const tropasUnicas = [...new Set(paresGarronTropa.map(([, t]) => t))]
        
        const romaneosCandidatos = await db.romaneo.findMany({
          where: {
            garron: { in: garronesSinRomaneo },
            listaFaenaId: null,
            tropaCodigo: { in: tropasUnicas }
          },
          include: {
            mediasRes: { select: { lado: true, peso: true } }
          },
          orderBy: { createdAt: 'desc' }
        })
        
        // Vincular los que coinciden en garron + tropa Y tienen MediaRes
        for (const rc of romaneosCandidatos) {
          const tropaEsperada = tropaPorGarron.get(rc.garron as number)
          if (tropaEsperada !== rc.tropaCodigo) continue
          if (rc.mediasRes.length === 0) continue
          
          // Verificar que este garron no tenga YA un romaneo vinculado (por si acaso)
          const yaVinculado = await db.romaneo.findFirst({
            where: { listaFaenaId: listaIdRef, garron: rc.garron }
          })
          if (yaVinculado) continue
          
          // Vincular y actualizar flags de la asignación
          await db.romaneo.update({
            where: { id: rc.id },
            data: { listaFaenaId: listaIdRef }
          })
          
          // Actualizar pesos en el romaneo si tiene ambas medias
          const mediaDer = rc.mediasRes.find(m => m.lado === 'DERECHA')
          const mediaIzq = rc.mediasRes.find(m => m.lado === 'IZQUIERDA')
          if (mediaDer && mediaIzq) {
            const pesoTotal = mediaDer.peso + mediaIzq.peso
            const asignacion = asignaciones.find(a => a.garron === rc.garron)
            const pesoVivo = asignacion?.pesoVivo || asignacion?.animal?.pesoVivo || asignacion?.animal?.pesajeIndividual?.peso || null
            await db.romaneo.update({
              where: { id: rc.id },
              data: {
                pesoMediaDer: mediaDer.peso,
                pesoMediaIzq: mediaIzq.peso,
                pesoTotal,
                rinde: pesoVivo ? (pesoTotal / pesoVivo) * 100 : null
              }
            })
          }
        }
      }
    }

    // Ahora buscar todos los romaneos vinculados (incluidos los recién vinculados)
    let romaneosExistentes: Array<{
      garron: number; pesoMediaDer: number | null; pesoMediaIzq: number | null;
      pesoTotal: number | null; rinde: number | null; estado: string;
      denticion: string | null; id: string; tropaCodigo: string | null;
    }> = []
    if (garronesNums.length > 0) {
      const whereRomaneo: any = { garron: { in: garronesNums } }
      if (listaIdRef) {
        whereRomaneo.listaFaenaId = listaIdRef
      }
      romaneosExistentes = await db.romaneo.findMany({
        where: whereRomaneo,
        select: {
          garron: true,
          pesoMediaDer: true,
          pesoMediaIzq: true,
          pesoTotal: true,
          rinde: true,
          estado: true,
          denticion: true,
          id: true,
          tropaCodigo: true,
        },
      })
    }

    // Buscar MediaRes para los romaneos encontrados
    const romaneoIds = romaneosExistentes.map(r => r.id)
    const mediaResPesoByGarron = new Map<number, { der: number | null; izq: number | null; romaneoId: string | null }>()

    if (romaneoIds.length > 0) {
      const mediasRes = await db.mediaRes.findMany({
        where: { romaneoId: { in: romaneoIds } },
        select: { romaneoId: true, lado: true, peso: true }
      })
      const romaneoIdToGarron = new Map<string, number>()
      for (const r of romaneosExistentes) {
        romaneoIdToGarron.set(r.id, r.garron as number)
      }
      for (const m of mediasRes) {
        const gn = romaneoIdToGarron.get(m.romaneoId)
        if (gn === undefined) continue
        const existing = mediaResPesoByGarron.get(gn) || { der: null, izq: null, romaneoId: m.romaneoId }
        if (m.lado === 'DERECHA') existing.der = m.peso
        else if (m.lado === 'IZQUIERDA') existing.izq = m.peso
        mediaResPesoByGarron.set(gn, existing)
      }
    }

    // Fallback: para garrones que aún no tienen datos de KG,
    // buscar CUALQUIER romaneo que coincida en garron + tropa (sin filtrar listaFaenaId)
    // y traer sus MediaRes. Esto cubre romaneos vinculados a otra lista incorrectamente.
    if (garronesNums.length > 0) {
      const garronesSinDatos = garronesNums.filter(g => {
        const datos = mediaResPesoByGarron.get(g)
        return !datos?.der && !datos?.izq
      })

      if (garronesSinDatos.length > 0) {
        // Obtener tropas esperadas para estos garrones
        const tropaPorGarron = new Map<number, string>()
        for (const a of asignaciones) {
          const gn = a.garron as number
          if (garronesSinDatos.includes(gn) && a.tropaCodigo) {
            tropaPorGarron.set(gn, a.tropaCodigo)
          }
        }
        const tropasUnicas = [...new Set(tropaPorGarron.values())]

        // Buscar romaneos por garron + tropa SIN filtro de listaFaenaId
        const romaneosExtras = await db.romaneo.findMany({
          where: {
            garron: { in: garronesSinDatos },
            tropaCodigo: { in: tropasUnicas }
          },
          select: { id: true, garron: true, tropaCodigo: true, listaFaenaId: true },
        })

        // Filtrar los que coinciden en garron + tropa
        const romaneoIdsExtras = romaneosExtras
          .filter(r => {
            const tropaEsperada = tropaPorGarron.get(r.garron as number)
            return tropaEsperada === r.tropaCodigo
          })
          .map(r => r.id)

        if (romaneoIdsExtras.length > 0) {
          const mediasExtras = await db.mediaRes.findMany({
            where: { romaneoId: { in: romaneoIdsExtras } },
            select: { romaneoId: true, lado: true, peso: true }
          })
          
          const romIdToGarron = new Map<string, number>()
          for (const r of romaneosExtras) {
            romIdToGarron.set(r.id, r.garron as number)
          }
          
          for (const m of mediasExtras) {
            const gn = romIdToGarron.get(m.romaneoId)
            if (gn === undefined) continue
            const existing = mediaResPesoByGarron.get(gn) || { der: null, izq: null, romaneoId: m.romaneoId }
            if (m.lado === 'DERECHA' && !existing.der) existing.der = m.peso
            else if (m.lado === 'IZQUIERDA' && !existing.izq) existing.izq = m.peso
            existing.romaneoId = existing.romaneoId || m.romaneoId
            mediaResPesoByGarron.set(gn, existing)
          }
        }
      }
    }

    // Indexar romaneos por garron para datos complementarios (rinde, denticion, etc.)
    const romaneoByGarron = new Map<number, typeof romaneosExistentes[0]>()
    for (const r of romaneosExistentes) {
      romaneoByGarron.set(r.garron as number, r)
    }

    const data = asignaciones.map(a => {
      const romaneo = romaneoByGarron.get(a.garron as number)
      const mediaResPesos = mediaResPesoByGarron.get(a.garron as number)
      return {
        garron: a.garron,
        animalId: a.animalId,
        animalCodigo: a.animal?.codigo || null,
        tropaCodigo: a.tropaCodigo || a.animal?.tropa?.codigo || romaneo?.tropaCodigo || null,
        tipoAnimal: a.tipoAnimal || a.animal?.tipoAnimal?.toString() || null,
        pesoVivo: a.pesoVivo || a.animal?.pesoVivo || a.animal?.pesajeIndividual?.peso || null,
        tieneMediaDer: a.tieneMediaDer || !!romaneo?.pesoMediaDer || !!mediaResPesos?.der,
        tieneMediaIzq: a.tieneMediaIzq || !!romaneo?.pesoMediaIzq || !!mediaResPesos?.izq,
        completado: a.completado || !!(romaneo?.pesoMediaDer && romaneo?.pesoMediaIzq) || !!(mediaResPesos?.der && mediaResPesos?.izq),
        // Datos del romaneo existente (priorizar romaneo, fallback a MediaRes)
        pesoMediaDer: romaneo?.pesoMediaDer ?? mediaResPesos?.der ?? null,
        pesoMediaIzq: romaneo?.pesoMediaIzq ?? mediaResPesos?.izq ?? null,
        pesoTotal: romaneo?.pesoTotal ?? (
          mediaResPesos?.der && mediaResPesos?.izq ? mediaResPesos.der + mediaResPesos.izq : null
        ),
        rinde: romaneo?.rinde ?? null,
        romaneoId: romaneo?.id ?? mediaResPesos?.romaneoId ?? null,
        romaneoEstado: romaneo?.estado ?? null,
        romaneoDenticion: romaneo?.denticion ?? null,
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
