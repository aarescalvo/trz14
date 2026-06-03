/**
 * Importa datos de Pesaje de Camión desde Excel a la base de datos.
 * SOLO crea PesajeCamion y actualiza pesos en tropas EXISTENTES.
 * No duplica tropas, animales, ni documentos.
 *
 * La planilla debe tener las columnas:
 *   A: N° Tropa (obligatorio)
 *   B: Fecha Ingreso (DD/MM/AAAA)
 *   C: Hora Ingreso (HH:MM)
 *   D: Patente Chasis (obligatorio)
 *   E: Patente Acoplado
 *   F: Chofer Nombre
 *   G: Chofer DNI
 *   H: Transportista (nombre)
 *   I: N° Ticket Balanza (obligatorio)
 *   J: Peso Bruto (kg)
 *   K: Peso Tara (kg)
 *   L: Peso Neto (kg) - si está vacío se calcula J-K
 *   M: Productor (info, no se usa para FK)
 *   N: N° DTE (no se usa, ya está en la tropa)
 *   O: N° Guía (no se usa, ya está en la tropa)
 *   P: Observaciones
 *
 * Uso:
 *   npx tsx scripts/importar-pesaje-camion.ts "ruta/al/archivo.xlsx"
 *   npx tsx scripts/importar-pesaje-camion.ts "C:\TrazaAlan\upload\planilla.xlsx"
 *
 * Opciones:
 *   --dry-run   Solo muestra lo que haría, no ejecuta cambios
 *   --hoja=N    Número de hoja (default: 0, la primera)
 */
import * as XLSX from 'xlsx'
import * as path from 'path'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// Parsear fecha DD/MM/AAAA
function parseFecha(valor: any): Date | null {
  if (!valor) return null

  // Si ya es un número de serie de Excel
  if (typeof valor === 'number') {
    const date = XLSX.SSF.parse_date_code(valor)
    if (date) {
      return new Date(date.y, date.m - 1, date.d, date.H || 0, date.M || 0, date.S || 0)
    }
  }

  // Si es string, intentar DD/MM/AAAA o DD-MM-AAAA
  if (typeof valor === 'string') {
    const cleaned = valor.trim()
    // DD/MM/AAAA HH:MM
    const matchFull = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{2})/)
    if (matchFull) {
      return new Date(
        parseInt(matchFull[3]),
        parseInt(matchFull[2]) - 1,
        parseInt(matchFull[1]),
        parseInt(matchFull[4]),
        parseInt(matchFull[5])
      )
    }
    // DD/MM/AAAA
    const match = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
    if (match) {
      return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]))
    }
  }

  return null
}

// Parsear hora HH:MM
function parseHora(valor: any): Date | null {
  if (!valor || typeof valor !== 'string') return null
  const match = valor.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  const d = new Date()
  d.setHours(parseInt(match[1]), parseInt(match[2]), 0, 0)
  return d
}

// Combinar fecha + hora
function parseFechaHora(fechaVal: any, horaVal: any): Date {
  const fecha = parseFecha(fechaVal)
  if (fecha) {
    const hora = parseHora(horaVal)
    if (hora) {
      fecha.setHours(hora.getHours(), hora.getMinutes(), 0, 0)
    }
    return fecha
  }
  return new Date()
}

function parsePeso(valor: any): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  const num = parseFloat(String(valor).replace(/[^\d.\-]/g, ''))
  return isNaN(num) ? null : num
}

interface FilaPesaje {
  numeroTropa: number
  fecha: Date
  patenteChasis: string
  patenteAcoplado: string | null
  choferNombre: string | null
  choferDni: string | null
  transportistaNombre: string | null
  numeroTicket: number
  pesoBruto: number | null
  pesoTara: number | null
  pesoNeto: number | null
  observaciones: string | null
}

function parseHoja(ws: XLSX.WorkSheet): FilaPesaje[] {
  const filas: FilaPesaje[] = []
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')

  // Determinar la fila de inicio: buscar header "N° Tropa" o "Tropa"
  let headerRow = -1
  for (let r = range.s.r; r <= Math.min(range.e.r, 10); r++) {
    const cellVal = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v
    if (cellVal && String(cellVal).toLowerCase().includes('tropa')) {
      headerRow = r
      break
    }
  }

  if (headerRow === -1) {
    console.log('⚠️  No se encontró fila de encabezado. Asumiendo fila 3 (después del título).')
    headerRow = 3 // Default: fila 4 en Excel (0-indexed = 3)
  }

  // Leer filas de datos
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const getCell = (col: number) => {
      const addr = XLSX.utils.encode_cell({ r, c: col })
      return ws[addr]?.v
    }

    const numeroTropa = parseInt(getCell(0)) // Col A
    if (isNaN(numeroTropa) || numeroTropa === 0) continue

    const pesoBruto = parsePeso(getCell(9))  // Col J
    const pesoTara = parsePeso(getCell(10))  // Col K
    let pesoNeto = parsePeso(getCell(11))    // Col L

    // Calcular peso neto si no está especificado
    if (pesoNeto === null && pesoBruto !== null && pesoTara !== null) {
      pesoNeto = pesoBruto - pesoTara
    }

    // Verificar que haya al menos peso bruto o tara
    if (pesoBruto === null && pesoTara === null) continue

    const numeroTicket = parseInt(getCell(8)) // Col I
    if (isNaN(numeroTicket) || numeroTicket === 0) {
      console.log(`⚠️  Tropa ${numeroTropa}: sin número de ticket, se generará automáticamente`)
    }

    const fecha = parseFechaHora(getCell(1), getCell(2)) // Col B + C
    const patenteChasis = String(getCell(3) || '').trim() // Col D

    filas.push({
      numeroTropa,
      fecha,
      patenteChasis: patenteChasis || 'S/D',
      patenteAcoplado: getCell(4) ? String(getCell(4)).trim() : null, // Col E
      choferNombre: getCell(5) ? String(getCell(5)).trim() : null,    // Col F
      choferDni: getCell(6) ? String(getCell(6)).trim() : null,       // Col G
      transportistaNombre: getCell(7) ? String(getCell(7)).trim() : null, // Col H
      numeroTicket: isNaN(numeroTicket) ? 0 : numeroTicket,
      pesoBruto,
      pesoTara,
      pesoNeto,
      observaciones: getCell(15) ? String(getCell(15)).trim() : null, // Col P
    })
  }

  return filas
}

async function main() {
  console.log('=== IMPORTACIÓN DE PESAJE DE CAMIÓN ===\n')

  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const filePath = args.find(a => !a.startsWith('--'))

  if (!filePath) {
    console.log('❌ ERROR: Debe especificar la ruta del archivo Excel.')
    console.log('Uso: npx tsx scripts/importar-pesaje-camion.ts "ruta/al/archivo.xlsx"')
    console.log('     npx tsx scripts/importar-pesaje-camion.ts "ruta/al/archivo.xlsx" --dry-run')
    process.exit(1)
  }

  if (dryRun) {
    console.log('🔍 MODO DRY-RUN: No se ejecutarán cambios en la base de datos.\n')
  }

  // 1. Leer archivo Excel
  console.log(`📂 Leyendo archivo: ${filePath}`)
  const absolutePath = path.resolve(filePath)
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.readFile(absolutePath)
  } catch (e: any) {
    console.log(`❌ ERROR: No se pudo leer el archivo: ${e.message}`)
    console.log(`   Ruta absoluta: ${absolutePath}`)
    process.exit(1)
  }

  const hojaName = workbook.SheetNames[0]
  console.log(`📋 Hoja: "${hojaName}"`)
  const ws = workbook.Sheets[hojaName]

  // 2. Parsear filas
  const filas = parseHoja(ws)
  console.log(`📊 Filas con datos de pesaje encontradas: ${filas.length}\n`)

  if (filas.length === 0) {
    console.log('❌ No se encontraron filas con datos de pesaje en la planilla.')
    process.exit(0)
  }

  // Mostrar resumen
  console.log('─── RESUMEN DE DATOS A IMPORTAR ───')
  for (const f of filas) {
    console.log(
      `  Tropa ${String(f.numeroTropa).padStart(3)} | ` +
      `Ticket: ${f.numeroTicket || 'AUTO'} | ` +
      `Bruto: ${f.pesoBruto ?? '-'} | Tara: ${f.pesoTara ?? '-'} | Neto: ${f.pesoNeto ?? '-'} | ` +
      `Patente: ${f.patenteChasis} | Chofer: ${f.choferNombre || '-'}`
    )
  }
  console.log('')

  if (dryRun) {
    console.log('✅ DRY-RUN completado. No se hicieron cambios.')
    process.exit(0)
  }

  // 3. Obtener último número de ticket
  const lastPesaje = await db.pesajeCamion.findFirst({
    orderBy: { numeroTicket: 'desc' }
  })
  let nextTicket = (lastPesaje?.numeroTicket || 0) + 1

  // 4. Obtener transportistas para matching por nombre
  const transportistas = await db.transportista.findMany()
  const transportistaMap = new Map<string, string>()
  for (const t of transportistas) {
    transportistaMap.set(t.nombre.toLowerCase(), t.id)
  }

  // 5. Obtener primer operador para asignar
  const operador = await db.operador.findFirst()
  const operadorId = operador?.id

  // 6. Procesar cada fila
  console.log('─── INICIANDO IMPORTACIÓN ───\n')
  let importadas = 0
  let errores = 0
  let yaExistian = 0

  for (const fila of filas) {
    try {
      // Buscar tropa existente por numero
      const tropa = await db.tropa.findUnique({
        where: { numero: fila.numeroTropa },
        include: { pesajeCamion: true, corral: true }
      })

      if (!tropa) {
        console.log(`⚠️  Tropa ${fila.numeroTropa} NO encontrada en la base. Saltando.`)
        errores++
        continue
      }

      if (tropa.pesajeCamion) {
        console.log(`ℹ️  Tropa ${fila.numeroTropa} (${tropa.codigo}) ya tiene PesajeCamión asociado (Ticket #${tropa.pesajeCamion.numeroTicket}). Saltando.`)
        yaExistian++
        continue
      }

      // Determinar número de ticket
      const ticketNum = fila.numeroTicket || nextTicket
      if (!fila.numeroTicket) nextTicket++ // Solo incrementar si se generó auto

      // Determinar transportista
      let transportistaId: string | undefined
      if (fila.transportistaNombre) {
        transportistaId = transportistaMap.get(fila.transportistaNombre.toLowerCase())
        if (!transportistaId) {
          // Buscar parcial
          for (const [nombre, id] of transportistaMap) {
            if (nombre.includes(fila.transportistaNombre.toLowerCase()) ||
                fila.transportistaNombre.toLowerCase().includes(nombre)) {
              transportistaId = id
              break
            }
          }
        }
      }

      // Determinar estado
      const estado = (fila.pesoBruto && fila.pesoTara) ? 'CERRADO' : 'ABIERTO'

      // Crear PesajeCamion dentro de transacción
      const result = await db.$transaction(async (tx) => {
        // Crear pesaje
        const pesaje = await tx.pesajeCamion.create({
          data: {
            tipo: 'INGRESO_HACIENDA',
            numeroTicket: ticketNum,
            patenteChasis: fila.patenteChasis,
            patenteAcoplado: fila.patenteAcoplado,
            choferNombre: fila.choferNombre,
            choferDni: fila.choferDni,
            transportistaId: transportistaId,
            pesoBruto: fila.pesoBruto,
            pesoTara: fila.pesoTara,
            pesoNeto: fila.pesoNeto,
            observaciones: fila.observaciones,
            estado: estado,
            fecha: fila.fecha,
            fechaTara: fila.pesoTara ? fila.fecha : null,
            operadorId: operadorId,
          }
        })

        // Actualizar tropa: vincular pesaje + actualizar pesos
        const updatedTropa = await tx.tropa.update({
          where: { id: tropa.id },
          data: {
            pesajeCamionId: pesaje.id,
            pesoBruto: fila.pesoBruto,
            pesoTara: fila.pesoTara,
            pesoNeto: fila.pesoNeto,
          }
        })

        return { pesaje, updatedTropa }
      })

      // Si no se usó el ticket de la fila, incrementar el contador
      if (fila.numeroTicket && ticketNum > nextTicket) {
        nextTicket = ticketNum + 1
      }

      importadas++
      console.log(
        `✅ Tropa ${fila.numeroTropa} (${tropa.codigo}): Pesaje creado` +
        ` | Ticket #${ticketNum}` +
        (fila.pesoBruto ? ` | Bruto: ${fila.pesoBruto}kg` : '') +
        (fila.pesoTara ? ` | Tara: ${fila.pesoTara}kg` : '') +
        (fila.pesoNeto ? ` | Neto: ${fila.pesoNeto}kg` : '') +
        (transportistaId ? ` | Transportista: vinculado` : '') +
        ` | Estado: ${estado}`
      )
    } catch (err: any) {
      errores++
      console.log(`❌ Error en Tropa ${fila.numeroTropa}: ${err.message}`)
    }
  }

  // 7. Resumen final
  console.log('\n═══════════════════════════════════════')
  console.log('  RESUMEN DE IMPORTACIÓN')
  console.log('═══════════════════════════════════════')
  console.log(`  ✅ Importadas exitosas: ${importadas}`)
  console.log(`  ℹ️  Ya existían (saltadas): ${yaExistian}`)
  console.log(`  ❌ Errores: ${errores}`)
  console.log(`  📊 Total procesadas: ${filas.length}`)
  console.log('═══════════════════════════════════════')

  // Verificación: mostrar algunas tropas con su pesaje
  if (importadas > 0) {
    console.log('\n── VERIFICACIÓN ──')
    const tropasVerificadas = await db.tropa.findMany({
      where: { numero: { in: filas.map(f => f.numeroTropa) } },
      include: { pesajeCamion: true },
      orderBy: { numero: 'asc' }
    })

    for (const t of tropasVerificadas) {
      if (t.pesajeCamion) {
        console.log(
          `  Tropa ${String(t.numero).padStart(3)} (${t.codigo}): ` +
          `Ticket #${t.pesajeCamion.numeroTicket} | ` +
          `Bruto: ${t.pesoBruto ?? '-'} | Tara: ${t.pesoTara ?? '-'} | Neto: ${t.pesoNeto ?? '-'}`
        )
      }
    }
  }
}

main()
  .catch(err => {
    console.error('❌ Error fatal:', err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
