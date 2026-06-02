import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ExcelJS from 'exceljs'
import { checkPermission } from '@/lib/auth-helpers'
import reporteConfig from '@/config/reporte-rinde-tropa.json'

// Config values used by module-level helpers
const fnt = reporteConfig.excel.fuentes

// ===== HELPERS DE ESTILO =====
const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } }
}
const doubleBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'double', color: { argb: 'FF000000' } },
  bottom: { style: 'double', color: { argb: 'FF000000' } },
  left: { style: 'double', color: { argb: 'FF000000' } },
  right: { style: 'double', color: { argb: 'FF000000' } }
}

function applyCell(cell: ExcelJS.Cell, opts: {
  font?: Partial<ExcelJS.Font>
  fill?: Partial<ExcelJS.Fill>
  border?: Partial<ExcelJS.Borders>
  alignment?: Partial<ExcelJS.Alignment>
  numFmt?: string
}) {
  if (opts.font) cell.font = Object.assign(cell.font || {}, opts.font)
  if (opts.fill) cell.fill = Object.assign(cell.fill || {}, opts.fill)
  if (opts.border) cell.border = Object.assign(cell.border || {}, opts.border)
  if (opts.alignment) cell.alignment = Object.assign(cell.alignment || {}, opts.alignment)
  if (opts.numFmt) cell.numFmt = opts.numFmt
}

function writeLabel(cell: ExcelJS.Cell, label: string, opts?: { bold?: boolean; size?: number; align?: string }) {
  cell.value = label
  applyCell(cell, {
    font: { name: fnt.familia, size: opts?.size || fnt.tamanoInfo, bold: opts?.bold !== false },
    alignment: { horizontal: (opts?.align || 'right') as 'left' | 'right' | 'center', vertical: 'middle' }
  })
}

function writeValue(cell: ExcelJS.Cell, value: string | number | null, opts?: { bold?: boolean; size?: number; align?: string; numFmt?: string }) {
  cell.value = value ?? ''
  applyCell(cell, {
    font: { name: fnt.familia, size: opts?.size || fnt.tamanoInfo, bold: !!opts?.bold },
    alignment: { horizontal: (opts?.align || 'left') as 'left' | 'right' | 'center', vertical: 'middle' }
  })
  if (opts?.numFmt) cell.numFmt = opts.numFmt
}

// POST - Generar Excel Rinde por Tropa (formato modelo)
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeReportes')
  if (authError) return authError

  try {
    const body = await request.json()
    const { tropaId } = body

    if (!tropaId) {
      return NextResponse.json({ success: false, error: 'ID de tropa requerido' }, { status: 400 })
    }

    // Obtener tropa con datos relacionados
    const tropa = await db.tropa.findUnique({
      where: { id: tropaId },
      include: {
        productor: true,
        usuarioFaena: true,
        animales: { orderBy: { numero: 'asc' } }
      }
    })

    if (!tropa) {
      return NextResponse.json({ success: false, error: 'Tropa no encontrada' }, { status: 404 })
    }

    // Romaneos confirmados de esta tropa
    const romaneos = await db.romaneo.findMany({
      where: { tropaCodigo: tropa.codigo, estado: 'CONFIRMADO' },
      include: { tipificador: true },
      orderBy: { garron: 'asc' }
    })

    // Lista de faena (para fecha faena)
    const listaFaenaTropa = await db.listaFaenaTropa.findFirst({
      where: { tropaId: tropa.id },
      include: { listaFaena: true },
      orderBy: { createdAt: 'desc' }
    })

    // Menudencias de esta tropa
    const menudencias = await db.menudencia.findMany({
      where: { tropaCodigo: tropa.codigo },
      include: { tipoMenudencia: true },
      orderBy: { tipoMenudencia: { nombre: 'asc' } }
    })

    // Mapear animales por numero para obtener caravana
    const animalMap = new Map(tropa.animales.map(a => [a.numero, a]))

    // Fecha faena: de lista de faena o del primer romaneo
    const fechaFaena = listaFaenaTropa?.listaFaena?.fecha
      || (romaneos.length > 0 ? romaneos[0].fecha : tropa.fechaFaena)

    // ===== CÁLCULOS =====
    const pesoVivoTotal = romaneos.reduce((s, r) => s + (r.pesoVivo || 0), 0)
    const pesoMedioTotal = romaneos.reduce((s, r) => s + (r.pesoTotal || 0), 0)
    const rindeGeneral = pesoVivoTotal > 0 ? pesoMedioTotal / pesoVivoTotal : 0
    const promedio = romaneos.length > 0 ? pesoMedioTotal / romaneos.length : 0

    // Resumen por tipo
    const tipoResumen: Record<string, { cantidad: number; kg: number; cuartos: number }> = {}
    for (const r of romaneos) {
      const tipo = r.tipoAnimal || 'SIN_TIPO'
      if (!tipoResumen[tipo]) tipoResumen[tipo] = { cantidad: 0, kg: 0, cuartos: 0 }
      tipoResumen[tipo].cantidad++
      tipoResumen[tipo].kg += r.pesoTotal || 0
      tipoResumen[tipo].cuartos += 2 // cada animal = 2 medios = 2 cuartos
    }

    // ===== CREAR WORKBOOK =====
    const cfg = reporteConfig.excel
    const fmt = cfg.formatosNumericos
    const alAnim = (cfg as any).alineacionAnimales || {}
    const alMen = (cfg as any).alineacionMenudencia || {}
    const alRes = (cfg as any).alineacionResumen || {}
    const bordes = (cfg as any).bordes || {}
    const separadores = (cfg as any).separadores || {}
    const logoCfg = (cfg as any).logo || { visible: false, posicion: 'arriba-izquierda', ancho: 100, alto: 50 }

    // Helper for alignment from config
    function alin(alignMap: Record<string, string>, colKey: string, fallback: string): 'left' | 'center' | 'right' {
      return (alignMap[colKey] || fallback) as 'left' | 'center' | 'right'
    }

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(`TROPA ${tropa.numero}`)

    ws.pageSetup = {
      paperSize: 9,
      orientation: cfg.pagina.orientacion as 'landscape' | 'portrait',
      fitToPage: cfg.pagina.ajustarAncho as boolean,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: cfg.margenes.izquierdo,
        right: cfg.margenes.derecho,
        top: cfg.margenes.superior,
        bottom: cfg.margenes.inferior,
        header: 0, footer: 0
      }
    }

    // Anchos de columna desde config
    const ac = cfg.anchoColumnas
    const colW = [ac.A, ac.B, ac.C_garron, ac.D_animal, ac.E_raza, ac.F_G_clasif, ac.F_G_clasif, ac.H_caravana, ac.I_kgEntrada, ac.J_mediaA, ac.K_mediaB, ac.L_totalKg, ac.M_rinde, ac.N]
    colW.forEach((w, i) => { ws.getColumn(i + 1).width = w })

    let r = 1

    // ============================================================
    //  LOGO
    // ============================================================
    if (logoCfg.visible) {
      try {
        const fs = await import('fs')
        const path = await import('path')
        const logoPath = path.join(process.cwd(), 'public', 'logo.png')
        if (fs.existsSync(logoPath)) {
          const imgData = fs.readFileSync(logoPath)
          const imgId = wb.addImage({ buffer: imgData as any, extension: 'png' })
          const imgCol = logoCfg.posicion === 'arriba-izquierda' ? 1 : logoCfg.posicion === 'arriba-derecha' ? 10 : 5
          ws.addImage(imgId, {
            tl: { col: imgCol - 1, row: 0 },
            ext: { width: logoCfg.ancho, height: logoCfg.alto }
          })
        }
      } catch { /* logo not found, skip */ }
      r = 3
    }

    // ============================================================
    //  FILA 3: ESTABLECIMIENTO
    // ============================================================
    r = 3
    ws.mergeCells(3, 7, 3, 10)
    ws.getCell('G3').value = 'Estab. Faenador: Solemar Alimentaria S.A.'
    applyCell(ws.getCell('G3'), {
      font: { name: fnt.familia, size: fnt.tamanoInfo },
      alignment: { vertical: 'middle' }
    })

    // RINDE box (K3)
    const rindeLabelCell = ws.getCell('K3')
    rindeLabelCell.value = 'RINDE'
    applyCell(rindeLabelCell, {
      font: { name: fnt.familia, size: fnt.tamanoInfo, bold: true },
      border: doubleBorder,
      alignment: { horizontal: 'center', vertical: 'middle' }
    })

    // RINDE valor (L3)
    const rindeValCell = ws.getCell('L3')
    rindeValCell.value = rindeGeneral
    rindeValCell.numFmt = fmt.porcentaje
    applyCell(rindeValCell, {
      font: { name: fnt.familia, size: fnt.tamanoInfo, bold: true },
      border: doubleBorder,
      alignment: { horizontal: 'center', vertical: 'middle' },
      numFmt: fmt.porcentaje
    })

    // ============================================================
    //  FILA 4: MATRICULA
    // ============================================================
    ws.getCell('G4').value = 'Matricula: 300'
    applyCell(ws.getCell('G4'), { font: { name: fnt.familia, size: fnt.tamanoInfo } })

    // PROM. box (K4)
    const promLabelCell = ws.getCell('K4')
    promLabelCell.value = 'PROM.'
    applyCell(promLabelCell, {
      font: { name: fnt.familia, size: fnt.tamanoInfo, bold: true },
      border: doubleBorder,
      alignment: { horizontal: 'center', vertical: 'middle' }
    })

    // PROM. valor (L4)
    const promValCell = ws.getCell('L4')
    promValCell.value = promedio
    promValCell.numFmt = fmt.kgDecimal
    applyCell(promValCell, {
      font: { name: fnt.familia, size: fnt.tamanoInfo, bold: true },
      border: doubleBorder,
      alignment: { horizontal: 'center', vertical: 'middle' },
      numFmt: fmt.kgDecimal
    })

    // ============================================================
    //  FILA 5: SENASA
    // ============================================================
    ws.getCell('G5').value = 'N\u00ba SENASA: 3986'
    applyCell(ws.getCell('G5'), { font: { name: fnt.familia, size: fnt.tamanoInfo } })

    // ============================================================
    //  SEPARADOR DESPUES DE ENCABEZADO
    // ============================================================
    if (separadores.despuesEncabezado === 'simple') {
      for (let c = 3; c <= 13; c++) {
        applyCell(ws.getCell(`${String.fromCharCode(64 + c)}6`), { border: { bottom: { style: 'thin', color: { argb: 'FF000000' } } } })
      }
    } else if (separadores.despuesEncabezado === 'doble') {
      for (let c = 3; c <= 13; c++) {
        applyCell(ws.getCell(`${String.fromCharCode(64 + c)}6`), { border: { bottom: { style: 'double', color: { argb: 'FF000000' } } } })
      }
    }

    // ============================================================
    //  FILA 8: USUARIO/MATARIFE Y PRODUCTOR
    // ============================================================
    r = 8

    // Usuario/Matarife
    ws.mergeCells(8, 3, 8, 4)
    ws.getCell('C8').value = 'Usuario/Matarife: '
    applyCell(ws.getCell('C8'), {
      font: { name: fnt.familia, size: fnt.tamanoInfo },
      alignment: { horizontal: 'right', vertical: 'middle' }
    })

    ws.mergeCells(8, 5, 8, 8)
    ws.getCell('E8').value = tropa.usuarioFaena?.nombre || '-'
    applyCell(ws.getCell('E8'), {
      font: { name: fnt.familia, size: fnt.tamanoInfo, bold: true },
      alignment: { horizontal: 'left', vertical: 'middle' },
      border: { right: { style: 'double', color: { argb: 'FF000000' } } }
    })

    // Productor
    ws.getCell('I8').value = 'Productor:'
    applyCell(ws.getCell('I8'), {
      font: { name: fnt.familia, size: fnt.tamanoInfo },
      alignment: { horizontal: 'right', vertical: 'middle' },
      border: { left: { style: 'double', color: { argb: 'FF000000' } } }
    })

    ws.mergeCells(8, 10, 8, 13)
    ws.getCell('J8').value = tropa.productor?.nombre || '-'
    applyCell(ws.getCell('J8'), {
      font: { name: fnt.familia, size: fnt.tamanoInfo, bold: true },
      alignment: { horizontal: 'center', vertical: 'middle' }
    })

    // ============================================================
    //  FILA 9: MATRICULA MATARIFE + DTE + GUIA
    // ============================================================
    r = 9
    ws.mergeCells(9, 3, 9, 4)
    ws.getCell('C9').value = 'Matricula: '
    applyCell(ws.getCell('C9'), {
      font: { name: fnt.familia, size: fnt.tamanoInfo },
      alignment: { horizontal: 'right', vertical: 'middle' }
    })
    ws.mergeCells(9, 5, 9, 8)
    ws.getCell('E9').value = tropa.usuarioFaena?.matricula || tropa.usuarioFaena?.cuit || '-'
    applyCell(ws.getCell('E9'), {
      font: { name: fnt.familia, size: fnt.tamanoInfo },
      alignment: { horizontal: 'left', vertical: 'middle' }
    })

    ws.getCell('I9').value = 'N\u00ba DTE:'
    applyCell(ws.getCell('I9'), {
      font: { name: fnt.familia, size: fnt.tamanoInfo },
      alignment: { horizontal: 'right', vertical: 'middle' }
    })
    ws.getCell('J9').value = tropa.dte || '-'
    applyCell(ws.getCell('J9'), {
      font: { name: fnt.familia, size: fnt.tamanoInfo },
      alignment: { horizontal: 'left', vertical: 'middle' }
    })

    ws.getCell('K9').value = 'N\u00ba Guia:'
    applyCell(ws.getCell('K9'), {
      font: { name: fnt.familia, size: fnt.tamanoInfo },
      alignment: { horizontal: 'right', vertical: 'middle' }
    })
    ws.mergeCells(9, 12, 9, 13)
    ws.getCell('L9').value = tropa.guia || '-'
    applyCell(ws.getCell('L9'), {
      font: { name: fnt.familia, size: fnt.tamanoInfo },
      alignment: { horizontal: 'left', vertical: 'middle' }
    })

    // ============================================================
    //  FILA 10: FECHA Y HORA
    // ============================================================
    r = 10
    ws.getCell('I10').value = 'Fecha Ing.:'
    applyCell(ws.getCell('I10'), {
      font: { name: fnt.familia, size: fnt.tamanoInfo },
      alignment: { horizontal: 'right', vertical: 'middle' }
    })
    ws.getCell('J10').value = tropa.fechaRecepcion ? new Date(tropa.fechaRecepcion) : null
    applyCell(ws.getCell('J10'), {
      font: { name: fnt.familia, size: fnt.tamanoInfo },
      alignment: { horizontal: 'left', vertical: 'middle' },
      numFmt: fmt.fecha
    })

    ws.getCell('K10').value = 'Hora:'
    applyCell(ws.getCell('K10'), {
      font: { name: fnt.familia, size: fnt.tamanoInfo },
      alignment: { horizontal: 'right', vertical: 'middle' }
    })
    ws.mergeCells(10, 12, 10, 13)
    ws.getCell('L10').value = tropa.fechaRecepcion ? new Date(tropa.fechaRecepcion) : null
    applyCell(ws.getCell('L10'), {
      font: { name: fnt.familia, size: fnt.tamanoInfo },
      alignment: { horizontal: 'left', vertical: 'middle' },
      numFmt: fmt.hora
    })

    // ============================================================
    //  SEPARADOR DESPUES DE INFO OPERADOR
    // ============================================================
    if (separadores.despuesInfoOperador === 'simple') {
      for (let c = 3; c <= 13; c++) {
        applyCell(ws.getCell(`${String.fromCharCode(64 + c)}12`), { border: { bottom: { style: 'thin', color: { argb: 'FF000000' } } } })
      }
    } else if (separadores.despuesInfoOperador === 'doble') {
      for (let c = 3; c <= 13; c++) {
        applyCell(ws.getCell(`${String.fromCharCode(64 + c)}12`), { border: { bottom: { style: 'double', color: { argb: 'FF000000' } } } })
      }
    }

    // ============================================================
    //  FILA 14: FECHA FAENA + HEADER CUARTOS/KG
    // ============================================================
    r = 14
    ws.getCell('D14').value = 'Fecha Faena:'
    applyCell(ws.getCell('D14'), {
      font: { name: fnt.familia, size: fnt.tamanoInfo },
      alignment: { horizontal: alin(alRes, 'labels', 'right'), vertical: 'middle' }
    })
    const fechaCell = ws.getCell('E14')
    fechaCell.value = fechaFaena ? new Date(fechaFaena) : null
    applyCell(fechaCell, {
      font: { name: fnt.familia, size: fnt.tamanoInfo, bold: true, color: { argb: 'FFFF0000' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      numFmt: fmt.fecha
    })

    ws.getCell('K14').value = 'Cuartos'
    applyCell(ws.getCell('K14'), {
      font: { name: fnt.familia, size: fnt.tamanoInfo },
      alignment: { horizontal: alin(alRes, 'cuartos', 'center'), vertical: 'middle' }
    })
    ws.getCell('L14').value = 'Kg'
    applyCell(ws.getCell('L14'), {
      font: { name: fnt.familia, size: fnt.tamanoInfo },
      alignment: { horizontal: alin(alRes, 'kgTipos', 'right'), vertical: 'middle' }
    })

    // ============================================================
    //  FILAS 15-20: N TROPA + RESUMEN + RESUMEN POR TIPO
    // ============================================================
    const resumenData = [
      { label: 'N\u00ba Tropa:', col: 3, valueCol: 5, value: tropa.numero },
      { label: 'Cantidad Cabeza:', col: 3, valueCol: 5, value: tropa.cantidadCabezas },
      { label: 'Kg Vivo entrada:', col: 3, valueCol: 5, value: Math.round(pesoVivoTotal) },
      { label: 'Kg 1/2 Res', col: 3, valueCol: 5, value: Math.round(pesoMedioTotal) },
      { label: 'Rinde:', col: 3, valueCol: 5, value: rindeGeneral },
      { label: 'Promedio:', col: 3, valueCol: 5, value: promedio },
    ]

    // Tipos a mostrar en columnas J-L
    const tiposOrden = ['VQ', 'NT', 'NO', 'TO', 'VA', 'MEJ']

    for (let i = 0; i < 6; i++) {
      const row = 15 + i
      const rd = resumenData[i]

      // Label
      ws.mergeCells(row, rd.col, row, rd.col + 1)
      ws.getCell(`${String.fromCharCode(64 + rd.col)}${row}`).value = rd.label
      applyCell(ws.getCell(`${String.fromCharCode(64 + rd.col)}${row}`), {
        font: { name: fnt.familia, size: fnt.tamanoInfo },
        alignment: { horizontal: alin(alRes, 'labels', 'right'), vertical: 'middle' }
      })

      // Value
      ws.mergeCells(row, rd.valueCol, row, rd.valueCol + 3)
      const valCell = ws.getCell(`${String.fromCharCode(64 + rd.valueCol)}${row}`)
      valCell.value = rd.value
      const numFmt = (i === 4) ? fmt.porcentaje : (i === 5) ? fmt.kgDecimal : fmt.kgEntero
      applyCell(valCell, {
        font: { name: fnt.familia, size: fnt.tamanoInfo, bold: true },
        alignment: { horizontal: alin(alRes, 'values', 'left'), vertical: 'middle' },
        numFmt
      })

      // Tipo animal en columna J
      if (i < tiposOrden.length) {
        const tipo = tiposOrden[i]
        ws.getCell(`J${row}`).value = tipo
        applyCell(ws.getCell(`J${row}`), {
          font: { name: fnt.familia, size: fnt.tamanoInfo },
          alignment: { horizontal: alin(alRes, 'tipos', 'left'), vertical: 'middle' }
        })

        const tr = tipoResumen[tipo]
        ws.getCell(`K${row}`).value = tr ? tr.cuartos : 0
        applyCell(ws.getCell(`K${row}`), {
          font: { name: fnt.familia, size: fnt.tamanoInfo },
          alignment: { horizontal: alin(alRes, 'cuartos', 'center'), vertical: 'middle' }
        })

        ws.getCell(`L${row}`).value = tr ? Math.round(tr.kg) : 0
        applyCell(ws.getCell(`L${row}`), {
          font: { name: fnt.familia, size: fnt.tamanoInfo },
          alignment: { horizontal: alin(alRes, 'kgTipos', 'right'), vertical: 'middle' },
          numFmt: fmt.kgEntero
        })
      }
    }

    // ============================================================
    //  FILA 23: ENCABEZADO TABLA ANIMALES
    // ============================================================
    r = 23
    const headerLabels = [
      { col: 3, text: 'N\u00ba\nGARRON', span: true },
      { col: 4, text: 'N\u00ba\n ANIMAL', span: true },
      { col: 5, text: 'RAZA', span: true },
      { col: 6, text: 'CLASIFICACION', span: true },
      { col: 8, text: 'N\u00ba CARAVANA', span: true },
      { col: 9, text: 'KG ENTRADA', span: true },
      { col: 10, text: 'KG 1/2 A', span: true },
      { col: 11, text: 'KG 1/2 B', span: true },
      { col: 12, text: 'TOTAL KG', span: true },
      { col: 13, text: 'RINDE\nFAENA', span: true },
    ]

    for (const h of headerLabels) {
      const cell = ws.getCell(`${String.fromCharCode(64 + h.col)}${r}`)
      cell.value = h.text
      applyCell(cell, {
        font: { name: fnt.familia, size: fnt.tamanoDatos, bold: h.col === 13 },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        border: { top: thinBorder.top, left: thinBorder.left, right: thinBorder.right }
      })
    }

    // Merge headers for multi-row headers (CLASIFICACION spans F-G, rows 23-24)
    ws.mergeCells(23, 6, 24, 7)   // CLASIFICACION spans F-G rows 23-24
    ws.mergeCells(23, 3, 24, 3)    // N GARRON
    ws.mergeCells(23, 4, 24, 4)    // N ANIMAL
    ws.mergeCells(23, 5, 24, 5)    // RAZA
    ws.mergeCells(23, 8, 24, 8)    // CARAVANA
    ws.mergeCells(23, 9, 24, 9)    // KG ENTRADA
    ws.mergeCells(23, 10, 24, 10)  // KG 1/2 A
    ws.mergeCells(23, 11, 24, 11)  // KG 1/2 B
    ws.mergeCells(23, 12, 24, 12)  // TOTAL KG
    ws.mergeCells(23, 13, 24, 13)  // RINDE FAENA

    // Fix borders on merged header cells
    for (const mc of ['C23', 'D23', 'E23', 'F23', 'H23', 'I23', 'J23', 'K23', 'L23', 'M23']) {
      const cell = ws.getCell(mc)
      if (!cell.border || !cell.border.top) {
        applyCell(cell, {
          border: { top: thinBorder.top, bottom: thinBorder.bottom, left: thinBorder.left, right: thinBorder.right }
        })
      }
    }

    // ============================================================
    //  FILA 25+: DATOS DE ANIMALES
    // ============================================================
    r = 25

    for (let i = 0; i < romaneos.length; i++) {
      const rom = romaneos[i]
      const animal = rom.numeroAnimal ? animalMap.get(rom.numeroAnimal) : null
      const caravana = animal?.caravana || ''
      const pesoTotalVal = (rom.pesoMediaIzq || 0) + (rom.pesoMediaDer || 0)
      const rindeVal = rom.pesoVivo && rom.pesoVivo > 0 ? pesoTotalVal / rom.pesoVivo : null
      const denticionStr = rom.denticion || ''
      const tipoStr = rom.tipoAnimal || ''
      const clasif = denticionStr && tipoStr ? `${denticionStr} - ${tipoStr}` : tipoStr || denticionStr || ''

      // N Garron (usar numero real del garron)
      ws.getCell(`C${r}`).value = rom.garron
      applyCell(ws.getCell(`C${r}`), {
        font: { name: fnt.familia, size: fnt.tamanoDatos },
        alignment: { horizontal: alin(alAnim, 'C_garron', 'center'), vertical: 'middle' },
        border: { top: thinBorder.top, left: thinBorder.left, right: thinBorder.right }
      })

      // N Animal
      ws.getCell(`D${r}`).value = rom.numeroAnimal || ''
      applyCell(ws.getCell(`D${r}`), {
        font: { name: fnt.familia, size: fnt.tamanoDatos },
        alignment: { horizontal: alin(alAnim, 'D_animal', 'center'), vertical: 'middle' },
        border: { top: thinBorder.top, left: thinBorder.left, right: thinBorder.right }
      })

      // Raza
      ws.getCell(`E${r}`).value = rom.raza || animal?.raza || ''
      applyCell(ws.getCell(`E${r}`), {
        font: { name: fnt.familia, size: fnt.tamanoDatos },
        alignment: { horizontal: alin(alAnim, 'E_raza', 'center'), vertical: 'middle' },
        border: { top: thinBorder.top, left: thinBorder.left, right: thinBorder.right }
      })

      // Clasificacion (denticion + tipo animal, merge F-G)
      ws.mergeCells(r, 6, r, 7)
      ws.getCell(`F${r}`).value = clasif
      applyCell(ws.getCell(`F${r}`), {
        font: { name: fnt.familia, size: fnt.tamanoDatos },
        alignment: { horizontal: alin(alAnim, 'F_G_clasif', 'center'), vertical: 'middle' },
        border: { top: thinBorder.top, left: thinBorder.left, right: thinBorder.right }
      })

      // Caravana
      ws.getCell(`H${r}`).value = caravana
      applyCell(ws.getCell(`H${r}`), {
        font: { name: fnt.familia, size: fnt.tamanoDatos },
        alignment: { horizontal: alin(alAnim, 'H_caravana', 'center'), vertical: 'middle' },
        border: { top: thinBorder.top, left: thinBorder.left, right: thinBorder.right }
      })

      // KG Entrada
      ws.getCell(`I${r}`).value = rom.pesoVivo || null
      applyCell(ws.getCell(`I${r}`), {
        font: { name: fnt.familia, size: fnt.tamanoDatos },
        alignment: { horizontal: alin(alAnim, 'I_kgEntrada', 'center'), vertical: 'middle' },
        border: { top: thinBorder.top, left: thinBorder.left },
        numFmt: fmt.kgEntero
      })

      // KG 1/2 A
      ws.getCell(`J${r}`).value = rom.pesoMediaIzq || null
      applyCell(ws.getCell(`J${r}`), {
        font: { name: fnt.familia, size: fnt.tamanoDatos },
        alignment: { horizontal: alin(alAnim, 'J_mediaA', 'center'), vertical: 'middle' },
        border: { top: thinBorder.top, left: thinBorder.left, right: thinBorder.right },
        numFmt: fmt.kgDecimal
      })

      // KG 1/2 B
      ws.getCell(`K${r}`).value = rom.pesoMediaDer || null
      applyCell(ws.getCell(`K${r}`), {
        font: { name: fnt.familia, size: fnt.tamanoDatos },
        alignment: { horizontal: alin(alAnim, 'K_mediaB', 'center'), vertical: 'middle' },
        border: { top: thinBorder.top, left: thinBorder.left, right: thinBorder.right },
        numFmt: fmt.kgDecimal
      })

      // TOTAL KG
      ws.getCell(`L${r}`).value = pesoTotalVal
      applyCell(ws.getCell(`L${r}`), {
        font: { name: fnt.familia, size: fnt.tamanoDatos },
        alignment: { horizontal: alin(alAnim, 'L_totalKg', 'center'), vertical: 'middle' },
        border: { top: thinBorder.top, right: thinBorder.right },
        numFmt: fmt.kgDecimal
      })

      // RINDE FAENA
      ws.getCell(`M${r}`).value = rindeVal
      applyCell(ws.getCell(`M${r}`), {
        font: { name: fnt.familia, size: fnt.tamanoDatos, bold: true },
        alignment: { horizontal: alin(alAnim, 'M_rinde', 'right'), vertical: 'middle' },
        border: { top: thinBorder.top, left: thinBorder.left, right: thinBorder.right },
        numFmt: fmt.porcentaje
      })

      r++
    }

    // ============================================================
    //  FILA TOTALES
    // ============================================================
    r++

    // Cantidad
    ws.getCell(`D${r}`).value = romaneos.length
    applyCell(ws.getCell(`D${r}`), {
      font: { name: fnt.familia, size: fnt.tamanoDatos },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: { top: thinBorder.top, bottom: thinBorder.bottom, left: thinBorder.left, right: thinBorder.right }
    })

    // Suma KG Entrada
    ws.getCell(`I${r}`).value = Math.round(pesoVivoTotal)
    applyCell(ws.getCell(`I${r}`), {
      font: { name: fnt.familia, size: fnt.tamanoDatos },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: { top: thinBorder.top, left: thinBorder.left, right: thinBorder.right },
      numFmt: fmt.kgEntero
    })

    // Suma KG 1/2 A
    const sumA = romaneos.reduce((s, rom) => s + (rom.pesoMediaIzq || 0), 0)
    ws.getCell(`J${r}`).value = Math.round(sumA * 10) / 10
    applyCell(ws.getCell(`J${r}`), {
      font: { name: fnt.familia, size: fnt.tamanoDatos },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: { top: thinBorder.top, bottom: thinBorder.bottom, left: thinBorder.left, right: thinBorder.right },
      numFmt: fmt.kgDecimal
    })

    // Suma KG 1/2 B
    const sumB = romaneos.reduce((s, rom) => s + (rom.pesoMediaDer || 0), 0)
    ws.getCell(`K${r}`).value = Math.round(sumB * 10) / 10
    applyCell(ws.getCell(`K${r}`), {
      font: { name: fnt.familia, size: fnt.tamanoDatos },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: { top: thinBorder.top, bottom: thinBorder.bottom, left: thinBorder.left, right: thinBorder.right },
      numFmt: fmt.kgDecimal
    })

    // Suma TOTAL KG
    ws.getCell(`L${r}`).value = Math.round(pesoMedioTotal * 10) / 10
    applyCell(ws.getCell(`L${r}`), {
      font: { name: fnt.familia, size: fnt.tamanoDatos },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: { top: thinBorder.top, bottom: thinBorder.bottom, left: thinBorder.left, right: thinBorder.right },
      numFmt: fmt.kgDecimal
    })

    // RINDE TOTAL
    ws.getCell(`M${r}`).value = rindeGeneral
    applyCell(ws.getCell(`M${r}`), {
      font: { name: fnt.familia, size: fnt.tamanoDatos, bold: true },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: { top: thinBorder.top, bottom: thinBorder.bottom, left: thinBorder.left, right: thinBorder.right },
      numFmt: fmt.porcentaje
    })

    // ============================================================
    //  SEPARADOR DESPUES DE RESUMEN
    // ============================================================
    if (separadores.despuesResumen === 'simple' || separadores.despuesResumen === 'doble') {
      const sepRow = r + 1
      const style = separadores.despuesResumen === 'doble' ? 'double' : 'thin'
      for (let c = 3; c <= 13; c++) {
        applyCell(ws.getCell(`${String.fromCharCode(64 + c)}${sepRow}`), { border: { bottom: { style, color: { argb: 'FF000000' } } } })
      }
    }

    // ============================================================
    //  SECCIÓN MENUDENCIA
    // ============================================================
    r += cfg.separacion.filasAntesMenudencia

    // Separador antes de menudencia
    if (separadores.antesMenudencia === 'simple' || separadores.antesMenudencia === 'doble') {
      const sepRow = r - 1
      const style = separadores.antesMenudencia === 'doble' ? 'double' : 'thin'
      for (let c = 3; c <= 13; c++) {
        applyCell(ws.getCell(`${String.fromCharCode(64 + c)}${sepRow}`), { border: { bottom: { style, color: { argb: 'FF000000' } } } })
      }
    }

    // Header MENUDENCIA
    ws.mergeCells(r, 4, r, 7)
    ws.getCell(`D${r}`).value = 'MENUDENCIA'
    applyCell(ws.getCell(`D${r}`), {
      font: { name: fnt.familia, size: fnt.tamanoMenudencia, bold: true },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: { top: thinBorder.top, bottom: thinBorder.bottom, left: thinBorder.left, right: thinBorder.right }
    })

    ws.getCell(`H${r}`).value = 'Cantidades'
    applyCell(ws.getCell(`H${r}`), {
      font: { name: fnt.familia, size: fnt.tamanoMenudencia },
      alignment: { horizontal: alin(alMen, 'cantidades', 'center'), vertical: 'middle', wrapText: true },
      border: { top: thinBorder.top, bottom: thinBorder.bottom, left: thinBorder.left, right: thinBorder.right }
    })

    ws.getCell(`I${r}`).value = 'Kg'
    applyCell(ws.getCell(`I${r}`), {
      font: { name: fnt.familia, size: fnt.tamanoMenudencia },
      alignment: { horizontal: alin(alMen, 'kg', 'center'), vertical: 'middle', wrapText: true },
      border: { top: thinBorder.top, bottom: thinBorder.bottom, left: thinBorder.left, right: thinBorder.right }
    })

    ws.getCell(`J${r}`).value = 'Unidad'
    applyCell(ws.getCell(`J${r}`), {
      font: { name: fnt.familia, size: fnt.tamanoMenudencia },
      alignment: { horizontal: alin(alMen, 'unidad', 'center'), vertical: 'middle' },
      border: { top: thinBorder.top, bottom: thinBorder.bottom, left: thinBorder.left, right: thinBorder.right }
    })

    ws.getCell(`K${r}`).value = 'Kg Dec.'
    applyCell(ws.getCell(`K${r}`), {
      font: { name: fnt.familia, size: fnt.tamanoMenudencia },
      alignment: { horizontal: alin(alMen, 'kgDec', 'center'), vertical: 'middle' },
      border: { top: thinBorder.top, bottom: thinBorder.bottom, left: thinBorder.left, right: thinBorder.right }
    })

    r++

    // Rows de menudencia: D-G=nombre, H=Cantidades, I=Kg, J=Unidad, K=Kg Dec.
    for (const men of menudencias) {
      ws.mergeCells(r, 4, r, 7)
      ws.getCell(`D${r}`).value = men.tipoMenudencia.nombre.toUpperCase()
      applyCell(ws.getCell(`D${r}`), {
        font: { name: fnt.familia, size: fnt.tamanoMenudencia },
        alignment: { horizontal: alin(alMen, 'tipo', 'left'), vertical: 'middle' }
      })

      // Cantidades (cantidadBolsas)
      ws.getCell(`H${r}`).value = men.cantidadBolsas || null
      applyCell(ws.getCell(`H${r}`), {
        font: { name: fnt.familia, size: fnt.tamanoMenudencia },
        alignment: { horizontal: alin(alMen, 'cantidades', 'center'), vertical: 'middle' }
      })

      // Kg (pesoIngreso)
      ws.getCell(`I${r}`).value = men.pesoIngreso || null
      applyCell(ws.getCell(`I${r}`), {
        font: { name: fnt.familia, size: fnt.tamanoMenudencia },
        alignment: { horizontal: alin(alMen, 'kg', 'center'), vertical: 'middle' },
        numFmt: fmt.kgDecimal
      })

      // Unidad
      ws.getCell(`J${r}`).value = ''
      applyCell(ws.getCell(`J${r}`), {
        font: { name: fnt.familia, size: fnt.tamanoMenudencia },
        alignment: { horizontal: alin(alMen, 'unidad', 'center'), vertical: 'middle' }
      })

      // Kg Dec. (decomiso)
      ws.getCell(`K${r}`).value = men.observaciones?.includes('Decomiso:')
        ? parseFloat(men.observaciones.split('Decomiso:')[1]?.split('kg')[0]?.trim() || '') || null
        : null
      applyCell(ws.getCell(`K${r}`), {
        font: { name: fnt.familia, size: fnt.tamanoMenudencia },
        alignment: { horizontal: alin(alMen, 'kgDec', 'center'), vertical: 'middle' },
        numFmt: fmt.kgDecimal
      })

      r++
    }

    // Totales menudencia
    const totalCant = menudencias.reduce((s, m) => s + (m.cantidadBolsas || 0), 0)
    const totalKgMen = menudencias.reduce((s, m) => s + (m.pesoIngreso || 0), 0)

    ws.mergeCells(r, 4, r, 7)
    ws.getCell(`D${r}`).value = 'TOTALES'
    applyCell(ws.getCell(`D${r}`), {
      font: { name: fnt.familia, size: fnt.tamanoMenudencia, bold: true },
      alignment: { horizontal: alin(alMen, 'tipo', 'left'), vertical: 'middle' },
      border: { top: thinBorder.top, bottom: thinBorder.bottom, left: thinBorder.left, right: thinBorder.right }
    })

    ws.getCell(`H${r}`).value = totalCant || null
    applyCell(ws.getCell(`H${r}`), {
      font: { name: fnt.familia, size: fnt.tamanoMenudencia, bold: true },
      alignment: { horizontal: alin(alMen, 'cantidades', 'center'), vertical: 'middle' },
      border: { top: thinBorder.top, bottom: thinBorder.bottom, left: thinBorder.left, right: thinBorder.right }
    })

    ws.getCell(`I${r}`).value = totalKgMen || null
    applyCell(ws.getCell(`I${r}`), {
      font: { name: fnt.familia, size: fnt.tamanoMenudencia, bold: true },
      alignment: { horizontal: alin(alMen, 'kg', 'center'), vertical: 'middle' },
      border: { top: thinBorder.top, bottom: thinBorder.bottom, left: thinBorder.left, right: thinBorder.right },
      numFmt: fmt.kgDecimal
    })

    // ===== GENERAR BUFFER =====
    const buffer = await wb.xlsx.writeBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Rinde_Tropa_${tropa.numero || tropa.codigo}.xlsx"`
      }
    })

  } catch (error) {
    console.error('Error generando rinde tropa:', error)
    return NextResponse.json(
      { success: false, error: 'Error al generar el reporte' },
      { status: 500 }
    )
  }
}
