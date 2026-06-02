'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { 
  Scale, RefreshCw, Plus, CheckCircle, AlertCircle,
  Beef, Edit, Trash2, ArrowRight, Minus, AlertTriangle, ClipboardCheck, Printer, 
  Edit3, Save, X, Settings2, Move, Eye, Type, Palette, ChevronUp, ChevronDown,
  Maximize, Minimize, FileText, Search, Calendar, Weight, ChevronLeft, ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Progress } from '@/components/ui/progress'
import { BalanzaConfigButton } from '@/components/balanza-config-button'
import { imprimirTicketPesajeA4 } from './pesaje-individual/rotuloPrint'

const TIPOS_ANIMALES: Record<string, { codigo: string; label: string }[]> = {
  BOVINO: [
    { codigo: 'TO', label: 'Toro' },
    { codigo: 'VA', label: 'Vaca' },
    { codigo: 'VQ', label: 'Vaquillona' },
    { codigo: 'MEJ', label: 'Torito/Mej' },
    { codigo: 'NO', label: 'Novillo' },
    { codigo: 'NT', label: 'Novillito' },
  ],
  EQUINO: [
    { codigo: 'PADRILLO', label: 'Padrillo' },
    { codigo: 'POTRILLO', label: 'Potrillo/Potranca' },
    { codigo: 'YEGUA', label: 'Yegua' },
    { codigo: 'CABALLO', label: 'Caballo' },
    { codigo: 'BURRO', label: 'Burro' },
    { codigo: 'MULA', label: 'Mula' },
  ]
}

const RAZAS_BOVINO = [
  'Angus', 'Hereford', 'Braford', 'Brangus', 'Charolais', 'Limousin',
  'Santa Gertrudis', 'Nelore', 'Brahman', 'Cebú', 'Cruza', 'Otro'
]

const RAZAS_EQUINO = [
  'Criollo', 'Pura Sangre', 'Cuarto de Milla', 'Percherón', 'Belga',
  'Árabe', 'Silla Argentino', 'Petiso', 'Otro'
]

// ==================== SISTEMA DE LAYOUT ====================
interface BloqueLayout {
  id: string
  label: string
  visible: boolean
  x: number
  y: number
  width: number
  height: number
  minWidth: number
  minHeight: number
  titulo?: string
  subtitulo?: string
  placeholder?: string
}

interface BotonConfig {
  id: string
  texto: string
  visible: boolean
  color: string
}

interface TextosConfig {
  tituloModulo: string
  subtituloModulo: string
  labelTropasPorPesar: string
  labelTropasPesadas: string
  labelPanelPesaje: string
  labelListaAnimales: string
  labelHistorial: string
  labelSinTropas: string
  labelSinAnimales: string
  textoPesoPlaceholder: string
}

// Valores por defecto para el layout
const LAYOUT_DEFAULT: BloqueLayout[] = [
  { id: 'header', label: 'Encabezado', visible: true, x: 20, y: 20, width: 900, height: 60, minWidth: 300, minHeight: 50, titulo: 'Pesaje Individual', subtitulo: 'Control de peso por animal' },
  { id: 'tropasPorPesar', label: 'Tropas Por Pesar', visible: true, x: 20, y: 100, width: 900, height: 250, minWidth: 300, minHeight: 150, titulo: 'Tropas Por Pesar' },
  { id: 'tropasPesadas', label: 'Tropas Pesadas', visible: true, x: 20, y: 370, width: 900, height: 200, minWidth: 300, minHeight: 100, titulo: 'Tropas Pesadas' },
  { id: 'panelPesaje', label: 'Panel de Pesaje', visible: true, x: 20, y: 590, width: 600, height: 400, minWidth: 400, minHeight: 300, titulo: 'Panel de Pesaje', placeholder: 'Peso en kg' },
  { id: 'listaAnimales', label: 'Lista de Animales', visible: true, x: 640, y: 590, width: 280, height: 400, minWidth: 200, minHeight: 200, titulo: 'Animales' }
]

const BOTONES_DEFAULT: BotonConfig[] = [
  { id: 'registrar', texto: 'REGISTRAR', visible: true, color: 'green' },
  { id: 'finalizar', texto: 'Finalizar Pesaje', visible: true, color: 'blue' },
  { id: 'seleccionar', texto: 'Seleccionar', visible: true, color: 'amber' }
]

const TEXTOS_DEFAULT: TextosConfig = {
  tituloModulo: 'Pesaje Individual',
  subtituloModulo: 'Control de peso por animal',
  labelTropasPorPesar: 'Tropas Por Pesar',
  labelTropasPesadas: 'Tropas Pesadas',
  labelPanelPesaje: 'Panel de Pesaje',
  labelListaAnimales: 'Animales',
  labelHistorial: 'Historial de Pesajes',
  labelSinTropas: 'No hay tropas pendientes',
  labelSinAnimales: 'No hay animales para pesar',
  textoPesoPlaceholder: '0'
}

// ==================== COMPONENTE BLOQUE EDITABLE ====================
interface EditableBlockProps {
  bloque: BloqueLayout
  editMode: boolean
  onUpdate: (id: string, updates: Partial<BloqueLayout>) => void
  children: React.ReactNode
}

function EditableBlock({ bloque, editMode, onUpdate, children }: EditableBlockProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [initialPos, setInitialPos] = useState({ x: 0, y: 0, width: 0, height: 0 })

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!editMode) return
    if ((e.target as HTMLElement).closest('.resize-handle')) return
    
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    setInitialPos({ x: bloque.x, y: bloque.y, width: bloque.width, height: bloque.height })
  }

  const handleResizeStart = (e: React.MouseEvent, handle: string) => {
    if (!editMode) return
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    setResizeHandle(handle)
    setDragStart({ x: e.clientX, y: e.clientY })
    setInitialPos({ x: bloque.x, y: bloque.y, width: bloque.width, height: bloque.height })
  }

  useEffect(() => {
    if (!isDragging && !isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStart.x
      const deltaY = e.clientY - dragStart.y

      if (isDragging) {
        onUpdate(bloque.id, { x: Math.max(0, initialPos.x + deltaX), y: Math.max(0, initialPos.y + deltaY) })
      } else if (isResizing && resizeHandle) {
        let newX = initialPos.x
        let newY = initialPos.y
        let newWidth = initialPos.width
        let newHeight = initialPos.height

        if (resizeHandle.includes('e')) newWidth = Math.max(bloque.minWidth, initialPos.width + deltaX)
        if (resizeHandle.includes('w')) {
          const widthDelta = initialPos.width - deltaX
          if (widthDelta >= bloque.minWidth) { newWidth = widthDelta; newX = initialPos.x + deltaX }
        }
        if (resizeHandle.includes('n')) {
          const heightDelta = initialPos.height - deltaY
          if (heightDelta >= bloque.minHeight) { newHeight = heightDelta; newY = initialPos.y + deltaY }
        }
        if (resizeHandle.includes('s')) newHeight = Math.max(bloque.minHeight, initialPos.height + deltaY)

        onUpdate(bloque.id, { x: Math.max(0, newX), y: Math.max(0, newY), width: newWidth, height: newHeight })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
      setResizeHandle(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing, dragStart, initialPos, resizeHandle, bloque, onUpdate])

  return (
    <div
      className={cn(
        "absolute transition-shadow",
        editMode && "cursor-move",
        isDragging && "z-50 shadow-2xl",
        editMode && !isDragging && "hover:shadow-lg hover:ring-2 hover:ring-amber-400"
      )}
      style={{ left: bloque.x, top: bloque.y, width: bloque.width, height: bloque.height }}
      onMouseDown={handleMouseDown}
    >
      {editMode && (
        <div className="absolute -top-6 left-0 bg-amber-500 text-white text-xs px-2 py-1 rounded-t flex items-center gap-1">
          <Move className="w-3 h-3" />
          {bloque.label}
        </div>
      )}
      <div className="w-full h-full overflow-hidden">{children}</div>
      {editMode && (
        <>
          <div className="resize-handle absolute -top-1.5 -left-1.5 w-3 h-3 bg-amber-500 border border-white rounded-sm cursor-nw-resize z-10" onMouseDown={(e) => handleResizeStart(e, 'nw')} />
          <div className="resize-handle absolute -top-1.5 -right-1.5 w-3 h-3 bg-amber-500 border border-white rounded-sm cursor-ne-resize z-10" onMouseDown={(e) => handleResizeStart(e, 'ne')} />
          <div className="resize-handle absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-amber-500 border border-white rounded-sm cursor-sw-resize z-10" onMouseDown={(e) => handleResizeStart(e, 'sw')} />
          <div className="resize-handle absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-amber-500 border border-white rounded-sm cursor-se-resize z-10" onMouseDown={(e) => handleResizeStart(e, 'se')} />
          <div className="resize-handle absolute top-1/2 -left-1.5 w-3 h-6 bg-amber-500 border border-white rounded-sm cursor-w-resize z-10 -translate-y-1/2" onMouseDown={(e) => handleResizeStart(e, 'w')} />
          <div className="resize-handle absolute top-1/2 -right-1.5 w-3 h-6 bg-amber-500 border border-white rounded-sm cursor-e-resize z-10 -translate-y-1/2" onMouseDown={(e) => handleResizeStart(e, 'e')} />
          <div className="resize-handle absolute -top-1.5 left-1/2 w-6 h-3 bg-amber-500 border border-white rounded-sm cursor-n-resize z-10 -translate-x-1/2" onMouseDown={(e) => handleResizeStart(e, 'n')} />
          <div className="resize-handle absolute -bottom-1.5 left-1/2 w-6 h-3 bg-amber-500 border border-white rounded-sm cursor-s-resize z-10 -translate-x-1/2" onMouseDown={(e) => handleResizeStart(e, 's')} />
        </>
      )}
    </div>
  )
}

interface Operador {
  id: string
  nombre: string
  rol?: string
  permisos?: Record<string, boolean>
}

interface Corral {
  id: string
  nombre: string
  capacidad: number
  stockBovinos: number
  stockEquinos: number
}

interface Tropa {
  id: string
  numero: number
  codigo: string
  especie: string
  cantidadCabezas: number
  estado: string
  corral?: { id: string; nombre: string } | string
  corralId?: string
  pesoNeto?: number
  pesoTotalIndividual?: number
  usuarioFaena?: { nombre: string }
  tiposAnimales?: { tipoAnimal: string; cantidad: number }[]
  observaciones?: string
}

interface Animal {
  id: string
  numero: number
  codigo: string
  tipoAnimal: string
  caravana?: string
  raza?: string
  pesoVivo?: number
  observaciones?: string
  estado: string
}

interface TipoCantidadConfirmada {
  tipoAnimal: string
  cantidadDTE: number
  cantidadConfirmada: number
}

export function PesajeIndividualModule({ tropas: propTropas, operador }: { tropas?: Tropa[]; operador: Operador }) {
  const [tropas, setTropas] = useState<Tropa[]>(propTropas || [])
  const [tropasPorPesar, setTropasPorPesar] = useState<Tropa[]>([])
  const [tropasPesado, setTropasPesado] = useState<Tropa[]>([])
  const [corrales, setCorrales] = useState<Corral[]>([])
  const [loading, setLoading] = useState(!propTropas)
  const [saving, setSaving] = useState(false)
  
  const [activeTab, setActiveTab] = useState('solicitar')
  const [tropaSeleccionada, setTropaSeleccionada] = useState<Tropa | null>(null)
  const [animales, setAnimales] = useState<Animal[]>([])
  const [animalActual, setAnimalActual] = useState(0)
  const [corralDestinoId, setCorralDestinoId] = useState('')
  
  const [caravana, setCaravana] = useState('')
  const [tipoAnimalSeleccionado, setTipoAnimalSeleccionado] = useState('')
  const [raza, setRaza] = useState('')
  const [pesoActual, setPesoActual] = useState('')
  
  const [validacionDialogOpen, setValidacionDialogOpen] = useState(false)
  const [tiposConfirmados, setTiposConfirmados] = useState<TipoCantidadConfirmada[]>([])
  const [nuevoTipoSeleccionado, setNuevoTipoSeleccionado] = useState('')
  
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null)
  const [editCaravana, setEditCaravana] = useState('')
  const [editTipoAnimal, setEditTipoAnimal] = useState('')
  const [editRaza, setEditRaza] = useState('')
  const [editPeso, setEditPeso] = useState('')

  // Layout WYSIWYG
  const [editMode, setEditMode] = useState(false)
  const [showConfigPanel, setShowConfigPanel] = useState(false)
  const [bloques, setBloques] = useState<BloqueLayout[]>(LAYOUT_DEFAULT)
  const [botones, setBotones] = useState<BotonConfig[]>(BOTONES_DEFAULT)
  const [textos, setTextos] = useState<TextosConfig>(TEXTOS_DEFAULT)
  const [layoutLoaded, setLayoutLoaded] = useState(false)

  // Configuración de impresora
  const [configImpresoraOpen, setConfigImpresoraOpen] = useState(false)
  const [impresoraIp, setImpresoraIp] = useState('')
  const [usarPredeterminada, setUsarPredeterminada] = useState(false)
  const [impresoraPuerto, setImpresoraPuerto] = useState(9100)
  const [impresoraVelocidad, setImpresoraVelocidad] = useState(4)   // 1-12 ips
  const [impresoraCalor, setImpresoraCalor] = useState(10)         // 0-30
  const [impresoraAncho, setImpresoraAncho] = useState(100)        // mm
  const [impresoraAlto, setImpresoraAlto] = useState(50)           // mm

  // Historial de pesajes
  const [historial, setHistorial] = useState<any[]>([])
  const [historialLoading, setHistorialLoading] = useState(false)
  const [historialBusqueda, setHistorialBusqueda] = useState('')
  const [historialPage, setHistorialPage] = useState(1)
  const [historialTotalPages, setHistorialTotalPages] = useState(0)
  const [historialTotal, setHistorialTotal] = useState(0)

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ animal: Animal; action: 'delete' | 'repesar' } | null>(null)
  const [lastRegisteredAnimal, setLastRegisteredAnimal] = useState<Animal | null>(null)
  const [flashFeedback, setFlashFeedback] = useState(false)
  const [productionMode, setProductionMode] = useState(false)

  const isAdmin = operador.rol === 'ADMINISTRADOR' || (operador.permisos?.puedeAdminSistema ?? false)

  // Computed: progress for PI2
  const totalAnimales = animales.length
  const animalesPesados = animales.filter(a => a.estado === 'PESADO').length
  const progresoPorcentaje = totalAnimales > 0 ? Math.round((animalesPesados / totalAnimales) * 100) : 0

  // PI3: Flash feedback when weight registered
  useEffect(() => {
    if (flashFeedback) {
      const timer = setTimeout(() => setFlashFeedback(false), 600)
      return () => clearTimeout(timer)
    }
  }, [flashFeedback])

  // PI1: Dispatch custom event to hide/show sidebar when production mode changes
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('production-mode-change', { detail: { active: productionMode } }))
  }, [productionMode])

  // T7: Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
      
      // Enter = registrar peso (primary action)
      if (e.key === 'Enter' && activeTab === 'pesar' && tropaSeleccionada && pesoActual) {
        e.preventDefault()
        handleRegistrarPeso()
      }
      // Escape = close current dialog or deselect tropa
      if (e.key === 'Escape') {
        if (validacionDialogOpen) {
          setValidacionDialogOpen(false)
        } else if (editDialogOpen) {
          setEditDialogOpen(false)
        } else if (productionMode) {
          setProductionMode(false)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTab, tropaSeleccionada, pesoActual, validacionDialogOpen, editDialogOpen, productionMode, animales, animalActual, tipoAnimalSeleccionado, caravana, raza])

  // Cargar configuración de impresora guardada
  useEffect(() => {
    const savedIp = localStorage.getItem('impresoraRotulosIp') || ''
    const savedPredeterminada = localStorage.getItem('impresoraRotulosPredeterminada') === 'true'
    const savedPuerto = parseInt(localStorage.getItem('impresoraRotulosPuerto') || '9100')
    const savedVelocidad = parseInt(localStorage.getItem('impresoraRotulosVelocidad') || '4')
    const savedCalor = parseInt(localStorage.getItem('impresoraRotulosCalor') || '10')
    const savedAncho = parseInt(localStorage.getItem('impresoraRotulosAncho') || '100')
    const savedAlto = parseInt(localStorage.getItem('impresoraRotulosAlto') || '50')
    setImpresoraIp(savedIp)
    setUsarPredeterminada(savedPredeterminada)
    setImpresoraPuerto(savedPuerto)
    setImpresoraVelocidad(savedVelocidad)
    setImpresoraCalor(savedCalor)
    setImpresoraAncho(savedAncho)
    setImpresoraAlto(savedAlto)
  }, [])

  useEffect(() => {
    fetchLayout()
    if (!propTropas) {
      fetchData()
    }
  }, [propTropas])

  useEffect(() => {
    setTropasPorPesar(tropas.filter(t => 
      t.estado === 'EN_PESAJE' || t.estado === 'RECIBIDO' || t.estado === 'EN_CORRAL'
    ))
    setTropasPesado(tropas.filter(t => t.estado === 'PESADO'))
  }, [tropas])

  const fetchLayout = async () => {
    try {
      const res = await fetch('/api/layout-modulo?modulo=pesajeIndividual')
      const data = await res.json()
      
      if (data.success) {
        if (data.data?.layout?.items) setBloques(data.data.layout.items)
        if (data.data?.botones?.items) setBotones(data.data.botones.items)
        if (data.data?.textos) setTextos({ ...TEXTOS_DEFAULT, ...data.data.textos })
      }
    } catch (error) {
      console.error('Error loading layout:', error)
    } finally {
      setLayoutLoaded(true)
    }
  }

  const fetchData = async () => {
    try {
      const [tropasRes, corralesRes] = await Promise.all([
        fetch('/api/tropas'),
        fetch('/api/corrales')
      ])
      const tropasData = await tropasRes.json()
      const corralesData = await corralesRes.json()
      
      if (tropasData.success) {
        setTropas(tropasData.data)
      }
      if (corralesData.success) {
        setCorrales(corralesData.data)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch historial de pesajes
  const fetchHistorial = useCallback(async (busqueda?: string, page?: number) => {
    setHistorialLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '20')
      if (busqueda) params.set('busqueda', busqueda)
      if (page) params.set('page', String(page))
      else params.set('page', String(historialPage))

      const res = await fetch(`/api/pesaje-individual/historial?${params}`)
      const data = await res.json()
      if (data.success) {
        setHistorial(data.data)
        setHistorialTotal(data.pagination.total)
        setHistorialTotalPages(data.pagination.totalPages)
      }
    } catch (error) {
      console.error('Error fetching historial:', error)
    } finally {
      setHistorialLoading(false)
    }
  }, [historialPage])

  // Cargar historial cuando se activa el tab de historial
  useEffect(() => {
    if (activeTab === 'historial') {
      fetchHistorial(historialBusqueda || undefined, 1)
    }
  }, [activeTab])

  // Búsqueda con debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'historial') {
        fetchHistorial(historialBusqueda || undefined, 1)
        setHistorialPage(1)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [historialBusqueda])

  const razasActuales = tropaSeleccionada?.especie === 'EQUINO' ? RAZAS_EQUINO : RAZAS_BOVINO

  const tiposDisponiblesParaPesar = useMemo(() => {
    if (tiposConfirmados.length === 0) return []
    const todosTipos = TIPOS_ANIMALES[tropaSeleccionada?.especie || 'BOVINO'] || []
    return todosTipos.filter(t => {
      const confirmado = tiposConfirmados.find(tc => tc.tipoAnimal === t.codigo)
      return confirmado && confirmado.cantidadConfirmada > 0
    })
  }, [tiposConfirmados, tropaSeleccionada?.especie])

  const conteoPesadosPorTipo = useMemo(() => {
    const conteo: Record<string, number> = {}
    animales.filter(a => a.estado === 'PESADO').forEach(a => {
      conteo[a.tipoAnimal] = (conteo[a.tipoAnimal] || 0) + 1
    })
    return conteo
  }, [animales])

  const isTipoDisponible = (tipoCodigo: string): { disponible: boolean; restantes: number; mensaje: string } => {
    const confirmado = tiposConfirmados.find(tc => tc.tipoAnimal === tipoCodigo)
    if (!confirmado || confirmado.cantidadConfirmada === 0) {
      return { disponible: false, restantes: 0, mensaje: 'No declarado' }
    }
    const pesados = conteoPesadosPorTipo[tipoCodigo] || 0
    const restantes = confirmado.cantidadConfirmada - pesados
    if (restantes <= 0) {
      return { disponible: false, restantes: 0, mensaje: 'Límite' }
    }
    return { disponible: true, restantes, mensaje: `${restantes} rest.` }
  }

  const handleSeleccionarTropa = async (tropa: Tropa) => {
    const tiposIniciales: TipoCantidadConfirmada[] = (tropa.tiposAnimales || []).map(t => ({
      tipoAnimal: t.tipoAnimal,
      cantidadDTE: t.cantidad,
      cantidadConfirmada: t.cantidad
    }))
    setTiposConfirmados(tiposIniciales)

    try {
      const res = await fetch(`/api/tropas/${tropa.id}`)
      const data = await res.json()
      if (data.success && data.data.animales && data.data.animales.length > 0) {
        setAnimales(data.data.animales)
        const pendientes = data.data.animales.filter((a: Animal) => a.estado === 'RECIBIDO')
        setAnimalActual(pendientes.length > 0 ? data.data.animales.findIndex((a: Animal) => a.estado === 'RECIBIDO') : 0)
      } else {
        setAnimales([])
        setAnimalActual(0)
      }
    } catch {
      setAnimales([])
      setAnimalActual(0)
    }
    
    if (tropa.corralId) {
      setCorralDestinoId(tropa.corralId)
    } else if (typeof tropa.corral === 'object' && tropa.corral?.id) {
      setCorralDestinoId(tropa.corral.id)
    } else {
      setCorralDestinoId('')
    }
    
    setTropaSeleccionada(tropa)
    resetFormFields()
    setValidacionDialogOpen(true)
  }

  const resetFormFields = () => {
    setCaravana('')
    setTipoAnimalSeleccionado('')
    setRaza('')
    setPesoActual('')
  }

  const ajustarCantidadConfirmada = (tipoAnimal: string, delta: number) => {
    setTiposConfirmados(prev => prev.map(tc => {
      if (tc.tipoAnimal === tipoAnimal) {
        const nuevaCantidad = Math.max(0, tc.cantidadConfirmada + delta)
        return { ...tc, cantidadConfirmada: nuevaCantidad }
      }
      return tc
    }))
  }

  const setCantidadConfirmada = (tipoAnimal: string, cantidad: number) => {
    setTiposConfirmados(prev => prev.map(tc => {
      if (tc.tipoAnimal === tipoAnimal) {
        return { ...tc, cantidadConfirmada: Math.max(0, cantidad) }
      }
      return tc
    }))
  }

  const totalConfirmados = tiposConfirmados.reduce((acc, tc) => acc + tc.cantidadConfirmada, 0)
  const totalDTE = tiposConfirmados.reduce((acc, tc) => acc + tc.cantidadDTE, 0)

  const agregarNuevoTipo = () => {
    if (!nuevoTipoSeleccionado) return
    if (tiposConfirmados.some(tc => tc.tipoAnimal === nuevoTipoSeleccionado)) {
      toast.error('Este tipo de animal ya está en la lista')
      return
    }
    setTiposConfirmados(prev => [...prev, {
      tipoAnimal: nuevoTipoSeleccionado,
      cantidadDTE: 0,
      cantidadConfirmada: 1
    }])
    setNuevoTipoSeleccionado('')
    toast.success('Tipo agregado')
  }
  
  const eliminarTipo = (tipoAnimal: string) => {
    setTiposConfirmados(prev => prev.filter(tc => tc.tipoAnimal !== tipoAnimal))
  }

  const handleConfirmarValidacion = async () => {
    if (totalConfirmados === 0) {
      toast.error('Debe haber al menos un animal confirmado')
      return
    }
    if (!corralDestinoId) {
      toast.error('Seleccione el corral de destino')
      return
    }
    
    setValidacionDialogOpen(false)
    
    if (totalConfirmados !== totalDTE || tiposConfirmados.some(tc => tc.cantidadConfirmada !== tc.cantidadDTE)) {
      try {
        await fetch('/api/tropas', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: tropaSeleccionada?.id,
            cantidadCabezas: totalConfirmados,
            tiposAnimales: tiposConfirmados.map(tc => ({
              tipoAnimal: tc.tipoAnimal,
              cantidad: tc.cantidadConfirmada
            }))
          })
        })
        toast.success('Cantidades actualizadas')
      } catch {
        toast.error('Error al actualizar cantidades')
      }
    }
    handleIniciarPesaje()
  }

  const handleIniciarPesaje = async () => {
    if (!tropaSeleccionada) return
    if (!corralDestinoId) {
      toast.error('Seleccione el corral de destino')
      return
    }
    
    setSaving(true)
    try {
      const res = await fetch('/api/tropas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tropaSeleccionada.id,
          estado: 'EN_PESAJE',
          corralId: corralDestinoId
        })
      })
      
      if (res.ok) {
        toast.success('Pesaje iniciado')
        setActiveTab('pesar')
        
        if (animales.length === 0) {
          const nuevosAnimales: Animal[] = []
          let num = 1
          const prefijo = tropaSeleccionada.especie === 'BOVINO' ? 'B' : 'E'
          const year = new Date().getFullYear()
          
          for (const tipo of tiposConfirmados) {
            for (let i = 0; i < tipo.cantidadConfirmada; i++) {
              nuevosAnimales.push({
                id: `temp-${num}`,
                numero: num,
                codigo: `${prefijo}${year}${String(tropaSeleccionada.numero).padStart(4, '0')}-${String(num).padStart(3, '0')}`,
                tipoAnimal: tipo.tipoAnimal,
                estado: 'RECIBIDO'
              })
              num++
            }
          }
          setAnimales(nuevosAnimales)
          setAnimalActual(0)
        }
        fetchData()
      } else {
        toast.error('Error al iniciar pesaje')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleRegistrarPeso = async () => {
    if (!pesoActual || !animales[animalActual]) return
    const peso = parseFloat(pesoActual)
    if (isNaN(peso) || peso <= 0) {
      toast.error('Ingrese un peso válido')
      return
    }
    if (!tipoAnimalSeleccionado) {
      toast.error('Seleccione el tipo de animal')
      return
    }

    const tipoDisponible = isTipoDisponible(tipoAnimalSeleccionado)
    if (!tipoDisponible.disponible) {
      toast.error(`No puede asignar más de tipo ${tipoAnimalSeleccionado}`)
      return
    }

    setSaving(true)
    try {
      const animal = animales[animalActual]
      
      // Verificar si el animal ya existe en la DB (no es temporal)
      const isExistingAnimal = !animal.id.startsWith('temp-')
      
      let res: Response
      let updatedAnimal: Animal
      
      if (isExistingAnimal) {
        // ACTUALIZAR animal existente con PUT
        res = await fetch('/api/animales', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: animal.id,
            tipoAnimal: tipoAnimalSeleccionado,
            caravana: caravana || null,
            raza: raza || null,
            pesoVivo: peso,
            estado: 'PESADO'
          })
        })
        updatedAnimal = await res.json()
      } else {
        // CREAR nuevo animal con POST
        res = await fetch('/api/animales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tropaId: tropaSeleccionada?.id,
            numero: animal.numero,
            codigo: animal.codigo,
            tipoAnimal: tipoAnimalSeleccionado,
            caravana: caravana || null,
            raza: raza || null,
            pesoVivo: peso,
            operadorId: operador.id
          })
        })
        updatedAnimal = await res.json()
      }
      
      if (res.ok) {
        const animalesActualizados = [...animales]
        animalesActualizados[animalActual] = {
          ...animalesActualizados[animalActual],
          id: updatedAnimal.id,
          caravana: caravana || undefined,
          raza: raza || undefined,
          tipoAnimal: tipoAnimalSeleccionado,
          pesoVivo: peso,
          estado: 'PESADO'
        }
        setAnimales(animalesActualizados)
        
        imprimirRotulo(animalesActualizados[animalActual])
        
        const nextIndex = animalesActualizados.findIndex((a, i) => a.estado === 'RECIBIDO' && i > animalActual)
        if (nextIndex !== -1) {
          setAnimalActual(nextIndex)
          resetFormFields()
          toast.success(`Animal ${animal.numero} - ${peso} kg`, { duration: 1500 })
          // PI3: Visual feedback flash
          setLastRegisteredAnimal({ ...animalesActualizados[animalActual] })
          setFlashFeedback(true)
        } else {
          const noPesados = animalesActualizados.filter(a => a.estado === 'RECIBIDO')
          if (noPesados.length === 0) {
            toast.success('Pesaje completado')
            handleFinalizarPesaje()
          } else {
            const firstPendiente = animalesActualizados.findIndex(a => a.estado === 'RECIBIDO')
            if (firstPendiente !== -1) {
              setAnimalActual(firstPendiente)
              resetFormFields()
            }
          }
        }
      } else {
        const errorData = await res.json()
        toast.error(errorData.error || 'Error al registrar peso')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const handleImprimirTicketA4 = async (tropa: Tropa) => {
    try {
      // Obtener los animales de esta tropa desde la API
      const res = await fetch(`/api/tropas/${tropa.id}/animales`)
      if (!res.ok) {
        // Fallback: usar la lista de animales actual si coincide la tropa
        if (tropaSeleccionada?.id === tropa.id && animales.length > 0) {
          imprimirTicketPesajeA4({
            tropa,
            animales: animales.filter(a => a.estado === 'PESADO'),
          })
          return
        }
        toast.error('No se pudieron obtener los datos de la tropa')
        return
      }
      const data = await res.json()
      const animalesTropa = data.data || data || []
      
      if (animalesTropa.length === 0) {
        toast.error('No hay animales pesados para esta tropa')
        return
      }

      imprimirTicketPesajeA4({
        tropa,
        animales: animalesTropa,
      })
      toast.success('Imprimiendo ticket A4...')
    } catch (error) {
      console.error('Error al imprimir ticket A4:', error)
      toast.error('Error al generar ticket A4')
    }
  }

  const handleFinalizarPesaje = async () => {
    if (!tropaSeleccionada) return
    
    setSaving(true)
    try {
      const pesoTotal = animales.reduce((acc, a) => acc + (a.pesoVivo || 0), 0)
      
      const res = await fetch('/api/tropas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tropaSeleccionada.id,
          estado: 'PESADO',
          pesoTotalIndividual: pesoTotal
        })
      })
      
      const data = await res.json()
      
      if (res.ok && data.success) {
        toast.success('Tropa pesada completamente')
        setTropaSeleccionada(null)
        setAnimales([])
        setAnimalActual(0)
        setTiposConfirmados([])
        setActiveTab('solicitar')
        await fetchData()
      } else {
        toast.error(data.error || 'Error al finalizar pesaje')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  // Generar ZPL para rótulo de pesaje individual
  const generarZPLPesaje = (animal: Animal): string => {
    const tropa = (tropaSeleccionada?.codigo || '').replace(/\s/g, '')
    const numero = String(animal.numero).padStart(3, '0')
    const peso = animal.pesoVivo?.toLocaleString('es-AR') || '0'
    const tipo = animal.tipoAnimal || ''
    const tipoLetra = tipo.charAt(0)?.toUpperCase() || '-'
    const codigoBarras = `${tropa}-${numero}`
    const fecha = new Date().toLocaleDateString('es-AR')

    // ZPL para etiqueta 100x50mm landscape (800x400 dots a 203dpi)
    // Estructura: 3 filas como el diseño HTML actual
    return `^XA
^CI28
^BY2,2.0,50
^FO30,15^A0N,22,22^FDTROPA^FS
^FO520,15^A0N,40,40^FD${tropa}^FS
^FO30,50^GB740,2,2^FS
^FO30,65^A0N,18,18^FDN. ANIMAL^FS
^FO30,110^A0N,60,60^FD${numero}^FS
^FO280,50^GB2,120,2^FS
^FO310,65^A0N,18,18^FDPESO VIVO^FS
^FO310,130^A0N,50,50^FD${peso} kg^FS
^FO30,195^GB740,2,2^FS
^FO30,210^BCN,70,Y,N,N^FD${codigoBarras}^FS
^FO30,300^A0N,16,16^FDCODE128 - ${codigoBarras}^FS
^FO560,65^A0N,20,20^FDTIPO: ${tipoLetra}^FS
^FO560,110^A0N,16,16^FD${fecha}^FS
^XZ`
  }

  // Imprimir rótulo
  const imprimirRotulo = async (animal: Animal) => {
    try {
      // Preparar datos del rótulo
      const datosRotulo: Record<string, string> = {
        codigo_barras: `${tropaSeleccionada?.codigo || ''}-${String(animal.numero).padStart(3, '0')}`,
        anio: new Date().getFullYear().toString(),
        tropa: tropaSeleccionada?.codigo || '',
        tropa_codigo: tropaSeleccionada?.codigo || '',
        numero: String(animal.numero).padStart(3, '0'),
        peso: animal.pesoVivo?.toString() || '0',
        peso_kg: `${animal.pesoVivo?.toLocaleString('es-AR') || '0'} kg`,
        tipo: animal.tipoAnimal || '',
        codigo: animal.codigo,
        raza: animal.raza || '',
        caravana: animal.caravana || '',
        fecha: new Date().toLocaleDateString('es-AR'),
      }

      // Buscar plantilla en DB
      const rotuloRes = await fetch('/api/rotulos?tipo=PESAJE_INDIVIDUAL&esDefault=true')
      const rotuloData = await rotuloRes.json()
      const rotulo = rotuloData.success && rotuloData.data && rotuloData.data.length > 0 ? rotuloData.data[0] : null

      // Si hay plantilla de DB, usarla (TCP/IP o impresora predeterminada)
      if (rotulo) {
        // TCP/IP directo con hardcoded ZPL
        if (!usarPredeterminada && impresoraIp) {
          const zplContenido = generarZPLPesaje(animal)
          
          try {
            const printRes = await fetch('/api/impresora/enviar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contenido: zplContenido,
                impresoraIp: impresoraIp,
                impresoraPuerto: impresoraPuerto,
                velocidad: impresoraVelocidad,
                calor: impresoraCalor,
                anchoEtiqueta: impresoraAncho,
                altoEtiqueta: impresoraAlto
              })
            })

            const printData = await printRes.json()
            
            if (printData.success) {
              toast.success('Rótulo enviado a impresora', { duration: 1500 })
              return
            }
          } catch (e) {
            console.error('Error impresora directa:', e)
          }

          // También intentar con plantilla de DB via TCP
          try {
            const printRes = await fetch('/api/rotulos/imprimir', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                rotuloId: rotulo.id,
                datos: datosRotulo,
                cantidad: 1,
                impresoraIp: impresoraIp,
                impresoraPuerto: impresoraPuerto
              })
            })
            const printData = await printRes.json()
            if (printData.success) {
              toast.success('Rótulo enviado a impresora', { duration: 1500 })
              return
            }
          } catch (e) {
            console.error('Error plantilla TCP:', e)
          }
        }

        // Impresora predeterminada o TCP falló: renderizar plantilla como HTML
        try {
          const { zplToHTML } = await import('@/lib/zpl-to-html')
          const processRes = await fetch('/api/rotulos/imprimir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rotuloId: rotulo.id, datos: datosRotulo, cantidad: 1 })
          })
          const processData = await processRes.json()
          
          if (processData.success && processData.contenido && processData.rotulo) {
            const html = zplToHTML(processData.contenido, datosRotulo, {
              anchoMm: processData.rotulo.ancho,
              altoMm: processData.rotulo.alto,
              dpi: processData.rotulo.dpi
            })
            const printWindow = window.open('', '_blank', 'width=500,height=300')
            if (printWindow) {
              printWindow.document.write(html)
              printWindow.document.close()
            }
            toast.success('Rótulo generado desde plantilla', { description: `Plantilla: ${rotulo.nombre}` })
            return
          }
        } catch (htmlError) {
          console.error('Error al renderizar plantilla como HTML:', htmlError)
        }
      }

      // Sin plantilla en DB: HTML hardcodeado como último recurso
      imprimirRotuloHTML(animal)
    } catch (error) {
      console.error('Error al imprimir rótulo:', error)
      imprimirRotuloHTML(animal)
    }
  }

  // Imprimir rótulo HTML con impresora predeterminada - 10x5 cm
  const imprimirRotuloHTML = (animal: Animal) => {
    try {
      // Crear ventana con características específicas para impresión
      const printWindow = window.open('', '_blank', 'width=500,height=300,menubar=no,toolbar=no,location=no,status=no')
      if (!printWindow) {
        toast.error('No se pudo abrir ventana de impresión. Verifique que los popups estén permitidos.')
        return
      }
      
      const pesoFormateado = animal.pesoVivo?.toLocaleString('es-AR') || '0'
      const codigoCompleto = animal.codigo || `${tropaSeleccionada?.codigo || ''}-${String(animal.numero).padStart(3, '0')}`
      
      // Generar código EAN-128/GS1-128 con Application Identifiers
      // Formato: (01)GTIN(21)Serial(310x)Peso
      // Para simplificar usamos CODE128 con el código de barras del animal
      const codigoEAN128 = codigoCompleto; // El código completo sirve como identificador único

      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rótulo ${codigoCompleto}</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: 100mm 50mm landscape; margin: 0; }
    body { 
      font-family: Arial, sans-serif; 
      width: 100mm;
      height: 50mm;
      background: white;
    }
    .etiqueta {
      border: 2px solid black;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    /* FILA 1: Tropa - ANCHO COMPLETO */
    .fila-tropa {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 2mm 4mm;
      border-bottom: 2px solid black;
      background: #f0f0f0;
    }
    .tropa-label {
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      color: #333;
    }
    .tropa-value {
      font-size: 24px;
      font-weight: 900;
      color: #000;
    }
    /* FILA 2: N° Animal y KG Vivos - 2 COLUMNAS */
    .fila-datos {
      display: flex;
      flex-direction: row;
      border-bottom: 2px solid black;
    }
    .campo {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 3mm;
    }
    .campo-animal {
      border-right: 2px solid black;
    }
    .campo-label {
      font-size: 9px;
      font-weight: bold;
      text-transform: uppercase;
      color: #333;
      margin-bottom: 1mm;
    }
    .campo-value {
      font-size: 18px;
      font-weight: 900;
      text-align: center;
    }
    .campo-animal .campo-value {
      font-size: 32px;
    }
    .campo-peso {
      background: #000;
      color: #fff;
    }
    .campo-peso .campo-label {
      color: #ccc;
    }
    .campo-peso .campo-value {
      color: #fff;
      font-size: 24px;
    }
    .peso-unit {
      font-size: 12px;
      font-weight: bold;
    }
    /* FILA 3: Código de barras EAN-128 - ANCHO COMPLETO */
    .fila-barcode {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      padding: 2mm;
    }
    #barcode-canvas {
      max-width: 90mm;
      height: auto;
    }
    .barcode-label {
      font-size: 8px;
      color: #666;
      margin-top: 1mm;
    }
    @media print { 
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="etiqueta">
    <!-- FILA 1: Tropa - ANCHO COMPLETO -->
    <div class="fila-tropa">
      <div class="tropa-label">TROPA</div>
      <div class="tropa-value">${(tropaSeleccionada?.codigo || '').replace(/\s/g, '')}</div>
    </div>
    
    <!-- FILA 2: N° Animal | KG Vivos - 2 COLUMNAS -->
    <div class="fila-datos">
      <div class="campo campo-animal">
        <div class="campo-label">N° Animal</div>
        <div class="campo-value">${String(animal.numero).padStart(3, '0')}</div>
      </div>
      
      <div class="campo campo-peso">
        <div class="campo-label">KG Vivos</div>
        <div class="campo-value">${pesoFormateado} <span class="peso-unit">kg</span></div>
      </div>
    </div>
    
    <!-- FILA 3: Código de barras EAN-128 - ANCHO COMPLETO -->
    <div class="fila-barcode">
      <svg id="barcode-canvas"></svg>
      <div class="barcode-label">CODE128 - ${codigoEAN128}</div>
    </div>
  </div>
  <script>
    (function() {
      // Generar código de barras CODE128 (base de EAN-128/GS1-128)
      try {
        JsBarcode("#barcode-canvas", "${codigoEAN128}", {
          format: "CODE128",
          width: 2,
          height: 30,
          displayValue: false,
          margin: 0
        });
      } catch(e) {
        // Fallback si JsBarcode falla
        document.getElementById('barcode-canvas').outerHTML = 
          '<div style="font-family:\\'Courier New\\',monospace;font-size:14px;letter-spacing:2px;">${codigoEAN128}</div>';
      }
      
      window.onload = function() {
        setTimeout(function() {
          window.print();
        }, 500);
        window.onafterprint = function() { 
          window.close();
        };
      };
    })();
  </script>
</body>
</html>`
      
      // Escribir contenido
      printWindow.document.write(htmlContent)
      printWindow.document.close()
      
      // Focus para asegurar que la ventana esté activa
      printWindow.focus()
      
    } catch (error) {
      console.error('Error al imprimir rótulo HTML:', error)
      toast.error('Error al generar rótulo')
    }
  }

  const handleEditAnimal = (animal: Animal) => {
    setEditingAnimal(animal)
    setEditCaravana(animal.caravana || '')
    setEditTipoAnimal(animal.tipoAnimal)
    setEditRaza(animal.raza || '')
    setEditPeso(animal.pesoVivo?.toString() || '')
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingAnimal) return
    
    try {
      const res = await fetch('/api/animales', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingAnimal.id,
          caravana: editCaravana || null,
          tipoAnimal: editTipoAnimal,
          raza: editRaza || null,
          pesoVivo: parseFloat(editPeso) || null
        })
      })
      
      if (res.ok) {
        toast.success('Animal actualizado')
        setEditDialogOpen(false)
        const updated = animales.map(a => {
          if (a.id === editingAnimal.id) {
            return { ...a, caravana: editCaravana || undefined, tipoAnimal: editTipoAnimal, raza: editRaza || undefined, pesoVivo: parseFloat(editPeso) || undefined }
          }
          return a
        })
        setAnimales(updated)
      } else {
        toast.error('Error al actualizar')
      }
    } catch {
      toast.error('Error de conexión')
    }
  }

  const handleDeleteAnimal = (animal: Animal) => {
    setDeleteTarget({ animal, action: 'delete' })
    setDeleteDialogOpen(true)
  }

  const confirmDeleteAnimal = async () => {
    if (!deleteTarget) return
    const animal = deleteTarget.animal
    
    try {
      const res = await fetch(`/api/animales?id=${animal.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Animal eliminado')
        const updated = animales.filter(a => a.id !== animal.id)
        setAnimales(updated)
        if (animalActual >= updated.length) {
          setAnimalActual(Math.max(0, updated.length - 1))
        }
      } else {
        toast.error('Error al eliminar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    }
  }

  // Reimprimir rótulo de un animal ya pesado
  const handleReimprimirRotulo = async (animal: Animal) => {
    if (!animal.pesoVivo) {
      toast.error('El animal no tiene peso registrado')
      return
    }

    // Si hay impresora TCP/IP configurada, imprimir directo (2 copias)
    if (!usarPredeterminada && impresoraIp) {
      const zplContenido = generarZPLPesaje(animal)
      try {
        const printRes = await fetch('/api/impresora/enviar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contenido: zplContenido,
            impresoraIp: impresoraIp,
            impresoraPuerto: impresoraPuerto,
            velocidad: impresoraVelocidad,
            calor: impresoraCalor,
            anchoEtiqueta: impresoraAncho,
            altoEtiqueta: impresoraAlto
          })
        })
        const printData = await printRes.json()
        if (printData.success) {
          // Imprimir 2 copias: enviar de nuevo
          await fetch('/api/impresora/enviar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contenido: zplContenido,
              impresoraIp: impresoraIp,
              impresoraPuerto: impresoraPuerto,
              velocidad: impresoraVelocidad,
              calor: impresoraCalor,
              anchoEtiqueta: impresoraAncho,
              altoEtiqueta: impresoraAlto
            })
          })
          toast.success('Rótulo reimpreso (2 copias)')
          return
        }
      } catch (error) {
        console.error('Error al reimprimir directo:', error)
      }
    }

    // Fallback: intentar con rótulo de la DB
    const fecha = new Date()
    const codigoBarras = `${tropaSeleccionada?.codigo || ''}-${String(animal.numero).padStart(3, '0')}`
    const datosRotulo = {
      CODIGO_BARRAS: codigoBarras,
      ANIO: fecha.getFullYear().toString(),
      TROPA: tropaSeleccionada?.codigo || '',
      NUMERO: String(animal.numero).padStart(3, '0'),
      PESO: animal.pesoVivo?.toString() || '0',
      TIPO: animal.tipoAnimal || '',
      FECHA: fecha.toLocaleDateString('es-AR')
    }

    try {
      const rotuloRes = await fetch('/api/rotulos?tipo=PESAJE_INDIVIDUAL&esDefault=true')
      const rotuloData = await rotuloRes.json()
      
      if (rotuloData.success && rotuloData.data && rotuloData.data.length > 0 && impresoraIp) {
        const rotulo = rotuloData.data[0]
        const printRes = await fetch('/api/rotulos/imprimir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rotuloId: rotulo.id,
            datos: datosRotulo,
            cantidad: 2,
            impresoraIp: impresoraIp,
            impresoraPuerto: impresoraPuerto
          })
        })
        
        if (printRes.ok) {
          toast.success('Rótulo reimpreso (2 copias)')
          return
        }
      }
      
      // Fallback: imprimir HTML por duplicado
      imprimirRotuloHTML(animal)
      setTimeout(() => imprimirRotuloHTML(animal), 500)
      toast.success('Rótulo reimpreso (2 copias HTML)')
    } catch (error) {
      console.error('Error al reimprimir:', error)
      toast.error('Error al reimprimir rótulo')
    }
  }

  // Repesar: volver a poner el animal como pendiente
  const handleRepesar = (animal: Animal) => {
    setDeleteTarget({ animal, action: 'repesar' })
    setDeleteDialogOpen(true)
  }

  const confirmRepesarAnimal = async () => {
    if (!deleteTarget) return
    const animal = deleteTarget.animal
    
    try {
      const res = await fetch('/api/animales', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: animal.id,
          estado: 'RECIBIDO',
          pesoVivo: null
        })
      })
      
      if (res.ok) {
        toast.success('Animal marcado para repesar')
        const updated = animales.map(a => {
          if (a.id === animal.id) {
            return { ...a, estado: 'RECIBIDO', pesoVivo: undefined }
          }
          return a
        })
        setAnimales(updated)
      } else {
        toast.error('Error al repesar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
    }
  }


  // Funciones de layout
  const updateBloque = useCallback((id: string, updates: Partial<BloqueLayout>) => {
    setBloques(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
  }, [])

  const updateBoton = (id: string, updates: Partial<BotonConfig>) => {
    setBotones(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
  }

  const updateTexto = (key: keyof TextosConfig, value: string) => {
    setTextos(prev => ({ ...prev, [key]: value }))
  }

  const moveBloqueUp = (id: string) => {
    const idx = bloques.findIndex(b => b.id === id)
    if (idx > 0) {
      const newBloques = [...bloques]
      const tempY = newBloques[idx - 1].y
      newBloques[idx - 1] = { ...newBloques[idx - 1], y: newBloques[idx].y }
      newBloques[idx] = { ...newBloques[idx], y: tempY }
      setBloques(newBloques)
    }
  }

  const moveBloqueDown = (id: string) => {
    const idx = bloques.findIndex(b => b.id === id)
    if (idx < bloques.length - 1) {
      const newBloques = [...bloques]
      const tempY = newBloques[idx + 1].y
      newBloques[idx + 1] = { ...newBloques[idx + 1], y: newBloques[idx].y }
      newBloques[idx] = { ...newBloques[idx], y: tempY }
      setBloques(newBloques)
    }
  }

  const handleSaveLayout = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/layout-modulo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modulo: 'pesajeIndividual',
          layout: { items: bloques },
          botones: { items: botones },
          textos: textos
        })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Layout guardado correctamente')
        setEditMode(false)
        setShowConfigPanel(false)
      } else toast.error(data.error || 'Error al guardar')
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('Error al guardar layout')
    } finally { setSaving(false) }
  }

  const resetLayout = () => {
    setBloques(LAYOUT_DEFAULT)
    setBotones(BOTONES_DEFAULT)
    setTextos(TEXTOS_DEFAULT)
    toast.info('Layout restablecido')
  }

  const animalesPendientes = animales.filter(a => a.estado === 'RECIBIDO')
  // Note: animalesPesados is already declared above with PI2

  if (loading || !layoutLoaded) {
    return (
      <div className="h-screen bg-stone-100 flex items-center justify-center">
        <Scale className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    )
  }

  const bloquesVisibles = bloques.filter(b => b.visible)
  const getBloque = (id: string) => bloques.find(b => b.id === id)
  const getBoton = (id: string) => botones.find(b => b.id === id)

  return (
    <div className={`h-screen bg-stone-100 flex flex-col overflow-hidden ${productionMode ? '' : ''}`}>
      <BalanzaConfigButton />
      {/* PI3: Enhanced flash feedback overlay with checkmark */}
      {flashFeedback && (
        <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center">
          <div className="bg-green-500/15 w-40 h-40 rounded-full animate-ping" />
          <div className="absolute bg-green-500/10 w-56 h-56 rounded-full" />
          <div className="absolute flex flex-col items-center gap-2">
            <CheckCircle className="w-20 h-20 text-green-500 drop-shadow-[0_0_12px_rgba(34,197,94,0.6)] animate-bounce" />
            <span className="text-green-400 font-bold text-lg drop-shadow-lg">
              {lastRegisteredAnimal?.pesoVivo} kg
            </span>
          </div>
        </div>
      )}
      {/* Botón flotante de edición */}
      {isAdmin && !productionMode && (
        <div className="fixed top-20 right-4 z-50 flex flex-col gap-2">
          {/* Botón de configurar impresora - siempre visible */}
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setConfigImpresoraOpen(true)} 
            className={`shadow-lg h-10 w-10 ${(impresoraIp || usarPredeterminada) ? 'bg-green-50 border-green-300 text-green-600' : 'bg-red-50 border-red-300 text-red-600'}`}
            title={usarPredeterminada ? 'Impresora predeterminada de Windows' : impresoraIp ? `Impresora TCP: ${impresoraIp}:${impresoraPuerto} | ${impresoraVelocidad}ips | Calor ${impresoraCalor} | ${impresoraAncho}x${impresoraAlto}mm` : 'Configurar impresora'}
          >
            <Printer className="w-5 h-5" />
          </Button>
          {/* PI1: Production mode toggle */}
          {tropaSeleccionada && activeTab === 'pesar' && (
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setProductionMode(!productionMode)} 
              className={`shadow-lg h-10 w-10 ${productionMode ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-stone-50 border-stone-300 text-stone-700 hover:bg-emerald-50'}`}
              title={productionMode ? 'Salir del modo producción' : 'Modo producción'}
            >
              {productionMode ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </Button>
          )}
          {!editMode ? (
            <Button variant="outline" size="icon" onClick={() => { setEditMode(true); setShowConfigPanel(true) }} className="bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 shadow-lg h-10 w-10" title="Editar Layout">
              <Edit3 className="w-5 h-5" />
            </Button>
          ) : (
            <>
              <Button variant="outline" size="icon" onClick={() => setShowConfigPanel(!showConfigPanel)} className="bg-white border-stone-300 shadow-lg h-10 w-10" title="Configuración"><Settings2 className="w-5 h-5" /></Button>
              <Button variant="outline" size="icon" onClick={resetLayout} className="bg-white border-stone-300 shadow-lg h-10 w-10" title="Resetear"><RefreshCw className="w-5 h-5" /></Button>
              <Button variant="outline" size="icon" onClick={() => { setEditMode(false); setShowConfigPanel(false) }} className="bg-white border-stone-300 shadow-lg h-10 w-10" title="Cancelar"><X className="w-5 h-5" /></Button>
              <Button size="icon" onClick={handleSaveLayout} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white shadow-lg h-10 w-10" title="Guardar"><Save className="w-5 h-5" /></Button>
            </>
          )}
        </div>
      )}

      {/* Panel de configuración lateral */}
      {editMode && showConfigPanel && (
        <div className="fixed top-36 right-4 z-50 w-96 bg-white rounded-lg shadow-2xl border-2 border-amber-200 max-h-[75vh] overflow-hidden">
          <div className="bg-amber-50 px-4 py-3 border-b border-amber-200">
            <h3 className="font-bold text-amber-800 flex items-center gap-2"><Settings2 className="w-4 h-4" /> Personalización Completa</h3>
          </div>
          
          <Tabs defaultValue="secciones" className="w-full">
            <TabsList className="w-full grid grid-cols-3 bg-stone-100">
              <TabsTrigger value="secciones" className="text-xs">Secciones</TabsTrigger>
              <TabsTrigger value="textos" className="text-xs">Textos</TabsTrigger>
              <TabsTrigger value="botones" className="text-xs">Botones</TabsTrigger>
            </TabsList>
            
            <ScrollArea className="h-[55vh]">
              <TabsContent value="secciones" className="p-4 space-y-2">
                <h4 className="font-medium text-sm text-stone-500 flex items-center gap-1"><Eye className="w-4 h-4" /> Visibilidad y Orden</h4>
                {bloques.map((bloque) => (
                  <div key={bloque.id} className="flex items-center gap-2 p-2 bg-stone-50 rounded-lg">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveBloqueUp(bloque.id)}><ChevronUp className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveBloqueDown(bloque.id)}><ChevronDown className="w-3 h-3" /></Button>
                    <span className="flex-1 text-sm font-medium">{bloque.label}</span>
                    <Switch checked={bloque.visible} onCheckedChange={(v) => updateBloque(bloque.id, { visible: v })} />
                  </div>
                ))}
              </TabsContent>
              
              <TabsContent value="textos" className="p-4 space-y-3">
                <h4 className="font-medium text-sm text-stone-500 flex items-center gap-1"><Type className="w-4 h-4" /> Textos del Módulo</h4>
                
                <div className="space-y-2">
                  <Label className="text-xs">Título del Módulo</Label>
                  <Input value={textos.tituloModulo} onChange={(e) => updateTexto('tituloModulo', e.target.value)} className="h-8" />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs">Subtítulo</Label>
                  <Input value={textos.subtituloModulo} onChange={(e) => updateTexto('subtituloModulo', e.target.value)} className="h-8" />
                </div>

                <Separator />
                <h4 className="font-medium text-sm text-stone-500">Labels de Secciones</h4>

                <div className="space-y-2">
                  <Label className="text-xs">Tropas Por Pesar</Label>
                  <Input value={textos.labelTropasPorPesar} onChange={(e) => updateTexto('labelTropasPorPesar', e.target.value)} className="h-8" />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Tropas Pesadas</Label>
                  <Input value={textos.labelTropasPesadas} onChange={(e) => updateTexto('labelTropasPesadas', e.target.value)} className="h-8" />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Panel de Pesaje</Label>
                  <Input value={textos.labelPanelPesaje} onChange={(e) => updateTexto('labelPanelPesaje', e.target.value)} className="h-8" />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Lista de Animales</Label>
                  <Input value={textos.labelListaAnimales} onChange={(e) => updateTexto('labelListaAnimales', e.target.value)} className="h-8" />
                </div>

                <Separator />
                <h4 className="font-medium text-sm text-stone-500">Otros Textos</h4>

                <div className="space-y-2">
                  <Label className="text-xs">"Sin Tropas"</Label>
                  <Input value={textos.labelSinTropas} onChange={(e) => updateTexto('labelSinTropas', e.target.value)} className="h-8" />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">"Sin Animales"</Label>
                  <Input value={textos.labelSinAnimales} onChange={(e) => updateTexto('labelSinAnimales', e.target.value)} className="h-8" />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Placeholder Peso</Label>
                  <Input value={textos.textoPesoPlaceholder} onChange={(e) => updateTexto('textoPesoPlaceholder', e.target.value)} className="h-8" />
                </div>
              </TabsContent>
              
              <TabsContent value="botones" className="p-4 space-y-3">
                <h4 className="font-medium text-sm text-stone-500 flex items-center gap-1"><Palette className="w-4 h-4" /> Botones de Acción</h4>
                {botones.map((btn) => (
                  <div key={btn.id} className="p-3 bg-stone-50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Botón: {btn.id}</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-500">Visible</span>
                        <Switch checked={btn.visible} onCheckedChange={(v) => updateBoton(btn.id, { visible: v })} />
                      </div>
                    </div>
                    <Input value={btn.texto} onChange={(e) => updateBoton(btn.id, { texto: e.target.value })} className="h-8" placeholder="Texto del botón" />
                  </div>
                ))}
              </TabsContent>
            </ScrollArea>
          </Tabs>
          
          <div className="p-3 bg-amber-50 border-t border-amber-200">
            <p className="text-xs text-amber-700">
              <strong>💡</strong> Arrastrá bloques para moverlos. Usá los handles amarillos para redimensionar. Click en <Save className="w-3 h-3 inline" /> para guardar.
            </p>
          </div>
        </div>
      )}

      {/* Header Compacto */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b flex-shrink-0">
        <h2 className="text-lg font-bold text-stone-800">{textos.tituloModulo}</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Badge variant="outline" className="text-sm">
            <Beef className="h-3 w-3 mr-1 text-amber-500" />
            {tropasPorPesar.length} por pesar
          </Badge>
          {/* PI1: Prominent production mode button in header */}
          {tropaSeleccionada && activeTab === 'pesar' && animales.length > 0 && !productionMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setProductionMode(true)}
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 bg-emerald-50"
            >
              <Maximize className="w-4 h-4 mr-1" />
              Modo Producción
            </Button>
          )}
        </div>
      </div>

      {/* PI2: Full-width progress bar when weighing */}
      {tropaSeleccionada && activeTab === 'pesar' && animales.length > 0 && !productionMode && (
        <div className="px-4 py-1.5 bg-white border-b flex-shrink-0">
          <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
            <span className="font-medium">{tropaSeleccionada.codigo} — {animalesPesados}/{totalAnimales} animales pesados</span>
            <span className="font-mono">{progresoPorcentaje}%</span>
          </div>
          <Progress
            value={progresoPorcentaje}
            className={cn(
              "h-2.5",
              progresoPorcentaje === 100
                ? "[&>[data-slot=progress-indicator]]:bg-green-500"
                : "[&>[data-slot=progress-indicator]]:bg-amber-500"
            )}
          />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
          <TabsTrigger value="solicitar">Solicitar Tropa</TabsTrigger>
          <TabsTrigger value="pesar" disabled={!tropaSeleccionada}>Pesar</TabsTrigger>
          <TabsTrigger value="historial">Historial</TabsTrigger>
        </TabsList>

        {/* SOLICITAR TROPA */}
        <TabsContent value="solicitar" className="flex-1 overflow-auto p-4 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="bg-amber-50 py-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                {textos.labelTropasPorPesar} ({tropasPorPesar.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {tropasPorPesar.length === 0 ? (
                  <div className="text-center py-6 text-stone-400">
                    <Beef className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{textos.labelSinTropas}</p>
                  </div>
                ) : (
                  tropasPorPesar.map((tropa) => (
                    <div key={tropa.id} className="flex items-center justify-between p-3 hover:bg-stone-50">
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-bold text-sm">{tropa.codigo}</span>
                        <span className="text-sm text-stone-600">{tropa.usuarioFaena?.nombre || '-'}</span>
                        <Badge variant="outline" className="text-xs">{tropa.especie}</Badge>
                        <span className="text-sm font-medium">{tropa.cantidadCabezas} cab</span>
                      </div>
                      {getBoton('seleccionar')?.visible && (
                        <Button size="sm" onClick={() => handleSeleccionarTropa(tropa)} className="bg-amber-500 hover:bg-amber-600">
                          <Scale className="w-3 h-3 mr-1" /> {getBoton('seleccionar')?.texto}
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="bg-green-50 py-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                {textos.labelTropasPesadas} ({tropasPesado.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {tropasPesado.length === 0 ? (
                  <div className="text-center py-6 text-stone-400">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No hay tropas pesadas</p>
                  </div>
                ) : (
                  tropasPesado.map((tropa) => (
                    <div key={tropa.id} className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-bold text-sm">{tropa.codigo}</span>
                        <span className="text-sm text-stone-600">{tropa.usuarioFaena?.nombre || '-'}</span>
                        <span className="text-sm font-medium">{tropa.cantidadCabezas} cab</span>
                        <span className="text-sm font-bold text-green-600">{tropa.pesoTotalIndividual?.toLocaleString() || '-'} kg</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PESAR ANIMALES - Layout optimizado SIN scroll */}
        <TabsContent value="pesar" className="flex-1 overflow-hidden p-3">
          <div className="h-full grid grid-cols-4 gap-3">
            {/* Panel Izquierdo: Formulario de Pesaje */}
            <Card className="col-span-3 border-0 shadow-sm flex flex-col h-full overflow-hidden">
              <CardHeader className="bg-green-50 py-1.5 px-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold">{tropaSeleccionada?.codigo}</CardTitle>
                  {/* PI2: Progress bar with shadcn Progress */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium">{animalesPesados}/{animales.length} pesados</span>
                    <Progress
                      value={progresoPorcentaje}
                      className={cn(
                        "w-28 h-2",
                        progresoPorcentaje === 100
                          ? "[&>[data-slot=progress-indicator]]:bg-green-500"
                          : "[&>[data-slot=progress-indicator]]:bg-amber-500"
                      )}
                    />
                    <span className="text-stone-500 font-mono">{progresoPorcentaje}%</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-3 overflow-hidden flex flex-col">
                {animales.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-center">
                    <div>
                      <Scale className="w-16 h-16 mx-auto mb-4 text-stone-300" />
                      <p className="text-stone-500">{textos.labelSinAnimales}</p>
                      <p className="text-sm text-stone-400 mt-1">Confirme la validación para generar animales</p>
                    </div>
                  </div>
                ) : animalesPendientes.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-center">
                    <div>
                      <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                      <p className="text-green-600 font-semibold">Pesaje completado</p>
                      <p className="text-sm text-stone-500 mt-1">Todos los animales han sido pesados</p>
                      {getBoton('finalizar')?.visible && (
                        <Button 
                          className="mt-4" 
                          onClick={() => handleFinalizarPesaje()}
                        >
                          {getBoton('finalizar')?.texto}
                        </Button>
                      )}
                    </div>
                  </div>
                ) : animales[animalActual] ? (
                  <div className="flex-1 flex flex-col justify-between">
                    {/* HEADER COMPACTO: Número + Progreso */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-stone-800 leading-none">
                          #{animales[animalActual].numero}
                        </span>
                        <span className="text-stone-400 text-sm">/ {animales.length}</span>
                      </div>
                    </div>

                    {/* GRID DE CONTROLES */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {/* TIPO */}
                      <div>
                        <Label className="text-[10px] font-semibold text-stone-500 mb-0.5 block">TIPO *</Label>
                        <div className="flex flex-wrap gap-1">
                          {tiposDisponiblesParaPesar.map((t) => {
                            const tipoStatus = isTipoDisponible(t.codigo)
                            const isSelected = tipoAnimalSeleccionado === t.codigo
                            return (
                              <button
                                key={t.codigo}
                                type="button"
                                onClick={() => tipoStatus.disponible && setTipoAnimalSeleccionado(t.codigo)}
                                disabled={!tipoStatus.disponible}
                                className={`px-2 py-1 rounded text-xs font-bold transition-all ${
                                  isSelected 
                                    ? 'bg-amber-500 text-white' 
                                    : tipoStatus.disponible
                                      ? 'bg-stone-100 hover:bg-amber-100'
                                      : 'bg-stone-50 text-stone-300 cursor-not-allowed'
                                }`}
                              >
                                {t.codigo}<span className="ml-0.5 opacity-60">({tipoStatus.restantes})</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* RAZA */}
                      <div>
                        <Label className="text-[10px] font-semibold text-stone-500 mb-0.5 block">RAZA</Label>
                        <div className="flex flex-wrap gap-0.5">
                          {razasActuales.map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => setRaza(r)}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-all ${
                                raza === r 
                                  ? 'bg-amber-500 text-white' 
                                  : 'bg-stone-100 hover:bg-amber-50'
                              }`}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* PESO */}
                      <div>
                        <Label className="text-[10px] font-semibold text-stone-500 mb-0.5 block">PESO (kg) *</Label>
                        <Input
                          type="number"
                          value={pesoActual}
                          onChange={(e) => setPesoActual(e.target.value)}
                          className={cn(
                            "text-2xl font-bold text-center h-10 transition-all duration-300",
                            flashFeedback && "ring-2 ring-green-400 bg-green-50 shadow-[0_0_20px_rgba(34,197,94,0.35)]"
                          )}
                          placeholder="0"
                          autoFocus
                        />
                      </div>

                      {/* CARAVANA */}
                      <div>
                        <Label className="text-[10px] font-semibold text-stone-500 mb-0.5 block">CARAVANA</Label>
                        <Input
                          value={caravana}
                          onChange={(e) => setCaravana(e.target.value.toUpperCase())}
                          placeholder="Número de caravana"
                          className="font-mono h-9 text-sm"
                        />
                      </div>
                    </div>

                    {/* BOTÓN REGISTRAR - GRANDE Y VISIBLE */}
                    {getBoton('registrar')?.visible && (
                      <Button
                        onClick={handleRegistrarPeso}
                        disabled={saving || !pesoActual || !tipoAnimalSeleccionado}
                        className="w-full h-12 text-base bg-green-600 hover:bg-green-700 mt-2"
                      >
                        {saving ? 'Guardando...' : (
                          <>
                            <Scale className="w-4 h-4 mr-2" />
                            {getBoton('registrar')?.texto} <ArrowRight className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-center">
                    <div>
                      <AlertCircle className="w-16 h-16 mx-auto mb-4 text-amber-500" />
                      <p className="text-stone-600">Seleccione un animal pendiente</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Panel Derecho: Lista de Animales COMPACTA */}
            <Card className="border-0 shadow-sm flex flex-col h-full overflow-hidden">
              <CardHeader className="py-1.5 px-2 flex-shrink-0 bg-stone-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs">{textos.labelListaAnimales}</CardTitle>
                  <div className="text-[10px] text-stone-500">
                    {animalesPesados}✓ {animalesPendientes.length}⏳
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-1">
                <div className="grid grid-cols-1 gap-1">
                  {animales.map((animal, idx) => (
                    <div 
                      key={animal.id}
                      className={`flex items-center gap-1 p-1 rounded ${
                        idx === animalActual ? 'bg-amber-200 ring-1 ring-amber-400' : 'hover:bg-stone-100'
                      }`}
                    >
                      <button
                        onClick={() => setAnimalActual(idx)}
                        className="flex items-center gap-1 flex-1 text-left"
                      >
                        {animal.estado === 'PESADO' ? (
                          <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                        )}
                        <span className={`text-xs font-bold ${animal.estado === 'PESADO' ? 'text-green-700' : ''}`}>
                          {animal.numero}
                        </span>
                        {(animal.caravana) && (
                          <span className="text-[9px] text-blue-600 font-mono">
                            [{animal.caravana}]
                          </span>
                        )}
                        {animal.pesoVivo && (
                          <span className="text-[10px] text-green-600">{animal.pesoVivo}kg</span>
                        )}
                      </button>
                      {animal.estado === 'PESADO' && (
                        <div className="flex gap-0.5">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleReimprimirRotulo(animal); }}
                            className="p-0.5 hover:bg-green-100 rounded"
                            title="Reimprimir rótulo"
                          >
                            <Printer className="w-2.5 h-2.5 text-green-600" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleRepesar(animal); }}
                            className="p-0.5 hover:bg-amber-100 rounded"
                            title="Repesar"
                          >
                            <Scale className="w-2.5 h-2.5 text-amber-600" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleEditAnimal(animal); }}
                            className="p-0.5 hover:bg-blue-100 rounded"
                            title="Editar"
                          >
                            <Edit className="w-2.5 h-2.5 text-blue-600" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDeleteAnimal(animal); }}
                            className="p-0.5 hover:bg-red-100 rounded"
                            title="Eliminar"
                          >
                            <Trash2 className="w-2.5 h-2.5 text-red-600" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* HISTORIAL */}
        <TabsContent value="historial" className="flex-1 overflow-auto p-4 space-y-3">
          {/* Barra de búsqueda y total */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" />
              <Input
                placeholder="Buscar por numero de tropa..."
                className="pl-9 h-9"
                value={historialBusqueda}
                onChange={(e) => setHistorialBusqueda(e.target.value)}
              />
            </div>
            <div className="text-xs text-stone-500 flex-shrink-0">
              {historialTotal} tropa{historialTotal !== 1 ? 's' : ''} pesada{historialTotal !== 1 ? 's' : ''}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1"
              onClick={() => fetchHistorial(historialBusqueda || undefined, historialPage)}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Loading */}
          {historialLoading && (
            <div className="text-center py-6 text-stone-400">
              <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin" />
              <p className="text-sm">Cargando historial...</p>
            </div>
          )}

          {/* Lista de tropas pesadas */}
          {!historialLoading && historial.length === 0 && (
            <div className="text-center py-8 text-stone-400">
              <Scale className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{historialBusqueda ? 'No se encontraron tropas para esa busqueda' : 'No hay tropas pesadas'}</p>
            </div>
          )}

          {!historialLoading && historial.length > 0 && (
            <div className="space-y-2">
              {historial.map((tropa) => (
                <Card key={tropa.id} className="border shadow-sm">
                  <CardContent className="p-3">
                    {/* Fila 1: Tropa + Fecha + Kg Netos */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-lg">{tropa.codigo}</span>
                        <div className="flex items-center gap-1.5 text-xs text-stone-500">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(tropa.fechaPesaje).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => handleImprimirTicketA4(tropa)}
                        >
                          <FileText className="w-3 h-3" />
                          A4
                        </Button>
                        <div className="flex items-center gap-1 bg-green-50 px-2.5 py-1 rounded-md">
                          <Weight className="w-3.5 h-3.5 text-green-600" />
                          <span className="font-bold text-green-700 text-sm">
                            {tropa.kgNetosTotales.toLocaleString('es-AR')} kg
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Fila 2: Info secundaria */}
                    <div className="flex items-center gap-3 text-xs text-stone-500 mb-2">
                      <span>{tropa.cantidadAnimalesPesados} animales</span>
                      <span className="text-stone-300">|</span>
                      <span>{tropa.usuarioFaena?.nombre || '-'}</span>
                      {tropa.corral && (
                        <>
                          <span className="text-stone-300">|</span>
                          <span>Corral: {tropa.corral.nombre}</span>
                        </>
                      )}
                      {tropa.kgNetosTotales > 0 && tropa.cantidadAnimalesPesados > 0 && (
                        <>
                          <span className="text-stone-300">|</span>
                          <span>Prom: {Math.round(tropa.kgNetosTotales / tropa.cantidadAnimalesPesados)} kg/cab</span>
                        </>
                      )}
                    </div>

                    {/* Fila 3: Resumen por tipo con kg */}
                    {tropa.resumenPorTipo && tropa.resumenPorTipo.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {tropa.resumenPorTipo.map((rt: any) => (
                          <Badge
                            key={rt.tipo}
                            variant="secondary"
                            className="text-xs font-mono bg-stone-100 hover:bg-stone-200 px-2 py-0.5"
                          >
                            {rt.tipo}: {rt.cantidad} cab - <span className="font-bold">{rt.kgTotal.toLocaleString('es-AR')} kg</span>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Paginación */}
          {!historialLoading && historialTotalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-stone-500">
                Pagina {historialPage} de {historialTotalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={historialPage <= 1}
                  onClick={() => {
                    const newPage = historialPage - 1
                    setHistorialPage(newPage)
                    fetchHistorial(historialBusqueda || undefined, newPage)
                  }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={historialPage >= historialTotalPages}
                  onClick={() => {
                    const newPage = historialPage + 1
                    setHistorialPage(newPage)
                    fetchHistorial(historialBusqueda || undefined, newPage)
                  }}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* DIÁLOGO DE VALIDACIÓN */}
      <Dialog open={validacionDialogOpen} onOpenChange={setValidacionDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto" maximizable>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="w-5 h-5 text-amber-600" />
              Validar Tropa {tropaSeleccionada?.codigo}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {/* Tabla de validación */}
            <div className="border rounded-lg overflow-hidden text-sm">
              <div className="grid grid-cols-4 gap-2 p-2 bg-stone-100 font-semibold text-xs">
                <div>Tipo</div>
                <div className="text-center">DTE</div>
                <div className="text-center">Recibido</div>
                <div className="text-center">Acción</div>
              </div>
              {tiposConfirmados.map((tc) => {
                const tipoInfo = TIPOS_ANIMALES[tropaSeleccionada?.especie || 'BOVINO']?.find(t => t.codigo === tc.tipoAnimal)
                const diferencia = tc.cantidadConfirmada - tc.cantidadDTE
                const esNuevo = tc.cantidadDTE === 0
                return (
                  <div key={tc.tipoAnimal} className={`grid grid-cols-4 gap-2 p-2 items-center ${esNuevo ? 'bg-blue-50' : diferencia !== 0 ? 'bg-amber-50' : ''}`}>
                    <div className="flex items-center gap-1">
                      <span className="font-bold">{tc.tipoAnimal}</span>
                      {esNuevo && <Badge variant="outline" className="text-xs bg-blue-100">NUEVO</Badge>}
                    </div>
                    <div className="text-center font-mono">{tc.cantidadDTE}</div>
                    <div className="text-center">
                      <Input
                        type="number"
                        value={tc.cantidadConfirmada}
                        onChange={(e) => setCantidadConfirmada(tc.tipoAnimal, parseInt(e.target.value) || 0)}
                        className="w-16 text-center mx-auto h-8"
                        min="0"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => ajustarCantidadConfirmada(tc.tipoAnimal, -1)} disabled={tc.cantidadConfirmada <= 0} className="h-7 w-7 p-0">
                        <Minus className="w-3 h-3" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => ajustarCantidadConfirmada(tc.tipoAnimal, 1)} className="h-7 w-7 p-0">
                        <Plus className="w-3 h-3" />
                      </Button>
                      {esNuevo && (
                        <Button variant="ghost" size="sm" onClick={() => eliminarTipo(tc.tipoAnimal)} className="h-7 w-7 p-0 text-red-500">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Totales */}
            <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg text-sm">
              <div>
                <span className="text-stone-500">Total DTE: </span>
                <span className="font-bold">{totalDTE}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-stone-400" />
              <div>
                <span className="text-stone-500">Total Confirmado: </span>
                <span className={`font-bold ${totalConfirmados !== totalDTE ? 'text-amber-600' : 'text-green-600'}`}>
                  {totalConfirmados}
                </span>
              </div>
            </div>

            {/* Corral */}
            <div>
              <Label className="text-sm font-semibold">Corral de Destino *</Label>
              <Select value={corralDestinoId} onValueChange={setCorralDestinoId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccione corral..." />
                </SelectTrigger>
                <SelectContent>
                  {corrales.map((c) => {
                    const stockActual = tropaSeleccionada?.especie === 'BOVINO' ? c.stockBovinos : c.stockEquinos
                    const disponible = c.capacidad - stockActual
                    return (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre} - Disp: {disponible}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Agregar tipo nuevo */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Label className="text-xs font-semibold text-blue-800">Agregar tipo no declarado</Label>
              <div className="flex gap-2 mt-1">
                <Select value={nuevoTipoSeleccionado} onValueChange={setNuevoTipoSeleccionado}>
                  <SelectTrigger className="flex-1 h-8">
                    <SelectValue placeholder="Tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_ANIMALES[tropaSeleccionada?.especie || 'BOVINO']
                      ?.filter(t => !tiposConfirmados.some(tc => tc.tipoAnimal === t.codigo))
                      .map(t => (
                        <SelectItem key={t.codigo} value={t.codigo}>{t.codigo} - {t.label}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button onClick={agregarNuevoTipo} disabled={!nuevoTipoSeleccionado} size="sm" className="bg-blue-600 text-white h-8">
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setValidacionDialogOpen(false); setTropaSeleccionada(null); }} size="sm">
              Cancelar
            </Button>
            <Button onClick={handleConfirmarValidacion} disabled={totalConfirmados === 0 || !corralDestinoId} className="bg-green-600" size="sm">
              <CheckCircle className="w-4 h-4 mr-1" /> Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-sm" maximizable>
          <DialogHeader>
            <DialogTitle>Editar Animal #{editingAnimal?.numero}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Caravana</Label>
              <Input value={editCaravana} onChange={(e) => setEditCaravana(e.target.value.toUpperCase())} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={editTipoAnimal} onValueChange={setEditTipoAnimal}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_ANIMALES[tropaSeleccionada?.especie || 'BOVINO']?.map((t) => (
                    <SelectItem key={t.codigo} value={t.codigo}>{t.codigo} - {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Peso (kg)</Label>
              <Input type="number" value={editPeso} onChange={(e) => setEditPeso(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Raza</Label>
              <Select value={editRaza} onValueChange={setEditRaza}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sin definir" />
                </SelectTrigger>
                <SelectContent>
                  {razasActuales.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} size="sm">Cancelar</Button>
            <Button onClick={handleSaveEdit} size="sm">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de configuración de impresora */}
      <Dialog open={configImpresoraOpen} onOpenChange={setConfigImpresoraOpen}>
        <DialogContent className="max-w-md" maximizable>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-amber-600" />
              Configurar Impresora de Rótulos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Opción: Impresora predeterminada de Windows */}
            <div 
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${usarPredeterminada ? 'border-green-500 bg-green-50' : 'border-stone-200 hover:border-stone-300'}`}
              onClick={() => { setUsarPredeterminada(true); setImpresoraIp('') }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border-2 ${usarPredeterminada ? 'border-green-500 bg-green-500' : 'border-stone-300'}`}>
                  {usarPredeterminada && <div className="w-2 h-2 bg-white rounded-full m-auto mt-0.5" />}
                </div>
                <div>
                  <p className="font-medium text-sm">Impresora Predeterminada de Windows</p>
                  <p className="text-xs text-stone-500">Usa la impresora configurada en el sistema (muestra diálogo)</p>
                </div>
              </div>
            </div>

            {/* Opción: Impresora TCP/IP - Impresión directa */}
            <div 
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${!usarPredeterminada ? 'border-green-500 bg-green-50' : 'border-stone-200 hover:border-stone-300'}`}
              onClick={() => setUsarPredeterminada(false)}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-4 h-4 rounded-full border-2 ${!usarPredeterminada ? 'border-green-500 bg-green-500' : 'border-stone-300'}`}>
                  {!usarPredeterminada && <div className="w-2 h-2 bg-white rounded-full m-auto mt-0.5" />}
                </div>
                <div>
                  <p className="font-medium text-sm">Impresora TCP/IP (Impresión Directa)</p>
                  <p className="text-xs text-stone-500">Conexión por red - Imprime sin diálogo, Zebra/Datamax</p>
                </div>
              </div>
              {!usarPredeterminada && (
                <div className="ml-7 space-y-3">
                  {/* IP y Puerto */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <Label className="text-xs">IP de la impresora</Label>
                      <Input 
                        value={impresoraIp} 
                        onChange={(e) => setImpresoraIp(e.target.value)} 
                        placeholder="192.168.1.100"
                        className="mt-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Puerto</Label>
                      <Input 
                        type="number" 
                        value={impresoraPuerto} 
                        onChange={(e) => setImpresoraPuerto(parseInt(e.target.value) || 9100)} 
                        className="mt-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>

                  {/* Tamaño de etiqueta */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Ancho (mm)</Label>
                      <Input 
                        type="number" 
                        value={impresoraAncho} 
                        onChange={(e) => setImpresoraAncho(parseInt(e.target.value) || 100)} 
                        className="mt-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Alto (mm)</Label>
                      <Input 
                        type="number" 
                        value={impresoraAlto} 
                        onChange={(e) => setImpresoraAlto(parseInt(e.target.value) || 50)} 
                        className="mt-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>

                  {/* Velocidad y Calor */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Velocidad (ips)</Label>
                      <Select value={String(impresoraVelocidad)} onValueChange={(v) => setImpresoraVelocidad(parseInt(v))}>
                        <SelectTrigger className="mt-1" onClick={(e) => e.stopPropagation()}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2 - Muy lenta</SelectItem>
                          <SelectItem value="3">3 - Lenta</SelectItem>
                          <SelectItem value="4">4 - Normal</SelectItem>
                          <SelectItem value="5">5 - Media</SelectItem>
                          <SelectItem value="6">6 - Media-alta</SelectItem>
                          <SelectItem value="8">8 - Rápida</SelectItem>
                          <SelectItem value="10">10 - Muy rápida</SelectItem>
                          <SelectItem value="12">12 - Máxima</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Calor / Densidad</Label>
                      <Select value={String(impresoraCalor)} onValueChange={(v) => setImpresoraCalor(parseInt(v))}>
                        <SelectTrigger className="mt-1" onClick={(e) => e.stopPropagation()}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0 - Mínimo</SelectItem>
                          <SelectItem value="5">5 - Bajo</SelectItem>
                          <SelectItem value="8">8 - Medio-bajo</SelectItem>
                          <SelectItem value="10">10 - Normal</SelectItem>
                          <SelectItem value="12">12 - Medio-alto</SelectItem>
                          <SelectItem value="15">15 - Alto</SelectItem>
                          <SelectItem value="20">20 - Muy alto</SelectItem>
                          <SelectItem value="25">25 - Intenso</SelectItem>
                          <SelectItem value="30">30 - Máximo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-amber-50 p-3 rounded-lg text-xs text-amber-700">
              <p className="font-medium mb-1">Información:</p>
              <p>• <b>TCP/IP:</b> Imprime directamente sin mostrar diálogo del navegador</p>
              <p>• <b>Windows:</b> Muestra el diálogo de impresión del sistema</p>
              <p>• <b>Velocidad:</b> Mayor velocidad = impresión más rápida pero menos definición</p>
              <p>• <b>Calor:</b> Mayor calor = etiqueta más oscura, mejor para código de barras</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigImpresoraOpen(false)} size="sm">Cancelar</Button>
            <Button 
              onClick={() => {
                localStorage.setItem('impresoraRotulosIp', impresoraIp)
                localStorage.setItem('impresoraRotulosPredeterminada', String(usarPredeterminada))
                localStorage.setItem('impresoraRotulosPuerto', String(impresoraPuerto))
                localStorage.setItem('impresoraRotulosVelocidad', String(impresoraVelocidad))
                localStorage.setItem('impresoraRotulosCalor', String(impresoraCalor))
                localStorage.setItem('impresoraRotulosAncho', String(impresoraAncho))
                localStorage.setItem('impresoraRotulosAlto', String(impresoraAlto))
                setConfigImpresoraOpen(false)
                if (usarPredeterminada) {
                  toast.success('Usando impresora predeterminada de Windows')
                } else {
                  toast.success(`Impresora configurada: ${impresoraIp}:${impresoraPuerto} | ${impresoraVelocidad}ips | Calor ${impresoraCalor}`)
                }
              }} 
              size="sm"
              disabled={!usarPredeterminada && !impresoraIp}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PI1: Production Mode Fullscreen Overlay */}
      {productionMode && (
        <div className="fixed inset-0 z-50 bg-stone-900 text-white flex flex-col items-center justify-center p-8">
          {/* Close button */}
          <button
            onClick={() => setProductionMode(false)}
            className="absolute top-4 right-4 text-stone-400 hover:text-white p-2 rounded-lg hover:bg-stone-800 transition-colors"
            title="Salir del modo producción (Esc)"
          >
            <Minimize className="w-6 h-6" />
          </button>

          {/* Tropa info + Progress bar (PI2) */}
          <div className="text-center mb-6 w-full max-w-lg">
            <p className="text-stone-500 text-xs uppercase tracking-wider mb-1">Tropa Activa</p>
            <p className="text-2xl font-bold text-amber-400">{tropaSeleccionada?.codigo || 'Sin tropa'}</p>
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-xs text-stone-500">
                <span>{animalesPesados}/{totalAnimales} animales pesados</span>
                <span className="font-mono">{progresoPorcentaje}%</span>
              </div>
              <Progress
                value={progresoPorcentaje}
                className={cn(
                  "h-3 bg-stone-700",
                  progresoPorcentaje === 100
                    ? "[&>[data-slot=progress-indicator]]:bg-green-500"
                    : "[&>[data-slot=progress-indicator]]:bg-amber-500"
                )}
              />
            </div>
          </div>

          {/* Animal number + Type selector */}
          {animalesPendientes.length > 0 && animales[animalActual] ? (
            <>
              <div className="flex items-center gap-6 mb-6">
                <div className="text-center">
                  <span className="text-stone-500 text-xs uppercase tracking-wider">Animal</span>
                  <p className="text-xl font-mono text-stone-200 font-bold">
                    #{animales[animalActual].numero}
                    <span className="text-stone-600 text-sm font-normal"> / {animales.length}</span>
                  </p>
                </div>
                <div className="w-px h-8 bg-stone-700" />
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {tiposDisponiblesParaPesar.map((t) => {
                    const status = isTipoDisponible(t.codigo)
                    const selected = tipoAnimalSeleccionado === t.codigo
                    return (
                      <button
                        key={t.codigo}
                        onClick={() => status.disponible && setTipoAnimalSeleccionado(t.codigo)}
                        disabled={!status.disponible}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm font-bold transition-all",
                          selected
                            ? "bg-amber-500 text-white shadow-lg shadow-amber-500/25"
                            : status.disponible
                              ? "bg-stone-700 text-stone-300 hover:bg-stone-600"
                              : "bg-stone-800 text-stone-600 cursor-not-allowed"
                        )}
                      >
                        {t.codigo}
                        <span className="ml-1 opacity-50 text-xs">({status.restantes})</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Peso input (big) */}
              <div className="text-center mb-8 w-full max-w-md">
                <p className="text-stone-500 text-xs uppercase tracking-wider mb-2">Peso Leído (kg)</p>
                <input
                  type="number"
                  value={pesoActual}
                  onChange={(e) => setPesoActual(e.target.value)}
                  className={cn(
                    "w-full text-center text-7xl font-mono font-bold bg-transparent border-b-2 border-stone-600 text-green-400 focus:outline-none focus:border-green-400 tabular-nums py-2 transition-all duration-300",
                    flashFeedback && "border-green-400 shadow-[0_0_30px_rgba(34,197,94,0.5)]"
                  )}
                  placeholder="0"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRegistrarPeso()
                  }}
                />
              </div>

              {/* PI3: Checkmark flash feedback in production mode */}
              {flashFeedback && (
                <div className="absolute inset-0 z-[60] pointer-events-none flex items-center justify-center">
                  <div className="bg-green-500/15 w-40 h-40 rounded-full animate-ping" />
                  <div className="absolute flex flex-col items-center gap-2">
                    <CheckCircle className="w-20 h-20 text-green-400 drop-shadow-[0_0_12px_rgba(34,197,94,0.6)] animate-bounce" />
                    <span className="text-green-300 font-bold text-lg drop-shadow-lg">
                      {lastRegisteredAnimal?.pesoVivo} kg
                    </span>
                  </div>
                </div>
              )}

              {/* Register button */}
              <button
                onClick={handleRegistrarPeso}
                disabled={saving || !pesoActual || !tipoAnimalSeleccionado}
                className="bg-green-500 hover:bg-green-600 disabled:bg-stone-700 disabled:text-stone-500 text-white text-2xl font-bold py-5 px-20 rounded-2xl shadow-lg shadow-green-500/25 transition-all active:scale-95"
              >
                {saving ? 'Guardando...' : 'REGISTRAR'}
              </button>
            </>
          ) : (
            <div className="text-center">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <p className="text-green-400 font-semibold text-xl">Pesaje completado</p>
              <p className="text-stone-500 mt-1">Todos los animales han sido pesados</p>
              <button
                onClick={() => { handleFinalizarPesaje(); setProductionMode(false) }}
                disabled={saving}
                className="mt-6 bg-green-600 hover:bg-green-700 disabled:bg-stone-700 text-white font-bold py-3 px-10 rounded-xl transition-all"
              >
                {saving ? 'Finalizando...' : 'Finalizar Pesaje'}
              </button>
            </div>
          )}

          {/* Last registered animal */}
          <div className="mt-8 text-center">
            <p className="text-stone-600 text-xs uppercase tracking-wider">Último registrado</p>
            <p className="text-stone-400 text-sm mt-0.5">
              {lastRegisteredAnimal
                ? `#${String(lastRegisteredAnimal.numero).padStart(3, '0')} ${lastRegisteredAnimal.tipoAnimal} · ${lastRegisteredAnimal.pesoVivo} kg`
                : 'Sin registros'}
            </p>
          </div>
        </div>
      )}

      {/* Confirm Delete / Repesar Dialog */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (deleteTarget?.action === 'delete') confirmDeleteAnimal()
          else if (deleteTarget?.action === 'repesar') confirmRepesarAnimal()
        }}
        title={deleteTarget?.action === 'repesar' ? 'Confirmar Repeso' : 'Confirmar eliminación'}
        description={deleteTarget?.action === 'repesar' ? 'Se eliminará el peso actual del animal.' : 'Esta acción no se puede deshacer.'}
        itemName={deleteTarget ? `Animal ${deleteTarget.animal.numero}` : undefined}
      />
    </div>
  )
}
