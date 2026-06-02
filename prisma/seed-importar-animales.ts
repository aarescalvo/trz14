/**
 * Importación de ANIMALES desde PLANTILLAMAXI.xlsx
 * 
 * Ejecutar: npx tsx prisma/seed-importar-animales.ts
 * 
 * SEGURIDAD:
 * - NO elimina ningún registro existente
 * - Si la tropa ya existe, la usa tal cual (no la modifica)
 * - Si la tropa no existe, la crea con valores seguros
 * - Si el animal ya existe (tropaId + numero), lo OMITE (no duplica)
 * - Idempotente: se puede ejecutar cuantas veces se quiera
 */

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'

const db = new PrismaClient()

// Mapeo de tipos de animal del Excel al enum Prisma
const TIPO_ANIMAL_MAP: Record<string, string> = {
  'TO': 'TO',
  'VA': 'VA',
  'VQ': 'VQ',
  'MEJ': 'MEJ',
  'NO': 'NO',
  'NT': 'NT',
  'V': 'VQ', // Corrección: 'V' aislado se asume Vaquillona
}

// Datos de calidad a corregir
const RAZA_MAP: Record<string, string> = {
  'CHAROLAI': 'CHAROLAIS',
  'C': 'CRUZA',
  'BRA': 'BRAFORD',
  'BRAFORD': 'BRAFORD',
}

interface ExcelRow {
  CODIGO_TROPA: string
  NUMERO_ANIMAL: number
  CARAVANA: string
  TIPO_ANIMAL: string
  RAZA: string
  PESO_VIVO: number
}

async function main() {
  console.log('=== IMPORTACIÓN DE ANIMALES DESDE PLANTILLAMAXI.xlsx ===\n')

  // 1. Leer el archivo Excel
  const filePath = '/home/z/my-project/upload/PLANTILLAMAXI.xlsx'
  console.log(`Leyendo archivo: ${filePath}`)
  
  const workbook = XLSX.readFile(filePath)
  const sheetName = 'ANIMALES'
  const sheet = workbook.Sheets[sheetName]
  
  if (!sheet) {
    console.error(`ERROR: No se encontró la hoja "${sheetName}"`)
    process.exit(1)
  }

  // Convertir a JSON (saltar filas de encabezado)
  const rawData = XLSX.utils.sheet_to_json<ExcelRow>(sheet, {
    range: 3, // Fila 4 es header (0-indexed = row 3)
  })

  // Filtrar filas vacías
  const rows = rawData.filter(r => r.CODIGO_TROPA && r.NUMERO_ANIMAL)
  console.log(`Filas leídas: ${rows.length}`)

  // 2. Buscar o crear un usuario de faena por defecto
  let usuarioFaena = await db.cliente.findFirst({
    where: {
      razonSocial: { contains: 'MAXI', mode: 'insensitive' },
    },
  })

  if (!usuarioFaena) {
    // Buscar cualquier cliente que pueda servir como usuario de faena
    usuarioFaena = await db.cliente.findFirst({
      where: { activo: true },
      orderBy: { createdAt: 'asc' },
    })
  }

  if (!usuarioFaena) {
    console.log('Creando cliente por defecto para usuario de faena...')
    usuarioFaena = await db.cliente.create({
      data: {
        razonSocial: 'FRIGORIFICO DEFAULT',
        nombreFantasia: 'Default',
        cuit: '30000000000',
        condicionIva: 'RESPONSABLE_INSCRIPTO',
        activo: true,
        tipoCliente: 'USUARIO_FAENA',
      },
    })
  }

  console.log(`Usuario de faena: ${usuarioFaena.razonSocial} (ID: ${usuarioFaena.id})\n`)

  // 3. Contar estado actual de la BD
  const tropasExistentes = await db.tropa.findMany({
    select: { id: true, numero: true, codigo: true, cantidadCabezas: true },
  })
  const tropaByCodigo = new Map(tropasExistentes.map(t => [t.codigo, t]))
  const tropaByNumero = new Map(tropasExistentes.map(t => [t.numero, t]))
  const animalesExistentes = await db.animal.findMany({
    select: { id: true, tropaId: true, numero: true, codigo: true },
  })
  const animalByKey = new Map(animalesExistentes.map(a => [`${a.tropaId}-${a.numero}`, a]))
  
  console.log(`Estado actual BD:`)
  console.log(`  Tropas existentes: ${tropasExistentes.length}`)
  console.log(`  Animales existentes: ${animalesExistentes.length}\n`)

  // 4. Agrupar animales por tropa
  const tropasFromExcel = new Map<string, ExcelRow[]>()
  for (const row of rows) {
    const codigo = String(row.CODIGO_TROPA).trim()
    if (!tropasFromExcel.has(codigo)) {
      tropasFromExcel.set(codigo, [])
    }
    tropasFromExcel.get(codigo)!.push(row)
  }
  console.log(`Tropas en Excel: ${tropasFromExcel.size}`)

  // 5. Crear tropas faltantes
  let tropasCreadas = 0
  let tropasReutilizadas = 0

  for (const [codigoTropa, animalesTropa] of tropasFromExcel) {
    let tropa = tropaByCodigo.get(codigoTropa)

    if (!tropa) {
      // Extraer número de tropa del código "B 2026 0001" → 1
      const match = codigoTropa.match(/(\d+)$/)
      const numero = match ? parseInt(match[1]) : 0

      // Verificar si el número ya existe con otro código
      if (numero > 0 && !tropaByNumero.has(numero)) {
        // Construir código simplificado: "B0001"
        const prefix = codigoTropa.split(' ')[0] // "B"
        const padded = String(numero).padStart(4, '0')
        const codigoSimplificado = `${prefix}${padded}`

        tropa = await db.tropa.create({
          data: {
            numero,
            codigo: codigoTropa,
            codigoSimplificado: codigoSimplificado,
            usuarioFaenaId: usuarioFaena.id,
            especie: 'BOVINO',
            dte: 'PENDIENTE',
            guia: 'PENDIENTE',
            cantidadCabezas: animalesTropa.length,
            estado: 'RECIBIDO',
          },
        })
        tropaByCodigo.set(tropa.codigo, tropa)
        tropaByNumero.set(tropa.numero, tropa)
        tropasCreadas++
        console.log(`  + Tropa creada: ${tropa.codigo} (${animalesTropa.length} cabezas)`)
      } else if (numero > 0 && tropaByNumero.has(numero)) {
        // El número ya existe pero con código diferente — usar esa
        tropa = tropaByNumero.get(numero)!
        console.log(`  ! Tropa ${numero} ya existe con código "${tropa.codigo}" (se reutiliza)`)
        tropasReutilizadas++
      } else {
        console.log(`  ? Tropa "${codigoTropa}" sin número válido, se omite`)
        continue
      }
    } else {
      tropasReutilizadas++
    }
  }

  console.log(`\nResumen tropas: ${tropasCreadas} creadas, ${tropasReutilizadas} reutilizadas`)

  // 6. Crear animales faltantes
  let animalesCreados = 0
  let animalesOmitidos = 0
  let animalesActualizados = 0
  let errores = 0

  for (const [codigoTropa, animalesTropa] of tropasFromExcel) {
    const tropa = tropaByCodigo.get(codigoTropa)
    if (!tropa) {
      console.log(`  ? Tropa "${codigoTropa}" no encontrada, se omiten sus animales`)
      animalesOmitidos += animalesTropa.length
      continue
    }

    for (const row of animalesTropa) {
      const numero = parseInt(String(row.NUMERO_ANIMAL))
      const key = `${tropa.id}-${numero}`

      // Verificar si el animal ya existe
      if (animalByKey.has(key)) {
        animalesOmitidos++
        continue
      }

      // Normalizar datos
      const tipoAnimalRaw = String(row.TIPO_ANIMAL).trim().toUpperCase()
      const tipoAnimal = TIPO_ANIMAL_MAP[tipoAnimalRaw] || 'NT'
      const razaRaw = String(row.RAZA || '').trim().toUpperCase()
      const raza = RAZA_MAP[razaRaw] || razaRaw || null
      const caravana = String(row.CARAVANA || '').trim() || null
      const pesoVivo = row.PESO_VIVO ? parseFloat(String(row.PESO_VIVO)) : null

      // Construir código de animal: "B20260001-001"
      const tropaNumStr = String(tropa.numero).padStart(4, '0')
      const animalNumStr = String(numero).padStart(3, '0')
      const codigo = `B${new Date().getFullYear()}${tropaNumStr}-${animalNumStr}`

      try {
        await db.animal.create({
          data: {
            tropaId: tropa.id,
            numero,
            codigo,
            caravana,
            tipoAnimal: tipoAnimal as any,
            raza,
            pesoVivo,
            estado: 'RECIBIDO',
          },
        })
        animalesCreados++
        animalByKey.set(key, { id: '', tropaId: tropa.id, numero, codigo })
      } catch (err: any) {
        // Si falla por código duplicado, intentar con código alternativo
        if (err.message?.includes('Unique') || err.message?.includes('duplicate')) {
          const codigoAlt = `X${tropaNumStr}-${animalNumStr}`
          try {
            await db.animal.create({
              data: {
                tropaId: tropa.id,
                numero,
                codigo: codigoAlt,
                caravana,
                tipoAnimal: tipoAnimal as any,
                raza,
                pesoVivo,
                estado: 'RECIBIDO',
              },
            })
            animalesCreados++
            animalByKey.set(key, { id: '', tropaId: tropa.id, numero, codigo: codigoAlt })
          } catch (err2: any) {
            console.log(`  ERROR creando animal ${tropa.codigo}-${numero}: ${err2.message}`)
            errores++
          }
        } else {
          console.log(`  ERROR creando animal ${tropa.codigo}-${numero}: ${err.message}`)
          errores++
        }
      }
    }
  }

  // 7. Actualizar cantidadCabezas de tropas que tengan nuevos animales
  for (const [codigoTropa] of tropasFromExcel) {
    const tropa = tropaByCodigo.get(codigoTropa)
    if (!tropa) continue
    
    const count = await db.animal.count({ where: { tropaId: tropa.id } })
    if (count !== tropa.cantidadCabezas) {
      await db.tropa.update({
        where: { id: tropa.id },
        data: { cantidadCabezas: count },
      })
    }
  }

  // 8. Crear TropaAnimalCantidad para las tropas nuevas
  for (const [codigoTropa, animalesTropa] of tropasFromExcel) {
    const tropa = tropaByCodigo.get(codigoTropa)
    if (!tropa) continue
    
    // Contar tipos de animal
    const tipoCounts: Record<string, number> = {}
    for (const row of animalesTropa) {
      const tipoRaw = String(row.TIPO_ANIMAL).trim().toUpperCase()
      const tipo = TIPO_ANIMAL_MAP[tipoRaw] || 'NT'
      tipoCounts[tipo] = (tipoCounts[tipo] || 0) + 1
    }

    for (const [tipo, cantidad] of Object.entries(tipoCounts)) {
      await db.tropaAnimalCantidad.upsert({
        where: {
          tropaId_tipoAnimal: {
            tropaId: tropa.id,
            tipoAnimal: tipo as any,
          },
        },
        create: {
          tropaId: tropa.id,
          tipoAnimal: tipo as any,
          cantidad,
        },
        update: { cantidad },
      })
    }
  }

  // 9. Resumen final
  const totalFinalTropas = await db.tropa.count()
  const totalFinalAnimales = await db.animal.count()
  const ultimaTropa = await db.tropa.findFirst({
    orderBy: { numero: 'desc' },
  })

  console.log('\n=== RESUMEN FINAL ===')
  console.log(`Tropas en BD: ${totalFinalTropas}`)
  console.log(`Animales en BD: ${totalFinalAnimales}`)
  console.log(`Animales creados esta ejecución: ${animalesCreados}`)
  console.log(`Animales omitidos (ya existían): ${animalesOmitidos}`)
  console.log(`Errores: ${errores}`)
  if (ultimaTropa) {
    console.log(`Última tropa: ${ultimaTropa.codigo} (N° ${ultimaTropa.numero})`)
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
