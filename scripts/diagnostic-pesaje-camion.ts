/**
 * ======================================================================
 * DIAGNÓSTICO: Estructura completa de PLANTILLA_PESAJE_CAMION.xlsx
 * ======================================================================
 *
 * Propósito: Entender la estructura del Excel de pesaje de camión
 * para poder escribir un script de importación de tropas hasta la 203
 * en el sistema TrazaAlan.
 *
 * Uso:
 *   cd /home/z/my-project && npx tsx trz13/scripts/diagnostic-pesaje-camion.ts
 *
 * IMPORTANTE: No usa Prisma ni base de datos. Solo lee el Excel.
 * ======================================================================
 */
import ExcelJS from 'exceljs'
import * as path from 'path'

// ─── Helpers ───────────────────────────────────────────────────────────

/** Format a cell value to a readable string */
function cellToString(value: any): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'object') {
    // ExcelJS rich text
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((r: any) => r.text || '').join('')
    }
    // ExcelJS formula
    if ('result' in value) return String(value.result)
    // Date object
    if (value instanceof Date) {
      return value.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
    }
    // Hyperlink
    if ('hyperlink' in value) return `[link: ${value.hyperlink}]`
    // Fallback
    return JSON.stringify(value)
  }
  return String(value)
}

/** Convert column number to letter(s): 1=A, 26=Z, 27=AA */
function colToLetter(col: number): string {
  let result = ''
  while (col > 0) {
    const remainder = (col - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    col = Math.floor((col - 1) / 26)
  }
  return result
}

/** Check if a value looks like a date */
function isDateValue(value: any): boolean {
  if (value instanceof Date) return true
  return false
}

/** Check if a value is numeric */
function isNumericValue(value: any): boolean {
  if (typeof value === 'number') return true
  if (typeof value === 'object' && 'result' in value && typeof value.result === 'number') return true
  return false
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main() {
  const excelPath = path.resolve('/home/z/my-project/upload/PLANTILLA_PESAJE_CAMION.xlsx')

  console.log('═════════════════════════════════════════════════════════════════')
  console.log('  DIAGNÓSTICO: PLANTILLA_PESAJE_CAMION.xlsx')
  console.log('  Ruta:', excelPath)
  console.log('═════════════════════════════════════════════════════════════════')

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(excelPath)

  // ══════════════════════════════════════════════════════════════════════
  // 1. ALL SHEET NAMES
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n┌─────────────────────────────────────────────────────────────┐')
  console.log('│  1. HOJAS DEL LIBRO                                        │')
  console.log('└─────────────────────────────────────────────────────────────┘')

  const worksheets = wb.worksheets
  console.log(`  Total de hojas: ${worksheets.length}\n`)

  worksheets.forEach((ws, idx) => {
    console.log(
      `  [${idx}] "${ws.name}" ` +
      `│ Filas: ${ws.rowCount.toString().padStart(5)} ` +
      `│ Columnas: ${ws.columnCount.toString().padStart(3)}`
    )
  })

  // ══════════════════════════════════════════════════════════════════════
  // 2. DETAILED VIEW PER SHEET (rows, columns, actual used range)
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n┌─────────────────────────────────────────────────────────────┐')
  console.log('│  2. DETALLE POR HOJA                                       │')
  console.log('└─────────────────────────────────────────────────────────────┘')

  for (const ws of worksheets) {
    // Find actual used range
    let minRow = Infinity, maxRow = 0, minCol = Infinity, maxCol = 0
    let nonEmptyCells = 0
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      minRow = Math.min(minRow, rowNumber)
      maxRow = Math.max(maxRow, rowNumber)
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
          minCol = Math.min(minCol, colNumber)
          maxCol = Math.max(maxCol, colNumber)
          nonEmptyCells++
        }
      })
    })

    console.log(`\n  Hoja: "${ws.name}"`)
    console.log(`    Rango usado: filas ${minRow === Infinity ? '-' : minRow}-${maxRow || '-'}, cols ${minCol === Infinity ? '-' : colToLetter(minCol)}-${maxCol ? colToLetter(maxCol) : '-'}`)
    console.log(`    Celdas no vacías: ${nonEmptyCells}`)
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3. FIRST SHEET: Dump first 15 rows (all cells)
  // ══════════════════════════════════════════════════════════════════════
  const firstSheet = worksheets[0]
  if (!firstSheet) {
    console.log('\n❌ No se encontraron hojas en el archivo.')
    process.exit(1)
  }

  console.log('\n┌─────────────────────────────────────────────────────────────┐')
  console.log(`│  3. PRIMERAS 15 FILAS DE "${firstSheet.name}" (todas las celdas)         │`)
  console.log('└─────────────────────────────────────────────────────────────┘')

  const maxColsToDump = Math.max(firstSheet.columnCount, 20)

  // Print column headers
  let headerLine = '     '
  for (let c = 1; c <= maxColsToDump; c++) {
    headerLine += colToLetter(c).padStart(4)
  }
  console.log('\n  ' + headerLine)
  console.log('  ' + '─'.repeat(headerLine.length))

  for (let r = 1; r <= Math.min(15, firstSheet.rowCount + 20); r++) {
    const row = firstSheet.getRow(r)
    let rowStr = `R${String(r).padStart(3)} `
    let hasContent = false

    for (let c = 1; c <= maxColsToDump; c++) {
      const cell = row.getCell(c)
      const val = cellToString(cell.value)
      if (val.length > 3) {
        rowStr += val.substring(0, 3).padStart(4)
        hasContent = true
      } else {
        rowStr += val.padStart(4)
        if (val) hasContent = true
      }
    }

    // Also show if row has content beyond our column range
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (colNumber > maxColsToDump) hasContent = true
    })

    if (hasContent || row.hasValues) {
      console.log('  ' + rowStr)
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 4. FULL DETAILED FIRST 10 ROWS (wide view with full cell values)
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n┌─────────────────────────────────────────────────────────────┐')
  console.log(`│  4. VISTA DETALLADA: Primeras 10 filas de "${firstSheet.name}"       │`)
  console.log('└─────────────────────────────────────────────────────────────┘')

  for (let r = 1; r <= Math.min(10, firstSheet.rowCount + 20); r++) {
    const row = firstSheet.getRow(r)
    const cells: { col: string; val: string; type: string }[] = []

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const val = cellToString(cell.value)
      let type = 'str'
      if (isDateValue(cell.value)) type = 'date'
      else if (isNumericValue(cell.value)) type = 'num'
      if (val || cell.value !== null && cell.value !== undefined) {
        cells.push({ col: colToLetter(colNumber), val, type })
      }
    })

    if (cells.length === 0) continue

    console.log(`\n  ── Fila ${r} ──`)
    for (const c of cells) {
      console.log(`    ${c.col} [${c.type}] = "${c.val}"`)
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 5. IDENTIFY COLUMNS (scan header row + data patterns)
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n┌─────────────────────────────────────────────────────────────┐')
  console.log('│  5. IDENTIFICACIÓN DE COLUMNAS                              │')
  console.log('└─────────────────────────────────────────────────────────────┘')

  // Scan first 5 rows for header-like content
  const headerRows: Map<number, Map<number, string>> = new Map()
  for (let r = 1; r <= Math.min(5, firstSheet.rowCount + 20); r++) {
    const row = firstSheet.getRow(r)
    const rowData: Map<number, string> = new Map()
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const val = cellToString(cell.value)
      if (val) rowData.set(colNumber, val)
    })
    if (rowData.size > 0) headerRows.set(r, rowData)
  }

  // Try to find the header row (the one with most text columns)
  let headerRowNum = 1
  let maxTextCols = 0
  for (const [rNum, cells] of headerRows) {
    const textCount = [...cells.values()].filter(v => isNaN(Number(v)) && v.trim() !== '').length
    if (textCount > maxTextCols) {
      maxTextCols = textCount
      headerRowNum = rNum
    }
  }

  console.log(`\n  Fila de encabezados detectada: ${headerRowNum}`)
  console.log(`  (fila con más columnas de texto: ${maxTextCols} columnas)\n`)

  // Map column letters to header names
  const columnMap: Map<number, string> = new Map()
  const headerData = headerRows.get(headerRowNum)
  if (headerData) {
    for (const [col, name] of headerData) {
      columnMap.set(col, name.trim())
    }
  }

  // Also check the row before and after for merged header titles
  for (let r = 1; r <= Math.min(5, firstSheet.rowCount + 20); r++) {
    if (r === headerRowNum) continue
    const rowData = headerRows.get(r)
    if (rowData) {
      for (const [col, val] of rowData) {
        if (!columnMap.has(col)) {
          columnMap.set(col, val.trim())
        }
      }
    }
  }

  // Also analyze by data patterns (dates, numbers, text)
  // Scan first 50 data rows
  const dataStartRow = headerRowNum + 1
  const colPatterns: Map<number, { dates: number; numbers: number; text: number; samples: string[] }> = new Map()

  for (let r = dataStartRow; r <= Math.min(dataStartRow + 49, firstSheet.rowCount + 100); r++) {
    const row = firstSheet.getRow(r)
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (!colPatterns.has(colNumber)) {
        colPatterns.set(colNumber, { dates: 0, numbers: 0, text: 0, samples: [] })
      }
      const pattern = colPatterns.get(colNumber)!

      if (isDateValue(cell.value)) {
        pattern.dates++
      } else if (isNumericValue(cell.value)) {
        pattern.numbers++
      } else {
        const val = cellToString(cell.value)
        if (val.trim()) {
          pattern.text++
          if (pattern.samples.length < 5) {
            pattern.samples.push(val)
          }
        }
      }
    })
  }

  // Print column identification
  console.log('  Columna │ Encabezado         │ Tipo dominante │ Muestras')
  console.log('  ────────┼────────────────────┼────────────────┼──────────────────────────────────')

  const allCols = new Set([...columnMap.keys(), ...colPatterns.keys()])
  const sortedCols = [...allCols].sort((a, b) => a - b)

  for (const col of sortedCols) {
    const header = columnMap.get(col) || '(sin encabezado)'
    const pattern = colPatterns.get(col)
    let tipoDominante = '?'
    let muestras = ''

    if (pattern) {
      const total = pattern.dates + pattern.numbers + pattern.text
      if (total === 0) {
        tipoDominante = 'vacía'
      } else if (pattern.dates > total * 0.5) {
        tipoDominante = `fecha (${pattern.dates}/${total})`
      } else if (pattern.numbers > total * 0.5) {
        tipoDominante = `número (${pattern.numbers}/${total})`
      } else {
        tipoDominante = `texto (${pattern.text}/${total})`
      }
      muestras = pattern.samples.slice(0, 3).join(' | ')
    }

    const colLetter = colToLetter(col).padEnd(8)
    const headerStr = header.substring(0, 18).padEnd(18)
    const tipoStr = tipoDominante.substring(0, 15).padEnd(15)

    console.log(`  ${colLetter} │ ${headerStr} │ ${tipoStr} │ ${muestras}`)
  }

  // ══════════════════════════════════════════════════════════════════════
  // 6. INTELLIGENT COLUMN IDENTIFICATION
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n┌─────────────────────────────────────────────────────────────┐')
  console.log('│  6. MAPEO INTELIGENTE DE COLUMNAS                           │')
  console.log('└─────────────────────────────────────────────────────────────┘')

  const fieldMapping: Map<string, { col: string; header: string; confidence: string }> = new Map()

  // Keyword-based identification from headers
  const keywords = {
    'tropa': ['tropa', 'n° tropa', 'numero tropa', 'n tropa', 'nro tropa'],
    'patente_chasis': ['patente chasis', 'chasis', 'patente', 'dominio'],
    'patente_acoplado': ['acoplado', 'patente acoplado', 'semi'],
    'chofer': ['chofer', 'conductor', 'nombre chofer'],
    'dni': ['dni', 'documento', 'nro doc'],
    'transportista': ['transportista', 'transporte', 'fletero'],
    'peso_bruto': ['peso bruto', 'bruto', 'pb'],
    'peso_tara': ['peso tara', 'tara', 'pt'],
    'peso_neto': ['peso neto', 'neto', 'pn'],
    'fecha': ['fecha', 'f. ingreso', 'f ingreso', 'fecha/hora', 'fecha hora'],
    'hora': ['hora', 'h. ingreso', 'h ingreso'],
    'ticket': ['ticket', 'n° ticket', 'nro ticket', 'numero ticket', 'n ticket'],
    'dte': ['dte', 'n° dte', 'dte nro'],
    'guia': ['guia', 'guía', 'n° guia', 'nro guia'],
    'productor': ['productor', 'productor/consignatario', 'nombre productor'],
    'usuario_faena': ['usuario faena', 'operador', 'ingresó', 'registró'],
    'corral': ['corral', 'potrero'],
    'cantidad_animales': ['cant', 'cantidad', 'cabezas', 'cab', 'nro animales'],
    'observaciones': ['observ', 'obs', 'nota', 'notas'],
    'destino': ['destino', 'lugar destino'],
    'remito': ['remito', 'nro remito', 'n° remito'],
  }

  for (const [field, kws] of Object.entries(keywords)) {
    for (const [col, header] of columnMap) {
      const headerLower = header.toLowerCase().trim()
      for (const kw of kws) {
        if (headerLower === kw || headerLower.includes(kw)) {
          fieldMapping.set(field, { col: colToLetter(col), header, confidence: 'header-exact' })
          break
        }
      }
      if (fieldMapping.has(field)) break
    }
  }

  // Pattern-based fallback
  if (!fieldMapping.has('fecha')) {
    for (const [col, pattern] of colPatterns) {
      if (pattern.dates > pattern.numbers && pattern.dates > pattern.text && pattern.dates > 5) {
        fieldMapping.set('fecha', { col: colToLetter(col), header: columnMap.get(col) || '(detectado por patrón)', confidence: 'pattern-date' })
      }
    }
  }

  if (!fieldMapping.has('peso_bruto')) {
    for (const [col, pattern] of colPatterns) {
      if (pattern.numbers > 5) {
        const avg = pattern.samples.reduce((s, v) => s + (parseFloat(v) || 0), 0) / (pattern.samples.length || 1)
        if (avg > 5000 && avg < 60000) {
          if (!fieldMapping.has('peso_bruto')) {
            fieldMapping.set('peso_bruto', { col: colToLetter(col), header: columnMap.get(col) || '(detectado por patrón)', confidence: 'pattern-weight' })
          } else if (!fieldMapping.has('peso_tara')) {
            fieldMapping.set('peso_tara', { col: colToLetter(col), header: columnMap.get(col) || '(detectado por patrón)', confidence: 'pattern-weight' })
          } else if (!fieldMapping.has('peso_neto')) {
            fieldMapping.set('peso_neto', { col: colToLetter(col), header: columnMap.get(col) || '(detectado por patrón)', confidence: 'pattern-weight' })
          }
        }
      }
    }
  }

  if (!fieldMapping.has('tropa')) {
    for (const [col, pattern] of colPatterns) {
      if (pattern.numbers > 5) {
        const nums = pattern.samples.map(s => parseFloat(s)).filter(n => !isNaN(n) && n > 0 && n < 300)
        if (nums.length > pattern.samples.length * 0.8) {
          fieldMapping.set('tropa', { col: colToLetter(col), header: columnMap.get(col) || '(detectado por patrón)', confidence: 'pattern-tropa' })
        }
      }
    }
  }

  console.log('\n  Campo            │ Col │ Encabezado               │ Confianza')
  console.log('  ──────────────────┼─────┼──────────────────────────┼─────────────────')
  for (const [field, info] of fieldMapping) {
    const fieldStr = field.padEnd(18)
    const colStr = info.col.padEnd(4)
    const headerStr = info.header.substring(0, 24).padEnd(24)
    console.log(`  ${fieldStr} │ ${colStr} │ ${headerStr} │ ${info.confidence}`)
  }

  // Print fields NOT found
  const missingFields = Object.keys(keywords).filter(f => !fieldMapping.has(f))
  if (missingFields.length > 0) {
    console.log(`\n  ⚠️  Campos NO identificados: ${missingFields.join(', ')}`)
  }

  // ══════════════════════════════════════════════════════════════════════
  // 7. COUNT DATA ROWS
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n┌─────────────────────────────────────────────────────────────┐')
  console.log('│  7. CONTEO DE FILAS DE DATOS                                │')
  console.log('└─────────────────────────────────────────────────────────────┘')

  let dataRowCount = 0
  let lastDataRow = 0
  let emptyRowsInSequence = 0

  for (let r = dataStartRow; r <= firstSheet.rowCount + 200; r++) {
    const row = firstSheet.getRow(r)
    let hasData = false
    row.eachCell({ includeEmpty: false }, (cell, _colNumber) => {
      if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
        hasData = true
      }
    })

    if (hasData) {
      dataRowCount++
      lastDataRow = r
      emptyRowsInSequence = 0
    } else {
      emptyRowsInSequence++
      // Stop after 20 consecutive empty rows
      if (emptyRowsInSequence > 20) break
    }
  }

  console.log(`\n  Fila de encabezado: ${headerRowNum}`)
  console.log(`  Primera fila de datos: ${dataStartRow}`)
  console.log(`  Última fila de datos: ${lastDataRow}`)
  console.log(`  Total filas de datos: ${dataRowCount}`)

  // ══════════════════════════════════════════════════════════════════════
  // 8. SAMPLE DATA ROWS (beginning, middle, end)
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n┌─────────────────────────────────────────────────────────────┐')
  console.log('│  8. MUESTRAS DE DATOS (5 filas: inicio, medio, fin)        │')
  console.log('└─────────────────────────────────────────────────────────────┘')

  if (dataRowCount < 5) {
    console.log('\n  ⚠️  Menos de 5 filas de datos. Mostrando todas:')
  }

  const samplePositions: { label: string; row: number }[] = []

  if (dataRowCount > 0) {
    samplePositions.push({ label: 'INICIO', row: dataStartRow })
    if (dataRowCount > 2) samplePositions.push({ label: 'INICIO+2', row: dataStartRow + 2 })
  }
  if (dataRowCount > 5) {
    const mid = Math.floor(dataRowCount / 2)
    samplePositions.push({ label: `MEDIO (~fila ${mid + dataStartRow})`, row: dataStartRow + mid })
  }
  if (dataRowCount > 8) {
    samplePositions.push({ label: `MEDIO+2 (~fila ${dataStartRow + Math.floor(dataRowCount * 0.6)})`, row: dataStartRow + Math.floor(dataRowCount * 0.6) })
  }
  if (dataRowCount > 0) {
    samplePositions.push({ label: `FIN (fila ${lastDataRow})`, row: lastDataRow })
  }

  // Determine max columns across all samples for alignment
  let maxCols = 0
  for (const pos of samplePositions) {
    const row = firstSheet.getRow(pos.row)
    row.eachCell({ includeEmpty: false }, (_cell, colNumber) => {
      maxCols = Math.max(maxCols, colNumber)
    })
  }

  // Build column header line using columnMap
  let colHeaderLine = '  Etiqueta     '
  for (let c = 1; c <= maxCols; c++) {
    const mappedField = [...fieldMapping.entries()].find(([_, info]) => info.col === colToLetter(c))
    const label = mappedField ? mappedField[0] : (columnMap.get(c) || colToLetter(c))
    colHeaderLine += label.substring(0, 8).padEnd(10)
  }

  console.log('\n  ' + colHeaderLine)
  console.log('  ' + '─'.repeat(colHeaderLine.length))

  for (const pos of samplePositions) {
    const row = firstSheet.getRow(pos.row)
    let rowStr = `${pos.label.padEnd(13)}`

    for (let c = 1; c <= maxCols; c++) {
      const cell = row.getCell(c)
      let val = cellToString(cell.value)
      if (val.length > 8) val = val.substring(0, 8)
      rowStr += val.padEnd(10)
    }

    console.log('  ' + rowStr)
  }

  // ══════════════════════════════════════════════════════════════════════
  // 9. FULL RAW DUMP of sample rows
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n┌─────────────────────────────────────────────────────────────┐')
  console.log('│  9. DUMP COMPLETO (valores reales) de muestras              │')
  console.log('└─────────────────────────────────────────────────────────────┘')

  for (const pos of samplePositions) {
    const row = firstSheet.getRow(pos.row)
    const cells: { col: string; colNum: number; val: string; type: string }[] = []

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const val = cellToString(cell.value)
      let type = 'str'
      if (isDateValue(cell.value)) type = 'date'
      else if (isNumericValue(cell.value)) type = 'num'
      cells.push({ col: colToLetter(colNumber), colNum: colNumber, val, type })
    })

    if (cells.length === 0) continue

    console.log(`\n  ══ ${pos.label} (Fila ${pos.row}) ══`)
    for (const c of cells) {
      const mappedField = [...fieldMapping.entries()].find(([_, info]) => info.col === c.col)
      const fieldLabel = mappedField ? ` → ${mappedField[0]}` : ''
      console.log(`    ${c.col.padEnd(4)} [${c.type}] = "${c.val}"${fieldLabel}`)
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 10. MERGED CELLS INFO
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n┌─────────────────────────────────────────────────────────────┐')
  console.log('│ 10. CELDAS COMBINADAS (merged cells)                        │')
  console.log('└─────────────────────────────────────────────────────────────┘')

  const mergedCount = (firstSheet as any)._merges ? Object.keys((firstSheet as any)._merges || {}).length : 0
  if (mergedCount > 0) {
    const merges = (firstSheet as any)._merges || {}
    console.log(`\n  Total de celdas combinadas: ${mergedCount}\n`)
    for (const [key, value] of Object.entries(merges)) {
      console.log(`    ${key} → ${JSON.stringify(value)}`)
    }
  } else {
    console.log('\n  No se encontraron celdas combinadas.')
  }

  // ══════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n═════════════════════════════════════════════════════════════════')
  console.log('  RESUMEN PARA IMPORTACIÓN')
  console.log('═════════════════════════════════════════════════════════════════')
  console.log(`  Hoja principal:  "${firstSheet.name}"`)
  console.log(`  Encabezado en:   Fila ${headerRowNum}`)
  console.log(`  Datos desde:      Fila ${dataStartRow}`)
  console.log(`  Datos hasta:     Fila ${lastDataRow}`)
  console.log(`  Total registros: ${dataRowCount}`)
  console.log(`  Total columnas:   ${maxCols}`)

  console.log('\n  Mapeo para el script de importación:')
  for (const [field, info] of fieldMapping) {
    const marker = fieldMapping.size > 0 ? '✅' : '❓'
    console.log(`    ${marker} ${field.padEnd(20)} → Columna ${info.col} ("${info.header.substring(0, 25)}")`)
  }

  const dbFields = [
    'tropa', 'patente_chasis', 'patente_acoplado', 'chofer', 'dni',
    'transportista', 'peso_bruto', 'peso_tara', 'peso_neto', 'fecha',
    'ticket', 'dte', 'guia', 'productor', 'usuario_faena', 'observaciones'
  ]

  const missing = dbFields.filter(f => !fieldMapping.has(f))
  if (missing.length > 0) {
    console.log(`\n  ⚠️  Campos faltantes para la DB: ${missing.join(', ')}`)
    console.log('      → Estos se deberán mapear manualmente o dejar null.')
  }

  console.log('\n═════════════════════════════════════════════════════════════════')
  console.log('  FIN DEL DIAGNÓSTICO')
  console.log('═════════════════════════════════════════════════════════════════')
}

main().catch(e => {
  console.error('❌ Error:', e)
  process.exit(1)
})
