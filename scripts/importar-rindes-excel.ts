/**
 * Script de importación: Cargar datos de rinde desde Excel
 * - Tropa 175: ACTUALIZAR los romaneos existentes (null weights) + crear faltantes
 * - Tropas 192-203: CREAR todos los romaneos (no existen en DB)
 *
 * Parser dinámico: busca labels ("Nº Tropa", "Fecha", "Garrón") en vez de
 * posiciones fijas, para adaptarse al layout real del Excel.
 *
 * Ejecutar con: npx tsx scripts/importar-rindes-excel.ts
 */
import { PrismaClient } from '@prisma/client'
import ExcelJS from 'exceljs'

const prisma = new PrismaClient()

// Target sheets to import
const TARGET_SHEETS = [
  'T 175', 'T 192', 'T 193', 'T 194', 'T 195', 'T 196', 'T 197',
  'T 198', 'T 199', 'T 200', 'T 201', 'T 202', 'T 203'
]

interface RowData {
  garron: number
  numeroAnimal: number | null
  raza: string | null
  denticion: string | null
  tipoAnimal: string | null
  caravana: string | null
  pesoVivo: number | null
  pesoMediaIzq: number | null
  pesoMediaDer: number | null
  pesoTotal: number | null
  rinde: number | null
}

function getCellValue(cell: ExcelJS.Cell): any {
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

function getCellText(cell: ExcelJS.Cell): string {
  const val = getCellValue(cell)
  if (val === null || val === undefined) return ''
  return String(val).trim()
}

/**
 * Scan cells in a range to find a label and return the value from the same or next cell.
 * Searches rows [startRow, endRow] and columns [startCol, endCol].
 * Returns the first numeric value found after the label in the same row.
 */
function findValueByLabel(
  ws: ExcelJS.Worksheet,
  labelText: string,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number,
  lookAhead: boolean = true
): number | null {
  for (let r = startRow; r <= endRow; r++) {
    const row = ws.getRow(r)
    for (let c = startCol; c <= endCol; c++) {
      const text = getCellText(row.getCell(c))
      if (text.toUpperCase().includes(labelText.toUpperCase())) {
        // Found the label, now look for a numeric value in same row, columns [c+1, endCol]
        if (lookAhead) {
          for (let nc = c + 1; nc <= endCol + 3; nc++) {
            const nextVal = getCellValue(row.getCell(nc))
            if (nextVal !== null && nextVal !== undefined && !isNaN(Number(nextVal))) {
              return Number(nextVal)
            }
          }
        }
        // If no look-ahead, try this cell's value
        const thisVal = getCellValue(row.getCell(c))
        if (thisVal !== null && thisVal !== undefined && !isNaN(Number(thisVal))) {
          return Number(thisVal)
        }
      }
    }
  }
  return null
}

/**
 * Find a date value by label
 */
function findDateByLabel(
  ws: ExcelJS.Worksheet,
  labelText: string,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number
): Date | null {
  for (let r = startRow; r <= endRow; r++) {
    const row = ws.getRow(r)
    for (let c = startCol; c <= endCol; c++) {
      const text = getCellText(row.getCell(c))
      if (text.toUpperCase().includes(labelText.toUpperCase())) {
        // Look for a date in the same row, next columns
        for (let nc = c + 1; nc <= endCol + 3; nc++) {
          const nextVal = getCellValue(row.getCell(nc))
          if (nextVal instanceof Date) return nextVal
          // Try parsing as date string
          if (typeof nextVal === 'number' && nextVal > 40000 && nextVal < 60000) {
            // Excel serial date number
            return new Date((nextVal - 25569) * 86400 * 1000)
          }
          if (typeof nextVal === 'string') {
            const parsed = new Date(nextVal)
            if (!isNaN(parsed.getTime())) return parsed
          }
        }
      }
    }
  }
  return null
}

/**
 * Find the header row that contains column labels like "Garrón", "Garron", "Caravana", etc.
 * Returns the column mapping and the header row number.
 */
function findDataHeaderRow(
  ws: ExcelJS.Worksheet,
  maxRow: number = 30
): { headerRow: number; colMap: Map<string, number> } | null {
  const headerKeywords = [
    ['garron', 'garrón', 'garr\u00f3n', 'garr', 'n'],
    ['animal', 'nro', 'nº', 'numero'],
    ['raza'],
    ['dent', 'dentic'],
    ['clasif', 'tipo'],
    ['caravana', 'carav'],
    ['kg ent', 'entrada', 'peso vivo', 'pv', 'kg.entr'],
    ['media', 'izq', 'izquierda', 'med a'],
    ['media', 'der', 'derecha', 'med b'],
    ['total', 'kg total'],
    ['rinde', '%', 'rendim']
  ]

  for (let r = 1; r <= maxRow; r++) {
    const row = ws.getRow(r)
    if (!row || row.cellCount === 0) continue

    // Get all non-empty cell texts for this row
    const colTexts: Map<number, string> = new Map()
    for (let c = 1; c <= 20; c++) {
      const text = getCellText(row.getCell(c)).toLowerCase()
      if (text.length > 0) colTexts.set(c, text)
    }

    if (colTexts.size === 0) continue

    // Check if this row looks like a header (contains at least "garron" and one weight keyword)
    const allTexts = Array.from(colTexts.values()).join(' ')
    if (!allTexts.includes('garr')) continue
    if (!allTexts.includes('kg') && !allTexts.includes('peso') && !allTexts.includes('media')) continue

    // Found the header row! Now map columns
    const colMap = new Map<string, number>()

    // For each keyword group, find the matching column
    for (const [c, text] of colTexts) {
      if (text.includes('garr')) colMap.set('GARRON', c)
      else if (text.includes('animal') || text.includes('nro') || text.includes('numero') || (text.includes('n') && text.includes('º'))) colMap.set('ANIMAL', c)
      else if (text.includes('raza')) colMap.set('RAZA', c)
      else if (text.includes('dent')) colMap.set('DENTICION', c)
      else if (text.includes('clasif') || text.includes('tipo')) colMap.set('CLASIF', c)
      else if (text.includes('carav')) colMap.set('CARAVANA', c)
      else if (text.includes('ent') || text.includes('vivo') || text.includes('pv')) colMap.set('KG_ENTRADA', c)
      else if (text.includes('izq') || text.includes('medi') && text.includes('a')) colMap.set('KG_MEDIA_A', c)
      else if (text.includes('der') || text.includes('medi') && text.includes('b')) colMap.set('KG_MEDIA_B', c)
      else if (text.includes('total')) colMap.set('TOTAL_KG', c)
      else if (text.includes('rinde') || text.includes('%')) colMap.set('RINDE', c)
    }

    if (colMap.has('GARRON')) {
      return { headerRow: r, colMap }
    }
  }

  return null
}

function parseSheet(ws: ExcelJS.Worksheet, sheetName: string): { tropaNumero: number; fechaFaena: Date | null; rows: RowData[] } | null {
  console.log(`\n🔍 Analizando hoja "${sheetName}"...`)

  // 1. Try to extract tropa number from sheet name first: "T 175" → 175
  const nameMatch = sheetName.match(/(\d+)/)
  const tropaFromName = nameMatch ? parseInt(nameMatch[1]) : null

  // 2. Also search in cells for "Nº Tropa" label
  const tropaFromCells = findValueByLabel(ws, 'tropa', 1, 25, 1, 10)
  const tropaNumero = tropaFromCells || tropaFromName

  if (!tropaNumero) {
    console.log(`   ⚠️ No se pudo determinar el número de tropa`)
    return null
  }
  console.log(`   📌 Nº Tropa: ${tropaNumero} (desde ${tropaFromCells ? 'celdas' : 'nombre de hoja'})`)

  // 3. Find fecha faena
  const fechaFaena = findDateByLabel(ws, 'fecha', 1, 25, 1, 10)
  console.log(`   📅 Fecha faena: ${fechaFaena ? fechaFaena.toISOString().split('T')[0] : 'no encontrada'}`)

  // 4. Find data header row dynamically
  const headerInfo = findDataHeaderRow(ws)
  if (!headerInfo) {
    console.log(`   ⚠️ No se encontró fila de encabezado de datos`)
    return null
  }

  const { headerRow, colMap } = headerInfo
  console.log(`   📋 Fila encabezado: ${headerRow}`)
  console.log(`   📋 Columnas mapeadas:`)
  for (const [key, col] of colMap) {
    console.log(`      ${key} → columna ${col}`)
  }

  // 5. Parse data rows (start after header row)
  const rows: RowData[] = []
  const garronCol = colMap.get('GARRON')
  if (!garronCol) {
    console.log(`   ⚠️ No se encontró columna de garrón`)
    return null
  }

  for (let r = headerRow + 1; r <= 80; r++) {
    const row = ws.getRow(r)
    const garronVal = getCellValue(row.getCell(garronCol))

    if (garronVal === null || garronVal === undefined || garronVal === '') continue

    const garron = Number(garronVal)
    if (isNaN(garron) || garron <= 0) continue

    // Check if this is a totals row or subheader (skip)
    const garronText = String(garronVal).trim().toLowerCase()
    if (garronText.includes('total') || garronText.includes('promed')) continue

    const kgEntrada = colMap.has('KG_ENTRADA') ? getCellValue(row.getCell(colMap.get('KG_ENTRADA')!)) : null
    const kgMediaA = colMap.has('KG_MEDIA_A') ? getCellValue(row.getCell(colMap.get('KG_MEDIA_A')!)) : null
    const kgMediaB = colMap.has('KG_MEDIA_B') ? getCellValue(row.getCell(colMap.get('KG_MEDIA_B')!)) : null
    const totalKg = colMap.has('TOTAL_KG') ? getCellValue(row.getCell(colMap.get('TOTAL_KG')!)) : null
    const rindeVal = colMap.has('RINDE') ? getCellValue(row.getCell(colMap.get('RINDE')!)) : null

    // Denticion
    const dentCell = colMap.has('DENTICION') ? getCellText(row.getCell(colMap.get('DENTICION')!)) : ''
    const clasifCell = colMap.has('CLASIF') ? getCellText(row.getCell(colMap.get('CLASIF')!)) : ''
    const denticionMatch = dentCell.match(/(\d+)\s*D/i)
    const denticion = denticionMatch ? denticionMatch[1] : null

    const pesoMediaIzq = kgMediaA !== null && kgMediaA !== undefined ? Number(kgMediaA) : null
    const pesoMediaDer = kgMediaB !== null && kgMediaB !== undefined ? Number(kgMediaB) : null
    const pesoTotalCalc = totalKg !== null && totalKg !== undefined ? Number(totalKg)
      : (pesoMediaIzq !== null && pesoMediaDer !== null ? pesoMediaIzq + pesoMediaDer : null)

    rows.push({
      garron,
      numeroAnimal: colMap.has('ANIMAL') && getCellValue(row.getCell(colMap.get('ANIMAL')!)) ? Number(getCellValue(row.getCell(colMap.get('ANIMAL')!))) : null,
      raza: colMap.has('RAZA') ? getCellText(row.getCell(colMap.get('RAZA')!)) || null : null,
      denticion,
      tipoAnimal: clasifCell || null,
      caravana: colMap.has('CARAVANA') ? getCellText(row.getCell(colMap.get('CARAVANA')!)) || null : null,
      pesoVivo: kgEntrada !== null && kgEntrada !== undefined ? Number(kgEntrada) : null,
      pesoMediaIzq,
      pesoMediaDer,
      pesoTotal: pesoTotalCalc,
      rinde: rindeVal !== null && rindeVal !== undefined ? Number(rindeVal) * 100 : null // decimal → %
    })
  }

  console.log(`   ✅ ${rows.length} filas de datos encontradas`)
  return { tropaNumero, fechaFaena, rows }
}

async function main() {
  console.log('============================================')
  console.log('  IMPORTACIÓN: RINDES DESDE EXCEL')
  console.log('============================================\n')

  // 1. Read Excel file
  const excelPath = process.argv[2] || './upload/RINDE FAENA BOVINO.xlsx'
  console.log('Leyendo archivo:', excelPath)

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(excelPath)

  // List sheets
  console.log('\nHojas encontradas:')
  wb.eachWorksheet((ws) => {
    const isTarget = TARGET_SHEETS.includes(ws.name)
    console.log(`  ${isTarget ? '✅' : '  '} "${ws.name}" (${ws.rowCount} filas)`)
  })

  let totalCreated = 0
  let totalUpdated = 0
  let totalErrors = 0

  for (const sheetName of TARGET_SHEETS) {
    const ws = wb.getWorksheet(sheetName)
    if (!ws) {
      console.log(`\n⚠️ Hoja "${sheetName}" no encontrada, saltando...`)
      continue
    }

    const parsed = parseSheet(ws, sheetName)
    if (!parsed || parsed.rows.length === 0) {
      console.log(`⚠️ "${sheetName}": sin datos válidos, saltando...`)
      continue
    }

    const { tropaNumero, fechaFaena, rows } = parsed

    // Find tropa in DB
    const tropa = await prisma.tropa.findFirst({
      where: { numero: tropaNumero }
    })

    if (!tropa) {
      console.log(`❌ "${sheetName}": Tropa ${tropaNumero} no encontrada en DB, saltando...`)
      totalErrors++
      continue
    }

    console.log(`\n📌 DB: Tropa ${tropaNumero} (codigo="${tropa.codigo}", cabezas=${tropa.cantidadCabezas})`)

    // Check existing romaneos
    const existingRomaneos = await prisma.romaneo.findMany({
      where: { tropaCodigo: tropa.codigo },
      select: { id: true, garron: true, pesoVivo: true, pesoTotal: true }
    })
    const existingByGarron = new Map(existingRomaneos.map(r => [r.garron, r]))
    console.log(`   Romaneos existentes: ${existingRomaneos.length}`)

    // Process each row
    for (const row of rows) {
      try {
        const existing = existingByGarron.get(row.garron)

        const data = {
          tropaCodigo: tropa.codigo,
          fecha: fechaFaena || tropa.fechaRecepcion || new Date(),
          garron: row.garron,
          numeroAnimal: row.numeroAnimal,
          raza: row.raza,
          denticion: row.denticion,
          tipoAnimal: row.tipoAnimal as any || undefined,
          pesoVivo: row.pesoVivo,
          pesoMediaIzq: row.pesoMediaIzq,
          pesoMediaDer: row.pesoMediaDer,
          pesoTotal: row.pesoTotal,
          rinde: row.rinde,
          estado: 'PENDIENTE' as const,
        }

        if (existing) {
          // UPDATE
          await prisma.romaneo.update({
            where: { id: existing.id },
            data
          })
          totalUpdated++
          console.log(`   ✏️ garron=${row.garron}: ACTUALIZADO (pesoVivo=${existing.pesoVivo}→${row.pesoVivo}, total=${existing.pesoTotal}→${row.pesoTotal})`)
        } else {
          // CREATE
          await prisma.romaneo.create({ data })
          totalCreated++
          console.log(`   ✅ garron=${row.garron}: CREADO (pesoVivo=${row.pesoVivo}, mediaIzq=${row.pesoMediaIzq}, mediaDer=${row.pesoMediaDer})`)
        }
      } catch (err: any) {
        console.log(`   ❌ garron=${row.garron}: ERROR - ${err.message}`)
        totalErrors++
      }
    }
  }

  console.log('\n============================================')
  console.log('  RESUMEN')
  console.log('============================================')
  console.log(`Romaneos CREADOS:       ${totalCreated}`)
  console.log(`Romaneos ACTUALIZADOS:  ${totalUpdated}`)
  console.log(`Errores:               ${totalErrors}`)
  console.log('============================================')
}

main()
  .catch(e => { console.error('ERROR FATAL:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
