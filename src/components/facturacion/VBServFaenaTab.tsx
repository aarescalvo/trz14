'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle, XCircle, Eye, Plus, Package, Search,
  Loader2, ChevronDown, ChevronRight, RefreshCw,
  AlertCircle, Clock, FileCheck, FileText,
  Ban, Trash2, Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

// ==================== TYPES ====================
interface TropaRel {
  id: string
  numero: number
  codigo?: string | null
  estado?: string | null
  cantidadCabezas?: number | null
  kgGancho?: number | null
  rindePorcentaje?: number | null
}

interface UsuarioFaenaRel {
  id: string
  nombre: string
  razonSocial?: string | null
  cuit?: string | null
}

interface ItemExtra {
  id: string
  planillaServicioFaenaId: string
  tipoItem: string
  descripcion?: string | null
  cantidadKg: number
  precioUnitario: number
  subtotal: number
  createdAt: string
  updatedAt: string
}

interface PlanillaVB {
  id: string
  tropaId?: string | null
  tropa?: TropaRel | null
  numeroTropa: number
  usuarioFaenaId?: string | null
  usuarioFaena?: UsuarioFaenaRel | null
  usuario: string
  cantidadAnimales: number
  kgPie: number
  fechaFaena: string
  kgGancho: number
  rindePorcentaje: number
  precioServicioKg: number
  precioServicioKgConRecupero?: number | null
  totalServicioIva: number
  tasaInspeccionVet: number
  arancelIpcva: number
  totalFacturaImp: number
  estado: string
  plazoPagoDias?: number | null
  numeroFactura?: string | null
  fechaFactura?: string | null
  facturaId?: string | null
  fechaPago?: string | null
  diasPago?: number | null
  montoDepositado?: number | null
  estadoPago: number
  observaciones?: string | null
  itemsExtras: ItemExtra[]
  createdAt: string
  updatedAt: string
  // Enriched fields from API
  romaneoKgGancho?: number | null
  romaneoRinde?: number | null
  effectiveKgGancho?: number | null
  effectiveRinde?: number | null
}

interface Counts {
  BORRADOR: number
  APROBADO: number
  FACTURADO: number
}

interface ToastNotification {
  id: string
  message: string
  type: 'success' | 'error'
}

interface Props {
  operador: any
}

// ==================== HELPERS ====================
const currencyFmt = (amount: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

const numberFmt = (amount: number, decimals: number = 0) =>
  new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)

const dateFmt = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('es-AR')
}

const TIPO_ITEM_OPTIONS = [
  { value: 'CHINCHULIN', label: 'Chinchulín' },
  { value: 'CUARTEO', label: 'Cuarteo' },
  { value: 'DESPOSTADA', label: 'Despostada' },
  { value: 'OTRO', label: 'Otro' },
]

// ==================== COMPONENT ====================
export function VBServFaenaTab({ operador }: Props) {
  // Data state
  const [planillas, setPlanillas] = useState<PlanillaVB[]>([])
  const [counts, setCounts] = useState<Counts>({ BORRADOR: 0, APROBADO: 0, FACTURADO: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Filter state
  const [filterEstado, setFilterEstado] = useState<'BORRADOR' | 'APROBADO'>('BORRADOR')
  const [searchTerm, setSearchTerm] = useState('')

  // Pagination
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const limite = 50

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Expanded rows
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Toast notifications (custom simple state)
  const [toasts, setToasts] = useState<ToastNotification[]>([])

  // Add Item Extra dialog
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false)
  const [addItemTargetId, setAddItemTargetId] = useState<string | null>(null)
  const [addItemTargetTropa, setAddItemTargetTropa] = useState<number>(0)
  const [newItemForm, setNewItemForm] = useState({
    tipoItem: '',
    cantidadKg: '',
    descripcion: '',
  })

  // ==================== TOAST HELPERS ====================
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }

  // ==================== DATA FETCHING ====================
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('estado', filterEstado)
      if (searchTerm) params.set('search', searchTerm)
      params.set('pagina', String(pagina))
      params.set('limite', String(limite))

      const res = await fetch(`/api/facturacion/planilla-servicio-faena/vb?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setPlanillas(data.data || [])
        setCounts(data.counts || { BORRADOR: 0, APROBADO: 0, FACTURADO: 0 })
        setTotalPaginas(data.paginacion?.totalPaginas || 1)
      } else {
        showToast(data.error || 'Error al cargar datos', 'error')
      }
    } catch (error) {
      console.error('Error:', error)
      showToast('Error de conexión al cargar datos', 'error')
    } finally {
      setLoading(false)
    }
  }, [filterEstado, searchTerm, pagina])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Reset page on filter/search change
  useEffect(() => {
    setPagina(1)
    setSelectedIds(new Set())
  }, [filterEstado, searchTerm])

  // ==================== SELECTION HANDLERS ====================
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === planillas.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(planillas.map((p) => p.id)))
    }
  }

  // ==================== EXPAND HANDLERS ====================
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ==================== APPROVE / DISAPPROVE ====================
  const handleApproveSelected = async () => {
    if (selectedIds.size === 0) {
      showToast('Seleccione al menos una planilla', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/facturacion/planilla-servicio-faena/vb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: 'APROBAR' }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`${data.count} planilla(s) aprobada(s) exitosamente`)
        setSelectedIds(new Set())
        fetchData()
      } else {
        showToast(data.error || 'Error al aprobar planillas', 'error')
      }
    } catch {
      showToast('Error de conexión al aprobar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDisapprove = async (planilla: PlanillaVB) => {
    if (planilla.estado !== 'APROBADO') return
    setSaving(true)
    try {
      const res = await fetch('/api/facturacion/planilla-servicio-faena/vb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [planilla.id], action: 'DESAPROBAR' }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Tropa N° ${planilla.numeroTropa} revertida a BORRADOR`)
        fetchData()
      } else {
        showToast(data.error || 'Error al desaprobar', 'error')
      }
    } catch {
      showToast('Error de conexión al desaprobar', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ==================== ADD ITEM EXTRA ====================
  const openAddItemDialog = (planilla: PlanillaVB) => {
    setAddItemTargetId(planilla.id)
    setAddItemTargetTropa(planilla.numeroTropa)
    setNewItemForm({ tipoItem: '', cantidadKg: '', descripcion: '' })
    setAddItemDialogOpen(true)
  }

  const handleAddItemExtra = async () => {
    if (!addItemTargetId || !newItemForm.tipoItem || !newItemForm.cantidadKg) {
      showToast('Complete tipo y cantidad (kg)', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/facturacion/planilla-servicio-faena/${addItemTargetId}/items-extras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoItem: newItemForm.tipoItem,
          cantidadKg: parseFloat(newItemForm.cantidadKg) || 0,
          descripcion: newItemForm.descripcion || null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(`Item extra agregado a Tropa N° ${addItemTargetTropa}`)
        setAddItemDialogOpen(false)
        fetchData()
      } else {
        showToast(data.error || 'Error al agregar item extra', 'error')
      }
    } catch {
      showToast('Error de conexión', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ==================== RENDER ====================
  return (
    <div className="space-y-4">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-in slide-in-from-right fade-in ${
              t.type === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {t.type === 'success' ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span className="break-words">{t.message}</span>
          </div>
        ))}
      </div>

      {/* ==================== KPI CARDS ==================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Borrador */}
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                  Borrador
                </p>
                <p className="text-xl font-bold text-amber-600">{counts.BORRADOR}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Aprobado */}
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                  Aprobado
                </p>
                <p className="text-xl font-bold text-emerald-600">{counts.APROBADO}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Facturado */}
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                  Facturado
                </p>
                <p className="text-xl font-bold text-blue-600">{counts.FACTURADO}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Refresh */}
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="w-full h-full text-stone-600 hover:text-stone-800 hover:bg-stone-100"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              <span className="ml-2 text-sm">Actualizar</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ==================== FILTER BAR ==================== */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Toggle Buttons */}
        <div className="flex rounded-lg overflow-hidden border border-stone-300">
          <button
            onClick={() => setFilterEstado('BORRADOR')}
            className={`px-4 py-2 text-xs font-semibold transition-colors ${
              filterEstado === 'BORRADOR'
                ? 'bg-amber-500 text-white'
                : 'bg-white text-stone-600 hover:bg-stone-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5 inline-block mr-1" />
            Borrador ({counts.BORRADOR})
          </button>
          <button
            onClick={() => setFilterEstado('APROBADO')}
            className={`px-4 py-2 text-xs font-semibold transition-colors border-l border-stone-300 ${
              filterEstado === 'APROBADO'
                ? 'bg-emerald-500 text-white'
                : 'bg-white text-stone-600 hover:bg-stone-100'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5 inline-block mr-1" />
            Aprobado ({counts.APROBADO})
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <Input
            placeholder="Buscar por cliente o N° tropa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 bg-white border-stone-300 text-stone-800 text-sm placeholder:text-stone-400 focus:ring-amber-500"
          />
        </div>

        {/* Approve Button */}
        {selectedIds.size > 0 && filterEstado === 'BORRADOR' && (
          <Button
            onClick={handleApproveSelected}
            disabled={saving}
            className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-sm shrink-0"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-1.5" />
            )}
            Aprobar seleccionadas ({selectedIds.size})
          </Button>
        )}
      </div>

      {/* ==================== DATA TABLE ==================== */}
      <Card className="border-0 shadow-md bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="w-10 px-3 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={planillas.length > 0 && selectedIds.size === planillas.length}
                    onChange={toggleSelectAll}
                    className="rounded border-stone-300 bg-stone-100 text-amber-500 focus:ring-amber-500 h-4 w-4"
                  />
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider min-w-[80px]">
                  N° Tropa
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider min-w-[140px]">
                  Cliente
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider min-w-[65px]">
                  Cabezas
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-stone-500 uppercase tracking-wider min-w-[90px]">
                  KG Gancho
                </th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-stone-500 uppercase tracking-wider min-w-[75px]">
                  Rinde %
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider min-w-[85px]">
                  Fecha Faena
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider min-w-[65px]">
                  Items Ext.
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider min-w-[80px]">
                  Estado
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider min-w-[100px]">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-12">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-500" />
                    <p className="mt-2 text-stone-500 text-sm">Cargando datos...</p>
                  </td>
                </tr>
              ) : planillas.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-stone-400">
                    <Package className="w-12 h-12 mx-auto mb-3 text-stone-300" />
                    <p className="text-sm font-medium">No hay planillas en estado {filterEstado}</p>
                    <p className="text-xs text-stone-300 mt-1">
                      {filterEstado === 'BORRADOR'
                        ? 'Las planillas nuevas aparecen aquí para su aprobación.'
                        : 'Las planillas aprobadas pero aún no facturadas se muestran aquí.'}
                    </p>
                  </td>
                </tr>
              ) : (
                planillas.map((planilla) => {
                  const isExpanded = expandedIds.has(planilla.id)
                  const isSelected = selectedIds.has(planilla.id)
                  const displayKgGancho = planilla.effectiveKgGancho ?? planilla.kgGancho
                  const displayRinde = planilla.effectiveRinde ?? planilla.rindePorcentaje

                  return (
                    <tr key={planilla.id}>
                      {/* Main Row */}
                      <td colSpan={10}>
                        <div className={isExpanded ? '' : ''}>
                          {/* Row content */}
                          <div className="flex items-center">
                            <div className="w-10 px-3 py-2.5 flex items-center justify-center shrink-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(planilla.id)}
                                disabled={planilla.estado !== 'BORRADOR'}
                                className="rounded border-stone-300 bg-stone-100 text-amber-500 focus:ring-amber-500 h-4 w-4 disabled:opacity-40"
                              />
                            </div>
                            <div className="flex-1 grid grid-cols-8 items-center gap-0 min-w-0">
                              {/* N° Tropa */}
                              <div className="px-3 py-2.5">
                                <span className="font-mono font-bold text-stone-800 text-sm">
                                  {planilla.numeroTropa}
                                </span>
                              </div>
                              {/* Cliente */}
                              <div className="px-3 py-2.5 min-w-0">
                                <p className="text-sm text-stone-700 truncate">
                                  {planilla.usuarioFaena?.razonSocial ||
                                    planilla.usuarioFaena?.nombre ||
                                    planilla.usuario}
                                </p>
                                {planilla.usuarioFaena?.cuit && (
                                  <p className="text-[10px] text-stone-400">
                                    CUIT: {planilla.usuarioFaena.cuit}
                                  </p>
                                )}
                              </div>
                              {/* Cabezas */}
                              <div className="px-3 py-2.5 text-center">
                                <span className="text-sm text-stone-600">
                                  {planilla.cantidadAnimales || '-'}
                                </span>
                              </div>
                              {/* KG Gancho */}
                              <div className="px-3 py-2.5 text-right">
                                <span className="text-sm text-stone-600 font-mono">
                                  {displayKgGancho != null ? numberFmt(displayKgGancho, 1) : '-'}
                                </span>
                              </div>
                              {/* Rinde % */}
                              <div className="px-3 py-2.5 text-right">
                                <span className="text-sm text-stone-600 font-mono">
                                  {displayRinde != null ? `${displayRinde.toFixed(1)}%` : '-'}
                                </span>
                              </div>
                              {/* Fecha Faena */}
                              <div className="px-3 py-2.5">
                                <span className="text-sm text-stone-600 whitespace-nowrap">
                                  {dateFmt(planilla.fechaFaena)}
                                </span>
                              </div>
                              {/* Items Extra */}
                              <div className="px-3 py-2.5 text-center">
                                {planilla.itemsExtras.length > 0 ? (
                                  <Badge className="bg-purple-500/20 text-purple-600 border-0 text-[10px] py-0 px-1.5">
                                    <Package className="w-3 h-3 mr-0.5" />
                                    {planilla.itemsExtras.length}
                                  </Badge>
                                ) : (
                                  <span className="text-stone-300 text-xs">-</span>
                                )}
                              </div>
                              {/* Estado + Acciones */}
                              <div className="px-3 py-2.5 flex items-center justify-center gap-2">
                                {/* Estado Badge */}
                                {planilla.estado === 'BORRADOR' ? (
                                  <Badge className="bg-stone-200 text-stone-700 border-0 text-[10px] py-0 px-1.5">
                                    <Clock className="w-3 h-3 mr-0.5" />
                                    Borrador
                                  </Badge>
                                ) : planilla.estado === 'APROBADO' ? (
                                  <Badge className="bg-emerald-500/20 text-emerald-600 border-0 text-[10px] py-0 px-1.5">
                                    <CheckCircle className="w-3 h-3 mr-0.5" />
                                    Aprobado
                                  </Badge>
                                ) : (
                                  <Badge className="bg-blue-500/20 text-blue-600 border-0 text-[10px] py-0 px-1.5">
                                    <FileText className="w-3 h-3 mr-0.5" />
                                    Facturado
                                  </Badge>
                                )}
                                {/* Desaprobar button (only APROBADO) */}
                                {planilla.estado === 'APROBADO' && (
                                  <button
                                    onClick={() => handleDisapprove(planilla)}
                                    disabled={saving}
                                    title="Revertir a Borrador"
                                    className="p-1 rounded hover:bg-red-500/20 text-red-500 hover:text-red-500 transition-colors disabled:opacity-40"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                            {/* Expand button */}
                            <div className="w-10 px-3 py-2.5 flex items-center justify-center shrink-0">
                              <button
                                onClick={() => toggleExpand(planilla.id)}
                                className="p-1 rounded hover:bg-stone-100 text-stone-500 hover:text-stone-700 transition-colors"
                                title={isExpanded ? 'Colapsar' : 'Expandir'}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* ==================== EXPANDED ROW ==================== */}
                          {isExpanded && (
                            <div className="border-t border-stone-200 bg-stone-50 px-4 py-3 mt-0">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Details */}
                                <div className="space-y-2">
                                  <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                                    Detalles de la Planilla
                                  </h4>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-stone-400">KG Pie:</span>
                                      <span className="text-stone-600 font-mono">
                                        {numberFmt(planilla.kgPie, 1)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-stone-400">KG Gancho (Planilla):</span>
                                      <span className="text-stone-600 font-mono">
                                        {numberFmt(planilla.kgGancho, 1)}
                                      </span>
                                    </div>
                                    {planilla.romaneoKgGancho != null && (
                                      <div className="flex justify-between">
                                        <span className="text-stone-400">KG Gancho (Romaneo):</span>
                                        <span className="text-purple-600 font-mono">
                                          {numberFmt(planilla.romaneoKgGancho, 1)}
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex justify-between">
                                      <span className="text-stone-400">Rinde (Planilla):</span>
                                      <span className="text-stone-600 font-mono">
                                        {planilla.rindePorcentaje?.toFixed(1)}%
                                      </span>
                                    </div>
                                    {planilla.romaneoRinde != null && (
                                      <div className="flex justify-between">
                                        <span className="text-stone-400">Rinde (Romaneo):</span>
                                        <span className="text-purple-600 font-mono">
                                          {planilla.romaneoRinde?.toFixed(1)}%
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex justify-between">
                                      <span className="text-stone-400">Precio $/kg:</span>
                                      <span className="text-stone-600 font-mono">
                                        {currencyFmt(planilla.precioServicioKg)}
                                      </span>
                                    </div>
                                    {planilla.precioServicioKgConRecupero != null && (
                                      <div className="flex justify-between">
                                        <span className="text-stone-400">Precio c/Recupero:</span>
                                        <span className="text-stone-600 font-mono">
                                          {currencyFmt(planilla.precioServicioKgConRecupero)}
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex justify-between">
                                      <span className="text-stone-400">Total Serv. + IVA:</span>
                                      <span className="text-stone-600 font-mono">
                                        {currencyFmt(planilla.totalServicioIva)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-stone-400">Tasa Insp. Vet.:</span>
                                      <span className="text-stone-600 font-mono">
                                        {currencyFmt(planilla.tasaInspeccionVet)}/cabeza
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-stone-400">Arancel IPCVA:</span>
                                      <span className="text-stone-600 font-mono">
                                        {currencyFmt(planilla.arancelIpcva)}/cabeza
                                      </span>
                                    </div>
                                    <div className="flex justify-between col-span-2 border-t border-stone-200 pt-1.5">
                                      <span className="text-emerald-600 font-semibold">
                                        Total Fact. c/Imp.:
                                      </span>
                                      <span className="text-emerald-600 font-bold font-mono">
                                        {currencyFmt(planilla.totalFacturaImp)}
                                      </span>
                                    </div>
                                    {planilla.plazoPagoDias != null && (
                                      <div className="flex justify-between">
                                        <span className="text-stone-400">Plazo Pago:</span>
                                        <span className="text-stone-600">
                                          {planilla.plazoPagoDias} días
                                        </span>
                                      </div>
                                    )}
                                    {planilla.observaciones && (
                                      <div className="flex justify-between col-span-2">
                                        <span className="text-stone-400">Obs:</span>
                                        <span className="text-stone-500 text-[11px]">
                                          {planilla.observaciones}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Items Extras */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                                      Items Extras
                                    </h4>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openAddItemDialog(planilla)}
                                      className="h-7 text-xs text-amber-600 hover:text-amber-600 hover:bg-amber-500/10"
                                    >
                                      <Plus className="w-3 h-3 mr-1" />
                                      Agregar
                                    </Button>
                                  </div>
                                  {planilla.itemsExtras.length === 0 ? (
                                    <p className="text-xs text-stone-300 italic py-2">
                                      Sin items extras cargados.
                                    </p>
                                  ) : (
                                    <div className="space-y-1 max-h-40 overflow-y-auto rounded-lg">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="bg-white">
                                            <th className="px-2 py-1.5 text-left text-stone-500 font-medium">
                                              Tipo
                                            </th>
                                            <th className="px-2 py-1.5 text-left text-stone-500 font-medium">
                                              Descripción
                                            </th>
                                            <th className="px-2 py-1.5 text-right text-stone-500 font-medium">
                                              Kg
                                            </th>
                                            <th className="px-2 py-1.5 text-right text-stone-500 font-medium">
                                              Precio/u
                                            </th>
                                            <th className="px-2 py-1.5 text-right text-stone-500 font-medium">
                                              Subtotal
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-200">
                                          {planilla.itemsExtras.map((item) => (
                                            <tr key={item.id} className="hover:bg-stone-50">
                                              <td className="px-2 py-1.5">
                                                <Badge
                                                  className={`text-[9px] py-0 px-1.5 border-0 ${
                                                    item.tipoItem === 'CHINCHULIN'
                                                      ? 'bg-red-500/15 text-red-500'
                                                      : item.tipoItem === 'CUARTEO'
                                                        ? 'bg-orange-500/15 text-orange-600'
                                                        : item.tipoItem === 'DESPOSTADA'
                                                          ? 'bg-teal-500/15 text-teal-600'
                                                          : 'bg-stone-300/15 text-stone-600'
                                                  }`}
                                                >
                                                  {item.tipoItem}
                                                </Badge>
                                              </td>
                                              <td className="px-2 py-1.5 text-stone-500 truncate max-w-[100px]">
                                                {item.descripcion || '-'}
                                              </td>
                                              <td className="px-2 py-1.5 text-right text-stone-600 font-mono">
                                                {numberFmt(item.cantidadKg, 1)}
                                              </td>
                                              <td className="px-2 py-1.5 text-right text-stone-400 font-mono">
                                                {item.precioUnitario > 0
                                                  ? currencyFmt(item.precioUnitario)
                                                  : 'Pendiente'}
                                              </td>
                                              <td className="px-2 py-1.5 text-right text-stone-600 font-mono font-medium">
                                                {item.subtotal > 0
                                                  ? currencyFmt(item.subtotal)
                                                  : '-'}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ==================== PAGINATION ==================== */}
        {!loading && totalPaginas > 1 && (
          <div className="flex items-center justify-between border-t border-stone-200 px-4 py-3">
            <p className="text-xs text-stone-400">
              Página {pagina} de {totalPaginas}
            </p>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina <= 1}
                className="h-8 text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100"
              >
                Anterior
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={pagina >= totalPaginas}
                className="h-8 text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100"
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}

        {/* Footer summary */}
        {!loading && planillas.length > 0 && (
          <div className="border-t border-stone-200 px-4 py-2 bg-stone-100/50 text-xs flex flex-wrap gap-4 items-center">
            <span className="text-stone-500 font-semibold">
              {planillas.length} planilla(s)
            </span>
            <span className="text-stone-400">
              Cabezas:{' '}
              <strong className="text-stone-600">
                {numberFmt(planillas.reduce((s, p) => s + p.cantidadAnimales, 0))}
              </strong>
            </span>
            <span className="text-stone-400">
              KG Gancho:{' '}
              <strong className="text-stone-600">
                {numberFmt(
                  planillas.reduce((s, p) => s + (p.effectiveKgGancho ?? p.kgGancho), 0),
                  1,
                )}
              </strong>
            </span>
            <span className="text-emerald-600 font-bold">
              Total Fact.: {currencyFmt(planillas.reduce((s, p) => s + p.totalFacturaImp, 0))}
            </span>
          </div>
        )}
      </Card>

      {/* ==================== ADD ITEM EXTRA DIALOG ==================== */}
      <Dialog open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen}>
        <DialogContent className="bg-white border-stone-200 text-stone-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-stone-800 flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              Agregar Item Extra
            </DialogTitle>
            <DialogDescription className="text-stone-500">
              Tropa N° {addItemTargetTropa} — El precio se carga en el paso siguiente (Carga Datos
              Faena).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Tipo Item */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-stone-600">
                Tipo de Item <span className="text-red-500">*</span>
              </Label>
              <Select
                value={newItemForm.tipoItem}
                onValueChange={(val) =>
                  setNewItemForm((prev) => ({ ...prev, tipoItem: val }))
                }
              >
                <SelectTrigger className="bg-white border-stone-300 text-stone-800 h-9 text-sm">
                  <SelectValue placeholder="Seleccionar tipo..." />
                </SelectTrigger>
                <SelectContent className="bg-white border-stone-300">
                  {TIPO_ITEM_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-stone-700">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cantidad Kg */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-stone-600">
                Cantidad (kg) <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                step="0.1"
                placeholder="Ej: 150.5"
                value={newItemForm.cantidadKg}
                onChange={(e) =>
                  setNewItemForm((prev) => ({ ...prev, cantidadKg: e.target.value }))
                }
                className="bg-white border-stone-300 text-stone-800 h-9 text-sm"
              />
            </div>

            {/* Descripción (optional) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-stone-600">Descripción</Label>
              <Textarea
                placeholder="Opcional — detalles adicionales..."
                value={newItemForm.descripcion}
                onChange={(e) =>
                  setNewItemForm((prev) => ({ ...prev, descripcion: e.target.value }))
                }
                className="bg-white border-stone-300 text-stone-800 text-sm min-h-[60px]"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setAddItemDialogOpen(false)}
              className="text-stone-600 hover:text-stone-800 hover:bg-stone-100"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAddItemExtra}
              disabled={saving || !newItemForm.tipoItem || !newItemForm.cantidadKg}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-1.5" />
              )}
              Agregar Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default VBServFaenaTab
