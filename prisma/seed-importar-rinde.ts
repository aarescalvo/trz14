/**
 * Importación de RINDE FAENA BOVINO.xlsx → tabla RindeFaena + actualiza Tropa
 * 
 * DATOS QUE IMPORTA:
 * - RindeFaena: datos por animal (peso vivo, media res A/B, rinde, caravana, raza, tipo)
 * - Tropa.fechaFaena: desde la fecha de faena del Excel
 * - Tropa.kgGancho: desde kg vivo total del Excel
 * - Tropa.dte: desde N° DTE del Excel
 * 
 * SEGURIDAD:
 * - NO elimina ningún registro existente
 * - Si el rinde ya existe (tropaId + numeroAnimal), lo OMITE
 * - Si Tropa.fechaFaena ya tiene valor, NO lo sobreescribe
 * - Idempotente: se puede ejecutar cuantas veces se quiera
 * 
 * Ejecutar: npx tsx prisma/seed-importar-rinde.ts
 */
import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as path from 'path'

const db = new PrismaClient()

// Mapeo de tipos de animal del Excel al enum Prisma
const TIPO_ANIMAL_MAP: Record<string, string> = {
  'TO': 'TO',
  'VA': 'VA',
  'VQ': 'VQ',
  'MEJ': 'MEJ',
  'NO': 'NO',
  'NT': 'NT',
  'V': 'VQ',
  'TORO': 'TO',
  'VACA': 'VA',
  'VAQUILLONA': 'VQ',
  'TORITO': 'MEJ',
  'NOVILLO': 'NO',
  'NOVILLITO': 'NT',
}

// Normalizar tipo de animal
function normalizarTipoAnimal(raw: string): string {
  if (!raw) return 'NT'
  // Puede venir como "2D - VQ" → extraer la parte después del guión
  const parts = raw.split('-').map(s => s.trim())
  const candidate = parts.length > 1 ? parts[parts.length - 1] : parts[0]
  const upper = candidate.toUpperCase()
  return TIPO_ANIMAL_MAP[upper] || upper || 'NT'
}

// Normalizar raza
function normalizarRaza(raw: string): string | null {
  if (!raw) return null
  const raza = String(raw).trim().toUpperCase()
  if (!raza || raza === '-') return null
  return raza
}

// Convertir fecha Excel serial (días desde 1900-01-01) a Date
function excelDateToDate(serial: number): Date | null {
  if (!serial || serial < 1) return null
  // Excel epoch: 25569 = days from 1900-01-01 to 1970-01-01 (Unix epoch)
  // Excel bug: treats 1900 as leap year, so subtract 1 for dates after Feb 28, 1900
  const unixMs = (serial - 25569) * 86400 * 1000
  const d = new Date(unixMs)
  if (isNaN(d.getTime())) return null
  return d
}

// Leer celda segura
function getCell(sheet: XLSX.WorkSheet, row: number, col: number): any {
  const addr = XLSX.utils.encode_cell({ r: row, c: col })
  return sheet[addr]?.v ?? null
}

interface TropaExcelData {
  numeroTropa: number
  fechaFaena: Date | null
  kgVivoTotal: number
  kgMedioRes: number
  rindePromedio: number
  cantidadAnimales: number
  matarife: string | null
  dte: string | null
  animales: AnimalExcelData[]
}

interface AnimalExcelData {
  numeroGarron: number
  numeroAnimal: number
  raza: string | null
  tipoAnimal: string
  caravana: string | null
  kgEntrada: number
  kgMediaA: number | null
  kgMediaB: number | null
  kgTotal: number
  rinde: number
}

async function main() {
  console.log('=== IMPORTACIÓN DE RINDE FAENA BOVINO.xlsx ===\n')

  // 1. Leer archivo
  const projectRoot = path.resolve(__dirname, '..')
  const relativePath = path.join(projectRoot, 'upload', 'RINDE FAENA BOVINO.xlsx')
  const fallbackPath = '/home/z/my-project/upload/RINDE FAENA BOVINO.xlsx'
  const cliPath = process.argv[2]

  let workbook: XLSX.WorkBook
  try {
    const filePath = cliPath || relativePath
    workbook = XLSX.readFile(filePath)
    console.log(`Archivo: ${filePath}`)
  } catch {
    console.log(`No encontrado en ${relativePath}, intentando: ${fallbackPath}`)
    try {
      workbook = XLSX.readFile(fallbackPath)
      console.log(`Archivo: ${fallbackPath}`)
    } catch {
      console.error('ERROR: No se encontró RINDE FAENA BOVINO.xlsx')
      console.error(`Uso: npx tsx prisma/seed-importar-rinde.ts [ruta/al/archivo.xlsx]`)
      process.exit(1)
    }
  }

  const sheetNames = workbook.SheetNames.filter(n => n !== 'T' && n.startsWith('T'))
  console.log(`Hojas de tropas: ${sheetNames.length}`)

  // 2. Estado actual BD
  const tropasExistentes = await db.tropa.findMany({
    select: { id: true, numero: true, fechaFaena: true, kgGancho: true, dte: true },
  })
  const tropaByNumero = new Map(tropasExistentes.map(t => [t.numero, t]))

  const rindesExistentes = await db.rindeFaena.findMany({
    select: { id: true, tropaId: true, numeroAnimal: true },
  })
  const rindeByKey = new Set(rindesExistentes.map(r => `${r.tropaId}-${r.numeroAnimal}`))

  console.log(`Tropas en BD: ${tropasExistentes.length}`)
  console.log(`Rindes en BD: ${rindesExistentes.length}\n`)

  // 3. Parsear cada hoja
  const tropasData: TropaExcelData[] = []

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue

    // Extraer número de tropa del nombre "T 01" → 1, "T 203" → 203
    const tropaMatch = sheetName.match(/T\s+(\d+)/)
    if (!tropaMatch) continue
    const numeroTropa = parseInt(tropaMatch[1])

    // Leer datos del header (filas 0-indexed)
    const fechaFaenaSerial = getCell(sheet, 4, 6) // Row 4, Col 6: FECHA DE FAENA
    const kgVivoTotal = getCell(sheet, 2, 6) // Row 2, Col 6: SOBRE kg vivo de
    const kgMedioRes = getCell(sheet, 3, 6) // Row 3, Col 6: SOBRE 1/2 res de
    const rindePromedio = getCell(sheet, 3, 8) // Row 3, Col 8: rinde
    const cantidadAnimales = getCell(sheet, 6, 7) // Row 6, Col 7: CANTIDAD ANIMALES
    const matarife = getCell(sheet, 6, 10) // Row 6, Col 10: MATARIFE
    const dte = getCell(sheet, 7, 10) // Row 7, Col 10: Nº DTE

    const fechaFaena = excelDateToDate(Number(fechaFaenaSerial))

    // Leer animales (desde fila 10 en adelante)
    const animales: AnimalExcelData[] = []
    for (let r = 10; r <= 200; r++) {
      const numGarron = getCell(sheet, r, 2)
      const numAnimal = getCell(sheet, r, 3)
      if (!numGarron && !numAnimal) break // fin de datos

      animales.push({
        numeroGarron: Number(numGarron) || 0,
        numeroAnimal: Number(numAnimal) || 0,
        raza: normalizarRaza(String(getCell(sheet, r, 4) || '')),
        tipoAnimal: normalizarTipoAnimal(String(getCell(sheet, r, 5) || '')),
        caravana: String(getCell(sheet, r, 6) || '').trim() || null,
        kgEntrada: Number(getCell(sheet, r, 7)) || 0,
        kgMediaA: getCell(sheet, r, 8) != null ? Number(getCell(sheet, r, 8)) : null,
        kgMediaB: getCell(sheet, r, 9) != null ? Number(getCell(sheet, r, 9)) : null,
        kgTotal: Number(getCell(sheet, r, 10)) || 0,
        rinde: Number(getCell(sheet, r, 11)) || 0,
      })
    }

    tropasData.push({
      numeroTropa,
      fechaFaena,
      kgVivoTotal: Number(kgVivoTotal) || 0,
      kgMedioRes: Number(kgMedioRes) || 0,
      rindePromedio: Number(rindePromedio) || 0,
      cantidadAnimales: Number(cantidadAnimales) || 0,
      matarife: matarife ? String(matarife).trim() : null,
      dte: dte ? String(dte).trim() : null,
      animales,
    })
  }

  console.log(`Tropas parseadas del Excel: ${tropasData.length}\n`)

  // 4. Actualizar Tropa (fechaFaena, kgGancho, DTE) — solo si están vacíos
  let tropasActualizadas = 0
  let tropasNoEncontradas = 0

  for (const td of tropasData) {
    const tropa = tropaByNumero.get(td.numeroTropa)
    if (!tropa) {
      tropasNoEncontradas++
      continue
    }

    const updates: any = {}

    // Solo actualizar fechaFaena si está null
    if (!tropa.fechaFaena && td.fechaFaena) {
      updates.fechaFaena = td.fechaFaena
    }

    // Solo actualizar kgGancho si está null
    if (!tropa.kgGancho && td.kgVivoTotal > 0) {
      updates.kgGancho = td.kgVivoTotal
    }

    // Solo actualizar DTE si está como "PENDIENTE" o vacío
    if (tropa.dte === 'PENDIENTE' && td.dte) {
      updates.dte = td.dte
    }

    if (Object.keys(updates).length > 0) {
      await db.tropa.update({ where: { id: tropa.id }, data: updates })
      tropasActualizadas++
    }
  }

  console.log(`Tropas actualizadas: ${tropasActualizadas}`)
  if (tropasNoEncontradas > 0) {
    console.log(`Tropas no encontradas en BD: ${tropasNoEncontradas}`)
  }

  // 5. Crear RindeFaena (omitiendo duplicados)
  let rindesCreados = 0
  let rindesOmitidos = 0
  let rindesSinTropa = 0
  let errores = 0

  for (const td of tropasData) {
    const tropa = tropaByNumero.get(td.numeroTropa)
    if (!tropa) {
      rindesSinTropa += td.animales.length
      continue
    }

    for (const animal of td.animales) {
      const key = `${tropa.id}-${animal.numeroAnimal}`

      // Omitir si ya existe
      if (rindeByKey.has(key)) {
        rindesOmitidos++
        continue
      }

      try {
        await db.rindeFaena.create({
          data: {
            tropaId: tropa.id,
            tropaCodigo: tropa.codigo,
            numeroGarron: animal.numeroGarron || null,
            numeroAnimal: animal.numeroAnimal,
            caravana: animal.caravana,
            raza: animal.raza,
            tipoAnimal: animal.tipoAnimal,
            pesoVivo: animal.kgEntrada,
            pesoMediaA: animal.kgMediaA,
            pesoMediaB: animal.kgMediaB,
            pesoTotalMedia: animal.kgTotal,
            rinde: animal.rinde,
            rindePorcentaje: Math.round(animal.rinde * 10000) / 100, // ej: 0.5756 → 57.56
            fechaFaena: td.fechaFaena || new Date(),
            matarife: td.matarife,
            numeroDTE: td.dte,
          },
        })
        rindeByKey.add(key)
        rindesCreados++
      } catch (err: any) {
        // Si falla por unique constraint, omitir silenciosamente
        if (err.message?.includes('Unique') || err.message?.includes('duplicate')) {
          rindeByKey.add(key)
          rindesOmitidos++
        } else {
          console.log(`  ERROR tropa ${td.numeroTropa} animal ${animal.numeroAnimal}: ${err.message?.substring(0, 80)}`)
          errores++
        }
      }
    }
  }

  console.log(`\n=== RESUMEN RINDE FAENA ===`)
  console.log(`Rindes creados: ${rindesCreados}`)
  console.log(`Rindes omitidos (ya existían): ${rindesOmitidos}`)
  console.log(`Rindes sin tropa en BD: ${rindesSinTropa}`)
  console.log(`Errores: ${errores}`)

  // 6. Totales finales
  const totalFinalRindes = await db.rindeFaena.count()
  const tropasConFecha = await db.tropa.count({ where: { fechaFaena: { not: null } } })

  console.log(`\n=== ESTADO FINAL ===`)
  console.log(`Total rindes en BD: ${totalFinalRindes}`)
  console.log(`Tropas con fecha de faena: ${tropasConFecha} / ${tropasExistentes.length}`)
  console.log(`Tropas actualizadas esta ejecución: ${tropasActualizadas}`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
