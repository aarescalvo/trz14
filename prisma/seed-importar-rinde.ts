/**
 * Importación de RINDE FAENA BOVINO.xlsx → tabla RindeFaena + actualiza Tropa
 * 
 * SOPORTA 3 FORMATOS DE HOJA:
 * - Formato 1 (Tropas ~1-20): Header en col F/G rows 2-8, animales desde row 10
 * - Formato 2 (Tropas ~100+): Header "Fecha Faena" en row 11-12 col E, animales desde row ~22
 * - Formato 3 (Tropas ~190+): Header "Fecha Faena" en row 13-14 col E, animales desde row ~24
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

// Normalizar tipo de animal — usa la columna de clasificación si está disponible (col G en formatos 2/3)
function normalizarTipoAnimal(raw: string, clasificacion?: string): string {
  // Priorizar clasificación explícita (MEJ, VQ, NO, etc.)
  if (clasificacion && clasificacion.trim()) {
    const upper = clasificacion.trim().toUpperCase()
    if (TIPO_ANIMAL_MAP[upper]) return TIPO_ANIMAL_MAP[upper]
  }
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
  const unixMs = (serial - 25569) * 86400 * 1000
  const d = new Date(unixMs)
  if (isNaN(d.getTime())) return null
  return d
}

// Convertir cualquier valor de fecha (puede ser serial, string, o Date) a Date
function parseFechaFaena(raw: any): Date | null {
  if (!raw) return null
  // Si ya es un objeto Date
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw
  // Si es string "2026-05-22 00:00:00" o "2026-05-22"
  if (typeof raw === 'string') {
    const d = new Date(raw)
    if (!isNaN(d.getTime())) return d
    return null
  }
  // Si es número (Excel serial)
  if (typeof raw === 'number') return excelDateToDate(raw)
  return null
}

// Leer celda segura
function getCell(sheet: XLSX.WorkSheet, row: number, col: number): any {
  const addr = XLSX.utils.encode_cell({ r: row, c: col })
  return sheet[addr]?.v ?? null
}

// Buscar una fila que contenga un texto específico en una columna
function findRowByText(sheet: XLSX.WorkSheet, col: number, text: string, startRow: number = 0, endRow: number = 30): number {
  const search = text.toUpperCase()
  for (let r = startRow; r <= endRow; r++) {
    const val = String(getCell(sheet, r, col) || '').toUpperCase()
    if (val.includes(search)) return r
  }
  return -1
}

// Buscar fila del header de animales (contiene "GARRON")
function findAnimalHeaderRow(sheet: XLSX.WorkSheet, startRow: number = 10, endRow: number = 30): number {
  for (let r = startRow; r <= endRow; r++) {
    for (let c = 2; c <= 8; c++) {
      const val = String(getCell(sheet, r, c) || '').toUpperCase()
      if (val.includes('GARRON')) return r
    }
  }
  return -1
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
  formato: string // '1', '2', o '3'
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

/**
 * Detecta el formato de la hoja y extrae todos los datos.
 * 
 * Formato 1 (Tropas ~1-20):
 *   Row 3, Col F (5): "SOBRE kg vivo de:" → valor en Col G (6)
 *   Row 4, Col F (5): "SOBRE 1/2 res de:" → valor en Col G (6)
 *   Row 5, Col F (5): "FECHA DE FAENA:" → valor en Col G (6)
 *   Row 6, Col F (5): "TROPA Nº:" → valor en Col G (6)
 *   Row 7, Col F (5): "CANTIDAD ANIMALES:" → valor en Col G (6)
 *   Row 7, Col I (8): "MATARIFE:" → valor en Col J (9)
 *   Row 8, Col I (8): "Nº DTE:" → valor en Col J (9)
 *   Animales: Row 10+ (header en row 10), col C= Garrón, D= Animal, E= Raza, F= Tipo, G= Caravana, H= Kg entrada, I= 1/2A, J= 1/2B, K= Total, L= Rinde
 * 
 * Formato 2 (Tropas ~100+):
 *   Row ~8, Col C (2): "Usuario/Matarife:" → valor en Col E (4)
 *   Row ~9, Col C (2): "Matricula:" → valor en Col E (4)
 *   Row ~9, Col I (8): "Nº DTE:" → valor en Col J (9)
 *   Row ~11-12, Col D (3): "Fecha Faena:" → valor en Col E (4)
 *   Row ~12-13, Col C (2): "Nº Tropa:" → valor en Col E (4)
 *   Row ~13-14, Col C (2): "Cantidad Cabeza:" → valor en Col E (4)
 *   Animales: Row ~22+ (header con "GARRON"), col C= Garrón, D= Animal, E= Raza, F= Tipo, G= Clasif, H= Caravana, I= Kg entrada, J= 1/2A, K= 1/2B, L= Total, M= Rinde
 * 
 * Formato 3 (Tropas ~190+):
 *   Igual al Formato 2 pero con más filas de menudencia arriba, 
 *   "Fecha Faena" en row ~14 en vez de ~12
 *   Animales desde row ~24 en vez de ~22
 */
function parseTropaSheet(sheetName: string, sheet: XLSX.WorkSheet): TropaExcelData | null {
  // Extraer número de tropa
  const tropaMatch = sheetName.match(/T\s+(\d+)/)
  if (!tropaMatch) return null
  const numeroTropa = parseInt(tropaMatch[1])

  // Detectar formato buscando "GARRON" en la hoja
  const animalHeaderRow = findAnimalHeaderRow(sheet, 8, 30)
  if (animalHeaderRow === -1) {
    // No se encontraron datos de animales
    return {
      numeroTropa,
      fechaFaena: null,
      kgVivoTotal: 0,
      kgMedioRes: 0,
      rindePromedio: 0,
      cantidadAnimales: 0,
      matarife: null,
      dte: null,
      animales: [],
      formato: '?',
    }
  }

  // Determinar formato basado en posición del header de animales
  let formato: string
  let fechaFaena: Date | null = null
  let matarife: string | null = null
  let dte: string | null = null
  let kgVivoTotal = 0
  let kgMedioRes = 0
  let rindePromedio = 0
  let cantidadAnimales = 0
  // Column mapping para animales: {garron, animal, raza, tipo, clasificacion, caravana, kgEntrada, kgMediaA, kgMediaB, kgTotal, rinde}
  let colMap: { garron: number; animal: number; raza: number; tipo: number; clasif: number; caravana: number; kgEntrada: number; kgMediaA: number; kgMediaB: number; kgTotal: number; rinde: number }

  if (animalHeaderRow <= 11) {
    // FORMATO 1: animales desde row 10-11
    formato = '1'
    const dataStartRow = animalHeaderRow + 1 // fila siguiente al header

    // Header: Row 5 col F="FECHA DE FAENA", valor en col G
    const fechaRow = findRowByText(sheet, 5, 'FECHA DE FAENA', 3, 8)
    if (fechaRow >= 0) {
      fechaFaena = parseFechaFaena(getCell(sheet, fechaRow, 6))
    }

    // Matarife: Row 7 col I="MATARIFE", valor en col J
    const matarifeRow = findRowByText(sheet, 8, 'MATARIFE', 5, 10)
    if (matarifeRow >= 0) {
      matarife = String(getCell(sheet, matarifeRow, 9) || '').trim() || null
    }

    // DTE: Row 8 col I="Nº DTE", valor en col J
    const dteRow = findRowByText(sheet, 8, 'Nº DTE', 5, 10)
    if (dteRow >= 0) {
      dte = String(getCell(sheet, dteRow, 9) || '').trim() || null
    }

    // kg vivo: Row 3 col F="SOBRE kg vivo de:", valor en col G
    const kgVivoRow = findRowByText(sheet, 5, 'SOBRE kg vivo', 1, 6)
    if (kgVivoRow >= 0) {
      kgVivoTotal = Number(getCell(sheet, kgVivoRow, 6)) || 0
    }

    // kg 1/2 res: Row 4 col F
    const kgResRow = findRowByText(sheet, 5, 'SOBRE 1/2 res', 1, 6)
    if (kgResRow >= 0) {
      kgMedioRes = Number(getCell(sheet, kgResRow, 6)) || 0
    }

    // Cantidad animales: Row 7 col F
    const cantRow = findRowByText(sheet, 5, 'CANTIDAD ANIMALES', 5, 10)
    if (cantRow >= 0) {
      cantidadAnimales = Number(getCell(sheet, cantRow, 6)) || 0
    }

    // Columnas: C=2 Garrón, D=3 Animal, E=4 Raza, F=5 Tipo, G=6 Caravana, H=7 Kg Entrada, I=8 1/2A, J=9 1/2B, K=10 Total, L=11 Rinde
    colMap = { garron: 2, animal: 3, raza: 4, tipo: 5, clasif: 6, caravana: 6, kgEntrada: 7, kgMediaA: 8, kgMediaB: 9, kgTotal: 10, rinde: 11 }

    // Leer animales
    const animales: AnimalExcelData[] = []
    for (let r = dataStartRow; r <= 200; r++) {
      const numGarron = getCell(sheet, r, colMap.garron)
      const numAnimal = getCell(sheet, r, colMap.animal)
      if (!numGarron && !numAnimal) break

      animales.push({
        numeroGarron: Number(numGarron) || 0,
        numeroAnimal: Number(numAnimal) || 0,
        raza: normalizarRaza(String(getCell(sheet, r, colMap.raza) || '')),
        tipoAnimal: normalizarTipoAnimal(String(getCell(sheet, r, colMap.tipo) || '')),
        caravana: String(getCell(sheet, r, colMap.caravana) || '').trim() || null,
        kgEntrada: Number(getCell(sheet, r, colMap.kgEntrada)) || 0,
        kgMediaA: getCell(sheet, r, colMap.kgMediaA) != null ? Number(getCell(sheet, r, colMap.kgMediaA)) : null,
        kgMediaB: getCell(sheet, r, colMap.kgMediaB) != null ? Number(getCell(sheet, r, colMap.kgMediaB)) : null,
        kgTotal: Number(getCell(sheet, r, colMap.kgTotal)) || 0,
        rinde: Number(getCell(sheet, r, colMap.rinde)) || 0,
      })
    }

    return { numeroTropa, fechaFaena, kgVivoTotal, kgMedioRes, rindePromedio, cantidadAnimales, matarife, dte, animales, formato }

  } else {
    // FORMATO 2 o 3: animales desde row 20+ (detectado por findAnimalHeaderRow)
    formato = animalHeaderRow <= 22 ? '2' : '3'
    const dataStartRow = animalHeaderRow + 2 // header + fila de "Denticion/Clasificacion"

    // Buscar "Fecha Faena:" en col D (3), valor en col E (4)
    const fechaRow = findRowByText(sheet, 3, 'Fecha Faena', 8, 20)
    if (fechaRow >= 0) {
      fechaFaena = parseFechaFaena(getCell(sheet, fechaRow, 4))
    }

    // Matarife: "Usuario/Matarife:" en col C (2), valor en col E (4)
    const matarifeRow = findRowByText(sheet, 2, 'Usuario/Matarife', 5, 15)
    if (matarifeRow >= 0) {
      matarife = String(getCell(sheet, matarifeRow, 4) || '').trim() || null
    }

    // DTE: "Nº DTE:" en col I (8), valor en col J (9)
    const dteRow = findRowByText(sheet, 8, 'Nº DTE', 5, 15)
    if (dteRow >= 0) {
      dte = String(getCell(sheet, dteRow, 9) || '').trim() || null
    }

    // Cantidad cabezas: "Cantidad Cabeza:" en col C (2), valor en col E (4)
    const cantRow = findRowByText(sheet, 2, 'Cantidad Cabeza', 8, 20)
    if (cantRow >= 0) {
      cantidadAnimales = Number(getCell(sheet, cantRow, 4)) || 0
    }

    // Columnas: C=2 Garrón, D=3 Animal, E=4 Raza, F=5 Tipo, G=6 Clasificacion, H=7 Caravana, I=8 Kg Entrada, J=9 1/2A, K=10 1/2B, L=11 Total, M=12 Rinde
    colMap = { garron: 2, animal: 3, raza: 4, tipo: 5, clasif: 6, caravana: 7, kgEntrada: 8, kgMediaA: 9, kgMediaB: 10, kgTotal: 11, rinde: 12 }

    // Leer animales
    const animales: AnimalExcelData[] = []
    for (let r = dataStartRow; r <= 200; r++) {
      const numGarron = getCell(sheet, r, colMap.garron)
      const numAnimal = getCell(sheet, r, colMap.animal)
      // Stop si no hay garrón ni animal (fin de datos)
      // Pero verificar que no sea la fila de totales (que tiene fórmulas en col D)
      if (!numGarron && !numAnimal) break
      // Skip la fila de totales (si col D tiene COUNT o SUM)
      if (typeof numAnimal === 'string' && (numAnimal.includes('COUNT') || numAnimal.includes('SUM'))) break

      const clasificacion = String(getCell(sheet, r, colMap.clasif) || '')

      animales.push({
        numeroGarron: Number(numGarron) || 0,
        numeroAnimal: Number(numAnimal) || 0,
        raza: normalizarRaza(String(getCell(sheet, r, colMap.raza) || '')),
        tipoAnimal: normalizarTipoAnimal(String(getCell(sheet, r, colMap.tipo) || ''), clasificacion),
        caravana: String(getCell(sheet, r, colMap.caravana) || '').trim() || null,
        kgEntrada: Number(getCell(sheet, r, colMap.kgEntrada)) || 0,
        kgMediaA: getCell(sheet, r, colMap.kgMediaA) != null ? Number(getCell(sheet, r, colMap.kgMediaA)) : null,
        kgMediaB: getCell(sheet, r, colMap.kgMediaB) != null ? Number(getCell(sheet, r, colMap.kgMediaB)) : null,
        kgTotal: Number(getCell(sheet, r, colMap.kgTotal)) || 0,
        rinde: Number(getCell(sheet, r, colMap.rinde)) || 0,
      })
    }

    // En formatos 2/3, kgVivoTotal y kgMedioRes son fórmulas (=+I75) que xlsx no evalúa.
    // Calcularlos a partir de la suma de animales
    kgVivoTotal = animales.reduce((sum, a) => sum + a.kgEntrada, 0)
    kgMedioRes = animales.reduce((sum, a) => sum + (a.kgTotal || 0), 0)
    cantidadAnimales = animales.length || cantidadAnimales

    return { numeroTropa, fechaFaena, kgVivoTotal, kgMedioRes, rindePromedio, cantidadAnimales, matarife, dte, animales, formato }
  }
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
    select: { id: true, numero: true, fechaFaena: true, kgGancho: true, dte: true, codigo: true, estado: true },
  })
  const tropaByNumero = new Map(tropasExistentes.map(t => [t.numero, t]))

  const rindesExistentes = await db.rindeFaena.findMany({
    select: { id: true, tropaId: true, numeroAnimal: true },
  })
  const rindeByKey = new Set(rindesExistentes.map(r => `${r.tropaId}-${r.numeroAnimal}`))

  console.log(`Tropas en BD: ${tropasExistentes.length}`)
  console.log(`Rindes en BD: ${rindesExistentes.length}\n`)

  // 3. Parsear cada hoja con detección automática de formato
  const tropasData: TropaExcelData[] = []
  const formatoCount = { '1': 0, '2': 0, '3': 0, '?': 0 }

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue

    const parsed = parseTropaSheet(sheetName, sheet)
    if (!parsed) continue

    formatoCount[parsed.formato as keyof typeof formatoCount]++
    tropasData.push(parsed)
  }

  console.log(`Tropas parseadas del Excel: ${tropasData.length}`)
  console.log(`  Formato 1 (viejo): ${formatoCount['1']}`)
  console.log(`  Formato 2 (medio): ${formatoCount['2']}`)
  console.log(`  Formato 3 (nuevo): ${formatoCount['3']}`)
  console.log(`  Sin formato:       ${formatoCount['?']}\n`)

  // Mostrar tropas con fecha vacía
  const sinFecha = tropasData.filter(t => !t.fechaFaena).map(t => t.numeroTropa)
  if (sinFecha.length > 0) {
    console.log(`Tropas sin fecha de faena en Excel: ${sinFecha.join(', ')}\n`)
  }

  // 4. Actualizar Tropa (fechaFaena, kgGancho, DTE) — solo si están vacíos
  let tropasActualizadas = 0
  let tropasNoEncontradas = 0
  let estadosActualizados = 0

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
    if ((tropa.dte === 'PENDIENTE' || !tropa.dte) && td.dte) {
      updates.dte = td.dte
    }

    // Actualizar estado a FAENADO si tiene fecha de faena y estaba en RECIBIDO/EN_CORRAL/LISTO_FAENA/EN_FAENA
    if ((updates.fechaFaena || tropa.fechaFaena) &&
        ['RECIBIDO', 'EN_CORRAL', 'EN_PESAJE', 'PESADO', 'LISTO_FAENA', 'EN_FAENA'].includes(tropa.estado)) {
      updates.estado = 'FAENADO'
    }

    if (Object.keys(updates).length > 0) {
      const prevEstado = tropa.estado
      await db.tropa.update({ where: { id: tropa.id }, data: updates })
      tropasActualizadas++
      if (updates.estado && updates.estado !== prevEstado) {
        estadosActualizados++
      }
    }
  }

  console.log(`Tropas actualizadas: ${tropasActualizadas}`)
  console.log(`Estados → FAENADO: ${estadosActualizados}`)
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
            rindePorcentaje: Math.round(animal.rinde * 10000) / 100,
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
