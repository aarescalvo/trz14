'use client'

import { useState, useEffect } from 'react'
import {
  FileText, Calendar, Truck, User, MapPin, Hash, Beef,
  Loader2, ClipboardList, Info, Scale, ExternalLink, Clock, ClipboardCheck
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { ExportButton } from '@/components/ui/export-button'
import { ExcelExporter } from '@/lib/export-excel'
import { PDFExporter } from '@/lib/export-pdf'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// ==================== TIPOS ====================

interface TropaCompleta {
  id: string
  numero: number
  codigo: string
  especie: string
  cantidadCabezas: number
  fechaRecepcion: string
  dte: string
  guia: string
  observaciones?: string
  productor?: { id: string; nombre: string; cuit?: string; numeroRenspa?: string; direccion?: string; localidad?: string; provincia?: string }
  usuarioFaena?: { id: string; nombre: string; cuit?: string }
  corral?: { id: string; nombre: string }
  ticketCompartidoCon?: Array<{ numero: number; codigo: string }>
  pesajeCamion?: {
    id: string
    numeroTicket?: string
    tipo?: string
    patenteChasis: string
    patenteAcoplado?: string
    choferNombre?: string
    choferDni?: string
    numeroSenasa?: string
    precintos?: string
    certificadoLavado?: string
    fechaGuia?: string
    pesoBruto?: number
    pesoTara?: number
    pesoNeto?: number
    transportista?: { id: string; nombre: string; cuit?: string }
    estado?: string
    observaciones?: string | null
    fecha?: string
    fechaTara?: string | null
  }
  animales: Array<{
    id: string
    numero: number
    tipoAnimal: string
    caravana?: string
    pesoVivo?: number
    raza?: string
    corralId?: string
    observaciones?: string
  }>
}

const TIPOS_BOVINO = [
  { code: 'NO', label: 'Novillo', abbr: 'No' },
  { code: 'VQ', label: 'Vaquillona', abbr: 'Vq' },
  { code: 'NT', label: 'Novillito', abbr: 'NT' },
  { code: 'VA', label: 'Vaca', abbr: 'Va' },
  { code: 'TO', label: 'Toro', abbr: 'To' },
  { code: 'MEJ', label: 'Mejorador', abbr: 'MEJ' },
] as const

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function getTipoAnimalLabel(code: string): string {
  const found = TIPOS_BOVINO.find(t => t.code === code)
  return found ? found.label : code
}

function getTipoAnimalAbbr(code: string): string {
  const found = TIPOS_BOVINO.find(t => t.code === code)
  return found ? found.abbr : code
}

// ==================== COMPONENTE ====================

export function ReportePlanilla01Bovino() {
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)
  const [tropas, setTropas] = useState<TropaCompleta[]>([])
  const [selectedTropaId, setSelectedTropaId] = useState<string>('')
  const [tropa, setTropa] = useState<TropaCompleta | null>(null)
  const [fechaFiltro, setFechaFiltro] = useState(new Date().toISOString().split('T')[0])
  const [pesajeDialogOpen, setPesajeDialogOpen] = useState(false)

  useEffect(() => {
    fetchTropas()
  }, [fechaFiltro])

  const fetchTropas = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (fechaFiltro) params.append('fecha', fechaFiltro)
      params.append('especie', 'bovino')
      
      const res = await fetch(`/api/tropas?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setTropas(data.data || [])
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar tropas')
    } finally {
      setLoading(false)
    }
  }

  const handleSeleccionarTropa = async (tropaId: string) => {
    setSelectedTropaId(tropaId)
    if (!tropaId) {
      setTropa(null)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/tropas/${tropaId}`)
      const data = await res.json()
      if (data.success) {
        setTropa(data.data)
      } else {
        toast.error('Error al cargar la tropa')
        setTropa(null)
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar la tropa')
      setTropa(null)
    } finally {
      setLoading(false)
    }
  }

  // ==================== EXPORTAR EXCEL ====================
  const handleExportarExcel = () => {
    if (!tropa) {
      toast.error('Seleccione una tropa para exportar')
      return
    }
    setExporting('excel')
    try {
      const dateStr = new Date().toISOString().split('T')[0]
      const semana = tropa.fechaRecepcion ? getWeekNumber(new Date(tropa.fechaRecepcion)) : ''
      const fechaRecep = tropa.fechaRecepcion ? new Date(tropa.fechaRecepcion).toLocaleDateString('es-AR') : ''
      const horaRecep = tropa.fechaRecepcion ? new Date(tropa.fechaRecepcion).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''

      // Hoja 1: Datos de cabecera
      const cabeceraHeaders = ['Campo', 'Valor']
      const cabeceraData = [
        ['N Semana', semana.toString()],
        ['Fecha Ingreso', fechaRecep],
        ['Hora', horaRecep],
        ['N Tropa', tropa.codigo || tropa.numero.toString()],
        ['Matarife', tropa.usuarioFaena?.nombre || '-'],
        ['Cantidad Animales', tropa.cantidadCabezas.toString()],
        ['', ''],
        ['Nombre Productor', tropa.productor?.nombre || tropa.usuarioFaena?.nombre || '-'],
        ['CUIT', tropa.productor?.cuit || tropa.usuarioFaena?.cuit || '-'],
        ['Origen', tropa.productor?.direccion || '-'],
        ['Localidad', tropa.productor?.localidad || '-'],
        ['Provincia', tropa.productor?.provincia || '-'],
        ['N RENSPA', tropa.productor?.numeroRenspa || '-'],
        ['', ''],
        ['Nombre Transporte', tropa.pesajeCamion?.transportista?.nombre || '-'],
        ['CUIT Transporte', tropa.pesajeCamion?.transportista?.cuit || '-'],
        ['Chofer', tropa.pesajeCamion?.choferNombre || '-'],
        ['DNI Chofer', tropa.pesajeCamion?.choferDni || '-'],
        ['Patente Chasis', tropa.pesajeCamion?.patenteChasis || '-'],
        ['Patente Acoplado', tropa.pesajeCamion?.patenteAcoplado || '-'],
        ['N SENASA', tropa.pesajeCamion?.numeroSenasa || '-'],
        ['Cert. Lavado', tropa.pesajeCamion?.certificadoLavado || '-'],
        ['DTA', tropa.dte || '-'],
        ['N Guia', tropa.guia || '-'],
        ['Fecha Guia', tropa.pesajeCamion?.fechaGuia || '-'],
        ['Precintos', tropa.pesajeCamion?.precintos || '-'],
        ['N Pesada Camion', tropa.pesajeCamion?.numeroTicket
          ? (tropa.ticketCompartidoCon && tropa.ticketCompartidoCon.length > 0
              ? `${tropa.pesajeCamion.numeroTicket} (Compartido c/ Tropa ${tropa.ticketCompartidoCon.map(t => t.numero).join(', ')})`
              : String(tropa.pesajeCamion.numeroTicket))
          : '-'],
        ['Peso Bruto', tropa.pesajeCamion?.pesoBruto ? tropa.pesajeCamion.pesoBruto.toFixed(0) + ' kg' : '-'],
        ['Peso Tara', tropa.pesajeCamion?.pesoTara ? tropa.pesajeCamion.pesoTara.toFixed(0) + ' kg' : '-'],
        ['Peso Neto', tropa.pesajeCamion?.pesoNeto ? tropa.pesajeCamion.pesoNeto.toFixed(0) + ' kg' : '-'],
      ]

      // Hoja 2: Detalle de animales
      const animalesHeaders = ['N', 'Tipo Animal', 'Raza', 'Peso Entrada (kg)', 'N Caravana', 'N Corral', 'Observacion']
      const animalesData = tropa.animales.map((a, i) => [
        (i + 1).toString(),
        getTipoAnimalLabel(a.tipoAnimal),
        a.raza || '',
        a.pesoVivo ? a.pesoVivo.toFixed(0) : '',
        a.caravana || '',
        a.corralId || tropa.corral?.nombre || '',
        a.observaciones || ''
      ])

      // Completar hasta 54 filas si hay menos
      while (animalesData.length < 54) {
        animalesData.push([
          (animalesData.length + 1).toString(),
          '', '', '', '', '', ''
        ])
      }

      // Fila de totales
      const totalPeso = tropa.animales.reduce((sum, a) => sum + (a.pesoVivo || 0), 0)
      animalesData.push(['', 'TOTALES', '', totalPeso.toFixed(0), tropa.cantidadCabezas.toString(), '', ''])

      // Resumen por tipo
      const resumenPorTipo = TIPOS_BOVINO.map(t => {
        const count = tropa.animales.filter(a => a.tipoAnimal === t.code).length
        return [t.label, count.toString()]
      })
      resumenPorTipo.push(['TOTAL', tropa.cantidadCabezas.toString()])

      ExcelExporter.exportToExcel({
        filename: `Planilla01_Bovino_Tropa${tropa.numero}_${dateStr}`,
        sheets: [
          { name: 'Cabecera', headers: cabeceraHeaders, data: cabeceraData },
          { name: 'Animales', headers: animalesHeaders, data: animalesData },
          { name: 'Resumen Tipo', headers: ['Tipo Animal', 'Cantidad'], data: resumenPorTipo },
        ],
        title: `PLANILLA 01 - BOVINO - Tropa ${tropa.numero} - Solemar Alimentaria S.A.`,
      })

      toast.success('Excel generado correctamente')
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al generar Excel')
    } finally {
      setExporting(null)
    }
  }

  // ==================== EXPORTAR PDF ====================
  const handleExportarPDF = () => {
    if (!tropa) {
      toast.error('Seleccione una tropa para exportar')
      return
    }
    setExporting('pdf')
    try {
      const doc = new jsPDF('portrait', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 10
      let y = 12

      // ===== ENCABEZADO =====
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Solemar Alimentaria S.A.', margin, y)
      doc.setFontSize(10)
      doc.text('PLANILLA 01 - BOVINO', pageWidth - margin, y, { align: 'right' })
      y += 3
      doc.setLineWidth(0.5)
      doc.line(margin, y, pageWidth - margin, y)
      y += 6

      // ===== DATOS DEL INGRESO (izquierda) + PRODUCTOR (derecha) =====
      const semana = tropa.fechaRecepcion ? getWeekNumber(new Date(tropa.fechaRecepcion)) : '-'
      const fechaRecep = tropa.fechaRecepcion ? new Date(tropa.fechaRecepcion).toLocaleDateString('es-AR') : '-'
      const horaRecep = tropa.fechaRecepcion ? new Date(tropa.fechaRecepcion).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '-'

      doc.setFontSize(8)
      const leftCol = margin
      const rightCol = pageWidth / 2 + 5
      const rowH = 5.5

      // Fila 1
      doc.setFont('helvetica', 'bold')
      doc.text('N Semana:', leftCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(semana.toString(), leftCol + 22, y)
      doc.setFont('helvetica', 'bold')
      doc.text('Nombre Productor:', rightCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropa.productor?.nombre || tropa.usuarioFaena?.nombre || '-', rightCol + 35, y)
      y += rowH

      // Fila 2
      doc.setFont('helvetica', 'bold')
      doc.text('Fecha Ingreso:', leftCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(fechaRecep, leftCol + 22, y)
      doc.setFont('helvetica', 'bold')
      doc.text('CUIT:', rightCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropa.productor?.cuit || tropa.usuarioFaena?.cuit || '-', rightCol + 35, y)
      y += rowH

      // Fila 3
      doc.setFont('helvetica', 'bold')
      doc.text('Hora:', leftCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(horaRecep, leftCol + 22, y)
      doc.setFont('helvetica', 'bold')
      doc.text('Origen:', rightCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropa.productor?.direccion || '-', rightCol + 35, y)
      y += rowH

      // Fila 4
      doc.setFont('helvetica', 'bold')
      doc.text('N Tropa:', leftCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropa.codigo || tropa.numero.toString(), leftCol + 22, y)
      doc.setFont('helvetica', 'bold')
      doc.text('Localidad:', rightCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropa.productor?.localidad || '-', rightCol + 35, y)
      y += rowH

      // Fila 5
      doc.setFont('helvetica', 'bold')
      doc.text('Matarife:', leftCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropa.usuarioFaena?.nombre || '-', leftCol + 22, y)
      doc.setFont('helvetica', 'bold')
      doc.text('Provincia:', rightCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropa.productor?.provincia || '-', rightCol + 35, y)
      y += rowH

      // Fila 6
      doc.setFont('helvetica', 'bold')
      doc.text('Cant. Animales:', leftCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropa.cantidadCabezas.toString(), leftCol + 28, y)
      doc.setFont('helvetica', 'bold')
      doc.text('N RENSPA:', rightCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropa.productor?.numeroRenspa || '-', rightCol + 35, y)
      y += rowH + 2

      // Línea separadora
      doc.setLineWidth(0.3)
      doc.line(margin, y, pageWidth - margin, y)
      y += 4

      // ===== DATOS DEL TRANSPORTE =====
      doc.setFont('helvetica', 'bold')
      doc.text('Nombre Transporte:', leftCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropa.pesajeCamion?.transportista?.nombre || '-', leftCol + 32, y)
      doc.setFont('helvetica', 'bold')
      doc.text('Chofer:', rightCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropa.pesajeCamion?.choferNombre || '-', rightCol + 35, y)
      y += rowH

      doc.setFont('helvetica', 'bold')
      doc.text('CUIT:', leftCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropa.pesajeCamion?.transportista?.cuit || '-', leftCol + 32, y)
      doc.setFont('helvetica', 'bold')
      doc.text('DNI:', rightCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropa.pesajeCamion?.choferDni || '-', rightCol + 35, y)
      y += rowH

      doc.setFont('helvetica', 'bold')
      doc.text('Patente Chasis:', leftCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropa.pesajeCamion?.patenteChasis || '-', leftCol + 32, y)
      doc.setFont('helvetica', 'bold')
      doc.text('N Cert. Lavado:', rightCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropa.pesajeCamion?.certificadoLavado || '-', rightCol + 35, y)
      y += rowH

      doc.setFont('helvetica', 'bold')
      doc.text('Patente Acoplado:', leftCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropa.pesajeCamion?.patenteAcoplado || '-', leftCol + 32, y)
      doc.setFont('helvetica', 'bold')
      doc.text('DTA:', rightCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropa.dte || '-', rightCol + 35, y)
      y += rowH

      doc.setFont('helvetica', 'bold')
      doc.text('N SENASA:', leftCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropa.pesajeCamion?.numeroSenasa || '-', leftCol + 32, y)
      doc.setFont('helvetica', 'bold')
      doc.text('N Guia:', rightCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropa.guia || '-', rightCol + 35, y)
      y += rowH

      doc.setFont('helvetica', 'bold')
      doc.text('Precintos:', leftCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropa.pesajeCamion?.precintos || '-', leftCol + 32, y)
      doc.setFont('helvetica', 'bold')
      doc.text('Fecha Guia:', rightCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropa.pesajeCamion?.fechaGuia || '-', rightCol + 35, y)
      y += rowH

      doc.setFont('helvetica', 'bold')
      doc.text('N\u00b0 Pesada:', leftCol, y)
      doc.setFont('helvetica', 'normal')
      doc.text(String(tropa.pesajeCamion?.numeroTicket || '-'), leftCol + 32, y)
      if (tropa.ticketCompartidoCon && tropa.ticketCompartidoCon.length > 0) {
        const compStr = tropa.ticketCompartidoCon.map(t => `Tropa ${t.numero}`).join(', ')
        doc.setFontSize(6)
        doc.setTextColor(180, 100, 0)
        doc.text(`(Compartido c/ ${compStr})`, leftCol + 50, y)
        doc.setTextColor(0)
        doc.setFontSize(8)
      }
      y += rowH + 2

      // Línea separadora
      doc.line(margin, y, pageWidth - margin, y)
      y += 3

      // ===== REFERENCIAS =====
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.text('Referencias:', leftCol, y)
      y += 4

      // Tabla de referencias de tipos de animal
      const refHeaders = ['No', 'NOVILLO', 'Vq', 'VAQUILLONA', 'NT', 'NOVILLITO', 'Va', 'VACA', 'To', 'TORO', 'MEJ']
      const refRow = ['No', 'NOVILLO', 'Vq', 'VAQUILLONA', 'NT', 'NOVILLITO', 'Va', 'VACA', 'To', 'TORO', 'MEJ']

      autoTable(doc, {
        startY: y,
        head: [refHeaders],
        body: [refRow],
        theme: 'grid',
        styles: { fontSize: 6, cellPadding: 1.5 },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 6 },
        margin: { left: margin, right: margin },
      })

      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3

      // ===== TABLA DE ANIMALES =====
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('DETALLE DE ANIMALES', pageWidth / 2, y, { align: 'center' })
      y += 4

      // Preparar datos de la tabla
      const animalesTableData = tropa.animales.map((animal, index) => {
        const tipoAbbr = getTipoAnimalAbbr(animal.tipoAnimal)
        return [
          (index + 1).toString(),
          tipoAbbr,
          animal.raza || '',
          animal.pesoVivo ? animal.pesoVivo.toFixed(0) : '',
          animal.caravana || '',
          animal.corralId || tropa.corral?.nombre || '',
          animal.observaciones || ''
        ]
      })

      // Agregar filas vacías hasta 25 (para primera página)
      while (animalesTableData.length < 25) {
        animalesTableData.push([
          (animalesTableData.length + 1).toString(),
          '', '', '', '', '', ''
        ])
      }

      const tableHeaders = ['N', 'Tipo Animal', 'Raza', 'Peso Entrada', 'N Caravana', 'N Corral', 'Observacion']

      autoTable(doc, {
        startY: y,
        head: [tableHeaders],
        body: animalesTableData.slice(0, 25),
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [217, 217, 217], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 6.5 },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 18 },
          2: { cellWidth: 20 },
          3: { cellWidth: 22 },
          4: { cellWidth: 22 },
          5: { cellWidth: 18 },
        },
        margin: { left: margin, right: margin },
      })

      // Si hay más de 25 animales, agregar otra página
      if (tropa.animales.length > 25) {
        doc.addPage()
        y = 15
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.text('PLANILLA 01 - BOVINO (continuacion)', pageWidth / 2, y, { align: 'center' })
        y += 6

        const remainingData = tropa.animales.slice(25).map((animal, index) => {
          const tipoAbbr = getTipoAnimalAbbr(animal.tipoAnimal)
          return [
            (index + 26).toString(),
            tipoAbbr,
            animal.raza || '',
            animal.pesoVivo ? animal.pesoVivo.toFixed(0) : '',
            animal.caravana || '',
            animal.corralId || tropa.corral?.nombre || '',
            animal.observaciones || ''
          ]
        })

        // Completar hasta 54 filas
        while (remainingData.length < 29) {
          remainingData.push([
            (remainingData.length + 26).toString(),
            '', '', '', '', '', ''
          ])
        }

        autoTable(doc, {
          startY: y,
          head: [tableHeaders],
          body: remainingData,
          theme: 'grid',
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: [217, 217, 217], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 6.5 },
          columnStyles: {
            0: { cellWidth: 10 },
            1: { cellWidth: 18 },
            2: { cellWidth: 20 },
            3: { cellWidth: 22 },
            4: { cellWidth: 22 },
            5: { cellWidth: 18 },
          },
          margin: { left: margin, right: margin },
        })
      }

      // ===== TOTALES =====
      const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
      y = finalY

      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')

      // Resumen por tipo
      const tiposResumen = TIPOS_BOVINO.map(t => {
        const count = tropa.animales.filter(a => a.tipoAnimal === t.code).length
        return count > 0 ? `${t.abbr}: ${count}` : null
      }).filter(Boolean)

      doc.text(`Total Animales: ${tropa.cantidadCabezas}`, margin, y)
      const totalPeso = tropa.animales.reduce((sum, a) => sum + (a.pesoVivo || 0), 0)
      doc.text(`Total Peso: ${totalPeso.toFixed(0)} kg`, margin + 55, y)
      if (tropa.animales.length > 0) {
        const pesoProm = totalPeso / tropa.animales.length
        doc.text(`Peso Promedio: ${pesoProm.toFixed(0)} kg`, margin + 110, y)
      }
      y += 5

      doc.setFont('helvetica', 'normal')
      doc.text(`Desglose: ${tiposResumen.join(' | ')}`, margin, y)
      y += 10

      // ===== FIRMAS =====
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.line(margin + 10, y + 12, margin + 80, y + 12)
      doc.line(pageWidth - margin - 80, y + 12, pageWidth - margin - 10, y + 12)
      doc.text('Firma Responsable Ingreso', margin + 15, y + 17)
      doc.text('Firma Transportista', pageWidth - margin - 75, y + 17)

      // ===== PIE DE PAGINA =====
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(6.5)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(150, 150, 150)
        doc.text(
          `Solemar Alimentaria S.A. - Planilla 01 Bovino - Pagina ${i} de ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 8,
          { align: 'center' }
        )
        doc.setTextColor(0, 0, 0)
      }

      doc.save(`Planilla01_Bovino_Tropa${tropa.numero}.pdf`)
      toast.success('PDF generado correctamente')
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al generar PDF')
    } finally {
      setExporting(null)
    }
  }

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-stone-50 rounded-t-lg">
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-amber-600" />
            Planilla 01 - Bovino (Vol.4)
          </CardTitle>
          <CardDescription>
            Formulario de ingreso de hacienda bovina - Formato Vol.4
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-stone-500">Fecha</Label>
              <Input
                type="date"
                value={fechaFiltro}
                onChange={(e) => setFechaFiltro(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-stone-500">Seleccionar Tropa</Label>
              <Select value={selectedTropaId} onValueChange={handleSeleccionarTropa}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegir tropa..." />
                </SelectTrigger>
                <SelectContent>
                  {tropas.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      Tropa {t.numero} - {t.codigo} ({t.cantidadCabezas} cabezas)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex items-end">
              <Button onClick={fetchTropas} variant="outline" disabled={loading} className="w-full">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Calendar className="w-4 h-4 mr-2" />}
                Buscar
              </Button>
            </div>
            <div className="flex items-end">
              <ExportButton
                onExportExcel={handleExportarExcel}
                onExportPDF={handleExportarPDF}
                onPrint={() => window.print()}
                disabled={!tropa || exporting !== null}
                size="default"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sin tropa seleccionada */}
      {!tropa && !loading && (
        <Card className="border-0 shadow-md">
          <CardContent className="py-16 text-center">
            <ClipboardList className="w-16 h-16 mx-auto mb-4 text-stone-300" />
            <p className="text-stone-500 text-lg">Seleccione una tropa para visualizar la Planilla 01</p>
            <p className="text-stone-400 text-sm mt-2">
              Filtre por fecha y elija una tropa del listado para generar el reporte
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      )}

      {/* Planilla cargada */}
      {tropa && !loading && (
        <>
          {/* Datos del Ingreso + Productor */}
          <Card className="border-0 shadow-md">
            <CardHeader className="bg-stone-50 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold">Solemar Alimentaria S.A.</CardTitle>
                  <CardDescription className="text-base font-semibold text-amber-700">
                    PLANILLA 01 - BOVINO
                  </CardDescription>
                </div>
                <Badge className="bg-amber-100 text-amber-800 text-sm px-3 py-1">
                  Tropa {tropa.numero}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Columna izquierda - Datos del Ingreso */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-stone-700 text-sm flex items-center gap-2 border-b pb-1">
                    <Calendar className="w-4 h-4 text-amber-500" />
                    Datos del Ingreso
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <span className="text-stone-500">N Semana:</span>
                      <span className="ml-2 font-medium">{tropa.fechaRecepcion ? getWeekNumber(new Date(tropa.fechaRecepcion)) : '-'}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">N Tropa:</span>
                      <span className="ml-2 font-medium">{tropa.codigo || tropa.numero}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">Fecha Ingreso:</span>
                      <span className="ml-2 font-medium">{tropa.fechaRecepcion ? new Date(tropa.fechaRecepcion).toLocaleDateString('es-AR') : '-'}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">Hora:</span>
                      <span className="ml-2 font-medium">{tropa.fechaRecepcion ? new Date(tropa.fechaRecepcion).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">Matarife:</span>
                      <span className="ml-2 font-medium">{tropa.usuarioFaena?.nombre || '-'}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">Cant. Animales:</span>
                      <span className="ml-2 font-bold text-amber-700">{tropa.cantidadCabezas}</span>
                    </div>
                  </div>
                </div>

                {/* Columna derecha - Datos del Productor */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-stone-700 text-sm flex items-center gap-2 border-b pb-1">
                    <User className="w-4 h-4 text-amber-500" />
                    Datos del Productor
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="col-span-2">
                      <span className="text-stone-500">Nombre Productor:</span>
                      <span className="ml-2 font-medium">{tropa.productor?.nombre || tropa.usuarioFaena?.nombre || '-'}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">CUIT:</span>
                      <span className="ml-2 font-medium">{tropa.productor?.cuit || tropa.usuarioFaena?.cuit || '-'}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">Origen:</span>
                      <span className="ml-2 font-medium">{tropa.productor?.direccion || '-'}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">Localidad:</span>
                      <span className="ml-2 font-medium">{tropa.productor?.localidad || '-'}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">Provincia:</span>
                      <span className="ml-2 font-medium">{tropa.productor?.provincia || '-'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-stone-500">N RENSPA:</span>
                      <span className="ml-2 font-medium">{tropa.productor?.numeroRenspa || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Datos del Transporte */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Columna izquierda */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-stone-700 text-sm flex items-center gap-2 border-b pb-1">
                    <Truck className="w-4 h-4 text-amber-500" />
                    Datos del Transporte
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="col-span-2">
                      <span className="text-stone-500">Nombre Transporte:</span>
                      <span className="ml-2 font-medium">{tropa.pesajeCamion?.transportista?.nombre || '-'}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">CUIT:</span>
                      <span className="ml-2 font-medium">{tropa.pesajeCamion?.transportista?.cuit || '-'}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">Chofer:</span>
                      <span className="ml-2 font-medium">{tropa.pesajeCamion?.choferNombre || '-'}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">Patente Chasis:</span>
                      <span className="ml-2 font-medium">{tropa.pesajeCamion?.patenteChasis || '-'}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">Patente Acoplado:</span>
                      <span className="ml-2 font-medium">{tropa.pesajeCamion?.patenteAcoplado || '-'}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">N SENASA:</span>
                      <span className="ml-2 font-medium">{tropa.pesajeCamion?.numeroSenasa || '-'}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">Precintos:</span>
                      <span className="ml-2 font-medium">{tropa.pesajeCamion?.precintos || '-'}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">N Pesada:</span>
                      <span className="ml-2 font-medium">{tropa.pesajeCamion?.numeroTicket || '-'}</span>
                      {tropa.ticketCompartidoCon && tropa.ticketCompartidoCon.length > 0 && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-[10px] px-1.5 py-0 ml-2 cursor-default">COMPARTIDO</Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Ticket compartido con:</p>
                              <ul className="text-xs mt-1">
                                {tropa.ticketCompartidoCon.map(t => (
                                  <li key={t.numero}>Tropa {t.numero} ({t.codigo})</li>
                                ))}
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {tropa.pesajeCamion && (
                        <button
                          onClick={() => setPesajeDialogOpen(true)}
                          className="inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ml-2"
                        >
                          <Scale className="w-3 h-3" />
                          PESAJE
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Columna derecha */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-stone-700 text-sm flex items-center gap-2 border-b pb-1">
                    <Hash className="w-4 h-4 text-amber-500" />
                    Documentacion
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <span className="text-stone-500">DNI Chofer:</span>
                      <span className="ml-2 font-medium">{tropa.pesajeCamion?.choferDni || '-'}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">N Cert. Lavado:</span>
                      <span className="ml-2 font-medium">{tropa.pesajeCamion?.certificadoLavado || '-'}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">DTA:</span>
                      <span className="ml-2 font-medium">{tropa.dte || '-'}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">N Guia:</span>
                      <span className="ml-2 font-medium">{tropa.guia || '-'}</span>
                    </div>
                    <div>
                      <span className="text-stone-500">Fecha Guia:</span>
                      <span className="ml-2 font-medium">{tropa.pesajeCamion?.fechaGuia || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Referencias de tipos */}
          <Card className="border-0 shadow-md">
            <CardHeader className="bg-amber-50 rounded-t-lg py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-600" />
                Referencias - Tipo de Animal
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="flex flex-wrap gap-3">
                {TIPOS_BOVINO.map(tipo => {
                  const count = tropa.animales.filter(a => a.tipoAnimal === tipo.code).length
                  return (
                    <Badge
                      key={tipo.code}
                      variant={count > 0 ? 'default' : 'outline'}
                      className={count > 0 ? 'bg-amber-500 hover:bg-amber-600' : 'text-stone-400'}
                    >
                      {tipo.abbr} = {tipo.label} ({count})
                    </Badge>
                  )
                })}
                <Badge variant="outline" className="text-stone-600 border-stone-400">
                  MEJ = Macho con mas de 2 dientes incisivos
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* KPI Resumen */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-0 shadow-md bg-amber-50 border-amber-200">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-amber-600">Total Animales</p>
                <p className="text-2xl font-bold text-amber-800">{tropa.cantidadCabezas}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md bg-blue-50 border-blue-200">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-blue-600">Peso Total</p>
                <p className="text-2xl font-bold text-blue-800">
                  {tropa.animales.reduce((s, a) => s + (a.pesoVivo || 0), 0).toLocaleString('es-AR')} kg
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md bg-green-50 border-green-200">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-green-600">Peso Promedio</p>
                <p className="text-2xl font-bold text-green-800">
                  {tropa.animales.length > 0
                    ? (tropa.animales.reduce((s, a) => s + (a.pesoVivo || 0), 0) / tropa.animales.length).toFixed(0)
                    : '0'} kg
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md bg-purple-50 border-purple-200">
              <CardContent className="p-3 text-center">
                <p className="text-xs text-purple-600">Tipos</p>
                <p className="text-2xl font-bold text-purple-800">
                  {new Set(tropa.animales.map(a => a.tipoAnimal)).size}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabla de animales */}
          <Card className="border-0 shadow-md">
            <CardHeader className="bg-stone-50 rounded-t-lg">
              <CardTitle className="text-lg flex items-center gap-2">
                <Beef className="w-5 h-5 text-amber-600" />
                Detalle de Animales
              </CardTitle>
              <CardDescription>{tropa.animales.length} animales registrados</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-stone-100">
                      <TableHead className="w-12 text-center">N</TableHead>
                      <TableHead className="w-28">Tipo Animal</TableHead>
                      <TableHead className="w-24">Raza</TableHead>
                      <TableHead className="w-28 text-right">Peso Entrada (kg)</TableHead>
                      <TableHead className="w-28">N Caravana</TableHead>
                      <TableHead className="w-24">N Corral</TableHead>
                      <TableHead>Observacion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tropa.animales.map((animal, idx) => (
                      <TableRow key={animal.id} className="hover:bg-stone-50">
                        <TableCell className="text-center font-mono">{idx + 1}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              animal.tipoAnimal === 'NO' ? 'border-blue-300 text-blue-700 bg-blue-50' :
                              animal.tipoAnimal === 'VQ' ? 'border-pink-300 text-pink-700 bg-pink-50' :
                              animal.tipoAnimal === 'NT' ? 'border-cyan-300 text-cyan-700 bg-cyan-50' :
                              animal.tipoAnimal === 'VA' ? 'border-orange-300 text-orange-700 bg-orange-50' :
                              animal.tipoAnimal === 'TO' ? 'border-red-300 text-red-700 bg-red-50' :
                              animal.tipoAnimal === 'MEJ' ? 'border-purple-300 text-purple-700 bg-purple-50' :
                              'border-stone-300 text-stone-700'
                            }
                          >
                            {getTipoAnimalAbbr(animal.tipoAnimal)} - {getTipoAnimalLabel(animal.tipoAnimal)}
                          </Badge>
                        </TableCell>
                        <TableCell>{animal.raza || '-'}</TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {animal.pesoVivo ? animal.pesoVivo.toLocaleString('es-AR') : '-'}
                        </TableCell>
                        <TableCell className="font-mono">{animal.caravana || '-'}</TableCell>
                        <TableCell>{animal.corralId || tropa.corral?.nombre || '-'}</TableCell>
                        <TableCell className="text-stone-500 text-sm">{animal.observaciones || '-'}</TableCell>
                      </TableRow>
                    ))}
                    {/* Filas vacías para completar el formato */}
                    {tropa.animales.length < 54 && Array.from({ length: Math.min(10, 54 - tropa.animales.length) }).map((_, idx) => (
                      <TableRow key={`empty-${idx}`} className="opacity-30">
                        <TableCell className="text-center font-mono">{tropa.animales.length + idx + 1}</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>-</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Resumen por tipo */}
          <Card className="border-0 shadow-md">
            <CardHeader className="bg-stone-50 rounded-t-lg">
              <CardTitle className="text-sm">Resumen por Tipo de Animal</CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {TIPOS_BOVINO.map(tipo => {
                  const animalesTipo = tropa.animales.filter(a => a.tipoAnimal === tipo.code)
                  const count = animalesTipo.length
                  const pesoTotal = animalesTipo.reduce((s, a) => s + (a.pesoVivo || 0), 0)
                  const pesoProm = count > 0 ? pesoTotal / count : 0
                  return (
                    <div key={tipo.code} className={`rounded-lg p-3 text-center ${count > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-stone-50 border border-stone-200'}`}>
                      <p className="text-xs font-bold text-stone-500">{tipo.abbr}</p>
                      <p className="text-xs text-stone-400">{tipo.label}</p>
                      <p className={`text-lg font-bold ${count > 0 ? 'text-amber-700' : 'text-stone-300'}`}>{count}</p>
                      {count > 0 && (
                        <p className="text-xs text-stone-500">{pesoTotal.toFixed(0)} kg</p>
                      )}
                      {count > 0 && (
                        <p className="text-xs text-stone-400">Prom: {pesoProm.toFixed(0)} kg</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Dialog de Pesaje de Camión */}
      <Dialog open={pesajeDialogOpen} onOpenChange={setPesajeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Scale className="w-5 h-5 text-blue-600" />
              Pesaje de Camión
              {tropa?.pesajeCamion?.numeroTicket && (
                <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 border-blue-200">
                  Ticket #{tropa.pesajeCamion.numeroTicket}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {tropa?.pesajeCamion && (
            <div className="space-y-4 mt-2">
              {/* Estado y Tipo */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={
                  tropa.pesajeCamion.estado === 'CERRADO' ? 'bg-green-100 text-green-700 border-green-300' :
                  tropa.pesajeCamion.estado === 'ANULADO' ? 'bg-red-100 text-red-700 border-red-300' :
                  'bg-amber-100 text-amber-700 border-amber-300'
                } variant="outline">
                  <ClipboardCheck className="w-3 h-3 mr-1" />
                  {tropa.pesajeCamion.estado || '-'}
                </Badge>
                {tropa.pesajeCamion.fecha && (
                  <span className="text-xs text-stone-400 flex items-center gap-1 ml-auto">
                    <Clock className="w-3 h-3" />
                    {new Date(tropa.pesajeCamion.fecha).toLocaleString('es-AR')}
                  </span>
                )}
              </div>

              {/* Datos del Transporte */}
              <div className="grid grid-cols-2 gap-3 text-sm border rounded-lg p-3 bg-stone-50">
                <div>
                  <span className="text-stone-500 text-xs">Transportista</span>
                  <p className="font-medium">{tropa.pesajeCamion.transportista?.nombre || '-'}</p>
                  <p className="text-xs text-stone-400">{tropa.pesajeCamion.transportista?.cuit || ''}</p>
                </div>
                <div>
                  <span className="text-stone-500 text-xs">Chofer</span>
                  <p className="font-medium">{tropa.pesajeCamion.choferNombre || '-'}</p>
                  <p className="text-xs text-stone-400">DNI: {tropa.pesajeCamion.choferDni || '-'}</p>
                </div>
              </div>

              {/* Patentes */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="border rounded-lg p-3">
                  <span className="text-stone-500 text-xs">Patente Chasis</span>
                  <p className="font-medium font-mono">{tropa.pesajeCamion.patenteChasis || '-'}</p>
                </div>
                <div className="border rounded-lg p-3">
                  <span className="text-stone-500 text-xs">Patente Acoplado</span>
                  <p className="font-medium font-mono">{tropa.pesajeCamion.patenteAcoplado || '-'}</p>
                </div>
              </div>

              {/* Pesos */}
              <div className="grid grid-cols-3 gap-3">
                <div className="border rounded-lg p-3 text-center bg-blue-50">
                  <p className="text-xs text-blue-600 font-medium">Peso Bruto</p>
                  <p className="text-lg font-bold text-blue-800">
                    {tropa.pesajeCamion.pesoBruto ? tropa.pesajeCamion.pesoBruto.toFixed(0) : 'S/D'}
                    <span className="text-xs font-normal ml-1">kg</span>
                  </p>
                </div>
                <div className="border rounded-lg p-3 text-center bg-amber-50">
                  <p className="text-xs text-amber-600 font-medium">Peso Tara</p>
                  <p className="text-lg font-bold text-amber-800">
                    {tropa.pesajeCamion.pesoTara ? tropa.pesajeCamion.pesoTara.toFixed(0) : 'S/D'}
                    <span className="text-xs font-normal ml-1">kg</span>
                  </p>
                </div>
                <div className="border rounded-lg p-3 text-center bg-emerald-50">
                  <p className="text-xs text-emerald-600 font-medium">Peso Neto</p>
                  <p className="text-lg font-bold text-emerald-800">
                    {tropa.pesajeCamion.pesoNeto ? tropa.pesajeCamion.pesoNeto.toFixed(0) : 'S/D'}
                    <span className="text-xs font-normal ml-1">kg</span>
                  </p>
                </div>
              </div>

              {/* Ticket Compartido */}
              {tropa.ticketCompartidoCon && tropa.ticketCompartidoCon.length > 0 && (
                <div className="border border-amber-200 rounded-lg p-3 bg-amber-50">
                  <p className="text-xs font-medium text-amber-700 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" />
                    Ticket compartido con:
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {tropa.ticketCompartidoCon.map(t => (
                      <Badge key={t.numero} variant="outline" className="bg-white text-amber-700 border-amber-300 text-xs">
                        Tropa {t.numero} ({t.codigo})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Observaciones */}
              {tropa.pesajeCamion.observaciones && (
                <div className="border border-stone-200 rounded-lg p-3 bg-stone-50">
                  <p className="text-xs font-medium text-stone-600 mb-1">Observaciones del Pesaje</p>
                  <p className="text-sm text-stone-700">{tropa.pesajeCamion.observaciones}</p>
                </div>
              )}

              {/* Acceso directo */}
              <div className="flex justify-end pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={() => {
                    setPesajeDialogOpen(false)
                    window.open('/pesaje-camiones', '_blank')
                  }}
                >
                  <ExternalLink className="w-4 h-4 mr-1.5" />
                  Ir a Pesaje de Camiones
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ReportePlanilla01Bovino
