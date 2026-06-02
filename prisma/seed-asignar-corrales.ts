/**
 * Asignación de corrales a tropas desde PLANTILLA MARCELO.xlsx
 * 
 * LÓGICA:
 * - D-01 → Corral 1, D-02 → Corral 2, ... D-08 → Corral 8
 * - Si la tropa está en un solo corral → asigna corralId directamente
 * - Si la tropa está en varios corrales → asigna el PRIMERO como corralId
 *   y guarda todos los corrales en el campo observaciones
 * - Limpia variaciones de tipeo: "D-01, D-02", "D-01-D-02", "D01", etc.
 * 
 * Ejecutar: npx tsx prisma/seed-asignar-corrales.ts
 */
import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as path from 'path'

const db = new PrismaClient()

// Leer celda segura
function getCell(sheet: XLSX.WorkSheet, row: number, col: number): any {
  const addr = XLSX.utils.encode_cell({ r: row, c: col })
  return sheet[addr]?.v ?? null
}

/**
 * Normaliza un string de corrales y extrae los números individuales.
 * "D-01" → [1], "D-05, D-06, D-08" → [5, 6, 8],
 * "D-01-D-02" → [1, 2], "D01,D02" → [1, 2], "D - 01" → [1]
 */
function parseCorrales(raw: string): number[] {
  if (!raw) return []
  
  // Normalizar: quitar espacios, "D - " → "D-", separar por , - o espacio
  const normalized = raw
    .toUpperCase()
    .replace(/\s+/g, '')          // quitar espacios
    .replace(/,/g, '-')           // comas → guiones
    .replace(/0D-/g, 'D-')        // fix "0D-02" → "D-02"
    .replace(/D-/g, '|D-')        // marcadores
    .replace(/\|D(\d+)/g, '$1')   // extraer números
  
  // Extraer todos los números
  const matches = normalized.match(/\d+/g)
  if (!matches) return []
  
  // Convertir a números únicos y ordenados
  const numeros = [...new Set(matches.map(Number))].sort((a, b) => a - b)
  return numeros.filter(n => n >= 1 && n <= 8) // solo corrales válidos (1-8)
}

async function main() {
  console.log('=== ASIGNACIÓN DE CORRALES A TROPAS ===\n')

  // 1. Verificar corrales existentes en BD
  const corralesBD = await db.corral.findMany({
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  })
  console.log(`Corrales en BD: ${corralesBD.length}`)
  for (const c of corralesBD) {
    console.log(`  - "${c.nombre}" (ID: ${c.id})`)
  }
  console.log()

  // 2. Leer PLANTILLA MARCELO.xlsx
  const projectRoot = path.resolve(__dirname, '..')
  const relativePath = path.join(projectRoot, 'upload', 'PLANTILLA MARCELO.xlsx')
  const fallbackPath = '/home/z/my-project/upload/PLANTILLA MARCELO.xlsx'
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
      console.error('ERROR: No se encontró PLANTILLA MARCELO.xlsx')
      console.error(`Uso: npx tsx prisma/seed-asignar-corrales.ts [ruta/al/archivo.xlsx]`)
      process.exit(1)
    }
  }

  const ws = workbook.Sheets['TROPAS']
  if (!ws) {
    console.error('ERROR: No se encontró la hoja "TROPAS"')
    process.exit(1)
  }

  // 3. Mapear nombre de corral → ID
  // Buscar corral cuyo nombre contenga el número (ej: "Corral 1", "D-01", "1", etc.)
  function findCorralByNumero(numero: number) {
    const strNum = String(numero)
    // Buscar exacto primero
    const exacto = corralesBD.find(c => c.nombre === `D-${String(numero).padStart(2, '0')}`)
    if (exacto) return exacto
    // Buscar por número en el nombre
    const porNumero = corralesBD.find(c => c.nombre.includes(strNum))
    if (porNumero) return porNumero
    return null
  }

  // 4. Cargar tropas
  const tropasBD = await db.tropa.findMany({
    select: { id: true, numero: true, codigo: true, corralId: true, observaciones: true },
  })
  const tropaByCodigo = new Map(tropasBD.map(t => [t.codigo, t]))
  const tropaByNumero = new Map(tropasBD.map(t => [t.numero, t]))

  // 5. Procesar cada fila
  let corralAsignados = 0
  let corralMulti = 0
  let corralSinDatos = 0
  let corralYaAsignados = 0
  let noEncontrados: string[] = []

  for (let r = 4; r <= 250; r++) {
    const codigo = String(getCell(ws, r, 0) || '').trim()
    if (!codigo) break

    const corralRaw = String(getCell(ws, r, 9) || '').trim()
    
    // Buscar tropa
    let tropa = tropaByCodigo.get(codigo)
    if (!tropa) {
      const match = codigo.match(/(\d+)$/)
      if (match) {
        tropa = tropaByNumero.get(parseInt(match[1]))
      }
    }
    if (!tropa) {
      noEncontrados.push(codigo)
      continue
    }

    // Si ya tiene corral asignado, no tocar
    if (tropa.corralId) {
      corralYaAsignados++
      continue
    }

    // Parsear corrales del Excel
    const corralesNums = parseCorrales(corralRaw)
    if (corralesNums.length === 0) {
      corralSinDatos++
      continue
    }

    const updates: any = {}

    if (corralesNums.length === 1) {
      // Un solo corral → asignar directo
      const corral = findCorralByNumero(corralesNums[0])
      if (corral) {
        updates.corralId = corral.id
        corralAsignados++
      }
    } else {
      // Múltiples corrales → primero como principal, todos en observaciones
      const primerCorral = findCorralByNumero(corralesNums[0])
      if (primerCorral) {
        updates.corralId = primerCorral.id
      }
      // Agregar corrales a observaciones
      const corralesStr = corralesNums.map(n => `D-${String(n).padStart(2, '0')}`).join(', ')
      const obsPrefix = tropa.observaciones ? `${tropa.observaciones}\n` : ''
      updates.observaciones = `${obsPrefix}Corrales: ${corralesStr}`
      corralMulti++
    }

    if (Object.keys(updates).length > 0) {
      await db.tropa.update({ where: { id: tropa.id }, data: updates })
    }
  }

  // 6. Resumen
  console.log(`\n=== RESUMEN ===`)
  console.log(`Corrales asignados (individual): ${corralAsignados}`)
  console.log(`Corrales asignados (múltiple, primero como principal): ${corralMulti}`)
  console.log(`Sin datos de corral en Excel: ${corralSinDatos}`)
  console.log(`Ya tenían corral asignado: ${corralYaAsignados}`)
  if (noEncontrados.length > 0) {
    console.log(`Tropas no encontradas: ${noEncontrados.length}`)
  }

  // Estado final
  const tropasConCorral = await db.tropa.count({ where: { corralId: { not: null } } })
  const tropasTotal = await db.tropa.count()
  console.log(`\n=== ESTADO FINAL ===`)
  console.log(`Con corral asignado: ${tropasConCorral} / ${tropasTotal}`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
