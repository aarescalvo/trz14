import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Especie, TipoAnimal, EstadoPesaje, TipoPesajeCamion } from '@prisma/client'

// V4 - Updated: Transactions, corral stock, capacity warning, DTE validation

// Función para generar código de tropa
import { checkPermission, getOperadorId } from '@/lib/auth-helpers'
import { createLogger } from '@/lib/logger'
import { auditCreate, auditUpdate, extractAuditInfo } from '@/lib/audit-middleware'
const log = createLogger('app.api.pesaje-camion.route')
async function generarCodigoTropa(especie: Especie): Promise<{ codigo: string; numero: number }> {
  const year = new Date().getFullYear()
  const letra = especie === 'BOVINO' ? 'B' : especie === 'EQUINO' ? 'E' : 'O'
  
  const tropas = await db.tropa.findMany({
    where: {
      codigo: {
        startsWith: `${letra} ${year}`
      }
    },
    orderBy: { numero: 'desc' }
  })
  
  const nextNumero = tropas.length > 0 ? (tropas[0].numero || 0) + 1 : 1
  const secuencial = String(nextNumero).padStart(4, '0')
  
  return {
    codigo: `${letra} ${year} ${secuencial}`,
    numero: nextNumero
  }
}

// GET - Fetch pesajes or next tropa code
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedePesajeCamiones')
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  
  // Get next tropa code preview
  if (action === 'nextTropaCode') {
    const especie = (searchParams.get('especie') || 'BOVINO') as Especie
    const { codigo, numero } = await generarCodigoTropa(especie)
    return NextResponse.json({
      success: true,
      data: { codigo, numero }
    })
  }
  
  try {
    const pesajes = await db.pesajeCamion.findMany({
      include: {
        transportista: true,
        tropa: {
          include: {
            productor: true,
            usuarioFaena: true,
            tiposAnimales: true,
            corral: true
          }
        },
        operador: true
      },
      orderBy: {
        fecha: 'desc'
      }
    })
    
    const lastPesaje = await db.pesajeCamion.findFirst({
      orderBy: { numeroTicket: 'desc' }
    })
    const nextTicketNumber = (lastPesaje?.numeroTicket || 0) + 1
    
    // Mapear al formato que espera el frontend
    const formatted = pesajes.map(p => ({
      id: p.id,
      tipo: p.tipo,
      numeroTicket: p.numeroTicket,
      fecha: p.fecha,
      patenteChasis: p.patenteChasis,
      patenteAcoplado: p.patenteAcoplado,
      chofer: p.choferNombre,
      dniChofer: p.choferDni,
      transportista: p.transportista,
      destino: p.destino,
      remito: p.remito,
      pesoBruto: p.pesoBruto,
      pesoTara: p.pesoTara,
      pesoNeto: p.pesoNeto,
      descripcion: p.observaciones,
      estado: p.estado,
      operador: p.operador,
      tropa: p.tropa ? {
        id: p.tropa.id,
        codigo: p.tropa.codigo,
        productor: p.tropa.productor,
        usuarioFaena: p.tropa.usuarioFaena,
        especie: p.tropa.especie,
        cantidadCabezas: p.tropa.cantidadCabezas,
        corral: p.tropa.corral?.nombre || null,
        dte: p.tropa.dte,
        guia: p.tropa.guia,
        tiposAnimales: p.tropa.tiposAnimales,
        observaciones: p.tropa.observaciones
      } : null
    }))
    
    return NextResponse.json({
      success: true,
      data: formatted,
      nextTicketNumber
    })
  } catch (error) {
    console.error('Error fetching pesajes:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener pesajes' },
      { status: 500 }
    )
  }
}

// POST - Create new pesaje (with transactions, stock update, capacity check, DTE validation)
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedePesajeCamiones')
  if (authError) return authError

  try {
    const body = await request.json()
    log.info('[POST pesaje-camion] === INICIANDO CREACIÓN DE PESAJE v4 ===')
    log.info(`'[POST pesaje-camion] Body:' JSON.stringify(body, null, 2)`)
    
    const {
      tipo,
      patenteChasis,
      patenteAcoplado,
      chofer,
      dniChofer,
      transportistaId,
      dte,
      guia,
      productorId,
      usuarioFaenaId,
      especie,
      tiposAnimales,
      cantidadCabezas,
      corralId,
      pesoBruto,
      pesoTara,
      pesoNeto,
      observaciones,
      destino,
      remito,
      descripcion,
      operadorId,
      forzarCapacidad, // Permite sobrepasar capacidad del corral
      fecha // Permite post-datado (simulación)
    } = body
    
    // Fecha personalizada o actual
    const fechaRegistro = fecha ? new Date(fecha) : new Date()
    
    // Obtener último número de ticket
    const lastPesaje = await db.pesajeCamion.findFirst({
      orderBy: { numeroTicket: 'desc' }
    })
    const numeroTicket = (lastPesaje?.numeroTicket || 0) + 1
    
    // Determinar estado
    const estado: EstadoPesaje = pesoBruto && pesoTara ? 'CERRADO' : 'ABIERTO'
    
    // === VALIDACIÓN DE CLAVES FORÁNEAS ===
    log.info('[POST pesaje-camion] === VALIDANDO FKs ===')
    
    // Validate operadorId if provided
    let validOperadorId: string | undefined = undefined
    if (operadorId) {
      const operadorExists = await db.operador.findUnique({
        where: { id: operadorId }
      })
      if (operadorExists) {
        validOperadorId = operadorId
      } else {
        log.info(`'[POST pesaje-camion] operadorId no válido, ignorando:' operadorId`)
      }
    }
    
    // Validate transportistaId if provided
    let validTransportistaId: string | undefined = undefined
    if (transportistaId) {
      const transportistaExists = await db.transportista.findUnique({
        where: { id: transportistaId }
      })
      if (transportistaExists) {
        validTransportistaId = transportistaId
      } else {
        log.info(`'[POST pesaje-camion] transportistaId no válido, ignorando:' transportistaId`)
      }
    }
    
    // Crear pesaje - NO pasar IDs de FKs inválidos
    const pesajeData: any = {
      tipo: (tipo || 'INGRESO_HACIENDA') as TipoPesajeCamion,
      numeroTicket,
      patenteChasis: patenteChasis || '',
      patenteAcoplado: patenteAcoplado || null,
      choferNombre: chofer || null,
      choferDni: dniChofer || null,
      destino: destino || null,
      remito: remito || null,
      pesoBruto: pesoBruto ? parseFloat(pesoBruto) : null,
      pesoTara: pesoTara ? parseFloat(pesoTara) : null,
      pesoNeto: pesoNeto ? parseFloat(pesoNeto) : null,
      observaciones: observaciones || descripcion || null,
      estado,
      fecha: fechaRegistro,
      fechaTara: pesoTara ? fechaRegistro : null
    }
    
    if (validTransportistaId) pesajeData.transportistaId = validTransportistaId
    if (validOperadorId) pesajeData.operadorId = validOperadorId
    
    // Si es ingreso de hacienda, crear todo dentro de una transacción
    if (tipo === 'INGRESO_HACIENDA') {
      // Verificar que tenemos los datos mínimos para crear la tropa
      if (!usuarioFaenaId) {
        // Crear solo el pesaje sin tropa
        const pesaje = await db.pesajeCamion.create({
          data: pesajeData,
          include: { transportista: true, operador: true }
        })
        return NextResponse.json({
          success: true,
          data: {
            ...pesaje,
            chofer: pesaje.choferNombre,
            dniChofer: pesaje.choferDni,
            descripcion: pesaje.observaciones,
            tropa: null
          }
        })
      }
      
      // Validate usuarioFaenaId exists
      const usuarioFaenaExists = await db.cliente.findUnique({
        where: { id: usuarioFaenaId }
      })
      if (!usuarioFaenaExists) {
        return NextResponse.json({
          success: false,
          error: 'Usuario de faena no válido'
        }, { status: 400 })
      }
      
      // Validate productorId if provided
      let validProductorId: string | undefined = undefined
      if (productorId) {
        const productorExists = await db.cliente.findUnique({
          where: { id: productorId }
        })
        if (productorExists) validProductorId = productorId
      }
      
      // Validate corralId and check capacity
      let validCorralId: string | undefined = undefined
      let advertenciaCapacidad: string | null = null
      
      if (corralId) {
        const corralExists = await db.corral.findUnique({
          where: { id: corralId }
        })
        if (corralExists) {
          validCorralId = corralId
          
          // Verificar capacidad del corral (advertencia, no bloqueante)
          const cantidadIngresar = parseInt(cantidadCabezas) || 0
          const especieEnum = (especie || 'BOVINO') as Especie
          const stockActual = especieEnum === 'BOVINO' ? corralExists.stockBovinos : corralExists.stockEquinos
          const disponible = corralExists.capacidad - stockActual
          
          if (disponible < cantidadIngresar && !forzarCapacidad) {
            // Retornar advertencia para que el frontend consulte al usuario
            return NextResponse.json({
              success: false,
              requiresConfirmation: true,
              error: `Capacidad insuficiente en corral "${corralExists.nombre}". Disponible: ${disponible}, Se requieren: ${cantidadIngresar}. ¿Desea continuar de todas formas?`,
              capacidadInfo: {
                corral: corralExists.nombre,
                capacidad: corralExists.capacidad,
                stockActual,
                disponible,
                cantidadIngresar
              }
            }, { status: 409 }) // 409 Conflict = needs user decision
          }
          
          if (disponible < cantidadIngresar && forzarCapacidad) {
            advertenciaCapacidad = `ATENCIÓN: Se excedió la capacidad del corral "${corralExists.nombre}". Capacidad: ${corralExists.capacidad}, Stock actual: ${stockActual}, Ingresando: ${cantidadIngresar}`
            log.warn(`[POST pesaje-camion] ${advertenciaCapacidad}`)
          }
        }
      }
      
      // === VALIDAR DTE/GUÍA DUPLICADOS ===
      if (dte && dte.trim()) {
        const dteExistente = await db.tropa.findFirst({
          where: { dte: dte.trim() }
        })
        if (dteExistente) {
          return NextResponse.json({
            success: false,
            error: `Ya existe una tropa con DTE "${dte.trim()}" (Tropa: ${dteExistente.codigo}). No se pueden duplicar documentos SENASA.`
          }, { status: 400 })
        }
      }
      
      if (guia && guia.trim()) {
        const guiaExistente = await db.tropa.findFirst({
          where: { guia: guia.trim() }
        })
        if (guiaExistente) {
          return NextResponse.json({
            success: false,
            error: `Ya existe una tropa con Guía "${guia.trim()}" (Tropa: ${guiaExistente.codigo}). No se pueden duplicar documentos SENASA.`
          }, { status: 400 })
        }
      }
      
      const especieEnum = (especie || 'BOVINO') as Especie
      const { codigo, numero } = await generarCodigoTropa(especieEnum)
      
      // Preparar datos de tropa
      const tropaData: any = {
        numero,
        codigo,
        usuarioFaenaId,
        especie: especieEnum,
        cantidadCabezas: parseInt(cantidadCabezas) || 0,
        dte: dte || '',
        guia: guia || '',
        pesajeCamionId: undefined, // Se asigna después dentro de la tx
        estado: 'RECIBIDO'
      }
      
      if (validProductorId) tropaData.productorId = validProductorId
      if (validCorralId) tropaData.corralId = validCorralId
      if (pesoBruto) tropaData.pesoBruto = parseFloat(pesoBruto)
      if (pesoTara) tropaData.pesoTara = parseFloat(pesoTara)
      if (pesoNeto) tropaData.pesoNeto = parseFloat(pesoNeto)
      if (observaciones) tropaData.observaciones = observaciones
      if (validOperadorId) tropaData.operadorId = validOperadorId
      
      // Preparar datos de animales individuales
      const totalAnimales = parseInt(cantidadCabezas) || 0
      const codigoBase = codigo.replace(/ /g, '')
      
      interface TipoAnimalItem { tipoAnimal: string; cantidad: number }
      const tiposDistribucion: TipoAnimalItem[] = (tiposAnimales && Array.isArray(tiposAnimales)) 
        ? tiposAnimales.filter((t: TipoAnimalItem) => t.cantidad > 0)
        : []
      
      const animalesData: { tropaId: string; numero: number; codigo: string; tipoAnimal: TipoAnimal; estado: string; corralId?: string }[] = []
      
      let animalNumero = 1
      for (const tipoInfo of tiposDistribucion) {
        const cantidadTipo = parseInt(String(tipoInfo.cantidad)) || 0
        for (let i = 0; i < cantidadTipo; i++) {
          animalesData.push({
            tropaId: '', // Se asigna dentro de la tx
            numero: animalNumero,
            codigo: `${codigoBase}-${String(animalNumero).padStart(3, '0')}`,
            tipoAnimal: tipoInfo.tipoAnimal as TipoAnimal,
            estado: 'RECIBIDO',
            ...(validCorralId ? { corralId: validCorralId } : {})
          })
          animalNumero++
        }
      }
      
      // Si no había tipos definidos pero sí cantidad total, crear animales genéricos
      if (tiposDistribucion.length === 0 && totalAnimales > 0) {
        for (let i = 1; i <= totalAnimales; i++) {
          animalesData.push({
            tropaId: '',
            numero: i,
            codigo: `${codigoBase}-${String(i).padStart(3, '0')}`,
            tipoAnimal: 'VA' as TipoAnimal,
            estado: 'RECIBIDO',
            ...(validCorralId ? { corralId: validCorralId } : {})
          })
        }
      }
      
      // Preparar tiposAnimales para crear
      const tiposAnimalesData = (tiposAnimales && Array.isArray(tiposAnimales))
        ? tiposAnimales.filter((t: TipoAnimalItem) => t.tipoAnimal && t.cantidad > 0)
            .map((t: TipoAnimalItem) => ({
              tipoAnimal: t.tipoAnimal as TipoAnimal,
              cantidad: parseInt(String(t.cantidad)) || 0
            }))
        : []
      
      log.info('[POST pesaje-camion] === EJECUTANDO EN TRANSACCIÓN ===')
      
      const result = await db.$transaction(async (tx) => {
        // 1. Crear pesaje
        const pesaje = await tx.pesajeCamion.create({
          data: pesajeData,
          include: { transportista: true, operador: true }
        })
        
        // 2. Crear tropa vinculada al pesaje
        tropaData.pesajeCamionId = pesaje.id
        const tropa = await tx.tropa.create({
          data: tropaData,
          include: {
            productor: true,
            usuarioFaena: true,
            tiposAnimales: true,
            corral: true
          }
        })
        
        // 3. Crear tipos de animales
        for (const tipoData of tiposAnimalesData) {
          await tx.tropaAnimalCantidad.create({
            data: {
              tropaId: tropa.id,
              tipoAnimal: tipoData.tipoAnimal,
              cantidad: tipoData.cantidad
            }
          })
        }
        
        // 4. Crear animales individuales
        let animalesCreados = 0
        for (const animalData of animalesData) {
          await tx.animal.create({
            data: {
              tropaId: tropa.id,
              numero: animalData.numero,
              codigo: animalData.codigo,
              tipoAnimal: animalData.tipoAnimal,
              estado: 'RECIBIDO' as const,
              corralId: animalData.corralId || null
            }
          })
          animalesCreados++
        }
        
        // 5. Actualizar stock del corral si se asignó uno
        if (validCorralId && animalesCreados > 0) {
          const stockField = especieEnum === 'BOVINO' ? 'stockBovinos' : 'stockEquinos'
          await tx.corral.update({
            where: { id: validCorralId },
            data: {
              [stockField]: { increment: animalesCreados }
            }
          })
        }
        
        // 6. Crear registro de movimiento de corral
        if (validCorralId && animalesCreados > 0) {
          await tx.movimientoCorral.create({
            data: {
              corralDestinoId: validCorralId,
              cantidad: animalesCreados,
              especie: especieEnum,
              tropaId: tropa.id,
              observaciones: `Ingreso de hacienda - Tropa ${tropa.codigo}`,
              operadorId: validOperadorId || null
            }
          })
        }
        
        // 7. Re-fetch tropa completa
        const tropaCompleta = await tx.tropa.findUnique({
          where: { id: tropa.id },
          include: {
            productor: true,
            usuarioFaena: true,
            tiposAnimales: true,
            corral: true,
            animales: {
              select: { id: true, numero: true, codigo: true, tipoAnimal: true, estado: true }
            }
          }
        })
        
        return { pesaje, tropaCompleta, animalesCreados }
      })
      
      log.info(`[POST pesaje-camion] ✅ Transacción completada: ${result.animalesCreados} animales creados`)
      
      const response: any = {
        success: true,
        data: {
          ...result.pesaje,
          chofer: result.pesaje.choferNombre,
          dniChofer: result.pesaje.choferDni,
          descripcion: result.pesaje.observaciones,
          animalesCreados: result.animalesCreados,
          tropa: result.tropaCompleta ? {
            id: result.tropaCompleta.id,
            codigo: result.tropaCompleta.codigo,
            productor: result.tropaCompleta.productor,
            usuarioFaena: result.tropaCompleta.usuarioFaena,
            especie: result.tropaCompleta.especie,
            cantidadCabezas: result.tropaCompleta.cantidadCabezas,
            corral: result.tropaCompleta.corral?.nombre || null,
            corralId: result.tropaCompleta.corralId,
            dte: result.tropaCompleta.dte,
            guia: result.tropaCompleta.guia,
            tiposAnimales: result.tropaCompleta.tiposAnimales,
            animales: result.tropaCompleta.animales,
            observaciones: result.tropaCompleta.observaciones
          } : null
        }
      }
      
      if (advertenciaCapacidad) {
        response.advertencia = advertenciaCapacidad
      }

      // Auditoría: registro de pesaje con tropa
      const { ip: auditIp } = extractAuditInfo(request)
      auditCreate({
        operadorId: getOperadorId(request) || undefined,
        modulo: 'PESAJE_CAMION',
        entidad: 'PesajeCamion',
        entidadId: result.pesaje.id,
        entidadNombre: `Ticket #${result.pesaje.numeroTicket}`,
        datos: { tipo, patenteChasis, pesoBruto, pesoTara, pesoNeto, tropaCodigo: result.tropaCompleta?.codigo, cantidadCabezas },
        descripcion: `Pesaje de camión - Ticket #${result.pesaje.numeroTicket} - ${tipo} - Patente: ${patenteChasis || 'N/A'}${result.tropaCompleta ? ` - Tropa: ${result.tropaCompleta.codigo} (${result.animalesCreados} animales)` : ''}`,
        ip: auditIp
      }).catch(() => {})

      return NextResponse.json(response)
    }
    
    // Tipo distinto de INGRESO_HACIENDA — solo crear pesaje
    const pesaje = await db.pesajeCamion.create({
      data: pesajeData,
      include: { transportista: true, operador: true }
    })

    // Auditoría: registro de pesaje simple
    const { ip: auditIpSimple } = extractAuditInfo(request)
    auditCreate({
      operadorId: getOperadorId(request) || undefined,
      modulo: 'PESAJE_CAMION',
      entidad: 'PesajeCamion',
      entidadId: pesaje.id,
      entidadNombre: `Ticket #${pesaje.numeroTicket}`,
      datos: { tipo, patenteChasis, pesoBruto, pesoTara, pesoNeto, estado: pesaje.estado },
      descripcion: `Pesaje de camión - Ticket #${pesaje.numeroTicket} - ${tipo || 'PESAJE_SIMPLE'} - Patente: ${patenteChasis || 'N/A'}`,
      ip: auditIpSimple
    }).catch(() => {})
    
    return NextResponse.json({
      success: true,
      data: {
        ...pesaje,
        chofer: pesaje.choferNombre,
        dniChofer: pesaje.choferDni,
        descripcion: pesaje.observaciones
      }
    })
  } catch (error) {
    console.error('Error creating pesaje:', error)
    return NextResponse.json(
      { success: false, error: 'Error al crear pesaje: ' + String(error) },
      { status: 500 }
    )
  }
}

// PUT - Update pesaje (add tara or edit fields)
export async function PUT(request: NextRequest) {
  const authError = await checkPermission(request, 'puedePesajeCamiones')
  if (authError) return authError

  try {
    const body = await request.json()
    const { id, accion, ...fields } = body

    // Modo edición general (desde historial)
    if (accion === 'editar') {
      const {
        patenteChasis, patenteAcoplado, choferNombre, choferDni,
        pesoBruto, pesoTara, pesoNeto, observaciones,
        destino, remito, transportistaId
      } = fields

      // Construir data dinámicamente con solo los campos proporcionados
      const updateData: any = {}
      if (patenteChasis !== undefined) updateData.patenteChasis = patenteChasis.toUpperCase()
      if (patenteAcoplado !== undefined) updateData.patenteAcoplado = patenteAcoplado?.toUpperCase() || null
      if (choferNombre !== undefined) updateData.choferNombre = choferNombre || null
      if (choferDni !== undefined) updateData.choferDni = choferDni || null
      if (pesoBruto !== undefined) updateData.pesoBruto = pesoBruto ? parseFloat(pesoBruto) : null
      if (pesoTara !== undefined) updateData.pesoTara = pesoTara ? parseFloat(pesoTara) : null
      if (pesoNeto !== undefined) updateData.pesoNeto = pesoNeto ? parseFloat(pesoNeto) : null
      if (observaciones !== undefined) updateData.observaciones = observaciones || null
      if (destino !== undefined) updateData.destino = destino || null
      if (remito !== undefined) updateData.remito = remito || null
      if (transportistaId !== undefined) updateData.transportistaId = transportistaId || null

      const result = await db.$transaction(async (tx) => {
        const pesaje = await tx.pesajeCamion.update({
          where: { id },
          data: updateData,
          include: {
            transportista: true,
            operador: true,
            tropa: {
              include: {
                productor: true,
                usuarioFaena: true,
                tiposAnimales: true,
                corral: true
              }
            }
          }
        })

        // Actualizar pesos en tropa vinculada si se modificaron
        if (pesaje.tropa && (pesoBruto !== undefined || pesoTara !== undefined || pesoNeto !== undefined)) {
          const tropaData: any = {}
          if (pesoBruto !== undefined) tropaData.pesoBruto = pesoBruto ? parseFloat(pesoBruto) : null
          if (pesoTara !== undefined) tropaData.pesoTara = pesoTara ? parseFloat(pesoTara) : null
          if (pesoNeto !== undefined) tropaData.pesoNeto = pesoNeto ? parseFloat(pesoNeto) : null
          await tx.tropa.update({
            where: { id: pesaje.tropa.id },
            data: tropaData
          })
        }

        return pesaje
      })

      // Auditoría: edición de pesaje
      const { ip: auditIpEdit } = extractAuditInfo(request)
      auditUpdate({
        operadorId: getOperadorId(request) || undefined,
        modulo: 'PESAJE_CAMION',
        entidad: 'PesajeCamion',
        entidadId: result.id,
        entidadNombre: `Ticket #${result.numeroTicket}`,
        datosAntes: {},
        datosDespues: updateData,
        descripcion: `Pesaje editado - Ticket #${result.numeroTicket} - Patente: ${result.patenteChasis || 'N/A'}`,
        ip: auditIpEdit
      }).catch(() => {})

      return NextResponse.json({
        success: true,
        data: {
          ...result,
          chofer: result.choferNombre,
          dniChofer: result.choferDni,
          descripcion: result.observaciones,
          tropa: result.tropa ? {
            id: result.tropa.id,
            codigo: result.tropa.codigo,
            productor: result.tropa.productor,
            usuarioFaena: result.tropa.usuarioFaena,
            especie: result.tropa.especie,
            cantidadCabezas: result.tropa.cantidadCabezas,
            corral: result.tropa.corral?.nombre || null,
            tiposAnimales: result.tropa.tiposAnimales,
            observaciones: result.tropa.observaciones
          } : null
        }
      })
    }

    // Modo original: registrar tara (cerrar pesaje)
    const { pesoTara, pesoNeto } = body
    
    const result = await db.$transaction(async (tx) => {
      const pesaje = await tx.pesajeCamion.update({
        where: { id },
        data: {
          pesoTara: parseFloat(pesoTara),
          pesoNeto: parseFloat(pesoNeto),
          estado: 'CERRADO',
          fechaTara: new Date()
        },
        include: {
          transportista: true,
          operador: true,
          tropa: {
            include: {
              productor: true,
              usuarioFaena: true,
              tiposAnimales: true,
              corral: true
            }
          }
        }
      })
      
      // Actualizar tropa si existe
      if (pesaje.tropa) {
        await tx.tropa.update({
          where: { id: pesaje.tropa.id },
          data: {
            pesoTara: parseFloat(pesoTara),
            pesoNeto: parseFloat(pesoNeto),
            estado: 'EN_CORRAL'
          }
        })
      }
      
      return pesaje
    })

    // Auditoría: registro de tara
    const { ip: auditIpUpdate } = extractAuditInfo(request)
    auditUpdate({
      operadorId: getOperadorId(request) || undefined,
      modulo: 'PESAJE_CAMION',
      entidad: 'PesajeCamion',
      entidadId: result.id,
      entidadNombre: `Ticket #${result.numeroTicket}`,
      datosAntes: { pesoTara: result.fechaTara ? null : 'pending', estado: 'ABIERTO' },
      datosDespues: { pesoTara: parseFloat(pesoTara), pesoNeto: parseFloat(pesoNeto), estado: 'CERRADO' },
      descripcion: `Tara registrada - Ticket #${result.numeroTicket} - Tara: ${pesoTara} kg - Neto: ${pesoNeto} kg - Patente: ${result.patenteChasis || 'N/A'}`,
      ip: auditIpUpdate
    }).catch(() => {})
    
    return NextResponse.json({
      success: true,
      data: {
        ...result,
        chofer: result.choferNombre,
        dniChofer: result.choferDni,
        descripcion: result.observaciones,
        tropa: result.tropa ? {
          id: result.tropa.id,
          codigo: result.tropa.codigo,
          productor: result.tropa.productor,
          usuarioFaena: result.tropa.usuarioFaena,
          especie: result.tropa.especie,
          cantidadCabezas: result.tropa.cantidadCabezas,
          corral: result.tropa.corral?.nombre || null,
          tiposAnimales: result.tropa.tiposAnimales,
          observaciones: result.tropa.observaciones
        } : null
      }
    })
  } catch (error) {
    console.error('Error updating pesaje:', error)
    return NextResponse.json(
      { success: false, error: 'Error al actualizar pesaje' },
      { status: 500 }
    )
  }
}
