/**
 * Script de importación: Cargar datos de rinde desde Excel
 * - Tropa 175: ACTUALIZAR los 15 romaneos existentes (garron 46-60) + crear los faltantes (garron 11-45)
 * - Tropas 192-203: CREAR todos los romaneos (no existen en DB)
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

// Data row mapping (newer sheet layout: T 175+)
// Row 15 Col 5: TROPA Nº
// Row 14 Col 5: Fecha Faena
// Row 25+: data rows
const DATA_START_ROW = 25
const COL = {
  GARRON: 3,
  ANIMAL: 4,
  RAZA: 5,
  DENTICION: 6,    // "2D - NT"
  CLASIF: 7,       // "NT"
  CARAVANA: 8,
  KG_ENTRADA: 9,   // pesoVivo
  KG_MEDIA_A: 10,  // pesoMediaIzq
  KG_MEDIA_B: 11,  // pesoMediaDer
  TOTAL_KG: 12,    // pesoTotal (formula)
  RINDE: 13        // rinde (formula)
}

interface RowData {
  garron: number
  numeroAnimal: number | null
  raza: string | null
  denticion: string | null   // e.g. "2D"
  tipoAnimal: string | null  // e.g. "NT"
  caravana: string | null
  pesoVivo: number | null
  pesoMediaIzq: number | null
  pesoMediaDer: number | null
  pesoTotal: number | null
  rinde: number | null
}

function getCellValue(cell: ExcelJS.Cell): any {
  // Handle formula results
  if (cell.value && typeof cell.value === 'object' && 'result' in cell.value) {
    return cell.value.result
  }
  return cell.value
}

function parseSheet(ws: ExcelJS.Worksheet): { tropaNumero: number; fechaFaena: Date | null; rows: RowData[] } {
  // Tropa number
  const tropaNumero = getCellValue(ws.getRow(15).getCell(COL.GARRON)) as number
  // Fecha faena
  const fechaRaw = getCellValue(ws.getRow(14).getCell(COL.ANIMAL))
  const fechaFaena = fechaRaw ? new Date(fechaRaw) : null

  const rows: RowData[] = []
  for (let r = DATA_START_ROW; r <= 75; r++) {
    const row = ws.getRow(r)
    const garronVal = getCellValue(row.getCell(COL.GARRON))

    if (garronVal === null || garronVal === undefined || garronVal === '') continue

    const garron = Number(garronVal)
    if (isNaN(garron) || garron <= 0) continue

    const kgEntrada = getCellValue(row.getCell(COL.KG_ENTRADA))
    const kgMediaA = getCellValue(row.getCell(COL.KG_MEDIA_A))
    const kgMediaB = getCellValue(row.getCell(COL.KG_MEDIA_B))
    const totalKg = getCellValue(row.getCell(COL.TOTAL_KG))
    const rindeVal = getCellValue(row.getCell(COL.RINDE))

    // Denticion is like "2D - NT", extract parts
    const dentClasif = getCellValue(row.getCell(COL.DENTICION)) as string || ''
    const clasif = getCellValue(row.getCell(COL.CLASIF)) as string || ''
    
    // Extract denticion number: "2D" from "2D - NT"
    const denticionMatch = dentClasif.match(/(\d+)D/i)
    const denticion = denticionMatch ? denticionMatch[1] : null

    // pesoTotal: if formula result is null, calculate from medias
    const pesoMediaIzq = kgMediaA !== null && kgMediaA !== undefined ? Number(kgMediaA) : null
    const pesoMediaDer = kgMediaB !== null && kgMediaB !== undefined ? Number(kgMediaB) : null
    const pesoTotalCalc = totalKg !== null && totalKg !== undefined ? Number(totalKg) 
      : (pesoMediaIzq !== null && pesoMediaDer !== null ? pesoMediaIzq + pesoMediaDer : null)

    rows.push({
      garron,
      numeroAnimal: getCellValue(row.getCell(COL.ANIMAL)) ? Number(getCellValue(row.getCell(COL.ANIMAL))) : null,
      raza: getCellValue(row.getCell(COL.RAZA)) as string || null,
      denticion,
      tipoAnimal: clasif || null,
      caravana: getCellValue(row.getCell(COL.CARAVANA)) as string || null,
      pesoVivo: kgEntrada !== null && kgEntrada !== undefined ? Number(kgEntrada) : null,
      pesoMediaIzq,
      pesoMediaDer,
      pesoTotal: pesoTotalCalc,
      rinde: rindeVal !== null && rindeVal !== undefined ? Number(rindeVal) * 100 : null // Convert decimal to percentage
    })
  }

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

  let totalCreated = 0
  let totalUpdated = 0
  let totalErrors = 0

  for (const sheetName of TARGET_SHEETS) {
    const ws = wb.getWorksheet(sheetName)
    if (!ws) {
      console.log(`⚠️ Hoja ${sheetName} no encontrada, saltando...`)
      continue
    }

    const { tropaNumero, fechaFaena, rows } = parseSheet(ws)
    if (rows.length === 0) {
      console.log(`⚠️ ${sheetName}: sin datos, saltando...`)
      continue
    }

    // Find tropa in DB
    const tropa = await prisma.tropa.findFirst({
      where: { numero: tropaNumero }
    })

    if (!tropa) {
      console.log(`❌ ${sheetName}: Tropa ${tropaNumero} no encontrada en DB, saltando...`)
      totalErrors++
      continue
    }

    console.log(`\n📌 ${sheetName}: Tropa ${tropaNumero} (codigo="${tropa.codigo}", ${rows.length} animales, fecha=${fechaFaena?.toISOString().split('T')[0]})`)

    // Check existing romaneos for this tropa
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
          // UPDATE existing romaneo
          await prisma.romaneo.update({
            where: { id: existing.id },
            data
          })
          totalUpdated++
          console.log(`   ✏️ garron=${row.garron}: ACTUALIZADO (era pesoVivo=${existing.pesoVivo} → ${row.pesoVivo})`)
        } else {
          // CREATE new romaneo
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
  console.log(`Romaneos CREADOS:  ${totalCreated}`)
  console.log(`Romaneos ACTUALIZADOS: ${totalUpdated}`)
  console.log(`Errores: ${totalErrors}`)
  console.log('============================================')
}

main()
  .catch(e => { console.error('ERROR FATAL:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
