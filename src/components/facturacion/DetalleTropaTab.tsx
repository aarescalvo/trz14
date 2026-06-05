'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Beef, DollarSign, TrendingUp, Filter, Download, RefreshCw,
  Calendar, Hash, Users, Package, Search, Eye, ChevronDown, ChevronUp,
  FileSpreadsheet, Loader2, ArrowUpDown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

// ==================== TYPES ====================
interface DetalleTropa {
  id: string
  tropaId: string
  numeroTropa: number
  mes: string | null
  usuario: string
  cantidadAnimales: number
  precioServicio: number
  kgGancho: number
  valorServicioFaena: number
  servicioDespostada: number
  factCompraMenudencia: number
  factVentaMenudencia: number
  ventaChinchulin: number
  montoHueso: number
  montoDesperdicio: number
  montoGrasa: number
  montoCuero: number
  montoGrasaDressing: number
  totalOperacion?: number
  tropa?: {
    id: string
    codigo: string
    fechaFaena: string | null
    cantidadCabezas: number
    estado: string
    usuarioFaena?: { id: string; nombre: string; cuit: string | null }
  }
}

interface Resumen {
  totalRegistros: number
  totalKgGancho: number
  totalValorServicio: number
  totalDespostada: number
  totalSubproductos: number
  totalOperacion: number
  totalAnimales: number
}

interface PorUsuario {
  usuario: string
  _count: { numeroTropa: number }
  _sum: {
    kgGancho: number | null
    valorServicioFaena: number | null
    servicioDespostada: number | null
    cantidadAnimales: number | null
    montoHueso: number | null
    montoDesperdicio: number | null
    montoGrasa: number | null
    montoCuero: number | null
    montoGrasaDressing: number | null
    ventaChinchulin: number | null
  }
}

interface SubproductosResumen {
  hueso: number
  desperdicio: number
  grasa: number
  cuero: number
  grasaDressing: number
  chinchulin: number
  menudenciaCompra: number
  menudenciaVenta: number
}

interface Props { operador?: { id: string; nombre: string; rol: string } }

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
]

const PERIODOS = [
  { value: '', label: 'Todos' },
  { value: 'SEMANAL', label: 'Semanal' },
  { value: 'MENSUAL', label: 'Mensual' },
  { value: 'ANUAL', label: 'Anual' },
]

// ==================== HELPERS ====================
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)

const formatNumber = (amount: number) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(amount)

// ==================== COMPONENT ====================
export function DetalleTropaTab({ operador }: Props) {
  const [detalles, setDetalles] = useState<DetalleTropa[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [porUsuario, setPorUsuario] = useState<PorUsuario[]>([])
  const [subproductos, setSubproductos] = useState<SubproductosResumen | null>(null)
  const [precioTiers, setPrecioTiers] = useState<{ precioServicio: number; _count: { numeroTropa: number } }[]>([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState(true)
  const [subproductosExpandido, setSubproductosExpandido] = useState(false)

  // Filtros
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [filtroPeriodo, setFiltroPeriodo] = useState('')
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroAnio, setFiltroAnio] = useState('2026')
  const [filtroTropa, setFiltroTropa] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // Sort
  const [sortField, setSortField] = useState<string>('numeroTropa')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtroDesde) params.append('desde', filtroDesde)
      if (filtroHasta) params.append('hasta', filtroHasta)
      if (filtroUsuario) params.append('usuario', filtroUsuario)
      if (filtroPeriodo) params.append('periodo', filtroPeriodo)
      if (filtroMes) params.append('mes', filtroMes)
      if (filtroAnio) params.append('anio', filtroAnio)
      if (filtroTropa) params.append('tropa', filtroTropa)

      const res = await fetch(`/api/facturacion/detalle-tropa?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setDetalles(data.data || [])
        setResumen(data.resumen || null)
        setPorUsuario(data.porUsuario || [])
        setSubproductos(data.subproductos || null)
        setPrecioTiers(data.precioTiers || [])
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar datos del DETALLE')
    } finally {
      setLoading(false)
    }
  }, [filtroDesde, filtroHasta, filtroUsuario, filtroPeriodo, filtroMes, filtroAnio, filtroTropa])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  // Client-side filtering by search
  const filtered = detalles.filter(d => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      d.usuario.toLowerCase().includes(term) ||
      String(d.numeroTropa).includes(term) ||
      (d.tropa?.codigo || '').toLowerCase().includes(term)
    )
  })

  // Client-side sorting
  const sorted = [...filtered].sort((a, b) => {
    const aVal = (a as any)[sortField]
    const bVal = (b as any)[sortField]
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    }
    const numA = Number(aVal) || 0
    const numB = Number(bVal) || 0
    return sortDir === 'asc' ? numA - numB : numB - numA
  })

  // Export CSV
  const handleExportCSV = () => {
    if (!sorted.length) return
    const headers = [
      'Tropa', 'Código', 'Mes', 'Usuario', 'Cant. Animales',
      '$/kg Servicio', 'Kg Gancho', 'Valor Serv. Faena', 'Serv. Despostada',
      'Total Operación',
      'F. Compra Menud.', 'F. Venta Menud.', 'Vta. Chinchulin',
      '$ Hueso', '$ Desperdicio', '$ Grasa', '$ Cuero', '$ Grasa Dressing'
    ]
    const rows = sorted.map(d => [
      d.numeroTropa,
      d.tropa?.codigo || '',
      d.mes || '',
      d.usuario,
      d.cantidadAnimales,
      d.precioServicio,
      d.kgGancho.toFixed(1),
      Math.round(d.valorServicioFaena),
      Math.round(d.servicioDespostada),
      Math.round(d.totalOperacion || 0),
      Math.round(d.factCompraMenudencia),
      Math.round(d.factVentaMenudencia),
      Math.round(d.ventaChinchulin),
      Math.round(d.montoHueso),
      Math.round(d.montoDesperdicio),
      Math.round(d.montoGrasa),
      Math.round(d.montoCuero),
      Math.round(d.montoGrasaDressing),
    ])
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `detalle_tropas_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Archivo CSV descargado')
  }

  const SortIcon = ({ field }: { field: string }) => (
    <ArrowUpDown className={`w-3 h-3 inline ml-1 ${sortField === field ? 'opacity-100 text-amber-600' : 'opacity-30'}`} />
  )

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-stone-500" />
            <span className="text-sm font-semibold text-stone-700">Filtros</span>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => {
              setFiltroDesde(''); setFiltroHasta(''); setFiltroUsuario('')
              setFiltroPeriodo(''); setFiltroMes(''); setFiltroTropa('')
              setFiltroAnio('2026'); setSearchTerm('')
            }}>
              <RefreshCw className="w-3 h-3 mr-1" /> Limpiar
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} className="h-9 w-36" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)} className="h-9 w-36" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Periodo</Label>
              <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                <SelectTrigger className="h-9 w-32"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  {PERIODOS.map(p => <SelectItem key={p.value} value={p.value || '_all'}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mes</Label>
              <Select value={filtroMes} onValueChange={v => setFiltroMes(v === '_all' ? '' : v)}>
                <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Todos</SelectItem>
                  {MESES.map(m => <SelectItem key={m} value={m}>{m.charAt(0) + m.slice(1).toLowerCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Año</Label>
              <Select value={filtroAnio} onValueChange={setFiltroAnio}>
                <SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">N° Tropa</Label>
              <Input type="number" placeholder="Ej: 45" value={filtroTropa} onChange={e => setFiltroTropa(e.target.value)} className="h-9 w-24" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
                <Input
                  placeholder="Usuario..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="h-9 pl-8 w-44"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs Resumen */}
      {resumen && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-0 shadow-sm bg-amber-50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-200/60 rounded-lg"><Hash className="w-4 h-4 text-amber-700" /></div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold">Tropas</p>
                  <p className="text-xl font-bold text-amber-800">{resumen.totalRegistros}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-blue-50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-200/60 rounded-lg"><Beef className="w-4 h-4 text-blue-700" /></div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-blue-600 font-semibold">Kg Gancho</p>
                  <p className="text-lg font-bold text-blue-700">{formatNumber(resumen.totalKgGancho)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-emerald-50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-200/60 rounded-lg"><DollarSign className="w-4 h-4 text-emerald-700" /></div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold">Total Operación</p>
                  <p className="text-lg font-bold text-emerald-700">{formatCurrency(resumen.totalOperacion)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-orange-50">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-200/60 rounded-lg"><Package className="w-4 h-4 text-orange-700" /></div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-orange-600 font-semibold">Subproductos</p>
                  <p className="text-lg font-bold text-orange-700">{formatCurrency(resumen.totalSubproductos)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabla Principal */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <div className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-500" />
                DETALLE por Tropa
              </CardTitle>
              <CardDescription>
                {loading ? 'Cargando...' : `${sorted.length} registros${searchTerm ? ` (filtrados de ${detalles.length})` : ''}`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-1" /> CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
            <Table className="text-xs">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-stone-100 hover:bg-stone-100">
                  <TableHead className="sticky left-0 bg-stone-100 z-20 min-w-[40px] text-center cursor-pointer" onClick={() => handleSort('numeroTropa')}>
                    N° <SortIcon field="numeroTropa" />
                  </TableHead>
                  <TableHead className="min-w-[100px]">Código</TableHead>
                  <TableHead className="min-w-[80px]">Mes</TableHead>
                  <TableHead className="min-w-[180px] cursor-pointer" onClick={() => handleSort('usuario')}>
                    Usuario <SortIcon field="usuario" />
                  </TableHead>
                  <TableHead className="text-center min-w-[40px] cursor-pointer" onClick={() => handleSort('cantidadAnimales')}>
                    Cant.<SortIcon field="cantidadAnimales" />
                  </TableHead>
                  <TableHead className="text-right min-w-[50px] cursor-pointer" onClick={() => handleSort('precioServicio')}>
                    $/kg <SortIcon field="precioServicio" />
                  </TableHead>
                  <TableHead className="text-right min-w-[70px] cursor-pointer" onClick={() => handleSort('kgGancho')}>
                    Kg Gancho <SortIcon field="kgGancho" />
                  </TableHead>
                  <TableHead className="text-right min-w-[90px] cursor-pointer" onClick={() => handleSort('valorServicioFaena')}>
                    Serv. Faena $ <SortIcon field="valorServicioFaena" />
                  </TableHead>
                  <TableHead className="text-right min-w-[90px]">Despostada $</TableHead>
                  <TableHead className="text-right min-w-[90px] font-bold bg-emerald-50">
                    TOTAL OPER. $
                  </TableHead>
                  <TableHead className="text-right min-w-[60px]">
                    <span className="cursor-pointer" onClick={() => setExpandido(!expandido)} title="Ver columnas de subproductos">
                      <Package className="w-3.5 h-3.5 inline" />
                      {expandido ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />}
                    </span>
                  </TableHead>
                </TableRow>
                {expandido && (
                  <TableRow className="bg-amber-50 hover:bg-amber-50 text-[10px]">
                    <TableHead className="sticky left-0 bg-amber-50 z-20"></TableHead>
                    <TableHead colSpan={4}></TableHead>
                    <TableHead colSpan={5} className="text-center text-amber-700 font-semibold">
                      SUBPRODUCTOS (propiedad del frigorífico)
                    </TableHead>
                    <TableHead className="text-right text-amber-700">Compra Men.</TableHead>
                    <TableHead className="text-right text-amber-700">Venta Men.</TableHead>
                    <TableHead className="text-right text-amber-700">Chinchulín</TableHead>
                    <TableHead className="text-right text-amber-700">Hueso</TableHead>
                    <TableHead className="text-right text-amber-700">Desperd.</TableHead>
                    <TableHead className="text-right text-amber-700">Grasa</TableHead>
                    <TableHead className="text-right text-amber-700">Cuero</TableHead>
                    <TableHead className="text-right text-amber-700">Grasa Dress.</TableHead>
                  </TableRow>
                )}
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={expandido ? 19 : 11} className="text-center py-12">
                      <Loader2 className="w-6 h-6 mx-auto animate-spin text-amber-500" />
                      <p className="mt-2 text-stone-400 text-sm">Cargando datos...</p>
                    </TableCell>
                  </TableRow>
                ) : sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={expandido ? 19 : 11} className="text-center py-12 text-stone-400">
                      No se encontraron registros con los filtros aplicados
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((d, idx) => {
                    const totalOp = d.totalOperacion || (
                      d.valorServicioFaena + d.servicioDespostada + d.factCompraMenudencia +
                      d.factVentaMenudencia + d.ventaChinchulin + d.montoHueso + d.montoDesperdicio +
                      d.montoGrasa + d.montoCuero + d.montoGrasaDressing
                    )
                    const tieneSubproductos = d.montoHueso > 0 || d.montoDesperdicio > 0 || d.montoGrasa > 0 || d.montoCuero > 0 || d.montoGrasaDressing > 0 || d.ventaChinchulin > 0

                    return (
                      <TableRow key={d.id} className={`hover:bg-stone-50 ${tieneSubproductos ? 'bg-orange-50/30' : ''}`}>
                        <TableCell className="sticky left-0 bg-white z-10 font-mono font-bold text-center">
                          {d.numeroTropa}
                        </TableCell>
                        <TableCell className="font-mono text-stone-500 text-[10px]">
                          {d.tropa?.codigo || '-'}
                        </TableCell>
                        <TableCell>
                          {d.mes ? (
                            <Badge variant="outline" className="text-[10px] font-normal py-0 px-1.5">
                              {d.mes.charAt(0) + d.mes.slice(1).toLowerCase()}
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="font-medium">{d.usuario}</TableCell>
                        <TableCell className="text-center">{d.cantidadAnimales}</TableCell>
                        <TableCell className="text-right font-mono">
                          {d.precioServicio > 0 ? `$${d.precioServicio}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatNumber(d.kgGancho)}</TableCell>
                        <TableCell className="text-right font-mono font-medium">{formatCurrency(d.valorServicioFaena)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {d.servicioDespostada > 0 ? (
                            <span className="text-blue-600 font-medium">{formatCurrency(d.servicioDespostada)}</span>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-bold font-mono bg-emerald-50/50 text-emerald-800">
                          {formatCurrency(totalOp)}
                        </TableCell>
                        {expandido && (
                          <>
                            <TableCell className={`text-right font-mono ${d.factCompraMenudencia > 0 ? 'text-stone-600' : 'text-stone-300'}`}>
                              {d.factCompraMenudencia > 0 ? formatCurrency(d.factCompraMenudencia) : '-'}
                            </TableCell>
                            <TableCell className={`text-right font-mono ${d.factVentaMenudencia > 0 ? 'text-stone-600' : 'text-stone-300'}`}>
                              {d.factVentaMenudencia > 0 ? formatCurrency(d.factVentaMenudencia) : '-'}
                            </TableCell>
                            <TableCell className={`text-right font-mono ${d.ventaChinchulin > 0 ? 'text-stone-600' : 'text-stone-300'}`}>
                              {d.ventaChinchulin > 0 ? formatCurrency(d.ventaChinchulin) : '-'}
                            </TableCell>
                            <TableCell className={`text-right font-mono ${d.montoHueso > 0 ? 'text-amber-700' : 'text-stone-300'}`}>
                              {d.montoHueso > 0 ? formatCurrency(d.montoHueso) : '-'}
                            </TableCell>
                            <TableCell className={`text-right font-mono ${d.montoDesperdicio > 0 ? 'text-amber-700' : 'text-stone-300'}`}>
                              {d.montoDesperdicio > 0 ? formatCurrency(d.montoDesperdicio) : '-'}
                            </TableCell>
                            <TableCell className={`text-right font-mono ${d.montoGrasa > 0 ? 'text-amber-700' : 'text-stone-300'}`}>
                              {d.montoGrasa > 0 ? formatCurrency(d.montoGrasa) : '-'}
                            </TableCell>
                            <TableCell className={`text-right font-mono ${d.montoCuero > 0 ? 'text-amber-700' : 'text-stone-300'}`}>
                              {d.montoCuero > 0 ? formatCurrency(d.montoCuero) : '-'}
                            </TableCell>
                            <TableCell className={`text-right font-mono ${d.montoGrasaDressing > 0 ? 'text-amber-700' : 'text-stone-300'}`}>
                              {d.montoGrasaDressing > 0 ? formatCurrency(d.montoGrasaDressing) : '-'}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Totales */}
          {!loading && sorted.length > 0 && (
            <div className="border-t px-3 py-2 bg-stone-50 text-xs">
              <div className="flex flex-wrap gap-4 items-center">
                <span className="font-semibold text-stone-600">
                  {sorted.length} tropas | {sorted.reduce((s, d) => s + d.cantidadAnimales, 0)} animales
                </span>
                <span className="text-stone-500">
                  Kg Gancho: <strong>{formatNumber(sorted.reduce((s, d) => s + d.kgGancho, 0))}</strong>
                </span>
                <span className="text-stone-500">
                  Serv. Faena: <strong>{formatCurrency(sorted.reduce((s, d) => s + d.valorServicioFaena, 0))}</strong>
                </span>
                {sorted.some(d => d.servicioDespostada > 0) && (
                  <span className="text-blue-600">
                    Despostada: <strong>{formatCurrency(sorted.reduce((s, d) => s + d.servicioDespostada, 0))}</strong>
                  </span>
                )}
                <span className="text-emerald-700 font-bold">
                  Total Operación: {formatCurrency(
                    sorted.reduce((s, d) => s + (
                      d.valorServicioFaena + d.servicioDespostada + d.factCompraMenudencia +
                      d.factVentaMenudencia + d.ventaChinchulin + d.montoHueso + d.montoDesperdicio +
                      d.montoGrasa + d.montoCuero + d.montoGrasaDressing
                    ), 0)
                  )}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sección inferior: Por Usuario + Subproductos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Resumen por Usuario */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              Resumen por Usuario
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="bg-blue-50 hover:bg-blue-50">
                    <TableHead>Usuario</TableHead>
                    <TableHead className="text-center">Tropas</TableHead>
                    <TableHead className="text-center">Animales</TableHead>
                    <TableHead className="text-right">Kg Gancho</TableHead>
                    <TableHead className="text-right">Serv. Faena $</TableHead>
                    <TableHead className="text-right">Despostada $</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porUsuario.map(pu => (
                    <TableRow key={pu.usuario} className="hover:bg-stone-50">
                      <TableCell className="font-medium">{pu.usuario}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-[10px]">{pu._count.numeroTropa}</Badge>
                      </TableCell>
                      <TableCell className="text-center">{pu._sum.cantidadAnimales || 0}</TableCell>
                      <TableCell className="text-right font-mono">{formatNumber(pu._sum.kgGancho || 0)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(pu._sum.valorServicioFaena || 0)}</TableCell>
                      <TableCell className="text-right font-mono text-blue-600">
                        {(pu._sum.servicioDespostada || 0) > 0 ? formatCurrency(pu._sum.servicioDespostada || 0) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Resumen Subproductos */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4 text-orange-500" />
                Subproductos del Frigorífico
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">Informativo</Badge>
            </div>
            <CardDescription>Productos de propiedad del frigorífico, agrupados y vendidos por separado</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="bg-orange-50 hover:bg-orange-50">
                    <TableHead>Subproducto</TableHead>
                    <TableHead className="text-right">Monto Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subproductos && (
                    <>
                      <TableRow className="hover:bg-stone-50">
                        <TableCell className="font-medium flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500" /> Hueso
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">{formatCurrency(subproductos.hueso)}</TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-stone-50">
                        <TableCell className="font-medium flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-stone-400" /> Desperdicio
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">{formatCurrency(subproductos.desperdicio)}</TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-stone-50">
                        <TableCell className="font-medium flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-yellow-400" /> Grasa
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">{formatCurrency(subproductos.grasa)}</TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-stone-50">
                        <TableCell className="font-medium flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-800" /> Cuero
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">{formatCurrency(subproductos.cuero)}</TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-stone-50">
                        <TableCell className="font-medium flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-yellow-600" /> Grasa Dressing
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">{formatCurrency(subproductos.grasaDressing)}</TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-stone-50">
                        <TableCell className="font-medium flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-orange-400" /> Chinchulín
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">{formatCurrency(subproductos.chinchulin)}</TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-stone-50">
                        <TableCell className="font-medium flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-green-400" /> Menudencia (Compra)
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(subproductos.menudenciaCompra)}</TableCell>
                      </TableRow>
                      <TableRow className="hover:bg-stone-50">
                        <TableCell className="font-medium flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-green-600" /> Menudencia (Venta)
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(subproductos.menudenciaVenta)}</TableCell>
                      </TableRow>
                      <TableRow className="bg-orange-50 font-bold">
                        <TableCell>TOTAL SUBPRODUCTOS</TableCell>
                        <TableCell className="text-right font-mono text-orange-800">
                          {formatCurrency((subproductos.hueso + subproductos.desperdicio + subproductos.grasa +
                            subproductos.cuero + subproductos.grasaDressing + subproductos.chinchulin +
                            subproductos.menudenciaCompra + subproductos.menudenciaVenta))}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Precio Tiers */}
            {precioTiers.length > 0 && (
              <>
                <Separator className="my-3" />
                <div className="px-3">
                  <p className="text-xs font-semibold text-stone-600 mb-2 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Escalas de Precio ($/kg)
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {precioTiers.filter(pt => pt.precioServicio > 0).map(pt => (
                      <Badge key={pt.precioServicio} variant="outline" className="text-xs">
                        ${pt.precioServicio}/kg — {pt._count.numeroTropa} tropas
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default DetalleTropaTab
