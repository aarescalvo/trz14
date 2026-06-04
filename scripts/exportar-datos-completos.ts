/**
 * Script: Exportar datos completos de todas las tropas a Excel
 * 
 * Genera un archivo Excel con pestañas que cubre toda la data operativa
 * de las 203 tropas, para tener un backup completo en caso de reconstruir la DB.
 * 
 * Pestañas:
 *   1. Tropas          - Datos principales de cada tropa
 *   2. Animales        - Animales individuales por tropa
 *   3. TiposAnimales   - Cantidad por tipo de animal (TO, VA, VQ, etc)
 *   4. PesajeCamion    - Pesajes de camión (ingreso)
 *   5. PesajeIndividual - Pesajes individuales por animal
 *   6. ListasFaena     - Listas de faena y tropas asignadas
 *   7. AsignacionGarron - Asignación de garrones
 *   8. Romaneos        - Romaneos con medias res
 *   9. MediasRes       - Detalle de medias res
 *  10. Despachos       - Despachos de medias res
 *  11. Facturacion     - Facturas y detalles
 *  12. PlanillasFaena  - Planillas de servicio de faena
 *  13. Liquidaciones   - Liquidaciones de faena
 *  14. Balances        - Balances de faena
 *  15. Rendering       - Registros de rendering/grasa
 *  16. Cueros          - Registros de cuero
 *  17. MovCorral       - Movimientos de corral
 *  18. Maestros        - Clientes, transportistas, operadores, corrales
 *  19. Numeradores     - Contadores auto-increment
 *  20. Configuracion    - Config del frigorífico
 * 
 * USO:
 *   npx tsx scripts/exportar-datos-completos.ts
 *   npx tsx scripts/exportar-datos-completos.ts --output ./backup-datos.xlsx
 */

const ExcelJS = require('exceljs')
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const args = process.argv.slice(2)
const outputArg = args[args.indexOf('--output') + 1]
const outputPath = outputArg || './download/BACKUP_DATOS_COMPLETO.xlsx'

function fmtDate(d: Date | null | undefined): string | null {
  if (!d) return null
  return d.toISOString().replace('T', ' ').substring(0, 19)
}

function fmtNum(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return null
  return String(n)
}

function addSheet(wb: any, name: string, rows: Record<string, any>[], columns: string[]) {
  const ws = wb.addWorksheet(name)
  // Header
  ws.addRow(columns)
  // Data
  for (const row of rows) {
    ws.addRow(columns.map(c => {
      const val = row[c]
      if (val instanceof Date) return fmtDate(val)
      if (typeof val === 'object' && val !== null) return JSON.stringify(val)
      return val ?? null
    }))
  }
  // Auto-width
  ws.columns.forEach((col: any, i: number) => {
    const maxLen = Math.max(
      String(columns[i] || '').length,
      ...rows.slice(0, 100).map(r => String(r[columns[i]] ?? '').length)
    )
    col.width = Math.min(Math.max(maxLen + 2, 10), 50)
  })
  return ws
}

async function main() {
  console.log('============================================')
  console.log('  EXPORTAR DATOS COMPLETOS A EXCEL')
  console.log('============================================')
  console.log(`Archivo: ${outputPath}`)
  console.log('')

  const wb = new ExcelJS.Workbook()
  wb.creator = 'TrazaAlan Export'
  wb.created = new Date()

  // ── 1. TROPAS ──
  console.log('1. Exportando Tropas...')
  const tropas = await db.tropa.findMany({
    include: {
      productor: { select: { nombre: true, cuit: true } },
      usuarioFaena: { select: { nombre: true, cuit: true } },
      corral: { select: { nombre: true } },
      pesajeCamion: { select: { numeroTicket: true, patenteChasis: true, pesoBruto: true, pesoTara: true, pesoNeto: true, estado: true, fecha: true } },
      operador: { select: { nombre: true } },
      tiposAnimales: { select: { tipoAnimal: true, cantidad: true } },
      _count: { select: { animales: true } }
    },
    orderBy: { numero: 'asc' }
  })
  addSheet(wb, 'Tropas', tropas.map(t => ({
    id: t.id,
    numero: t.numero,
    codigo: t.codigo,
    productorNombre: t.productor?.nombre || '',
    productorCuit: t.productor?.cuit || '',
    usuarioFaenaNombre: t.usuarioFaena?.nombre || '',
    usuarioFaenaCuit: t.usuarioFaena?.cuit || '',
    productorId: t.productorId || '',
    usuarioFaenaId: t.usuarioFaenaId,
    especie: t.especie,
    dte: t.dte,
    guia: t.guia,
    cantidadCabezas: t.cantidadCabezas,
    corralNombre: t.corral?.nombre || '',
    corralId: t.corralId || '',
    estado: t.estado,
    pesoBruto: t.pesoBruto,
    pesoTara: t.pesoTara,
    pesoNeto: t.pesoNeto,
    pesoTotalIndividual: t.pesoTotalIndividual,
    fechaRecepcion: t.fechaRecepcion,
    fechaFaena: t.fechaFaena,
    kgGancho: t.kgGancho,
    observaciones: t.observaciones || '',
    operadorNombre: t.operador?.nombre || '',
    pesajeCamionId: t.pesajeCamionId || '',
    ticketNumero: t.pesajeCamion?.numeroTicket || '',
    ticketPatente: t.pesajeCamion?.patenteChasis || '',
    tiposAnimalesStr: t.tiposAnimales.map(ta => `${ta.tipoAnimal}:${ta.cantidad}`).join(', '),
    totalAnimales: t._count.animales,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt
  })), [
    'id', 'numero', 'codigo', 'productorNombre', 'productorCuit', 'usuarioFaenaNombre', 'usuarioFaenaCuit',
    'productorId', 'usuarioFaenaId', 'especie', 'dte', 'guia', 'cantidadCabezas', 'corralNombre', 'corralId',
    'estado', 'pesoBruto', 'pesoTara', 'pesoNeto', 'pesoTotalIndividual', 'fechaRecepcion', 'fechaFaena',
    'kgGancho', 'observaciones', 'operadorNombre', 'pesajeCamionId', 'ticketNumero', 'ticketPatente',
    'tiposAnimalesStr', 'totalAnimales', 'createdAt', 'updatedAt'
  ])

  // ── 2. ANIMALES ──
  console.log('2. Exportando Animales...')
  const animales = await db.animal.findMany({
    include: {
      tropa: { select: { numero: true, codigo: true } },
      corral: { select: { nombre: true } },
      pesajeIndividual: { select: { peso: true, fecha: true, observaciones: true } }
    },
    orderBy: [{ tropa: { numero: 'asc' } }, { numero: 'asc' }]
  })
  addSheet(wb, 'Animales', animales.map(a => ({
    id: a.id,
    tropaNumero: a.tropa.numero,
    tropaCodigo: a.tropa.codigo,
    tropaId: a.tropaId,
    numero: a.numero,
    codigo: a.codigo,
    caravana: a.caravana || '',
    tipoAnimal: a.tipoAnimal,
    raza: a.raza || '',
    pesoVivo: a.pesoVivo,
    estado: a.estado,
    corralNombre: a.corral?.nombre || '',
    corralId: a.corralId || '',
    pesoIndividual: a.pesajeIndividual?.peso || null,
    fechaPesajeIndividual: a.pesajeIndividual?.fecha || null,
    obsPesajeIndividual: a.pesajeIndividual?.observaciones || '',
    fechaBaja: a.fechaBaja,
    motivoBaja: a.motivoBaja || '',
    pesoBaja: a.pesoBaja,
    createdAt: a.createdAt
  })), [
    'id', 'tropaNumero', 'tropaCodigo', 'tropaId', 'numero', 'codigo', 'caravana', 'tipoAnimal',
    'raza', 'pesoVivo', 'estado', 'corralNombre', 'corralId', 'pesoIndividual', 'fechaPesajeIndividual',
    'obsPesajeIndividual', 'fechaBaja', 'motivoBaja', 'pesoBaja', 'createdAt'
  ])

  // ── 3. TIPOS ANIMALES ──
  console.log('3. Exportando Tipos de Animales...')
  const tiposAnimales = await db.tropaAnimalCantidad.findMany({
    include: { tropa: { select: { numero: true, codigo: true } } },
    orderBy: { tropa: { numero: 'asc' } }
  })
  addSheet(wb, 'TiposAnimales', tiposAnimales.map(t => ({
    id: t.id,
    tropaNumero: t.tropa.numero,
    tropaCodigo: t.tropa.codigo,
    tropaId: t.tropaId,
    tipoAnimal: t.tipoAnimal,
    cantidad: t.cantidad
  })), ['id', 'tropaNumero', 'tropaCodigo', 'tropaId', 'tipoAnimal', 'cantidad'])

  // ── 4. PESAJE CAMIÓN ──
  console.log('4. Exportando Pesaje Camión...')
  const pesajesCamion = await db.pesajeCamion.findMany({
    include: {
      transportista: { select: { nombre: true } },
      tropa: { select: { numero: true, codigo: true } },
      operador: { select: { nombre: true } }
    },
    orderBy: { fecha: 'asc' }
  })
  addSheet(wb, 'PesajeCamion', pesajesCamion.map(p => ({
    id: p.id,
    tipo: p.tipo,
    numeroTicket: p.numeroTicket,
    patenteChasis: p.patenteChasis,
    patenteAcoplado: p.patenteAcoplado || '',
    choferNombre: p.choferNombre || '',
    choferDni: p.choferDni || '',
    transportistaNombre: p.transportista?.nombre || '',
    transportistaId: p.transportistaId || '',
    pesoBruto: p.pesoBruto,
    pesoTara: p.pesoTara,
    pesoNeto: p.pesoNeto,
    estado: p.estado,
    destino: p.destino || '',
    remito: p.remito || '',
    precintos: p.precintos || '',
    observaciones: p.observaciones || '',
    operadorNombre: p.operador?.nombre || '',
    tropaNumero: p.tropa?.numero || '',
    tropaCodigo: p.tropa?.codigo || '',
    fecha: p.fecha,
    fechaTara: p.fechaTara,
    createdAt: p.createdAt
  })), [
    'id', 'tipo', 'numeroTicket', 'patenteChasis', 'patenteAcoplado', 'choferNombre', 'choferDni',
    'transportistaNombre', 'transportistaId', 'pesoBruto', 'pesoTara', 'pesoNeto', 'estado',
    'destino', 'remito', 'precintos', 'observaciones', 'operadorNombre', 'tropaNumero', 'tropaCodigo',
    'fecha', 'fechaTara', 'createdAt'
  ])

  // ── 5. PESAJE INDIVIDUAL ──
  console.log('5. Exportando Pesaje Individual...')
  const pesajesIndividuales = await db.pesajeIndividual.findMany({
    include: {
      animal: {
        select: {
          numero: true,
          codigo: true,
          tropa: { select: { numero: true, codigo: true } }
        }
      },
      operador: { select: { nombre: true } }
    },
    orderBy: { fecha: 'asc' }
  })
  addSheet(wb, 'PesajeIndividual', pesajesIndividuales.map(p => ({
    id: p.id,
    animalId: p.animalId,
    animalCodigo: p.animal.codigo,
    animalNumero: p.animal.numero,
    tropaNumero: p.animal.tropa.numero,
    tropaCodigo: p.animal.tropa.codigo,
    peso: p.peso,
    caravana: p.caravana || '',
    observaciones: p.observaciones || '',
    operadorNombre: p.operador?.nombre || '',
    fecha: p.fecha
  })), [
    'id', 'animalId', 'animalCodigo', 'animalNumero', 'tropaNumero', 'tropaCodigo',
    'peso', 'caravana', 'observaciones', 'operadorNombre', 'fecha'
  ])

  // ── 6. LISTAS DE FAENA ──
  console.log('6. Exportando Listas de Faena...')
  const listasFaena = await db.listaFaena.findMany({
    include: {
      supervisor: { select: { nombre: true } },
      vbRomaneoOperador: { select: { nombre: true } },
      tropas: {
        include: {
          tropa: { select: { numero: true, codigo: true } },
          corral: { select: { nombre: true } }
        }
      }
    },
    orderBy: { fecha: 'asc' }
  })
  addSheet(wb, 'ListasFaena', listasFaena.map(l => ({
    id: l.id,
    numero: l.numero,
    fecha: l.fecha,
    estado: l.estado,
    cantidadTotal: l.cantidadTotal,
    supervisorNombre: l.supervisor?.nombre || '',
    fechaCierre: l.fechaCierre,
    vbRomaneo: l.vbRomaneo,
    vbRomaneoFecha: l.vbRomaneoFecha,
    vbRomaneoOperadorNombre: l.vbRomaneoOperador?.nombre || '',
    observaciones: l.observaciones || '',
    tropasStr: l.tropas.map(t => `${t.tropa.numero}(${t.corral?.nombre || '-'})`).join(', '),
    tropasIds: l.tropas.map(t => t.tropaId).join(', ')
  })), [
    'id', 'numero', 'fecha', 'estado', 'cantidadTotal', 'supervisorNombre', 'fechaCierre',
    'vbRomaneo', 'vbRomaneoFecha', 'vbRomaneoOperadorNombre', 'observaciones',
    'tropasStr', 'tropasIds'
  ])

  // Sub-pestaña: ListaFaenaTropa
  addSheet(wb, 'ListaFaenaTropa', listasFaena.flatMap(l => l.tropas.map(t => ({
    id: t.id,
    listaFaenaNumero: l.numero,
    listaFaenaId: l.id,
    tropaNumero: t.tropa.numero,
    tropaCodigo: t.tropa.codigo,
    tropaId: t.tropaId,
    corralNombre: t.corral?.nombre || '',
    corralId: t.corralId || '',
    cantidad: t.cantidad
  }))), ['id', 'listaFaenaNumero', 'listaFaenaId', 'tropaNumero', 'tropaCodigo', 'tropaId', 'corralNombre', 'corralId', 'cantidad'])

  // ── 7. ASIGNACIÓN GARRÓN ──
  console.log('7. Exportando Asignación Garrón...')
  const asignaciones = await db.asignacionGarron.findMany({
    include: {
      animal: { select: { codigo: true, numero: true, tropa: { select: { numero: true } } } },
      listaFaena: { select: { numero: true, fecha: true } },
      operador: { select: { nombre: true } }
    },
    orderBy: { garron: 'asc' }
  })
  addSheet(wb, 'AsignacionGarron', asignaciones.map(a => ({
    id: a.id,
    listaFaenaNumero: a.listaFaena.numero,
    listaFaenaId: a.listaFaenaId,
    garron: a.garron,
    animalCodigo: a.animal?.codigo || '',
    animalNumero: a.animal?.numero || '',
    tropaNumero: a.animal?.tropa?.numero || '',
    tropaCodigo: a.tropaCodigo || '',
    animalNumeroAlt: a.animalNumero,
    tipoAnimal: a.tipoAnimal || '',
    pesoVivo: a.pesoVivo,
    operadorNombre: a.operador?.nombre || '',
    tieneMediaDer: a.tieneMediaDer,
    tieneMediaIzq: a.tieneMediaIzq,
    completado: a.completado,
    horaIngreso: a.horaIngreso || ''
  })), [
    'id', 'listaFaenaNumero', 'listaFaenaId', 'garron', 'animalCodigo', 'animalNumero', 'tropaNumero',
    'tropaCodigo', 'animalNumeroAlt', 'tipoAnimal', 'pesoVivo', 'operadorNombre',
    'tieneMediaDer', 'tieneMediaIzq', 'completado', 'horaIngreso'
  ])

  // ── 8. ROMANEOS ──
  console.log('8. Exportando Romaneos...')
  const romaneos = await db.romaneo.findMany({
    include: {
      tipificador: { select: { nombre: true } },
      supervisor: { select: { nombre: true } },
      operador: { select: { nombre: true } },
      listaFaena: { select: { numero: true, fecha: true } }
    },
    orderBy: { fecha: 'asc' }
  })
  addSheet(wb, 'Romaneos', romaneos.map(r => ({
    id: r.id,
    listaFaenaNumero: r.listaFaena.numero,
    listaFaenaId: r.listaFaenaId,
    fecha: r.fecha,
    garron: r.garron,
    tropaCodigo: r.tropaCodigo,
    numeroAnimal: r.numeroAnimal,
    tipoAnimal: r.tipoAnimal,
    raza: r.raza || '',
    pesoVivo: r.pesoVivo,
    denticion: r.denticion || '',
    tipificadorNombre: r.tipificador?.nombre || '',
    pesoMediaIzq: r.pesoMediaIzq,
    pesoMediaDer: r.pesoMediaDer,
    pesoTotal: r.pesoTotal,
    rinde: r.rinde,
    estado: r.estado,
    supervisorNombre: r.supervisor?.nombre || '',
    fechaConfirmacion: r.fechaConfirmacion,
    operadorNombre: r.operador?.nombre || ''
  })), [
    'id', 'listaFaenaNumero', 'listaFaenaId', 'fecha', 'garron', 'tropaCodigo', 'numeroAnimal',
    'tipoAnimal', 'raza', 'pesoVivo', 'denticion', 'tipificadorNombre', 'pesoMediaIzq',
    'pesoMediaDer', 'pesoTotal', 'rinde', 'estado', 'supervisorNombre', 'fechaConfirmacion',
    'operadorNombre'
  ])

  // ── 9. MEDIAS RES ──
  console.log('9. Exportando Medias Res...')
  const mediasRes = await db.mediaRes.findMany({
    include: {
      romaneo: { select: { garron: true, tropaCodigo: true } },
      camara: { select: { nombre: true } },
      usuarioFaena: { select: { nombre: true } }
    },
    orderBy: { createdAt: 'asc' }
  })
  addSheet(wb, 'MediasRes', mediasRes.map(m => ({
    id: m.id,
    romaneoId: m.romaneoId,
    garron: m.romaneo?.garron || '',
    tropaCodigo: m.romaneo?.tropaCodigo || '',
    lado: m.lado,
    peso: m.peso,
    sigla: m.sigla,
    codigo: m.codigo,
    estado: m.estado,
    camaraNombre: m.camara?.nombre || '',
    camaraId: m.camaraId || '',
    usuarioFaenaNombre: m.usuarioFaena?.nombre || '',
    createdAt: m.createdAt
  })), [
    'id', 'romaneoId', 'garron', 'tropaCodigo', 'lado', 'peso', 'sigla', 'codigo', 'estado',
    'camaraNombre', 'camaraId', 'usuarioFaenaNombre', 'createdAt'
  ])

  // ── 10. DESPACHOS ──
  console.log('10. Exportando Despachos...')
  const despachos = await db.despacho.findMany({
    include: {
      ticketPesaje: { select: { numeroTicket: true } },
      operador: { select: { nombre: true } },
      items: {
        include: {
          mediaRes: { select: { codigo: true } }
        }
      }
    },
    orderBy: { fecha: 'asc' }
  })
  addSheet(wb, 'Despachos', despachos.map(d => ({
    id: d.id,
    numero: d.numero,
    fecha: d.fecha,
    destino: d.destino || '',
    patenteCamion: d.patenteCamion || '',
    patenteAcoplado: d.patenteAcoplado || '',
    chofer: d.chofer || '',
    choferDni: d.choferDni || '',
    transportista: d.transportista || '',
    remito: d.remito || '',
    kgTotal: d.kgTotal,
    cantidadMedias: d.cantidadMedias,
    ticketNumero: d.ticketPesaje?.numeroTicket || '',
    estado: d.estado,
    operadorNombre: d.operador?.nombre || '',
    itemsStr: d.items.map(i => `${i.mediaRes?.codigo || '?'}(${i.tropaCodigo})`).join(', '),
    createdAt: d.createdAt
  })), [
    'id', 'numero', 'fecha', 'destino', 'patenteCamion', 'patenteAcoplado', 'chofer', 'choferDni',
    'transportista', 'remito', 'kgTotal', 'cantidadMedias', 'ticketNumero', 'estado',
    'operadorNombre', 'itemsStr', 'createdAt'
  ])

  // Sub-pestaña: DespachoItems
  addSheet(wb, 'DespachoItems', despachos.flatMap(d => d.items.map(i => ({
    id: i.id,
    despachoNumero: d.numero,
    despachoId: d.id,
    mediaResCodigo: i.mediaRes?.codigo || '',
    tropaCodigo: i.tropaCodigo || '',
    garron: i.garron || '',
    peso: i.peso,
    camaraId: i.camaraId || ''
  }))), ['id', 'despachoNumero', 'despachoId', 'mediaResCodigo', 'tropaCodigo', 'garron', 'peso', 'camaraId'])

  // ── 11. FACTURACIÓN ──
  console.log('11. Exportando Facturación...')
  const facturas = await db.factura.findMany({
    include: {
      cliente: { select: { nombre: true, cuit: true } },
      operador: { select: { nombre: true } },
      items: true
    },
    orderBy: { fecha: 'asc' }
  })
  addSheet(wb, 'Facturas', facturas.map(f => ({
    id: f.id,
    numero: f.numero,
    numeroInterno: f.numeroInterno,
    clienteNombre: f.cliente?.nombre || '',
    clienteCuit: f.cliente?.cuit || '',
    clienteId: f.clienteId,
    fecha: f.fecha,
    fechaEmision: f.fechaEmision,
    subtotal: f.subtotal,
    iva: f.iva,
    total: f.total,
    estado: f.estado,
    tipoComprobante: f.tipoComprobante || '',
    puntoVenta: f.puntoVenta || '',
    cae: f.cae || '',
    operadorNombre: f.operador?.nombre || '',
    totalItems: f.items.length,
    itemsStr: f.items.slice(0, 5).map(i => `${i.descripcion} x${i.cantidad}`).join('; ')
  })), [
    'id', 'numero', 'numeroInterno', 'clienteNombre', 'clienteCuit', 'clienteId', 'fecha',
    'fechaEmision', 'subtotal', 'iva', 'total', 'estado', 'tipoComprobante', 'puntoVenta',
    'cae', 'operadorNombre', 'totalItems', 'itemsStr'
  ])

  addSheet(wb, 'FacturaItems', facturas.flatMap(f => f.items.map(i => ({
    id: i.id,
    facturaNumero: f.numero,
    facturaId: f.id,
    tipoProducto: i.tipoProducto,
    descripcion: i.descripcion,
    cantidad: i.cantidad,
    unidad: i.unidad || '',
    precioUnitario: i.precioUnitario,
    subtotal: i.subtotal,
    tropaCodigo: i.tropaCodigo || '',
    garron: i.garron || '',
    pesoKg: i.pesoKg
  }))), ['id', 'facturaNumero', 'facturaId', 'tipoProducto', 'descripcion', 'cantidad', 'unidad', 'precioUnitario', 'subtotal', 'tropaCodigo', 'garron', 'pesoKg'])

  // ── 12. PLANILLAS DE FAENA ──
  console.log('12. Exportando Planillas de Faena...')
  const planillas = await db.planillaServicioFaena.findMany({
    include: {
      tropa: { select: { numero: true, codigo: true } },
      cliente: { select: { nombre: true, cuit: true } },
      operador: { select: { nombre: true } },
      factura: { select: { numero: true } }
    },
    orderBy: { fecha: 'asc' }
  })
  addSheet(wb, 'PlanillasFaena', planillas.map(p => ({
    id: p.id,
    numero: p.numero,
    fecha: p.fecha,
    tropaNumero: p.tropa.numero,
    tropaCodigo: p.tropa.codigo,
    clienteNombre: p.cliente?.nombre || '',
    clienteCuit: p.cliente?.cuit || '',
    especie: p.especie,
    cantidadCabezas: p.cantidadCabezas,
    kgVivo: p.kgVivo,
    kgFrio: p.kgFrio,
    rindePct: p.rindePct,
    tarifaKg: p.tarifaKg,
    tarifaCabeza: p.tarifaCabeza,
    importeTotal: p.importeTotal,
    ivaPct: p.ivaPct,
    ivaImporte: p.ivaImporte,
    totalGeneral: p.totalGeneral,
    estado: p.estado,
    facturaNumero: p.factura?.numero || '',
    operadorNombre: p.operador?.nombre || ''
  })), [
    'id', 'numero', 'fecha', 'tropaNumero', 'tropaCodigo', 'clienteNombre', 'clienteCuit',
    'especie', 'cantidadCabezas', 'kgVivo', 'kgFrio', 'rindePct', 'tarifaKg', 'tarifaCabeza',
    'importeTotal', 'ivaPct', 'ivaImporte', 'totalGeneral', 'estado', 'facturaNumero', 'operadorNombre'
  ])

  // ── 13. LIQUIDACIONES ──
  console.log('13. Exportando Liquidaciones...')
  const liquidaciones = await db.liquidacionFaena.findMany({
    include: {
      tropa: { select: { numero: true, codigo: true } },
      cliente: { select: { nombre: true, cuit: true } },
      operador: { select: { nombre: true } },
      supervisor: { select: { nombre: true } },
      factura: { select: { numero: true } },
      items: true
    },
    orderBy: { fechaFaena: 'asc' }
  })
  addSheet(wb, 'Liquidaciones', liquidaciones.map(l => ({
    id: l.id,
    numero: l.numero,
    tropaNumero: l.tropa.numero,
    tropaCodigo: l.tropa.codigo,
    clienteNombre: l.cliente?.nombre || '',
    clienteCuit: l.cliente?.cuit || '',
    fechaFaena: l.fechaFaena,
    cantCabezas: l.cantCabezas,
    kgRomaneo: l.kgRomaneo,
    tarifaFaenaValor: l.tarifaFaenaValor,
    subtotalNeto: l.subtotalNeto,
    totalIVA: l.totalIVA,
    totalRetenciones: l.totalRetenciones,
    totalFinal: l.totalFinal,
    estado: l.estado,
    facturaNumero: l.factura?.numero || '',
    supervisorNombre: l.supervisor?.nombre || '',
    operadorNombre: l.operador?.nombre || '',
    totalItems: l.items.length
  })), [
    'id', 'numero', 'tropaNumero', 'tropaCodigo', 'clienteNombre', 'clienteCuit', 'fechaFaena',
    'cantCabezas', 'kgRomaneo', 'tarifaFaenaValor', 'subtotalNeto', 'totalIVA', 'totalRetenciones',
    'totalFinal', 'estado', 'facturaNumero', 'supervisorNombre', 'operadorNombre', 'totalItems'
  ])

  // ── 14. BALANCES ──
  console.log('14. Exportando Balances de Faena...')
  const balances = await db.balanceFaena.findMany({
    include: {
      tropa: { select: { numero: true, codigo: true } },
      factura: { select: { numero: true } }
    },
    orderBy: { fecha: 'asc' }
  })
  addSheet(wb, 'BalancesFaena', balances.map(b => ({
    id: b.id,
    tropaNumero: b.tropa.numero,
    tropaCodigo: b.tropa.codigo,
    tropaId: b.tropaId,
    fecha: b.fecha,
    pesoVivoTotal: b.pesoVivoTotal,
    cantidadCabezas: b.cantidadCabezas,
    pesoFrioTotal: b.pesoFrioTotal,
    cantidadMedias: b.cantidadMedias,
    rindePromedio: b.rindePromedio,
    rindeMinimo: b.rindeMinimo,
    rindeMaximo: b.rindeMaximo,
    pesoMenudencias: b.pesoMenudencias,
    pesoMerma: b.pesoMerma,
    porcentajeMerma: b.porcentajeMerma,
    facturaNumero: b.factura?.numero || ''
  })), [
    'id', 'tropaNumero', 'tropaCodigo', 'tropaId', 'fecha', 'pesoVivoTotal', 'cantidadCabezas',
    'pesoFrioTotal', 'cantidadMedias', 'rindePromedio', 'rindeMinimo', 'rindeMaximo',
    'pesoMenudencias', 'pesoMerma', 'porcentajeMerma', 'facturaNumero'
  ])

  // ── 15. RENDERING ──
  console.log('15. Exportando Rendering...')
  const rendering = await db.registroRendering.findMany({
    include: {
      tropa: { select: { numero: true, codigo: true } }
    },
    orderBy: { fechaFaena: 'asc' }
  })
  addSheet(wb, 'Rendering', rendering.map(r => ({
    id: r.id,
    tropaNumero: r.tropa.numero,
    tropaCodigo: r.tropa.codigo,
    tropaId: r.tropaId,
    tipo: r.tipo,
    fechaFaena: r.fechaFaena,
    pesoKg: r.pesoKg,
    destino: r.destino || '',
    despachado: r.despachado,
    fechaDespacho: r.fechaDespacho
  })), ['id', 'tropaNumero', 'tropaCodigo', 'tropaId', 'tipo', 'fechaFaena', 'pesoKg', 'destino', 'despachado', 'fechaDespacho'])

  // ── 16. CUEROS ──
  console.log('16. Exportando Cueros...')
  const cueros = await db.registroCuero.findMany({
    include: {
      tropa: { select: { numero: true, codigo: true } }
    },
    orderBy: { fechaFaena: 'asc' }
  })
  addSheet(wb, 'Cueros', cueros.map(c => ({
    id: c.id,
    tropaNumero: c.tropa.numero,
    tropaCodigo: c.tropa.codigo,
    tropaId: c.tropaId,
    fechaFaena: c.fechaFaena,
    categoria: c.categoria,
    pesoKg: c.pesoKg,
    cantidad: c.cantidad,
    destino: c.destino || '',
    tipoDestino: c.tipoDestino,
    despachado: c.despachado,
    fechaDespacho: c.fechaDespacho,
    pesoDespacho: c.pesoDespacho,
    remito: c.remito || ''
  })), [
    'id', 'tropaNumero', 'tropaCodigo', 'tropaId', 'fechaFaena', 'categoria', 'pesoKg',
    'cantidad', 'destino', 'tipoDestino', 'despachado', 'fechaDespacho', 'pesoDespacho', 'remito'
  ])

  // ── 17. MOVIMIENTOS CORRAL ──
  console.log('17. Exportando Movimientos de Corral...')
  const movimientos = await db.movimientoCorral.findMany({
    include: {
      tropa: { select: { numero: true, codigo: true } },
      animal: { select: { codigo: true, numero: true } },
      corralOrigen: { select: { nombre: true } },
      corralDestino: { select: { nombre: true } },
      operador: { select: { nombre: true } }
    },
    orderBy: { fecha: 'asc' }
  })
  addSheet(wb, 'MovCorral', movimientos.map(m => ({
    id: m.id,
    tropaNumero: m.tropa?.numero || '',
    tropaCodigo: m.tropa?.codigo || '',
    animalCodigo: m.animal?.codigo || '',
    animalNumero: m.animal?.numero || '',
    corralOrigenNombre: m.corralOrigen?.nombre || '',
    corralDestinoNombre: m.corralDestino?.nombre || '',
    cantidad: m.cantidad,
    especie: m.especie,
    observaciones: m.observaciones || '',
    operadorNombre: m.operador?.nombre || '',
    fecha: m.fecha
  })), [
    'id', 'tropaNumero', 'tropaCodigo', 'animalCodigo', 'animalNumero', 'corralOrigenNombre',
    'corralDestinoNombre', 'cantidad', 'especie', 'observaciones', 'operadorNombre', 'fecha'
  ])

  // ── 18. MAESTROS ──
  console.log('18. Exportando Maestros...')

  // Clientes (productores + usuarios faena)
  const clientes = await db.cliente.findMany({ orderBy: { nombre: 'asc' } })
  addSheet(wb, 'Clientes', clientes.map(c => ({
    id: c.id,
    nombre: c.nombre,
    dni: c.dni || '',
    cuit: c.cuit || '',
    razonSocial: c.razonSocial || '',
    direccion: c.direccion || '',
    localidad: c.localidad || '',
    provincia: c.provincia || '',
    telefono: c.telefono || '',
    email: c.email || '',
    esProductor: c.esProductor,
    esUsuarioFaena: c.esUsuarioFaena,
    activo: c.activo
  })), ['id', 'nombre', 'dni', 'cuit', 'razonSocial', 'direccion', 'localidad', 'provincia', 'telefono', 'email', 'esProductor', 'esUsuarioFaena', 'activo'])

  // Transportistas
  const transportistas = await db.transportista.findMany({ orderBy: { nombre: 'asc' } })
  addSheet(wb, 'Transportistas', transportistas.map(t => ({
    id: t.id, nombre: t.nombre, cuit: t.cuit || '', direccion: t.direccion || '', telefono: t.telefono || ''
  })), ['id', 'nombre', 'cuit', 'direccion', 'telefono'])

  // Operadores
  const operadores = await db.operador.findMany({ orderBy: { nombre: 'asc' } })
  addSheet(wb, 'Operadores', operadores.map(o => ({
    id: o.id, nombre: o.nombre, usuario: o.usuario, rol: o.rol, email: o.email || '', activo: o.activo
  })), ['id', 'nombre', 'usuario', 'rol', 'email', 'activo'])

  // Corrales
  const corrales = await db.corral.findMany({ orderBy: { nombre: 'asc' } })
  addSheet(wb, 'Corrales', corrales.map(c => ({
    id: c.id, nombre: c.nombre, capacidad: c.capacidad, stockBovinos: c.stockBovinos, stockEquinos: c.stockEquinos, activo: c.activo
  })), ['id', 'nombre', 'capacidad', 'stockBovinos', 'stockEquinos', 'activo'])

  // Cámaras
  const camaras = await db.camara.findMany({ orderBy: { nombre: 'asc' } })
  addSheet(wb, 'Camaras', camaras.map(c => ({
    id: c.id, nombre: c.nombre, tipo: c.tipo, capacidad: c.capacidad, activo: c.activo
  })), ['id', 'nombre', 'tipo', 'capacidad', 'activo'])

  // Tipificadores
  const tipificadores = await db.tipificador.findMany({ orderBy: { nombre: 'asc' } })
  addSheet(wb, 'Tipificadores', tipificadores.map(t => ({
    id: t.id, nombre: t.nombre, apellido: t.apellido || '', numero: t.numero || '', matricula: t.matricula || '', activo: t.activo
  })), ['id', 'nombre', 'apellido', 'numero', 'matricula', 'activo'])

  // ProductorConsignatario
  const productoresCons = await db.productorConsignatario.findMany({ orderBy: { nombre: 'asc' } })
  addSheet(wb, 'ProductoresConsignatarios', productoresCons.map(p => ({
    id: p.id, nombre: p.nombre, cuit: p.cuit || '', tipo: p.tipo, numeroRenspa: p.numeroRenspa || '', numeroEstablecimiento: p.numeroEstablecimiento || '', activo: p.activo
  })), ['id', 'nombre', 'cuit', 'tipo', 'numeroRenspa', 'numeroEstablecimiento', 'activo'])

  // Productos
  const productos = await db.producto.findMany({ orderBy: { codigo: 'asc' } })
  addSheet(wb, 'Productos', productos.map(p => ({
    id: p.id, codigo: p.codigo, nombre: p.nombre, especie: p.especie, tara: p.tara, precio: p.precio, activo: p.activo
  })), ['id', 'codigo', 'nombre', 'especie', 'tara', 'precio', 'activo'])

  // Precios Cliente
  const precios = await db.precioCliente.findMany({
    include: { cliente: { select: { nombre: true } } },
    orderBy: { fechaDesde: 'asc' }
  })
  addSheet(wb, 'PreciosCliente', precios.map(p => ({
    id: p.id, clienteNombre: p.cliente?.nombre || '', tipoProducto: p.tipoProducto, precioKg: p.precioKg, fechaDesde: p.fechaDesde, fechaHasta: p.fechaHasta, activo: p.activo
  })), ['id', 'clienteNombre', 'tipoProducto', 'precioKg', 'fechaDesde', 'fechaHasta', 'activo'])

  // ── 19. NUMERADORES ──
  console.log('19. Exportando Numeradores...')
  const numeradores = await db.numerador.findMany({ orderBy: { nombre: 'asc' } })
  addSheet(wb, 'Numeradores', numeradores.map(n => ({
    id: n.id, nombre: n.nombre, ultimoNumero: n.ultimoNumero, anio: n.anio || ''
  })), ['id', 'nombre', 'ultimoNumero', 'anio'])

  const numeradoresC2 = await db.numeradorCicloII.findMany({ orderBy: { nombre: 'asc' } })
  addSheet(wb, 'NumeradoresCicloII', numeradoresC2.map(n => ({
    id: n.id, nombre: n.nombre, ultimoNumero: n.ultimoNumero, anio: n.anio || ''
  })), ['id', 'nombre', 'ultimoNumero', 'anio'])

  // ── 20. CONFIGURACIÓN ──
  console.log('20. Exportando Configuración...')
  const config = await db.configuracionFrigorifico.findFirst()
  if (config) {
    addSheet(wb, 'Configuracion', [{
      id: config.id,
      nombre: config.nombre,
      direccion: config.direccion || '',
      numeroEstablecimiento: config.numeroEstablecimiento || '',
      cuit: config.cuit || '',
      numeroMatricula: config.numeroMatricula || ''
    }], ['id', 'nombre', 'direccion', 'numeroEstablecimiento', 'cuit', 'numeroMatricula'])
  }

  // ── GUARDAR ARCHIVO ──
  console.log('\nGuardando archivo...')
  await wb.xlsx.writeFile(outputPath)
  console.log(`✅ Archivo guardado: ${outputPath}`)

  const totalSheets = wb.worksheets.length
  console.log(`   Pestañas: ${totalSheets}`)
  console.log(`   Tropas: ${tropas.length}`)
  console.log(`   Animales: ${animales.length}`)
  console.log(`   Pesajes Camión: ${pesajesCamion.length}`)
  console.log(`   Pesajes Individuales: ${pesajesIndividuales.length}`)
  console.log(`   Listas de Faena: ${listasFaena.length}`)
  console.log(`   Romaneos: ${romaneos.length}`)
  console.log(`   Medias Res: ${mediasRes.length}`)
  console.log(`   Despachos: ${despachos.length}`)
  console.log(`   Facturas: ${facturas.length}`)
  console.log(`   Planillas: ${planillas.length}`)
  console.log(`   Liquidaciones: ${liquidaciones.length}`)
  console.log(`   Balances: ${balances.length}`)
  console.log(`   Rendering: ${rendering.length}`)
  console.log(`   Cueros: ${cueros.length}`)
  console.log(`   Movimientos Corral: ${movimientos.length}`)
  console.log(`   Clientes: ${clientes.length}`)
  console.log(`   Transportistas: ${transportistas.length}`)

  console.log('\n=== FIN ===')
}

main()
  .catch(e => { console.error('ERROR FATAL:', e); process.exit(1) })
  .finally(() => db.$disconnect())
