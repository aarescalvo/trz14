/**
 * Script de importación: Cargar datos de rinde desde Excel
 * - Tropa 175: CREAR romaneos faltantes + ACTUALIZAR existentes con datos null
 * - Tropas 192-203: CREAR todos los romaneos (no existen en DB)
 *
 * Layout del Excel (T 175, T 192-203, todas con 14 columnas):
 *   Col 2(B): vacío
 *   Col 3(C): GARRON
 *   Col 4(D): Nº ANIMAL
 *   Col 5(E): RAZA
 *   Col 6(F): Denticion (ej: "2D - NT")
 *   Col 7(G): Clasificacion (ej: "NT")
 *   Col 8(H): Nº CARAVANA
 *   Col 9(I): KG ENTRADA (pesoVivo)
 *   Col 10(J): KG 1/2 A (pesoMediaIzq)
 *   Col 11(K): KG 1/2 B (pesoMediaDer)
 *   Col 12(L): TOTAL KG (pesoTotal)
 *   Col 13(M): RINDE FAENA
 *
 * Parser: escanea fila 23 (header) + fila 24 (sub-header) para mapear columnas.
 * - UPDATE registros existentes que tengan pesoMediaIzq=null (datos incompletos)
 * - SKIP registros existentes con datos completos (no sobreescribe)
 * - CREATE registros nuevos
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
  if (typeof cell.value === 'object' && 'result' in cell.value) {
    return (cell.value as any).result
  }
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

function findValueByLabel(
  ws: ExcelJS.Worksheet,
  labelText: string,
  startRow: number,
  endRow: number,
  startCol: number,
  endCol: number
): number | null {
  for (let r = startRow; r <= endRow; r++) {
    const row = ws.getRow(r)
    for (let c = startCol; c <= endCol; c++) {
      const text = getCellText(row.getCell(c))
      if (text.toUpperCase().includes(labelText.toUpperCase())) {
        for (let nc = c + 1; nc <= endCol + 3; nc++) {
          const nextVal = getCellValue(row.getCell(nc))
          if (nextVal !== null && nextVal !== undefined && !isNaN(Number(nextVal))) {
            return Number(nextVal)
          }
        }
      }
    }
  }
  return null
}

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
        for (let nc = c + 1; nc <= endCol + 3; nc++) {
          const nextVal = getCellValue(row.getCell(nc))
          if (nextVal instanceof Date) return nextVal
          if (typeof nextVal === 'number' && nextVal > 40000 && nextVal < 60000) {
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
 * Find data header row and map columns.
 * Scans the header row AND the next row (sub-header) to handle merged cells.
 * Uses priority-based matching: more specific keywords take precedence.
 * Never overwrites an already-mapped column key.
 */
function findDataHeaderRow(
  ws: ExcelJS.Worksheet,
  maxRow: number = 30
): { headerRow: number; colMap: Map<string, number> } | null {
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

    // Check if this row looks like a header (contains "garr" AND "kg")
    const allTexts = Array.from(colTexts.values()).join(' ')
    if (!allTexts.includes('garr')) continue
    if (!allTexts.includes('kg')) continue

    // Found header row! Now collect texts from header row + sub-header row
    const colTextsCombined: Map<number, string> = new Map()
    for (let scanR = r; scanR <= Math.min(r + 1, maxRow); scanR++) {
      const scanRow = ws.getRow(scanR)
      for (let c = 1; c <= 20; c++) {
        const text = getCellText(scanRow.getCell(c)).toLowerCase()
        if (text.length > 0) {
          const prev = colTextsCombined.get(c) || ''
          colTextsCombined.set(c, (prev + ' ' + text).trim())
        }
      }
    }

    // Map columns using priority matching (most specific first)
    // Never overwrite an already-assigned key
    const colMap = new Map<string, number>()

    for (const [c, combined] of colTextsCombined) {
      if (combined.includes('garr') && !colMap.has('GARRON')) {
        colMap.set('GARRON', c)
      }
      // ANIMAL: match "animal" but NOT "caravana" or "tipo de animal"
      else if (combined.includes('animal') && !combined.includes('caravana') && !combined.includes('tipo') && !colMap.has('ANIMAL')) {
        colMap.set('ANIMAL', c)
      }
      else if (combined.includes('raza') && !colMap.has('RAZA')) {
        colMap.set('RAZA', c)
      }
      else if (combined.includes('dent') && !colMap.has('DENTICION')) {
        colMap.set('DENTICION', c)
      }
      else if (combined.includes('clasif') && !colMap.has('CLASIF')) {
        colMap.set('CLASIF', c)
      }
      else if (combined.includes('tipo') && !colMap.has('CLASIF') && !colMap.has('DENTICION')) {
        colMap.set('CLASIF', c)
      }
      else if (combined.includes('carav') && !colMap.has('CARAVANA')) {
        colMap.set('CARAVANA', c)
      }
      // KG 1/2 A / KG 1/2 B: the actual column names in this Excel
      else if ((combined.includes('1/2 a') || combined.includes('½ a')) && !colMap.has('KG_MEDIA_A')) {
        colMap.set('KG_MEDIA_A', c)
      }
      else if ((combined.includes('1/2 b') || combined.includes('½ b')) && !colMap.has('KG_MEDIA_B')) {
        colMap.set('KG_MEDIA_B', c)
      }
      // KG ENTRADA: "kg entrada" or "kg ent"
      else if ((combined.includes('entrada') || combined.includes('kg ent')) && !colMap.has('KG_ENTRADA')) {
        colMap.set('KG_ENTRADA', c)
      }
      else if (combined.includes('total') && !colMap.has('TOTAL_KG')) {
        colMap.set('TOTAL_KG', c)
      }
      else if (combined.includes('rinde') && !colMap.has('RINDE')) {
        colMap.set('RINDE', c)
      }
    }

    if (colMap.has('GARRON')) {
      return { headerRow: r, colMap }
    }
  }

  return null
}

function parseSheet(ws: ExcelJS.Worksheet, sheetName: string): { tropaNumero: number; fechaFaena: Date | null; rows: RowData[] } | null {
  console.log(`\n🔍 Analizando hoja "${sheetName}"...`)

  // 1. Extract tropa number from sheet name: "T 175" → 175
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

  // Validate critical columns
  const critical = ['GARRON', 'KG_ENTRADA', 'KG_MEDIA_A', 'KG_MEDIA_B']
  const missing = critical.filter(k => !colMap.has(k))
  if (missing.length > 0) {
    console.log(`   ⚠️ Columnas críticas faltantes: ${missing.join(', ')}`)
  }

  // 5. Parse data rows (start after sub-header row: headerRow + 2)
  const rows: RowData[] = []
  const garronCol = colMap.get('GARRON')!
  const dataStartRow = headerRow + 2 // skip header + sub-header

  for (let r = dataStartRow; r <= 80; r++) {
    const row = ws.getRow(r)
    const garronVal = getCellValue(row.getCell(garronCol))

    if (garronVal === null || garronVal === undefined || garronVal === '') continue

    const garron = Number(garronVal)
    if (isNaN(garron) || garron <= 0) continue

    // Skip totals/subtotals rows
    const garronText = String(garronVal).trim().toLowerCase()
    if (garronText.includes('total') || garronText.includes('promed')) continue

    const kgEntrada = colMap.has('KG_ENTRADA') ? getCellValue(row.getCell(colMap.get('KG_ENTRADA')!)) : null
    const kgMediaA = colMap.has('KG_MEDIA_A') ? getCellValue(row.getCell(colMap.get('KG_MEDIA_A')!)) : null
    const kgMediaB = colMap.has('KG_MEDIA_B') ? getCellValue(row.getCell(colMap.get('KG_MEDIA_B')!)) : null
    const totalKg = colMap.has('TOTAL_KG') ? getCellValue(row.getCell(colMap.get('TOTAL_KG')!)) : null
    const rindeVal = colMap.has('RINDE') ? getCellValue(row.getCell(colMap.get('RINDE')!)) : null

    // Denticion: extract number from "2D - NT" → "2"
    const dentCell = colMap.has('DENTICION') ? getCellText(row.getCell(colMap.get('DENTICION')!)) : ''
    const denticionMatch = dentCell.match(/(\d+)\s*D/i)
    const denticion = denticionMatch ? denticionMatch[1] : null

    const pesoMediaIzq = kgMediaA !== null && kgMediaA !== undefined ? Number(kgMediaA) : null
    const pesoMediaDer = kgMediaB !== null && kgMediaB !== undefined ? Number(kgMediaB) : null
    const pesoTotalCalc = totalKg !== null && totalKg !== undefined ? Number(totalKg)
      : (pesoMediaIzq !== null && pesoMediaDer !== null ? pesoMediaIzq + pesoMediaDer : null)

    // ANIMAL: safely convert (may be text like caravana codes)
    let numeroAnimal: number | null = null
    if (colMap.has('ANIMAL')) {
      const animalVal = getCellValue(row.getCell(colMap.get('ANIMAL')!))
      if (animalVal !== null && animalVal !== undefined && typeof animalVal === 'number') {
        numeroAnimal = animalVal
      } else if (animalVal !== null && animalVal !== undefined && !isNaN(Number(animalVal))) {
        numeroAnimal = Number(animalVal)
      }
    }

    rows.push({
      garron,
      numeroAnimal,
      raza: colMap.has('RAZA') ? getCellText(row.getCell(colMap.get('RAZA')!)) || null : null,
      denticion,
      tipoAnimal: colMap.has('CLASIF') ? getCellText(row.getCell(colMap.get('CLASIF')!)) || null : null,
      caravana: colMap.has('CARAVANA') ? getCellText(row.getCell(colMap.get('CARAVANA')!)) || null : null,
      pesoVivo: kgEntrada !== null && kgEntrada !== undefined ? Number(kgEntrada) : null,
      pesoMediaIzq,
      pesoMediaDer,
      pesoTotal: pesoTotalCalc,
      rinde: rindeVal !== null && rindeVal !== undefined ? Number(rindeVal) * 100 : null
    })
  }

  console.log(`   ✅ ${rows.length} filas de datos encontradas`)
  return { tropaNumero, fechaFaena, rows }
}

async function main() {
  console.log('============================================')
  console.log('  IMPORTACIÓN: RINDES DESDE EXCEL')
  console.log('============================================\n')

  const excelPath = process.argv[2] || './upload/RINDE FAENA BOVINO.xlsx'
  console.log('Leyendo archivo:', excelPath)

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(excelPath)

  // List target sheets
  console.log('\nHojas objetivo:')
  for (const ws of wb.worksheets) {
    if (TARGET_SHEETS.includes(ws.name)) {
      console.log(`  ✅ "${ws.name}" (${ws.rowCount} filas, ${ws.columnCount} cols)`)
    }
  }

  let totalCreated = 0
  let totalUpdated = 0
  let totalSkipped = 0
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
      select: { id: true, garron: true, pesoVivo: true, pesoMediaIzq: true, pesoMediaDer: true, pesoTotal: true }
    })
    const existingByGarron = new Map(existingRomaneos.map(r => [r.garron, r]))
    console.log(`   Romaneos existentes: ${existingRomaneos.length}`)

    // Process each row
    for (const row of rows) {
      try {
        const existing = existingByGarron.get(row.garron)

        if (existing) {
          // Check if existing record has incomplete data (missing media weights)
          if (existing.pesoMediaIzq === null && row.pesoMediaIzq !== null) {
            // UPDATE: fill in missing media data
            await prisma.romaneo.update({
              where: { id: existing.id },
              data: {
                numeroAnimal: row.numeroAnimal ?? existing.numeroAnimal ?? undefined,
                raza: row.raza ?? undefined,
                denticion: row.denticion ?? undefined,
                tipoAnimal: (row.tipoAnimal as any) ?? undefined,
                caravana: row.caravana ?? undefined,
                pesoVivo: row.pesoVivo ?? existing.pesoVivo ?? undefined,
                pesoMediaIzq: row.pesoMediaIzq,
                pesoMediaDer: row.pesoMediaDer,
                pesoTotal: row.pesoTotal ?? existing.pesoTotal ?? undefined,
                rinde: row.rinde ?? undefined,
              }
            })
            totalUpdated++
            console.log(`   ✏️ garron=${row.garron}: ACTUALIZADO (mediaIzq=${existing.pesoMediaIzq}→${row.pesoMediaIzq}, mediaDer=${existing.pesoMediaDer}→${row.pesoMediaDer})`)
          } else {
            // SKIP: already has complete data
            totalSkipped++
            console.log(`   ⏭️ garron=${row.garron}: OMITIDO (ya tiene datos)`)
          }
        } else {
          // CREATE: new romaneo
          await prisma.romaneo.create({
            data: {
              tropaCodigo: tropa.codigo,
              fecha: fechaFaena || tropa.fechaRecepcion || new Date(),
              garron: row.garron,
              numeroAnimal: row.numeroAnimal,
              raza: row.raza,
              denticion: row.denticion,
              tipoAnimal: row.tipoAnimal as any || undefined,
              caravana: row.caravana,
              pesoVivo: row.pesoVivo,
              pesoMediaIzq: row.pesoMediaIzq,
              pesoMediaDer: row.pesoMediaDer,
              pesoTotal: row.pesoTotal,
              rinde: row.rinde,
              estado: 'PENDIENTE' as const,
            }
          })
          totalCreated++
          console.log(`   ✅ garron=${row.garron}: CREADO (vivo=${row.pesoVivo}, medA=${row.pesoMediaIzq}, medB=${row.pesoMediaDer}, total=${row.pesoTotal})`)
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
  console.log(`Romaneos OMITIDOS:      ${totalSkipped}`)
  console.log(`Errores:               ${totalErrors}`)
  console.log('============================================')
}

main()
  .catch(e => { console.error('ERROR FATAL:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
