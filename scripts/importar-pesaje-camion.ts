/**
 * Script: Importar pesajes de camión desde PLANTILLA_PESAJE_CAMION.xlsx
 * 
 * Lee la plantilla Excel con datos reales de pesaje de camiones para todas las tropas
 * (1 a 203) y actualiza/crea los registros de PesajeCamion y Tropa correspondientes.
 * 
 * Columnas Excel:
 *   A: N° Tropa (numero de tropa 1-203)
 *   B: Fecha Ingreso (fecha de recepción)
 *   C: Hora Ingreso (hora, a combinar con fecha)
 *   D: Patente Chasis
 *   E: Patente Acoplado
 *   F: Chofer Nombre
 *   G: Chofer DNI
 *   H: Transportista (nombre)
 *   I: N° Ticket Balanza (formato "0001-XXXXXXXX")
 *   J: Peso Bruto (kg)
 *   K: Peso Tara (kg)
 *   L: Peso Neto (kg)
 *   M: Productor
 *   N: N° DTE
 *   O: N° Guía
 *   P: Observaciones
 * 
 * Estrategia:
 * - Busca tropa por numero (1-203)
 * - Si la tropa ya tiene pesajeCamionId → UPDATE el PesajeCamion existente
 * - Si no → CREATE un nuevo PesajeCamion y lo vincula
 * - Actualiza campos de la tropa: fechaRecepcion, pesos, DTE, guía, patente, chofer
 * - NO crea animales (ya existen), NO modifica estados
 * - numeroTicket es obligatorio: si falta en el Excel, se skip con error
 * 
 * USO:
 *   npx tsx scripts/importar-pesaje-camion.ts
 *   npx tsx scripts/importar-pesaje-camion.ts --dry-run
 *   npx tsx scripts/importar-pesaje-camion.ts --tropa 42    (solo una tropa)
 *   npx tsx scripts/importar-pesaje-camion.ts --desde 42    (desde la tropa 42 en adelante)
 */

// ExcelJS: usar require para compatibilidad con tsx
const ExcelJS = require('exceljs')
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const tropaFiltro = parseInt(args[args.indexOf('--tropa') + 1] || '0')
const desdeFiltro = parseInt(args[args.indexOf('--desde') + 1] || '0')
// Ruta del archivo: primer argumento que no empiece con "--"
const positionalArgs = args.filter(a => !a.startsWith('--'))

function getCellValue(row: any, col: number): any {
  const cell = row.getCell(col)
  if (cell.value === null || cell.value === undefined) return null
  // Handle formula results
  if (typeof cell.value === 'object' && 'result' in cell.value) {
    return (cell.value as any).result
  }
  // Handle rich text
  if (typeof cell.value === 'object' && 'richText' in cell.value) {
    return (cell.value as any).richText.map((r: any) => r.text).join('')
  }
  return cell.value
}

function parseDate(value: any): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'string') {
    // Formato DD/MM/YYYY o DD/MM/YYYY HH:MM
    const cleaned = value.trim()
    // Intentar parsear
    const parts = cleaned.split(/[/\s:]/)
    if (parts.length >= 3) {
      const day = parseInt(parts[0])
      const month = parseInt(parts[1]) - 1
      let year = parseInt(parts[2])
      if (year < 100) year += 2000
      const d = new Date(year, month, day)
      // Agregar hora si existe
      if (parts.length >= 5) {
        d.setHours(parseInt(parts[3]) || 0, parseInt(parts[4]) || 0)
      } else {
        d.setHours(12, 0, 0, 0) // Mediodía por defecto
      }
      if (!isNaN(d.getTime())) return d
    }
  }
  if (typeof value === 'number') {
    // Excel serial date
    const d = new Date((value - 25569) * 86400 * 1000)
    return d
  }
  return null
}

function parseTime(value: any): { hours: number; minutes: number } | null {
  if (!value) return null
  if (typeof value === 'string') {
    const parts = value.trim().split(':')
    if (parts.length >= 2) {
      return { hours: parseInt(parts[0]) || 0, minutes: parseInt(parts[1]) || 0 }
    }
    return null
  }
  if (value instanceof Date) {
    // Excel time serial (30/12/1899 HH:MM:SS)
    return { hours: value.getHours(), minutes: value.getMinutes() }
  }
  if (typeof value === 'number') {
    // Excel serial (fraction of day)
    const totalMinutes = Math.round(value * 24 * 60)
    return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 }
  }
  return null
}

function parseTicket(value: any): number | null {
  if (!value) return null
  const str = String(value).trim()
  // Formato "0001-XXXXXXXX" → extraer número
  const match = str.match(/(\d+)$/)
  if (match) return parseInt(match[1])
  // Si es solo un número
  const num = parseInt(str)
  return isNaN(num) ? null : num
}

function parseString(value: any): string | null {
  if (!value) return null
  const str = String(value).trim()
  return str.length > 0 ? str : null
}

function parseNumber(value: any): number | null {
  if (value === null || value === undefined || value === '') return null
  const num = parseFloat(String(value))
  return isNaN(num) ? null : num
}

async function main() {
  console.log('============================================')
  console.log('  IMPORTAR PESAJES DE CAMIÓN DESDE EXCEL')
  console.log('============================================')
  console.log(`Modo: ${dryRun ? 'DRY RUN (sin cambios)' : 'EJECUCIÓN'}`)
  if (tropaFiltro) console.log(`Filtro: solo tropa ${tropaFiltro}`)
  if (desdeFiltro) console.log(`Filtro: desde tropa ${desdeFiltro}`)
  console.log('')

  // 1. Leer Excel
  console.log('1. Leyendo archivo Excel...')
  const workbook = new ExcelJS.Workbook()
  const excelPath = positionalArgs[0] || './upload/PLANTILLA_PESAJE_CAMION.xlsx'
  console.log(`   Archivo: ${excelPath}`)
  await workbook.xlsx.readFile(excelPath)
  
  const sheet = workbook.worksheets[0] // "PESAJE CAMION"
  if (!sheet) {
    console.error('❌ No se encontró la hoja "PESAJE CAMION"')
    process.exit(1)
  }
  
  console.log(`   Hoja: "${sheet.name}", Filas: ${sheet.rowCount}, Columnas: ${sheet.columnCount}`)

  // 2. Leer encabezados (fila 4)
  const headerRow = sheet.getRow(4)
  const headers: Record<number, string> = {}
  for (let col = 1; col <= sheet.columnCount; col++) {
    const val = headerRow.getCell(col).value
    if (val) headers[col] = String(val).trim()
  }
  console.log('   Encabezados:', Object.values(headers).join(' | '))

  // 3. Pre-cargar transportistas para lookup por nombre
  console.log('\n2. Cargando transportistas para lookup...')
  const transportistas = await db.transportista.findMany()
  const transportistaMap = new Map<string, string>() // nombre → id
  for (const t of transportistas) {
    transportistaMap.set(t.nombre?.trim().toUpperCase() || '', t.id)
  }
  console.log(`   ${transportistas.length} transportistas cargados`)

  // 4. Procesar filas de datos
  console.log('\n3. Procesando filas de datos...')
  
  let creados = 0
  let actualizados = 0
  let errores = 0
  let saltados = 0
  const detalleErrores: string[] = []

  for (let rowNum = 6; rowNum <= sheet.rowCount; rowNum++) {
    const row = sheet.getRow(rowNum)
    
    // Columnas (1-based): A=1, B=2, ..., P=16
    const tropaNumero = parseNumber(getCellValue(row, 1))
    
    if (!tropaNumero || tropaNumero <= 0) continue
    
    // Aplicar filtros
    if (tropaFiltro && tropaNumero !== tropaFiltro) continue
    if (desdeFiltro && tropaNumero < desdeFiltro) continue

    // Parsear campos
    const fechaRaw = getCellValue(row, 2)  // Fecha Ingreso
    const horaRaw = getCellValue(row, 3)   // Hora Ingreso
    const patenteChasis = parseString(getCellValue(row, 4))
    const patenteAcoplado = parseString(getCellValue(row, 5))
    const choferNombre = parseString(getCellValue(row, 6))
    const choferDni = parseString(getCellValue(row, 7))
    const transportistaNombre = parseString(getCellValue(row, 8))
    const ticketRaw = getCellValue(row, 9)
    const pesoBruto = parseNumber(getCellValue(row, 10))
    const pesoTara = parseNumber(getCellValue(row, 11))
    const pesoNeto = parseNumber(getCellValue(row, 12))
    const productorNombre = parseString(getCellValue(row, 13))
    const dte = parseString(getCellValue(row, 14))
    const guia = parseString(getCellValue(row, 15))
    const observaciones = parseString(getCellValue(row, 16))
    let numeroTicket = parseTicket(ticketRaw)
    
    // Si no hay ticket en el Excel, skip (es campo obligatorio)
    if (!numeroTicket) {
      errores++
      const msg = `Tropa ${tropaNumero}: sin número de ticket en Excel (campo obligatorio)`
      detalleErrores.push(`Fila ${rowNum}: ${msg}`)
      console.log(`   ❌ ${msg}`)
      continue
    }

    // Combinar fecha + hora
    let fechaIngreso = parseDate(fechaRaw)
    if (fechaIngreso && horaRaw) {
      const time = parseTime(horaRaw)
      if (time) {
        fechaIngreso.setHours(time.hours, time.minutes, 0, 0)
      }
    } else if (fechaIngreso) {
      fechaIngreso.setHours(12, 0, 0, 0)
    }

    // Buscar tropa por numero
    const tropa = await db.tropa.findFirst({
      where: { numero: tropaNumero },
      include: { pesajeCamion: true }
    })

    if (!tropa) {
      errores++
      const msg = `Tropa ${tropaNumero} no encontrada en la base`
      detalleErrores.push(`Fila ${rowNum}: ${msg}`)
      console.log(`   ❌ ${msg}`)
      continue
    }

    // Buscar transportista por nombre
    let transportistaId: string | null = null
    if (transportistaNombre) {
      const found = transportistaMap.get(transportistaNombre.toUpperCase())
      if (found) transportistaId = found
    }

    // Preparar datos del pesaje
    const pesajeData: any = {
      patenteChasis: patenteChasis || null,
      patenteAcoplado: patenteAcoplado || null,
      choferNombre: choferNombre || null,
      choferDni: choferDni || null,
      pesoBruto: pesoBruto,
      pesoTara: pesoTara,
      pesoNeto: pesoNeto,
      observaciones: observaciones || null,
      estado: (pesoBruto && pesoTara) ? 'CERRADO' : 'ABIERTO',
    }
    
    if (fechaIngreso) {
      pesajeData.fecha = fechaIngreso
      pesajeData.fechaTara = pesoTara ? fechaIngreso : null
    }
    
    pesajeData.numeroTicket = numeroTicket!
    if (transportistaId) pesajeData.transportistaId = transportistaId

    // Preparar datos de la tropa a actualizar
    const tropaData: any = {}
    if (fechaIngreso) tropaData.fechaRecepcion = fechaIngreso
    if (pesoBruto) tropaData.pesoBruto = pesoBruto
    if (pesoTara) tropaData.pesoTara = pesoTara
    if (pesoNeto) tropaData.pesoNeto = pesoNeto
    if (dte) tropaData.dte = String(dte)
    if (guia) tropaData.guia = String(guia)

    if (dryRun) {
      if (tropa.pesajeCamionId) {
        actualizados++
        console.log(`   [DRY] UPDATE Tropa ${tropaNumero} (${tropa.codigo}): pesaje existente, fecha=${fechaIngreso?.toISOString() || 'null'}, bruto=${pesoBruto}, tara=${pesoTara}, neto=${pesoNeto}, ticket=${numeroTicket}, DTE=${dte}, guía=${guia}`)
      } else {
        creados++
        console.log(`   [DRY] CREATE Tropa ${tropaNumero} (${tropa.codigo}): nuevo pesaje, fecha=${fechaIngreso?.toISOString() || 'null'}, bruto=${pesoBruto}, tara=${pesoTara}, neto=${pesoNeto}, ticket=${numeroTicket}, DTE=${dte}, guía=${guia}`)
      }
      continue
    }

    try {
      if (tropa.pesajeCamionId && tropa.pesajeCamion) {
        // UPDATE pesaje existente
        await db.pesajeCamion.update({
          where: { id: tropa.pesajeCamionId },
          data: pesajeData
        })
        actualizados++
        console.log(`   ✅ UPDATE Tropa ${tropaNumero} (${tropa.codigo}): pesaje actualizado`)
      } else {
        // CREATE nuevo pesaje y vincular a tropa
        const pesaje = await db.pesajeCamion.create({ data: pesajeData })
        await db.tropa.update({
          where: { id: tropa.id },
          data: { pesajeCamionId: pesaje.id }
        })
        creados++
        console.log(`   ✅ CREATE Tropa ${tropaNumero} (${tropa.codigo}): pesaje creado (ID: ${pesaje.id})`)
      }

      // Siempre actualizar campos de la tropa
      if (Object.keys(tropaData).length > 0) {
        await db.tropa.update({
          where: { id: tropa.id },
          data: tropaData
        })
      }
    } catch (err: any) {
      errores++
      const msg = `Error Tropa ${tropaNumero}: ${err.message}`
      detalleErrores.push(`Fila ${rowNum}: ${msg}`)
      console.log(`   ❌ ${msg}`)
    }
  }

  // 5. Resumen
  console.log('\n============================================')
  console.log('  RESUMEN')
  console.log('============================================')
  console.log(`Pesajes creados:    ${creados}`)
  console.log(`Pesajes actualizados: ${actualizados}`)
  console.log(`Errores:            ${errores}`)
  console.log(`Saltados:           ${saltados}`)
  
  if (detalleErrores.length > 0) {
    console.log('\nDetalle de errores:')
    for (const e of detalleErrores) {
      console.log(`  - ${e}`)
    }
  }

  // 6. Verificación
  console.log('\n--- Verificación ---')
  const totalTropas = await db.tropa.count()
  const conPesaje = await db.tropa.count({ where: { pesajeCamionId: { not: null } } })
  const sinPesaje = await db.tropa.count({ where: { pesajeCamionId: null } })
  console.log(`Total tropas: ${totalTropas}`)
  console.log(`Con pesaje camión: ${conPesaje}`)
  console.log(`Sin pesaje camión: ${sinPesaje}`)
  
  if (sinPesaje > 0) {
    const sinP = await db.tropa.findMany({
      where: { pesajeCamionId: null },
      select: { numero: true, codigo: true },
      orderBy: { numero: 'asc' },
      take: 10
    })
    console.log(`Primeras tropas sin pesaje: ${sinP.map(t => `${t.numero}(${t.codigo})`).join(', ')}`)
  }

  console.log('\n=== FIN ===')
}

main()
  .catch(e => { console.error('ERROR FATAL:', e); process.exit(1) })
  .finally(() => db.$disconnect())
