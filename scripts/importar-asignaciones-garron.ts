/**
 * Script de importación: AsignacionGarron desde planilla RINDE FAENA BOVINO.xlsx
 * 
 * Lee la planilla con 3 modelos de formato, extrae garron→animal por tropa,
 * y crea los registros AsignacionGarron faltantes vinculados a las listas de faena.
 * 
 * Uso: npx tsx scripts/importar-asignaciones-garron.ts
 * 
 * Precauciones:
 * - NO sobrescribe asignaciones existentes
 * - Valida unicidad (listaFaenaId + garron) y (animalId)
 * - Log detallado de todo lo creado y saltado
 */

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'

const db = new PrismaClient()

// Ruta del archivo Excel (ajustar si es necesario)
const EXCEL_PATH = path.resolve(__dirname, '../upload/RINDE FAENA BOVINO.xlsx')

interface FilaGarron {
  tropaNumero: number
  garron: number
  animalNumero: number
  raza: string | null
  tipoAnimal: string | null
  caravana: string | null
  pesoVivo: number | null
  kgMediaA: number | null
  kgMediaB: number | null
}

// Detectar en qué fila está el header "GARRON"
function detectarHeaderRow(ws: XLSX.WorkSheet): number | null {
  if (!ws || !ws['!ref']) return null
  const range = XLSX.utils.decode_range(ws['!ref'])
  for (let r = range.s.r; r <= Math.min(range.e.r, 30); r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      if (cell && cell.v && String(cell.v).includes('GARRON')) {
        return r + 1 // 1-indexed
      }
    }
  }
  return null
}

// Obtener número de tropa según el modelo
function obtenerTropaNumero(ws: XLSX.WorkSheet, headerRow: number): number | null {
  // Modelo A: header en fila 10, tropa en F6 (row 5, col 5 = G)
  if (headerRow <= 15) {
    // Modelo A: "TROPA Nº:" en F (col 5), valor en G (col 6)
    for (let r = 1; r < headerRow; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r: r - 1, c: 5 })]
      if (cell && String(cell.v).includes('TROPA')) {
        const valCell = ws[XLSX.utils.encode_cell({ r: r - 1, c: 6 })]
        return valCell ? Number(valCell.v) : null
      }
    }
  }

  // Modelos B y C: "Nº Tropa:" en A (col 0), valor en E (col 4)
  for (let r = 1; r < headerRow; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r: r - 1, c: 0 })]
    if (cell && String(cell.v).includes('Tropa')) {
      const valCell = ws[XLSX.utils.encode_cell({ r: r - 1, c: 4 })]
      return valCell ? Number(valCell.v) : null
    }
  }

  return null
}

// Extraer filas de datos de garrones
function extraerFilas(ws: XLSX.WorkSheet, headerRow: number, tropaNumero: number): FilaGarron[] {
  const filas: FilaGarron[] = []
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')

  // Datos empiezan 2 filas después del header (sub-header intermedio)
  const dataStartRow = headerRow + 2 - 1 // 0-indexed

  for (let r = dataStartRow; r <= range.e.r; r++) {
    // Col C (2) = garron, Col D (3) = animal
    const garronCell = ws[XLSX.utils.encode_cell({ r, c: 2 })]
    const animalCell = ws[XLSX.utils.encode_cell({ r, c: 3 })]

    if (!garronCell || garronCell.v == null || !animalCell || animalCell.v == null) continue

    const garron = Number(garronCell.v)
    const animalNumero = Number(animalCell.v)

    if (isNaN(garron) || isNaN(animalNumero) || garron <= 0) continue

    // Col E (4) = raza, Col F (5) = tipo animal
    const razaCell = ws[XLSX.utils.encode_cell({ r, c: 4 })]
    const tipoCell = ws[XLSX.utils.encode_cell({ r, c: 5 })]

    // Caravana: Modelo A = G(6), Modelos B/C = H(7)
    const caravanaCol = headerRow <= 15 ? 6 : 7
    const caravanaCell = ws[XLSX.utils.encode_cell({ r, c: caravanaCol })]

    // Peso vivo (KG ENTRADA): Modelo A = H(7), Modelos B/C = I(8)
    const pesoCol = headerRow <= 15 ? 7 : 8
    const pesoCell = ws[XLSX.utils.encode_cell({ r, c: pesoCol })]

    // KG Media A: Modelo A = I(8), Modelos B/C = J(9)
    const mediaACol = headerRow <= 15 ? 8 : 9
    const mediaACell = ws[XLSX.utils.encode_cell({ r, c: mediaACol })]

    // KG Media B: Modelo A = J(9), Modelos B/C = K(10)
    const mediaBCol = headerRow <= 15 ? 9 : 10
    const mediaBCell = ws[XLSX.utils.encode_cell({ r, c: mediaBCol })]

    filas.push({
      tropaNumero,
      garron,
      animalNumero,
      raza: razaCell ? String(razaCell.v) : null,
      tipoAnimal: tipoCell ? String(tipoCell.v) : null,
      caravana: caravanaCell ? String(caravanaCell.v) : null,
      pesoVivo: pesoCell ? Number(pesoCell.v) || null : null,
      kgMediaA: mediaACell ? Number(mediaACell.v) || null : null,
      kgMediaB: mediaBCell ? Number(mediaBCell.v) || null : null,
    })
  }

  return filas
}

async function main() {
  console.log('========================================')
  console.log('IMPORTACIÓN ASIGNACIONES GARRÓN')
  console.log('========================================\n')

  // Verificar archivo
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`ERROR: Archivo no encontrado: ${EXCEL_PATH}`)
    console.error('Ajustar la ruta en EXCEL_PATH si es necesario.')
    process.exit(1)
  }
  console.log(`Leyendo: ${EXCEL_PATH}`)

  // Leer Excel
  const wb = XLSX.readFile(EXCEL_PATH, { type: 'file' })

  // Filtrar solo hojas de tropas (T XX)
  const hojasTropa = wb.SheetNames.filter(n => n.startsWith('T ') || n.startsWith('T\t'))
  console.log(`Hojas de tropa encontradas: ${hojasTropa.length}\n`)

  // Extraer todos los datos
  const todasLasFilas: FilaGarron[] = []
  let erroresHoja = 0

  for (const nombre of hojasTropa) {
    const ws = wb.Sheets[nombre]
    if (!ws) {
      console.error(`  ✗ ${nombre}: hoja no encontrada en workbook`)
      erroresHoja++
      continue
    }
    try {
      const headerRow = detectarHeaderRow(ws)
      if (!headerRow) {
        console.log(`  ⚠ ${nombre}: no se encontró header GARRON, saltando`)
        erroresHoja++
        continue
      }

      let tropaNumero = obtenerTropaNumero(ws, headerRow)
      // Fallback: extraer número de tropa del nombre de la hoja (ej: "T 18" → 18, "T 30 B" → 30)
      if (!tropaNumero) {
        const match = nombre.match(/T\s+(\d+)/)
        if (match) tropaNumero = parseInt(match[1], 10)
      }
      if (!tropaNumero) {
        console.log(`  ⚠ ${nombre}: no se pudo determinar número de tropa, saltando`)
        erroresHoja++
        continue
      }

      const filas = extraerFilas(ws, headerRow, tropaNumero)
      todasLasFilas.push(...filas)
    } catch (err) {
      console.error(`  ✗ ${nombre}: error al procesar:`, err)
      erroresHoja++
    }
  }

  console.log(`\nTotal filas extraídas: ${todasLasFilas.length}`)
  console.log(`Hojas con error: ${erroresHoja}`)

  // Agrupar por tropa
  const porTropa = new Map<number, FilaGarron[]>()
  for (const f of todasLasFilas) {
    if (!porTropa.has(f.tropaNumero)) porTropa.set(f.tropaNumero, [])
    porTropa.get(f.tropaNumero)!.push(f)
  }
  console.log(`Tropas distintas en Excel: ${porTropa.size}`)

  // Cargar datos de la DB
  console.log('\nCargando datos de la base...')

  // Todas las tropas de la DB
  const todasLasTropas = await db.tropa.findMany({
    include: {
      animales: {
        select: { id: true, numero: true, tipoAnimal: true, raza: true, caravana: true, pesoVivo: true }
      }
    }
  })

  // Mapa: tropa numero → tropa con animales
  const tropaByNumero = new Map<number, typeof todasLasTropas[0]>()
  for (const t of todasLasTropas) {
    tropaByNumero.set(t.numero, t)
  }

  // Todas las relaciones lista-tropa
  const listaTropaRelations = await db.listaFaenaTropa.findMany({
    include: {
      listaFaena: { select: { id: true, numero: true, fecha: true, estado: true } }
    }
  })

  // Mapa: tropa numero → listaFaenaId
  const listaByTropaNumero = new Map<number, string>()
  for (const lt of listaTropaRelations) {
    // Buscar la tropa por ID para obtener su numero
    const tropa = todasLasTropas.find(t => t.id === lt.tropaId)
    if (tropa) {
      listaByTropaNumero.set(tropa.numero, lt.listaFaenaId)
    }
  }

  // Asignaciones existentes (para no duplicar)
  const asignacionesExistentes = await db.asignacionGarron.findMany({
    select: { listaFaenaId: true, garron: true, animalId: true }
  })
  const existentesKey = new Set<string>()
  for (const a of asignacionesExistentes) {
    existentesKey.add(`${a.listaFaenaId}|${a.garron}`)
    if (a.animalId) existentesKey.add(`animal|${a.animalId}`)
  }

  // Animales ya asignados (animalId es @unique)
  const animalesYaAsignados = new Set<string>()
  for (const a of asignacionesExistentes) {
    if (a.animalId) animalesYaAsignados.add(a.animalId)
  }

  // Procesar cada tropa
  console.log('\n========================================')
  console.log('PROCESANDO ASIGNACIONES')
  console.log('========================================\n')

  let creados = 0
  let saltadosSinLista = 0
  let saltadosSinTropa = 0
  let saltadosSinAnimal = 0
  let saltadosDuplicado = 0
  let saltadosAnimalOcupado = 0
  const animalesFaltantes: string[] = []
  const detalles: string[] = []

  // Agrupar tropas procesadas para resumen
  const tropasProcesadas = new Set<number>()
  const listasProcesadas = new Map<string, { numero: number; fecha: Date; tropas: string[] }>()

  for (const [tropaNumero, filas] of porTropa) {
    const tropa = tropaByNumero.get(tropaNumero)
    if (!tropa) {
      saltadosSinTropa++
      continue
    }

    const listaFaenaId = listaByTropaNumero.get(tropaNumero)
    if (!listaFaenaId) {
      saltadosSinLista++
      if (saltadosSinLista <= 5) {
        console.log(`  ⚠ Tropa ${tropaNumero}: no encontrada en ninguna lista de faena`)
      }
      continue
    }

    // Registrar lista para resumen
    const lt = listaTropaRelations.find(r => r.listaFaenaId === listaFaenaId)
    if (lt) {
      if (!listasProcesadas.has(listaFaenaId)) {
        listasProcesadas.set(listaFaenaId, {
          numero: lt.listaFaena.numero,
          fecha: lt.listaFaena.fecha,
          tropas: []
        })
      }
      listasProcesadas.get(listaFaenaId)!.tropas.push(`T${tropaNumero}`)
    }

    for (const fila of filas) {
      // Verificar que no exista ya (lista + garron)
      const key = `${listaFaenaId}|${fila.garron}`
      if (existentesKey.has(key)) {
        saltadosDuplicado++
        continue
      }

      // Buscar el animal en esta tropa por numero
      const animal = tropa.animales.find(a => a.numero === fila.animalNumero)
      if (!animal) {
        saltadosSinAnimal++
        animalesFaltantes.push(`  Tropa ${tropaNumero}, garron ${fila.garron}, animal Nº ${fila.animalNumero} (caravana: ${fila.caravana || 'sin dato'}, raza: ${fila.raza || 'sin dato'})`)
        continue
      }

      // Verificar que el animal no esté ya asignado a otro garron
      if (animalesYaAsignados.has(animal.id)) {
        saltadosAnimalOcupado++
        continue
      }

      // Crear la asignación
      try {
        await db.asignacionGarron.create({
          data: {
            listaFaenaId,
            garron: fila.garron,
            animalId: animal.id,
            tropaCodigo: tropa.codigoSimplificado || tropa.codigo,
            animalNumero: fila.animalNumero,
            tipoAnimal: animal.tipoAnimal || fila.tipoAnimal || null,
            pesoVivo: animal.pesoVivo || fila.pesoVivo || null,
            tieneMediaDer: false,
            tieneMediaIzq: false,
            completado: false,
            horaIngreso: new Date(),
          }
        })

        // Registrar en sets para evitar duplicados dentro de este run
        existentesKey.add(key)
        existentesKey.add(`animal|${animal.id}`)
        animalesYaAsignados.add(animal.id)

        creados++
        tropasProcesadas.add(tropaNumero)
      } catch (err: any) {
        if (err?.code === 'P2002') {
          // Unique constraint violation
          saltadosDuplicado++
        } else {
          console.error(`  ✗ Error creando asignación T${tropaNumero} G${fila.garron}:`, err.message)
        }
      }
    }
  }

  // Detalle por lista (Fase 1)
  console.log('\n--- Detalle por lista (Fase 1) ---')
  for (const [listaId, info] of listasProcesadas) {
    const count = todasLasFilas.filter(f => listaByTropaNumero.get(f.tropaNumero) === listaId).length
    console.log(`  Lista N${String(info.numero).padStart(4, '0')} (${info.fecha.toLocaleDateString('es-AR')}): ${info.tropas.join(', ')} — ${count} garrones en planilla`)
  }

  // Tropas sin lista
  const tropasSinLista = [...porTropa.keys()].filter(n => !listaByTropaNumero.has(n))
  if (tropasSinLista.length > 0) {
    console.log(`\n⚠ Tropas sin lista de faena (no se crearon asignaciones):`)
    console.log(`  ${tropasSinLista.join(', ')}`)
  }

  // ============================================
  // FASE 2: Crear listas faltantes y re-procesar
  // ============================================
  if (tropasSinLista.length > 0) {
    console.log('\n========================================')
    console.log('FASE 2: CREAR LISTAS FALTANTES')
    console.log('========================================\n')

    // Mapeo de tropas → fecha de lista (según datos del usuario)
    const listasFaltantes = [
      { fecha: '2026-05-22', tropas: [200, 201] },
      { fecha: '2026-05-26', tropas: [202, 203] },
    ]

    for (const config of listasFaltantes) {
      const tropasACrear = config.tropas.filter(t => tropasSinLista.includes(t))
      if (tropasACrear.length === 0) continue

      const maxResult = await db.listaFaena.aggregate({ _max: { numero: true } })
      const nuevoNumero = (maxResult._max.numero || 0) + 1
      const fechaLista = new Date(config.fecha + 'T12:00:00-03:00')

      // Calcular cantidad total de cabezas
      let totalCabezas = 0
      for (const tn of tropasACrear) {
        const filasTropa = porTropa.get(tn)
        if (filasTropa) totalCabezas += filasTropa.length
      }

      const nuevaLista = await db.listaFaena.create({
        data: {
          numero: nuevoNumero,
          fecha: fechaLista,
          estado: 'ABIERTA',
          cantidadTotal: totalCabezas,
        }
      })
      console.log(`  ✓ Lista N${String(nuevoNumero).padStart(4, '0')} creada (${config.fecha}) — ${tropasACrear.length} tropas, ${totalCabezas} cabezas`)

      // Vincular tropas
      for (const tn of tropasACrear) {
        const tropa = tropaByNumero.get(tn)
        if (!tropa) continue
        const cantidad = porTropa.get(tn)?.length || 0
        await db.listaFaenaTropa.create({
          data: {
            listaFaenaId: nuevaLista.id,
            tropaId: tropa.id,
            cantidad,
          }
        })
        // Registrar en mapa para re-procesar
        listaByTropaNumero.set(tn, nuevaLista.id)
        console.log(`    → T${tn} vinculada (${cantidad} garrones)`)
      }
    }

    // Re-procesar las tropas que ahora tienen lista
    console.log('\n--- Re-procesando tropas con nuevas listas ---')
    let creadosFase2 = 0
    for (const tn of tropasSinLista) {
      const listaFaenaId = listaByTropaNumero.get(tn)
      if (!listaFaenaId) continue
      const tropa = tropaByNumero.get(tn)
      if (!tropa) continue
      const filas = porTropa.get(tn) || []

      for (const fila of filas) {
        const key = `${listaFaenaId}|${fila.garron}`
        if (existentesKey.has(key)) { saltadosDuplicado++; continue }

        const animal = tropa.animales.find(a => a.numero === fila.animalNumero)
        if (!animal) {
          animalesFaltantes.push(`  Tropa ${tn}, garron ${fila.garron}, animal Nº ${fila.animalNumero} (caravana: ${fila.caravana || 'sin dato'}, raza: ${fila.raza || 'sin dato'})`)  
          saltadosSinAnimal++
          continue
        }
        if (animalesYaAsignados.has(animal.id)) { saltadosAnimalOcupado++; continue }

        try {
          await db.asignacionGarron.create({
            data: {
              listaFaenaId,
              garron: fila.garron,
              animalId: animal.id,
              tropaCodigo: tropa.codigoSimplificado || tropa.codigo,
              animalNumero: fila.animalNumero,
              tipoAnimal: animal.tipoAnimal || fila.tipoAnimal || null,
              pesoVivo: animal.pesoVivo || fila.pesoVivo || null,
              tieneMediaDer: false,
              tieneMediaIzq: false,
              completado: false,
              horaIngreso: new Date(),
            }
          })
          existentesKey.add(key)
          existentesKey.add(`animal|${animal.id}`)
          animalesYaAsignados.add(animal.id)
          creadosFase2++
          creados++
        } catch (err: any) {
          if (err?.code === 'P2002') { saltadosDuplicado++ }
          else console.error(`  ✗ Error Fase2 T${tn} G${fila.garron}:`, err.message)
        }
      }
    }
    console.log(`\n  Asignaciones creadas en Fase 2: ${creadosFase2}`)
  }

  // Resumen final actualizado
  console.log('\n========================================')
  console.log('RESUMEN FINAL (incluye Fase 2)')
  console.log('========================================')
  console.log(`Asignaciones TOTALES:    ${creados}`)
  console.log(`Saltados (sin lista):   0`)
  console.log(`Saltados (sin tropa DB): ${saltadosSinTropa}`)
  console.log(`Saltados (sin animal):  ${saltadosSinAnimal}`)
  console.log(`Saltados (duplicado):   ${saltadosDuplicado}`)
  console.log(`Saltados (animal ocupado): ${saltadosAnimalOcupado}`)
  if (animalesFaltantes.length > 0) {
    console.log(`\n--- Animales no encontrados en DB ---`)
    for (const a of animalesFaltantes) console.log(a)
  }

  console.log('\n✓ Proceso finalizado.')
}

main()
  .catch(err => {
    console.error('ERROR FATAL:', err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())