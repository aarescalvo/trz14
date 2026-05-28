'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { 
  Warehouse, Loader2, RefreshCw, AlertTriangle, CheckCircle, 
  MinusCircle, PlusCircle
} from 'lucide-react'
import { TextoEditable, EditableBlock, useEditor } from '@/components/ui/editable-screen'
import { ExportButton } from '@/components/ui/export-button'
import ExcelJS from 'exceljs'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Helper para descargar blobs
function saveAs(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

interface Operador {
  id: string
  nombre: string
  rol: string
}

interface CorralStock {
  id: string
  nombre: string
  capacidad: number
  stockBovinos: number
  stockEquinos: number
  activo: boolean
  tropas: Array<{
    id: string
    numero: number
    codigo: string
    especie: string
    cantidadCabezas: number
    estado: string
    productor?: { nombre: string } | null
    usuarioFaena?: { nombre: string } | null
    fechaRecepcion: string
    dte: string | null
    guia: string | null
    observaciones: string | null
  }>
}

interface Props {
  operador: Operador
}

export function StocksCorralesModule({ operador }: Props) {
  const { editMode, getTexto } = useEditor()
  const [corrales, setCorrales] = useState<CorralStock[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetchStock()
  }, [])

  const fetchStock = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/corrales/stock')
      const data = await res.json()
      if (data.success) {
        setCorrales(data.data)
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar stock de corrales')
    } finally {
      setLoading(false)
    }
  }

  const getOcupacion = (corral: CorralStock) => {
    const total = corral.stockBovinos + corral.stockEquinos
    const porcentaje = corral.capacidad > 0 ? (total / corral.capacidad) * 100 : 0
    return { total, porcentaje }
  }

  const getEstadoBadge = (corral: CorralStock) => {
    const { porcentaje } = getOcupacion(corral)
    
    if (porcentaje >= 100) {
      return <Badge className="bg-red-100 text-red-700"><TextoEditable id="estado-lleno-corral" original="Lleno" tag="span" /></Badge>
    } else if (porcentaje >= 80) {
      return <Badge className="bg-amber-100 text-amber-700"><TextoEditable id="estado-casi-lleno-corral" original="Casi lleno" tag="span" /></Badge>
    } else if (porcentaje > 0) {
      return <Badge className="bg-emerald-100 text-emerald-700"><TextoEditable id="estado-disponible-corral" original="Disponible" tag="span" /></Badge>
    } else {
      return <Badge className="bg-stone-100 text-stone-500"><TextoEditable id="estado-vacio-corral" original="Vacío" tag="span" /></Badge>
    }
  }

  const getBarraColor = (porcentaje: number) => {
    if (porcentaje >= 100) return 'bg-red-500'
    if (porcentaje >= 80) return 'bg-amber-500'
    return 'bg-emerald-500'
  }

  const corralesFiltrados = corrales.filter(c => {
    if (filtroEstado === 'todos') return true
    if (filtroEstado === 'vacios') return c.stockBovinos === 0 && c.stockEquinos === 0
    if (filtroEstado === 'disponibles') return getOcupacion(c).porcentaje < 80
    if (filtroEstado === 'llenos') return getOcupacion(c).porcentaje >= 80
    return true
  })

  const totalAnimales = corrales.reduce((acc, c) => acc + c.stockBovinos + c.stockEquinos, 0)
  const totalCapacidad = corrales.reduce((acc, c) => acc + c.capacidad, 0)

  // ==================== EXPORTACION EXCEL - FORMATO PLANILLA SENASA ====================
  const handleExportarExcel = async () => {
    setExporting(true)
    try {
      const today = new Date()
      const fechaStr = today.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Existencia Corrales')

      // Estilos
      const titleFont = { name: 'Arial', size: 12, bold: true }
      const headerFont = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } }
      const subHeaderFont = { name: 'Arial', size: 8, bold: true }
      const dataFont = { name: 'Arial', size: 9 }
      const centerAlign = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true }
      const leftAlign = { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true }
      const borderStyle = { style: 'thin' as const, color: { argb: 'FF000000' } }
      const allBorders = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle }
      const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1F4E79' } }
      const subHeaderFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD6E4F0' } }

      // Columnas: A=1, B=2, ... Y=25
      // A(1): Entrada Fecha, B(2): Entrada Hora, C(3): Corral, D(4): Tropa, 
      // E(5): Guia, F(6): DTe, G(7): (vacio), H(8): DDJJ UE, I(9): Cant Animales,
      // J(10): Partido, K(11): (vacio), L(12): Provincia, M(13): (vacio),
      // N(14): Reman., O(15): Faena, P(16): Saldo, Q(17): (vacio),
      // R(18): Orden SI, S(19): Orden NO, T(20): (vacio), U(21): Autoriza, 
      // V(22): (vacio), W(23): Observaciones, X(24): (vacio)

      // Anchos de columna
      ws.getColumn(1).width = 12  // Entrada Fecha
      ws.getColumn(2).width = 8   // Entrada Hora
      ws.getColumn(3).width = 10  // Corral
      ws.getColumn(4).width = 10  // Tropa
      ws.getColumn(5).width = 12  // Guia
      ws.getColumn(6).width = 16  // DTe
      ws.getColumn(7).width = 3   // separador
      ws.getColumn(8).width = 14  // DDJJ UE
      ws.getColumn(9).width = 10  // Cant Animales
      ws.getColumn(10).width = 18 // Partido
      ws.getColumn(11).width = 3  // separador
      ws.getColumn(12).width = 14 // Provincia
      ws.getColumn(13).width = 3  // separador
      ws.getColumn(14).width = 8  // Reman.
      ws.getColumn(15).width = 8  // Faena
      ws.getColumn(16).width = 8  // Saldo
      ws.getColumn(17).width = 3  // separador
      ws.getColumn(18).width = 6  // Orden SI
      ws.getColumn(19).width = 6  // Orden NO
      ws.getColumn(20).width = 3  // separador
      ws.getColumn(21).width = 20 // Autoriza
      ws.getColumn(22).width = 3  // separador
      ws.getColumn(23).width = 25 // Observaciones

      // Fila 1: Titulo
      ws.mergeCells(1, 1, 1, 23)
      const r1 = ws.getRow(1)
      r1.height = 22
      const c1 = ws.getCell(1, 1)
      c1.value = 'Planilla de Existencia, Movimiento y Autorización'
      c1.font = titleFont
      c1.alignment = centerAlign

      // Fila 2: Especie + Fecha + Inspeccion Veterinaria
      const r2 = ws.getRow(2)
      r2.height = 18
      ws.mergeCells(2, 1, 2, 3)
      const c2a = ws.getCell(2, 1)
      c2a.value = 'ESPECIE BOVINA:'
      c2a.font = { name: 'Arial', size: 9, bold: true }
      c2a.alignment = leftAlign

      ws.mergeCells(2, 8, 2, 10)
      const c2b = ws.getCell(2, 8)
      c2b.value = `FECHA: ${fechaStr}`
      c2b.font = { name: 'Arial', size: 9, bold: true }
      c2b.alignment = centerAlign

      ws.mergeCells(2, 16, 2, 23)
      const c2c = ws.getCell(2, 16)
      c2c.value = 'INSPECCION VETERINARIA'
      c2c.font = { name: 'Arial', size: 9, bold: true }
      c2c.alignment = centerAlign

      // Fila 3: vacía
      ws.getRow(3).height = 6

      // Fila 4: Headers nivel 1 (merged cells)
      const r4 = ws.getRow(4)
      r4.height = 20

      // ENTRADA -> cols A-B (1-2)
      ws.mergeCells(4, 1, 4, 2)
      setCell(ws, 4, 1, 'ENTRADA', headerFont, headerFill, centerAlign, allBorders)
      setCell(ws, 4, 2, '', headerFont, headerFill, centerAlign, allBorders)

      // CORRAL Nº -> col C (3)
      setCell(ws, 4, 3, 'CORRAL Nº', headerFont, headerFill, centerAlign, allBorders)

      // TROPA Nº -> col D (4)
      setCell(ws, 4, 4, 'TROPA Nº', headerFont, headerFill, centerAlign, allBorders)

      // GUIA Nº -> col E (5)
      setCell(ws, 4, 5, 'GUIA Nº', headerFont, headerFill, centerAlign, allBorders)

      // DTe Nº -> col F (6)
      setCell(ws, 4, 6, 'DTe Nº', headerFont, headerFill, centerAlign, allBorders)

      // separador -> col G (7)
      setCell(ws, 4, 7, '', headerFont, headerFill, centerAlign, allBorders)

      // DDJJ UE -> col H (8)
      setCell(ws, 4, 8, 'DDJJ UE', headerFont, headerFill, centerAlign, allBorders)

      // CANTIDAD ANIMALES -> col I (9)
      setCell(ws, 4, 9, 'CANT. ANIMALES', headerFont, headerFill, centerAlign, allBorders)

      // PROCEDENCIA -> cols J-L (10-12)
      ws.mergeCells(4, 10, 4, 12)
      setCell(ws, 4, 10, 'PROCEDENCIA', headerFont, headerFill, centerAlign, allBorders)
      setCell(ws, 4, 11, '', headerFont, headerFill, centerAlign, allBorders)
      setCell(ws, 4, 12, '', headerFont, headerFill, centerAlign, allBorders)

      // separador -> col M (13)
      setCell(ws, 4, 13, '', headerFont, headerFill, centerAlign, allBorders)

      // MOVIMIENTO DE HACIENDA -> cols N-P (14-16)
      ws.mergeCells(4, 14, 4, 16)
      setCell(ws, 4, 14, 'MOVIMIENTO DE HACIENDA', headerFont, headerFill, centerAlign, allBorders)
      setCell(ws, 4, 15, '', headerFont, headerFill, centerAlign, allBorders)
      setCell(ws, 4, 16, '', headerFont, headerFill, centerAlign, allBorders)

      // separador -> col Q (17)
      setCell(ws, 4, 17, '', headerFont, headerFill, centerAlign, allBorders)

      // ORDEN -> cols R-S (18-19)
      ws.mergeCells(4, 18, 4, 19)
      setCell(ws, 4, 18, 'ORDEN', headerFont, headerFill, centerAlign, allBorders)
      setCell(ws, 4, 19, '', headerFont, headerFill, centerAlign, allBorders)

      // separador -> col T (20)
      setCell(ws, 4, 20, '', headerFont, headerFill, centerAlign, allBorders)

      // AUTORIZA -> col U (21)
      setCell(ws, 4, 21, 'AUTORIZA', headerFont, headerFill, centerAlign, allBorders)

      // separador -> col V (22)
      setCell(ws, 4, 22, '', headerFont, headerFill, centerAlign, allBorders)

      // OBSERVACIONES -> col W (23)
      setCell(ws, 4, 23, 'OBSERVACIONES', headerFont, headerFill, centerAlign, allBorders)

      // Fila 5: Sub-headers
      const r5 = ws.getRow(5)
      r5.height = 16

      setCell(ws, 5, 1, 'FECHA', subHeaderFont, subHeaderFill, centerAlign, allBorders)
      setCell(ws, 5, 2, 'HORA', subHeaderFont, subHeaderFill, centerAlign, allBorders)
      setCell(ws, 5, 3, '', subHeaderFont, subHeaderFill, centerAlign, allBorders)
      setCell(ws, 5, 4, '', subHeaderFont, subHeaderFill, centerAlign, allBorders)
      setCell(ws, 5, 5, '', subHeaderFont, subHeaderFill, centerAlign, allBorders)
      setCell(ws, 5, 6, '', subHeaderFont, subHeaderFill, centerAlign, allBorders)
      setCell(ws, 5, 7, '', subHeaderFont, subHeaderFill, centerAlign, allBorders)
      setCell(ws, 5, 8, '', subHeaderFont, subHeaderFill, centerAlign, allBorders)
      setCell(ws, 5, 9, '', subHeaderFont, subHeaderFill, centerAlign, allBorders)
      setCell(ws, 5, 10, 'PARTIDO', subHeaderFont, subHeaderFill, centerAlign, allBorders)
      setCell(ws, 5, 11, '', subHeaderFont, subHeaderFill, centerAlign, allBorders)
      setCell(ws, 5, 12, 'PROVINCIA', subHeaderFont, subHeaderFill, centerAlign, allBorders)
      setCell(ws, 5, 13, '', subHeaderFont, subHeaderFill, centerAlign, allBorders)
      setCell(ws, 5, 14, 'REMAN.', subHeaderFont, subHeaderFill, centerAlign, allBorders)
      setCell(ws, 5, 15, 'FAENA', subHeaderFont, subHeaderFill, centerAlign, allBorders)
      setCell(ws, 5, 16, 'SALDO', subHeaderFont, subHeaderFill, centerAlign, allBorders)
      setCell(ws, 5, 17, '', subHeaderFont, subHeaderFill, centerAlign, allBorders)
      setCell(ws, 5, 18, 'SI', subHeaderFont, subHeaderFill, centerAlign, allBorders)
      setCell(ws, 5, 19, 'NO', subHeaderFont, subHeaderFill, centerAlign, allBorders)
      setCell(ws, 5, 20, '', subHeaderFont, subHeaderFill, centerAlign, allBorders)
      setCell(ws, 5, 21, '', subHeaderFont, subHeaderFill, centerAlign, allBorders)
      setCell(ws, 5, 22, '', subHeaderFont, subHeaderFill, centerAlign, allBorders)
      setCell(ws, 5, 23, '', subHeaderFont, subHeaderFill, centerAlign, allBorders)

      // Filas de datos: una fila por cada tropa en cada corral
      let rowIdx = 6
      const corralesConStock = corrales.filter(c => 
        c.tropas && c.tropas.length > 0 && c.id !== 'sin-corral'
      )

      for (const corral of corralesConStock) {
        for (const tropa of corral.tropas) {
          const fecha = new Date(tropa.fechaRecepcion)
          const fechaFormateada = fecha.toLocaleDateString('es-AR')
          const horaFormateada = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

          const r = ws.getRow(rowIdx)
          r.height = 16

          // A: Entrada Fecha
          setCell(ws, rowIdx, 1, fechaFormateada, dataFont, undefined, centerAlign, allBorders)
          // B: Entrada Hora
          setCell(ws, rowIdx, 2, horaFormateada, dataFont, undefined, centerAlign, allBorders)
          // C: Corral
          setCell(ws, rowIdx, 3, corral.nombre, dataFont, undefined, centerAlign, allBorders)
          // D: Tropa
          setCell(ws, rowIdx, 4, tropa.numero, dataFont, undefined, centerAlign, allBorders)
          // E: Guia
          setCell(ws, rowIdx, 5, tropa.guia || '', dataFont, undefined, centerAlign, allBorders)
          // F: DTe
          setCell(ws, rowIdx, 6, tropa.dte || '', dataFont, undefined, centerAlign, allBorders)
          // G: separador
          setCell(ws, rowIdx, 7, '', dataFont, undefined, centerAlign, allBorders)
          // H: DDJJ UE
          setCell(ws, rowIdx, 8, tropa.usuarioFaena?.nombre || '', dataFont, undefined, leftAlign, allBorders)
          // I: Cant Animales
          setCell(ws, rowIdx, 9, tropa.cantidadCabezas, dataFont, undefined, centerAlign, allBorders)
          // J: Partido
          setCell(ws, rowIdx, 10, '', dataFont, undefined, leftAlign, allBorders)
          // K: separador
          setCell(ws, rowIdx, 11, '', dataFont, undefined, centerAlign, allBorders)
          // L: Provincia
          setCell(ws, rowIdx, 12, '', dataFont, undefined, leftAlign, allBorders)
          // M: separador
          setCell(ws, rowIdx, 13, '', dataFont, undefined, centerAlign, allBorders)
          // N: Remanente
          setCell(ws, rowIdx, 14, tropa.cantidadCabezas, dataFont, undefined, centerAlign, allBorders)
          // O: Faena
          setCell(ws, rowIdx, 15, '', dataFont, undefined, centerAlign, allBorders)
          // P: Saldo
          setCell(ws, rowIdx, 16, tropa.cantidadCabezas, dataFont, undefined, centerAlign, allBorders)
          // Q: separador
          setCell(ws, rowIdx, 17, '', dataFont, undefined, centerAlign, allBorders)
          // R: Orden SI
          setCell(ws, rowIdx, 18, '', dataFont, undefined, centerAlign, allBorders)
          // S: Orden NO
          setCell(ws, rowIdx, 19, '', dataFont, undefined, centerAlign, allBorders)
          // T: separador
          setCell(ws, rowIdx, 20, '', dataFont, undefined, centerAlign, allBorders)
          // U: Autoriza (productor)
          setCell(ws, rowIdx, 21, tropa.productor?.nombre || '', dataFont, undefined, leftAlign, allBorders)
          // V: separador
          setCell(ws, rowIdx, 22, '', dataFont, undefined, centerAlign, allBorders)
          // W: Observaciones
          setCell(ws, rowIdx, 23, tropa.observaciones || '', dataFont, undefined, leftAlign, allBorders)

          rowIdx++
        }
      }

      // Fila de totales
      const totalRow = ws.getRow(rowIdx)
      totalRow.height = 18
      ws.mergeCells(rowIdx, 1, rowIdx, 8)
      setCell(ws, rowIdx, 1, 'TOTALES', { name: 'Arial', size: 9, bold: true }, subHeaderFill, centerAlign, allBorders)
      for (let c = 2; c <= 8; c++) {
        setCell(ws, rowIdx, c, '', { name: 'Arial', size: 9, bold: true }, subHeaderFill, centerAlign, allBorders)
      }
      const totalCabezas = corralesConStock.reduce((acc, c) => 
        acc + c.tropas.reduce((a, t) => a + t.cantidadCabezas, 0), 0)
      setCell(ws, rowIdx, 9, totalCabezas, { name: 'Arial', size: 9, bold: true }, subHeaderFill, centerAlign, allBorders)
      for (let c = 10; c <= 23; c++) {
        setCell(ws, rowIdx, c, '', { name: 'Arial', size: 9, bold: true }, subHeaderFill, centerAlign, allBorders)
      }

      // Generar y descargar
      const buffer = await wb.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const filename = `planilla_existencia_corrales_${today.toISOString().slice(0, 10)}.xlsx`
      saveAs(blob, filename)
      toast.success('Excel generado correctamente')
    } catch (error) {
      console.error('Error al generar Excel:', error)
      toast.error('Error al generar Excel')
    } finally {
      setExporting(false)
    }
  }

  // ==================== EXPORTACION PDF ====================
  const handleExportarPDF = async () => {
    setExporting(true)
    try {
      const today = new Date()
      const fechaStr = today.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      const pageWidth = doc.internal.pageSize.getWidth()
      let y = 12

      // Titulo
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(31, 78, 121)
      doc.text('Planilla de Existencia, Movimiento y Autorización', pageWidth / 2, y, { align: 'center' })

      // Subtitulo
      y += 7
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(51, 51, 51)
      doc.text('ESPECIE BOVINA', 14, y)
      doc.text(`FECHA: ${fechaStr}`, pageWidth / 2, y, { align: 'center' })
      doc.text('INSPECCION VETERINARIA', pageWidth - 14, y, { align: 'right' })

      y += 8

      // Tabla de datos
      const headers = [
        'Entrada\nFecha', 'Entrada\nHora', 'Corral', 'Tropa',
        'Guía', 'DTe', 'DDJJ UE', 'Cant.\nAnimales',
        'Procedencia\n(Partido)', 'Procedencia\n(Provincia)',
        'Reman.', 'Faena', 'Saldo',
        'Orden\nSI', 'Orden\nNO', 'Autoriza', 'Observaciones'
      ]

      const corralesConStock = corrales.filter(c => 
        c.tropas && c.tropas.length > 0 && c.id !== 'sin-corral'
      )

      const rows: any[][] = []
      for (const corral of corralesConStock) {
        for (const tropa of corral.tropas) {
          const fecha = new Date(tropa.fechaRecepcion)
          rows.push([
            fecha.toLocaleDateString('es-AR'),
            fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
            corral.nombre,
            tropa.numero.toString(),
            tropa.guia || '',
            tropa.dte || '',
            tropa.usuarioFaena?.nombre || '',
            tropa.cantidadCabezas.toString(),
            '', // Partido - editable
            '', // Provincia - editable
            tropa.cantidadCabezas.toString(), // Remanente
            '', // Faena - editable
            tropa.cantidadCabezas.toString(), // Saldo
            '', // Orden SI
            '', // Orden NO
            tropa.productor?.nombre || '',
            tropa.observaciones || ''
          ])
        }
      }

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: y,
        styles: {
          fontSize: 7,
          cellPadding: 2,
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [31, 78, 121],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
          fontSize: 7,
        },
        alternateRowStyles: {
          fillColor: [245, 245, 250],
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 16 },
          1: { halign: 'center', cellWidth: 10 },
          2: { halign: 'center', cellWidth: 14 },
          3: { halign: 'center', cellWidth: 12 },
          4: { halign: 'center', cellWidth: 16 },
          5: { halign: 'center', cellWidth: 22 },
          6: { halign: 'left', cellWidth: 18 },
          7: { halign: 'center', cellWidth: 10 },
          8: { halign: 'left', cellWidth: 22 },
          9: { halign: 'left', cellWidth: 20 },
          10: { halign: 'center', cellWidth: 10 },
          11: { halign: 'center', cellWidth: 10 },
          12: { halign: 'center', cellWidth: 10 },
          13: { halign: 'center', cellWidth: 8 },
          14: { halign: 'center', cellWidth: 8 },
          15: { halign: 'left', cellWidth: 25 },
          16: { halign: 'left', cellWidth: 30 },
        },
        margin: { left: 10, right: 10, top: y },
      })

      // Pie de pagina
      const pageCount = doc.getNumberOfPages()
      const pageHeight = doc.internal.pageSize.getHeight()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(150, 150, 150)
        doc.text(`Generado: ${new Date().toLocaleString('es-AR')} | Solemar Alimentaria`, 10, pageHeight - 8)
        doc.text(`Página ${i} de ${pageCount}`, pageWidth - 10, pageHeight - 8, { align: 'right' })
      }

      const filename = `planilla_existencia_corrales_${today.toISOString().slice(0, 10)}.pdf`
      doc.save(filename)
      toast.success('PDF generado correctamente')
    } catch (error) {
      console.error('Error al generar PDF:', error)
      toast.error('Error al generar PDF')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <EditableBlock bloqueId="header" label="Encabezado">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-stone-800 flex items-center gap-2">
                <Warehouse className="w-8 h-8 text-amber-500" />
                <TextoEditable id="titulo-stocks-corrales" original="Stocks de Corrales" tag="span" />
              </h1>
              <p className="text-stone-500 mt-1">
                <TextoEditable id="subtitulo-stocks-corrales" original="Control de animales en corrales" tag="span" />
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ExportButton
                onExportExcel={handleExportarExcel}
                onExportPDF={handleExportarPDF}
                disabled={exporting || corrales.length === 0}
                showPrint={false}
                label="Planilla"
              />
              <Button onClick={fetchStock} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                <TextoEditable id="btn-actualizar-corrales" original="Actualizar" tag="span" />
              </Button>
            </div>
          </div>
        </EditableBlock>

        {/* Resumen */}
        <EditableBlock bloqueId="resumen" label="Tarjetas de Resumen">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <p className="text-xs text-stone-500 uppercase"><TextoEditable id="label-total-animales-corral" original="Total Animales" tag="span" /></p>
                <p className="text-3xl font-bold text-stone-800">{totalAnimales}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <p className="text-xs text-stone-500 uppercase"><TextoEditable id="label-capacidad-total-corral" original="Capacidad Total" tag="span" /></p>
                <p className="text-3xl font-bold text-stone-800">{totalCapacidad}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <p className="text-xs text-stone-500 uppercase"><TextoEditable id="label-bovinos-corral" original="Bovinos" tag="span" /></p>
                <p className="text-3xl font-bold text-amber-600">
                  {corrales.reduce((acc, c) => acc + c.stockBovinos, 0)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <p className="text-xs text-stone-500 uppercase"><TextoEditable id="label-equinos-corral" original="Equinos" tag="span" /></p>
                <p className="text-3xl font-bold text-purple-600">
                  {corrales.reduce((acc, c) => acc + c.stockEquinos, 0)}
                </p>
              </CardContent>
            </Card>
          </div>
        </EditableBlock>

        {/* Filtro */}
        <EditableBlock bloqueId="filtro" label="Filtro de Estado">
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-stone-600"><TextoEditable id="label-filtrar-estado-corral" original="Filtrar por estado:" tag="span" /></span>
                <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos"><TextoEditable id="filtro-todos-corral" original="Todos" tag="span" /></SelectItem>
                    <SelectItem value="vacios"><TextoEditable id="filtro-vacios-corral" original="Vacíos" tag="span" /></SelectItem>
                    <SelectItem value="disponibles"><TextoEditable id="filtro-disponibles-corral" original="Disponibles" tag="span" /></SelectItem>
                    <SelectItem value="llenos"><TextoEditable id="filtro-llenos-corral" original="Llenos/Casi llenos" tag="span" /></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </EditableBlock>

        {/* Lista de Corrales */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : (
          <EditableBlock bloqueId="corrales" label="Lista de Corrales">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {corralesFiltrados.map((corral) => {
                const { total, porcentaje } = getOcupacion(corral)
                
                return (
                  <Card key={corral.id} className={`border-0 shadow-md ${!corral.activo ? 'opacity-50' : ''}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Warehouse className="w-5 h-5 text-amber-500" />
                          {corral.nombre}
                        </CardTitle>
                        {getEstadoBadge(corral)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Barra de progreso */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-stone-500"><TextoEditable id="label-ocupacion-corral" original="Ocupación" tag="span" /></span>
                          <span className="font-medium">{total}/{corral.capacidad}</span>
                        </div>
                        <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${getBarraColor(porcentaje)}`}
                            style={{ width: `${Math.min(porcentaje, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-stone-400 text-right">{porcentaje.toFixed(0)}%</p>
                      </div>

                      {/* Desglose */}
                      <div className="flex justify-between text-sm">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-amber-500 rounded-full" />
                          <span className="text-stone-600"><TextoEditable id="label-bovinos-cant" original="Bovinos:" tag="span" /> <strong>{corral.stockBovinos}</strong></span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-purple-500 rounded-full" />
                          <span className="text-stone-600"><TextoEditable id="label-equinos-cant" original="Equinos:" tag="span" /> <strong>{corral.stockEquinos}</strong></span>
                        </div>
                      </div>

                      {/* Tropas en el corral */}
                      {corral.tropas && corral.tropas.length > 0 && (
                        <div className="border-t pt-3">
                          <p className="text-xs text-stone-500 mb-2"><TextoEditable id="label-tropas-en-corral" original="Tropas en este corral:" tag="span" /></p>
                          <div className="space-y-1 max-h-24 overflow-y-auto">
                            {corral.tropas.map((tropa) => (
                              <div key={tropa.id} className="flex justify-between text-xs">
                                <span className="font-mono text-stone-700">{tropa.codigo}</span>
                                <span className="text-stone-500">
                                  {tropa.cantidadCabezas} <TextoEditable id="label-cab-tropa" original="cab." tag="span" /> - {tropa.productor?.nombre || 'S/P'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Alertas */}
                      {porcentaje >= 100 && (
                        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-2 rounded">
                          <AlertTriangle className="w-4 h-4" />
                          <span><TextoEditable id="alerta-capacidad-maxima" original="Capacidad máxima alcanzada" tag="span" /></span>
                        </div>
                      )}
                      {porcentaje >= 80 && porcentaje < 100 && (
                        <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 p-2 rounded">
                          <AlertTriangle className="w-4 h-4" />
                          <span><TextoEditable id="alerta-capacidad-cercana" original="Capacidad cercana al límite" tag="span" /></span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </EditableBlock>
        )}

        {/* Mensaje si no hay resultados */}
        {!loading && corralesFiltrados.length === 0 && (
          <Card className="border-0 shadow-md">
            <CardContent className="py-12 text-center text-stone-400">
              <Warehouse className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p><TextoEditable id="msg-sin-corrales-filtro" original="No hay corrales que coincidan con el filtro" tag="span" /></p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// Helper para setear celdas de Excel
function setCell(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  value: string | number | null,
  font?: Partial<ExcelJS.Font>,
  fill?: Partial<ExcelJS.Fill>,
  alignment?: Partial<ExcelJS.Alignment>,
  border?: Partial<ExcelJS.Borders>
) {
  const cell = ws.getCell(row, col)
  cell.value = value ?? ''
  if (font) cell.font = font
  if (fill) cell.fill = fill as ExcelJS.Fill
  if (alignment) cell.alignment = alignment
  if (border) cell.border = border
}

export default StocksCorralesModule
