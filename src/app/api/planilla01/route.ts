import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import ExcelJS from 'exceljs'
import { checkPermission } from '@/lib/auth-helpers'

// Mapeo de tipos de animal
const TIPOS_ANIMAL: Record<string, string> = {
  'TO': 'TORO', 'VA': 'VACA', 'VQ': 'VAQUILLONA', 'MEJ': 'MEJORADOR',
  'NO': 'NOVILLO', 'NT': 'NOVILLITO', 'TQ': 'TERNERO', 'TN': 'TERNERA'
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

    // Obtener datos de la tropa con pesaje individual y pesaje camión
    const tropa = await db.tropa.findUnique({
      where: { id: tropaId },
      include: {
        productor: true,
        usuarioFaena: true,
        corral: true,
        animales: {
          orderBy: { numero: 'asc' },
          include: {
            pesajeIndividual: true
          }
        },
        pesajeCamion: {
          include: {
            transportista: true
          }
        }
      }
    })

    if (!tropa) {
      return NextResponse.json({ success: false, error: 'Tropa no encontrada' }, { status: 404 })
    }

    // ===== CÁLCULOS DE PESAJE =====
    const kgNetosCamion = tropa.pesajeCamion?.pesoNeto ?? null
    const kgNetosIndividuales = (tropa.animales || []).reduce((sum, a) => {
      return sum + (a.pesajeIndividual?.peso || a.pesoVivo || 0)
    }, 0)
    const diferenciaKg = kgNetosCamion !== null ? kgNetosCamion - kgNetosIndividuales : null
    const totalAnimales = (tropa.animales || []).length
    const animalesConPeso = (tropa.animales || []).filter(a => (a.pesajeIndividual?.peso || a.pesoVivo || 0) > 0).length
    const pesoPromedio = animalesConPeso > 0 ? kgNetosIndividuales / animalesConPeso : 0

    // Calcular semana
    const getSemana = (fecha: Date) => {
      const d = new Date(fecha)
      const start = new Date(d.getFullYear(), 0, 1)
      return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
    }

    const semana = getSemana(tropa.fechaRecepcion)
    const año = new Date(tropa.fechaRecepcion).getFullYear()
    const fechaStr = new Date(tropa.fechaRecepcion).toLocaleDateString('es-AR')
    const codigoTropa = tropa.codigo?.replace(/\s/g, '_') || tropaId

    // Crear workbook con ExcelJS
    const wb = new ExcelJS.Workbook()

    // ===== HOJA 1: PLANILLA 01 =====
    const ws = wb.addWorksheet('Planilla 01')

    // Ajustar orientación para impresión A4 horizontal
    ws.pageSetup = {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0, footer: 0 }
    }

    // Datos del encabezado
    const headerData = [
      ['PLANILLA 01 - REGISTRO DE INGRESO DE HACIENDA'],
      [''],
      ['ESTABLECIMIENTO:', 'SOLEMAR ALIMENTARIA S.A.', '', 'N° SENASA:', '3986', '', 'MATRÍCULA:', '300'],
      ['SEMANA N°:', semana, '', 'AÑO:', año, '', 'FECHA:', fechaStr],
      [''],
      ['DATOS DEL PRODUCTOR / USUARIO FAENA'],
      ['Productor:', tropa.productor?.nombre || tropa.usuarioFaena?.nombre || '-', '', 'CUIT:', tropa.productor?.cuit || tropa.usuarioFaena?.cuit || '-', '', 'Tropa N°:', tropa.codigo || '-'],
      [''],
      ['DATOS DEL TRANSPORTE'],
      ['Transportista:', tropa.pesajeCamion?.transportista?.nombre || '-', '', 'Chofer:', tropa.pesajeCamion?.choferNombre || '-', '', 'DNI:', tropa.pesajeCamion?.choferDni || '-'],
      ['Patente Chasis:', tropa.pesajeCamion?.patenteChasis || '-', '', 'Patente Acoplado:', tropa.pesajeCamion?.patenteAcoplado || '-', '', 'Precintos:', tropa.pesajeCamion?.precintos || '-'],
      [''],
      ['DOCUMENTACIÓN'],
      ['DTE:', tropa.dte || '-', '', 'Guía:', tropa.guia || '-', '', 'Corral:', tropa.corral?.nombre || '-'],
      [''],
    ]

    // ===== SECCIÓN DE PESAJE COMPARATIVO =====
    const pesajeData = [
      ['COMPARATIVO DE PESAJE'],
      [''],
      ['KG NETOS CAMIÓN:', kgNetosCamion !== null ? kgNetosCamion : 'Sin datos', '', 'PESO BRUTO:', tropa.pesajeCamion?.pesoBruto || 'Sin datos', '', 'PESO TARA:', tropa.pesajeCamion?.pesoTara || 'Sin datos'],
      ['KG NETOS INDIVIDUALES (SUMA):', kgNetosIndividuales, '', 'CABEZAS CON PESO:', animalesConPeso, '', 'PESO PROMEDIO:', pesoPromedio.toFixed(1)],
      ['DIFERENCIA (Camión - Indiv.):', diferenciaKg !== null ? (diferenciaKg >= 0 ? '+' : '') + diferenciaKg.toFixed(1) + ' kg' : 'Sin datos de camión'],
      [''],
    ]

    // ===== SECCIÓN DE ANIMALES =====
    const animalHeader = ['N°', 'CARAVANA', 'TIPO', 'RAZA', 'PESO INDIVIDUAL (kg)', 'PESO VIVO (kg)', 'OBSERVACIONES']

    const animalesData = (tropa.animales || []).map((a, idx) => [
      idx + 1,
      a.caravana || '-',
      TIPOS_ANIMAL[a.tipoAnimal || ''] || a.tipoAnimal || '-',
      a.raza || '-',
      a.pesajeIndividual?.peso ? a.pesajeIndividual.peso : '-',
      a.pesoVivo || '-',
      ''
    ])

    // Totales
    const footerData = [
      [''],
      ['TOTAL ANIMALES:', totalAnimales, '', 'TOTAL KG INDIVIDUALES:', kgNetosIndividuales, '', 'TOTAL KG CAMIÓN:', kgNetosCamion || 'Sin datos'],
      ['DIFERENCIA FINAL:', diferenciaKg !== null ? (diferenciaKg >= 0 ? '+' : '') + diferenciaKg.toFixed(1) + ' kg' : 'N/D'],
      [''],
      ['', '', '', '', '', '', ''],
      ['_________________________', '', '', '_________________________', '', '', '_________________________'],
      ['FIRMA RESPONSABLE INGRESO', '', '', 'FIRMA TRANSPORTISTA', '', '', 'SUPERVISOR'],
    ]

    // Combinar todos los datos
    const allData = [...headerData, ...pesajeData, ['DETALLE DE ANIMALES'], animalHeader, ...animalesData, ...footerData]

    // Agregar filas
    allData.forEach(row => ws.addRow(row))

    // Configurar anchos de columna
    const colWidths = [12, 22, 12, 14, 22, 18, 22, 14, 18, 14, 14, 18]
    colWidths.forEach((w, i) => {
      ws.getColumn(i + 1).width = w
    })

    // ===== ESTILOS =====
    // Título principal
    const titleRow = ws.getRow(1)
    titleRow.font = { bold: true, size: 14 }
    titleRow.alignment = { horizontal: 'center' }

    // Sección comparativo de pesaje - colorear filas importantes
    const pesajeStartRow = headerData.length + 1 // fila donde empieza "COMPARATIVO DE PESAJE"
    ws.getRow(pesajeStartRow).font = { bold: true, size: 11 }

    // Fila KG NETOS CAMIÓN
    const camionRow = ws.getRow(pesajeStartRow + 3)
    camionRow.getCell(1).font = { bold: true }
    camionRow.getCell(2).font = { bold: true, size: 12 }

    // Fila KG NETOS INDIVIDUALES
    const indivRow = ws.getRow(pesajeStartRow + 4)
    indivRow.getCell(1).font = { bold: true }
    indivRow.getCell(2).font = { bold: true, size: 12 }

    // Fila DIFERENCIA
    const diffRow = ws.getRow(pesajeStartRow + 5)
    diffRow.getCell(1).font = { bold: true, size: 11 }
    diffRow.getCell(2).font = { bold: true, size: 12, color: { argb: diferenciaKg !== null && diferenciaKg < 0 ? 'FFFF0000' : 'FF006600' } }

    // Encabezado de animales
    const animalHeaderRow = ws.getRow(pesajeStartRow + pesajeData.length + 1)
    animalHeaderRow.font = { bold: true }
    animalHeaderRow.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' }
      }
    })

    // Totales finales
    const totalRow = allData.length - footerData.length + 1
    ws.getRow(totalRow).getCell(1).font = { bold: true }
    ws.getRow(totalRow).getCell(5).font = { bold: true }

    const diffFinalRow = totalRow + 1
    ws.getRow(diffFinalRow).getCell(1).font = { bold: true, size: 11 }
    ws.getRow(diffFinalRow).getCell(2).font = { bold: true, size: 12, color: { argb: diferenciaKg !== null && diferenciaKg < 0 ? 'FFFF0000' : 'FF006600' } }

    // Generar buffer
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
