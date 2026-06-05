/**
 * Seed script: Carga datos del DETALLE a la DB (hasta tropa 203)
 * Uso: npx tsx prisma/seed-detalle.ts
 *
 * Lee download/detalle_tropas.json, crea tropas faltantes, y carga DetalleTropaFaena + PreciosHistorial
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface TropaData {
  tropa: number
  mes: string | null
  usuario: string | null
  cantAnimales: number
  precioServicio: number
  kgGancho: number
  valorServicioFaena: number
  servicioDespostada: number
  totalOperacion: number
  factCompraMenudencia: number
  factVentaMenudencia: number
  ventaChinchulin: number
  montoHueso: number
  montoDesperdicio: number
  montoGrasa: number
  montoCuero: number
  montoGrasaDreasin: number
}

function tropaNumToCodigo(num: number): string {
  return `B 2026 ${String(num).padStart(4, '0')}`
}

function mesToNum(mes: string | null): number {
  if (!mes) return 1
  const meses: Record<string, number> = {
    'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4,
    'MAYO': 5, 'JUNIO': 6, 'JULIO': 7, 'AGOSTO': 8,
    'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
  }
  return meses[mes.toUpperCase().trim()] || 1
}

async function main() {
  console.log('=== SEED DETALLE TROPA FAENA ===\n')

  // 1. Leer JSON
  const jsonPath = path.resolve(process.cwd(), 'download/detalle_tropas.json')
  if (!fs.existsSync(jsonPath)) {
    console.error(`ERROR: No se encontró ${jsonPath}`)
    console.error('Asegurate de que el archivo exista en ./download/detalle_tropas.json')
    process.exit(1)
  }

  const rawData: TropaData[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
  console.log(`Leídas ${rawData.length} registros del JSON`)

  // 2. Build cache de clientes (usuario de faena)
  const allUsuarios = [...new Set(rawData.map(d => (d.usuario || '').trim()).filter(Boolean))]
  const clienteCache: Record<string, string> = {}

  for (const nombre of allUsuarios) {
    const cliente = await prisma.cliente.findFirst({
      where: { nombre: { equals: nombre, mode: 'insensitive' } }
    })
    if (cliente) {
      clienteCache[nombre] = cliente.id
    } else {
      // Crear cliente como usuario de faena
      console.log(`  + Creando cliente "${nombre}" (usuarioFaena)`)
      const nuevo = await prisma.cliente.create({
        data: {
          nombre: nombre,
          esUsuarioFaena: true,
          activo: true,
        }
      })
      clienteCache[nombre] = nuevo.id
    }
  }

  console.log(`\nClientes mapeados: ${Object.keys(clienteCache).length}`)

  // 3. Procesar cada registro
  let detallesCreados = 0
  let tropasCreadas = 0
  let existentes = 0
  let errores = 0

  for (const item of rawData) {
    const usuarioNombre = (item.usuario || '').trim()
    if (!usuarioNombre) continue

    const codigo = tropaNumToCodigo(item.tropa)
    const clienteId = clienteCache[usuarioNombre]
    if (!clienteId) {
      console.log(`  ⚠ Sin cliente para "${usuarioNombre}" (tropa ${item.tropa})`)
      errores++
      continue
    }

    // Buscar tropa por código
    let tropa = await prisma.tropa.findUnique({
      where: { codigo },
      select: { id: true, codigo: true, numero: true }
    })

    // Si no existe, crearla automáticamente
    if (!tropa) {
      try {
        const mesNum = mesToNum(item.mes)
        const fechaFaena = new Date(2026, mesNum - 1, 15)
        tropa = await prisma.tropa.create({
          data: {
            numero: item.tropa,
            codigo: codigo,
            codigoSimplificado: `B${String(item.tropa).padStart(4, '0')}`,
            usuarioFaenaId: clienteId,
            especie: 'BOVINO',
            dte: `DTE-${item.tropa}`,
            guia: `GUIA-${item.tropa}`,
            cantidadCabezas: item.cantAnimales,
            estado: 'FAENADO',
            pesoNeto: item.kgGancho || null,
            fechaFaena: fechaFaena,
          },
          select: { id: true, codigo: true, numero: true }
        })
        tropasCreadas++
        if (tropasCreadas <= 30) {
          console.log(`  + Tropa ${item.tropa} creada (${usuarioNombre}, ${item.cantAnimales} cabezas)`)
        }
      } catch (err: any) {
        console.log(`  ✗ Error creando tropa ${item.tropa}: ${err.message}`)
        errores++
        continue
      }
    }

    // Verificar si ya existe detalle
    const existente = await prisma.detalleTropaFaena.findUnique({
      where: { tropaId: tropa.id }
    })

    if (existente) {
      existentes++
      continue
    }

    // Crear detalle
    try {
      await prisma.detalleTropaFaena.create({
        data: {
          tropaId: tropa.id,
          numeroTropa: item.tropa,
          mes: item.mes || undefined,
          usuario: usuarioNombre,
          cantidadAnimales: item.cantAnimales,
          precioServicio: item.precioServicio,
          kgGancho: item.kgGancho,
          valorServicioFaena: item.valorServicioFaena,
          servicioDespostada: item.servicioDespostada || 0,
          factCompraMenudencia: item.factCompraMenudencia || 0,
          factVentaMenudencia: item.factVentaMenudencia || 0,
          ventaChinchulin: item.ventaChinchulin || 0,
          montoHueso: item.montoHueso || 0,
          montoDesperdicio: item.montoDesperdicio || 0,
          montoGrasa: item.montoGrasa || 0,
          montoCuero: item.montoCuero || 0,
          montoGrasaDressing: item.montoGrasaDreasin || 0,
        }
      })
      detallesCreados++
    } catch (err: any) {
      console.error(`  ✗ Error detalle tropa ${item.tropa}: ${err.message}`)
      errores++
    }
  }

  console.log(`\n=== RESULTADO ===`)
  console.log(`  Tropas nuevas creadas: ${tropasCreadas}`)
  console.log(`  Detalles creados: ${detallesCreados}`)
  console.log(`  Ya existían: ${existentes}`)
  console.log(`  Errores: ${errores}`)

  // 4. Registrar precios históricos
  console.log(`\n=== PRECIOS HISTÓRICOS ===`)

  const precios: { monto: number; desde: string }[] = [
    { monto: 335, desde: '2025-01-01' },
    { monto: 420, desde: '2025-05-01' },
    { monto: 440, desde: '2025-07-01' },
    { monto: 500, desde: '2025-09-01' },
  ]

  let tipoServicioFaena = await prisma.tipoServicio.findFirst({ where: { codigo: 'FAENA' } })
  if (!tipoServicioFaena) {
    tipoServicioFaena = await prisma.tipoServicio.create({
      data: {
        codigo: 'FAENA',
        nombre: 'Servicio de Faena por Kg (sin recupero)',
        descripcion: 'Precio del servicio de faena por kilogramo en gancho, sin recupero',
        unidad: 'KG',
        seFactura: true,
        porcentajeIva: 21,
        orden: 1,
      }
    })
    console.log(`  TipoServicio FAENA creado`)
  }

  let tipoServicioDespostada = await prisma.tipoServicio.findFirst({ where: { codigo: 'DESPOSTADA' } })
  if (!tipoServicioDespostada) {
    tipoServicioDespostada = await prisma.tipoServicio.create({
      data: {
        codigo: 'DESPOSTADA',
        nombre: 'Servicio de Despostada',
        descripcion: 'Servicio de despostada adicional',
        unidad: 'KG',
        seFactura: true,
        porcentajeIva: 21,
        orden: 2,
      }
    })
    console.log(`  TipoServicio DESPOSTADA creado`)
  }

  // Registrar precios para cada usuario
  for (const usuarioNombre of allUsuarios) {
    const clienteId = clienteCache[usuarioNombre]
    if (!clienteId) continue

    const preciosUsuario = [...new Set(
      rawData.filter(d => (d.usuario || '').trim() === usuarioNombre).map(d => d.precioServicio)
    )].filter(p => p > 0).sort()

    for (const precio of preciosUsuario) {
      const existente = await prisma.precioServicio.findFirst({
        where: {
          clienteId: clienteId,
          tipoServicioId: tipoServicioFaena.id,
          precio: precio,
          fechaHasta: null,
        }
      })
      if (existente) continue

      const tierInfo = precios.find(p => p.monto === precio)
      const fechaDesde = tierInfo ? new Date(tierInfo.desde) : new Date('2025-01-01')

      // Cerrar precio anterior vigente
      await prisma.precioServicio.updateMany({
        where: {
          clienteId: clienteId,
          tipoServicioId: tipoServicioFaena.id,
          fechaHasta: null,
          precio: { not: precio },
        },
        data: { fechaHasta: fechaDesde }
      })

      await prisma.precioServicio.create({
        data: {
          clienteId: clienteId,
          tipoServicioId: tipoServicioFaena.id,
          precio: precio,
          fechaDesde: fechaDesde,
          observaciones: `Precio faena $${precio}/kg - Importado de planilla DETALLE`,
        }
      })

      await prisma.precioHistorial.create({
        data: {
          tipoServicioId: tipoServicioFaena.id,
          tipoServicioNombre: tipoServicioFaena.nombre,
          clienteId: clienteId,
          clienteNombre: usuarioNombre,
          precioNuevo: precio,
          precioAnterior: precio === 335 ? 0 : precios[precios.findIndex(p => p.monto === precio) - 1]?.monto || 0,
          fechaDesde: fechaDesde,
          motivo: 'Importación planilla DETALLE',
          tipoCambio: 'CREACION',
        }
      })

      console.log(`  ✓ ${usuarioNombre}: $${precio}/kg desde ${fechaDesde.toISOString().split('T')[0]}`)
    }
  }

  // 5. Crear datos en el sistema de Tarifas (TipoTarifa + HistoricoTarifa)
  // Esto es lo que muestra la pestaña "Precios" en Facturación
  console.log(`\n=== TARIFAS (TipoTarifa + HistoricoTarifa) ===`)

  // Crear TipoTarifa para faena si no existe
  const tipoTarifaFaena = await prisma.tipoTarifa.findUnique({ where: { codigo: 'FAENA_BOVINO' } })
  if (!tipoTarifaFaena) {
    await prisma.tipoTarifa.create({
      data: {
        codigo: 'FAENA_BOVINO',
        descripcion: 'Servicio de faena bovino por kg',
        unidad: 'POR_KG',
        orden: 1,
      }
    })
    console.log(`  TipoTarifa FAENA_BOVINO creado`)
  }
  const tt = tipoTarifaFaena || await prisma.tipoTarifa.findUnique({ where: { codigo: 'FAENA_BOVINO' } })
  if (!tt) {
    console.log('  ✗ No se pudo obtener TipoTarifa FAENA_BOVINO, saltando tarifas')
  } else {

  // Crear HistoricoTarifa para cada cliente con cada precio que tuvo
  let tarifasCreadas = 0
  for (const usuarioNombre of allUsuarios) {
    const clienteId = clienteCache[usuarioNombre]
    if (!clienteId) continue

    const preciosUsuario = [...new Set(
      rawData.filter(d => (d.usuario || '').trim() === usuarioNombre).map(d => d.precioServicio)
    )].filter(p => p > 0).sort()

    for (const precio of preciosUsuario) {
      const tierInfo = precios.find(p => p.monto === precio)
      const fechaDesde = tierInfo ? new Date(tierInfo.desde) : new Date('2025-01-01')

      // Verificar si ya existe
      const existente = await prisma.historicoTarifa.findFirst({
        where: {
          tipoTarifaId: tt.id,
          clienteId: clienteId,
          valor: precio,
          vigenciaDesde: fechaDesde,
        }
      })
      if (existente) continue

      // Cerrar tarifa anterior vigente para este cliente+tipo
      await prisma.historicoTarifa.updateMany({
        where: {
          tipoTarifaId: tt.id,
          clienteId: clienteId,
          vigenciaHasta: null,
        },
        data: { vigenciaHasta: fechaDesde }
      })

      await prisma.historicoTarifa.create({
        data: {
          tipoTarifaId: tt.id,
          clienteId: clienteId,
          valor: precio,
          vigenciaDesde: fechaDesde,
          motivo: `Precio faena $${precio}/kg - Importado de planilla DETALLE`,
        }
      })
      tarifasCreadas++
    }
  }
  console.log(`  Tarifas creadas: ${tarifasCreadas}`)
  } // end else tt

  console.log(`\n=== SEED COMPLETADO ===`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
