'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  CreditCard,
  RefreshCw,
  Search,
  Loader2,
  X,
  Filter,
  Receipt,
  Eye,
  TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

// ==================== TYPES ====================

interface Cliente {
  id: string
  nombre: string
  cuit: string | null
}

interface PagoFactura {
  id: string
  fecha: string
  monto: number
  metodoPago: string
  referencia: string | null
}

interface FacturaRow {
  id: string
  numero: string
  fecha: string
  total: number
  estado: string
  plazoPagoDias: number
  observaciones: string | null
  clienteId: string
  cliente: Cliente
  pagosFactura: PagoFactura[]
  planillasFactura?: { numeroTropa: number }[]
  totalPagado: number
  saldoPendiente: number
  diasTranscurridos: number
  estadoPago: 'PAGADO' | 'VENCIDO' | 'PENDIENTE'
}

interface KPIs {
  totalFacturado: number
  totalCobrado: number
  saldoTotalPendiente: number
  facturasVencidas: number
  montoVencido: number
  facturasProximasVencer: number
  pagosHoy: number
}

interface Paginacion {
  pagina: number
  limite: number
  total: number
  totalPaginas: number
}

interface Props {
  operador: any
}

// ==================== CONSTANTS ====================

const METODOS_PAGO = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'TARJETA', label: 'Tarjeta' },
]

// ==================== FORMATTERS ====================

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(value)

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('es-AR')
}

const todayDate = () => new Date().toISOString().split('T')[0]

// ==================== COMPONENT ====================

export function PagosSaldosTab({ operador }: Props) {
  // Data state
  const [facturas, setFacturas] = useState<FacturaRow[]>([])
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [paginacion, setPaginacion] = useState<Paginacion | null>(null)
  const [loading, setLoading] = useState(true)

  // Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [soloVencidas, setSoloVencidas] = useState(false)
  const [pagina, setPagina] = useState(1)
  const limite = 50

  // Pago dialog state
  const [pagoOpen, setPagoOpen] = useState(false)
  const [facturaSeleccionada, setFacturaSeleccionada] =
    useState<FacturaRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [pagoData, setPagoData] = useState({
    monto: 0,
    metodoPago: 'EFECTIVO',
    fecha: todayDate(),
    referencia: '',
    banco: '',
    observaciones: '',
  })

  // ==================== DATA FETCHING ====================

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('pagina', String(pagina))
      params.set('limite', String(limite))
      if (soloVencidas) params.set('soloVencidas', 'true')

      const res = await fetch(`/api/facturacion/pagos-saldos?${params.toString()}`)
      const data = await res.json()

      if (data.success) {
        setFacturas(data.data)
        setKpis(data.kpis)
        setPaginacion(data.paginacion)
      } else {
        toast.error(data.error || 'Error al cargar datos')
      }
    } catch (error) {
      console.error('[PagosSaldosTab] fetch error:', error)
      toast.error('Error de conexión al cargar pagos y saldos')
    } finally {
      setLoading(false)
    }
  }, [pagina, soloVencidas])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Reset to page 1 when filters change
  const handleToggleVencidas = () => {
    setSoloVencidas((prev) => !prev)
    setPagina(1)
  }

  const handleSearch = (value: string) => {
    setSearchTerm(value)
  }

  // ==================== CLIENT-SIDE SEARCH ====================

  const filtered = facturas.filter((f) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      f.numero.toLowerCase().includes(term) ||
      f.cliente.nombre.toLowerCase().includes(term) ||
      (f.cliente.cuit || '').toLowerCase().includes(term)
    )
  })

  // ==================== PAGO DIALOG ====================

  const handleOpenPago = (factura: FacturaRow) => {
    setFacturaSeleccionada(factura)
    setPagoData({
      monto: Math.round(factura.saldoPendiente * 100) / 100,
      metodoPago: 'EFECTIVO',
      fecha: todayDate(),
      referencia: '',
      banco: '',
      observaciones: '',
    })
    setPagoOpen(true)
  }

  const handleRegistrarPago = async () => {
    if (!facturaSeleccionada) return
    if (pagoData.monto <= 0) {
      toast.error('El monto debe ser mayor a 0')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/facturacion/pagos-saldos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facturaId: facturaSeleccionada.id,
          monto: pagoData.monto,
          metodoPago: pagoData.metodoPago,
          fecha: pagoData.fecha || undefined,
          referencia: pagoData.referencia || undefined,
          banco: pagoData.banco || undefined,
          observaciones: pagoData.observaciones || undefined,
        }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success(
          `Pago de ${formatCurrency(pagoData.monto)} registrado para factura ${facturaSeleccionada.numero}`
        )
        setPagoOpen(false)
        setFacturaSeleccionada(null)
        fetchData()
      } else {
        toast.error(data.error || 'Error al registrar pago')
      }
    } catch (error) {
      console.error('[PagosSaldosTab] pago error:', error)
      toast.error('Error de conexión al registrar pago')
    } finally {
      setSaving(false)
    }
  }

  // ==================== ESTADO BADGE ====================

  const EstadoBadge = ({ estado }: { estado: string }) => {
    switch (estado) {
      case 'PAGADO':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-600 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            PAGADO
          </span>
        )
      case 'VENCIDO':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/20 text-red-600 border border-red-500/30 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            VENCIDO
          </span>
        )
      case 'PENDIENTE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-600 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            PENDIENTE
          </span>
        )
      default:
        return (
          <Badge variant="outline" className="text-[10px]">
            {estado}
          </Badge>
        )
    }
  }

  // ==================== RENDER ====================

  return (
    <div className="space-y-4">
      {/* ==================== KPI CARDS ==================== */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total Facturado */}
          <Card className="bg-blue-50 border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-200/60 rounded-lg">
                  <DollarSign className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-blue-600 font-semibold truncate">
                    Total Facturado
                  </p>
                  <p className="text-xl font-bold text-blue-800 truncate">
                    {formatCurrency(kpis.totalFacturado)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Cobrado */}
          <Card className="bg-emerald-50 border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-200/60 rounded-lg">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold truncate">
                    Total Cobrado
                  </p>
                  <p className="text-xl font-bold text-emerald-800 truncate">
                    {formatCurrency(kpis.totalCobrado)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Saldo Pendiente */}
          <Card className="bg-amber-50 border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-200/60 rounded-lg">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold truncate">
                    Saldo Pendiente
                  </p>
                  <p className="text-xl font-bold text-amber-800 truncate">
                    {formatCurrency(kpis.saldoTotalPendiente)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Facturas Vencidas */}
          <Card className="bg-red-50 border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-200/60 rounded-lg animate-pulse">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-red-600 font-semibold truncate">
                    Fact. Vencidas
                  </p>
                  <p className="text-xl font-bold text-red-800 truncate">
                    {kpis.facturasVencidas}
                    <span className="text-[10px] text-red-500 ml-1 font-normal">
                      ({formatCurrency(kpis.montoVencido)})
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Próximas a Vencer */}
          <Card className="bg-orange-50 border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-200/60 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-orange-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-orange-600 font-semibold truncate">
                    Próx. a Vencer
                  </p>
                  <p className="text-xl font-bold text-orange-800 truncate">
                    {kpis.facturasProximasVencer}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pagos Hoy */}
          <Card className="bg-emerald-50 border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-200/60 rounded-lg">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold truncate">
                    Pagos Hoy
                  </p>
                  <p className="text-xl font-bold text-emerald-800 truncate">
                    {kpis.pagosHoy}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ==================== FILTER BAR ==================== */}
      <Card className="bg-white shadow-md border-0">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <Input
                placeholder="Buscar por cliente o N° factura..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-9 h-9 bg-stone-50 border-stone-200 text-stone-800 placeholder:text-stone-400 focus:border-stone-400"
              />
            </div>

            {/* Solo Vencidas Toggle */}
            <Button
              variant={soloVencidas ? 'destructive' : 'outline'}
              size="sm"
              className={
                soloVencidas
                  ? 'bg-red-600 hover:bg-red-700 text-white border-red-500 h-9'
                  : 'h-9 border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-stone-800'
              }
              onClick={handleToggleVencidas}
            >
              <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
              Solo Vencidas
              {soloVencidas && (
                <X className="w-3 h-3 ml-1.5" />
              )}
            </Button>

            {/* Refresh */}
            <Button
              variant="outline"
              size="sm"
              className="h-9 border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-stone-800"
              onClick={fetchData}
              disabled={loading}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ==================== DATA TABLE ==================== */}
      <Card className="bg-white shadow-md border-0">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-semibold text-stone-800">
              Pagos y Saldos
            </h3>
          </div>
          <span className="text-xs text-stone-500">
            {loading
              ? 'Cargando...'
              : `${filtered.length} facturas${searchTerm ? ` (filtradas de ${facturas.length})` : ''}`}
          </span>
        </div>

        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-stone-100 border-b border-stone-200">
                <th className="text-left px-3 py-2.5 text-stone-500 text-xs uppercase tracking-wider font-semibold whitespace-nowrap">
                  Tropa
                </th>
                <th className="text-left px-3 py-2.5 text-stone-500 text-xs uppercase tracking-wider font-semibold whitespace-nowrap">
                  N° Factura
                </th>
                <th className="text-left px-3 py-2.5 text-stone-500 text-xs uppercase tracking-wider font-semibold whitespace-nowrap">
                  Cliente
                </th>
                <th className="text-left px-3 py-2.5 text-stone-500 text-xs uppercase tracking-wider font-semibold whitespace-nowrap">
                  Fecha Emisión
                </th>
                <th className="text-right px-3 py-2.5 text-stone-500 text-xs uppercase tracking-wider font-semibold whitespace-nowrap">
                  Total Factura
                </th>
                <th className="text-right px-3 py-2.5 text-stone-500 text-xs uppercase tracking-wider font-semibold whitespace-nowrap">
                  Total Pagado
                </th>
                <th className="text-right px-3 py-2.5 text-stone-500 text-xs uppercase tracking-wider font-semibold whitespace-nowrap">
                  Saldo Pendiente
                </th>
                <th className="text-center px-3 py-2.5 text-stone-500 text-xs uppercase tracking-wider font-semibold whitespace-nowrap">
                  Plazo (días)
                </th>
                <th className="text-center px-3 py-2.5 text-stone-500 text-xs uppercase tracking-wider font-semibold whitespace-nowrap">
                  Días Transc.
                </th>
                <th className="text-center px-3 py-2.5 text-stone-500 text-xs uppercase tracking-wider font-semibold whitespace-nowrap">
                  Estado
                </th>
                <th className="text-center px-3 py-2.5 text-stone-500 text-xs uppercase tracking-wider font-semibold whitespace-nowrap">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="text-center py-16">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-500" />
                    <p className="mt-3 text-stone-400 text-sm">
                      Cargando datos de pagos y saldos...
                    </p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-16">
                    <Receipt className="w-12 h-12 mx-auto mb-3 text-stone-300" />
                    <p className="text-stone-500 text-sm">
                      {soloVencidas
                        ? 'No hay facturas vencidas'
                        : searchTerm
                          ? 'No se encontraron facturas con el filtro aplicado'
                          : 'No hay facturas emitidas pendientes'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((f) => {
                  const isVencido = f.estadoPago === 'VENCIDO'
                  return (
                    <tr
                      key={f.id}
                      className={`border-b border-stone-100 transition-colors hover:bg-stone-50 ${
                        isVencido ? 'bg-red-50/50' : ''
                      }`}
                    >
                      {/* Tropa */}
                      <td className="px-3 py-2.5">
                        <span className="font-mono font-semibold text-stone-600">
                          {f.planillasFactura?.[0]?.numeroTropa ?? '-'}
                        </span>
                      </td>

                      {/* N° Factura */}
                      <td className="px-3 py-2.5">
                        <span className="font-mono font-semibold text-stone-800">
                          {f.numero}
                        </span>
                      </td>

                      {/* Cliente */}
                      <td className="px-3 py-2.5">
                        <div>
                          <p className="text-stone-700 font-medium">
                            {f.cliente.nombre}
                          </p>
                          {f.cliente.cuit && (
                            <p className="text-stone-400 text-[10px] font-mono">
                              {f.cliente.cuit}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Fecha Emisión */}
                      <td className="px-3 py-2.5 text-stone-500 whitespace-nowrap">
                        {formatDate(f.fecha)}
                      </td>

                      {/* Total Factura */}
                      <td className="px-3 py-2.5 text-right font-mono text-stone-700 whitespace-nowrap">
                        {formatCurrency(f.total)}
                      </td>

                      {/* Total Pagado */}
                      <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                        <span
                          className={
                            f.totalPagado > 0
                              ? 'text-emerald-600 font-semibold'
                              : 'text-stone-400'
                          }
                        >
                          {formatCurrency(f.totalPagado)}
                        </span>
                      </td>

                      {/* Saldo Pendiente */}
                      <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                        <span
                          className={
                            f.saldoPendiente > 0
                              ? 'text-red-600 font-bold'
                              : 'text-emerald-600'
                          }
                        >
                          {formatCurrency(f.saldoPendiente)}
                        </span>
                      </td>

                      {/* Plazo */}
                      <td className="px-3 py-2.5 text-center text-stone-500">
                        {f.plazoPagoDias}
                      </td>

                      {/* Días Transcurridos */}
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={
                            f.diasTranscurridos > f.plazoPagoDias
                              ? 'text-red-600 font-bold'
                              : f.diasTranscurridos >= f.plazoPagoDias - 5
                                ? 'text-amber-600 font-semibold'
                                : 'text-stone-500'
                          }
                        >
                          {f.diasTranscurridos}
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="px-3 py-2.5 text-center">
                        <EstadoBadge estado={f.estadoPago} />
                      </td>

                      {/* Acciones */}
                      <td className="px-3 py-2.5 text-center">
                        {f.saldoPendiente > 0 && f.estadoPago !== 'PAGADO' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            onClick={() => handleOpenPago(f)}
                          >
                            <CreditCard className="w-3.5 h-3.5 mr-1" />
                            Pagar
                          </Button>
                        )}
                        {f.estadoPago === 'PAGADO' && (
                          <span className="inline-flex items-center gap-1 text-emerald-500/70 text-[10px]">
                            <CheckCircle className="w-3 h-3" />
                            OK
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {paginacion && paginacion.totalPaginas > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-stone-200">
            <span className="text-xs text-stone-400">
              Mostrando {(paginacion.pagina - 1) * paginacion.limite + 1}-
              {Math.min(
                paginacion.pagina * paginacion.limite,
                paginacion.total
              )}{' '}
              de {paginacion.total}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-stone-500 border-stone-200 hover:bg-stone-100"
                disabled={paginacion.pagina <= 1}
                onClick={() => setPagina(1)}
              >
                «
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-stone-500 border-stone-200 hover:bg-stone-100"
                disabled={paginacion.pagina <= 1}
                onClick={() => setPagina((p) => p - 1)}
              >
                ‹
              </Button>
              <span className="text-xs text-stone-600 px-2">
                {paginacion.pagina} / {paginacion.totalPaginas}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-stone-500 border-stone-200 hover:bg-stone-100"
                disabled={paginacion.pagina >= paginacion.totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
              >
                ›
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-stone-500 border-stone-200 hover:bg-stone-100"
                disabled={paginacion.pagina >= paginacion.totalPaginas}
                onClick={() => setPagina(paginacion.totalPaginas)}
              >
                »
              </Button>
            </div>
          </div>
        )}

        {/* Totals Footer */}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-stone-200 bg-stone-50 text-xs">
            <div className="flex flex-wrap gap-4 items-center text-stone-500">
              <span className="font-semibold text-stone-600">
                {filtered.length} factura{filtered.length !== 1 ? 's' : ''}
              </span>
              <span>
                Total:{' '}
                <strong className="text-stone-800">
                  {formatCurrency(filtered.reduce((s, f) => s + f.total, 0))}
                </strong>
              </span>
              <span>
                Pagado:{' '}
                <strong className="text-emerald-600">
                  {formatCurrency(filtered.reduce((s, f) => s + f.totalPagado, 0))}
                </strong>
              </span>
              <span>
                Saldo:{' '}
                <strong className="text-red-600">
                  {formatCurrency(filtered.reduce((s, f) => s + f.saldoPendiente, 0))}
                </strong>
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* ==================== REGISTRAR PAGO DIALOG ==================== */}
      <Dialog open={pagoOpen} onOpenChange={setPagoOpen}>
        <DialogContent className="max-w-md bg-white border-stone-200 text-stone-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="p-1.5 bg-emerald-500/20 rounded-lg">
                <CreditCard className="w-5 h-5 text-emerald-600" />
              </div>
              Registrar Pago
            </DialogTitle>
            <DialogDescription className="text-stone-500">
              Registre un pago para la factura seleccionada
            </DialogDescription>
          </DialogHeader>

          {facturaSeleccionada && (
            <div className="space-y-4">
              {/* Factura summary */}
              <div className="bg-stone-50 rounded-lg p-3 space-y-1.5 border border-stone-200">
                <div className="flex justify-between text-xs">
                  <span className="text-stone-500">Factura:</span>
                  <span className="font-mono font-semibold text-stone-800">
                    {facturaSeleccionada.numero}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-stone-500">Cliente:</span>
                  <span className="font-medium text-stone-800">
                    {facturaSeleccionada.cliente.nombre}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-stone-500">Total Factura:</span>
                  <span className="font-mono text-stone-700">
                    {formatCurrency(facturaSeleccionada.total)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-stone-500">Ya Pagado:</span>
                  <span className="font-mono text-emerald-600">
                    {formatCurrency(facturaSeleccionada.totalPagado)}
                  </span>
                </div>
                <div className="border-t border-stone-200 pt-1.5 flex justify-between text-sm">
                  <span className="text-stone-700 font-semibold">
                    Saldo Pendiente:
                  </span>
                  <span className="font-mono font-bold text-red-600">
                    {formatCurrency(facturaSeleccionada.saldoPendiente)}
                  </span>
                </div>
              </div>

              {/* Monto */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-stone-700">
                  Monto a Pagar
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={pagoData.monto || ''}
                  onChange={(e) =>
                    setPagoData({
                      ...pagoData,
                      monto: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="h-10 bg-white border-stone-300 text-stone-800 font-mono text-lg font-bold focus:border-emerald-500"
                />
                {facturaSeleccionada &&
                  pagoData.monto > facturaSeleccionada.saldoPendiente && (
                    <p className="text-[10px] text-amber-600">
                      ⚠ El monto excede el saldo pendiente de{' '}
                      {formatCurrency(facturaSeleccionada.saldoPendiente)}
                    </p>
                  )}
              </div>

              {/* Método de pago */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-stone-700">
                  Método de Pago
                </Label>
                <Select
                  value={pagoData.metodoPago}
                  onValueChange={(v) =>
                    setPagoData({ ...pagoData, metodoPago: v })
                  }
                >
                  <SelectTrigger className="h-10 bg-white border-stone-300 text-stone-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-stone-200">
                    {METODOS_PAGO.map((m) => (
                      <SelectItem
                        key={m.value}
                        value={m.value}
                        className="text-stone-800 focus:bg-stone-100 focus:text-stone-900"
                      >
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fecha */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-stone-700">
                  Fecha del Pago
                </Label>
                <Input
                  type="date"
                  value={pagoData.fecha}
                  onChange={(e) =>
                    setPagoData({ ...pagoData, fecha: e.target.value })
                  }
                  className="h-10 bg-white border-stone-300 text-stone-800"
                />
              </div>

              {/* Referencia + Banco */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-stone-700">
                    Referencia
                  </Label>
                  <Input
                    value={pagoData.referencia}
                    onChange={(e) =>
                      setPagoData({ ...pagoData, referencia: e.target.value })
                    }
                    placeholder="N° transacción"
                    className="h-9 bg-stone-50 border-stone-300 text-stone-800 placeholder:text-stone-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-stone-700">
                    Banco
                  </Label>
                  <Input
                    value={pagoData.banco}
                    onChange={(e) =>
                      setPagoData({ ...pagoData, banco: e.target.value })
                    }
                    placeholder="Nombre del banco"
                    className="h-9 bg-stone-50 border-stone-300 text-stone-800 placeholder:text-stone-400"
                  />
                </div>
              </div>

              {/* Observaciones */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-stone-700">
                  Observaciones
                </Label>
                <Textarea
                  value={pagoData.observaciones}
                  onChange={(e) =>
                    setPagoData({ ...pagoData, observaciones: e.target.value })
                  }
                  placeholder="Observaciones del pago (opcional)..."
                  rows={2}
                  className="bg-stone-50 border-stone-300 text-stone-800 placeholder:text-stone-400 resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setPagoOpen(false)}
              className="border-stone-200 text-stone-600 hover:bg-stone-100"
            >
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleRegistrarPago}
              disabled={
                saving ||
                !pagoData.monto ||
                pagoData.monto <= 0
              }
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-1.5" />
              )}
              Registrar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
