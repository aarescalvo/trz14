'use client'

import { useState, useEffect } from 'react'
import { 
  FileText, DollarSign, CheckCircle, XCircle, Eye, 
  Plus, Search, Loader2, Printer, RefreshCw, CreditCard,
  Building2, Receipt, Package,
  FileSpreadsheet, History, Pencil,
  Upload,
  ArrowLeftRight, Trash2, FileDown, Ban,
  TrendingUp, Clock, AlertCircle, AlertTriangle, BarChart3,
  Lock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { PreciosPage } from '@/modules/facturacion/components/PreciosPage'
import { DetalleTropaTab } from '@/components/facturacion/DetalleTropaTab'
import { VBServFaenaTab } from '@/components/facturacion/VBServFaenaTab'
import { CargaServFaenaTab } from '@/components/facturacion/CargaServFaenaTab'
import { PagosSaldosTab } from '@/components/facturacion/PagosSaldosTab'
import { FacturaPreview } from '@/modules/facturacion/components/FacturaPreview'
import { Separator } from '@/components/ui/separator'
// HistorialPreciosModule removed — was importing from @/components/historial-precios which fails at runtime
// HistoricoPrecios (already imported above from @/modules/facturacion/components/HistoricoPrecios) is used instead

interface Operador { id: string; nombre: string; rol: string }

interface Cliente {
  id: string
  nombre: string
  cuit?: string
  razonSocial?: string
  condicionIva?: string
  direccion?: string
}

interface TipoServicio {
  id: string
  codigo: string
  nombre: string
  unidad: string
  porcentajeIva: number
  activo: boolean
}

interface DetalleFactura {
  id: string
  tipoProducto: string
  descripcion: string
  cantidad: number
  unidad: string
  precioUnitario: number
  subtotal: number
  tipoServicio?: TipoServicio
  tropaCodigo?: string
}

interface PagoFactura {
  id: string
  fecha: string
  monto: number
  metodoPago: string
  referencia?: string
}

interface FacturaTributo {
  id: string
  facturaId: string
  tributoId: number
  descripcion: string
  baseImponible: number
  alicuota: number
  importe: number
  createdAt: string
}

interface NotaCreditoDebito {
  id: string
  tipo: 'CREDITO' | 'DEBITO'
  tipoComprobante: number
  facturaId: string
  factura?: { id: string; numero: string; clienteNombre?: string; clienteId?: string; tipoComprobante?: string }
  numero: number
  puntoVenta: number
  fecha: string
  motivo: string
  descripcion?: string
  cae?: string
  caeVencimiento?: string
  subtotal: number
  iva: number
  total: number
  estado: 'EMITIDA' | 'ANULADA'
  operadorId?: string
  operador?: { id: string; nombre: string }
  createdAt: string
}

interface Factura {
  id: string
  numero: string
  numeroInterno: number
  tipoComprobante: 'FACTURA_A' | 'FACTURA_B' | 'FACTURA_C' | 'REMITO' | 'NOTA_CREDITO' | 'NOTA_DEBITO'
  clienteId: string
  cliente: Cliente
  clienteNombre?: string
  clienteCuit?: string
  clienteCondicionIva?: string
  clienteDireccion?: string
  fecha: string
  subtotal: number
  iva: number
  porcentajeIva: number
  total: number
  importeTributos: number
  saldo: number
  estado: 'PENDIENTE' | 'EMITIDA' | 'PAGADA' | 'ANULADA'
  condicionVenta?: string
  remito?: string
  observaciones?: string
  cae?: string
  caeVencimiento?: string
  puntoVenta: number
  numeroAfip?: number
  detalles: DetalleFactura[]
  pagos: PagoFactura[]
  tributos?: FacturaTributo[]
  notas?: NotaCreditoDebito[]
  operador?: { id: string; nombre: string }
  planillasFactura?: { numeroTropa: number; tropaId?: string }[]
}

interface Props { operador: Operador }

const TIPOS_COMPROBANTE = [
  { value: 'FACTURA_A', label: 'Factura A', descr: 'Para Responsables Inscriptos' },
  { value: 'FACTURA_B', label: 'Factura B', descr: 'Para Consumidor Final/Monotributo' },
  { value: 'FACTURA_C', label: 'Factura C', descr: 'Para Exentos/No Categorizados' },
]

const METODOS_PAGO = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia Bancaria' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'TARJETA_DEBITO', label: 'Tarjeta Débito' },
  { value: 'TARJETA_CREDITO', label: 'Tarjeta Crédito' },
]

export function FacturacionModule({ operador }: Props) {
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [tiposServicio, setTiposServicio] = useState<TipoServicio[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pagoOpen, setPagoOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [facturaSeleccionada, setFacturaSeleccionada] = useState<Factura | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'PENDIENTE' | 'EMITIDA' | 'PAGADA' | 'ANULADA'>('TODOS')
  const [searchTerm, setSearchTerm] = useState('')
  const [tabActivo, setTabActivo] = useState('vbServFaena')

  // Badge counts for tabs
  const [badgeCounts, setBadgeCounts] = useState({ borrador: 0, aprobado: 0, facturado: 0, vencidas: 0 })

  // Supervisor Edit state
  const [supervisorEditOpen, setSupervisorEditOpen] = useState(false)
  const [supervisorPassword, setSupervisorPassword] = useState('')
  const [supervisorPasswordError, setSupervisorPasswordError] = useState('')
  const [editFacturaData, setEditFacturaData] = useState<any>(null)

  const [formData, setFormData] = useState({
    clienteId: '',
    fecha: new Date().toISOString().split('T')[0],
    condicionVenta: 'CUENTA_CORRIENTE',
    remito: '',
    observaciones: '',
    detalles: [{ tipoServicioId: '', descripcion: '', cantidad: 1, unidad: 'KG', precioUnitario: 0 }]
  })

  const [pagoData, setPagoData] = useState({
    monto: 0,
    metodoPago: 'EFECTIVO',
    referencia: '',
    banco: '',
    observaciones: ''
  })

  // Notas C/D state
  const [notas, setNotas] = useState<NotaCreditoDebito[]>([])
  const [notasResumen, setNotasResumen] = useState<any>(null)
  const [loadingNotas, setLoadingNotas] = useState(false)
  const [filtroNotasTipo, setFiltroNotasTipo] = useState<'TODOS' | 'CREDITO' | 'DEBITO'>('TODOS')
  const [filtroNotasEstado, setFiltroNotasEstado] = useState<'TODOS' | 'EMITIDA' | 'ANULADA'>('TODOS')
  const [filtroNotasDesde, setFiltroNotasDesde] = useState('')
  const [filtroNotasHasta, setFiltroNotasHasta] = useState('')
  const [notaDialogOpen, setNotaDialogOpen] = useState(false)
  const [notaAnularOpen, setNotaAnularOpen] = useState(false)
  const [notaAnularId, setNotaAnularId] = useState<string | null>(null)
  const [notaFormData, setNotaFormData] = useState({
    facturaId: '',
    tipo: 'CREDITO' as 'CREDITO' | 'DEBITO',
    motivo: 'DEVOLUCION',
    descripcion: '',
    subtotal: 0,
    iva: 0,
    total: 0,
  })

  // Tributo state
  const [tributoDialogOpen, setTributoDialogOpen] = useState(false)
  const [tributoFormData, setTributoFormData] = useState({
    facturaId: '',
    tributoId: 1,
    descripcion: '',
    baseImponible: 0,
    alicuota: 0,
    importe: 0,
  })
  const [tributosFactura, setTributosFactura] = useState<FacturaTributo[]>([])

  // Tarifas vigentes for auto-fill
  const [tarifasVigentes, setTarifasVigentes] = useState<any[]>([])

  // Informes state
  const [informeData, setInformeData] = useState<any>(null)
  const [loadingInforme, setLoadingInforme] = useState(false)
  const [filtroInformeTipo, setFiltroInformeTipo] = useState<'general' | 'semanal' | 'mensual' | 'porCliente' | 'porTipo'>('general')
  const [filtroInformeDesde, setFiltroInformeDesde] = useState('')
  const [filtroInformeHasta, setFiltroInformeHasta] = useState('')

  // Tipo comprobante auto-determined
  const [autoTipoComprobante, setAutoTipoComprobante] = useState<string>('')
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    fetchAll()
  }, [])

  // Fetch tarifas vigentes
  useEffect(() => {
    const fetchTarifas = async () => {
      try {
        const res = await fetch('/api/tarifas?modo=vigentes')
        const data = await res.json()
        if (data.success) setTarifasVigentes(data.data)
      } catch { /* ignore */ }
    }
    fetchTarifas()
  }, [])

  // Auto-determine tipoComprobante when cliente changes
  useEffect(() => {
    if (formData.clienteId) {
      const cliente = clientes.find(c => c.id === formData.clienteId)
      if (cliente) {
        const cond = (cliente.condicionIva || '').toUpperCase().trim()
        // La BD guarda códigos cortos: RI, CF, MT, EX, NC
        // También soportar descripciones largas por compatibilidad
        if (cond === 'RI' || cond.includes('RESPONSABLE') || cond.includes('INSCRIPTO')) {
          setAutoTipoComprobante('FACTURA_A')
        } else if (cond === 'CF' || cond === 'MT' || cond.includes('MONOTRIBUTO') || cond.includes('CONSUMIDOR') || cond.includes('FINAL')) {
          setAutoTipoComprobante('FACTURA_B')
        } else if (cond === 'EX' || cond === 'NC' || cond === 'NR' || cond.includes('EXENTO') || cond.includes('NO CATEGORIZADO') || cond.includes('NO RESPONSABLE')) {
          setAutoTipoComprobante('FACTURA_C')
        } else {
          setAutoTipoComprobante('FACTURA_B')
        }
      }
    } else {
      setAutoTipoComprobante('')
    }
  }, [formData.clienteId, clientes])

  // Fetch badge counts
  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const [vbRes, pagosRes] = await Promise.all([
          fetch('/api/facturacion/planilla-servicio-faena/vb?estado=BORRADOR&limite=1'),
          fetch('/api/facturacion/pagos-saldos?limite=1'),
        ])
        const vbData = await vbRes.json()
        const pagosData = await pagosRes.json()
        if (vbData.success) {
          setBadgeCounts(prev => ({
            ...prev,
            borrador: vbData.counts?.BORRADOR || 0,
            aprobado: vbData.counts?.APROBADO || 0,
            facturado: vbData.counts?.FACTURADO || 0,
          }))
        }
        if (pagosData.success) {
          setBadgeCounts(prev => ({
            ...prev,
            vencidas: pagosData.kpis?.facturasVencidas || 0,
          }))
        }
      } catch { /* ignore */ }
    }
    fetchBadges()
  }, [])

  // Cargar datos cuando se cambia al tab
  useEffect(() => {
    if (tabActivo === 'notas') {
      fetchNotas()
    } else if (tabActivo === 'informes') {
      fetchInforme()
    }
  }, [tabActivo, filtroNotasTipo, filtroNotasEstado, filtroNotasDesde, filtroNotasHasta, filtroInformeTipo, filtroInformeDesde, filtroInformeHasta])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [facturasRes, planillasRes, clientesRes, tiposRes] = await Promise.all([
        fetch('/api/facturacion'),
        fetch('/api/facturacion?source=planillas'),
        fetch('/api/clientes'),
        fetch('/api/tipos-servicio?activo=true&seFactura=true')
      ])

      const [facturasData, planillasData, clientesData, tiposData] = await Promise.all([
        facturasRes.json(),
        planillasRes.json(),
        clientesRes.json(),
        tiposRes.json()
      ])

      // Combinar facturas generales + planillas facturadas
      const facturasGeneral: Factura[] = facturasData.success ? facturasData.data : []
      const facturasDesdePlanillas: Factura[] = planillasData.success ? planillasData.data : []
      
      // Marcar planillas para diferenciación
      const todas = [...facturasDesdePlanillas, ...facturasGeneral]
      setFacturas(todas)
      if (clientesData.success) setClientes(clientesData.data)
      if (tiposData.success) setTiposServicio(tiposData.data)
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const fetchNotas = async () => {
    setLoadingNotas(true)
    try {
      const params = new URLSearchParams()
      if (filtroNotasTipo !== 'TODOS') params.set('tipo', filtroNotasTipo)
      if (filtroNotasEstado !== 'TODOS') params.set('estado', filtroNotasEstado)
      if (filtroNotasDesde) params.set('desde', filtroNotasDesde)
      if (filtroNotasHasta) params.set('hasta', filtroNotasHasta)
      const res = await fetch(`/api/facturacion/notas?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setNotas(data.data)
        setNotasResumen(data.resumen)
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar notas')
    } finally {
      setLoadingNotas(false)
    }
  }

  const handleAnularNota = async () => {
    if (!notaAnularId) return
    setSaving(true)
    try {
      const res = await fetch('/api/facturacion/notas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notaAnularId, estado: 'ANULADA', operadorId: operador.id })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Nota anulada exitosamente')
        setNotaAnularOpen(false)
        setNotaAnularId(null)
        fetchNotas()
      } else {
        toast.error(data.error || 'Error al anular nota')
      }
    } catch {
      toast.error('Error al anular nota')
    } finally {
      setSaving(false)
    }
  }

  const handleDescargarPDFNota = async (notaId: string) => {
    try {
      const res = await fetch('/api/facturacion/notas/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notaId })
      })
      if (!res.ok) throw new Error('Error al generar PDF')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const contentDisposition = res.headers.get('Content-Disposition')
      const filename = contentDisposition?.split('filename=')[1]?.replace(/"/g, '') || 'nota.pdf'
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF descargado')
    } catch {
      toast.error('Error al descargar PDF')
    }
  }

  const fetchInforme = async () => {
    setLoadingInforme(true)
    try {
      const params = new URLSearchParams()
      params.set('tipo', filtroInformeTipo)
      if (filtroInformeDesde) params.set('fechaDesde', filtroInformeDesde)
      if (filtroInformeHasta) params.set('fechaHasta', filtroInformeHasta)
      const res = await fetch(`/api/facturacion/informes?${params.toString()}`)
      const data = await res.json()
      if (data.success) setInformeData(data.data)
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar informe')
    } finally {
      setLoadingInforme(false)
    }
  }

  const handleExportInformeCSV = () => {
    if (!facturas.length) return
    const headers = ['Número', 'Tipo', 'Fecha', 'Cliente', 'CUIT', 'Cond. IVA', 'Subtotal', 'IVA', 'Total', 'Pagado', 'Saldo', 'Estado']
    const rows = facturas.filter(f => f.estado !== 'ANULADA').map(f => {
      const totalPagado = f.pagos?.reduce((s: number, p: PagoFactura) => s + p.monto, 0) || 0
      return [
        f.numero,
        TIPOS_COMPROBANTE.find(t => t.value === f.tipoComprobante)?.label || f.tipoComprobante,
        new Date(f.fecha).toLocaleDateString('es-AR'),
        f.clienteNombre || f.cliente?.nombre || '',
        f.clienteCuit || '',
        f.clienteCondicionIva || '',
        f.subtotal?.toFixed(2),
        f.iva?.toFixed(2),
        f.total?.toFixed(2),
        totalPagado.toFixed(2),
        f.saldo?.toFixed(2),
        f.estado,
      ]
    })
    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `informe_facturacion_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Informe descargado')
  }

  const fetchTributosFactura = async (facturaId: string) => {
    try {
      const res = await fetch(`/api/facturacion/tributos?facturaId=${facturaId}`)
      const data = await res.json()
      if (data.success) setTributosFactura(data.data)
    } catch {
      toast.error('Error al cargar tributos')
    }
  }

  const handleSupervisorEdit = async () => {
    if (!supervisorPassword) {
      setSupervisorPasswordError('Ingrese la clave de supervisor')
      return
    }
    if (!facturaSeleccionada || !editFacturaData) return

    setSaving(true)
    try {
      const res = await fetch(`/api/facturacion/${facturaSeleccionada.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supervisorPassword,
          numero: editFacturaData.numero,
          observaciones: editFacturaData.observaciones,
        })
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Factura ${editFacturaData.numero} actualizada exitosamente`)
        setSupervisorEditOpen(false)
        setSupervisorPassword('')
        setEditFacturaData(null)
        fetchAll()
      } else {
        setSupervisorPasswordError(data.error || 'Clave de supervisor incorrecta')
      }
    } catch {
      toast.error('Error al actualizar factura')
    } finally {
      setSaving(false)
    }
  }

  const handleNuevaFactura = () => {
    setFormData({
      clienteId: '',
      fecha: new Date().toISOString().split('T')[0],
      condicionVenta: 'CUENTA_CORRIENTE',
      remito: '',
      observaciones: '',
      detalles: [{ tipoServicioId: '', descripcion: '', cantidad: 1, unidad: 'KG', precioUnitario: 0 }]
    })
    setDialogOpen(true)
  }

  const handleAgregarDetalle = () => {
    setFormData({
      ...formData,
      detalles: [...formData.detalles, { tipoServicioId: '', descripcion: '', cantidad: 1, unidad: 'KG', precioUnitario: 0 }]
    })
  }

  const handleEliminarDetalle = (index: number) => {
    if (formData.detalles.length === 1) return
    const nuevosDetalles = formData.detalles.filter((_, i) => i !== index)
    setFormData({ ...formData, detalles: nuevosDetalles })
  }

  const handleDetalleChange = (index: number, field: string, value: any) => {
    const nuevosDetalles = [...formData.detalles]
    nuevosDetalles[index] = { ...nuevosDetalles[index], [field]: value }
    
    // Si cambia el tipo de servicio, actualizar descripción y unidad
    if (field === 'tipoServicioId') {
      const tipo = tiposServicio.find(t => t.id === value)
      if (tipo) {
        nuevosDetalles[index].descripcion = tipo.nombre
        nuevosDetalles[index].unidad = tipo.unidad
      }
    }
    
    setFormData({ ...formData, detalles: nuevosDetalles })
  }

  const handleGuardar = async () => {
    if (!formData.clienteId) {
      toast.error('Debe seleccionar un cliente')
      return
    }

    if (formData.detalles.some(d => !d.descripcion || d.cantidad <= 0)) {
      toast.error('Complete todos los detalles correctamente')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/facturacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          operadorId: operador.id
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success(`Factura ${data.data.numero} creada exitosamente`)
        setDialogOpen(false)
        fetchAll()
      } else {
        toast.error(data.error || 'Error al crear factura')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al crear factura')
    } finally {
      setSaving(false)
    }
  }

  const handleMarcarPagada = async (factura: Factura) => {
    try {
      const res = await fetch('/api/facturacion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: factura.id, estado: 'PAGADA' })
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Factura ${factura.numero} marcada como pagada`)
        fetchAll()
      }
    } catch {
      toast.error('Error al actualizar estado')
    }
  }

  const handleRegistrarPago = async () => {
    if (!facturaSeleccionada || pagoData.monto <= 0) {
      toast.error('Ingrese un monto válido')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/cuenta-corriente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facturaId: facturaSeleccionada.id,
          ...pagoData,
          operadorId: operador.id
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success('Pago registrado exitosamente')
        setPagoOpen(false)
        setPagoData({ monto: 0, metodoPago: 'EFECTIVO', referencia: '', banco: '', observaciones: '' })
        fetchAll()
      } else {
        toast.error(data.error || 'Error al registrar pago')
      }
    } catch {
      toast.error('Error al registrar pago')
    } finally {
      setSaving(false)
    }
  }

  const handleAnular = async () => {
    if (!facturaSeleccionada) return
    setSaving(true)
    try {
      const res = await fetch(`/api/facturacion?id=${facturaSeleccionada.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast.success(`Factura ${facturaSeleccionada.numero} anulada`)
        setDeleteOpen(false)
        fetchAll()
      } else {
        toast.error(data.error || 'Error al anular')
      }
    } catch {
      toast.error('Error al anular factura')
    } finally {
      setSaving(false)
    }
  }

  const handleGuardarNota = async () => {
    if (!notaFormData.facturaId || !notaFormData.motivo) {
      toast.error('Seleccione una factura y un motivo')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/facturacion/notas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...notaFormData, operadorId: operador.id })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Nota creada exitosamente')
        setNotaDialogOpen(false)
        setNotaFormData({ facturaId: '', tipo: 'CREDITO', motivo: 'DEVOLUCION', descripcion: '', subtotal: 0, iva: 0, total: 0 })
        fetchNotas()
        fetchAll()
      } else {
        toast.error(data.error || 'Error al crear nota')
      }
    } catch {
      toast.error('Error al crear nota')
    } finally {
      setSaving(false)
    }
  }

  const handleAddTributo = async () => {
    if (!tributoFormData.facturaId || !tributoFormData.descripcion) {
      toast.error('Seleccione una factura e ingrese descripción')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/facturacion/tributos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tributoFormData)
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Tributo agregado exitosamente')
        setTributoDialogOpen(false)
        setTributoFormData({ facturaId: '', tributoId: 1, descripcion: '', baseImponible: 0, alicuota: 0, importe: 0 })
        fetchTributosFactura(tributoFormData.facturaId)
        fetchAll()
      } else {
        toast.error(data.error || 'Error al agregar tributo')
      }
    } catch {
      toast.error('Error al agregar tributo')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTributo = async (tributoId: string, facturaId: string) => {
    try {
      const res = await fetch(`/api/facturacion/tributos?id=${tributoId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast.success('Tributo eliminado')
        fetchTributosFactura(facturaId)
        fetchAll()
      } else {
        toast.error(data.error || 'Error al eliminar tributo')
      }
    } catch {
      toast.error('Error al eliminar tributo')
    }
  }

  const handleImprimir = (factura: Factura) => {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      const tipoLabel = TIPOS_COMPROBANTE.find(t => t.value === factura.tipoComprobante)?.label || 'Factura'
      printWindow.document.write(`<!DOCTYPE html>
<html><head><title>Comprobante ${factura.numero}</title>
<style>
body{font-family:Arial;padding:40px;max-width:800px;margin:0 auto}
.header{text-align:center;border-bottom:2px solid #333;padding-bottom:20px;margin-bottom:30px}
.title{font-size:24px;font-weight:bold}
.row{display:flex;margin-bottom:8px}
.label{font-weight:bold;width:200px;color:#555}
.value{flex:1}
.total{font-size:20px;font-weight:bold;margin-top:20px;text-align:right}
table{width:100%;border-collapse:collapse;margin-top:20px}
th,td{border:1px solid #ddd;padding:8px;text-align:left}
th{background:#f5f5f5}
</style></head>
<body>
<div class="header">
<div class="title">${tipoLabel}</div>
<div>N° ${factura.numero}</div>
</div>
<div class="row"><span class="label">Fecha:</span><span class="value">${new Date(factura.fecha).toLocaleDateString('es-AR')}</span></div>
<div class="row"><span class="label">Cliente:</span><span class="value">${factura.clienteNombre || factura.cliente?.nombre}</span></div>
<div class="row"><span class="label">CUIT:</span><span class="value">${factura.clienteCuit || '-'}</span></div>
<div class="row"><span class="label">Condición IVA:</span><span class="value">${factura.clienteCondicionIva || '-'}</span></div>
<div class="row"><span class="label">Dirección:</span><span class="value">${factura.clienteDireccion || '-'}</span></div>
<table>
<thead><tr><th>Descripción</th><th>Cantidad</th><th>Unidad</th><th>P. Unit.</th><th>Subtotal</th></tr></thead>
<tbody>
${factura.detalles?.map(d => `<tr>
<td>${d.descripcion}</td>
<td>${d.cantidad}</td>
<td>${d.unidad}</td>
<td>$${d.precioUnitario.toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
<td>$${d.subtotal.toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
</tr>`).join('') || ''}
</tbody>
</table>
<div class="total">
<p>Subtotal: $${factura.subtotal?.toLocaleString('es-AR', {minimumFractionDigits:2}) || '0.00'}</p>
${factura.iva > 0 ? `<p>IVA (${factura.porcentajeIva}%): $${factura.iva?.toLocaleString('es-AR', {minimumFractionDigits:2})}</p>` : ''}
<p style="font-size:24px">Total: $${factura.total?.toLocaleString('es-AR', {minimumFractionDigits:2}) || '0.00'}</p>
</div>
</body></html>`)
      printWindow.document.close()
      printWindow.print()
    }
    toast.success('Enviando a impresión...')
  }

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'PENDIENTE': return <Badge className="bg-amber-100 text-amber-700">Pendiente</Badge>
      case 'EMITIDA': return <Badge className="bg-blue-100 text-blue-700">Emitida</Badge>
      case 'PAGADA': return <Badge className="bg-emerald-100 text-emerald-700">Pagada</Badge>
      case 'ANULADA': return <Badge className="bg-red-100 text-red-700">Anulada</Badge>
      default: return <Badge>{estado}</Badge>
    }
  }

  const FacturaStatusTimeline = ({ estado }: { estado: string }) => {
    const steps = [
      { id: 'EMITIDA', label: 'Emitida' },
      { id: 'ENVIADA', label: 'Enviada' },
      { id: 'COBRADA', label: 'Cobrada' },
    ]
    
    const currentIndex = steps.findIndex(s => {
      if (estado === 'PAGADA') return s.id === 'COBRADA'
      if (estado === 'EMITIDA' || estado === 'PENDIENTE') return s.id === 'EMITIDA'
      if (estado === 'ANULADA') return -1
      return false
    })

    const isAnulada = estado === 'ANULADA'

    if (isAnulada) {
      return getEstadoBadge('ANULADA')
    }

    return (
      <div className="flex items-center gap-0.5">
        {steps.map((step, i) => {
          const isCompleted = estado === 'PAGADA' ? i <= 2 : i === 0 && (estado === 'EMITIDA' || estado === 'PENDIENTE')
          const isCurrent = i === Math.max(currentIndex, 0)
          const isPending = i > Math.max(currentIndex, 0)

          return (
            <div key={step.id} className="flex items-center">
              <div className="flex items-center gap-1">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  isCompleted || isCurrent
                    ? (step.id === 'COBRADA' && estado === 'PAGADA')
                      ? 'bg-emerald-500'
                      : (step.id === 'ENVIADA' && isCurrent)
                        ? 'bg-blue-500'
                        : 'bg-amber-500'
                    : 'bg-stone-200'
                }`} />
                <span className={`text-[10px] whitespace-nowrap ${
                  isCompleted || isCurrent ? 'text-stone-700 font-medium' : 'text-stone-400'
                }`}>
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-4 h-0.5 mx-0.5 ${
                  (isCompleted && steps.findIndex(s => s.id === 'COBRADA' && estado === 'PAGADA') >= i) || (estado === 'PAGADA' && i < 2)
                    ? 'bg-stone-400'
                    : 'bg-stone-200'
                }`} />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(amount)

  const facturasFiltradas = facturas.filter(f => {
    const matchEstado = filtroEstado === 'TODOS' || f.estado === filtroEstado
    const matchSearch = !searchTerm || 
      f.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.cliente?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.clienteNombre?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchEstado && matchSearch
  }).sort((a, b) => {
    // Ordenar por número de tropa (desde planilla de servicio faena)
    const tropaA = a.planillasFactura?.[0]?.numeroTropa
    const tropaB = b.planillasFactura?.[0]?.numeroTropa
    if (tropaA != null && tropaB != null) return tropaA - tropaB
    if (tropaA != null) return -1
    if (tropaB != null) return 1
    // Sin tropa: ordenar por fecha descendente
    return new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  })

  const totalFacturas = facturas.length
  const pendientes = facturas.filter(f => f.estado === 'PENDIENTE').length
  const pagadas = facturas.filter(f => f.estado === 'PAGADA').length
  const montoTotal = facturas.filter(f => f.estado !== 'ANULADA').reduce((sum, f) => sum + (f.total || 0), 0)

  // Professional dashboard KPIs
  const ahora = new Date()
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  const totalFacturadoMes = facturas
    .filter(f => f.estado !== 'ANULADA' && new Date(f.fecha) >= inicioMes)
    .reduce((sum, f) => sum + (f.total || 0), 0)
  const pendienteCobro = facturas
    .filter(f => f.estado !== 'ANULADA' && f.estado !== 'PAGADA' && f.saldo > 0)
    .reduce((sum, f) => sum + (f.saldo || 0), 0)
  const facturasVencidas = facturas.filter(f => {
    if (f.estado === 'PAGADA' || f.estado === 'ANULADA') return false
    const fechaFact = new Date(f.fecha)
    const diasTranscurridos = Math.floor((ahora.getTime() - fechaFact.getTime()) / (1000 * 60 * 60 * 24))
    return diasTranscurridos > 30
  })
  const vencidasMonto = facturasVencidas.reduce((sum, f) => sum + (f.saldo || 0), 0)
  const facturasPagadas = facturas.filter(f => f.estado === 'PAGADA')
  const promedioDiasCobro = facturasPagadas.length > 0
    ? facturasPagadas.reduce((sum, f) => {
        const fechaFact = new Date(f.fecha)
        const pagos = f.pagos || []
        const fechaPago = pagos.length > 0 ? new Date(pagos[pagos.length - 1].fecha) : fechaFact
        return sum + Math.floor((fechaPago.getTime() - fechaFact.getTime()) / (1000 * 60 * 60 * 24))
      }, 0) / facturasPagadas.length
    : 0

  // Auto-calculate totals for nueva factura
  const detallesSubtotal = formData.detalles.reduce((sum, d) => sum + (d.cantidad * d.precioUnitario), 0)
  const ivaRate = formData.detalles.reduce((maxRate, d) => {
    const tipo = tiposServicio.find(t => t.id === d.tipoServicioId)
    return tipo && tipo.porcentajeIva > maxRate ? tipo.porcentajeIva : maxRate
  }, 21)
  const calculoIva = autoTipoComprobante === 'FACTURA_A' ? detallesSubtotal * (ivaRate / 100) : 0
  const calculoTotal = autoTipoComprobante === 'FACTURA_A' ? detallesSubtotal + calculoIva : detallesSubtotal

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-stone-800 flex items-center gap-2">
              <Receipt className="w-8 h-8 text-amber-500" />
              Facturación
            </h1>
            <p className="text-stone-500 mt-1">Gestión de facturas y cuenta corriente</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchAll} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" /> Actualizar
            </Button>
            <Button onClick={handleNuevaFactura} className="bg-amber-500 hover:bg-amber-600">
              <Plus className="w-4 h-4 mr-2" /> Nueva Factura
            </Button>
          </div>
        </div>

        {/* Professional Dashboard KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-amber-100/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-200/60 rounded-lg"><DollarSign className="w-5 h-5 text-amber-700" /></div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold">Total Facturado (mes)</p>
                  <p className="text-lg font-bold text-amber-800">{formatCurrency(totalFacturadoMes)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-orange-50 to-orange-100/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-200/60 rounded-lg"><CreditCard className="w-5 h-5 text-orange-700" /></div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-orange-600 font-semibold">Pendiente Cobro</p>
                  <p className="text-lg font-bold text-orange-800">{formatCurrency(pendienteCobro)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-red-50 to-red-100/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-200/60 rounded-lg"><AlertCircle className="w-5 h-5 text-red-700" /></div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-red-600 font-semibold">Facturas Vencidas</p>
                  <p className="text-lg font-bold text-red-800">{facturasVencidas.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50 to-emerald-100/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-200/60 rounded-lg"><Clock className="w-5 h-5 text-emerald-700" /></div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-semibold">Prom. Días Cobro</p>
                  <p className="text-lg font-bold text-emerald-800">{promedioDiasCobro > 0 ? `${promedioDiasCobro.toFixed(0)} días` : '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={tabActivo} onValueChange={setTabActivo} className="space-y-6">
          <TabsList className="grid w-full grid-cols-8 max-w-6xl">
            <TabsTrigger value="vbServFaena" className="gap-1 text-xs">
              <Eye className="w-4 h-4" />VB Datos
              {badgeCounts.borrador > 0 && <span className="ml-1 bg-amber-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">{badgeCounts.borrador}</span>}
            </TabsTrigger>
            <TabsTrigger value="cargaServFaena" className="gap-1 text-xs">
              <Upload className="w-4 h-4" />Carga
              {badgeCounts.aprobado > 0 && <span className="ml-1 bg-emerald-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">{badgeCounts.aprobado}</span>}
            </TabsTrigger>
            <TabsTrigger value="facturas" className="gap-1 text-xs">Facturas</TabsTrigger>
            <TabsTrigger value="notas" className="gap-1 text-xs">
              <ArrowLeftRight className="w-4 h-4" />Notas
            </TabsTrigger>
            <TabsTrigger value="pagosSaldos" className="gap-1 text-xs">
              <CreditCard className="w-4 h-4" />Pagos y Saldos
              {badgeCounts.vencidas > 0 && <span className="ml-1 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold animate-pulse">{badgeCounts.vencidas}</span>}
            </TabsTrigger>
            <TabsTrigger value="detalle" className="gap-1 text-xs">
              <FileSpreadsheet className="w-4 h-4" />Detalle
            </TabsTrigger>
            <TabsTrigger value="informes" className="gap-1 text-xs">
              <BarChart3 className="w-4 h-4" />Informes
            </TabsTrigger>
            <TabsTrigger value="historialPrecios" className="gap-1 text-xs">
              <History className="w-4 h-4" />Precios
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: VB DATOS SERVICIO FAENA */}
          <TabsContent value="vbServFaena" className="space-y-4">
            <VBServFaenaTab operador={operador} />
          </TabsContent>

          {/* TAB 2: CARGA DATOS FAENA */}
          <TabsContent value="cargaServFaena" className="space-y-4">
            <CargaServFaenaTab operador={operador} />
          </TabsContent>

          {/* TAB 3: FACTURAS */}
          <TabsContent value="facturas" className="space-y-6">
            {/* Financial Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-200/60 rounded-lg"><DollarSign className="w-5 h-5 text-blue-700" /></div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-blue-600 font-semibold">Total del Mes</p>
                      <p className="text-xl font-bold text-blue-800">{formatCurrency(totalFacturadoMes)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-amber-100/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-200/60 rounded-lg"><Clock className="w-5 h-5 text-amber-700" /></div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-amber-600 font-semibold">Pendiente de Cobro</p>
                      <p className="text-xl font-bold text-amber-800">{formatCurrency(pendienteCobro)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-md bg-gradient-to-br from-red-50 to-red-100/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-red-200/60 rounded-lg"><AlertTriangle className="w-5 h-5 text-red-700" /></div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-red-600 font-semibold">Vencidas</p>
                      <p className="text-xl font-bold text-red-800">{formatCurrency(vencidasMonto)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Status Tabs: Pendientes / Emitidas / Cobradas */}
            <Tabs value={filtroEstado === 'TODOS' || filtroEstado === 'ANULADA' ? 'TODOS' : filtroEstado} onValueChange={(v) => setFiltroEstado(v as typeof filtroEstado)} className="space-y-4">
              <TabsList className="grid w-full max-w-lg grid-cols-4">
                <TabsTrigger value="TODOS" className="gap-1.5 text-xs">
                  <FileText className="w-3.5 h-3.5" /> Todas
                </TabsTrigger>
                <TabsTrigger value="PENDIENTE" className="gap-1.5 text-xs">
                  <Clock className="w-3.5 h-3.5" /> Pendientes
                </TabsTrigger>
                <TabsTrigger value="EMITIDA" className="gap-1.5 text-xs">
                  <DollarSign className="w-3.5 h-3.5" /> Emitidas
                </TabsTrigger>
                <TabsTrigger value="PAGADA" className="gap-1.5 text-xs">
                  <CheckCircle className="w-3.5 h-3.5" /> Cobradas
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Search filter */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <Input placeholder="Buscar por número o cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                  </div>
                  <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as typeof filtroEstado)}>
                    <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="Filtrar por estado" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todos los estados</SelectItem>
                      <SelectItem value="PENDIENTE">Pendientes</SelectItem>
                      <SelectItem value="EMITIDA">Emitidas</SelectItem>
                      <SelectItem value="PAGADA">Pagadas</SelectItem>
                      <SelectItem value="ANULADA">Anuladas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Tabla de Facturas */}
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-stone-50 rounded-t-lg">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-500" /> Listado de Comprobantes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
                ) : facturasFiltradas.length === 0 ? (
                  <div className="py-12 text-center text-stone-400">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>No hay comprobantes que mostrar</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-semibold">Tropa</TableHead>
                          <TableHead className="font-semibold">Número</TableHead>
                          <TableHead className="font-semibold">Fecha</TableHead>
                          <TableHead className="font-semibold">Cliente</TableHead>
                          <TableHead className="font-semibold">Tipo</TableHead>
                          <TableHead className="font-semibold">Total</TableHead>
                          <TableHead className="font-semibold">Saldo</TableHead>
                          <TableHead className="font-semibold">Estado</TableHead>
                          <TableHead className="font-semibold text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {facturasFiltradas.map((factura) => (
                          <TableRow key={factura.id} className={factura.estado === 'ANULADA' ? 'opacity-50' : ''}>
                            <TableCell className="font-mono font-medium text-stone-600">{factura.planillasFactura?.[0]?.numeroTropa ?? '-'}</TableCell>
                            <TableCell className="font-mono font-medium">{factura.numero}</TableCell>
                            <TableCell>{new Date(factura.fecha).toLocaleDateString('es-AR')}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{factura.clienteNombre || factura.cliente?.nombre}</p>
                                {factura.clienteCuit && <p className="text-xs text-stone-500">CUIT: {factura.clienteCuit}</p>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{TIPOS_COMPROBANTE.find(t => t.value === factura.tipoComprobante)?.label || factura.tipoComprobante}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{formatCurrency(factura.total)}</TableCell>
                            <TableCell className={factura.saldo > 0 ? 'text-amber-600 font-medium' : ''}>
                              {formatCurrency(factura.saldo)}
                            </TableCell>
                            <TableCell><FacturaStatusTimeline estado={factura.estado} /></TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => { setFacturaSeleccionada(factura); setViewOpen(true) }} title="Ver detalle"><Eye className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => handleImprimir(factura)} title="Imprimir" disabled={factura.estado === 'ANULADA'}><Printer className="w-4 h-4" /></Button>
                                {factura.estado === 'PENDIENTE' && (
                                  <>
                                    <Button variant="ghost" size="icon" onClick={() => { setFacturaSeleccionada(factura); setPagoData({ ...pagoData, monto: factura.saldo }); setPagoOpen(true) }} title="Registrar pago" className="text-emerald-600"><CreditCard className="w-4 h-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleMarcarPagada(factura)} title="Marcar pagada" className="text-emerald-600"><CheckCircle className="w-4 h-4" /></Button>
                                  </>
                                )}
                                {factura.estado !== 'ANULADA' && (
                                  <Button variant="ghost" size="icon" onClick={() => {
                                    setFacturaSeleccionada(factura)
                                    setEditFacturaData({
                                      numero: factura.numero,
                                      observaciones: factura.observaciones || ''
                                    })
                                    setSupervisorPassword('')
                                    setSupervisorPasswordError('')
                                    setSupervisorEditOpen(true)
                                  }} title="Editar" className="text-blue-500"><Pencil className="w-4 h-4" /></Button>
                                )}
                                {factura.estado !== 'ANULADA' && factura.estado !== 'PAGADA' && (
                                  <Button variant="ghost" size="icon" onClick={() => { setFacturaSeleccionada(factura); setDeleteOpen(true) }} title="Anular" className="text-red-500"><XCircle className="w-4 h-4" /></Button>
                                )}
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
          </TabsContent>

          {/* TAB 5: PAGOS Y SALDOS */}
          <TabsContent value="pagosSaldos" className="space-y-4">
            <PagosSaldosTab operador={operador} />
          </TabsContent>

          {/* TAB 4: NOTAS */}
          <TabsContent value="notas" className="space-y-4">
            {/* KPIs Notas */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card className="border-0 shadow-sm bg-blue-50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-stone-500">Total Notas</p>
                      <p className="text-xl font-bold text-blue-700">{notasResumen?.total || notas.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-sky-50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <ArrowLeftRight className="w-5 h-5 text-sky-600" />
                    <div>
                      <p className="text-xs text-stone-500">NC Monto</p>
                      <p className="text-lg font-bold text-sky-700">{formatCurrency(notasResumen?.creditoMonto || notas.filter(n => n.tipo === 'CREDITO' && n.estado === 'EMITIDA').reduce((s, n) => s + n.total, 0))}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-red-50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="text-xs text-stone-500">ND Monto</p>
                      <p className="text-lg font-bold text-red-700">{formatCurrency(notasResumen?.debitoMonto || notas.filter(n => n.tipo === 'DEBITO' && n.estado === 'EMITIDA').reduce((s, n) => s + n.total, 0))}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-stone-50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-stone-600" />
                    <div>
                      <p className="text-xs text-stone-500">Saldo Neto</p>
                      <p className={`text-lg font-bold ${(notasResumen?.saldoNeto || 0) >= 0 ? 'text-red-700' : 'text-sky-700'}`}>
                        {formatCurrency(notasResumen?.saldoNeto ?? (notas.filter(n => n.tipo === 'DEBITO' && n.estado === 'EMITIDA').reduce((s, n) => s + n.total, 0) - notas.filter(n => n.tipo === 'CREDITO' && n.estado === 'EMITIDA').reduce((s, n) => s + n.total, 0)))}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm bg-amber-50">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="text-xs text-stone-500">Anuladas</p>
                      <p className="text-xl font-bold text-amber-700">{notas.filter(n => n.estado === 'ANULADA').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filtros y acciones */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-3">
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={filtroNotasTipo} onValueChange={(v) => setFiltroNotasTipo(v as typeof filtroNotasTipo)}>
                      <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODOS">Todos</SelectItem>
                        <SelectItem value="CREDITO">Notas Crédito</SelectItem>
                        <SelectItem value="DEBITO">Notas Débito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Estado</Label>
                    <Select value={filtroNotasEstado} onValueChange={(v) => setFiltroNotasEstado(v as typeof filtroNotasEstado)}>
                      <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODOS">Todos</SelectItem>
                        <SelectItem value="EMITIDA">Emitidas</SelectItem>
                        <SelectItem value="ANULADA">Anuladas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Desde</Label>
                    <Input type="date" value={filtroNotasDesde} onChange={e => setFiltroNotasDesde(e.target.value)} className="h-9 w-36" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Hasta</Label>
                    <Input type="date" value={filtroNotasHasta} onChange={e => setFiltroNotasHasta(e.target.value)} className="h-9 w-36" />
                  </div>
                  <Button variant="outline" size="sm" className="h-9" onClick={() => { setFiltroNotasTipo('TODOS'); setFiltroNotasEstado('TODOS'); setFiltroNotasDesde(''); setFiltroNotasHasta('') }}>Limpiar</Button>
                  <Button size="sm" className="h-9 bg-amber-500 hover:bg-amber-600" onClick={fetchNotas}><RefreshCw className="w-4 h-4" /></Button>
                  <div className="flex-1" />
                  <Button onClick={() => setNotaDialogOpen(true)} className="bg-amber-500 hover:bg-amber-600 h-9">
                    <Plus className="w-4 h-4 mr-2" />Nueva Nota
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Tabla de Notas */}
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-stone-50 rounded-t-lg py-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <ArrowLeftRight className="w-5 h-5 text-amber-500" />Notas de Crédito / Débito
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loadingNotas ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
                ) : notas.length === 0 ? (
                  <div className="py-12 text-center text-stone-400">
                    <ArrowLeftRight className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>No hay notas de crédito/débito</p>
                    <p className="text-sm mt-1">Las notas aparecerán aquí cuando se generen desde facturas existentes</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-semibold text-xs">Número</TableHead>
                          <TableHead className="font-semibold text-xs">Tipo</TableHead>
                          <TableHead className="font-semibold text-xs">Factura Ref.</TableHead>
                          <TableHead className="font-semibold text-xs">Motivo</TableHead>
                          <TableHead className="font-semibold text-xs">Fecha</TableHead>
                          <TableHead className="font-semibold text-xs">Estado</TableHead>
                          <TableHead className="font-semibold text-xs text-right">Subtotal</TableHead>
                          <TableHead className="font-semibold text-xs text-right">IVA</TableHead>
                          <TableHead className="font-semibold text-xs text-right">Total</TableHead>
                          <TableHead className="font-semibold text-xs text-center">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {notas.filter(n => filtroNotasTipo === 'TODOS' || n.tipo === filtroNotasTipo).map((nota) => (
                          <TableRow key={nota.id} className={`text-xs ${nota.estado === 'ANULADA' ? 'opacity-50 bg-stone-50' : nota.tipo === 'CREDITO' ? 'hover:bg-blue-50/50' : 'hover:bg-red-50/50'}`}>
                            <TableCell className="font-mono font-medium">
                              {String(nota.puntoVenta).padStart(4, '0')}-{String(nota.numero).padStart(8, '0')}
                            </TableCell>
                            <TableCell>
                              {nota.tipo === 'CREDITO' ? (
                                <Badge className="bg-blue-100 text-blue-700 text-xs">NC</Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-700 text-xs">ND</Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-mono">
                              {nota.factura?.numero || '-'}
                              {nota.factura?.clienteNombre && <p className="text-[10px] text-stone-400">{nota.factura.clienteNombre}</p>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{nota.motivo === 'DEVOLUCION' ? 'Devolución' : nota.motivo === 'DESCUENTO' ? 'Descuento' : nota.motivo === 'ERROR' ? 'Error' : nota.motivo === 'ANULACION' ? 'Anulación' : nota.motivo === 'AJUSTE' ? 'Ajuste' : nota.motivo}</Badge>
                              {nota.descripcion && <p className="text-[10px] text-stone-400 mt-0.5 max-w-[120px] truncate">{nota.descripcion}</p>}
                            </TableCell>
                            <TableCell>{new Date(nota.fecha).toLocaleDateString('es-AR')}</TableCell>
                            <TableCell>
                              {nota.estado === 'ANULADA' ? (
                                <Badge className="bg-red-100 text-red-700 text-xs">Anulada</Badge>
                              ) : (
                                <Badge className="bg-emerald-100 text-emerald-700 text-xs">Emitida</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(nota.subtotal)}</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(nota.iva)}</TableCell>
                            <TableCell className={`text-right font-mono font-bold ${nota.estado === 'ANULADA' ? 'text-stone-400 line-through' : nota.tipo === 'CREDITO' ? 'text-blue-700' : 'text-red-700'}`}>{formatCurrency(nota.total)}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                {/* Ver detalle */}
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver detalle">
                                      <Eye className="w-3.5 h-3.5" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-md" maximizable>
                                    <DialogHeader>
                                      <DialogTitle className="flex items-center gap-2">
                                        <ArrowLeftRight className={`w-5 h-5 ${nota.tipo === 'CREDITO' ? 'text-blue-500' : 'text-red-500'}`} />
                                        {nota.tipo === 'CREDITO' ? 'Nota de Crédito' : 'Nota de Débito'} {String(nota.puntoVenta).padStart(4, '0')}-{String(nota.numero).padStart(8, '0')}
                                      </DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-3">
                                      <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div><p className="text-xs text-stone-400">Tipo</p><Badge className={nota.tipo === 'CREDITO' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}>{nota.tipo === 'CREDITO' ? 'Crédito' : 'Débito'}</Badge></div>
                                        <div><p className="text-xs text-stone-400">Estado</p><Badge className={nota.estado === 'ANULADA' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}>{nota.estado === 'ANULADA' ? 'Anulada' : 'Emitida'}</Badge></div>
                                        <div><p className="text-xs text-stone-400">Fecha</p><p>{new Date(nota.fecha).toLocaleDateString('es-AR')}</p></div>
                                        <div><p className="text-xs text-stone-400">Factura Ref.</p><p className="font-mono">{nota.factura?.numero || '-'}</p></div>
                                        <div><p className="text-xs text-stone-400">Cliente</p><p>{nota.factura?.clienteNombre || '-'}</p></div>
                                        {nota.operador && <div><p className="text-xs text-stone-400">Operador</p><p>{nota.operador.nombre}</p></div>}
                                      </div>
                                      <Separator />
                                      <div>
                                        <p className="text-xs text-stone-400 mb-1">Motivo</p>
                                        <Badge variant="outline">{nota.motivo === 'DEVOLUCION' ? 'Devolución' : nota.motivo === 'DESCUENTO' ? 'Descuento' : nota.motivo === 'ERROR' ? 'Error' : nota.motivo === 'ANULACION' ? 'Anulación' : nota.motivo === 'AJUSTE' ? 'Ajuste' : nota.motivo}</Badge>
                                      </div>
                                      {nota.descripcion && (
                                        <div>
                                          <p className="text-xs text-stone-400 mb-1">Descripción</p>
                                          <p className="text-sm bg-stone-50 rounded p-2">{nota.descripcion}</p>
                                        </div>
                                      )}
                                      <Separator />
                                      <div className="space-y-1">
                                        <div className="flex justify-between text-sm"><span className="text-stone-500">Subtotal:</span><span className="font-mono">{formatCurrency(nota.subtotal)}</span></div>
                                        <div className="flex justify-between text-sm"><span className="text-stone-500">IVA:</span><span className="font-mono">{formatCurrency(nota.iva)}</span></div>
                                        <div className="flex justify-between text-lg font-bold"><span>Total:</span><span className={`font-mono ${nota.estado === 'ANULADA' ? 'text-stone-400 line-through' : nota.tipo === 'CREDITO' ? 'text-blue-700' : 'text-red-700'}`}>{formatCurrency(nota.total)}</span></div>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                                {/* PDF */}
                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Descargar PDF" onClick={() => handleDescargarPDFNota(nota.id)}>
                                  <FileDown className="w-3.5 h-3.5" />
                                </Button>
                                {/* Anular */}
                                {nota.estado !== 'ANULADA' && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" title="Anular nota" onClick={() => { setNotaAnularId(nota.id); setNotaAnularOpen(true) }}>
                                    <Ban className="w-3.5 h-3.5" />
                                  </Button>
                                )}
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
          </TabsContent>

          {/* TAB 6: DETALLE */}
          <TabsContent value="detalle" className="space-y-4">
            <DetalleTropaTab operador={operador} />
          </TabsContent>

          {/* TAB 7: INFORMES FISCALES */}
          <TabsContent value="informes" className="space-y-4">
            {/* Filtros Informe */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-3">
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo Informe</Label>
                    <Select value={filtroInformeTipo} onValueChange={(v) => setFiltroInformeTipo(v as typeof filtroInformeTipo)}>
                      <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="semanal">Semanal</SelectItem>
                        <SelectItem value="mensual">Mensual</SelectItem>
                        <SelectItem value="porCliente">Por Cliente</SelectItem>
                        <SelectItem value="porTipo">Por Tipo Comprobante</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Desde</Label>
                    <Input type="date" value={filtroInformeDesde} onChange={e => setFiltroInformeDesde(e.target.value)} className="h-9 w-36" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Hasta</Label>
                    <Input type="date" value={filtroInformeHasta} onChange={e => setFiltroInformeHasta(e.target.value)} className="h-9 w-36" />
                  </div>
                  <Button variant="outline" size="sm" className="h-9" onClick={() => { setFiltroInformeDesde(''); setFiltroInformeHasta(''); setFiltroInformeTipo('general') }}>Limpiar</Button>
                  <Button size="sm" className="h-9 bg-amber-500 hover:bg-amber-600" onClick={fetchInforme}><RefreshCw className="w-4 h-4" /></Button>
                  <Button variant="outline" size="sm" className="h-9" onClick={handleExportInformeCSV}>
                    <FileSpreadsheet className="w-4 h-4 mr-1" />CSV
                  </Button>
                </div>
              </CardContent>
            </Card>

            {loadingInforme ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
            ) : !informeData ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center text-stone-400">
                  <FileSpreadsheet className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Seleccione filtros y consulte informes</p>
                </CardContent>
              </Card>
            ) : filtroInformeTipo === 'general' ? (
              /* INFORME GENERAL */
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="border-0 shadow-sm bg-emerald-50">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-emerald-600" /><div><p className="text-xs text-stone-500">Total Facturado</p><p className="text-lg font-bold text-emerald-700">{formatCurrency(informeData.montoTotal)}</p></div></div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm bg-blue-50">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-blue-600" /><div><p className="text-xs text-stone-500">Cobrado</p><p className="text-lg font-bold text-blue-700">{formatCurrency(informeData.montoPagado)}</p></div></div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm bg-orange-50">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2"><AlertCircle className="w-5 h-5 text-orange-600" /><div><p className="text-xs text-stone-500">Saldo Pendiente</p><p className="text-lg font-bold text-orange-700">{formatCurrency(informeData.saldoPendiente)}</p></div></div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm bg-red-50">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2"><Clock className="w-5 h-5 text-red-600" /><div><p className="text-xs text-stone-500">Vencidas ({informeData.facturasVencidas})</p><p className="text-lg font-bold text-red-700">{formatCurrency(informeData.montoVencido)}</p></div></div>
                    </CardContent>
                  </Card>
                </div>
                {/* % Cobro y Estado */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-0 shadow-md">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Porcentaje de Cobro</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-2xl font-bold text-emerald-700">{informeData.porcentajeCobro}%</span>
                          <span className="text-sm text-stone-500">{informeData.totalFacturas} facturas</span>
                        </div>
                        <div className="w-full bg-stone-200 rounded-full h-3">
                          <div className="bg-emerald-500 h-3 rounded-full transition-all" style={{ width: `${Math.min(100, parseFloat(informeData.porcentajeCobro || '0'))}%` }} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-md">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Distribución por Estado</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-400" />Pendientes</div>
                          <span>{informeData.porEstado?.pendientes || 0} — {formatCurrency(informeData.porEstado?.montoPendientes || 0)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-400" />Emitidas</div>
                          <span>{informeData.porEstado?.emitidas || 0} — {formatCurrency(informeData.porEstado?.montoEmitidas || 0)}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-400" />Pagadas</div>
                          <span>{informeData.porEstado?.pagadas || 0} — {formatCurrency(informeData.porEstado?.montoPagadas || 0)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                {/* Por tipo comprobante */}
                {informeData.porTipo && informeData.porTipo.length > 0 && (
                  <Card className="border-0 shadow-md">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Por Tipo de Comprobante</CardTitle></CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Tipo</TableHead>
                            <TableHead className="text-xs text-right">Cantidad</TableHead>
                            <TableHead className="text-xs text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {informeData.porTipo.map((t: any) => (
                            <TableRow key={t.tipo}>
                              <TableCell className="text-sm">{t.label}</TableCell>
                              <TableCell className="text-sm text-right">{t.cantidad}</TableCell>
                              <TableCell className="text-sm text-right font-mono font-bold">{formatCurrency(t.total)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
                {/* Top clientes con deuda */}
                {informeData.topClientesDeuda && informeData.topClientesDeuda.length > 0 && (
                  <Card className="border-0 shadow-md">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Top Clientes con Saldo Pendiente</CardTitle></CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Cliente</TableHead>
                            <TableHead className="text-xs text-right">Facturas</TableHead>
                            <TableHead className="text-xs text-right">Total Facturado</TableHead>
                            <TableHead className="text-xs text-right">Saldo Pendiente</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {informeData.topClientesDeuda.map((c: any) => (
                            <TableRow key={c.clienteId}>
                              <TableCell className="text-sm font-medium">{c.clienteNombre}</TableCell>
                              <TableCell className="text-sm text-right">{c.cantidad}</TableCell>
                              <TableCell className="text-sm text-right font-mono">{formatCurrency(c.total)}</TableCell>
                              <TableCell className="text-sm text-right font-mono font-bold text-orange-700">{formatCurrency(c.saldoPendiente)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : filtroInformeTipo === 'porCliente' ? (
              /* INFORME POR CLIENTE */
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Facturación por Cliente</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Cliente</TableHead>
                        <TableHead className="text-xs text-right">Facturas</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                        <TableHead className="text-xs text-right">Saldo Pendiente</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(informeData || []).map((c: any) => (
                        <TableRow key={c.clienteId}>
                          <TableCell className="text-sm font-medium">{c.clienteNombre}</TableCell>
                          <TableCell className="text-sm text-right">{c.cantidad}</TableCell>
                          <TableCell className="text-sm text-right font-mono">{formatCurrency(c.total)}</TableCell>
                          <TableCell className={`text-sm text-right font-mono ${c.saldoPendiente > 0 ? 'text-orange-700 font-bold' : ''}`}>{formatCurrency(c.saldoPendiente)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (filtroInformeTipo === 'semanal' || filtroInformeTipo === 'mensual') ? (
              /* INFORME SEMANAL / MENSUAL */
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{filtroInformeTipo === 'semanal' ? 'Facturación Semanal' : 'Facturación Mensual'}</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(informeData || []).map((item: any, i: number) => {
                      const maxTotal = Math.max(...(informeData || []).map((d: any) => d.total), 1)
                      const barWidth = (item.total / maxTotal) * 100
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-stone-700">{item.label}</span>
                            <div className="flex gap-4 text-xs text-stone-500">
                              <span>{item.cantidad} fact.</span>
                              <span className="text-emerald-700 font-medium">{formatCurrency(item.pagado)} cobrado</span>
                              <span className="font-bold text-stone-800">{formatCurrency(item.total)}</span>
                            </div>
                          </div>
                          <div className="flex gap-1 h-4">
                            <div className="bg-emerald-400 rounded-l h-full transition-all" style={{ width: `${(item.pagado / item.total) * 100}%` }} />
                            <div className="bg-amber-300 h-full transition-all" style={{ width: `${Math.max(0, ((item.total - item.pagado) / item.total) * 100)}%`, minWidth: item.total > item.pagado ? '2px' : '0' }} />
                          </div>
                        </div>
                      )
                    })}
                    {(!informeData || informeData.length === 0) && (
                      <p className="text-center text-stone-400 py-8">No hay datos para el período seleccionado</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* POR TIPO */
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Por Tipo de Comprobante</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Tipo</TableHead>
                        <TableHead className="text-xs text-right">Cantidad</TableHead>
                        <TableHead className="text-xs text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(informeData || []).map((t: any) => (
                        <TableRow key={t.tipo}>
                          <TableCell className="text-sm font-medium">{t.label}</TableCell>
                          <TableCell className="text-sm text-right">{t.cantidad}</TableCell>
                          <TableCell className="text-sm text-right font-mono font-bold">{formatCurrency(t.total)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TAB 8: PRECIOS */}
          <TabsContent value="historialPrecios">
            <PreciosPage operador={operador} />
          </TabsContent>
        </Tabs>

        {/* Dialog Nueva Factura */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" maximizable>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-amber-600" />Nueva Factura</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Cliente */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Select value={formData.clienteId} onValueChange={(v) => setFormData({ ...formData, clienteId: v })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                    <SelectContent>
                      {clientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nombre} {c.razonSocial ? `(${c.razonSocial})` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input type="date" value={formData.fecha} onChange={(e) => setFormData({ ...formData, fecha: e.target.value })} />
                </div>
              </div>

              {/* Detalles */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Detalles de Factura</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAgregarDetalle}><Plus className="w-4 h-4 mr-1" />Agregar</Button>
                </div>
                <div className="space-y-3">
                  {formData.detalles.map((detalle, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 p-3 bg-stone-50 rounded-lg">
                      <div className="col-span-3">
                        <Select value={detalle.tipoServicioId} onValueChange={(v) => handleDetalleChange(index, 'tipoServicioId', v)}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Servicio" /></SelectTrigger>
                          <SelectContent>
                            {tiposServicio.map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3">
                        <Input placeholder="Descripción" value={detalle.descripcion} onChange={(e) => handleDetalleChange(index, 'descripcion', e.target.value)} className="h-9" />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" placeholder="Cant." value={detalle.cantidad || ''} onChange={(e) => handleDetalleChange(index, 'cantidad', parseFloat(e.target.value) || 0)} className="h-9" />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" placeholder="Precio" value={detalle.precioUnitario || ''} onChange={(e) => handleDetalleChange(index, 'precioUnitario', parseFloat(e.target.value) || 0)} className="h-9" />
                      </div>
                      <div className="col-span-1 flex items-center">
                        <Badge variant="outline">{detalle.unidad}</Badge>
                      </div>
                      <div className="col-span-1 flex items-center justify-end">
                        <Button type="button" variant="ghost" size="icon" onClick={() => handleEliminarDetalle(index)} disabled={formData.detalles.length === 1}><XCircle className="w-4 h-4 text-red-500" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Observaciones */}
              <div className="space-y-2">
                <Label>Observaciones</Label>
                <Textarea value={formData.observaciones} onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })} placeholder="Notas adicionales..." rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleGuardar} disabled={saving} className="bg-amber-500 hover:bg-amber-600">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                {saving ? 'Guardando...' : 'Crear Factura'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Vista Previa Profesional */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto" maximizable>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                Vista Previa - Comprobante Profesional
              </DialogTitle>
              <DialogDescription>
                Vista previa del comprobante con formato profesional. Utilice los botones para imprimir o exportar a PDF.
              </DialogDescription>
            </DialogHeader>
            {facturaSeleccionada && (
              <FacturaPreview
                factura={{
                  ...facturaSeleccionada,
                  tributos: tributosFactura.length > 0 ? tributosFactura : facturaSeleccionada.tributos
                }}
                onClose={() => setPreviewOpen(false)}
              />
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Ver Detalle */}
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="max-w-2xl" maximizable>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Eye className="w-5 h-5 text-amber-600" />Detalle de Factura</DialogTitle>
            </DialogHeader>
            {facturaSeleccionada && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-stone-500">Número</p><p className="font-mono font-medium">{facturaSeleccionada.numero}</p></div>
                  <div><p className="text-sm text-stone-500">Tipo</p><p>{TIPOS_COMPROBANTE.find(t => t.value === facturaSeleccionada.tipoComprobante)?.label}</p></div>
                  <div><p className="text-sm text-stone-500">Fecha</p><p>{new Date(facturaSeleccionada.fecha).toLocaleDateString('es-AR')}</p></div>
                  <div><p className="text-sm text-stone-500">Estado</p>{getEstadoBadge(facturaSeleccionada.estado)}</div>
                  <div><p className="text-sm text-stone-500">Punto de Venta</p><p className="font-mono">{String(facturaSeleccionada.puntoVenta || 1).padStart(4, '0')}</p></div>
                  <div><p className="text-sm text-stone-500">CAE</p>
                    {facturaSeleccionada.cae ? (
                      <div>
                        <p className="font-mono text-emerald-700">{facturaSeleccionada.cae}</p>
                        {facturaSeleccionada.caeVencimiento && <p className="text-xs text-stone-400">Vto: {new Date(facturaSeleccionada.caeVencimiento).toLocaleDateString('es-AR')}</p>}
                      </div>
                    ) : (
                      <Badge className="bg-stone-100 text-stone-400">Sin CAE</Badge>
                    )}
                  </div>
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm text-stone-500 mb-2">Cliente</p>
                  <p className="font-medium">{facturaSeleccionada.clienteNombre || facturaSeleccionada.cliente?.nombre}</p>
                  {facturaSeleccionada.clienteCuit && <p className="text-sm text-stone-500">CUIT: {facturaSeleccionada.clienteCuit}</p>}
                  {facturaSeleccionada.clienteCondicionIva && <p className="text-sm text-stone-500">Cond. IVA: {facturaSeleccionada.clienteCondicionIva}</p>}
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm text-stone-500 mb-2">Detalles</p>
                  <Table>
                    <TableHeader><TableRow><TableHead>Descripción</TableHead><TableHead>Cant.</TableHead><TableHead>P. Unit.</TableHead><TableHead>Subtotal</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {facturaSeleccionada.detalles?.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell>{d.descripcion}</TableCell>
                          <TableCell>{d.cantidad} {d.unidad}</TableCell>
                          <TableCell>{formatCurrency(d.precioUnitario)}</TableCell>
                          <TableCell>{formatCurrency(d.subtotal)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="border-t pt-4 space-y-1">
                  <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(facturaSeleccionada.subtotal)}</span></div>
                  {facturaSeleccionada.iva > 0 && (
                    <div className="flex justify-between">
                      <span>IVA ({facturaSeleccionada.porcentajeIva}%):</span>
                      <span>{formatCurrency(facturaSeleccionada.iva)}</span>
                    </div>
                  )}
                  {(facturaSeleccionada.importeTributos || 0) > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>Tributos:</span>
                      <span>{formatCurrency(facturaSeleccionada.importeTributos || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg"><span>Total:</span><span>{formatCurrency(facturaSeleccionada.total)}</span></div>
                  {facturaSeleccionada.saldo > 0 && <div className="flex justify-between text-amber-600"><span>Saldo Pendiente:</span><span>{formatCurrency(facturaSeleccionada.saldo)}</span></div>}
                </div>
                {/* Tributos de la factura */}
                {tributosFactura.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-stone-500 mb-2 font-medium">Retenciones / Percepciones</p>
                    <Table>
                      <TableHeader><TableRow><TableHead>Descripción</TableHead><TableHead className="text-right">Base Imp.</TableHead><TableHead className="text-right">Alícuota</TableHead><TableHead className="text-right">Importe</TableHead><TableHead></TableHead></TableRow></TableHeader>
                      <TableBody>
                        {tributosFactura.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="text-sm">{t.descripcion}</TableCell>
                            <TableCell className="text-right text-sm">{formatCurrency(t.baseImponible)}</TableCell>
                            <TableCell className="text-right text-sm">{t.alicuota}%</TableCell>
                            <TableCell className="text-right text-sm font-medium text-orange-600">{formatCurrency(t.importe)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteTributo(t.id, t.facturaId)} title="Eliminar tributo">
                                <Trash2 className="w-3 h-3 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {facturaSeleccionada.pagos && facturaSeleccionada.pagos.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-sm text-stone-500 mb-2">Pagos Registrados</p>
                    {facturaSeleccionada.pagos.map((p, i) => (
                      <div key={i} className="flex justify-between text-sm py-1">
                        <span>{new Date(p.fecha).toLocaleDateString('es-AR')} - {p.metodoPago} {p.referencia && `(${p.referencia})`}</span>
                        <span className="text-emerald-600">{formatCurrency(p.monto)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewOpen(false)}>Cerrar</Button>
              <Button onClick={() => { handleImprimir(facturaSeleccionada!); setViewOpen(false); }}><Printer className="w-4 h-4 mr-2" />Imprimir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Pago */}
        <Dialog open={pagoOpen} onOpenChange={setPagoOpen}>
          <DialogContent className="max-w-md" maximizable>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-amber-600" />Registrar Pago</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-amber-50 rounded-lg">
                <p className="text-sm text-amber-700">Saldo pendiente: <strong>{formatCurrency(facturaSeleccionada?.saldo || 0)}</strong></p>
              </div>
              <div className="space-y-2">
                <Label>Monto a pagar *</Label>
                <Input type="number" value={pagoData.monto || ''} onChange={(e) => setPagoData({ ...pagoData, monto: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Método de pago</Label>
                <Select value={pagoData.metodoPago} onValueChange={(v) => setPagoData({ ...pagoData, metodoPago: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METODOS_PAGO.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {pagoData.metodoPago === 'TRANSFERENCIA' && (
                <div className="space-y-2">
                  <Label>Referencia / N° Comprobante</Label>
                  <Input value={pagoData.referencia} onChange={(e) => setPagoData({ ...pagoData, referencia: e.target.value })} placeholder="N° de transferencia" />
                </div>
              )}
              <div className="space-y-2">
                <Label>Observaciones</Label>
                <Input value={pagoData.observaciones} onChange={(e) => setPagoData({ ...pagoData, observaciones: e.target.value })} placeholder="Notas opcionales" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPagoOpen(false)}>Cancelar</Button>
              <Button onClick={handleRegistrarPago} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
                Registrar Pago
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Anular */}
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="max-w-sm" maximizable>
            <DialogHeader><DialogTitle className="text-red-600 flex items-center gap-2"><XCircle className="w-5 h-5" />Anular Factura</DialogTitle></DialogHeader>
            <p className="text-sm text-stone-500">¿Está seguro que desea anular la factura {facturaSeleccionada?.numero}? Esta acción no se puede deshacer.</p>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
              <Button onClick={handleAnular} disabled={saving} className="bg-red-600 hover:bg-red-700">{saving ? 'Anulando...' : 'Anular Factura'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Supervisor Edit */}
        <Dialog open={supervisorEditOpen} onOpenChange={setSupervisorEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Lock className="w-5 h-5 text-blue-600" />Editar Factura</DialogTitle>
              <DialogDescription>Ingrese la clave de supervisor para modificar esta factura</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Current invoice info */}
              <div className="bg-stone-50 rounded-lg p-3 text-sm">
                <p className="font-mono font-bold">{facturaSeleccionada?.numero}</p>
                <p>{facturaSeleccionada?.clienteNombre || facturaSeleccionada?.cliente?.nombre}</p>
                <p className="text-stone-500">Total: {formatCurrency(facturaSeleccionada?.total || 0)}</p>
              </div>

              {/* Supervisor Password */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Clave de Supervisor</Label>
                <Input
                  type="password"
                  value={supervisorPassword}
                  onChange={(e) => { setSupervisorPassword(e.target.value); setSupervisorPasswordError('') }}
                  placeholder="Ingrese clave de supervisor"
                  className="h-10"
                />
                {supervisorPasswordError && <p className="text-xs text-red-500">{supervisorPasswordError}</p>}
              </div>

              {/* Editable fields */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">N° Factura</Label>
                  <Input value={editFacturaData?.numero || ''} onChange={(e) => setEditFacturaData(prev => prev ? { ...prev, numero: e.target.value } : prev)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Observaciones</Label>
                  <Textarea value={editFacturaData?.observaciones || ''} onChange={(e) => setEditFacturaData(prev => prev ? { ...prev, observaciones: e.target.value } : prev)} rows={2} />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSupervisorEditOpen(false)}>Cancelar</Button>
              <Button onClick={handleSupervisorEdit} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                Guardar Cambios
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Nueva Nota C/D */}
        <Dialog open={notaDialogOpen} onOpenChange={setNotaDialogOpen}>
          <DialogContent className="max-w-lg" maximizable>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ArrowLeftRight className="w-5 h-5 text-amber-600" />Nueva Nota de Crédito / Débito</DialogTitle>
              <DialogDescription>Genere una nota asociada a una factura existente</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Factura de referencia *</Label>
                <Select value={notaFormData.facturaId} onValueChange={(v) => {
                  const factura = facturas.find(f => f.id === v)
                  setNotaFormData({ ...notaFormData, facturaId: v, subtotal: factura?.subtotal || 0, iva: factura?.iva || 0, total: factura?.total || 0 })
                }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar factura" /></SelectTrigger>
                  <SelectContent>
                    {facturas.filter(f => f.estado !== 'ANULADA').map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.numero} — {f.clienteNombre || f.cliente?.nombre} — {formatCurrency(f.total)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Nota *</Label>
                  <Select value={notaFormData.tipo} onValueChange={(v) => setNotaFormData({ ...notaFormData, tipo: v as 'CREDITO' | 'DEBITO' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CREDITO">Nota de Crédito</SelectItem>
                      <SelectItem value="DEBITO">Nota de Débito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Motivo *</Label>
                  <Select value={notaFormData.motivo} onValueChange={(v) => setNotaFormData({ ...notaFormData, motivo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEVOLUCION">Devolución</SelectItem>
                      <SelectItem value="DESCUENTO">Descuento</SelectItem>
                      <SelectItem value="ERROR">Error</SelectItem>
                      <SelectItem value="ANULACION">Anulación</SelectItem>
                      <SelectItem value="AJUSTE">Ajuste</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea value={notaFormData.descripcion} onChange={(e) => setNotaFormData({ ...notaFormData, descripcion: e.target.value })} placeholder="Detalle del motivo de la nota..." rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Subtotal</Label>
                  <Input type="number" value={notaFormData.subtotal || ''} onChange={(e) => {
                    const subtotal = parseFloat(e.target.value) || 0
                    const iva = subtotal * 0.21
                    setNotaFormData({ ...notaFormData, subtotal, iva, total: subtotal + iva })
                  }} />
                </div>
                <div className="space-y-2">
                  <Label>IVA (auto 21%)</Label>
                  <Input type="number" value={notaFormData.iva.toFixed(2)} readOnly className="bg-stone-50" />
                </div>
                <div className="space-y-2">
                  <Label>Total</Label>
                  <Input type="number" value={notaFormData.total.toFixed(2)} readOnly className="bg-stone-50 font-bold" />
                </div>
              </div>
              {notaFormData.facturaId && (() => {
                const factura = facturas.find(f => f.id === notaFormData.facturaId)
                if (!factura) return null
                return (
                  <div className="bg-stone-50 rounded-lg p-3 text-xs space-y-1">
                    <p className="font-semibold text-stone-600">Referencia: {factura.numero}</p>
                    <p>Tipo: {TIPOS_COMPROBANTE.find(t => t.value === factura.tipoComprobante)?.label}</p>
                    <p>Cliente: {factura.clienteNombre || factura.cliente?.nombre}</p>
                    {factura.tipoComprobante === 'FACTURA_A' && (
                      <p className="text-amber-600">Factura A: IVA discriminado — Subtotal neto + IVA = Total</p>
                    )}
                    {factura.tipoComprobante === 'FACTURA_B' && (
                      <p className="text-amber-600">Factura B: IVA incluido en el precio — El total ya contiene IVA</p>
                    )}
                  </div>
                )
              })()}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNotaDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleGuardarNota} disabled={saving} className={notaFormData.tipo === 'CREDITO' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600'}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowLeftRight className="w-4 h-4 mr-2" />}
                {saving ? 'Creando...' : `Crear Nota de ${notaFormData.tipo === 'CREDITO' ? 'Crédito' : 'Débito'}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Anular Nota */}
        <Dialog open={notaAnularOpen} onOpenChange={setNotaAnularOpen}>
          <DialogContent className="max-w-sm" maximizable>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-red-500" />Anular Nota
              </DialogTitle>
              <DialogDescription>¿Está seguro de que desea anular esta nota? Esta acción no se puede deshacer.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {notaAnularId && (() => {
                const nota = notas.find(n => n.id === notaAnularId)
                if (!nota) return null
                return (
                  <div className="bg-stone-50 rounded-lg p-3 text-sm space-y-1">
                    <p><span className="text-stone-500">Número:</span> <span className="font-mono font-bold">{String(nota.puntoVenta).padStart(4, '0')}-{String(nota.numero).padStart(8, '0')}</span></p>
                    <p><span className="text-stone-500">Tipo:</span> {nota.tipo === 'CREDITO' ? 'Nota de Crédito' : 'Nota de Débito'}</p>
                    <p><span className="text-stone-500">Factura:</span> <span className="font-mono">{nota.factura?.numero || '-'}</span></p>
                    <p><span className="text-stone-500">Total:</span> <span className="font-bold">{formatCurrency(nota.total)}</span></p>
                  </div>
                )
              })()}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setNotaAnularOpen(false); setNotaAnularId(null) }}>Cancelar</Button>
              <Button onClick={handleAnularNota} disabled={saving} className="bg-red-500 hover:bg-red-600">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Ban className="w-4 h-4 mr-2" />}
                Anular Nota
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Agregar Tributo */}
        <Dialog open={tributoDialogOpen} onOpenChange={setTributoDialogOpen}>
          <DialogContent className="max-w-md" maximizable>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-orange-600" />Agregar Retención / Percepción</DialogTitle>
              <DialogDescription>Agregue tributos a la factura seleccionada</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tipo de Tributo</Label>
                <Select value={String(tributoFormData.tributoId)} onValueChange={(v) => {
                  const tributoId = parseInt(v)
                  const descripciones: Record<number, string> = { 1: 'Impuesto Nacional', 4: 'Percepción IIBB', 5: 'Percepción IVA', 6: 'Percepción Ganancias', 7: 'Otro' }
                  setTributoFormData({ ...tributoFormData, tributoId, descripcion: descripciones[tributoId] || '' })
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Nacional</SelectItem>
                    <SelectItem value="4">Percepción IIBB</SelectItem>
                    <SelectItem value="5">Percepción IVA</SelectItem>
                    <SelectItem value="6">Percepción Ganancias</SelectItem>
                    <SelectItem value="7">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Input value={tributoFormData.descripcion} onChange={(e) => setTributoFormData({ ...tributoFormData, descripcion: e.target.value })} placeholder="Ej: Percepción IIBB CABA" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Base Imponible</Label>
                  <Input type="number" value={tributoFormData.baseImponible || ''} onChange={(e) => {
                    const baseImponible = parseFloat(e.target.value) || 0
                    const importe = baseImponible * (tributoFormData.alicuota / 100)
                    setTributoFormData({ ...tributoFormData, baseImponible, importe })
                  }} />
                </div>
                <div className="space-y-2">
                  <Label>Alícuota %</Label>
                  <Input type="number" step="0.01" value={tributoFormData.alicuota || ''} onChange={(e) => {
                    const alicuota = parseFloat(e.target.value) || 0
                    const importe = tributoFormData.baseImponible * (alicuota / 100)
                    setTributoFormData({ ...tributoFormData, alicuota, importe })
                  }} />
                </div>
                <div className="space-y-2">
                  <Label>Importe</Label>
                  <Input type="number" value={tributoFormData.importe.toFixed(2)} readOnly className="bg-stone-50 font-bold" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setTributoDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleAddTributo} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Agregar Tributo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default FacturacionModule
