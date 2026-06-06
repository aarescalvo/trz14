/**
 * SCRIPT DE SIMULACIÓN COMPLETA DEL SISTEMA FRIGORÍFICO
 * ======================================================
 * 
 * Este script simula el flujo completo de datos desde el ingreso de hacienda
 * hasta la expedición de productos, pasando por todos los módulos intermedios.
 * 
 * Módulos simulados:
 * 1. Pesaje Camiones → Crea tropas y animales
 * 2. Pesaje Individual → Pesaje de cada animal
 * 3. Movimiento de Hacienda → Mueve animales entre corrales
 * 4. Lista de Faena → Asigna animales a garrones
 * 5. Romaneo → Pesaje de medias reses
 * 6. Ingreso a Cajón → Ingreso de medias a cámaras
 * 
 * Ejecutar con: bun run scripts/simular-movimientos.ts
 */

import { PrismaClient, Especie, TipoAnimal, EstadoTropa, EstadoAnimal, EstadoPesaje, TipoPesajeCamion, TipoCamara } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['warn', 'error']
})

// ==================== CONFIGURACIÓN ====================
const SIMULATION_CONFIG = {
  year: new Date().getFullYear(),
  dryRun: false, // Si true, solo muestra qué haría sin ejecutar
  verbose: true, // Mostrar detalles de cada operación
}

// ==================== HELPERS ====================
function log(message: string, data?: any) {
  if (SIMULATION_CONFIG.verbose) {
    console.log(`[${new Date().toISOString()}] ${message}`)
    if (data) console.log(JSON.stringify(data, null, 2))
  }
}

function success(message: string) {
  console.log(`✅ ${message}`)
}

function error(message: string, err?: any) {
  console.error(`❌ ${message}`)
  if (err) console.error(err)
}

function info(message: string) {
  console.log(`ℹ️  ${message}`)
}

function section(title: string) {
  console.log('\n' + '='.repeat(60))
  console.log(`  ${title}`)
  console.log('='.repeat(60))
}

// ==================== DATOS DE PRUEBA ====================
interface DatosPrueba {
  operadorId: string
  transportistaId: string
  productorId: string
  usuarioFaenaId: string
  corralOrigenId: string
  corralDestinoId: string
  camaraFaenaId: string
  camaraCuarteoId: string
  tipificadorId: string
}

async function obtenerDatosPrueba(): Promise<DatosPrueba> {
  const operador = await prisma.operador.findFirst({ where: { rol: 'ADMINISTRADOR' } })
  const transportista = await prisma.transportista.findFirst()
  const productor = await prisma.cliente.findFirst({ where: { esProductor: true } })
  const usuarioFaena = await prisma.cliente.findFirst({ where: { esUsuarioFaena: true } })
  const corrales = await prisma.corral.findMany({ take: 2 })
  const camaras = await prisma.camara.findMany()
  const tipificador = await prisma.tipificador.findFirst()

  if (!operador || !productor || !usuarioFaena || !tipificador) {
    throw new Error('Faltan datos de prueba. Ejecutar primero: bun run db:seed')
  }

  return {
    operadorId: operador.id,
    transportistaId: transportista?.id || '',
    productorId: productor.id,
    usuarioFaenaId: usuarioFaena.id,
    corralOrigenId: corrales[0]?.id || '',
    corralDestinoId: corrales[1]?.id || '',
    camaraFaenaId: camaras.find(c => c.tipo === 'FAENA')?.id || camaras[0]?.id || '',
    camaraCuarteoId: camaras.find(c => c.tipo === 'CUARTEO')?.id || camaras[1]?.id || '',
    tipificadorId: tipificador.id
  }
}

// ==================== 1. PESAJE CAMIONES ====================
async function simularPesajeCamiones(datos: DatosPrueba): Promise<{ tropaId: string; pesajeId: string }> {
  section('1. PESAJE DE CAMIONES - Ingreso de Hacienda')

  // Generar código de tropa
  const letra = 'B'
  const codigo = `${letra} ${SIMULATION_CONFIG.year} SIMU`

  // Buscar último número
  const ultimaTropa = await prisma.tropa.findFirst({
    where: { codigo: { startsWith: `${letra} ${SIMULATION_CONFIG.year}` } },
    orderBy: { numero: 'desc' }
  })
  const numero = (ultimaTropa?.numero || 0) + 1
  const codigoCompleto = `${letra} ${SIMULATION_CONFIG.year} ${String(numero).padStart(4, '0')}`

  log(`Creando tropa: ${codigoCompleto}`)

  // Crear pesaje de camión
  const ultimoTicket = await prisma.pesajeCamion.findFirst({
    orderBy: { numeroTicket: 'desc' }
  })
  const ultimoTicketNum = ultimoTicket ? parseInt(String(ultimoTicket.numeroTicket).replace(/\D/g, ''), 10) : 0
  const numeroTicket = String((isNaN(ultimoTicketNum) ? 0 : ultimoTicketNum) + 1)

  const pesaje = await prisma.pesajeCamion.create({
    data: {
      tipo: TipoPesajeCamion.INGRESO_HACIENDA,
      numeroTicket,
      patenteChasis: 'AB123CD',
      patenteAcoplado: 'EF456GH',
      choferNombre: 'Chofer de Prueba',
      choferDni: '12345678',
      transportistaId: datos.transportistaId || null,
      pesoBruto: 12000,
      pesoTara: 8000,
      pesoNeto: 4000,
      estado: EstadoPesaje.CERRADO,
      operadorId: datos.operadorId
    }
  })
  log(`Pesaje creado: Ticket #${numeroTicket}`)

  // Crear tropa
  const tropa = await prisma.tropa.create({
    data: {
      numero,
      codigo: codigoCompleto,
      productorId: datos.productorId,
      usuarioFaenaId: datos.usuarioFaenaId,
      especie: Especie.BOVINO,
      dte: `DTE-SIM-${numero}`,
      guia: `GUIA-SIM-${numero}`,
      cantidadCabezas: 10,
      corralId: datos.corralOrigenId,
      estado: EstadoTropa.EN_CORRAL,
      pesoBruto: 12000,
      pesoTara: 8000,
      pesoNeto: 4000,
      pesajeCamionId: pesaje.id,
      operadorId: datos.operadorId
    }
  })
  log(`Tropa creada: ${tropa.codigo}`)

  // Crear tipos de animales
  await prisma.tropaAnimalCantidad.createMany({
    data: [
      { tropaId: tropa.id, tipoAnimal: 'NO', cantidad: 5 },
      { tropaId: tropa.id, tipoAnimal: 'VA', cantidad: 5 }
    ]
  })

  // Crear animales individuales
  const codigoBase = codigoCompleto.replace(/ /g, '')
  const tiposAnimales: { tipo: TipoAnimal; peso: number }[] = [
    { tipo: 'NO', peso: 485 }, { tipo: 'NO', peso: 510 }, { tipo: 'NO', peso: 495 },
    { tipo: 'NO', peso: 520 }, { tipo: 'NO', peso: 478 },
    { tipo: 'VA', peso: 420 }, { tipo: 'VA', peso: 435 }, { tipo: 'VA', peso: 410 },
    { tipo: 'VA', peso: 445 }, { tipo: 'VA', peso: 428 }
  ]

  let pesoTotal = 0
  for (let i = 0; i < tiposAnimales.length; i++) {
    const a = tiposAnimales[i]
    const animalCodigo = `${codigoBase}-${String(i + 1).padStart(3, '0')}`
    
    await prisma.animal.create({
      data: {
        tropaId: tropa.id,
        numero: i + 1,
        codigo: animalCodigo,
        tipoAnimal: a.tipo,
        pesoVivo: a.peso,
        estado: EstadoAnimal.RECIBIDO,
        corralId: datos.corralOrigenId
      }
    })
    pesoTotal += a.peso
  }

  // Actualizar stock del corral
  await prisma.corral.update({
    where: { id: datos.corralOrigenId },
    data: { stockBovinos: { increment: 10 } }
  })

  success(`Tropa ${tropa.codigo} creada con 10 animales (${pesoTotal} kg total)`)
  
  return { tropaId: tropa.id, pesajeId: pesaje.id }
}

// ==================== 2. PESAJE INDIVIDUAL ====================
async function simularPesajeIndividual(tropaId: string, datos: DatosPrueba): Promise<void> {
  section('2. PESAJE INDIVIDUAL')

  const tropa = await prisma.tropa.findUnique({
    where: { id: tropaId },
    include: { animales: true }
  })

  if (!tropa) {
    error('Tropa no encontrada')
    return
  }

  log(`Pesando ${tropa.animales.length} animales de la tropa ${tropa.codigo}`)

  let pesoTotal = 0
  for (const animal of tropa.animales) {
    // Crear registro de pesaje individual
    await prisma.pesajeIndividual.create({
      data: {
        animalId: animal.id,
        peso: animal.pesoVivo || 400,
        operadorId: datos.operadorId
      }
    })

    // Actualizar estado del animal
    await prisma.animal.update({
      where: { id: animal.id },
      data: { estado: EstadoAnimal.PESADO }
    })

    pesoTotal += animal.pesoVivo || 400
  }

  // Actualizar tropa
  await prisma.tropa.update({
    where: { id: tropaId },
    data: { 
      estado: EstadoTropa.PESADO,
      pesoTotalIndividual: pesoTotal
    }
  })

  success(`${tropa.animales.length} animales pesados. Total: ${pesoTotal} kg`)
}

// ==================== 3. MOVIMIENTO DE HACIENDA ====================
async function simularMovimientoHacienda(tropaId: string, datos: DatosPrueba): Promise<void> {
  section('3. MOVIMIENTO DE HACIENDA')

  if (!datos.corralDestinoId) {
    info('No hay corral destino configurado, saltando movimiento')
    return
  }

  const animales = await prisma.animal.findMany({
    where: { tropaId },
    include: { tropa: true }
  })

  // Mover la mitad de los animales al corral destino
  const animalesAMover = animales.slice(0, Math.floor(animales.length / 2))

  log(`Moviendo ${animalesAMover.length} animales de ${datos.corralOrigenId} a ${datos.corralDestinoId}`)

  // Actualizar animales
  await prisma.animal.updateMany({
    where: { id: { in: animalesAMover.map(a => a.id) } },
    data: { corralId: datos.corralDestinoId }
  })

  // Crear movimiento
  await prisma.movimientoCorral.create({
    data: {
      tropaId,
      corralOrigenId: datos.corralOrigenId,
      corralDestinoId: datos.corralDestinoId,
      cantidad: animalesAMover.length,
      especie: Especie.BOVINO,
      observaciones: 'Movimiento de prueba - simulación',
      operadorId: datos.operadorId
    }
  })

  // Actualizar stocks de corrales
  await prisma.corral.update({
    where: { id: datos.corralOrigenId },
    data: { stockBovinos: { decrement: animalesAMover.length } }
  })
  await prisma.corral.update({
    where: { id: datos.corralDestinoId },
    data: { stockBovinos: { increment: animalesAMover.length } }
  })

  success(`${animalesAMover.length} animales movidos al corral destino`)
}

// ==================== 4. LISTA DE FAENA ====================
async function simularListaFaena(tropaId: string, datos: DatosPrueba): Promise<{ listaFaenaId: string }> {
  section('4. LISTA DE FAENA')

  // Crear lista de faena
  const maxLista = await prisma.listaFaena.aggregate({
    _max: { numero: true }
  })
  const numero = (maxLista._max.numero || 0) + 1

  const listaFaena = await prisma.listaFaena.create({
    data: {
      numero,
      fecha: new Date(),
      estado: 'ABIERTA',
      cantidadTotal: 10,
      supervisorId: datos.operadorId
    }
  })
  log(`Lista de Faena #${numero} creada`)

  // Agregar tropa a la lista
  await prisma.listaFaenaTropa.create({
    data: {
      listaFaenaId: listaFaena.id,
      tropaId,
      corralId: datos.corralOrigenId,
      cantidad: 10
    }
  })

  // Obtener animales para asignar
  const animales = await prisma.animal.findMany({
    where: { tropaId },
    include: { pesajeIndividual: true, tropa: true }
  })

  // Asignar garrones (correlativos desde 1)
  log('Asignando garrones a animales...')
  let garronNum = 1
  for (const animal of animales) {
    await prisma.asignacionGarron.create({
      data: {
        listaFaenaId: listaFaena.id,
        garron: garronNum,
        animalId: animal.id,
        tropaCodigo: animal.tropa?.codigo,
        animalNumero: animal.numero,
        tipoAnimal: animal.tipoAnimal,
        pesoVivo: animal.pesoVivo || animal.pesajeIndividual?.peso || null,
        operadorId: datos.operadorId,
        horaIngreso: new Date()
      }
    })

    // Actualizar estado del animal
    await prisma.animal.update({
      where: { id: animal.id },
      data: { estado: EstadoAnimal.EN_FAENA }
    })

    garronNum++
  }

  // Cerrar lista de faena
  await prisma.listaFaena.update({
    where: { id: listaFaena.id },
    data: { 
      estado: 'EN_PROCESO',
      fechaCierre: new Date()
    }
  })

  // Actualizar tropa
  await prisma.tropa.update({
    where: { id: tropaId },
    data: { estado: EstadoTropa.EN_FAENA }
  })

  success(`Lista de Faena #${numero} creada con ${animales.length} garrones asignados`)
  
  return { listaFaenaId: listaFaena.id }
}

// ==================== 5. ROMANEO ====================
async function simularRomaneo(listaFaenaId: string, datos: DatosPrueba): Promise<void> {
  section('5. ROMANEO - Pesaje de Medias Reses')

  const asignaciones = await prisma.asignacionGarron.findMany({
    where: { listaFaenaId },
    include: { animal: { include: { tropa: true, pesajeIndividual: true } } },
    orderBy: { garron: 'asc' }
  })

  log(`Procesando ${asignaciones.length} garrones`)

  let totalPesoMedias = 0

  for (const asignacion of asignaciones) {
    const pesoVivo = asignacion.animal?.pesoVivo || 
                     asignacion.animal?.pesajeIndividual?.peso || 
                     asignacion.pesoVivo || 450

    // Generar pesos de medias (aprox 50% de rinde)
    const rinde = 0.52 + (Math.random() * 0.06) // 52-58% de rinde
    const pesoTotal = pesoVivo * rinde
    const pesoIzq = pesoTotal / 2 * (0.98 + Math.random() * 0.04) // Pequeña variación
    const pesoDer = pesoTotal - pesoIzq

    // Crear romaneo
    const romaneo = await prisma.romaneo.create({
      data: {
        listaFaenaId,
        garron: asignacion.garron,
        tropaCodigo: asignacion.tropaCodigo,
        numeroAnimal: asignacion.animalNumero,
        tipoAnimal: asignacion.animal?.tipoAnimal as any,
        pesoVivo: pesoVivo,
        denticion: String(Math.floor(Math.random() * 8) + 2), // 2-8 dientes
        tipificadorId: datos.tipificadorId,
        pesoMediaIzq: Math.round(pesoIzq * 10) / 10,
        pesoMediaDer: Math.round(pesoDer * 10) / 10,
        pesoTotal: Math.round(pesoTotal * 10) / 10,
        rinde: Math.round(rinde * 1000) / 10,
        estado: 'CONFIRMADO',
        operadorId: datos.operadorId
      }
    })

    // Crear medias reses con código único
    const fecha = new Date()
    const codigoBase = `${fecha.getFullYear().toString().slice(-2)}${(fecha.getMonth() + 1).toString().padStart(2, '0')}${fecha.getDate().toString().padStart(2, '0')}`
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()

    // Media izquierda
    await prisma.mediaRes.create({
      data: {
        romaneoId: romaneo.id,
        lado: 'IZQUIERDA',
        sigla: 'A',
        peso: Math.round(pesoIzq * 10) / 10,
        codigo: `${codigoBase}-${asignacion.garron.toString().padStart(4, '0')}-I-A-${randomSuffix}`,
        estado: 'EN_CAMARA',
        camaraId: datos.camaraFaenaId
      }
    })

    // Media derecha
    await prisma.mediaRes.create({
      data: {
        romaneoId: romaneo.id,
        lado: 'DERECHA',
        sigla: 'A',
        peso: Math.round(pesoDer * 10) / 10,
        codigo: `${codigoBase}-${asignacion.garron.toString().padStart(4, '0')}-D-A-${randomSuffix}`,
        estado: 'EN_CAMARA',
        camaraId: datos.camaraFaenaId
      }
    })

    // Actualizar asignación
    await prisma.asignacionGarron.update({
      where: { id: asignacion.id },
      data: { 
        tieneMediaIzq: true,
        tieneMediaDer: true,
        completado: true
      }
    })

    // Actualizar estado del animal
    if (asignacion.animalId) {
      await prisma.animal.update({
        where: { id: asignacion.animalId },
        data: { estado: EstadoAnimal.FAENADO }
      })
    }

    totalPesoMedias += pesoTotal
  }

  // Actualizar stock de cámara
  const tropa = await prisma.tropa.findUnique({ where: { id: asignaciones[0]?.animal?.tropaId } })
  if (tropa && datos.camaraFaenaId) {
    await prisma.stockMediaRes.create({
      data: {
        camaraId: datos.camaraFaenaId,
        tropaCodigo: tropa.codigo,
        especie: Especie.BOVINO,
        cantidad: asignaciones.length * 2,
        pesoTotal: totalPesoMedias
      }
    })
  }

  // Cerrar lista de faena
  await prisma.listaFaena.update({
    where: { id: listaFaenaId },
    data: { estado: 'CERRADA' }
  })

  success(`${asignaciones.length} romaneos procesados. Total medias: ${Math.round(totalPesoMedias)} kg`)
}

// ==================== 6. INGRESO A CAJÓN (CÁMARA) ====================
async function simularIngresoCajon(datos: DatosPrueba): Promise<void> {
  section('6. INGRESO A CAJÓN / CÁMARA')

  // Obtener medias reses sin cámara asignada
  const mediasSinCamara = await prisma.mediaRes.findMany({
    where: { 
      camaraId: null,
      estado: 'EN_CAMARA'
    },
    include: { romaneo: true },
    take: 10
  })

  if (mediasSinCamara.length === 0) {
    info('Todas las medias ya están en cámara')
    return
  }

  log(`Ingresando ${mediasSinCamara.length} medias a cámara ${datos.camaraFaenaId}`)

  for (const media of mediasSinCamara) {
    // Asignar cámara
    await prisma.mediaRes.update({
      where: { id: media.id },
      data: { camaraId: datos.camaraFaenaId }
    })

    // Crear movimiento
    await prisma.movimientoCamara.create({
      data: {
        camaraDestinoId: datos.camaraFaenaId,
        producto: 'Media Res',
        cantidad: 1,
        peso: media.peso,
        tropaCodigo: media.romaneo?.tropaCodigo,
        mediaResId: media.id,
        operadorId: datos.operadorId,
        observaciones: `Ingreso media ${media.lado} - Garrón ${media.romaneo?.garron}`
      }
    })
  }

  success(`${mediasSinCamara.length} medias ingresadas a cámara`)
}

// ==================== 7. MOVIMIENTO DE CÁMARAS (PROPUESTA) ====================
async function simularMovimientoCamara(datos: DatosPrueba): Promise<void> {
  section('7. MOVIMIENTO DE CÁMARAS (Propuesta)')

  info('Este módulo permite mover medias reses entre cámaras')
  info('Similar a Movimiento de Hacienda pero para productos')

  // Simular un movimiento de ejemplo
  const mediasEnCamara = await prisma.mediaRes.findMany({
    where: { 
      camaraId: datos.camaraFaenaId,
      estado: 'EN_CAMARA'
    },
    include: { romaneo: true },
    take: 4
  })

  if (mediasEnCamara.length > 0 && datos.camaraCuarteoId) {
    log(`Moviendo ${mediasEnCamara.length} medias de Faena a Cuarteo`)

    for (const media of mediasEnCamara) {
      // Actualizar cámara de la media
      await prisma.mediaRes.update({
        where: { id: media.id },
        data: { camaraId: datos.camaraCuarteoId }
      })

      // Registrar movimiento
      await prisma.movimientoCamara.create({
        data: {
          camaraOrigenId: datos.camaraFaenaId,
          camaraDestinoId: datos.camaraCuarteoId,
          producto: 'Media Res',
          cantidad: 1,
          peso: media.peso,
          tropaCodigo: media.romaneo?.tropaCodigo,
          mediaResId: media.id,
          operadorId: datos.operadorId,
          observaciones: 'Movimiento a cámara de cuarteo'
        }
      })
    }

    success(`${mediasEnCamara.length} medias movidas a cámara de cuarteo`)
  } else {
    info('No hay medias para mover o no hay cámara destino configurada')
  }
}

// ==================== VALIDACIONES ====================
async function validarConsistencia(tropaId: string, listaFaenaId: string): Promise<void> {
  section('VALIDACIÓN DE CONSISTENCIA')

  // Verificar tropa
  const tropa = await prisma.tropa.findUnique({
    where: { id: tropaId },
    include: { 
      animales: true,
      tiposAnimales: true
    }
  })

  if (!tropa) {
    error('Tropa no encontrada')
    return
  }

  // Validar cantidad de animales
  const cantidadEsperada = tropa.tiposAnimales.reduce((sum, t) => sum + t.cantidad, 0)
  const cantidadReal = tropa.animales.length
  
  if (cantidadEsperada !== cantidadReal) {
    error(`Cantidad de animales inconsistente: esperados ${cantidadEsperada}, reales ${cantidadReal}`)
  } else {
    success(`Cantidad de animales correcta: ${cantidadReal}`)
  }

  // Verificar estados de animales
  const animalesPorEstado = await prisma.animal.groupBy({
    by: ['estado'],
    where: { tropaId }
  })
  
  log('Animales por estado:', animalesPorEstado)

  // Verificar romaneos
  const romaneos = await prisma.romaneo.findMany({
    where: { tropaCodigo: tropa.codigo }
  })
  
  const totalPesoRomaneo = romaneos.reduce((sum, r) => sum + (r.pesoTotal || 0), 0)
  success(`Total romaneos: ${romaneos.length} (${Math.round(totalPesoRomaneo)} kg)`)

  // Verificar medias reses
  const mediasReses = await prisma.mediaRes.findMany({
    where: { 
      romaneo: { tropaCodigo: tropa.codigo }
    }
  })
  
  success(`Total medias reses: ${mediasReses.length}`)

  // Verificar stock en cámaras
  const stockCamaras = await prisma.stockMediaRes.findMany({
    where: { tropaCodigo: tropa.codigo }
  })
  
  const stockTotal = stockCamaras.reduce((sum, s) => sum + s.cantidad, 0)
  success(`Stock en cámaras: ${stockTotal} medias`)

  // Calcular rinde promedio
  const rindePromedio = romaneos.reduce((sum, r) => sum + (r.rinde || 0), 0) / romaneos.length
  success(`Rinde promedio: ${rindePromedio.toFixed(2)}%`)
}

// ==================== MAIN ====================
async function main() {
  console.log('\n' + '🥩'.repeat(30))
  console.log('  SIMULACIÓN COMPLETA DEL SISTEMA FRIGORÍFICO')
  console.log('🥩'.repeat(30) + '\n')

  try {
    // Obtener datos de prueba
    const datos = await obtenerDatosPrueba()
    log('Datos de prueba obtenidos:', datos)

    // 1. Simular pesaje de camiones
    const { tropaId, pesajeId } = await simularPesajeCamiones(datos)

    // 2. Simular pesaje individual
    await simularPesajeIndividual(tropaId, datos)

    // 3. Simular movimiento de hacienda
    await simularMovimientoHacienda(tropaId, datos)

    // 4. Simular lista de faena
    const { listaFaenaId } = await simularListaFaena(tropaId, datos)

    // 5. Simular romaneo
    await simularRomaneo(listaFaenaId, datos)

    // 6. Simular ingreso a cajón
    await simularIngresoCajon(datos)

    // 7. Simular movimiento de cámaras
    await simularMovimientoCamara(datos)

    // Validaciones
    await validarConsistencia(tropaId, listaFaenaId)

    section('SIMULACIÓN COMPLETADA')
    success('Todas las operaciones se ejecutaron correctamente')

    // Mostrar resumen
    console.log('\n📊 RESUMEN DE DATOS CREADOS:')
    console.log('   - 1 tropa con 10 animales')
    console.log('   - 10 pesajes individuales')
    console.log('   - 1 lista de faena con 10 garrones')
    console.log('   - 10 romaneos con medias reses')
    console.log('   - 20 medias reses en cámaras')
    console.log('   - Movimientos de corral y cámara registrados')

  } catch (err) {
    error('Error en simulación:', err)
    throw err
  }
}

// Ejecutar
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
