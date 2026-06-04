'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Calendar, Download, BarChart3, Loader2, FileSpreadsheet } from 'lucide-react'
import { exportReport } from '@/lib/reportes-api'
import { ExportButton } from '@/components/ui/export-button'
import { PDFExporter } from '@/lib/export-pdf'

interface PesajeData {
  id: string
  numeroTicket: string
  tipo: string
  estado: string
  patenteChasis: string
  patenteAcoplado: string | null
  choferNombre: string | null
  choferDni: string | null
  transportista: string | null
  pesoBruto: number | null
  pesoTara: number | null
  pesoNeto: number | null
  tropaCodigo: string | null
  destino: string | null
  remito: string | null
  fecha: string
  fechaTara: string | null
}

export function ReportePesajes() {
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [tipo, setTipo] = useState<string>('todas')
  const [estado, setEstado] = useState<string>('todas')
  const [datos, setDatos] = useState<PesajeData[]>([])
  const [resumen, setResumen] = useState({
    totalPesajes: 0,
    totalPesoNeto: 0,
    ingresosHacienda: 0,
    pesajesParticulares: 0,
    salidasMercaderia: 0,
    abiertos: 0,
    cerrados: 0
  })

  useEffect(() => {
    const today = new Date()
    const monthAgo = new Date(today)
    monthAgo.setMonth(monthAgo.getMonth() - 1)
    
    setFechaHasta(today.toISOString().split('T')[0])
    setFechaDesde(monthAgo.toISOString().split('T')[0])
  }, [])

  const handleBuscar = async () => {
    if (!fechaDesde || !fechaHasta) {
      toast.error('Seleccione un rango de fechas')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/reportes/pesajes?desde=${fechaDesde}&hasta=${fechaHasta}&tipo=${tipo}&estado=${estado}`)
      const data = await res.json()
      
      if (data.success) {
        setDatos(data.data)
        setResumen(data.resumen)
      } else {
        toast.error(data.error || 'Error al obtener datos')
      }
    } catch (error) {
      toast.error('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handleExportar = async () => {
    if (datos.length === 0) {
      toast.error('No hay datos para exportar')
      return
    }

    setExporting(true)
    try {
      const archivo = await exportReport({
        tipo: 'pesajes',
        datos: datos as unknown as Array<Record<string, unknown>>,
        resumen,
        fechaDesde,
        fechaHasta
      })

      window.open(archivo, '_blank')
      toast.success('Reporte exportado')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al exportar')
    } finally {
      setExporting(false)
    }
  }

  const handleExportarPDF = () => {
    if (datos.length === 0) {
      toast.error('No hay datos para exportar')
      return
    }

    const headers = ['Ticket', 'Tipo', 'Estado', 'Patente', 'Chofer', 'Transportista', 'P. Bruto', 'P. Tara', 'P. Neto', 'Tropa/Destino', 'Fecha']
    const rows = datos.map(d => [
      d.numeroTicket.toString(), d.tipo, d.estado,
      d.patenteChasis + (d.patenteAcoplado ? ' / ' + d.patenteAcoplado : ''),
      d.choferNombre || '-', d.transportista || '-',
      d.pesoBruto?.toFixed(0) || '-', d.pesoTara?.toFixed(0) || '-',
      d.pesoNeto?.toFixed(0) || '-',
      d.tropaCodigo || d.destino || '-', d.fecha
    ])
    const doc = PDFExporter.generateReport({
      title: 'Reporte de Pesajes',
      subtitle: `Período: ${fechaDesde} - ${fechaHasta}`,
      headers,
      data: rows,
      orientation: 'landscape',
    })
    PDFExporter.downloadPDF(doc, `reporte_pesajes_${fechaDesde}_${fechaHasta}.pdf`)
  }

  const getTipoBadge = (tipo: string) => {
    const config: Record<string, { color: string; label: string }> = {
      INGRESO_HACIENDA: { color: 'bg-green-100 text-green-700', label: 'Ingreso' },
      PESAJE_PARTICULAR: { color: 'bg-blue-100 text-blue-700', label: 'Particular' },
      SALIDA_MERCADERIA: { color: 'bg-amber-100 text-amber-700', label: 'Salida' }
    }
    const c = config[tipo] || { color: 'bg-gray-100 text-gray-700', label: tipo }
    return <Badge className={c.color}>{c.label}</Badge>
  }

  const getEstadoBadge = (estado: string) => {
    const config: Record<string, { color: string; label: string }> = {
      ABIERTO: { color: 'bg-amber-100 text-amber-700', label: 'Abierto' },
      CERRADO: { color: 'bg-green-100 text-green-700', label: 'Cerrado' },
      ANULADO: { color: 'bg-red-100 text-red-700', label: 'Anulado' }
    }
    const c = config[estado] || { color: 'bg-gray-100 text-gray-700', label: estado }
    return <Badge className={c.color}>{c.label}</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-stone-50 rounded-t-lg">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-600" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Fecha Desde</Label>
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha Hasta</Label>
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos</SelectItem>
                  <SelectItem value="INGRESO_HACIENDA">Ingreso Hacienda</SelectItem>
                  <SelectItem value="PESAJE_PARTICULAR">Pesaje Particular</SelectItem>
                  <SelectItem value="SALIDA_MERCADERIA">Salida Mercadería</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos</SelectItem>
                  <SelectItem value="ABIERTO">Abierto</SelectItem>
                  <SelectItem value="CERRADO">Cerrado</SelectItem>
                  <SelectItem value="ANULADO">Anulado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleBuscar} disabled={loading} className="bg-amber-500 hover:bg-amber-600">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                <span className="ml-2">Buscar</span>
              </Button>
              <ExportButton
                onExportExcel={handleExportar}
                onExportPDF={handleExportarPDF}
                onPrint={() => window.print()}
                disabled={exporting || datos.length === 0}
                size="default"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      {datos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-stone-500">Total Pesajes</p>
              <p className="text-2xl font-bold text-stone-800">{resumen.totalPesajes}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-stone-500">Peso Neto Total</p>
              <p className="text-2xl font-bold text-stone-800">{resumen.totalPesoNeto.toLocaleString()} kg</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-stone-500">Ingresos</p>
              <p className="text-2xl font-bold text-green-600">{resumen.ingresosHacienda}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-stone-500">Particulares</p>
              <p className="text-2xl font-bold text-blue-600">{resumen.pesajesParticulares}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-stone-500">Salidas</p>
              <p className="text-2xl font-bold text-amber-600">{resumen.salidasMercaderia}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-stone-500">Abiertos</p>
              <p className="text-2xl font-bold text-amber-600">{resumen.abiertos}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <p className="text-xs text-stone-500">Cerrados</p>
              <p className="text-2xl font-bold text-green-600">{resumen.cerrados}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabla */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-stone-50 rounded-t-lg">
          <CardTitle className="text-lg">Detalle de Pesajes</CardTitle>
          <CardDescription>
            {datos.length > 0 ? `${datos.length} pesajes encontrados` : 'Realice una búsqueda para ver datos'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {datos.length === 0 ? (
            <div className="p-8 text-center text-stone-400">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Seleccione un rango de fechas y presione Buscar</p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Patente</TableHead>
                    <TableHead>Chofer</TableHead>
                    <TableHead>Transportista</TableHead>
                    <TableHead className="text-right">P. Bruto</TableHead>
                    <TableHead className="text-right">P. Tara</TableHead>
                    <TableHead className="text-right">P. Neto</TableHead>
                    <TableHead>Tropa/Destino</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datos.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono font-medium">{row.numeroTicket}</TableCell>
                      <TableCell>{getTipoBadge(row.tipo)}</TableCell>
                      <TableCell>{getEstadoBadge(row.estado)}</TableCell>
                      <TableCell className="font-mono">
                        {row.patenteChasis}
                        {row.patenteAcoplado && ` / ${row.patenteAcoplado}`}
                      </TableCell>
                      <TableCell>{row.choferNombre || '-'}</TableCell>
                      <TableCell>{row.transportista || '-'}</TableCell>
                      <TableCell className="text-right">{row.pesoBruto?.toFixed(0) || '-'}</TableCell>
                      <TableCell className="text-right">{row.pesoTara?.toFixed(0) || '-'}</TableCell>
                      <TableCell className="text-right font-medium">{row.pesoNeto?.toFixed(0) || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.tropaCodigo || row.destino || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.fecha}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ReportePesajes
