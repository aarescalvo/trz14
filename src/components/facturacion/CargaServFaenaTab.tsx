'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  FileCheck, Clock, Package, Search, Loader2, ChevronDown, ChevronRight,
  RefreshCw, AlertCircle, CheckCircle, FileText, DollarSign,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

// ==================== TYPES ====================
interface ItemExtra {
  id: string
  planillaServicioFaenaId: string
  tipoItem: string
  descripcion?: string | null
  cantidadKg: number
  precioUnitario: number
  subtotal: number
}

interface TropaRel {
  id: string
  numero: number
  codigo?: string | null
  estado?: string | null
}

interface UsuarioFaenaRel {
  id: string
  nombre: string
  razonSocial?: string | null
  cuit?: string | null
}

interface PlanillaCarga {
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
  tasaInspeccionVet: number
  arancelIpcva: number
  totalServicioIva: number
  totalFacturaImp: number
  estado: string
  plazoPagoDias?: number | null
  numeroFactura?: string | null
  fechaFactura?: string | null
  facturaId?: string | null
  observaciones?: string | null
  itemsExtras: ItemExtra[]
  // Enriched
  precioSugerido?: number | null
  tasaSugerida?: number | null
}

interface KPIs {
  totalAprobados: number
  facturadasHoy: number
  montoPendienteEstimado: number
}

// Local editing state per row
interface RowEdit {
  precioKg: string
  tasaVet: string
  arancelIpcva: string
  plazoPago: string
  itemExtrasEdit: Record<string, string> // itemId -> precioUnitario string
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

const todayStr = () => new Date().toISOString().split('T')[0]

// ==================== COMPONENT ====================
export function CargaServFaenaTab({ operador }: Props) {
  // Data
  const [planillas, setPlanillas] = useState<PlanillaCarga[]>([])
  const [kpis, setKpis] = useState<KPIs>({ totalAprobados: 0, facturadasHoy: 0, montoPendienteEstimado: 0 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Filter
  const [searchTerm, setSearchTerm] = useState('')

  // Pagination
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const limite = 50

  // Expanded rows
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Per-row editing
  const [rowEdits, setRowEdits] = useState<Record<string, RowEdit>>({})

  // Facturar dialog
  const [facturarOpen, setFacturarOpen] = useState(false)
  const [facturarTarget, setFacturarTarget] = useState<PlanillaCarga | null>(null)
  const [facturaNumero, setFacturaNumero] = useState('')
  const [facturaFecha, setFacturaFecha] = useState(todayStr())
  const [facturaObs, setFacturaObs] = useState('')

  // ==================== DATA FETCHING ====================
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.set('search', searchTerm)
      params.set('pagina', String(pagina))
      params.set('limite', String(limite))

      const res = await fetch(`/api/facturacion/planilla-servicio-faena/carga?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setPlanillas(data.data || [])
        setTotalPaginas(data.paginacion?.totalPaginas || 1)
        setKpis(data.kpis || { totalAprobados: 0, facturadasHoy: 0, montoPendienteEstimado: 0 })

        // Initialize row edits for new planillas
        const newEdits: Record<string, RowEdit> = {}
        for (const p of data.data || []) {
          if (!rowEdits[p.id]) {
            newEdits[p.id] = {
              precioKg: p.precioSugerido != null ? String(p.precioSugerido) : '',
              tasaVet: p.tasaSugerida != null ? String(p.tasaSugerida) : '',
              arancelIpcva: '',
              plazoPago: '30',
              itemExtrasEdit: {},
            }
          }
        }
        if (Object.keys(newEdits).length > 0) {
          setRowEdits((prev) => ({ ...prev, ...newEdits }))
        }
      } else {
        toast.error(data.error || 'Error al cargar datos')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error de conexión al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [searchTerm, pagina])

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, pagina])

  // Reset page on search
  useEffect(() => {
    setPagina(1)
  }, [searchTerm])

  // ==================== ROW EDIT HELPERS ====================
  const getRowEdit = (id: string): RowEdit => {
    return (
      rowEdits[id] || {
        precioKg: '',
        tasaVet: '',
        arancelIpcva: '',
        plazoPago: '30',
        itemExtrasEdit: {},
      }
    )
  }

  const updateRowEdit = (id: string, field: keyof RowEdit, value: string | Record<string, string>) => {
    setRowEdits((prev) => ({
      ...prev,
      [id]: { ...getRowEdit(id), [field]: value },
    }))
  }

  const updateItemExtraPrecio = (planillaId: string, itemId: string, value: string) => {
    const edit = getRowEdit(planillaId)
    updateRowEdit(planillaId, 'itemExtrasEdit', { ...edit.itemExtrasEdit, [itemId]: value })
  }

  // ==================== CALCULATED VALUES PER ROW ====================
  const calcRow = (p: PlanillaCarga, edit: RowEdit) => {
    const precioKg = parseFloat(edit.precioKg) || 0
    const tasaVet = parseFloat(edit.tasaVet) || 0
    const arancel = parseFloat(edit.arancelIpcva) || 0
    const subtotal = p.kgGancho * precioKg
    const subtotalIva = subtotal * 1.21
    const totalTasas = tasaVet * p.cantidadAnimales + arancel * p.cantidadAnimales
    const total = subtotalIva + totalTasas

    // Items extras total
    let itemsTotal = 0
    if (p.itemsExtras && Object.keys(edit.itemExtrasEdit).length > 0) {
      for (const item of p.itemsExtras) {
        const itemPrecio = parseFloat(edit.itemExtrasEdit[item.id]) || 0
        itemsTotal += item.cantidadKg * itemPrecio
      }
    }

    return {
      precioKg,
      tasaVet,
      arancel,
      subtotal,
      subtotalIva,
      totalTasas,
      total: total + itemsTotal,
      itemsTotal,
      isValid: precioKg > 0,
    }
  }

  // ==================== EXPAND ====================
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ==================== FACTURAR DIALOG ====================
  const openFacturar = (planilla: PlanillaCarga) => {
    const edit = getRowEdit(planilla.id)
    const calc = calcRow(planilla, edit)
    if (!calc.isValid) {
      toast.error('Ingrese un precio por kg antes de facturar')
      return
    }
    setFacturarTarget(planilla)
    setFacturaNumero('')
    setFacturaFecha(todayStr())
    setFacturaObs(planilla.observaciones || '')
    setFacturarOpen(true)
  }

  const handleConfirmarFacturacion = async () => {
    if (!facturarTarget || !facturaNumero.trim()) {
      toast.error('Ingrese el número de factura')
      return
    }

    const edit = getRowEdit(facturarTarget.id)
    const calc = calcRow(facturarTarget, edit)

    setSaving(true)
    try {
      const body: any = {
        id: facturarTarget.id,
        precioServicioKg: calc.precioKg,
        tasaInspeccionVet: calc.tasaVet,
        arancelIpcva: calc.arancel,
        plazoPagoDias: parseInt(edit.plazoPago) || 30,
        numeroFactura: facturaNumero.trim(),
        fechaFactura: facturaFecha || undefined,
        observaciones: facturaObs || undefined,
        operadorId: operador?.id,
      }

      // Add items extras with prices
      if (facturarTarget.itemsExtras.length > 0 && Object.keys(edit.itemExtrasEdit).length > 0) {
        body.itemsExtras = facturarTarget.itemsExtras
          .filter((ie) => edit.itemExtrasEdit[ie.id] && parseFloat(edit.itemExtrasEdit[ie.id]) > 0)
          .map((ie) => ({
            id: ie.id,
            precioUnitario: parseFloat(edit.itemExtrasEdit[ie.id]) || 0,
          }))
      }

      const res = await fetch('/api/facturacion/planilla-servicio-faena/carga', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (data.success) {
        toast.success(`Factura ${facturaNumero.trim()} generada para Tropa N° ${facturarTarget.numeroTropa}`)
        setFacturarOpen(false)
        setFacturarTarget(null)
        // Reset row edit for this planilla
        setRowEdits((prev) => {
          const next = { ...prev }
          delete next[facturarTarget.id]
          return next
        })
        fetchData()
      } else {
        toast.error(data.error || 'Error al facturar')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error de conexión al facturar')
    } finally {
      setSaving(false)
    }
  }

  // ==================== RENDER ====================
  return (
    <div className="space-y-4">
      {/* ==================== KPI CARDS ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Aprobados */}
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                  Aprobados Pendientes
                </p>
                <p className="text-xl font-bold text-amber-600">{kpis.totalAprobados}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Facturadas Hoy */}
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <FileCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                  Facturadas Hoy
                </p>
                <p className="text-xl font-bold text-emerald-600">{kpis.facturadasHoy}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Monto Pendiente */}
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                  Monto Pendiente
                </p>
                <p className="text-xl font-bold text-blue-600">
                  {currencyFmt(kpis.montoPendienteEstimado)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ==================== FILTER BAR ==================== */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <Input
            placeholder="Buscar por cliente o N° tropa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 bg-white border-stone-200 text-stone-800 text-sm placeholder:text-stone-400"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchData}
          disabled={loading}
          className="text-stone-600 hover:text-stone-800 hover:bg-stone-100"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* ==================== DATA TABLE ==================== */}
      <Card className="border-0 shadow-md bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="w-9 px-2 py-2.5"></th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-stone-500 uppercase tracking-wider min-w-[70px]">
                  N° Tropa
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-stone-500 uppercase tracking-wider min-w-[130px]">
                  Cliente
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-stone-500 uppercase tracking-wider min-w-[60px]">
                  Cabezas
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-stone-500 uppercase tracking-wider min-w-[80px]">
                  KG Gancho
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-stone-500 uppercase tracking-wider min-w-[65px]">
                  Rinde %
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-stone-500 uppercase tracking-wider min-w-[100px]">
                  Precio/kg
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-stone-500 uppercase tracking-wider min-w-[90px]">
                  Tasa Vet.
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-stone-500 uppercase tracking-wider min-w-[90px]">
                  IPCVA
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-stone-500 uppercase tracking-wider min-w-[65px]">
                  Plazo
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-stone-500 uppercase tracking-wider min-w-[60px]">
                  Items
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-stone-500 uppercase tracking-wider min-w-[100px]">
                  Subtotal
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-stone-500 uppercase tracking-wider min-w-[110px]">
                  Total
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-stone-500 uppercase tracking-wider min-w-[90px]">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {loading ? (
                <tr>
                  <td colSpan={14} className="text-center py-12">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-amber-500" />
                    <p className="mt-2 text-stone-500 text-sm">Cargando planillas aprobadas...</p>
                  </td>
                </tr>
              ) : planillas.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center py-16 text-stone-400">
                    <Package className="w-12 h-12 mx-auto mb-3 text-stone-400" />
                    <p className="text-sm font-medium">No hay planillas aprobadas pendientes de facturar</p>
                    <p className="text-xs text-stone-400 mt-1">
                      Las planillas aprobadas en el paso de Visto Bueno aparecerán aquí para su facturación.
                    </p>
                  </td>
                </tr>
              ) : (
                planillas.map((planilla) => {
                  const edit = getRowEdit(planilla.id)
                  const calc = calcRow(planilla, edit)
                  const isExpanded = expandedIds.has(planilla.id)
                  const hasItems = planilla.itemsExtras.length > 0
                  const clienteNombre =
                    planilla.usuarioFaena?.razonSocial ||
                    planilla.usuarioFaena?.nombre ||
                    planilla.usuario

                  return (
                    <>
                      {/* Main Row */}
                      <tr key={planilla.id} className="hover:bg-stone-50 transition-colors">
                        {/* Expand toggle */}
                        <td className="px-2 py-2.5 text-center">
                          {hasItems ? (
                            <button
                              onClick={() => toggleExpand(planilla.id)}
                              className="p-0.5 rounded hover:bg-stone-100 text-stone-500 hover:text-stone-700 transition-colors"
                              title={isExpanded ? 'Colapsar' : 'Ver items extra'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          ) : null}
                        </td>

                        {/* N° Tropa */}
                        <td className="px-3 py-2.5">
                          <span className="font-mono font-bold text-stone-800 text-sm">
                            {planilla.numeroTropa}
                          </span>
                        </td>

                        {/* Cliente */}
                        <td className="px-3 py-2.5 min-w-0">
                          <p className="text-sm text-stone-700 truncate">{clienteNombre}</p>
                          {planilla.usuarioFaena?.cuit && (
                            <p className="text-[10px] text-stone-400">
                              CUIT: {planilla.usuarioFaena.cuit}
                            </p>
                          )}
                        </td>

                        {/* Cabezas */}
                        <td className="px-3 py-2.5 text-center text-sm text-stone-600">
                          {planilla.cantidadAnimales || '-'}
                        </td>

                        {/* KG Gancho */}
                        <td className="px-3 py-2.5 text-right text-sm text-stone-600 font-mono">
                          {numberFmt(planilla.kgGancho, 1)}
                        </td>

                        {/* Rinde % */}
                        <td className="px-3 py-2.5 text-right text-sm text-stone-600 font-mono">
                          {planilla.rindePorcentaje?.toFixed(1)}%
                        </td>

                        {/* Precio/kg — editable */}
                        <td className="px-3 py-2.5 text-center">
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0"
                              value={edit.precioKg}
                              onChange={(e) => updateRowEdit(planilla.id, 'precioKg', e.target.value)}
                              className="w-[90px] h-7 text-xs text-center bg-stone-100 border-stone-200 text-stone-800 rounded px-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-stone-400"
                            />
                            {planilla.precioSugerido != null && !edit.precioKg && (
                              <p className="text-[9px] text-blue-600 italic mt-0.5 truncate">
                                Sugerido: ${numberFmt(planilla.precioSugerido)}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Tasa Inspección Vet — editable */}
                        <td className="px-3 py-2.5 text-center">
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="x cab"
                              value={edit.tasaVet}
                              onChange={(e) => updateRowEdit(planilla.id, 'tasaVet', e.target.value)}
                              className="w-[80px] h-7 text-xs text-center bg-stone-100 border-stone-200 text-stone-800 rounded px-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-stone-400"
                            />
                            {planilla.tasaSugerida != null && !edit.tasaVet && (
                              <p className="text-[9px] text-blue-600 italic mt-0.5 truncate">
                                Sugerido: ${numberFmt(planilla.tasaSugerida)}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Arancel IPCVA — editable */}
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="x cab"
                            value={edit.arancelIpcva}
                            onChange={(e) => updateRowEdit(planilla.id, 'arancelIpcva', e.target.value)}
                            className="w-[80px] h-7 text-xs text-center bg-stone-100 border-stone-200 text-stone-800 rounded px-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-stone-400"
                          />
                        </td>

                        {/* Plazo — editable */}
                        <td className="px-3 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <input
                              type="number"
                              placeholder="30"
                              value={edit.plazoPago}
                              onChange={(e) => updateRowEdit(planilla.id, 'plazoPago', e.target.value)}
                              className="w-[50px] h-7 text-xs text-center bg-stone-100 border-stone-200 text-stone-800 rounded px-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-stone-400"
                            />
                            <span className="text-[10px] text-stone-400">d</span>
                          </div>
                        </td>

                        {/* Items Extra badge */}
                        <td className="px-3 py-2.5 text-center">
                          {hasItems ? (
                            <Badge className="bg-purple-500/20 text-purple-600 border-0 text-[10px] py-0 px-1.5 cursor-pointer hover:bg-purple-500/30"
                              onClick={() => toggleExpand(planilla.id)}>
                              <Package className="w-3 h-3 mr-0.5" />
                              {planilla.itemsExtras.length}
                            </Badge>
                          ) : (
                            <span className="text-stone-400 text-xs">-</span>
                          )}
                        </td>

                        {/* Subtotal — auto-calculated */}
                        <td className="px-3 py-2.5 text-right">
                          <span className={`text-sm font-mono ${calc.precioKg > 0 ? 'text-stone-700' : 'text-stone-400'}`}>
                            {calc.precioKg > 0 ? currencyFmt(calc.subtotal) : '-'}
                          </span>
                        </td>

                        {/* Total — auto-calculated */}
                        <td className="px-3 py-2.5 text-right">
                          <span className={`text-sm font-mono font-semibold ${calc.precioKg > 0 ? 'text-emerald-600' : 'text-stone-400'}`}>
                            {calc.precioKg > 0 ? currencyFmt(calc.total) : '-'}
                          </span>
                        </td>

                        {/* Acciones */}
                        <td className="px-3 py-2.5 text-center">
                          <Button
                            size="sm"
                            onClick={() => openFacturar(planilla)}
                            disabled={!calc.isValid || saving}
                            className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            Facturar
                          </Button>
                        </td>
                      </tr>

                      {/* ==================== EXPANDED ROW — Items Extras ==================== */}
                      {isExpanded && hasItems && (
                        <tr key={`${planilla.id}-expanded`}>
                          <td colSpan={14} className="bg-stone-100/80 px-0 py-0">
                            <div className="px-6 py-3 border-l-4 border-purple-500/40">
                              <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                                Items Extras — Tropa N° {planilla.numeroTropa}
                              </h4>
                              <table className="w-full text-xs max-w-2xl">
                                <thead>
                                  <tr className="border-b border-stone-200">
                                    <th className="px-2 py-1.5 text-left text-stone-400 font-medium">Tipo</th>
                                    <th className="px-2 py-1.5 text-left text-stone-400 font-medium">Descripción</th>
                                    <th className="px-2 py-1.5 text-right text-stone-400 font-medium">KG</th>
                                    <th className="px-2 py-1.5 text-right text-stone-400 font-medium">Precio/u</th>
                                    <th className="px-2 py-1.5 text-right text-stone-400 font-medium">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-200">
                                  {planilla.itemsExtras.map((item) => {
                                    const itemPrecio = parseFloat(edit.itemExtrasEdit[item.id]) || 0
                                    const itemSubtotal = item.cantidadKg * itemPrecio
                                    return (
                                      <tr key={item.id} className="hover:bg-stone-100">
                                        <td className="px-2 py-2">
                                          <Badge className={`text-[9px] py-0 px-1.5 border-0 ${
                                            item.tipoItem === 'CHINCHULIN'
                                              ? 'bg-red-500/15 text-red-600'
                                              : item.tipoItem === 'CUARTEO'
                                                ? 'bg-orange-500/15 text-orange-600'
                                                : item.tipoItem === 'DESPOSTADA'
                                                  ? 'bg-teal-500/15 text-teal-600'
                                                  : 'bg-stone-200 text-stone-600'
                                          }`}>
                                            {item.tipoItem}
                                          </Badge>
                                        </td>
                                        <td className="px-2 py-2 text-stone-600 truncate max-w-[150px]">
                                          {item.descripcion || '-'}
                                        </td>
                                        <td className="px-2 py-2 text-right text-stone-600 font-mono">
                                          {numberFmt(item.cantidadKg, 1)}
                                        </td>
                                        <td className="px-2 py-2 text-right">
                                          <input
                                            type="number"
                                            step="0.01"
                                            placeholder="$"
                                            value={edit.itemExtrasEdit[item.id] || ''}
                                            onChange={(e) => updateItemExtraPrecio(planilla.id, item.id, e.target.value)}
                                            className="w-[80px] h-6 text-[11px] text-right bg-stone-100 border-stone-200 text-stone-800 rounded px-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 placeholder:text-stone-400"
                                          />
                                        </td>
                                        <td className="px-2 py-2 text-right text-stone-600 font-mono">
                                          {itemPrecio > 0 ? currencyFmt(itemSubtotal) : '-'}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && planillas.length > 0 && totalPaginas > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-stone-200">
            <span className="text-xs text-stone-500">
              Página {pagina} de {totalPaginas}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina <= 1}
                className="h-7 px-2 text-xs text-stone-600 hover:bg-stone-100"
              >
                Anterior
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={pagina >= totalPaginas}
                className="h-7 px-2 text-xs text-stone-600 hover:bg-stone-100"
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}

        {/* Footer totals */}
        {!loading && planillas.length > 0 && (
          <div className="border-t border-stone-200 px-4 py-2 bg-stone-100/50 text-xs">
            <div className="flex flex-wrap gap-4 items-center">
              <span className="text-stone-500">
                {planillas.length} planilla(s)
              </span>
              <span className="text-stone-500">
                KG Gancho:{' '}
                <strong className="text-stone-700">
                  {numberFmt(planillas.reduce((s, p) => s + p.kgGancho, 0), 1)}
                </strong>
              </span>
              <span className="text-stone-500">
                Cabezas:{' '}
                <strong className="text-stone-700">
                  {planillas.reduce((s, p) => s + p.cantidadAnimales, 0)}
                </strong>
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* ==================== FACTURAR DIALOG ==================== */}
      <Dialog open={facturarOpen} onOpenChange={setFacturarOpen}>
        <DialogContent className="bg-white border-stone-200 text-stone-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-emerald-600" />
              Confirmar Facturación
            </DialogTitle>
            <DialogDescription className="text-stone-500">
              Revise los datos antes de generar la factura
            </DialogDescription>
          </DialogHeader>

          {facturarTarget && (() => {
            const edit = getRowEdit(facturarTarget.id)
            const calc = calcRow(facturarTarget, edit)
            const clienteNombre =
              facturarTarget.usuarioFaena?.razonSocial ||
              facturarTarget.usuarioFaena?.nombre ||
              facturarTarget.usuario

            return (
              <div className="space-y-4">
                {/* Summary */}
                <div className="rounded-lg bg-stone-50 border border-stone-200 p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <div className="flex justify-between col-span-2">
                      <span className="text-stone-500">Cliente:</span>
                      <span className="text-stone-800 font-medium">{clienteNombre}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Tropa:</span>
                      <span className="text-stone-800 font-mono font-bold">N° {facturarTarget.numeroTropa}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Fecha Faena:</span>
                      <span className="text-stone-700">{dateFmt(facturarTarget.fechaFaena)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Cabezas:</span>
                      <span className="text-stone-700">{facturarTarget.cantidadAnimales}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">KG Gancho:</span>
                      <span className="text-stone-700 font-mono">{numberFmt(facturarTarget.kgGancho, 1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Precio/kg:</span>
                      <span className="text-blue-600 font-mono">{currencyFmt(calc.precioKg)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Tasa Vet. x cab:</span>
                      <span className="text-stone-700 font-mono">{currencyFmt(calc.tasaVet)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">IPCVA x cab:</span>
                      <span className="text-stone-700 font-mono">{currencyFmt(calc.arancel)}</span>
                    </div>
                    {calc.itemsTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-stone-500">Items Extra:</span>
                        <span className="text-purple-600 font-mono">{currencyFmt(calc.itemsTotal)}</span>
                      </div>
                    )}
                    <div className="flex justify-between col-span-2 border-t border-stone-200 pt-2 mt-1">
                      <span className="text-emerald-600 font-semibold text-base">Total:</span>
                      <span className="text-emerald-600 font-bold text-lg font-mono">
                        {currencyFmt(calc.total)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Items extras summary */}
                {facturarTarget.itemsExtras.length > 0 && (
                  <div className="rounded-lg bg-stone-100/50 border border-stone-200 p-3">
                    <h4 className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-2">
                      Items Extras
                    </h4>
                    {facturarTarget.itemsExtras.map((item) => {
                      const precio = parseFloat(edit.itemExtrasEdit[item.id]) || 0
                      return (
                        <div key={item.id} className="flex justify-between text-xs py-0.5">
                          <span className="text-stone-500">
                            {item.descripcion || item.tipoItem} ({numberFmt(item.cantidadKg, 1)} kg)
                          </span>
                          <span className="text-stone-700 font-mono">
                            {precio > 0 ? currencyFmt(item.cantidadKg * precio) : 'Sin precio'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* N° Factura */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-stone-600">
                    N° Factura <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="Ej: 0004-00001234"
                    value={facturaNumero}
                    onChange={(e) => setFacturaNumero(e.target.value)}
                    className="h-9 bg-stone-100 border-stone-200 text-stone-800 text-sm focus:ring-blue-500"
                  />
                </div>

                {/* Fecha Factura */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-stone-600">
                    Fecha Factura
                  </Label>
                  <Input
                    type="date"
                    value={facturaFecha}
                    onChange={(e) => setFacturaFecha(e.target.value)}
                    className="h-9 bg-stone-100 border-stone-200 text-stone-800 text-sm focus:ring-blue-500"
                  />
                </div>

                {/* Observaciones */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-stone-600">
                    Observaciones
                  </Label>
                  <Textarea
                    placeholder="Notas adicionales..."
                    value={facturaObs}
                    onChange={(e) => setFacturaObs(e.target.value)}
                    className="min-h-[60px] bg-stone-100 border-stone-200 text-stone-800 text-sm focus:ring-blue-500"
                    rows={2}
                  />
                </div>
              </div>
            )
          })()}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setFacturarOpen(false)}
              disabled={saving}
              className="text-stone-600 hover:text-stone-800 hover:bg-stone-100"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarFacturacion}
              disabled={saving || !facturaNumero.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-1.5" />
              )}
              Confirmar Facturación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CargaServFaenaTab
