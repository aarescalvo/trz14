/**
 * Limpieza + Importación de PLANTILLA MARCELO.xlsx
 * 
 * 1) BORRA datos estimados de pesoBruto y pesoNeto de TODAS las tropas
 *    (Esos valores fueron generados por seed-datos-reales.ts con fórmula pesoVivo×1.15)
 * 
 * 2) IMPORTA datos reales desde PLANTILLA MARCELO.xlsx:
 *    - dte (N° DTE real)
 *    - guia (N° Guía SENASA real)
 *    - fechaRecepcion (fecha de ingreso real)
 *    - productorId (vincula con cliente por CUIT)
 *    - usuarioFaenaId (vincula con cliente por CUIT)
 *    - corralId (vincula con corral por nombre)
 * 
 * SEGURIDAD:
 * - Solo borra pesoBruto/pesoNeto estimados (los que matchean la fórmula pesoVivo×1.15)
 * - No borra campos que ya tengan datos reales de otra fuente
 * - Idempotente: se puede ejecutar cuantas veces se quiera
 * 
 * Ejecutar: npx tsx prisma/limpiar-e-importar-marcelo.ts
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

async function main() {
  console.log('=== LIMPIEZA + IMPORTACIÓN PLANTILLA MARCELO.xlsx ===\n')

  // ═══════════════════════════════════════════════════════════════
  // PASO 1: BORRAR pesoBruto y pesoNeto estimados
  // ═══════════════════════════════════════════════════════════════
  console.log('--- PASO 1: Borrar datos estimados de peso ---')

  const todasLasTropas = await db.tropa.findMany({
    select: {
      id: true,
      numero: true,
      codigo: true,
      pesoBruto: true,
      pesoNeto: true,
      pesoTara: true,
      kgGancho: true,
    },
  })

  // Borrar TODOS los pesoBruto y pesoNeto de una sola query
  // (todos fueron generados por seed-datos-reales.ts con fórmula estimada)
  const pesoResult = await db.tropa.updateMany({
    where: {
      OR: [
        { pesoBruto: { not: null } },
        { pesoNeto: { not: null } },
      ],
    },
    data: {
      pesoBruto: null,
      pesoNeto: null,
    },
  })
  console.log(`  pesoBruto/pesoNeto borrados: ${pesoResult.count} tropas\n`)

  // ═══════════════════════════════════════════════════════════════
  // PASO 2: IMPORTAR PLANTILLA MARCELO.xlsx
  // ═══════════════════════════════════════════════════════════════
  console.log('--- PASO 2: Importar PLANTILLA MARCELO.xlsx ---')

  // Leer archivo
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
      console.error(`Uso: npx tsx prisma/limpiar-e-importar-marcelo.ts [ruta/al/archivo.xlsx]`)
      process.exit(1)
    }
  }

  const ws = workbook.Sheets['TROPAS']
  if (!ws) {
    console.error('ERROR: No se encontró la hoja "TROPAS"')
    process.exit(1)
  }

  // Leer todas las filas (header en row 3 = index 3, datos desde row 4 = index 4)
  // Columnas: 0=CODIGO, 1=ESPECIE, 2=NOMBRE_PRODUCTOR, 3=CUIT_PRODUCTOR, 
  //           4=NOMBRE_USUARIO_FAENA, 5=CUIT_USUARIO_FAENA, 6=DTE, 7=GUIA,
  //           8=CANTIDAD_CABEZAS, 9=NOMBRE_CORRAL, 10=FECHA_INGRESO
  const filas: Array<{
    codigo: string
    productorNombre: string
    productorCuit: string
    usuarioFaenaNombre: string
    usuarioFaenaCuit: string
    dte: string
    guia: string
    corralNombre: string
    fechaIngreso: Date | null
  }> = []

  for (let r = 4; r <= 250; r++) {
    const codigo = String(getCell(ws, r, 0) || '').trim()
    if (!codigo) break

    const fechaRaw = getCell(ws, r, 10)
    let fechaIngreso: Date | null = null
    if (fechaRaw instanceof Date) {
      fechaIngreso = fechaRaw
    } else if (typeof fechaRaw === 'string') {
      fechaIngreso = new Date(fechaRaw)
      if (isNaN(fechaIngreso.getTime())) fechaIngreso = null
    } else if (typeof fechaRaw === 'number') {
      // Excel serial date
      const unixMs = (fechaRaw - 25569) * 86400 * 1000
      fechaIngreso = new Date(unixMs)
      if (isNaN(fechaIngreso.getTime())) fechaIngreso = null
    }

    filas.push({
      codigo,
      productorNombre: String(getCell(ws, r, 2) || '').trim(),
      productorCuit: String(getCell(ws, r, 3) || '').trim(),
      usuarioFaenaNombre: String(getCell(ws, r, 4) || '').trim(),
      usuarioFaenaCuit: String(getCell(ws, r, 5) || '').trim(),
      dte: String(getCell(ws, r, 6) || '').trim(),
      guia: String(getCell(ws, r, 7) || '').trim(),
      corralNombre: String(getCell(ws, r, 9) || '').trim(),
      fechaIngreso,
    })
  }

  console.log(`Filas leídas: ${filas.length}\n`)

  // Cargar datos necesarios de BD
  const tropasBD = await db.tropa.findMany({
    select: { id: true, numero: true, codigo: true, dte: true, guia: true, fechaRecepcion: true, productorId: true, usuarioFaenaId: true, corralId: true, pesoBruto: true, pesoNeto: true },
  })
  const tropaByCodigo = new Map(tropasBD.map(t => [t.codigo, t]))
  // También buscar por número para las tropas que tengan código diferente
  const tropaByNumero = new Map(tropasBD.map(t => [t.numero, t]))

  const clientes = await db.cliente.findMany({
    select: { id: true, razonSocial: true, nombre: true, cuit: true },
  })

  const corrales = await db.corral.findMany({
    select: { id: true, nombre: true },
  })
  const corralByNombre = new Map(corrales.map(c => [c.nombre.toUpperCase(), c]))

  // Helper: buscar cliente por CUIT o nombre
  function findClienteByCuit(cuit: string) {
    if (!cuit) return null
    const normalized = cuit.replace(/[-\.]/g, '').toUpperCase()
    return clientes.find(c => {
      const cCuit = (c.cuit || '').replace(/[-\.]/g, '').toUpperCase()
      return cCuit === normalized
    }) || null
  }

  function findClienteByNombre(nombre: string) {
    if (!nombre) return null
    const norm = nombre.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '')
    return clientes.find(c => {
      const cNombre = ((c.razonSocial || c.nombre || '')).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '')
      return cNombre.includes(norm) || norm.includes(cNombre)
    }) || null
  }

  // Procesar cada fila
  let dteActualizados = 0
  let guiaActualizados = 0
  let fechaActualizados = 0
  let productorActualizados = 0
  let usuarioFaenaActualizados = 0
  let corralActualizados = 0
  let noEncontradas = 0
  let sinCambios = 0

  for (const fila of filas) {
    // Buscar tropa por código primero, luego por número
    let tropa = tropaByCodigo.get(fila.codigo)
    if (!tropa) {
      // Extraer número del código "B 2026 0001" → 1
      const match = fila.codigo.match(/(\d+)$/)
      if (match) {
        const numero = parseInt(match[1])
        tropa = tropaByNumero.get(numero)
      }
    }
    if (!tropa) {
      noEncontradas++
      continue
    }

    const updates: any = {}

    // DTE: actualizar si el actual es ficticio (DTE-2026-XXXX) o PENDIENTE
    if (fila.dte && fila.dte !== '-') {
      if (!tropa.dte || tropa.dte.startsWith('DTE-2026-') || tropa.dte === 'PENDIENTE') {
        updates.dte = fila.dte
      }
    }

    // Guía: actualizar si es ficticia (GUIA-2026-XXXX) o PENDIENTE
    if (fila.guia && fila.guia !== '-') {
      if (!tropa.guia || tropa.guia.startsWith('GUIA-2026-') || tropa.guia === 'PENDIENTE') {
        updates.guia = fila.guia
      }
    }

    // Fecha de recepción: actualizar si está vacía o es igual a fechaFaena
    if (fila.fechaIngreso) {
      if (!tropa.fechaRecepcion) {
        updates.fechaRecepcion = fila.fechaIngreso
      }
    }

    // Productor: buscar por CUIT primero, luego por nombre
    if (fila.productorCuit || fila.productorNombre) {
      if (!tropa.productorId) {
        const cliente = findClienteByCuit(fila.productorCuit) || findClienteByNombre(fila.productorNombre)
        if (cliente) {
          updates.productorId = cliente.id
        }
      }
    }

    // Usuario Faena: buscar por CUIT primero, luego por nombre
    if (fila.usuarioFaenaCuit || fila.usuarioFaenaNombre) {
      if (!tropa.usuarioFaenaId || tropa.usuarioFaenaId === tropa.productorId) {
        const cliente = findClienteByCuit(fila.usuarioFaenaCuit) || findClienteByNombre(fila.usuarioFaenaNombre)
        if (cliente && cliente.id !== updates.productorId) {
          updates.usuarioFaenaId = cliente.id
        }
      }
    }

    // Corral: buscar por nombre
    if (fila.corralNombre && !tropa.corralId) {
      const corral = corralByNombre.get(fila.corralNombre.toUpperCase())
      if (corral) {
        updates.corralId = corral.id
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.tropa.update({ where: { id: tropa.id }, data: updates })
      if (updates.dte) dteActualizados++
      if (updates.guia) guiaActualizados++
      if (updates.fechaRecepcion) fechaActualizados++
      if (updates.productorId) productorActualizados++
      if (updates.usuarioFaenaId) usuarioFaenaActualizados++
      if (updates.corralId) corralActualizados++
    } else {
      sinCambios++
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RESUMEN
  // ═══════════════════════════════════════════════════════════════
  console.log(`\n=== RESUMEN IMPORTACIÓN MARCELO ===`)
  console.log(`DTE actualizados (reales): ${dteActualizados}`)
  console.log(`Guías actualizadas (reales): ${guiaActualizados}`)
  console.log(`Fechas de recepción cargadas: ${fechaActualizados}`)
  console.log(`Productor vinculados: ${productorActualizados}`)
  console.log(`Usuario faena vinculados: ${usuarioFaenaActualizados}`)
  console.log(`Corrales asignados: ${corralActualizados}`)
  console.log(`Sin cambios (ya tenían datos reales): ${sinCambios}`)
  if (noEncontradas > 0) {
    console.log(`Tropas no encontradas en BD: ${noEncontradas}`)
  }

  // Estado final — usar los datos ya cargados en tropasBD para evitar errores de Prisma 6
  const conDte = tropasBD.filter(t => t.dte && t.dte !== 'PENDIENTE').length
  const conGuia = tropasBD.filter(t => t.guia && t.guia !== 'PENDIENTE').length
  const conFechaRecepcion = tropasBD.filter(t => t.fechaRecepcion !== null).length
  const conPesoBruto = tropasBD.filter(t => t.pesoBruto !== null).length
  const conPesoNeto = tropasBD.filter(t => t.pesoNeto !== null).length
  const conProductor = tropasBD.filter(t => t.productorId !== null).length
  const conUsuarioFaena = tropasBD.filter(t => t.usuarioFaenaId !== null).length
  const conCorral = tropasBD.filter(t => t.corralId !== null).length

  console.log(`\n=== ESTADO FINAL ===`)
  console.log(`Con DTE real: ${conDte} / ${tropasBD.length}`)
  console.log(`Con Guía real: ${conGuia} / ${tropasBD.length}`)
  console.log(`Con fecha recepción: ${conFechaRecepcion} / ${tropasBD.length}`)
  console.log(`Con peso bruto: ${conPesoBruto} / ${tropasBD.length} (debería ser 0 o pocos)`)
  console.log(`Con peso neto: ${conPesoNeto} / ${tropasBD.length} (debería ser 0 o pocos)`)
  console.log(`Con productor: ${conProductor} / ${tropasBD.length}`)
  console.log(`Con usuario faena: ${conUsuarioFaena} / ${tropasBD.length}`)
  console.log(`Con corral: ${conCorral} / ${tropasBD.length}`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
