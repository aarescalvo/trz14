'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Package, Plus, Search, Pencil, Trash2, Loader2, X, Save,
  DollarSign, Box, Tag, CheckCircle2, XCircle,
  ShieldCheck, FileText, Globe, Settings,
  Beef, BarChart3, Maximize2, Minimize2, ShoppingCart
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Operador {
  id: string
  nombre: string
  usuario: string
  rol: string
  nivel?: string
}

interface ProductoVendible {
  id: string
  codigo: string
  nombre: string
  descripcion?: string | null
  tara: number
  vencimientoDias: number
  numeroRegistroSenasa?: string | null
  unidadMedida: string
  cantidadEtiquetas: number
  tieneTipificacion: boolean
  tipificacion?: string | null
  categoria?: string | null
  subcategoria?: string | null
  especie?: string | null
  tipo?: string | null
  delCuarto?: string | null
  tipoVenta: string
  descripcionCircular?: string | null
  precioBase?: number | null
  precioDolar: number
  precioEuro: number
  precioArs: number
  moneda: string
  alicuotaIva: number
  producidoParaCliente?: string | null
  productoGeneral: boolean
  productoReporteRinde: boolean
  tipoTrabajo?: string | null
  textoEspanol?: string | null
  textoIngles?: string | null
  textoTercerIdioma?: string | null
  textoRubroPieza?: string | null
  textoTipoTrabajoLabel?: string | null
  tipoCarne?: string | null
  activo: boolean
  requiereTrazabilidad: boolean
  esVendible: boolean
  precioActual?: number
  // Relations from API (not used directly but included for typing)
  _count?: { preciosCliente: number; preciosHistorico: number }
}

interface FormData {
  codigo: string
  nombre: string
  descripcion: string
  tara: string
  vencimientoDias: string
  numeroRegistroSenasa: string
  unidadMedida: string
  cantidadEtiquetas: string
  tieneTipificacion: boolean
  tipificacion: string
  categoria: string
  subcategoria: string
  especie: string
  tipo: string
  delCuarto: string
  tipoVenta: string
  tipoCarne: string
  descripcionCircular: string
  tipoTrabajo: string
  textoRubroPieza: string
  textoTipoTrabajoLabel: string
  precioBase: string
  precioArs: string
  precioDolar: string
  precioEuro: string
  moneda: string
  alicuotaIva: string
  producidoParaCliente: string
  textoEspanol: string
  textoIngles: string
  textoTercerIdioma: string
  activo: boolean
  productoGeneral: boolean
  productoReporteRinde: boolean
  requiereTrazabilidad: boolean
  esVendible: boolean
}

const DEFAULT_FORM_DATA: FormData = {
  codigo: '',
  nombre: '',
  descripcion: '',
  tara: '0',
  vencimientoDias: '0',
  numeroRegistroSenasa: '',
  unidadMedida: 'KG',
  cantidadEtiquetas: '1',
  tieneTipificacion: false,
  tipificacion: '',
  categoria: '',
  subcategoria: '',
  especie: '',
  tipo: '',
  delCuarto: '',
  tipoVenta: 'POR_KG',
  tipoCarne: '',
  descripcionCircular: '',
  tipoTrabajo: '',
  textoRubroPieza: '',
  textoTipoTrabajoLabel: '',
  precioBase: '',
  precioArs: '',
  precioDolar: '',
  precioEuro: '',
  moneda: 'ARS',
  alicuotaIva: '21',
  producidoParaCliente: '',
  textoEspanol: '',
  textoIngles: '',
  textoTercerIdioma: '',
  activo: true,
  productoGeneral: false,
  productoReporteRinde: false,
  requiereTrazabilidad: false,
  esVendible: true,
}

// ─── Options for selects ──────────────────────────────────────────────────────

const UNIDAD_OPTIONS = ['KG', 'UN', 'CAJA', 'Pallet']
const CUARTO_OPTIONS = ['DELANTERO', 'TRASERO', 'ASADO']
const ESPECIE_OPTIONS = ['BOVINO', 'EQUINO', 'PORCINO', 'OVINO']
const TIPO_VENTA_OPTIONS = ['POR_KG', 'POR_UNIDAD', 'FIJO']
const MONEDA_OPTIONS = ['ARS', 'USD', 'EUR']

// ─── Component ───────────────────────────────────────────────────────────────

export function ConfigProductosModule({ operador }: { operador: Operador }) {
  // Data state
  const [productos, setProductos] = useState<ProductoVendible[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // UI state
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroActivo, setFiltroActivo] = useState<string>('todos')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<FormData>({ ...DEFAULT_FORM_DATA })
  const [dialogExpanded, setDialogExpanded] = useState(false)

  // ─── CRUD: Fetch ─────────────────────────────────────────────────────────

  const fetchProductos = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filtroActivo === 'activo') params.set('activo', 'true')
      else if (filtroActivo === 'inactivo') params.set('activo', 'false')
      if (searchTerm.trim()) params.set('search', searchTerm.trim())

      const res = await fetch(`/api/productos-vendibles?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setProductos(json.data || [])
      } else {
        toast.error(json.error || 'Error al cargar productos')
      }
    } catch (error) {
      console.error('Error fetching productos:', error)
      toast.error('Error de conexión al cargar productos')
    } finally {
      setLoading(false)
    }
  }, [filtroActivo, searchTerm])

  useEffect(() => {
    fetchProductos()
  }, [fetchProductos])

  // ─── CRUD: Create ──────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!formData.codigo.trim() || !formData.nombre.trim()) {
      toast.error('Código y Nombre son obligatorios')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/productos-vendibles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: formData.codigo.trim(),
          nombre: formData.nombre.trim(),
          descripcion: formData.descripcion || null,
          tara: formData.tara || '0',
          vencimientoDias: formData.vencimientoDias || '0',
          numeroRegistroSenasa: formData.numeroRegistroSenasa || null,
          unidadMedida: formData.unidadMedida,
          cantidadEtiquetas: formData.cantidadEtiquetas || '1',
          tieneTipificacion: formData.tieneTipificacion,
          tipificacion: formData.tieneTipificacion ? formData.tipificacion || null : null,
          categoria: formData.categoria || null,
          subcategoria: formData.subcategoria || null,
          especie: formData.especie || null,
          tipo: formData.tipo || null,
          delCuarto: formData.delCuarto || null,
          tipoVenta: formData.tipoVenta,
          tipoCarne: formData.tipoCarne || null,
          descripcionCircular: formData.descripcionCircular || null,
          tipoTrabajo: formData.tipoTrabajo || null,
          textoRubroPieza: formData.textoRubroPieza || null,
          textoTipoTrabajoLabel: formData.textoTipoTrabajoLabel || null,
          precioBase: formData.precioBase || null,
          precioArs: formData.precioArs || '0',
          precioDolar: formData.precioDolar || '0',
          precioEuro: formData.precioEuro || '0',
          moneda: formData.moneda,
          alicuotaIva: formData.alicuotaIva || '21',
          producidoParaCliente: formData.producidoParaCliente || null,
          textoEspanol: formData.textoEspanol || null,
          textoIngles: formData.textoIngles || null,
          textoTercerIdioma: formData.textoTercerIdioma || null,
          activo: formData.activo,
          productoGeneral: formData.productoGeneral,
          productoReporteRinde: formData.productoReporteRinde,
          requiereTrazabilidad: formData.requiereTrazabilidad,
          esVendible: formData.esVendible,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Producto "${formData.nombre}" creado exitosamente`)
        setDialogOpen(false)
        fetchProductos()
      } else {
        toast.error(json.error || 'Error al crear producto')
      }
    } catch (error) {
      console.error('Error creating producto:', error)
      toast.error('Error de conexión al crear producto')
    } finally {
      setSaving(false)
    }
  }

  // ─── CRUD: Update ─────────────────────────────────────────────────────────

  const handleUpdate = async () => {
    if (!editingId) return
    if (!formData.codigo.trim() || !formData.nombre.trim()) {
      toast.error('Código y Nombre son obligatorios')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/productos-vendibles/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: formData.codigo.trim(),
          nombre: formData.nombre.trim(),
          descripcion: formData.descripcion || null,
          tara: formData.tara || '0',
          vencimientoDias: formData.vencimientoDias || '0',
          numeroRegistroSenasa: formData.numeroRegistroSenasa || null,
          unidadMedida: formData.unidadMedida,
          cantidadEtiquetas: formData.cantidadEtiquetas || '1',
          tieneTipificacion: formData.tieneTipificacion,
          tipificacion: formData.tieneTipificacion ? formData.tipificacion || null : null,
          categoria: formData.categoria || null,
          subcategoria: formData.subcategoria || null,
          especie: formData.especie || null,
          tipo: formData.tipo || null,
          delCuarto: formData.delCuarto || null,
          tipoVenta: formData.tipoVenta,
          tipoCarne: formData.tipoCarne || null,
          descripcionCircular: formData.descripcionCircular || null,
          tipoTrabajo: formData.tipoTrabajo || null,
          textoRubroPieza: formData.textoRubroPieza || null,
          textoTipoTrabajoLabel: formData.textoTipoTrabajoLabel || null,
          precioBase: formData.precioBase || null,
          precioArs: formData.precioArs || '0',
          precioDolar: formData.precioDolar || '0',
          precioEuro: formData.precioEuro || '0',
          moneda: formData.moneda,
          alicuotaIva: formData.alicuotaIva || '21',
          producidoParaCliente: formData.producidoParaCliente || null,
          textoEspanol: formData.textoEspanol || null,
          textoIngles: formData.textoIngles || null,
          textoTercerIdioma: formData.textoTercerIdioma || null,
          activo: formData.activo,
          productoGeneral: formData.productoGeneral,
          productoReporteRinde: formData.productoReporteRinde,
          requiereTrazabilidad: formData.requiereTrazabilidad,
          esVendible: formData.esVendible,
          operadorId: operador?.id,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Producto "${formData.nombre}" actualizado exitosamente`)
        setDialogOpen(false)
        setEditingId(null)
        fetchProductos()
      } else {
        toast.error(json.error || 'Error al actualizar producto')
      }
    } catch (error) {
      console.error('Error updating producto:', error)
      toast.error('Error de conexión al actualizar producto')
    } finally {
      setSaving(false)
    }
  }

  // ─── CRUD: Delete ────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      const res = await fetch(`/api/productos-vendibles/${deletingId}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        toast.success('Producto desactivado correctamente')
        setDeleteDialogOpen(false)
        setDeletingId(null)
        fetchProductos()
      } else {
        toast.error(json.error || 'Error al desactivar producto')
      }
    } catch (error) {
      console.error('Error deleting producto:', error)
      toast.error('Error de conexión al desactivar producto')
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const openCreateDialog = () => {
    setEditingId(null)
    setFormData({ ...DEFAULT_FORM_DATA })
    setDialogExpanded(false)
    setDialogOpen(true)
  }

  const openEditDialog = (p: ProductoVendible) => {
    setEditingId(p.id)
    setFormData({
      codigo: p.codigo || '',
      nombre: p.nombre || '',
      descripcion: p.descripcion || '',
      tara: String(p.tara ?? 0),
      vencimientoDias: String(p.vencimientoDias ?? 0),
      numeroRegistroSenasa: p.numeroRegistroSenasa || '',
      unidadMedida: p.unidadMedida || 'KG',
      cantidadEtiquetas: String(p.cantidadEtiquetas ?? 1),
      tieneTipificacion: p.tieneTipificacion || false,
      tipificacion: p.tipificacion || '',
      categoria: p.categoria || '',
      subcategoria: p.subcategoria || '',
      especie: p.especie || '',
      tipo: p.tipo || '',
      delCuarto: p.delCuarto || '',
      tipoVenta: p.tipoVenta || 'POR_KG',
      tipoCarne: p.tipoCarne || '',
      descripcionCircular: p.descripcionCircular || '',
      tipoTrabajo: p.tipoTrabajo || '',
      textoRubroPieza: p.textoRubroPieza || '',
      textoTipoTrabajoLabel: p.textoTipoTrabajoLabel || '',
      precioBase: String(p.precioBase ?? ''),
      precioArs: String(p.precioArs ?? ''),
      precioDolar: String(p.precioDolar ?? ''),
      precioEuro: String(p.precioEuro ?? ''),
      moneda: p.moneda || 'ARS',
      alicuotaIva: String(p.alicuotaIva ?? '21'),
      producidoParaCliente: p.producidoParaCliente || '',
      textoEspanol: p.textoEspanol || '',
      textoIngles: p.textoIngles || '',
      textoTercerIdioma: p.textoTercerIdioma || '',
      activo: p.activo ?? true,
      productoGeneral: p.productoGeneral ?? false,
      productoReporteRinde: p.productoReporteRinde ?? false,
      requiereTrazabilidad: p.requiereTrazabilidad ?? false,
      esVendible: p.esVendible ?? true,
    })
    setDialogOpen(true)
  }

  const confirmDelete = (p: ProductoVendible) => {
    setDeletingId(p.id)
    setDeleteDialogOpen(true)
  }

  const handleSubmit = () => {
    if (editingId) {
      handleUpdate()
    } else {
      handleCreate()
    }
  }

  const updateField = (field: keyof FormData, value: string | boolean) => {
    // Handle "none" sentinel for selects that allow unsetting
    const normalized = value === '__none__' ? '' : value
    setFormData(prev => ({ ...prev, [field]: normalized }))
  }

  // ─── Formatters ──────────────────────────────────────────────────────────

  const formatARS = (value: number | null | undefined) => {
    if (value == null) return '-'
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatUSD = (value: number | null | undefined) => {
    if (value == null || value === 0) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatEUR = (value: number | null | undefined) => {
    if (value == null || value === 0) return '-'
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value)
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  const totalProductos = productos.length
  const activos = productos.filter(p => p.activo).length
  const inactivos = totalProductos - activos
  const conPrecio = productos.filter(p => (p.precioArs > 0 || p.precioBase != null && p.precioBase > 0)).length

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-gradient-to-br from-stone-50 to-stone-100 min-h-screen p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-stone-800 flex items-center gap-2">
            <Beef className="w-7 h-7 text-amber-500" />
            Productos
          </h1>
          <p className="text-stone-500 text-sm mt-0.5">
            Gestión unificada de productos vendibles · Operador: {operador?.nombre}
          </p>
        </div>
        <Button onClick={openCreateDialog} className="bg-amber-500 hover:bg-amber-600 text-white">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Producto
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="bg-stone-100 p-2 rounded-lg">
              <Package className="w-5 h-5 text-stone-600" />
            </div>
            <div>
              <p className="text-xs text-stone-500">Total</p>
              <p className="text-lg font-bold text-stone-800">{totalProductos}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="bg-emerald-50 p-2 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-stone-500">Activos</p>
              <p className="text-lg font-bold text-emerald-600">{activos}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="bg-red-50 p-2 rounded-lg">
              <XCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-stone-500">Inactivos</p>
              <p className="text-lg font-bold text-red-500">{inactivos}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white shadow-sm border-0">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="bg-amber-50 p-2 rounded-lg">
              <DollarSign className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-stone-500">Con Precio</p>
              <p className="text-lg font-bold text-amber-600">{conPrecio}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="bg-white shadow-sm border-0">
        <CardContent className="p-3 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <Input
              className="pl-9 bg-white border-stone-300 text-stone-800"
              placeholder="Buscar por código, nombre, SENASA..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-40">
            <Select value={filtroActivo} onValueChange={setFiltroActivo}>
              <SelectTrigger className="bg-white border-stone-300 text-stone-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="activo">Activos</SelectItem>
                <SelectItem value="inactivo">Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-white shadow-md border-0">
        <CardContent className="p-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <span className="ml-3 text-stone-500">Cargando productos...</span>
            </div>
          ) : productos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-stone-400">
              <Package className="w-12 h-12 mb-3 opacity-40" />
              <p className="text-sm">No se encontraron productos</p>
              <p className="text-xs mt-1">Presione &quot;Nuevo Producto&quot; para agregar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-stone-100 hover:bg-stone-100">
                    <TableHead className="text-stone-500 text-xs uppercase tracking-wider font-semibold px-3 py-2">Código</TableHead>
                    <TableHead className="text-stone-500 text-xs uppercase tracking-wider font-semibold px-3 py-2">Nombre</TableHead>
                    <TableHead className="text-stone-500 text-xs uppercase tracking-wider font-semibold px-3 py-2 text-right">TARA</TableHead>
                    <TableHead className="text-stone-500 text-xs uppercase tracking-wider font-semibold px-3 py-2 text-right">Venc.</TableHead>
                    <TableHead className="text-stone-500 text-xs uppercase tracking-wider font-semibold px-3 py-2">SENASA</TableHead>
                    <TableHead className="text-stone-500 text-xs uppercase tracking-wider font-semibold px-3 py-2">Unidad</TableHead>
                    <TableHead className="text-stone-500 text-xs uppercase tracking-wider font-semibold px-3 py-2 text-center">Etiquetas</TableHead>
                    <TableHead className="text-stone-500 text-xs uppercase tracking-wider font-semibold px-3 py-2">Tipificación</TableHead>
                    <TableHead className="text-stone-500 text-xs uppercase tracking-wider font-semibold px-3 py-2 text-center">Vendible</TableHead>
                    <TableHead className="text-stone-500 text-xs uppercase tracking-wider font-semibold px-3 py-2">Tipo</TableHead>
                    <TableHead className="text-stone-500 text-xs uppercase tracking-wider font-semibold px-3 py-2">Cuarto</TableHead>
                    <TableHead className="text-stone-500 text-xs uppercase tracking-wider font-semibold px-3 py-2">Cat.</TableHead>
                    <TableHead className="text-stone-500 text-xs uppercase tracking-wider font-semibold px-3 py-2">Desc. Reportes</TableHead>
                    <TableHead className="text-stone-500 text-xs uppercase tracking-wider font-semibold px-3 py-2 text-right">Precio $</TableHead>
                    <TableHead className="text-stone-500 text-xs uppercase tracking-wider font-semibold px-3 py-2 text-right">US$</TableHead>
                    <TableHead className="text-stone-500 text-xs uppercase tracking-wider font-semibold px-3 py-2 text-right">EUR</TableHead>
                    <TableHead className="text-stone-500 text-xs uppercase tracking-wider font-semibold px-3 py-2">Cliente</TableHead>
                    <TableHead className="text-stone-500 text-xs uppercase tracking-wider font-semibold px-3 py-2">T. Trabajo</TableHead>
                    <TableHead className="text-stone-500 text-xs uppercase tracking-wider font-semibold px-3 py-2">Estado</TableHead>
                    <TableHead className="text-stone-500 text-xs uppercase tracking-wider font-semibold px-3 py-2 text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productos.map((p) => (
                    <TableRow
                      key={p.id}
                      className={`hover:bg-stone-50 ${!p.activo ? 'opacity-50' : ''}`}
                    >
                      <TableCell className="px-3 py-2 font-mono text-xs">{p.codigo}</TableCell>
                      <TableCell className="px-3 py-2 font-medium text-sm text-stone-800 max-w-[160px] truncate">{p.nombre}</TableCell>
                      <TableCell className="px-3 py-2 text-xs text-right">{p.tara || '-'}</TableCell>
                      <TableCell className="px-3 py-2 text-xs text-right">{p.vencimientoDias || '-'}</TableCell>
                      <TableCell className="px-3 py-2 text-xs font-mono">{p.numeroRegistroSenasa || '-'}</TableCell>
                      <TableCell className="px-3 py-2 text-xs">{p.unidadMedida || '-'}</TableCell>
                      <TableCell className="px-3 py-2 text-xs text-center">{p.cantidadEtiquetas || '-'}</TableCell>
                      <TableCell className="px-3 py-2">
                        {p.tieneTipificacion ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px] px-1.5 py-0">
                            SI{p.tipificacion ? `: ${p.tipificacion}` : ''}
                          </Badge>
                        ) : (
                          <Badge className="bg-stone-100 text-stone-500 hover:bg-stone-100 text-[10px] px-1.5 py-0">NO</Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-center">
                        {p.esVendible !== false ? (
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[10px] px-1.5 py-0">SI</Badge>
                        ) : (
                          <Badge className="bg-stone-100 text-stone-500 hover:bg-stone-100 text-[10px] px-1.5 py-0">NO</Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-xs">{p.tipo || '-'}</TableCell>
                      <TableCell className="px-3 py-2 text-xs">{p.delCuarto || '-'}</TableCell>
                      <TableCell className="px-3 py-2 text-xs">{p.categoria || '-'}</TableCell>
                      <TableCell className="px-3 py-2 text-xs max-w-[120px] truncate">{p.descripcionCircular || '-'}</TableCell>
                      <TableCell className="px-3 py-2 text-xs text-right font-semibold text-stone-700">
                        {formatARS(p.precioArs || p.precioBase)}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-xs text-right">{formatUSD(p.precioDolar)}</TableCell>
                      <TableCell className="px-3 py-2 text-xs text-right">{formatEUR(p.precioEuro)}</TableCell>
                      <TableCell className="px-3 py-2 text-xs max-w-[100px] truncate">{p.producidoParaCliente || '-'}</TableCell>
                      <TableCell className="px-3 py-2 text-xs">{p.tipoTrabajo || '-'}</TableCell>
                      <TableCell className="px-3 py-2">
                        {p.activo ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px] px-1.5 py-0">Activo</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px] px-1.5 py-0">Inactivo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-stone-500 hover:text-amber-600"
                            onClick={() => openEditDialog(p)}
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-stone-500 hover:text-red-600"
                            onClick={() => confirmDelete(p)}
                            title="Desactivar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── CREATE / EDIT DIALOG ──────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setDialogOpen(false); setDialogExpanded(false); setEditingId(null) } }}>
        <DialogContent className={`${dialogExpanded ? 'sm:max-w-[95vw] lg:max-w-[90vw] max-h-[95vh]' : 'sm:max-w-3xl max-h-[85vh]'} p-0 flex flex-col transition-all duration-300`} showCloseButton>
          <div className="overflow-y-auto flex-1 p-6 space-y-0">
            {/* Dialog Header */}
            <DialogHeader className="mb-5">
              <div className="flex items-center justify-between pr-8">
                <DialogTitle className="flex items-center gap-2 text-stone-800">
                  <Package className="w-5 h-5 text-amber-500" />
                  {editingId ? 'Editar Producto' : 'Nuevo Producto'}
                </DialogTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-stone-400 hover:text-stone-600 hover:bg-stone-100"
                  onClick={() => setDialogExpanded(!dialogExpanded)}
                  title={dialogExpanded ? 'Reducir' : 'Expandir'}
                >
                  {dialogExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
              </div>
              <DialogDescription className="text-stone-500">
                {editingId
                  ? 'Modifique los campos deseados y presione ACEPTAR para guardar los cambios.'
                  : 'Complete los campos necesarios para registrar un nuevo producto vendible.'}
              </DialogDescription>
            </DialogHeader>

            {/* ── Section 1: Identificación ──────────────────────────────── */}
            <section className="mb-5">
              <h3 className="text-stone-800 font-semibold text-sm flex items-center gap-2 pb-2 border-b border-stone-200 mb-4">
                <Tag className="w-4 h-4 text-amber-500" />
                Identificación
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">
                    Código <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    className="bg-white border-stone-300 text-stone-800 font-mono"
                    value={formData.codigo}
                    onChange={(e) => updateField('codigo', e.target.value.toUpperCase().replace(/\s/g, ''))}
                    placeholder="Ej: COR-001"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">
                    Nombre Producto <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    className="bg-white border-stone-300 text-stone-800"
                    value={formData.nombre}
                    onChange={(e) => updateField('nombre', e.target.value)}
                    placeholder="Ej: Vacío"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-medium text-stone-600">Descripción</Label>
                  <Textarea
                    className="bg-white border-stone-300 text-stone-800 min-h-[60px]"
                    value={formData.descripcion}
                    onChange={(e) => updateField('descripcion', e.target.value)}
                    placeholder="Descripción opcional del producto..."
                  />
                </div>
              </div>
            </section>

            {/* ── Section 2: Datos Físicos ──────────────────────────────── */}
            <section className="mb-5">
              <h3 className="text-stone-800 font-semibold text-sm flex items-center gap-2 pb-2 border-b border-stone-200 mb-4">
                <Box className="w-4 h-4 text-amber-500" />
                Datos Físicos
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">TARA (kg)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="bg-white border-stone-300 text-stone-800"
                    value={formData.tara}
                    onChange={(e) => updateField('tara', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Vencimiento (días)</Label>
                  <Input
                    type="number"
                    className="bg-white border-stone-300 text-stone-800"
                    value={formData.vencimientoDias}
                    onChange={(e) => updateField('vencimientoDias', e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">N° Habilitación SENASA</Label>
                  <Input
                    className="bg-white border-stone-300 text-stone-800 font-mono"
                    value={formData.numeroRegistroSenasa}
                    onChange={(e) => updateField('numeroRegistroSenasa', e.target.value)}
                    placeholder="N° registro"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Unidad</Label>
                  <Select value={formData.unidadMedida} onValueChange={(v) => updateField('unidadMedida', v)}>
                    <SelectTrigger className="bg-white border-stone-300 text-stone-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIDAD_OPTIONS.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Cantidad de Etiquetas</Label>
                  <Input
                    type="number"
                    className="bg-white border-stone-300 text-stone-800"
                    value={formData.cantidadEtiquetas}
                    onChange={(e) => updateField('cantidadEtiquetas', e.target.value)}
                    placeholder="1"
                  />
                </div>
              </div>
            </section>

            {/* ── Section 3: Tipificación ────────────────────────────────── */}
            <section className="mb-5">
              <h3 className="text-stone-800 font-semibold text-sm flex items-center gap-2 pb-2 border-b border-stone-200 mb-4">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                Tipificación
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Tiene Tipificación</Label>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={formData.tieneTipificacion}
                      onCheckedChange={(checked) => updateField('tieneTipificacion', checked)}
                    />
                    <span className="text-sm text-stone-700">
                      {formData.tieneTipificacion ? 'SI' : 'NO'}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Es Producto Vendible</Label>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={formData.esVendible}
                      onCheckedChange={(checked) => updateField('esVendible', checked)}
                    />
                    <span className="text-sm text-stone-700">
                      {formData.esVendible ? 'SI' : 'NO'}
                    </span>
                  </div>
                </div>
                {formData.tieneTipificacion && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-stone-600">Tipificación</Label>
                    <Input
                      className="bg-white border-stone-300 text-stone-800"
                      value={formData.tipificacion}
                      onChange={(e) => updateField('tipificacion', e.target.value)}
                      placeholder="Ingrese tipificación..."
                    />
                  </div>
                )}
              </div>
            </section>

            {/* ── Section 4: Clasificación ──────────────────────────────── */}
            <section className="mb-5">
              <h3 className="text-stone-800 font-semibold text-sm flex items-center gap-2 pb-2 border-b border-stone-200 mb-4">
                <BarChart3 className="w-4 h-4 text-amber-500" />
                Clasificación
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Tipo de Producto</Label>
                  <Input
                    className="bg-white border-stone-300 text-stone-800"
                    value={formData.tipo}
                    onChange={(e) => updateField('tipo', e.target.value)}
                    placeholder="Ej: Corte, Subproducto"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Cuarto</Label>
                  <Select value={formData.delCuarto || '__none__'} onValueChange={(v) => updateField('delCuarto', v)}>
                    <SelectTrigger className="bg-white border-stone-300 text-stone-800">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Sin asignar —</SelectItem>
                      {CUARTO_OPTIONS.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Tipo General / Categoría</Label>
                  <Input
                    className="bg-white border-stone-300 text-stone-800"
                    value={formData.categoria}
                    onChange={(e) => updateField('categoria', e.target.value)}
                    placeholder="Ej: Cortes, Menudencias"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Subcategoría</Label>
                  <Input
                    className="bg-white border-stone-300 text-stone-800"
                    value={formData.subcategoria}
                    onChange={(e) => updateField('subcategoria', e.target.value)}
                    placeholder="Subcategoría..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Especie</Label>
                  <Select value={formData.especie || '__none__'} onValueChange={(v) => updateField('especie', v)}>
                    <SelectTrigger className="bg-white border-stone-300 text-stone-800">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Sin asignar —</SelectItem>
                      {ESPECIE_OPTIONS.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Tipo de Venta</Label>
                  <Select value={formData.tipoVenta} onValueChange={(v) => updateField('tipoVenta', v)}>
                    <SelectTrigger className="bg-white border-stone-300 text-stone-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_VENTA_OPTIONS.map(opt => (
                        <SelectItem key={opt} value={opt}>
                          {opt.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Tipo Carne</Label>
                  <Input
                    className="bg-white border-stone-300 text-stone-800"
                    value={formData.tipoCarne}
                    onChange={(e) => updateField('tipoCarne', e.target.value)}
                    placeholder="Tipo de carne..."
                  />
                </div>
              </div>
            </section>

            {/* ── Section 5: Descripciones y Reportes ───────────────────── */}
            <section className="mb-5">
              <h3 className="text-stone-800 font-semibold text-sm flex items-center gap-2 pb-2 border-b border-stone-200 mb-4">
                <FileText className="w-4 h-4 text-amber-500" />
                Descripciones y Reportes
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Descripción en Reportes / Circular</Label>
                  <Input
                    className="bg-white border-stone-300 text-stone-800"
                    value={formData.descripcionCircular}
                    onChange={(e) => updateField('descripcionCircular', e.target.value)}
                    placeholder="Texto para reportes..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Tipo de Trabajo</Label>
                  <Input
                    className="bg-white border-stone-300 text-stone-800"
                    value={formData.tipoTrabajo}
                    onChange={(e) => updateField('tipoTrabajo', e.target.value)}
                    placeholder="Tipo de trabajo..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Texto Rubro Pieza</Label>
                  <Input
                    className="bg-white border-stone-300 text-stone-800"
                    value={formData.textoRubroPieza}
                    onChange={(e) => updateField('textoRubroPieza', e.target.value)}
                    placeholder="Rubro pieza..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Texto Tipo de Trabajo</Label>
                  <Input
                    className="bg-white border-stone-300 text-stone-800"
                    value={formData.textoTipoTrabajoLabel}
                    onChange={(e) => updateField('textoTipoTrabajoLabel', e.target.value)}
                    placeholder="Tipo trabajo label..."
                  />
                </div>
              </div>
            </section>

            {/* ── Section 6: Precios ──────────────────────────────────── */}
            <section className="mb-5">
              <h3 className="text-stone-800 font-semibold text-sm flex items-center gap-2 pb-2 border-b border-stone-200 mb-4">
                <DollarSign className="w-4 h-4 text-amber-500" />
                Precios
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Precio Base ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="bg-white border-stone-300 text-stone-800"
                    value={formData.precioBase}
                    onChange={(e) => updateField('precioBase', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Precio ARS ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="bg-white border-stone-300 text-stone-800"
                    value={formData.precioArs}
                    onChange={(e) => updateField('precioArs', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Precio Dólar (US$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="bg-white border-stone-300 text-stone-800"
                    value={formData.precioDolar}
                    onChange={(e) => updateField('precioDolar', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Precio Euro (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="bg-white border-stone-300 text-stone-800"
                    value={formData.precioEuro}
                    onChange={(e) => updateField('precioEuro', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Moneda</Label>
                  <Select value={formData.moneda} onValueChange={(v) => updateField('moneda', v)}>
                    <SelectTrigger className="bg-white border-stone-300 text-stone-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONEDA_OPTIONS.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Alicuota IVA (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="bg-white border-stone-300 text-stone-800"
                    value={formData.alicuotaIva}
                    onChange={(e) => updateField('alicuotaIva', e.target.value)}
                    placeholder="21"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Producido Para Cliente</Label>
                  <Input
                    className="bg-white border-stone-300 text-stone-800"
                    value={formData.producidoParaCliente}
                    onChange={(e) => updateField('producidoParaCliente', e.target.value)}
                    placeholder="Nombre del cliente..."
                  />
                </div>
              </div>
            </section>

            {/* ── Section 7: Textos / Idiomas ──────────────────────────── */}
            <section className="mb-5">
              <h3 className="text-stone-800 font-semibold text-sm flex items-center gap-2 pb-2 border-b border-stone-200 mb-4">
                <Globe className="w-4 h-4 text-amber-500" />
                Textos / Idiomas
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Texto en Español</Label>
                  <Input
                    className="bg-white border-stone-300 text-stone-800"
                    value={formData.textoEspanol}
                    onChange={(e) => updateField('textoEspanol', e.target.value)}
                    placeholder="Texto en español..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Texto en Inglés</Label>
                  <Input
                    className="bg-white border-stone-300 text-stone-800"
                    value={formData.textoIngles}
                    onChange={(e) => updateField('textoIngles', e.target.value)}
                    placeholder="Text in English..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-stone-600">Texto Tercer Idioma</Label>
                  <Input
                    className="bg-white border-stone-300 text-stone-800"
                    value={formData.textoTercerIdioma}
                    onChange={(e) => updateField('textoTercerIdioma', e.target.value)}
                    placeholder="Texto tercer idioma..."
                  />
                </div>
              </div>
            </section>

            {/* ── Section 8: Control ───────────────────────────────────── */}
            <section className="mb-2">
              <h3 className="text-stone-800 font-semibold text-sm flex items-center gap-2 pb-2 border-b border-stone-200 mb-4">
                <Settings className="w-4 h-4 text-amber-500" />
                Control
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center justify-between rounded-lg border border-stone-200 p-3 bg-white">
                  <Label className="text-xs font-medium text-stone-600 cursor-pointer" htmlFor="switch-activo">
                    Activo
                  </Label>
                  <Switch
                    id="switch-activo"
                    checked={formData.activo}
                    onCheckedChange={(checked) => updateField('activo', checked)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-stone-200 p-3 bg-white">
                  <Label className="text-xs font-medium text-stone-600 cursor-pointer" htmlFor="switch-general">
                    Producto General
                  </Label>
                  <Switch
                    id="switch-general"
                    checked={formData.productoGeneral}
                    onCheckedChange={(checked) => updateField('productoGeneral', checked)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-stone-200 p-3 bg-white">
                  <Label className="text-xs font-medium text-stone-600 cursor-pointer" htmlFor="switch-reporte">
                    Reporte Rinde
                  </Label>
                  <Switch
                    id="switch-reporte"
                    checked={formData.productoReporteRinde}
                    onCheckedChange={(checked) => updateField('productoReporteRinde', checked)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-stone-200 p-3 bg-white">
                  <Label className="text-xs font-medium text-stone-600 cursor-pointer" htmlFor="switch-traza">
                    Requiere Trazabilidad
                  </Label>
                  <Switch
                    id="switch-traza"
                    checked={formData.requiereTrazabilidad}
                    onCheckedChange={(checked) => updateField('requiereTrazabilidad', checked)}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Dialog Footer — sticky at bottom */}
          <div className="border-t border-stone-200 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 bg-white rounded-b-lg">
            <div className="text-xs text-stone-400 order-2 sm:order-1">
              {editingId ? `Editando: ${formData.codigo} — ${formData.nombre}` : 'Nuevo producto'}
            </div>
            <div className="flex items-center gap-2 order-1 sm:order-2">
              <Button
                variant="outline"
                onClick={() => { setDialogOpen(false); setEditingId(null) }}
                className="border-stone-300 text-stone-600 hover:bg-stone-50"
              >
                <X className="w-4 h-4 mr-1" />
                Salir
              </Button>
              {editingId && (
                <Button
                  variant="outline"
                  className="bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700"
                  onClick={() => {
                    setDialogOpen(false)
                    const prod = productos.find(p => p.id === editingId)
                    if (prod) confirmDelete(prod)
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Eliminar
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={saving}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                {saving ? 'Guardando...' : 'Aceptar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── DELETE CONFIRMATION DIALOG ───────────────────────────────── */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Desactivar Producto"
        description="El producto será desactivado (no eliminado). Podrá reactivarlo luego editando el producto."
        itemName={productos.find(p => p.id === deletingId)?.nombre}
      />
    </div>
  )
}
