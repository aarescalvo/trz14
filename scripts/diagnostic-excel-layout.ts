/**
 * Diagnostic: Print Excel cell structure to understand layout
 * Usage: npx tsx scripts/diagnostic-excel-layout.ts
 */
import ExcelJS from 'exceljs'

async function main() {
  const excelPath = process.argv[2] || './upload/RINDE FAENA BOVINO.xlsx'
  console.log('Reading:', excelPath)

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(excelPath)

  // List all sheet names
  console.log('\n=== HOJAS ===')
  wb.worksheets.forEach((ws, idx) => {
    console.log(`  [${idx}] "${ws.name}" (rows: ${ws.rowCount}, cols: ${ws.columnCount})`)
  })

  // For the first target sheet (T 175), print cells
  const targetSheet = wb.getWorksheet('T 175') || wb.worksheets[0]
  if (!targetSheet) {
    console.log('No sheets found!')
    return
  }

  console.log(`\n=== LAYOUT: "${targetSheet.name}" ===`)
  console.log('(Printing rows 1-35, cols A-O)\n')

  // Print header row (column numbers)
  const colLetters = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O']
  let header = 'R'.padStart(4) + colLetters.map(l => l.padStart(18)).join('|')
  console.log(header)
  console.log('-'.repeat(header.length))

  for (let r = 1; r <= 35; r++) {
    const row = targetSheet.getRow(r)
    if (!row || row.cellCount === 0) continue

    const cells: string[] = []
    for (let c = 1; c <= 15; c++) {
      const cell = row.getCell(c)
      let val = ''
      if (cell.value !== null && cell.value !== undefined) {
        if (typeof cell.value === 'object' && 'result' in cell.value) {
          val = String(cell.value.result)
        } else if (cell.value instanceof Date) {
          val = cell.value.toISOString().split('T')[0]
        } else {
          val = String(cell.value)
        }
      }
      cells.push(val.padStart(18))
    }

    const rowLabel = String(r).padStart(4)
    // Only print if there's any non-empty content
    if (cells.some(c => c.trim() !== '')) {
      console.log(rowLabel + cells.join('|'))
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
