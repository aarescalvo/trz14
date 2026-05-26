'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  FileText, Download, Search, Loader2, Truck, User, Building2,
  Eye, FileSpreadsheet, FileDown, Scale, ArrowLeftRight, TrendingUp, TrendingDown
} from 'lucide-react'
import { TextoEditable, EditableBlock, useEditor } from '@/components/ui/editable-screen'

interface Operador { id: string; nombre: string; rol: string }

interface Tropa {
  id: string
  numero: number
  codigo: string
  cantidadCabezas: number
  especie: string
  dte: string
  guia: string
  fechaRecepcion: string
  observaciones?: string
  corral?: { nombre: string }
  productor?: { nombre: string; cuit: string }
  usuarioFaena: { nombre: string; cuit: string }
  pesajeCamion?: {
    patenteChasis: string
    patenteAcoplado?: string
    choferNombre?: string
    choferDni?: string
    transportista?: { nombre: string; cuit: string }
    precintos?: string
    pesoBruto?: number | null
    pesoTara?: number | null
    pesoNeto?: number | null
    numeroTicket?: number
  }
  animales: Array<{
    id: string
    numero: number
    tipoAnimal: string
    caravana?: string
    pesoVivo?: number | null
    raza?: string
    pesajeIndividual?: { peso: number; fecha: string } | null
  }>
}

interface Props { operador: Operador }

const TIPOS_ANIMAL_LABELS: Record<string, string> = {
  'TO': 'TORO', 'VA': 'VACA', 'VQ': 'VAQUILLONA', 'MEJ': 'MEJ', 'NO': 'NOVILLO', 'NT': 'NOVILLITO',
}

export function Planilla01Module({ operador }: Props) {
  const { editMode, getTexto } = useEditor()
  const [tropas, setTropas] = useState<Tropa[]>([])
  const [tropaSeleccionada, setTropaSeleccionada] = useState<Tropa | null>(null)
  const [loading, setLoading] = useState(true)
  const [buscando, setBuscando] = useState(false)
  const [generando, setGenerando] = useState<'excel' | 'pdf' | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [mostrarTodas, setMostrarTodas] = useState(false)

  useEffect(() => { fetchTropas('') }, [])

  const fetchTropas = async (termino: string) => {
    if (termino) setBuscando(true)
    else setLoading(true)
    try {
      const params = new URLSearchParams()
      if (termino) params.set('busqueda', termino)
      const url = `/api/tropas${params.toString() ? '?' + params.toString() : ''}`
      const res = await fetch(url)
      const data = await res.json()
      if (data.success) {
        setTropas(data.data || [])
        setMostrarTodas(false)
        if (!data.data?.length) {
          toast.info(termino ? `No se encontraron tropas para "${termino}"` : 'No hay tropas cargadas. Ejecutá el seed primero.')
        }
      } else {
        console.error('API Error:', data.error)
        toast.error(`Error: ${data.error || 'Sin respuesta del servidor'}`)
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error de conexión al cargar tropas')
    } finally {
      setLoading(false)
      setBuscando(false)
    }
  }

  const handleBuscar = () => {
    if (busqueda.trim()) {
      fetchTropas(busqueda.trim())
    } else {
      fetchTropas('')
    }
  }

  const handleVerTodas = () => {
    setBusqueda('')
    fetchTropas('')
    setMostrarTodas(true)
  }

  const handleSeleccionarTropa = async (tropaId: string) => {
    try {
      const res = await fetch(`/api/tropas/${tropaId}`)
      const data = await res.json()
      if (data.success) setTropaSeleccionada(data.data)
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar tropa')
    }
  }

  // ===== CÁLCULOS DE PESAJE =====
  const getKgNetosCamion = (): number | null => {
    return tropaSeleccionada?.pesajeCamion?.pesoNeto ?? null
  }

  const getKgNetosIndividuales = (): number => {
    if (!tropaSeleccionada?.animales) return 0
    return tropaSeleccionada.animales.reduce((sum, a) => {
      return sum + (a.pesajeIndividual?.peso || a.pesoVivo || 0)
    }, 0)
  }

  const getDiferencia = (): number | null => {
    const camion = getKgNetosCamion()
    const indiv = getKgNetosIndividuales()
    if (camion === null) return null
    return camion - indiv
  }

  const handleGenerarExcel = async () => {
    if (!tropaSeleccionada) return
    setGenerando('excel')
    try {
      const res = await fetch('/api/planilla01', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tropaId: tropaSeleccionada.id })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Error al generar Excel')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Planilla01_${tropaSeleccionada.codigo?.replace(/\s/g, '_') || tropaSeleccionada.id}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Excel generado correctamente')
    } catch (error) {
      console.error('Error:', error)
      toast.error(error instanceof Error ? error.message : 'Error al generar Excel')
    } finally {
      setGenerando(null)
    }
  }

  const handleGenerarPDF = async () => {
    if (!tropaSeleccionada) return
    setGenerando('pdf')
    try {
      const doc = new jsPDF('landscape', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      // Cálculos
      const kgNetosCamion = getKgNetosCamion()
      const kgNetosIndividuales = getKgNetosIndividuales()
      const diferenciaKg = getDiferencia()

      // Título principal
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('PLANILLA 01 - BOVINO', 10, 12)

      // Tropa N° GRANDE a la derecha
      doc.setFontSize(20)
      doc.text(`TROPA N° ${tropaSeleccionada.numero}`, pageWidth - 10, 12, { align: 'right' })

      // Datos del establecimiento
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('ESTABLECIMIENTO: SOLEMAR ALIMENTARIA S.A.', 10, 20)
      doc.setFont('helvetica', 'normal')
      doc.text(`N° SENASA: 3986`, 90, 20)
      doc.text(`MATRÍCULA: 300`, 140, 20)

      // Semana y fecha
      const getSemana = (fecha: string) => {
        const d = new Date(fecha)
        const start = new Date(d.getFullYear(), 0, 1)
        return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
      }

      doc.text(`SEMANA N°: ${getSemana(tropaSeleccionada.fechaRecepcion)}`, 185, 20)
      doc.text(`FECHA: ${new Date(tropaSeleccionada.fechaRecepcion).toLocaleDateString('es-AR')}`, 235, 20)
      doc.text(`HORA: ${new Date(tropaSeleccionada.fechaRecepcion).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`, 275, 20)

      // Línea separadora
      doc.setDrawColor(0)
      doc.setLineWidth(0.5)
      doc.line(10, 22, pageWidth - 10, 22)

      // Datos productor/usuario faena
      let y = 27
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('PRODUCTOR:', 10, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropaSeleccionada.usuarioFaena?.nombre || tropaSeleccionada.productor?.nombre || '-', 30, y)
      doc.setFont('helvetica', 'bold')
      doc.text('CUIT:', 130, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropaSeleccionada.usuarioFaena?.cuit || tropaSeleccionada.productor?.cuit || '-', 142, y)
      doc.setFont('helvetica', 'bold')
      doc.text('TROPA N°:', 180, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropaSeleccionada.codigo || '-', 200, y)
      doc.setFont('helvetica', 'bold')
      doc.text('CABEZAS:', 240, y)
      doc.setFont('helvetica', 'normal')
      doc.text(String(tropaSeleccionada.cantidadCabezas), 265, y)

      y += 5
      doc.setFont('helvetica', 'bold')
      doc.text('TRANSPORTE:', 10, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropaSeleccionada.pesajeCamion?.transportista?.nombre || '-', 30, y)
      doc.setFont('helvetica', 'bold')
      doc.text('CHOFER:', 130, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropaSeleccionada.pesajeCamion?.choferNombre || '-', 142, y)
      doc.setFont('helvetica', 'bold')
      doc.text('DNI:', 200, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropaSeleccionada.pesajeCamion?.choferDni || '-', 210, y)

      y += 5
      doc.setFont('helvetica', 'bold')
      doc.text('PATENTE CHASIS:', 10, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropaSeleccionada.pesajeCamion?.patenteChasis || '-', 38, y)
      doc.setFont('helvetica', 'bold')
      doc.text('ACOPLADO:', 70, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropaSeleccionada.pesajeCamion?.patenteAcoplado || '-', 90, y)
      doc.setFont('helvetica', 'bold')
      doc.text('PRECINTOS:', 130, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropaSeleccionada.pesajeCamion?.precintos || '-', 148, y)
      doc.setFont('helvetica', 'bold')
      doc.text('DTE:', 200, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropaSeleccionada.dte || '-', 212, y)
      doc.setFont('helvetica', 'bold')
      doc.text('GUÍA:', 240, y)
      doc.setFont('helvetica', 'normal')
      doc.text(tropaSeleccionada.guia || '-', 254, y)

      y += 6
      doc.line(10, y, pageWidth - 10, y)
      y += 2

      // ===== COMPARATIVO DE PESAJE (fila horizontal compacta) =====
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('PESAJE:', 10, y + 4)

      // Bruto
      doc.setFontSize(7)
      doc.text('Bruto:', 32, y + 2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(tropaSeleccionada.pesajeCamion?.pesoBruto ? tropaSeleccionada.pesajeCamion.pesoBruto.toFixed(1) : '-', 42, y + 2)
      // Tara
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.text('Tara:', 70, y + 2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(tropaSeleccionada.pesajeCamion?.pesoTara ? tropaSeleccionada.pesajeCamion.pesoTara.toFixed(1) : '-', 78, y + 2)
      // Neto Camión
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(0, 0, 150)
      doc.text('NETO CAMIÓN:', 108, y + 2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.text(kgNetosCamion !== null ? kgNetosCamion.toFixed(1) + ' kg' : 'S/D', 135, y + 2)
      doc.setTextColor(0, 0, 0)
      // Neto Individuales
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(0, 100, 0)
      doc.text('NETO INDIV.:', 175, y + 2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.text(kgNetosIndividuales.toFixed(1) + ' kg', 205, y + 2)
      doc.setTextColor(0, 0, 0)
      // Diferencia
      if (diferenciaKg !== null) {
        const esPositivo = diferenciaKg >= 0
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        doc.setTextColor(esPositivo ? 150 : 200, 0, 0)
        doc.text('DIFERENCIA:', 240, y + 2)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(11)
        doc.text((esPositivo ? '+' : '') + diferenciaKg.toFixed(1) + ' kg', 267, y + 2)
        doc.setTextColor(0, 0, 0)
      }

      y += 8

      // Tabla de animales
      const animalesData = (tropaSeleccionada.animales || []).map((a, idx) => [
        idx + 1,
        a.caravana || '-',
        TIPOS_ANIMAL_LABELS[a.tipoAnimal] || a.tipoAnimal || '-',
        a.raza || '-',
        a.pesajeIndividual?.peso?.toFixed(1) || a.pesoVivo?.toFixed(1) || '-',
        ''
      ])

      autoTable(doc, {
        startY: y,
        head: [['N°', 'CARAVANA', 'TIPO', 'RAZA', 'PESO (kg)', 'OBSERVACIONES']],
        body: animalesData,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 35, halign: 'center' },
          2: { cellWidth: 25, halign: 'center' },
          3: { cellWidth: 35, halign: 'center' },
          4: { cellWidth: 25, halign: 'right' },
          5: { cellWidth: 50 }
        },
        foot: [
          [
            { content: `TOTAL: ${tropaSeleccionada.animales?.length || 0} cabezas`, colSpan: 2, styles: { fontStyle: 'bold' } },
            { content: '', colSpan: 1 },
            { content: 'SUMA KG:', colSpan: 1, styles: { fontStyle: 'bold', halign: 'right' } },
            { content: kgNetosIndividuales.toFixed(1), styles: { fontStyle: 'bold', halign: 'right' } },
            { content: diferenciaKg !== null ? `Diff: ${diferenciaKg >= 0 ? '+' : ''}${diferenciaKg.toFixed(1)}` : '', styles: { fontStyle: 'bold', halign: 'center', textColor: diferenciaKg !== null && diferenciaKg < 0 ? [180, 0, 0] : [0, 100, 0] } }
          ]
        ],
        footStyles: { fillColor: [245, 245, 245] }
      })

      // Firmas
      const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15
      if (finalY < pageHeight - 25) {
        doc.setFontSize(8)
        doc.text('_________________________', 50, finalY)
        doc.text('_________________________', 170, finalY)
        doc.setFontSize(7)
        doc.text('FIRMA RESPONSABLE INGRESO', 35, finalY + 5)
        doc.text('FIRMA TRANSPORTISTA', 155, finalY + 5)
      }

      // Pie de página
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.text(
          `Página ${i} de ${pageCount}`,
          pageWidth / 2,
          pageHeight - 5,
          { align: 'center' }
        )
      }

      doc.save(`Planilla01_${tropaSeleccionada.codigo?.replace(/\s/g, '_') || tropaSeleccionada.id}.pdf`)
      toast.success('PDF generado correctamente')
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al generar PDF')
    } finally {
      setGenerando(null)
    }
  }

  const getSemana = (fecha: string) => {
    const d = new Date(fecha)
    const start = new Date(d.getFullYear(), 0, 1)
    return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
  }

  // ===== CÁLCULOS PARA KPI CARDS =====
  const kgNetosCamion = getKgNetosCamion()
  const kgNetosIndividuales = getKgNetosIndividuales()
  const diferenciaKg = getDiferencia()

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-3 md:p-5">
      <div className="w-full space-y-5">
        <EditableBlock bloqueId="header" label="Encabezado">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-stone-800 flex items-center gap-2">
                <FileText className="w-8 h-8 text-amber-500" />
                <TextoEditable id="planilla01-titulo" original="Planilla 01 - Registro de Ingreso" tag="span" />
              </h1>
              <p className="text-stone-500 mt-1">
                <TextoEditable id="planilla01-subtitulo" original="Planilla SENASA para registro de ingreso de hacienda" tag="span" />
              </p>
            </div>
            {tropaSeleccionada && (
              <div className="flex gap-2">
                <Button onClick={handleGenerarExcel} disabled={generando !== null} className="bg-emerald-600 hover:bg-emerald-700">
                  {generando === 'excel' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
                  <TextoEditable id="btn-excel" original="Excel" tag="span" />
                </Button>
                <Button onClick={handleGenerarPDF} disabled={generando !== null} className="bg-red-600 hover:bg-red-700">
                  {generando === 'pdf' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
                  <TextoEditable id="btn-pdf" original="PDF" tag="span" />
                </Button>
              </div>
            )}
          </div>
        </EditableBlock>

        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5">
          {/* ===== LISTA DE TROPAS ===== */}
          <EditableBlock bloqueId="lista-tropas" label="Lista de Tropas">
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-stone-50 pb-3">
                <CardTitle className="text-lg">
                  <TextoEditable id="planilla01-seleccionar-tropa" original="Seleccionar Tropa" tag="span" />
                </CardTitle>
                <div className="flex gap-2 mt-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <Input
                      placeholder="Código, productor, CUIT..."
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      className="pl-9"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleBuscar() }}
                    />
                  </div>
                  <Button onClick={handleBuscar} disabled={buscando} className="bg-amber-600 hover:bg-amber-700 shrink-0">
                    {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <TextoEditable id="planilla01-btn-buscar" original="Buscar" tag="span" />
                  </Button>
                </div>
                {busqueda && !mostrarTodas && (
                  <button
                    onClick={handleVerTodas}
                    className="text-xs text-amber-600 hover:text-amber-800 mt-1 underline"
                  >
                    Ver todas las tropas
                  </button>
                )}
              </CardHeader>
              <CardContent className="p-0 max-h-[calc(100vh-320px)] overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-500" /></div>
                ) : tropas.length === 0 ? (
                  <div className="p-8 text-center text-stone-400">
                    <TextoEditable id="planilla01-no-hay-tropas" original="No hay tropas" tag="span" />
                  </div>
                ) : (
                  <div className="divide-y">
                    {tropas.map((tropa) => (
                      <button key={tropa.id} onClick={() => handleSeleccionarTropa(tropa.id)}
                        className={`w-full p-3 text-left hover:bg-stone-50 transition-colors ${tropaSeleccionada?.id === tropa.id ? 'bg-amber-50 border-l-4 border-amber-500' : ''}`}>
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-stone-800 truncate">{tropa.codigo}</p>
                            <p className="text-sm text-stone-500 truncate">{tropa.usuarioFaena?.nombre || tropa.productor?.nombre}</p>
                          </div>
                          <div className="text-right ml-2 shrink-0">
                            <Badge variant="outline">{tropa.cantidadCabezas} cab.</Badge>
                            <p className="text-xs text-stone-400 mt-1">{new Date(tropa.fechaRecepcion).toLocaleDateString('es-AR')}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </EditableBlock>

          {/* ===== VISTA PREVIA ===== */}
          <EditableBlock bloqueId="vista-previa" label="Vista Previa">
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-stone-50 pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  <TextoEditable id="planilla01-vista-previa" original="Vista Previa" tag="span" />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                {!tropaSeleccionada ? (
                  <div className="text-center py-16 text-stone-400">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>
                      <TextoEditable id="planilla01-seleccione-tropa" original="Seleccione una tropa para ver la planilla" tag="span" />
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Encabezado + Tropa grande + Badge */}
                    <div className="border-2 border-stone-300 rounded-lg p-3 bg-white">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-amber-500" />
                          <span className="font-semibold text-sm">Solemar Alimentaria S.A.</span>
                          <span className="text-stone-400 text-xs">| N° SENASA: 3986 | Matrícula: 300</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-stone-500 text-xs">
                            <TextoEditable id="planilla01-semana-label" original="Semana N°:" tag="span" /> {getSemana(tropaSeleccionada.fechaRecepcion)}
                          </span>
                          <Badge className="bg-amber-100 text-amber-800 text-xs px-3 py-0.5">
                            <TextoEditable id="planilla01-badge" original="PLANILLA 01 - BOVINO" tag="span" />
                          </Badge>
                        </div>
                      </div>
                      {/* Tropa N° grande */}
                      <div className="mt-1 pt-1 border-t border-stone-200">
                        <span className="text-2xl font-bold text-amber-700">TROPA N° {tropaSeleccionada.numero}</span>
                        {tropaSeleccionada.pesajeCamion?.numeroTicket && (
                          <span className="text-sm text-stone-400 ml-4">Ticket Pesada: {tropaSeleccionada.pesajeCamion.numeroTicket}</span>
                        )}
                      </div>
                    </div>

                    {/* ===== KPI CARDS DE PESAJE ===== */}
                    <div className="grid grid-cols-3 gap-3">
                      {/* Kg Netos Camión */}
                      <div className={`rounded-lg p-3 border ${kgNetosCamion !== null ? 'bg-blue-50 border-blue-200' : 'bg-stone-50 border-stone-200'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Truck className="w-4 h-4 text-blue-600" />
                          <span className="text-xs font-semibold text-stone-600 uppercase">Kg Netos Camión</span>
                        </div>
                        <p className={`text-xl font-bold ${kgNetosCamion !== null ? 'text-blue-700' : 'text-stone-400'}`}>
                          {kgNetosCamion !== null ? `${kgNetosCamion.toFixed(1)}` : 'S/D'}
                        </p>
                        <p className="text-xs text-stone-500 mt-0.5">kg</p>
                        {kgNetosCamion !== null && tropaSeleccionada.pesajeCamion && (
                          <p className="text-[10px] text-stone-400 mt-1">
                            B: {tropaSeleccionada.pesajeCamion.pesoBruto?.toFixed(1) || '-'} / T: {tropaSeleccionada.pesajeCamion.pesoTara?.toFixed(1) || '-'}{tropaSeleccionada.pesajeCamion.numeroTicket ? ` | Ticket: ${tropaSeleccionada.pesajeCamion.numeroTicket}` : ''}
                          </p>
                        )}
                      </div>

                      {/* Kg Netos Individuales */}
                      <div className="rounded-lg p-3 border bg-green-50 border-green-200">
                        <div className="flex items-center gap-2 mb-1">
                          <Scale className="w-4 h-4 text-green-600" />
                          <span className="text-xs font-semibold text-stone-600 uppercase">Kg Individuales</span>
                        </div>
                        <p className="text-xl font-bold text-green-700">{kgNetosIndividuales.toFixed(1)}</p>
                        <p className="text-xs text-stone-500 mt-0.5">kg (suma {tropaSeleccionada.animales?.filter(a => (a.pesajeIndividual?.peso || a.pesoVivo || 0) > 0).length || 0} animales)</p>
                      </div>

                      {/* Diferencia */}
                      {diferenciaKg !== null ? (
                        <div className={`rounded-lg p-3 border ${diferenciaKg >= 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            {diferenciaKg >= 0 ? <TrendingUp className="w-4 h-4 text-yellow-600" /> : <TrendingDown className="w-4 h-4 text-red-600" />}
                            <span className="text-xs font-semibold text-stone-600 uppercase">Diferencia</span>
                          </div>
                          <p className={`text-xl font-bold ${diferenciaKg >= 0 ? 'text-yellow-700' : 'text-red-700'}`}>
                            {diferenciaKg >= 0 ? '+' : ''}{diferenciaKg.toFixed(1)}
                          </p>
                          <p className="text-xs text-stone-500 mt-0.5">kg (camión - individuales)</p>
                        </div>
                      ) : (
                        <div className="rounded-lg p-3 border bg-stone-50 border-stone-200">
                          <div className="flex items-center gap-2 mb-1">
                            <ArrowLeftRight className="w-4 h-4 text-stone-400" />
                            <span className="text-xs font-semibold text-stone-600 uppercase">Diferencia</span>
                          </div>
                          <p className="text-xl font-bold text-stone-400">N/D</p>
                          <p className="text-xs text-stone-400 mt-0.5">Sin pesaje de camión</p>
                        </div>
                      )}
                    </div>

                    {/* Datos en 4 columnas */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="border rounded-lg p-3 bg-white space-y-1">
                        <h4 className="font-semibold text-stone-700 flex items-center gap-1.5 text-sm">
                          <User className="w-3.5 h-3.5 text-amber-500" />
                          <TextoEditable id="planilla01-productor-title" original="Productor" tag="span" />
                        </h4>
                        <p className="text-xs text-stone-600 truncate">{tropaSeleccionada.productor?.nombre || '-'}</p>
                        <p className="text-xs text-stone-500">CUIT: {tropaSeleccionada.productor?.cuit || '-'}</p>
                      </div>
                      <div className="border rounded-lg p-3 bg-white space-y-1">
                        <h4 className="font-semibold text-stone-700 flex items-center gap-1.5 text-sm">
                          <User className="w-3.5 h-3.5 text-amber-500" />
                          <TextoEditable id="planilla01-usuario-title" original="Usuario Faena" tag="span" />
                        </h4>
                        <p className="text-xs text-stone-600 truncate">{tropaSeleccionada.usuarioFaena?.nombre || '-'}</p>
                        <p className="text-xs text-stone-500">CUIT: {tropaSeleccionada.usuarioFaena?.cuit || '-'}</p>
                      </div>
                      <div className="border rounded-lg p-3 bg-white space-y-1">
                        <h4 className="font-semibold text-stone-700 flex items-center gap-1.5 text-sm">
                          <Truck className="w-3.5 h-3.5 text-amber-500" />
                          <TextoEditable id="planilla01-transporte-title" original="Transporte" tag="span" />
                        </h4>
                        <p className="text-xs text-stone-600 truncate">{tropaSeleccionada.pesajeCamion?.transportista?.nombre || '-'}</p>
                        <p className="text-xs text-stone-500">{tropaSeleccionada.pesajeCamion?.patenteChasis || '-'}{tropaSeleccionada.pesajeCamion?.patenteAcoplado ? ` / ${tropaSeleccionada.pesajeCamion.patenteAcoplado}` : ''}</p>
                      </div>
                      <div className="border rounded-lg p-3 bg-white space-y-1">
                        <h4 className="font-semibold text-stone-700 flex items-center gap-1.5 text-sm">
                          <FileText className="w-3.5 h-3.5 text-amber-500" />
                          <TextoEditable id="planilla01-documentos-title" original="Documentos" tag="span" />
                        </h4>
                        <p className="text-xs text-stone-600">DTE: {tropaSeleccionada.dte || '-'}</p>
                        <p className="text-xs text-stone-500">Guía: {tropaSeleccionada.guia || '-'}</p>
                      </div>
                    </div>

                    {/* Tabla de animales */}
                    <div className="border rounded-lg overflow-hidden bg-white">
                      <div className="bg-stone-100 px-4 py-2 border-b flex items-center justify-between">
                        <h4 className="font-semibold text-stone-700 text-sm">
                          <TextoEditable id="planilla01-detalle-animales" original="Detalle de Animales" tag="span" /> ({tropaSeleccionada.animales?.length || 0})
                        </h4>
                        <span className="text-xs text-stone-500">
                          Total: {kgNetosIndividuales.toFixed(1)} kg
                          {diferenciaKg !== null && (
                            <span className={`ml-3 font-semibold ${diferenciaKg >= 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                              Diff: {diferenciaKg >= 0 ? '+' : ''}{diferenciaKg.toFixed(1)} kg
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-stone-50">
                              <TableHead className="w-14 text-center text-xs">N°</TableHead>
                              <TableHead className="text-center text-xs">Tipo</TableHead>
                              <TableHead className="text-xs">Raza</TableHead>
                              <TableHead className="text-xs">Caravana</TableHead>
                              <TableHead className="text-right text-xs">Peso (kg)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tropaSeleccionada.animales?.map((animal, idx) => (
                              <TableRow key={animal.id}>
                                <TableCell className="text-center font-medium text-xs">{animal.numero || idx + 1}</TableCell>
                                <TableCell className="text-center"><Badge variant="outline" className="text-xs">{TIPOS_ANIMAL_LABELS[animal.tipoAnimal] || animal.tipoAnimal}</Badge></TableCell>
                                <TableCell className="text-xs">{animal.raza || '-'}</TableCell>
                                <TableCell className="font-mono text-xs">{animal.caravana || '-'}</TableCell>
                                <TableCell className="text-right font-mono text-xs">{(animal.pesajeIndividual?.peso || animal.pesoVivo)?.toFixed(1) || '-'}</TableCell>
                              </TableRow>
                            ))}
                            {(!tropaSeleccionada.animales || tropaSeleccionada.animales.length === 0) && (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-6 text-stone-400 text-sm">Sin animales cargados</TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </EditableBlock>
        </div>
      </div>
    </div>
  )
}

export default Planilla01Module
