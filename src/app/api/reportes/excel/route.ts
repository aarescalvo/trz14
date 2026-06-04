import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// POST - Exportar reporte Excel
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeReportes')
  if (authError) return authError

  try {
    const body = await request.json()
    const { 
      tipo, 
      plantillaCodigo, 
      filtros = {},
      datosPersonalizados 
    } = body
    
    // Si hay plantilla, usar sistema de plantillas
    if (plantillaCodigo) {
      return await exportarConPlantilla(plantillaCodigo, datosPersonalizados || {})
    }
    
    // Si no hay plantilla, generar con ExcelJS
    return await exportarConExcelJS(tipo, filtros)
    
  } catch (error) {
    console.error('Error al exportar Excel:', error)
    return NextResponse.json(
      { success: false, error: 'Error al generar reporte: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}

// ============================================
// SISTEMA DE PLANTILLAS - Lee y completa datos
// ============================================
async function exportarConPlantilla(codigo: string, datos: Record<string, any>) {
  // Buscar plantilla
  const plantilla = await db.plantillaReporte.findUnique({
    where: { codigo }
  })
  
  if (!plantilla) {
    return NextResponse.json(
      { success: false, error: `Plantilla "${codigo}" no encontrada` },
      { status: 404 }
    )
  }
  
  // Decodificar archivo base64
  const buffer = Buffer.from(plantilla.archivoContenido, 'base64')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
  
  // Obtener hoja de datos
  const worksheet = workbook.getWorksheet(plantilla.hojaDatos || 'Datos') || workbook.worksheets[0]
  
  if (!worksheet) {
    return NextResponse.json(
      { success: false, error: 'No se encontró la hoja de datos en la plantilla' },
      { status: 400 }
    )
  }
  
  // 1. Reemplazar marcadores simples (celdas individuales)
  if (plantilla.marcadores) {
    try {
      const marcadores = JSON.parse(plantilla.marcadores)
      
      for (const [celda, marcador] of Object.entries(marcadores)) {
        const cell = worksheet.getCell(celda)
        if (cell && cell.value) {
          let valor = String(cell.value)
          
          // Reemplazar variables {{VAR}}
          const matches = valor.match(/\{\{([A-Z_0-9]+)\}\}/g)
          if (matches) {
            matches.forEach(m => {
              const varName = m.replace(/\{\{|\}\}/g, '')
              const valorReemplazo = datos[varName] ?? datos[varName.toLowerCase()] ?? ''
              valor = valor.replace(m, String(valorReemplazo))
            })
            cell.value = valor
          }
          
          // Reemplazar marcador directo {{VAR}}
          const marcadorStr = String(marcador)
          if (marcadorStr.startsWith('{{') && marcadorStr.endsWith('}}')) {
            const varName = marcadorStr.replace(/\{\{|\}\}/g, '')
            const valorReemplazo = datos[varName] ?? datos[varName.toLowerCase()] ?? ''
            cell.value = valorReemplazo
          }
        }
      }
    } catch (e) {
      console.error('Error al procesar marcadores:', e)
    }
  }
  
  // 2. Insertar filas de datos (para tablas)
  if (datos.filas && Array.isArray(datos.filas) && plantilla.filaInicio) {
    const filaInicio = plantilla.filaInicio
    const columnas = plantilla.columnas ? JSON.parse(plantilla.columnas) : null
    
    // Insertar filas
    datos.filas.forEach((fila: any, index: number) => {
      const rowNum = filaInicio + index
      
      if (columnas) {
        // Usar mapeo de columnas
        columnas.forEach((col: string, colIndex: number) => {
          const cell = worksheet.getCell(rowNum, colIndex + 1)
          cell.value = fila[col] ?? fila[col.toLowerCase()] ?? ''
          
          // Copiar formato de la fila anterior si existe
          if (index > 0) {
            const prevCell = worksheet.getCell(rowNum - 1, colIndex + 1)
            cell.style = { ...prevCell.style }
          }
        })
      } else {
        // Usar posición directa
        Object.values(fila).forEach((valor, colIndex) => {
          const cell = worksheet.getCell(rowNum, colIndex + 1)
          cell.value = (valor as string | number | boolean | null) ?? ''
          
          if (index > 0) {
            const prevCell = worksheet.getCell(rowNum - 1, colIndex + 1)
            cell.style = { ...prevCell.style }
          }
        })
      }
    })
  }
  
  // 3. Reemplazar variables en todo el documento
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.value && typeof cell.value === 'string') {
        let valor = cell.value
        const matches = valor.match(/\{\{([A-Z_0-9]+)\}\}/g)
        if (matches) {
          matches.forEach(m => {
            const varName = m.replace(/\{\{|\}\}/g, '')
            const valorReemplazo = datos[varName] ?? datos[varName.toLowerCase()] ?? ''
            valor = valor.replace(m, String(valorReemplazo))
          })
          cell.value = valor
        }
      }
    })
  })
  // Generar archivo
  const bufferOut = await workbook.xlsx.writeBuffer()
  
  // Devolver archivo
  return new NextResponse(bufferOut, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${plantilla.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx"`
    }
  })
}

// ============================================
// EXCELJS - Genera reportes sin plantilla
// ============================================
async function exportarConExcelJS(tipo: string, filtros: Record<string, any>) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Reporte')
  
  // Configuración común
  const headerStyle = {
    font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF2d3748' } },
    alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
    border: {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const }
    }
  }
  
  const dataStyle = {
    border: {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const }
    }
  }
  
  // Título
  worksheet.mergeCells('A1:G1')
  const titleCell = worksheet.getCell('A1')
  titleCell.value = 'FRIGORÍFICO SOLEMAR'
  titleCell.font = { size: 16, bold: true, color: { argb: 'FF1a365d' } }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
  worksheet.getRow(1).height = 30
  
  // Subtítulo según tipo
  worksheet.mergeCells('A2:G2')
  const subtitleCell = worksheet.getCell('A2')
  subtitleCell.value = getTituloReporte(tipo)
  subtitleCell.font = { size: 14, bold: true }
  subtitleCell.alignment = { horizontal: 'center' }
  
  // Fecha
  worksheet.mergeCells('A3:G3')
  const dateCell = worksheet.getCell('A3')
  dateCell.value = `Fecha: ${new Date().toLocaleDateString('es-AR')}`
  dateCell.alignment = { horizontal: 'center' }
  dateCell.font = { color: { argb: 'FF718096' } }
  
  // Obtener datos según tipo
  let datos: any[] = []
  let columnas: string[] = []
  
  switch (tipo) {
    case 'tropas':
      const tropas = await db.tropa.findMany({
        include: { 
          productor: true, 
          corral: true,
          _count: { select: { animales: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: filtros.limite || 100
      })
      columnas = ['Código', 'Productor', 'Cabezas', 'Corral', 'Especie', 'Estado', 'Fecha']
      datos = tropas.map(t => [
        t.codigo,
        t.productor?.nombre || '-',
        t._count.animales,
        t.corral?.nombre || 'Sin asignar',
        t.especie,
        t.estado,
        t.createdAt.toLocaleDateString('es-AR')
      ])
      break
      
    case 'stock-camara':
      const stocks = await db.stockMediaRes.findMany({
        include: { camara: true },
        orderBy: { fechaIngreso: 'desc' }
      })
      columnas = ['Cámara', 'Especie', 'Cantidad', 'Peso Total', 'Fecha']
      datos = stocks.map(s => [
        s.camara?.nombre || '-',
        s.especie || '-',
        s.cantidad || 0,
        `${s.pesoTotal || 0} kg`,
        s.fechaIngreso?.toLocaleDateString('es-AR') || '-'
      ])
      break
      
    case 'faena-diaria':
      const faenas = await db.romaneo.findMany({
        include: { tipificador: true },
        where: filtros.fecha ? { 
          fecha: { 
            gte: new Date(filtros.fecha + 'T00:00:00'),
            lte: new Date(filtros.fecha + 'T23:59:59')
          }
        } : undefined,
        orderBy: { fecha: 'desc' },
        take: 100
      })
      columnas = ['Tropa', 'Garrón', 'N° Animal', 'Peso Total', 'Rinde', 'Fecha']
      datos = faenas.map(f => [
        f.tropaCodigo || '-',
        f.garron || '-',
        f.numeroAnimal || '-',
        `${f.pesoTotal || 0} kg`,
        (f.pesoVivo && f.pesoVivo > 0 && f.pesoTotal && f.pesoTotal > 0)
          ? `${Math.round((f.pesoTotal / f.pesoVivo) * 10000) / 100}%`
          : '-',
        f.fecha?.toLocaleDateString('es-AR') || '-'
      ])
      break
      
    default:
      columnas = ['Sin datos']
      datos = [['No hay datos disponibles para este tipo de reporte']]
  }
  
  // Encabezados (fila 5)
  const headerRow = 5
  columnas.forEach((col, i) => {
    const cell = worksheet.getCell(headerRow, i + 1)
    cell.value = col
    Object.assign(cell, headerStyle)
  })
  worksheet.getRow(headerRow).height = 25
  
  // Datos
  datos.forEach((fila, rowIndex) => {
    const rowNum = headerRow + 1 + rowIndex
    fila.forEach((valor, colIndex) => {
      const cell = worksheet.getCell(rowNum, colIndex + 1)
      cell.value = valor
      Object.assign(cell, dataStyle)
      
      // Alternar colores de fila
      if (rowIndex % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FAFC' } }
      }
    })
  })
  
  // Ajustar anchos de columna
  worksheet.columns.forEach((col, i) => {
    col.width = Math.max(12, columnas[i]?.length * 1.5 || 12)
  })
  
  // Generar archivo
  const buffer = await workbook.xlsx.writeBuffer()
  
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${tipo}_${new Date().toISOString().split('T')[0]}.xlsx"`
    }
  })
}

function getTituloReporte(tipo: string): string {
  const titulos: Record<string, string> = {
    'tropas': 'Reporte de Tropas',
    'stock-camara': 'Stock por Cámara',
    'faena-diaria': 'Reporte de Faena Diaria',
    'romaneo': 'Reporte de Romaneo',
    'despostada': 'Reporte de Despostada'
  }
  return titulos[tipo] || 'Reporte'
}
