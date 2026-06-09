import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

import { checkPermission } from '@/lib/auth-helpers'
import { generarCodigoMediaRes } from '@/lib/codigo-media-res'
interface AnimalIngreso {
  id: string
  codigo: string
  garron: number
  tipoAnimal: string
  pesoVivo: number | null
  estado: string
  tieneRomaneo: boolean
  enCamara: boolean
  romaneoData: {
    id: string
    pesoMediaIzq: number | null
    pesoMediaDer: number | null
    pesoTotal: number | null
    rinde: number | null
    denticion: string | null
    raza: string | null
  } | null
}

interface TropaIngreso {
  tropaId: string
  tropaCodigo: string
  especie: string
  usuarioFaena: string
  animales: AnimalIngreso[]
}

// GET - Fetch tropas with animals ready for camera ingress
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeIngresoCajon')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo') // 'pendientes' | 'historial'

    if (tipo === 'historial') {
      // Get history of camera ingress
      const historial = await db.mediaRes.findMany({
        where: {
          camaraId: { not: null }
        },
        include: {
          camara: true,
          romaneo: {
            include: {
              tipificador: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      })

      return NextResponse.json({
        success: true,
        data: historial.map(m => ({
          id: m.id,
          codigo: m.codigo,
          lado: m.lado,
          sigla: m.sigla,
          peso: m.peso,
          estado: m.estado,
          camara: m.camara?.nombre,
          garron: m.romaneo.garron,
          tropaCodigo: m.romaneo.tropaCodigo,
          tipoAnimal: m.romaneo.tipoAnimal,
          fecha: m.createdAt
        }))
      })
    }

    // Get all romaneos with weights recorded
    const romaneos = await db.romaneo.findMany({
      where: {
        pesoTotal: { not: null },
        mediasRes: {
          none: {
            camaraId: { not: null }
          }
        }
      },
      include: {
        mediasRes: true
      },
      orderBy: { garron: 'asc' }
    })

    // Get garron assignments for these romaneos
    const garrones = romaneos.map(r => r.garron)

    const asignaciones = await db.asignacionGarron.findMany({
      where: {
        garron: { in: garrones }
      },
      include: {
        animal: {
          include: {
            tropa: {
              include: {
                usuarioFaena: true
              }
            },
            pesajeIndividual: true
          }
        },
        listaFaena: true
      }
    })

    // Group by tropa
    const tropasMap = new Map<string, TropaIngreso>()

    for (const asignacion of asignaciones) {
      const animal = asignacion.animal
      if (!animal) continue
      const tropa = animal.tropa
      if (!tropa) continue
      const romaneo = romaneos.find(r => r.garron === asignacion.garron)

      if (!romaneo) continue

      // Check if already in camera
      const enCamara = romaneo.mediasRes.some((m) => m.camaraId != null)
      if (enCamara) continue

      if (!tropasMap.has(tropa.id)) {
        tropasMap.set(tropa.id, {
          tropaId: tropa.id,
          tropaCodigo: tropa.codigo,
          especie: tropa.especie,
          usuarioFaena: tropa.usuarioFaena?.nombre || 'Sin asignar',
          animales: []
        })
      }

      const tropaData = tropasMap.get(tropa.id)!
      tropaData.animales.push({
        id: animal.id,
        codigo: animal.codigo,
        garron: asignacion.garron,
        tipoAnimal: animal.tipoAnimal,
        pesoVivo: animal.pesoVivo || animal.pesajeIndividual?.peso || romaneo.pesoVivo || null,
        estado: animal.estado,
        tieneRomaneo: true,
        enCamara: false,
        romaneoData: {
          id: romaneo.id,
          pesoMediaIzq: romaneo.pesoMediaIzq,
          pesoMediaDer: romaneo.pesoMediaDer,
          pesoTotal: romaneo.pesoTotal,
          rinde: romaneo.rinde,
          denticion: romaneo.denticion,
          raza: romaneo.raza
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: Array.from(tropasMap.values())
    })
  } catch (error) {
    console.error('Error fetching tropas for ingreso:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener tropas' },
      { status: 500 }
    )
  }
}

// POST - Register camera ingress for an animal
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeIngresoCajon')
  if (authError) return authError

  try {
    const body = await request.json()
    const { romaneoId, camaraId, operadorId, siglas } = body

    if (!romaneoId || !camaraId) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos requeridos' },
        { status: 400 }
      )
    }

    // Get romaneo data
    const romaneo = await db.romaneo.findUnique({
      where: { id: romaneoId },
      include: {
        mediasRes: true
      }
    })

    if (!romaneo) {
      return NextResponse.json(
        { success: false, error: 'Romaneo no encontrado' },
        { status: 404 }
      )
    }

    if (!romaneo.pesoTotal) {
      return NextResponse.json(
        { success: false, error: 'El romaneo no tiene pesos registrados' },
        { status: 400 }
      )
    }

    // Check camera capacity
    const camara = await db.camara.findUnique({
      where: { id: camaraId },
      include: {
        _count: {
          select: { mediasRes: true }
        }
      }
    })

    if (!camara) {
      return NextResponse.json(
        { success: false, error: 'Cámara no encontrada' },
        { status: 404 }
      )
    }

    // Check if camera has enough capacity (2 medias per animal)
    const mediasActuales = camara._count.mediasRes
    const nuevasMedias = 2
    if (mediasActuales + nuevasMedias > camara.capacidad) {
      return NextResponse.json(
        { success: false, error: `La cámara no tiene capacidad suficiente. Disponible: ${camara.capacidad - mediasActuales} ganchos` },
        { status: 400 }
      )
    }

    // Generar códigos unificados para cada media

    const mediasCreadas: Awaited<ReturnType<typeof db.mediaRes.create>>[] = []
    // Track medias reassigned from a different camera (for stock decrement)
    const mediasReasignadas: { camaraIdVieja: string, peso: number }[] = []

    // Media Izquierda
    if (romaneo.pesoMediaIzq) {
      const siglaIzq = siglas?.izquierda || 'A'
      const codigoIzq = generarCodigoMediaRes({
        tropaCodigo: romaneo.tropaCodigo,
        garron: romaneo.garron,
        lado: 'IZQUIERDA'
      })

      // Check if media already exists
      const existingMediaIzq = await db.mediaRes.findFirst({
        where: {
          romaneoId: romaneo.id,
          lado: 'IZQUIERDA'
        }
      })

      let mediaIzq
      if (existingMediaIzq) {
        // If reassigning to a different camera, track old camera for stock decrement
        if (existingMediaIzq.camaraId && existingMediaIzq.camaraId !== camaraId) {
          mediasReasignadas.push({ camaraIdVieja: existingMediaIzq.camaraId, peso: existingMediaIzq.peso })
        }
        mediaIzq = await db.mediaRes.update({
          where: { id: existingMediaIzq.id },
          data: {
            camaraId: camaraId,
            estado: 'EN_CAMARA',
            codigo: codigoIzq,
            sigla: siglaIzq as 'A' | 'T' | 'D'
          }
        })
      } else {
        mediaIzq = await db.mediaRes.create({
          data: {
            romaneoId: romaneo.id,
            lado: 'IZQUIERDA',
            sigla: siglaIzq as 'A' | 'T' | 'D',
            peso: romaneo.pesoMediaIzq,
            codigo: codigoIzq,
            estado: 'EN_CAMARA',
            camaraId: camaraId
          }
        })
      }
      mediasCreadas.push(mediaIzq)
    }

    // Media Derecha
    if (romaneo.pesoMediaDer) {
      const siglaDer = siglas?.derecha || 'A'
      const codigoDer = generarCodigoMediaRes({
        tropaCodigo: romaneo.tropaCodigo,
        garron: romaneo.garron,
        lado: 'DERECHA'
      })

      // Check if media already exists
      const existingMediaDer = await db.mediaRes.findFirst({
        where: {
          romaneoId: romaneo.id,
          lado: 'DERECHA'
        }
      })

      let mediaDer
      if (existingMediaDer) {
        // If reassigning to a different camera, track old camera for stock decrement
        if (existingMediaDer.camaraId && existingMediaDer.camaraId !== camaraId) {
          mediasReasignadas.push({ camaraIdVieja: existingMediaDer.camaraId, peso: existingMediaDer.peso })
        }
        mediaDer = await db.mediaRes.update({
          where: { id: existingMediaDer.id },
          data: {
            camaraId: camaraId,
            estado: 'EN_CAMARA',
            codigo: codigoDer,
            sigla: siglaDer as 'A' | 'T' | 'D'
          }
        })
      } else {
        mediaDer = await db.mediaRes.create({
          data: {
            romaneoId: romaneo.id,
            lado: 'DERECHA',
            sigla: siglaDer as 'A' | 'T' | 'D',
            peso: romaneo.pesoMediaDer,
            codigo: codigoDer,
            estado: 'EN_CAMARA',
            camaraId: camaraId
          }
        })
      }
      mediasCreadas.push(mediaDer)
    }

    // Decrement stock from old cameras for reassigned medias
    const tropaCodigo = romaneo.tropaCodigo || 'SIN-TROPA'
    for (const reasignada of mediasReasignadas) {
      const stockViejo = await db.stockMediaRes.findFirst({
        where: {
          camaraId: reasignada.camaraIdVieja,
          tropaCodigo: tropaCodigo
        }
      })
      if (stockViejo) {
        await db.stockMediaRes.update({
          where: { id: stockViejo.id },
          data: {
            cantidad: { decrement: 1 },
            pesoTotal: { decrement: reasignada.peso }
          }
        })
      }
    }

    // Use actual count of medias created/updated
    const cantidadMedias = mediasCreadas.length
    if (cantidadMedias === 0) {
      return NextResponse.json(
        { success: false, error: 'No se crearon medias (faltan pesos de pesaje)' },
        { status: 400 }
      )
    }

    // Update or create stock for the new camera
    const existingStock = await db.stockMediaRes.findFirst({
      where: {
        camaraId: camaraId,
        tropaCodigo: tropaCodigo
      }
    })

    if (existingStock) {
      await db.stockMediaRes.update({
        where: { id: existingStock.id },
        data: {
          cantidad: { increment: cantidadMedias },
          pesoTotal: { increment: romaneo.pesoTotal || 0 }
        }
      })
    } else {
      await db.stockMediaRes.create({
        data: {
          camaraId: camaraId,
          tropaCodigo: tropaCodigo,
          especie: 'BOVINO',
          cantidad: cantidadMedias,
          pesoTotal: romaneo.pesoTotal || 0
        }
      })
    }

    // Create movement record
    await db.movimientoCamara.create({
      data: {
        camaraDestinoId: camaraId,
        producto: 'Media Res',
        cantidad: cantidadMedias,
        peso: romaneo.pesoTotal,
        tropaCodigo: romaneo.tropaCodigo,
        operadorId: operadorId,
        observaciones: `Ingreso garrón ${romaneo.garron}`
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        medias: mediasCreadas,
        camara: camara.nombre
      }
    })
  } catch (error) {
    console.error('Error registering camera ingress:', error)
    return NextResponse.json(
      { success: false, error: 'Error al registrar ingreso a cámara' },
      { status: 500 }
    )
  }
}
