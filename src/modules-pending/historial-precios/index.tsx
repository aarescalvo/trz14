'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  DollarSign, TrendingUp, TrendingDown, Calendar, Plus, Edit,
  History, Filter, Download, Search, ArrowUpRight, ArrowDownRight,
  RefreshCw, BarChart3, Bell, Minus, ShoppingCart, CheckCircle
} from 'lucide-react'

// ==================== TYPES ====================
interface PrecioHistorial {
  id: string
  productoVendibleId: string
  productoVendible?: {
    id: string
    nombre: string
    codigo: string
    categoria?: string
    unidadMedida?: string
  }
  clienteId?: string
  cliente?: { id: string; nombre: string; cuit?: string }
  precioAnterior: number
  precioNuevo: number
  moneda: string
  motivo?: string
  fechaVigencia: string
  operadorId?: string
  operador?: { id: string; nombre: string }
}

interface PrecioActual {
  id: string
  codigo: string
  nombre: string
  precioActual: number
  precioAnterior: number
  variacion: string
  tendencia: 'SUBIENDO' | 'BAJANDO' | 'ESTABLE'
  ultimaActualizacion: string
  totalCambios: number
}

interface GraficoMes {
  mes: string
  mesLabel: string
  totalCambios: number
  variacionPromedio: string
  subidas: number
  bajas: number
}

interface Notificacion {
  id: string
  producto: string
  precioAnterior: number
  precioNuevo: number
  variacion: string
  fecha: string
  operador: string
  significativo: boolean
}

interface Props {
  operador?: { id: string; nombre: string; rol: string }
}

// ==================== CONSTANTS ====================
const MONEDAS = [
  { id: 'ARS', nombre: 'Pesos Argentinos', simbolo: '$' },
  { id: 'USD', nombre: 'Dólares', simbolo: 'U$S' },
]

// ==================== HELPERS ====================
const formatearMoneda = (valor: number, moneda: string = 'ARS') => {
  const simbolo = MONEDAS.find(m => m.id === moneda)?.simbolo || '$'
  return `${simbolo} ${valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const formatearFecha = (fecha: string) => {
  return new Date(fecha).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

// ==================== COMPONENT ====================
export function HistorialPreciosModule({ operador }: Props) {
  const [historial, setHistorial] = useState<PrecioHistorial[]>([])
  const [preciosActuales, setPreciosActuales] = useState<PrecioActual[]>([])
  const [loading, setLoading] = useState(true)
  const [tabActivo, setTabActivo] = useState<'historial' | 'actuales' | 'actualizar' | 'graficos'>('actuales')
  const [productos, setProductos] = useState<{ id: string; nombre: string; codigo: string }[]>([])

  // Filters
  const [filtros, setFiltros] = useState({
    productoId: '',
    fechaDesde: '',
    fechaHasta: '',
    busqueda: ''
  })

  // Chart data
  const [graficoData, setGraficoData] = useState<GraficoMes[]>([])
  const [topProductos, setTopProductos] = useState<{ nombre: string; totalCambios: number; variacion: string }[]>([])
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])

  // Form
  const [nuevoPrecio, setNuevoPrecio] = useState({
    productoVendibleId: '',
    precio: '',
    moneda: 'ARS',
    motivo: ''
  })

  // Dialog
  const [registroDialog, setRegistroDialog] = useState(false)

  const fetchDatos = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtros.productoId) params.append('productoId', filtros.productoId)
      if (filtros.fechaDesde) params.append('fechaDesde', filtros.fechaDesde)
      if (filtros.fechaHasta) params.append('fechaHasta', filtros.fechaHasta)

      const res = await fetch(`/api/historial-precios-completo?${params}`)
      const data = await res.json()
      if (data.success) {
        setHistorial(data.data || [])
        setPreciosActuales(data.productos || [])
      }

      // Fetch chart data
      const resGrafico = await fetch('/api/historial-precios-completo?grafico=true')
      const dataGrafico = await resGrafico.json()
      if (dataGrafico.success) {
        setGraficoData(dataGrafico.grafico?.porMes || [])
        setTopProductos(dataGrafico.grafico?.topProductos || [])
        setNotificaciones(dataGrafico.notificaciones || [])
      }
    } catch (error) {
      console.error('Error fetching datos:', error)
    } finally {
      setLoading(false)
    }
  }, [filtros])

  useEffect(() => {
    fetchDatos()
  }, [fetchDatos])

  useEffect(() => {
    const fetchProductos = async () => {
      try {
        const res = await fetch('/api/productos-vendibles?activo=true&limite=500')
        const data = await res.json()
        if (data.success) {
          setProductos(data.data || [])
        }
      } catch (e) {
        // ignore
      }
    }
    fetchProductos()
  }, [])

  // Register price change
  const handleRegistrarPrecio = async () => {
    if (!nuevoPrecio.productoVendibleId || !nuevoPrecio.precio || parseFloat(nuevoPrecio.precio) <= 0) {
      toast.error('Complete todos los campos correctamente')
      return
    }

    try {
      const res = await fetch('/api/historial-precios-completo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productoVendibleId: nuevoPrecio.productoVendibleId,
          precioNuevo: parseFloat(nuevoPrecio.precio),
          moneda: nuevoPrecio.moneda,
          motivo: nuevoPrecio.motivo,
          operadorId: operador?.id
        })
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message || 'Precio registrado correctamente')
        setNuevoPrecio({ productoVendibleId: '', precio: '', moneda: 'ARS', motivo: '' })
        setRegistroDialog(false)
        fetchDatos()
      } else {
        toast.error(data.error || 'Error al registrar precio')
      }
    } catch (error) {
      toast.error('Error de conexión')
    }
  }

  // Export
  const handleExportar = async () => {
    try {
      const params = new URLSearchParams()
      if (filtros.productoId) params.append('productoId', filtros.productoId)
      if (filtros.fechaDesde) params.append('fechaDesde', filtros.fechaDesde)
      if (filtros.fechaHasta) params.append('fechaHasta', filtros.fechaHasta)
      params.append('exportar', 'csv')

      const res = await fetch(`/api/historial-precios-completo?${params}`)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `historial_precios_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      toast.success('Exportado correctamente')
    } catch (error) {
      toast.error('Error al exportar')
    }
  }

  // SVG Bar Chart component
  const BarChartSVG = ({ data, height = 200, barColor = '#f59e0b' }: { data: { label: string; value: number; subValue?: number }[]; height?: number; barColor?: string }) => {
    const maxVal = Math.max(...data.map(d => d.value), 1)
    const width = 600
    const padding = { top: 20, right: 20, bottom: 40, left: 50 }
    const chartW = width - padding.left - padding.right
    const chartH = height - padding.top - padding.bottom
    const barW = Math.min(chartW / data.length - 4, 40)

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        {/* Y-axis grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const y = padding.top + chartH * (1 - pct)
          return (
            <g key={pct}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e7e5e4" strokeWidth="1" />
              <text x={padding.left - 5} y={y + 4} textAnchor="end" className="text-[10px] fill-slate-400">
                {Math.round(maxVal * pct)}
              </text>
            </g>
          )
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const x = padding.left + (chartW / data.length) * i + (chartW / data.length - barW) / 2
          const barH = (d.value / maxVal) * chartH
          const y = padding.top + chartH - barH

          return (
            <g key={i}>
              {/* Main bar */}
              <rect x={x} y={y} width={barW} height={barH} fill={barColor} rx="2" opacity="0.85" />
              {/* Value label */}
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" className="text-[10px] fill-slate-600 font-medium">
                {d.value}
              </text>
              {/* X label */}
              <text x={x + barW / 2} y={height - 10} textAnchor="middle" className="text-[9px] fill-slate-500" transform={`rotate(-30, ${x + barW / 2}, ${height - 10})`}>
                {d.label}
              </text>
              {/* Sub value (subidas/bajas) */}
              {d.subValue !== undefined && d.subValue !== 0 && (
                <text x={x + barW / 2} y={y + 14} textAnchor="middle" className="text-[8px] fill-slate-400">
                  {d.subValue > 0 ? '+' : ''}{d.subValue}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    )
  }

  // ==================== PANELS ====================

  const PanelPreciosActuales = () => (
    <Card className="border-0 shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Precios Actuales
          </CardTitle>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDatos}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={() => setRegistroDialog(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nuevo Precio
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-2 mb-4">
          <Select
            value={filtros.productoId || 'all'}
            onValueChange={(v) => setFiltros(prev => ({ ...prev, productoId: v === 'all' ? '' : v }))}
          >
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Filtrar por producto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los productos</SelectItem>
              {productos.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.nombre} ({p.codigo})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Input
              className="pl-10"
              placeholder="Buscar producto..."
              value={filtros.busqueda}
              onChange={(e) => setFiltros(prev => ({ ...prev, busqueda: e.target.value }))}
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-stone-50">
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Precio Actual</TableHead>
                <TableHead className="text-right">Anterior</TableHead>
                <TableHead className="text-right">Variación</TableHead>
                <TableHead>Última Act.</TableHead>
                <TableHead>Tendencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preciosActuales.filter(p =>
                !filtros.busqueda || p.nombre.toLowerCase().includes(filtros.busqueda.toLowerCase()) || p.codigo.toLowerCase().includes(filtros.busqueda.toLowerCase())
              ).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-stone-400">
                    No hay precios registrados
                  </TableCell>
                </TableRow>
              ) : (
                preciosActuales
                  .filter(p =>
                    !filtros.busqueda || p.nombre.toLowerCase().includes(filtros.busqueda.toLowerCase()) || p.codigo.toLowerCase().includes(filtros.busqueda.toLowerCase())
                  )
                  .map(precio => (
                    <TableRow key={precio.id} className="hover:bg-stone-50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="w-4 h-4 text-stone-400" />
                          <div>
                            <p className="font-medium">{precio.nombre}</p>
                            <p className="text-xs text-stone-400 font-mono">{precio.codigo}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-lg">
                        {formatearMoneda(precio.precioActual)}
                      </TableCell>
                      <TableCell className="text-right text-stone-500">
                        {precio.precioAnterior > 0 ? formatearMoneda(precio.precioAnterior) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`flex items-center justify-end gap-1 font-medium ${
                          parseFloat(precio.variacion) > 0 ? 'text-green-600' :
                          parseFloat(precio.variacion) < 0 ? 'text-red-600' : 'text-stone-500'
                        }`}>
                          {parseFloat(precio.variacion) > 0 ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : parseFloat(precio.variacion) < 0 ? (
                            <ArrowDownRight className="w-4 h-4" />
                          ) : (
                            <Minus className="w-4 h-4" />
                          )}
                          {parseFloat(precio.variacion) > 0 ? '+' : ''}{precio.variacion}%
                        </span>
                      </TableCell>
                      <TableCell className="text-stone-500 text-sm">
                        {precio.ultimaActualizacion ? formatearFecha(precio.ultimaActualizacion) : '-'}
                      </TableCell>
                      <TableCell>
                        {precio.tendencia === 'SUBIENDO' && <TrendingUp className="w-5 h-5 text-green-500" />}
                        {precio.tendencia === 'BAJANDO' && <TrendingDown className="w-5 h-5 text-red-500" />}
                        {precio.tendencia === 'ESTABLE' && <span className="text-stone-300 text-lg">—</span>}
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )

  const PanelHistorial = () => (
    <Card className="border-0 shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5" />
          Historial de Cambios
        </CardTitle>
        <div className="flex gap-2">
          <Input
            type="date"
            className="w-[160px] h-8"
            value={filtros.fechaDesde}
            onChange={(e) => setFiltros(prev => ({ ...prev, fechaDesde: e.target.value }))}
          />
          <Input
            type="date"
            className="w-[160px] h-8"
            value={filtros.fechaHasta}
            onChange={(e) => setFiltros(prev => ({ ...prev, fechaHasta: e.target.value }))}
          />
          <Button variant="outline" size="sm" onClick={handleExportar}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-stone-50">
                <TableHead>Fecha</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Precio Anterior</TableHead>
                <TableHead className="text-right">Precio Nuevo</TableHead>
                <TableHead className="text-right">Variación</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historial.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-stone-400">
                    <History className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>No hay cambios registrados</p>
                  </TableCell>
                </TableRow>
              ) : (
                historial.map(item => {
                  const variacion = item.precioAnterior && item.precioAnterior > 0
                    ? ((item.precioNuevo - item.precioAnterior) / item.precioAnterior) * 100
                    : 0
                  return (
                    <TableRow key={item.id} className="hover:bg-stone-50">
                      <TableCell className="text-sm">{formatearFecha(item.fechaVigencia)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.productoVendible?.nombre || 'N/A'}</p>
                          <p className="text-xs text-stone-400 font-mono">{item.productoVendible?.codigo || ''}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-stone-500">
                        {item.precioAnterior ? formatearMoneda(item.precioAnterior, item.moneda) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatearMoneda(item.precioNuevo, item.moneda)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-medium ${
                          variacion > 0 ? 'text-green-600' :
                          variacion < 0 ? 'text-red-600' : 'text-stone-500'
                        }`}>
                          {variacion > 0 ? '+' : ''}{variacion.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-stone-500">
                        {item.operador?.nombre || 'Sistema'}
                      </TableCell>
                      <TableCell className="text-sm text-stone-400 max-w-[150px] truncate">
                        {item.motivo || '-'}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
        <div className="p-2 text-sm text-stone-400 text-center">
          {historial.length} registros
        </div>
      </CardContent>
    </Card>
  )

  const PanelGraficos = () => {
    const barData = graficoData.map(g => ({
      label: g.mesLabel,
      value: g.totalCambios,
      subValue: parseInt(g.variacionPromedio)
    }))

    const topData = topProductos.slice(0, 8).map(p => ({
      label: p.nombre?.substring(0, 20) || 'N/A',
      value: p.totalCambios || 0
    }))

    return (
      <div className="space-y-6">
        {/* Price Trend Bar Chart */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Cambios de Precio por Mes (últimos 12 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <BarChartSVG data={barData} height={250} barColor="#f59e0b" />
            ) : (
              <div className="text-center py-8 text-stone-400">Sin datos para gráfico</div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Products */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Productos con más cambios
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topData.length > 0 ? (
                <BarChartSVG data={topData} height={200} barColor="#3b82f6" />
              ) : (
                <div className="text-center py-8 text-stone-400 text-sm">Sin datos</div>
              )}
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-500" />
                Cambios Recientes Significativos
              </CardTitle>
              <CardDescription>Cambios de más del 5% en los últimos 7 días</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {notificaciones.length === 0 ? (
                  <div className="text-center py-6 text-stone-400 text-sm">
                    <CheckCircle className="w-6 h-6 mx-auto mb-1" />
                    Sin cambios significativos recientes
                  </div>
                ) : (
                  notificaciones.map(n => (
                    <div
                      key={n.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                        n.significativo ? 'border-amber-200 bg-amber-50' : 'border-stone-200'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg ${
                        parseFloat(n.variacion) > 0 ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        {parseFloat(n.variacion) > 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{n.producto}</p>
                        <p className="text-xs text-stone-500">
                          {formatearMoneda(n.precioAnterior)} → {formatearMoneda(n.precioNuevo)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold text-sm ${
                          parseFloat(n.variacion) > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {parseFloat(n.variacion) > 0 ? '+' : ''}{n.variacion}%
                        </p>
                        <p className="text-[10px] text-stone-400">{n.operador}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-stone-800">
              Historial de Precios
            </h1>
            <p className="text-stone-500 mt-1">
              Gestión y seguimiento completo de precios de productos vendibles
            </p>
          </div>
          <div className="flex items-center gap-2">
            {notificaciones.filter(n => n.significativo).length > 0 && (
              <Badge className="bg-amber-100 text-amber-700">
                <Bell className="w-3 h-3 mr-1" />
                {notificaciones.filter(n => n.significativo).length} alertas
              </Badge>
            )}
            <Badge className="bg-stone-100 text-stone-600">
              <History className="w-3 h-3 mr-1" />
              {historial.length} cambios
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tabActivo} onValueChange={(v) => setTabActivo(v as 'historial' | 'actuales' | 'graficos')}>
          <TabsList className="mb-6">
            <TabsTrigger value="actuales" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Precios Actuales
            </TabsTrigger>
            <TabsTrigger value="historial" className="flex items-center gap-2">
              <History className="w-4 h-4" /> Historial
            </TabsTrigger>
            <TabsTrigger value="graficos" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Gráficos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="actuales">
            <PanelPreciosActuales />
          </TabsContent>

          <TabsContent value="historial">
            <PanelHistorial />
          </TabsContent>

          <TabsContent value="graficos">
            <PanelGraficos />
          </TabsContent>
        </Tabs>

        {/* Register Price Dialog */}
        <Dialog open={registroDialog} onOpenChange={setRegistroDialog}>
          <DialogContent className="max-w-md" maximizable>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Registrar Cambio de Precio
              </DialogTitle>
              <DialogDescription>
                Registre una actualización de precio. Se creará un registro en el historial.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Producto</Label>
                <Select
                  value={nuevoPrecio.productoVendibleId}
                  onValueChange={(v) => setNuevoPrecio(prev => ({ ...prev, productoVendibleId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar producto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {productos.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre} ({p.codigo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nuevo Precio</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={nuevoPrecio.precio}
                    onChange={(e) => setNuevoPrecio(prev => ({ ...prev, precio: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Moneda</Label>
                  <Select
                    value={nuevoPrecio.moneda}
                    onValueChange={(v) => setNuevoPrecio(prev => ({ ...prev, moneda: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONEDAS.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Motivo / Observación</Label>
                <Input
                  value={nuevoPrecio.motivo}
                  onChange={(e) => setNuevoPrecio(prev => ({ ...prev, motivo: e.target.value }))}
                  placeholder="Ej: Ajuste por inflación, nueva lista de precios..."
                />
              </div>

              {/* Preview current price */}
              {nuevoPrecio.productoVendibleId && (
                <div className="p-3 bg-stone-50 rounded-lg border">
                  <p className="text-sm text-stone-500">Precio actual del producto:</p>
                  <p className="text-lg font-bold">
                    {formatearMoneda(
                      preciosActuales.find(p => p.id === nuevoPrecio.productoVendibleId)?.precioActual || 0,
                      nuevoPrecio.moneda
                    )}
                  </p>
                  {nuevoPrecio.precio && (
                    <p className="text-sm mt-1">
                      Nuevo: <span className="font-medium">{formatearMoneda(parseFloat(nuevoPrecio.precio), nuevoPrecio.moneda)}</span>
                      {(() => {
                        const actual = preciosActuales.find(p => p.id === nuevoPrecio.productoVendibleId)?.precioActual
                        if (!actual || actual <= 0) return null
                        const nuevo = parseFloat(nuevoPrecio.precio)
                        const diff = ((nuevo - actual) / actual * 100).toFixed(1)
                        const sign = nuevo > actual ? '+' : ''
                        return (
                          <span className={`ml-2 ${nuevo > actual ? 'text-green-600' : 'text-red-600'}`}>
                            ({sign}{diff}%)
                          </span>
                        )
                      })()}
                    </p>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRegistroDialog(false)}>
                Cancelar
              </Button>
              <Button
                className="bg-amber-500 hover:bg-amber-600"
                onClick={handleRegistrarPrecio}
                disabled={!nuevoPrecio.productoVendibleId || !nuevoPrecio.precio}
              >
                <DollarSign className="w-4 h-4 mr-1" /> Registrar Precio
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default HistorialPreciosModule
