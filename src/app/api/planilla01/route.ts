import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ExcelJS from 'exceljs'
import { checkPermission } from '@/lib/auth-helpers'

// Mapeo de tipos de animal
const TIPOS_ANIMAL: Record<string, string> = {
  'TO': 'TORO', 'VA': 'VACA', 'VQ': 'VAQUILLONA', 'MEJ': 'MEJORADOR',
  'NO': 'NOVILLO', 'NT': 'NOVILLITO', 'TQ': 'TERNERO', 'TN': 'TERNERA'
}

// ===== HELPERS DE ESTILO =====
const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF999999' } },
  bottom: { style: 'thin', color: { argb: 'FF999999' } },
  left: { style: 'thin', color: { argb: 'FF999999' } },
  right: { style: 'thin', color: { argb: 'FF999999' } }
}

function applyCell(cell: ExcelJS.Cell, opts: {
  font?: Partial<ExcelJS.Font>
  fill?: Partial<ExcelJS.Fill>
  border?: Partial<ExcelJS.Borders>
  alignment?: Partial<ExcelJS.Alignment>
  numFmt?: string
}) {
  if (opts.font) {
    cell.font = Object.assign(cell.font || {}, opts.font)
  }
  if (opts.fill) {
    cell.fill = Object.assign(cell.fill || {}, opts.fill)
  }
  if (opts.border) {
    cell.border = Object.assign(cell.border || {}, opts.border)
  }
  if (opts.alignment) {
    cell.alignment = Object.assign(cell.alignment || {}, opts.alignment)
  }
  if (opts.numFmt) cell.numFmt = opts.numFmt
}

// Helper para escribir una fila de datos con labels
function writeDataRow(ws: ExcelJS.Worksheet, r: number, data: Array<{ v: string | number | null; c: number; w: number; bold?: boolean; align?: string }>) {
  const row = ws.getRow(r)
  row.height = 18
  data.forEach(d => {
    if (d.w > 1) ws.mergeCells(r, d.c, r, d.c + d.w - 1)
    const cell = row.getCell(d.c)
    cell.value = d.v
    applyCell(cell, {
      font: { size: 9, bold: !!d.bold, color: { argb: 'FF333333' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } },
      border: thinBorder,
      alignment: {
        vertical: 'middle',
        horizontal: d.align as 'left' | 'center' | 'right' || (d.bold ? 'left' : 'left'),
        indent: d.bold ? 1 : 0
      }
    })
  })
}

export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeReportes')
  if (authError) return authError
  try {
    const body = await request.json()
    const { tropaId } = body

    if (!tropaId) {
      return NextResponse.json({ success: false, error: 'ID de tropa requerido' }, { status: 400 })
    }

    // Obtener datos de la tropa
    const tropa = await db.tropa.findUnique({
      where: { id: tropaId },
      include: {
        productor: true,
        usuarioFaena: true,
        corral: true,
        animales: {
          orderBy: { numero: 'asc' },
          include: { pesajeIndividual: true }
        },
        pesajeCamion: {
          include: { transportista: true }
        }
      }
    })

    if (!tropa) {
      return NextResponse.json({ success: false, error: 'Tropa no encontrada' }, { status: 404 })
    }

    // ===== CÁLCULOS =====
    const kgNetosCamion = tropa.pesajeCamion?.pesoNeto ?? null
    const kgNetosIndividuales = (tropa.animales || []).reduce((sum, a) => {
      return sum + (a.pesajeIndividual?.peso || a.pesoVivo || 0)
    }, 0)
    const diferenciaKg = kgNetosCamion !== null ? kgNetosCamion - kgNetosIndividuales : null
    const totalAnimales = (tropa.animales || []).length
    const animalesConPeso = (tropa.animales || []).filter(a => (a.pesajeIndividual?.peso || a.pesoVivo || 0) > 0).length
    const pesoPromedio = animalesConPeso > 0 ? kgNetosIndividuales / animalesConPeso : 0

    const getSemana = (fecha: Date) => {
      const d = new Date(fecha)
      const start = new Date(d.getFullYear(), 0, 1)
      return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
    }

    const semana = getSemana(tropa.fechaRecepcion)
    const año = new Date(tropa.fechaRecepcion).getFullYear()
    const fechaStr = new Date(tropa.fechaRecepcion).toLocaleDateString('es-AR')
    const codigoTropa = tropa.codigo?.replace(/\s/g, '_') || tropaId

    // ===== CREAR WORKBOOK =====
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Planilla 01')

    ws.pageSetup = {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.3, bottom: 0.3, header: 0, footer: 0 }
    }

    // Anchos de columna
    const colW = [5, 18, 22, 14, 18, 16, 8, 18, 16, 8, 18, 14, 14]
    colW.forEach((w, i) => { ws.getColumn(i + 1).width = w })

    let r = 1 // current row

    // ============================================================
    //  FILA 1: TÍTULO PRINCIPAL
    // ============================================================
    ws.mergeCells(r, 1, r, 13)
    const titleCell = ws.getRow(r).getCell(1)
    titleCell.value = 'PLANILLA 01 - REGISTRO DE INGRESO DE HACIENDA'
    applyCell(titleCell, {
      font: { bold: true, size: 16, color: { argb: 'FF000000' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    })
    ws.getRow(r).height = 30
    r += 1

    // ============================================================
    //  FILA 2: ESTABLECIMIENTO + DATOS
    // ============================================================
    ws.mergeCells(r, 1, r, 13)
    const estCell = ws.getRow(r).getCell(1)
    estCell.value = `ESTABLECIMIENTO: SOLEMAR ALIMENTARIA S.A.  |  N° SENASA: 3986  |  MATRÍCULA: 300  |  SEMANA N°: ${semana}  |  AÑO: ${año}  |  FECHA: ${fechaStr}`
    applyCell(estCell, {
      font: { bold: true, size: 9, color: { argb: 'FF333333' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } },
      border: thinBorder,
      alignment: { horizontal: 'left', vertical: 'middle', indent: 1 }
    })
    ws.getRow(r).height = 20
    r += 2

    // ============================================================
    //  SECCIÓN: DATOS PRODUCTOR
    // ============================================================
    ws.mergeCells(r, 1, r, 13)
    const secProd = ws.getRow(r).getCell(1)
    secProd.value = 'DATOS DEL PRODUCTOR / USUARIO FAENA'
    applyCell(secProd, {
      font: { bold: true, size: 10, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A4A4A' } },
      alignment: { vertical: 'middle', indent: 1 }
    })
    ws.getRow(r).height = 20
    r += 1

    // Fila productor
    writeDataRow(ws, r, [
      { v: 'Productor:', c: 1, w: 2, bold: true },
      { v: tropa.productor?.nombre || '-', c: 3, w: 4 },
      { v: 'CUIT:', c: 7, w: 1, bold: true },
      { v: tropa.productor?.cuit || '-', c: 8, w: 2 },
      { v: 'Tropa N°:', c: 10, w: 1, bold: true },
      { v: tropa.numero?.toString() || tropa.codigo || '-', c: 11, w: 1 },
      { v: 'Cabezas:', c: 12, w: 1, bold: true },
      { v: String(tropa.cantidadCabezas), c: 13, w: 1 },
    ])
    r += 1

    // Fila usuario faena
    writeDataRow(ws, r, [
      { v: 'Usuario Faena:', c: 1, w: 2, bold: true },
      { v: tropa.usuarioFaena?.nombre || '-', c: 3, w: 4 },
      { v: 'CUIT:', c: 7, w: 1, bold: true },
      { v: tropa.usuarioFaena?.cuit || '-', c: 8, w: 2 },
      { v: 'N° Reg.:', c: 10, w: 1, bold: true },
      { v: tropa.numero?.toString() || tropa.codigo || '-', c: 11, w: 1 },
      { v: 'Corral:', c: 12, w: 1, bold: true },
      { v: tropa.corral?.nombre || '-', c: 13, w: 1 },
    ])
    r += 2

    // ============================================================
    //  SECCIÓN: DATOS DEL TRANSPORTE
    // ============================================================
    ws.mergeCells(r, 1, r, 13)
    const secTransp = ws.getRow(r).getCell(1)
    secTransp.value = 'DATOS DEL TRANSPORTE'
    applyCell(secTransp, {
      font: { bold: true, size: 10, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A4A4A' } },
      alignment: { vertical: 'middle', indent: 1 }
    })
    ws.getRow(r).height = 20
    r += 1

    // Fila transportista
    writeDataRow(ws, r, [
      { v: 'Transportista:', c: 1, w: 2, bold: true },
      { v: tropa.pesajeCamion?.transportista?.nombre || '-', c: 3, w: 3 },
      { v: 'Chofer:', c: 7, w: 1, bold: true },
      { v: tropa.pesajeCamion?.choferNombre || '-', c: 8, w: 2 },
      { v: 'DNI:', c: 10, w: 1, bold: true },
      { v: tropa.pesajeCamion?.choferDni || '-', c: 11, w: 2 },
    ])
    r += 1

    // Fila patentes
    writeDataRow(ws, r, [
      { v: 'Patente Chasis:', c: 1, w: 2, bold: true },
      { v: tropa.pesajeCamion?.patenteChasis || '-', c: 3, w: 2 },
      { v: 'Acoplado:', c: 6, w: 1, bold: true },
      { v: tropa.pesajeCamion?.patenteAcoplado || '-', c: 7, w: 2 },
      { v: 'Precintos:', c: 9, w: 2, bold: true },
      { v: tropa.pesajeCamion?.precintos || '-', c: 11, w: 2 },
    ])
    r += 2

    // ============================================================
    //  SECCIÓN: DOCUMENTACIÓN
    // ============================================================
    ws.mergeCells(r, 1, r, 13)
    const secDoc = ws.getRow(r).getCell(1)
    secDoc.value = 'DOCUMENTACIÓN'
    applyCell(secDoc, {
      font: { bold: true, size: 10, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A4A4A' } },
      alignment: { vertical: 'middle', indent: 1 }
    })
    ws.getRow(r).height = 20
    r += 1

    writeDataRow(ws, r, [
      { v: 'Guía:', c: 1, w: 1, bold: true },
      { v: tropa.guia || '-', c: 2, w: 3 },
      { v: 'DTE:', c: 6, w: 1, bold: true },
      { v: tropa.dte || '-', c: 7, w: 2 },
      { v: 'N° Pesada:', c: 10, w: 1, bold: true },
      { v: String(tropa.pesajeCamion?.numeroTicket || '-'), c: 11, w: 2 },
    ])
    r += 2

    // ============================================================
    //  SECCIÓN: DETALLE DE ANIMALES
    // ============================================================
    ws.mergeCells(r, 1, r, 13)
    const secAnim = ws.getRow(r).getCell(1)
    secAnim.value = 'DETALLE DE ANIMALES'
    applyCell(secAnim, {
      font: { bold: true, size: 10, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A4A4A' } },
      alignment: { vertical: 'middle', indent: 1 }
    })
    ws.getRow(r).height = 20
    r += 1

    // Header de tabla de animales
    const aHeaderRow = ws.getRow(r)
    aHeaderRow.height = 20
    const aHeaders = [
      { v: 'N°', c: 1 },
      { v: 'CARAVANA', c: 2 },
      { v: 'TIPO', c: 3 },
      { v: 'RAZA', c: 4 },
      { v: 'PESO (kg)', c: 5 },
      { v: 'CORRAL', c: 6 },
      { v: 'OBSERVACIONES', c: 7 },
    ]
    aHeaders.forEach(h => {
      const cell = aHeaderRow.getCell(h.c)
      cell.value = h.v
      applyCell(cell, {
        font: { bold: true, size: 9, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A4A4A' } },
        border: thinBorder,
        alignment: { horizontal: 'center', vertical: 'middle' }
      })
    })
    r += 1

    // Datos de animales (filas intercaladas: blanco/gris claro)
    const animalRows = (tropa.animales || []).map((a, idx) => [
      idx + 1,
      a.caravana || '-',
      TIPOS_ANIMAL[a.tipoAnimal || ''] || a.tipoAnimal || '-',
      a.raza || '-',
      a.pesajeIndividual?.peso || a.pesoVivo || null,
      tropa.corral?.nombre || '-',
      ''
    ])

    animalRows.forEach((rowData, idx) => {
      const row = ws.getRow(r)
      row.height = 16
      const isEven = idx % 2 === 0
      const bgColor = isEven ? 'FFFFFFFF' : 'FFF9F9F9'

      rowData.forEach((val, colIdx) => {
        const cell = row.getCell(colIdx + 1)
        cell.value = val
        applyCell(cell, {
          font: { size: 9, color: { argb: 'FF333333' } },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } },
          border: thinBorder,
          alignment: colIdx === 0 ? { horizontal: 'center', vertical: 'middle' }
            : colIdx === 4 ? { horizontal: 'right', vertical: 'middle' }
            : { horizontal: 'left', vertical: 'middle', indent: 1 }
        })
        if (colIdx === 4 && val !== null) cell.numFmt = '#,##0.0'
      })
      r += 1
    })

    // ============================================================
    //  TOTALES DE ANIMALES
    // ============================================================
    const totalARow = ws.getRow(r)
    totalARow.height = 18
    ws.mergeCells(r, 1, r, 7)
    const totalLabel = totalARow.getCell(1)
    totalLabel.value = `TOTALES:  Cabezas: ${totalAnimales}  |  Suma Pesos Indiv.: ${kgNetosIndividuales.toFixed(1)} kg  |  Peso Promedio: ${pesoPromedio.toFixed(1)} kg`
    applyCell(totalLabel, {
      font: { bold: true, size: 9, color: { argb: 'FF000000' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } },
      border: thinBorder,
      alignment: { vertical: 'middle', indent: 1 }
    })
    r += 2

    // ============================================================
    //  SECCIÓN: COMPARATIVO DE PESAJE
    // ============================================================
    ws.mergeCells(r, 1, r, 13)
    const secPesaje = ws.getRow(r).getCell(1)
    secPesaje.value = 'COMPARATIVO DE PESAJE'
    applyCell(secPesaje, {
      font: { bold: true, size: 10, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A4A4A' } },
      alignment: { vertical: 'middle', indent: 1 }
    })
    ws.getRow(r).height = 20
    r += 1

    // N° Pesada camión
    writeDataRow(ws, r, [
      { v: 'N° PESADA CAMIÓN:', c: 1, w: 3, bold: true },
      { v: String(tropa.pesajeCamion?.numeroTicket || '-'), c: 4, w: 2 },
    ])
    r += 1

    // ============================================================
    //  4 CUADROS COMPARATIVOS - 2 FILAS (encabezado + valor)
    // ============================================================

    // --- FILA DE ENCABEZADOS ---
    const boxHeaders = [
      { v: 'KG NETOS CAMIÓN', c: 1, w: 3 },
      { v: 'KG NETOS INDIVIDUALES', c: 4, w: 3 },
      { v: 'DIFERENCIA (kg)', c: 7, w: 3 },
      { v: 'PROMEDIO KG NETOS', c: 10, w: 3 },
    ]

    const headerRow = ws.getRow(r)
    headerRow.height = 16
    boxHeaders.forEach(bh => {
      ws.mergeCells(r, bh.c, r, bh.c + bh.w - 1)
      const cell = headerRow.getCell(bh.c)
      cell.value = bh.v
      applyCell(cell, {
        font: { bold: true, size: 8, color: { argb: 'FF333333' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } },
        border: { top: { style: 'medium', color: { argb: 'FF555555' } }, left: { style: 'medium', color: { argb: 'FF555555' } }, right: { style: 'medium', color: { argb: 'FF555555' } }, bottom: { style: 'thin', color: { argb: 'FF555555' } } },
        alignment: { horizontal: 'center', vertical: 'middle' }
      })
    })
    r += 1

    // --- FILA DE VALORES ---
    const boxVals = [
      { v: kgNetosCamion !== null ? kgNetosCamion : 'Sin datos', c: 1, w: 3, fmt: '#,##0.0', bg: 'FFF2F2F2' },
      { v: kgNetosIndividuales, c: 4, w: 3, fmt: '#,##0.0', bg: 'FFF2F2F2' },
      { v: diferenciaKg !== null ? ((diferenciaKg >= 0 ? '+' : '') + diferenciaKg.toFixed(1) + ' kg') : 'Sin datos', c: 7, w: 3, fmt: undefined, bg: 'FFF2F2F2' },
      { v: pesoPromedio, c: 10, w: 3, fmt: '#,##0.0', bg: 'FFF2F2F2' },
    ]

    const valRow = ws.getRow(r)
    valRow.height = 24
    boxVals.forEach(bv => {
      ws.mergeCells(r, bv.c, r, bv.c + bv.w - 1)
      const cell = valRow.getCell(bv.c)
      cell.value = bv.v
      applyCell(cell, {
        font: { bold: true, size: 14, color: { argb: 'FF333333' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bv.bg } },
        border: { top: { style: 'thin', color: { argb: 'FF555555' } }, left: { style: 'medium', color: { argb: 'FF555555' } }, right: { style: 'medium', color: { argb: 'FF555555' } }, bottom: { style: 'medium', color: { argb: 'FF555555' } } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        numFmt: bv.fmt
      })
    })
    r += 2

    // ============================================================
    //  DETALLES ADICIONALES DE PESAJE
    // ============================================================
    const detailRow = ws.getRow(r)
    detailRow.height = 18
    const details = [
      { label: 'Peso Bruto:', value: tropa.pesajeCamion?.pesoBruto ? tropa.pesajeCamion.pesoBruto.toFixed(1) + ' kg' : '-', c: 1 },
      { label: 'Peso Tara:', value: tropa.pesajeCamion?.pesoTara ? tropa.pesajeCamion.pesoTara.toFixed(1) + ' kg' : '-', c: 4 },
      { label: 'Cabezas con peso:', value: String(animalesConPeso), c: 7 },
      { label: 'Cabezas sin peso:', value: String(totalAnimales - animalesConPeso), c: 10 },
    ]
    details.forEach(d => {
      const labelCell = detailRow.getCell(d.c)
      ws.mergeCells(r, d.c, r, d.c + 1)
      labelCell.value = d.label
      applyCell(labelCell, {
        font: { bold: true, size: 8, color: { argb: 'FF4A4A4A' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F8F8' } },
        border: thinBorder,
        alignment: { vertical: 'middle', indent: 1 }
      })
      const valCell = detailRow.getCell(d.c + 2)
      ws.mergeCells(r, d.c + 2, r, d.c + 2)
      valCell.value = d.value
      applyCell(valCell, {
        font: { size: 9, color: { argb: 'FF333333' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F8F8' } },
        border: thinBorder,
        alignment: { vertical: 'middle' }
      })
    })
    r += 2

    // ============================================================
    //  OBSERVACIONES
    // ============================================================
    ws.mergeCells(r, 1, r, 13)
    const secObs = ws.getRow(r).getCell(1)
    secObs.value = 'OBSERVACIONES'
    applyCell(secObs, {
      font: { bold: true, size: 9, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A4A4A' } },
      alignment: { vertical: 'middle', indent: 1 }
    })
    ws.getRow(r).height = 18
    r += 1

    ws.mergeCells(r, 1, r + 2, 13)
    const obsCell = ws.getRow(r).getCell(1)
    obsCell.value = tropa.observaciones || ''
    applyCell(obsCell, {
      font: { size: 9, color: { argb: 'FF333333' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } },
      border: thinBorder,
      alignment: { vertical: 'top', wrapText: true, indent: 1 }
    })
    r += 4

    // ============================================================
    //  FIRMAS
    // ============================================================
    const firmaRow = ws.getRow(r)
    firmaRow.height = 30
    const firmas = [
      { label: 'FIRMA RESPONSABLE INGRESO', c: 2, w: 3 },
      { label: 'FIRMA TRANSPORTISTA', c: 7, w: 3 },
      { label: 'SUPERVISOR', c: 11, w: 2 },
    ]
    firmas.forEach(f => {
      ws.mergeCells(r, f.c, r, f.c + f.w - 1)
      const cell = firmaRow.getCell(f.c)
      cell.value = f.label
      applyCell(cell, {
        font: { bold: true, size: 8, color: { argb: 'FF999999' } },
        border: { top: { style: 'thin', color: { argb: 'FFCCCCCC' } }, bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } }, left: { style: 'thin', color: { argb: 'FFCCCCCC' } }, right: { style: 'thin', color: { argb: 'FFCCCCCC' } } },
        alignment: { horizontal: 'center', vertical: 'bottom' }
      })
    })

    // ===== GENERAR BUFFER =====
    const buffer = await wb.xlsx.writeBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Planilla01_${codigoTropa}.xlsx"`
      }
    })

  } catch (error) {
    console.error('Error generando planilla:', error)
    return NextResponse.json(
      { success: false, error: 'Error al generar la planilla' },
      { status: 500 }
    )
  }
}
