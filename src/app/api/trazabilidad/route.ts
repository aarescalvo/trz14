import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { EstadoMediaRes } from '@prisma/client'
import { checkPermission } from '@/lib/auth-helpers'

// Tipos para la respuesta de trazabilidad
interface TrazabilidadIngreso {
  dte: string
  guia: string
  productor: string | null
  usuarioFaena: string
  fechaRecepcion: Date
  especie: string
  cantidadCabezas: number
}

interface TrazabilidadPesajeCamion {
  pesoBruto: number | null
  pesoTara: number | null
  pesoNeto: number | null
  patenteChasis: string
  patenteAcoplado: string | null
  transportista: string | null
  fecha: Date | null
}

interface TrazabilidadPesajeIndividual {
  animales: Array<{
    numero: number
    codigo: string
    tipoAnimal: string
    raza: string | null
    pesoVivo: number | null
    caravana: string | null
    fecha: Date | null
  }>
  totalAnimales: number
  pesoTotal: number | null
}

interface TrazabilidadListaFaena {
  numero: number
  fecha: Date
  estado: string
  cantidadTotal: number
  tropas: Array<{
    codigo: string
    cantidad: number
    corral: string | null
  }>
}

interface TrazabilidadGarrones {
  asignaciones: Array<{
    garron: number
    animalNumero: number | null
    tipoAnimal: string | null
    pesoVivo: number | null
    horaIngreso: Date
    completado: boolean
  }>
  totalGarrones: number
}

interface TrazabilidadRomaneo {
  romaneos: Array<{
    garron: number
    pesoMediaIzq: number | null
    pesoMediaDer: number | null
    pesoTotal: number | null
    rinde: number | null
    denticion: string | null
    tipificador: string | null
    estado: string
    fecha: Date
  }>
  totalRomaneos: number
  pesoTotalMedias: number | null
  rindePromedio: number | null
}

interface TrazabilidadUbicacionCamara {
  medias: Array<{
    codigo: string
    lado: string
    sigla: string
    peso: number
    camara: string | null
    estado: string
  }>
  totalMedias: number
}

interface TrazabilidadDespacho {
  facturas: Array<{
    numero: string
    cliente: string
    fecha: Date
    total: number
    estado: string
    remito: string | null
  }>
  mediasDespachadas: number
}

interface TrazabilidadResponse {
  tropa: {
    id: string
    codigo: string
    numero: number
    especie: string
    estado: string
  }
  ingreso: TrazabilidadIngreso
  pesajeCamion: TrazabilidadPesajeCamion | null
  pesajeIndividual: TrazabilidadPesajeIndividual | null
  listaFaena: TrazabilidadListaFaena | null
  garrones: TrazabilidadGarrones | null
  romaneo: TrazabilidadRomaneo | null
  ubicacionCamara: TrazabilidadUbicacionCamara | null
  despacho: TrazabilidadDespacho | null
  timeline: Array<{
    paso: string
    completado: boolean
    fecha: Date | null
    datos: string
  }>
}

export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeStock')
  if (authError) return authError
  try {
    const searchParams = request.nextUrl.searchParams
    
    // Parámetros de búsqueda
    const tropa = searchParams.get('tropa')
    const garron = searchParams.get('garron')
    const codigoBarras = searchParams.get('codigoBarras')
    const cliente = searchParams.get('cliente')
    const productor = searchParams.get('productor')
    
    // Variable para almacenar la tropa encontrada
    let tropaEncontrada: Record<string, unknown> | null = null
    
    // Buscar por diferentes criterios
    if (tropa) {
      // Buscar por número o código de tropa
      tropaEncontrada = await db.tropa.findFirst({
        where: {
          OR: [
            { codigo: { contains: tropa.toUpperCase() } },
            { codigoSimplificado: { contains: tropa.toUpperCase() } },
            { numero: parseInt(tropa) || 0 }
          ]
        },
        include: {
          productor: true,
          usuarioFaena: true,
          corral: true,
          pesajeCamion: {
            include: {
              transportista: true
            }
          },
          animales: {
            include: {
              pesajeIndividual: true,
              asignacionGarron: true
            }
          }
        }
      })
    } else if (garron) {
      // Buscar por número de garrón
      const asignacion = await db.asignacionGarron.findFirst({
        where: {
          garron: parseInt(garron) || 0
        },
        include: {
          animal: {
            include: {
              tropa: {
                include: {
                  productor: true,
                  usuarioFaena: true,
                  corral: true,
                  pesajeCamion: {
                    include: {
                      transportista: true
                    }
                  }
                }
              },
              pesajeIndividual: true
            }
          }
        }
      })
      
      if (asignacion?.animal?.tropa) {
        const tropaId = (asignacion.animal.tropa as { id: string }).id
        tropaEncontrada = await db.tropa.findUnique({
          where: { id: tropaId },
          include: {
            productor: true,
            usuarioFaena: true,
            corral: true,
            pesajeCamion: {
              include: {
                transportista: true
              }
            },
            animales: {
              include: {
                pesajeIndividual: true,
                asignacionGarron: true
              }
            }
          }
        })
      }
    } else if (codigoBarras) {
      // Buscar por código de barras (media res)
       
      const mediaRes = await db.mediaRes.findFirst({
        where: {
          codigo: { contains: codigoBarras }
        },
        include: {
          romaneo: {
            include: {
              tipificador: true,
               
              listaFaena: {
                include: {
                   
                  tropas: { include: { tropa: { select: { id: true } } } } as any
                }
              } as any
            },
          } as any,
        }
      })
      
      // Obtener la tropa del romaneo
       
      const romaneoData = mediaRes?.romaneo as any
      const tropaId = romaneoData?.listaFaena?.tropas?.[0]?.tropa?.id
      if (tropaId) {
        tropaEncontrada = await db.tropa.findUnique({
          where: { id: tropaId },
          include: {
            productor: true,
            usuarioFaena: true,
            corral: true,
            pesajeCamion: {
              include: {
                transportista: true
              }
            },
            animales: {
              include: {
                pesajeIndividual: true,
                asignacionGarron: true
              }
            }
          }
        })
      }
    } else if (cliente) {
      // Buscar por cliente (usuario faena)
      tropaEncontrada = await db.tropa.findFirst({
        where: {
          OR: [
            { usuarioFaena: { nombre: { contains: cliente } } },
            { usuarioFaena: { cuit: { contains: cliente } } }
          ]
        },
        include: {
          productor: true,
          usuarioFaena: true,
          corral: true,
          pesajeCamion: {
            include: {
              transportista: true
            }
          },
          animales: {
            include: {
              pesajeIndividual: true,
              asignacionGarron: true
            }
          }
        },
        orderBy: { fechaRecepcion: 'desc' }
      })
    } else if (productor) {
      // Buscar por productor
      tropaEncontrada = await db.tropa.findFirst({
        where: {
          OR: [
            { productor: { nombre: { contains: productor } } },
            { productor: { cuit: { contains: productor } } }
          ]
        },
        include: {
          productor: true,
          usuarioFaena: true,
          corral: true,
          pesajeCamion: {
            include: {
              transportista: true
            }
          },
          animales: {
            include: {
              pesajeIndividual: true,
              asignacionGarron: true
            }
          }
        },
        orderBy: { fechaRecepcion: 'desc' }
      })
    }
    
    if (!tropaEncontrada) {
      return NextResponse.json({
        success: false,
        error: 'No se encontraron resultados para la búsqueda'
      }, { status: 404 })
    }
    
    // Construir respuesta completa de trazabilidad
    const response = await construirTrazabilidad(tropaEncontrada)
    
    return NextResponse.json({
      success: true,
      data: response
    })
    
  } catch (error) {
    console.error('Error en trazabilidad:', error)
    return NextResponse.json({
      success: false,
      error: 'Error al procesar la búsqueda de trazabilidad'
    }, { status: 500 })
  }
}

async function construirTrazabilidad(tropa: Record<string, unknown>): Promise<TrazabilidadResponse> {
  const tropaData = tropa as {
    id: string
    codigo: string
    numero: number
    especie: string
    estado: string
    dte: string
    guia: string
    fechaRecepcion: Date
    cantidadCabezas: number
    productor: { nombre: string } | null
    usuarioFaena: { nombre: string }
    corral: { nombre: string } | null
    pesajeCamion: {
      pesoBruto: number | null
      pesoTara: number | null
      pesoNeto: number | null
      patenteChasis: string
      patenteAcoplado: string | null
      transportistaId: string | null
      transportista: { nombre: string } | null
      fecha: Date | null
    } | null
    animales: Array<{
      numero: number
      codigo: string
      tipoAnimal: string
      raza: string | null
      pesoVivo: number | null
      caravana: string | null
      pesajeIndividual: {
        peso: number
        fecha: Date
      } | null
      asignacionGarron: {
        garron: number
        horaIngreso: Date
        completado: boolean
      } | null
    }>
  }
  
  // 1. Datos de Ingreso
  const ingreso: TrazabilidadIngreso = {
    dte: tropaData.dte,
    guia: tropaData.guia,
    productor: tropaData.productor?.nombre || null,
    usuarioFaena: tropaData.usuarioFaena?.nombre || 'Sin asignar',
    fechaRecepcion: tropaData.fechaRecepcion,
    especie: tropaData.especie,
    cantidadCabezas: tropaData.cantidadCabezas
  }
  
  // 2. Pesaje Camión
  let pesajeCamion: TrazabilidadPesajeCamion | null = null
  if (tropaData.pesajeCamion) {
    pesajeCamion = {
      pesoBruto: tropaData.pesajeCamion.pesoBruto,
      pesoTara: tropaData.pesajeCamion.pesoTara,
      pesoNeto: tropaData.pesajeCamion.pesoNeto,
      patenteChasis: tropaData.pesajeCamion.patenteChasis,
      patenteAcoplado: tropaData.pesajeCamion.patenteAcoplado,
      transportista: tropaData.pesajeCamion.transportista?.nombre || null,
      fecha: tropaData.pesajeCamion.fecha
    }
  }
  
  // 3. Pesaje Individual
  let pesajeIndividual: TrazabilidadPesajeIndividual | null = null
  const animalesPesados = tropaData.animales.filter(a => a.pesajeIndividual)
  if (animalesPesados.length > 0) {
    const pesoTotal = animalesPesados.reduce((sum, a) => sum + (a.pesajeIndividual?.peso || 0), 0)
    pesajeIndividual = {
      animales: animalesPesados.map(a => ({
        numero: a.numero,
        codigo: a.codigo,
        tipoAnimal: a.tipoAnimal,
        raza: a.raza,
        pesoVivo: a.pesajeIndividual?.peso || null,
        caravana: a.caravana,
        fecha: a.pesajeIndividual?.fecha || null
      })),
      totalAnimales: animalesPesados.length,
      pesoTotal: pesoTotal > 0 ? pesoTotal : null
    }
  }
  
  // 4. Lista de Faena
  let listaFaena: any = null
  const listaFaenaTropas = await db.listaFaenaTropa.findMany({
    where: { tropaId: tropaData.id },
    include: {
      //  true,
      corral: true
    }
  })
  
  if (listaFaenaTropas.length > 0) {
    const lfTropa = listaFaenaTropas[0]
    const lf = (await db.listaFaena.findUnique({
      where: { id: lfTropa.listaFaenaId },
      include: { tropas: true }
    }))!
    listaFaena = {
      numero: lf.numero,
      fecha: lf.fecha,
      estado: lf.estado,
      cantidadTotal: lf.cantidadTotal,
      tropas: listaFaenaTropas.map(lft => ({
        codigo: tropaData.codigo,
        cantidad: lft.cantidad,
        corral: lft.corral?.nombre || null
      }))
    }
  }
  
  // 5. Asignación de Garrones
  let garrones: TrazabilidadGarrones | null = null
  const asignaciones = await db.asignacionGarron.findMany({
    where: {
      OR: [
        { tropaCodigo: tropaData.codigo },
        { animal: { tropaId: tropaData.id } }
      ]
    },
    orderBy: { garron: 'asc' }
  })
  
  if (asignaciones.length > 0) {
    garrones = {
      asignaciones: asignaciones.map(a => ({
        garron: a.garron,
        animalNumero: a.animalNumero,
        tipoAnimal: a.tipoAnimal,
        pesoVivo: a.pesoVivo,
        horaIngreso: a.horaIngreso,
        completado: a.completado
      })),
      totalGarrones: asignaciones.length
    }
  }
  
  // 6. Romaneo
  let romaneo: TrazabilidadRomaneo | null = null
  const romaneos = await db.romaneo.findMany({
    where: {
      OR: [
        { tropaCodigo: tropaData.codigo },
        { garron: { in: asignaciones.map(a => a.garron) } }
      ]
    },
    include: {
      tipificador: true
    },
    orderBy: { garron: 'asc' }
  })
  
  if (romaneos.length > 0) {
    const pesoTotal = romaneos.reduce((sum, r) => sum + (r.pesoTotal || 0), 0)
    const rindes = romaneos.filter(r => r.rinde !== null).map(r => r.rinde as number)
    const rindePromedio = rindes.length > 0 ? rindes.reduce((a, b) => a + b, 0) / rindes.length : null
    
    romaneo = {
      romaneos: romaneos.map(r => ({
        garron: r.garron,
        pesoMediaIzq: r.pesoMediaIzq,
        pesoMediaDer: r.pesoMediaDer,
        pesoTotal: r.pesoTotal,
        rinde: (r.pesoVivo && r.pesoVivo > 0 && r.pesoTotal && r.pesoTotal > 0)
          ? Math.round((r.pesoTotal / r.pesoVivo) * 10000) / 100
          : r.rinde,
        denticion: r.denticion,
        tipificador: r.tipificador?.nombre || null,
        estado: r.estado,
        fecha: r.fecha
      })),
      totalRomaneos: romaneos.length,
      pesoTotalMedias: pesoTotal > 0 ? pesoTotal : null,
      rindePromedio
    }
  }
  
  // 7. Ubicación en Cámara
  let ubicacionCamara: TrazabilidadUbicacionCamara | null = null
  const mediasRes = await db.mediaRes.findMany({
    where: {
      romaneo: {
        tropaCodigo: tropaData.codigo
      }
    },
    include: {
      camara: true,
      romaneo: true
    }
  })
  
  if (mediasRes.length > 0) {
    ubicacionCamara = {
      medias: mediasRes.map(m => ({
        codigo: m.codigo,
        lado: m.lado,
        sigla: m.sigla,
        peso: m.peso,
        camara: m.camara?.nombre || null,
        estado: m.estado
      })),
      totalMedias: mediasRes.length
    }
  }
  
  // 8. Despacho
  let despacho: TrazabilidadDespacho | null = null
  const facturas = await db.factura.findMany({
    where: {
      detalles: {
        some: {
          tropaCodigo: tropaData.codigo
        }
      }
    },
    include: {
      cliente: true
    },
    orderBy: { fecha: 'desc' }
  })
  
  if (facturas.length > 0) {
    // Contar medias despachadas
    const mediasDespachadas = await db.mediaRes.count({
      where: {
        romaneo: { tropaCodigo: tropaData.codigo },
        estado: EstadoMediaRes.DESPACHADO
      }
    })
    
    despacho = {
      facturas: facturas.map(f => ({
        numero: f.numero,
        cliente: f.cliente.nombre,
        fecha: f.fecha,
        total: f.total,
        estado: f.estado,
        remito: f.remito
      })),
      mediasDespachadas
    }
  }
  
  // Construir timeline
  const timeline = [
    {
      paso: 'INGRESO',
      completado: true,
      fecha: tropaData.fechaRecepcion,
      datos: `DTE: ${tropaData.dte} | Guía: ${tropaData.guia}`
    },
    {
      paso: 'PESAJE_CAMION',
      completado: pesajeCamion !== null,
      fecha: pesajeCamion?.fecha || null,
      datos: pesajeCamion ? `${pesajeCamion.pesoNeto?.toFixed(0) || '-'} kg neto` : 'Pendiente'
    },
    {
      paso: 'PESAJE_IND',
      completado: pesajeIndividual !== null && pesajeIndividual.totalAnimales > 0,
      fecha: pesajeIndividual?.animales[0]?.fecha || null,
      datos: pesajeIndividual ? `${pesajeIndividual.totalAnimales} animales pesados` : 'Pendiente'
    },
    {
      paso: 'FAENA',
      completado: listaFaena !== null,
      fecha: listaFaena?.fecha || null,
      datos: listaFaena ? `Lista #${listaFaena.numero} - ${listaFaena.cantidadTotal} animales` : 'Pendiente'
    },
    {
      paso: 'ROMANEO',
      completado: romaneo !== null && romaneo.totalRomaneos > 0,
      fecha: romaneo?.romaneos[0]?.fecha || null,
      datos: romaneo ? `${romaneo.totalRomaneos} romaneos | Rinde: ${romaneo.rindePromedio?.toFixed(1) || '-'}%` : 'Pendiente'
    },
    {
      paso: 'CAMARA',
      completado: ubicacionCamara !== null && ubicacionCamara.totalMedias > 0,
      fecha: null,
      datos: ubicacionCamara ? `${ubicacionCamara.totalMedias} medias en cámara` : 'Pendiente'
    },
    {
      paso: 'DESPACHO',
      completado: despacho !== null && despacho.mediasDespachadas > 0,
      fecha: despacho?.facturas[0]?.fecha || null,
      datos: despacho ? `${despacho.mediasDespachadas} medias despachadas` : 'Pendiente'
    }
  ]
  
  return {
    tropa: {
      id: tropaData.id,
      codigo: tropaData.codigo,
      numero: tropaData.numero,
      especie: tropaData.especie,
      estado: tropaData.estado
    },
    ingreso,
    pesajeCamion,
    pesajeIndividual,
    listaFaena,
    garrones,
    romaneo,
    ubicacionCamara,
    despacho,
    timeline
  }
}
