'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useOperador } from '@/components/providers/auth-provider'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  Save, RotateCcw, ShieldAlert, Loader2, Columns3, FileSpreadsheet,
  Eye, Ruler, GripVertical, ChevronRight, MoveHorizontal, ZoomIn,
  AlignLeft, AlignCenter, AlignRight, ImageIcon, Minus, Square,
  Upload, MousePointerClick, type LucideIcon
} from 'lucide-react'

// ============================================================
// TYPES
// ============================================================

type ReportTab = 'rinde-tropa' | 'planilla-01' | 'stock-corrales'

interface ReportConfig {
  excel: Record<string, unknown>
  pdf: Record<string, unknown>
}

const DEFAULT_RINDE_CONFIG: ReportConfig = {
  excel: {
    pagina: { orientacion: 'landscape', ajustarAncho: true },
    margenes: { izquierdo: 0.4, derecho: 0.4, superior: 0.3, inferior: 0.3 },
    anchoColumnas: {
      A: 4, B: 3.7, C_garron: 10, D_animal: 10, E_raza: 7,
      F_G_clasif: 14, H_caravana: 18, I_kgEntrada: 13,
      J_mediaA: 15, K_mediaB: 13, L_totalKg: 13, M_rinde: 13, N: 3.7,
    },
    fuentes: { familia: 'Calibri', tamanoEncabezado: 10, tamanoDatos: 10, tamanoInfo: 12, tamanoMenudencia: 12 },
    formatosNumericos: { kgEntero: '#,##0', kgDecimal: '#,##0.0', porcentaje: '0.00%', fecha: 'DD/MM/YYYY', hora: 'HH:MM' },
    separacion: { filasAntesMenudencia: 4 },
    alineacionAnimales: {
      C_garron: 'center', D_animal: 'center', E_raza: 'center', F_G_clasif: 'center',
      H_caravana: 'center', I_kgEntrada: 'center', J_mediaA: 'center',
      K_mediaB: 'center', L_totalKg: 'center', M_rinde: 'right',
    },
    alineacionMenudencia: {
      tipo: 'left', cantidades: 'center', kg: 'center', unidad: 'center', kgDec: 'center',
    },
    alineacionResumen: {
      labels: 'right', values: 'left', tipos: 'left', cuartos: 'center', kgTipos: 'right',
    },
    logo: { visible: false, posicion: 'arriba-izquierda', ancho: 100, alto: 50, archivo: 'logo.png' },
    bordes: {
      encabezado: false, infoOperador: false, resumen: false, tablaAnimales: true, menudencia: true,
    },
    separadores: {
      despuesEncabezado: 'ninguno', despuesInfoOperador: 'ninguno',
      despuesResumen: 'ninguno', antesMenudencia: 'ninguno',
    },
  },
  pdf: {},
}

const TAB_INFO: { value: ReportTab; label: string; icon: string }[] = [
  { value: 'rinde-tropa', label: 'Rinde por Tropa', icon: '📊' },
  { value: 'planilla-01', label: 'Planilla 01', icon: '📋' },
  { value: 'stock-corrales', label: 'Stock Corrales', icon: '🏪' },
]

// ============================================================
// RINDE POR TROPA - Types & Constants
// ============================================================

interface RindeExcelConfig {
  pagina: { orientacion: string; ajustarAncho: boolean }
  margenes: { izquierdo: number; derecho: number; superior: number; inferior: number }
  anchoColumnas: Record<string, number>
  fuentes: {
    familia: string
    tamanoEncabezado: number
    tamanoDatos: number
    tamanoInfo: number
    tamanoMenudencia: number
  }
  formatosNumericos: Record<string, string>
  separacion: { filasAntesMenudencia: number }
  alineacionAnimales: Record<string, string>
  alineacionMenudencia: Record<string, string>
  alineacionResumen: Record<string, string>
  logo: { visible: boolean; posicion: string; ancho: number; alto: number; archivo?: string }
  bordes: Record<string, boolean>
  separadores: Record<string, string>
}

type RindeZoneId = 'header' | 'operator' | 'summary' | 'animalTable' | 'menudencia'

interface RindeZoneMeta {
  id: RindeZoneId
  label: string
  icon: string
  fontKey: 'tamanoEncabezado' | 'tamanoInfo' | 'tamanoDatos' | 'tamanoMenudencia'
  bordeKey: string
  separadorKey: string | null
}

const RINDE_ZONES: RindeZoneMeta[] = [
  { id: 'header', label: 'Encabezado', icon: '📝', fontKey: 'tamanoEncabezado', bordeKey: 'encabezado', separadorKey: 'despuesEncabezado' },
  { id: 'operator', label: 'Info Operador', icon: '👤', fontKey: 'tamanoInfo', bordeKey: 'infoOperador', separadorKey: 'despuesInfoOperador' },
  { id: 'summary', label: 'Resumen', icon: '📊', fontKey: 'tamanoDatos', bordeKey: 'resumen', separadorKey: 'despuesResumen' },
  { id: 'animalTable', label: 'Tabla Animales', icon: '🐄', fontKey: 'tamanoDatos', bordeKey: 'tablaAnimales', separadorKey: null },
  { id: 'menudencia', label: 'Menudencia', icon: '🫀', fontKey: 'tamanoMenudencia', bordeKey: 'menudencia', separadorKey: null },
]

const RINDE_COLUMN_MAP: Record<string, { label: string; key: string }> = {
  C_garron: { label: 'N° Garrón', key: 'C_garron' },
  D_animal: { label: 'N° Animal', key: 'D_animal' },
  E_raza: { label: 'Raza', key: 'E_raza' },
  F_G_clasif: { label: 'Clasificación', key: 'F_G_clasif' },
  H_caravana: { label: 'Caravana', key: 'H_caravana' },
  I_kgEntrada: { label: 'Kg Entrada', key: 'I_kgEntrada' },
  J_mediaA: { label: 'Kg 1/2 A', key: 'J_mediaA' },
  K_mediaB: { label: 'Kg 1/2 B', key: 'K_mediaB' },
  L_totalKg: { label: 'Total Kg', key: 'L_totalKg' },
  M_rinde: { label: 'Rinde', key: 'M_rinde' },
}

const MENUDENCIA_COL_MAP: Record<string, { label: string; key: string }> = {
  tipo: { label: 'Tipo', key: 'tipo' },
  cantidades: { label: 'Cantidades', key: 'cantidades' },
  kg: { label: 'Kg', key: 'kg' },
  unidad: { label: 'Unidad', key: 'unidad' },
  kgDec: { label: 'Kg Dec.', key: 'kgDec' },
}

const RESUMEN_COL_MAP: Record<string, { label: string; key: string }> = {
  labels: { label: 'Etiquetas', key: 'labels' },
  values: { label: 'Valores', key: 'values' },
  tipos: { label: 'Tipos', key: 'tipos' },
  cuartos: { label: 'Cuartos', key: 'cuartos' },
  kgTipos: { label: 'Kg Tipos', key: 'kgTipos' },
}

const FONT_OPTIONS = ['Calibri', 'Arial', 'Times New Roman', 'Verdana', 'Tahoma']
const EXCEL_TO_PX = 7
const ANIMAL_COL_KEYS = Object.keys(RINDE_COLUMN_MAP)
const MENUDENCIA_COL_KEYS = Object.keys(MENUDENCIA_COL_MAP)

const ANIMAL_DATA = [
  { garron: 1, animal: 1, raza: 'Hereford', clasif: '0-2 TO', caravana: '1234ABC', kgEntrada: 420, mediaA: 107.5, mediaB: 108.3, totalKg: 215.8, rinde: '51.38%' },
  { garron: 2, animal: 2, raza: 'Angus', clasif: '2-4 VQ', caravana: '5678DEF', kgEntrada: 395, mediaA: 102.1, mediaB: 103.7, totalKg: 205.8, rinde: '52.10%' },
  { garron: 3, animal: 3, raza: 'Bradford', clasif: '4-6 NT', caravana: '9012GHI', kgEntrada: 410, mediaA: 105.8, mediaB: 106.2, totalKg: 212.0, rinde: '51.71%' },
]

const MENUDENCIA_DATA = [
  { tipo: 'HIGADO', cant: 5, kg: 45.2, unidad: '-', kgDec: 1.0 },
  { tipo: 'CORAZON', cant: 4, kg: 12.8, unidad: '-', kgDec: 0.5 },
  { tipo: 'LENGUA', cant: 3, kg: 15.0, unidad: '-', kgDec: null },
]

// ============================================================
// PLANILLA 01 - Constants
// ============================================================

type PlanillaZoneId = 'header' | 'dataTable' | 'totals'

interface PlanillaZoneMeta {
  id: PlanillaZoneId
  label: string
  icon: string
}

const PLANILLA_ZONES: PlanillaZoneMeta[] = [
  { id: 'header', label: 'Encabezado', icon: '📝' },
  { id: 'dataTable', label: 'Tabla Datos', icon: '📋' },
  { id: 'totals', label: 'Totales', icon: '📊' },
]

const PLANILLA_COLUMNS = [
  { key: 'num', label: 'N°' },
  { key: 'caravana', label: 'Caravana' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'raza', label: 'Raza' },
  { key: 'peso', label: 'Peso' },
  { key: 'corral', label: 'Corral' },
  { key: 'obs', label: 'Observaciones' },
]

const PLANILLA_DATA = [
  { num: 1, caravana: '1234ABC', tipo: 'Novillo', raza: 'Hereford', peso: 420, corral: 'C01', obs: '-' },
  { num: 2, caravana: '5678DEF', tipo: 'Toro', raza: 'Angus', peso: 480, corral: 'C01', obs: '-' },
  { num: 3, caravana: '9012GHI', tipo: 'Vaquillona', raza: 'Bradford', peso: 350, corral: 'C02', obs: 'Sin diente' },
]

// ============================================================
// STOCK CORRALES - Constants
// ============================================================

type StockZoneId = 'header' | 'dataTable' | 'totals'

interface StockZoneMeta {
  id: StockZoneId
  label: string
  icon: string
}

const STOCK_ZONES: StockZoneMeta[] = [
  { id: 'header', label: 'Encabezado', icon: '📝' },
  { id: 'dataTable', label: 'Tabla Datos', icon: '📋' },
  { id: 'totals', label: 'Totales', icon: '📊' },
]

const STOCK_COLUMNS = [
  { key: 'fecha', label: 'Entrada Fecha' },
  { key: 'hora', label: 'Entrada Hora' },
  { key: 'corral', label: 'Corral' },
  { key: 'tropa', label: 'Tropa' },
  { key: 'guia', label: 'Guía' },
  { key: 'dte', label: 'DTE' },
  { key: 'ue', label: 'DDJJ UE' },
  { key: 'cant', label: 'Cant. Animales' },
]

const STOCK_DATA = [
  { fecha: '27/05/2026', hora: '08:30', corral: 'C01', tropa: 101, guia: '0001-00234567', dte: '001-12345678-9', ue: 'Juan Pérez', cant: 15 },
  { fecha: '27/05/2026', hora: '10:15', corral: 'C02', tropa: 102, guia: '0001-00234568', dte: '001-12345679', ue: 'Carlos López', cant: 12 },
]

// ============================================================
// LOGO OPTIONS
// ============================================================
const LOGO_FILES = ['logo.png', 'logo-solemar.png', 'logos/logo-solemar.jpg']

// ============================================================
// ALGNMENT BUTTON COMPONENT
// ============================================================

function AlignmentPicker({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (v: string) => void
  label?: string
}) {
  const options = [
    { val: 'left', icon: AlignLeft, tip: 'Izquierda' },
    { val: 'center', icon: AlignCenter, tip: 'Centro' },
    { val: 'right', icon: AlignRight, tip: 'Derecha' },
  ]
  return (
    <div className="flex items-center gap-2">
      {label && <Label className="text-[10px] text-muted-foreground flex-1 truncate">{label}</Label>}
      <div className="flex rounded border overflow-hidden">
        {options.map(opt => (
          <button
            key={opt.val}
            title={opt.tip}
            className={`p-1 transition-colors ${value === opt.val
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-500 hover:bg-gray-100'
              }`}
            onClick={() => onChange(opt.val)}
          >
            <opt.icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// COLUMN RESIZE HANDLE
// ============================================================

function ColResizeHandle({
  isResizing,
  isHovered,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
}: {
  isResizing: boolean
  isHovered: boolean
  onMouseDown: (e: React.MouseEvent) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  return (
    <div
      className="absolute z-30 top-0 bottom-0"
      style={{ right: '-4px', width: '9px', cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div
        className="rounded-full transition-all duration-150"
        style={{
          width: isResizing ? '3px' : isHovered ? '3px' : '2px',
          height: isResizing ? '70%' : isHovered ? '60%' : '30%',
          backgroundColor: isResizing ? '#2563eb' : isHovered ? '#3b82f6' : '#cbd5e1',
          opacity: isHovered || isResizing ? 1 : 0.5,
          boxShadow: isHovered || isResizing ? '0 0 4px rgba(37,99,235,0.4)' : 'none',
        }}
      />
    </div>
  )
}

// ============================================================
// ZONE BADGE COMPONENT
// ============================================================

function ZoneBadge({ selected, hovered, icon, label, resizeHint }: {
  selected: boolean; hovered: boolean; icon: string; label: string; resizeHint?: string
}) {
  if (!selected && !hovered) return null
  return (
    <div className="absolute -top-3 left-3 z-10 flex items-center gap-1 px-2 py-0 rounded text-[10px] font-medium"
      style={{ background: selected ? '#2563eb' : '#e0e7ff', color: selected ? '#fff' : '#3730a3' }}>
      <span>{icon}</span><span>{label}</span>
      {resizeHint && selected && <span className="ml-2 text-[9px] opacity-80">← Arrastrá bordes →</span>}
    </div>
  )
}

// ============================================================
// ZONE WRAPPER COMPONENT
// ============================================================

function ZoneWrapper({ selected, hovered, zoneId, icon, label, resizeHint, children, onClick, onMouseEnter, onMouseLeave, borderColor, customBorder }: {
  selected: boolean
  hovered: boolean
  zoneId: string
  icon: string
  label: string
  resizeHint?: string
  children: React.ReactNode
  onClick: (e: React.MouseEvent) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
  borderColor?: string
  customBorder?: string
}) {
  const border = customBorder || (selected ? '2px solid #2563eb' : '2px solid transparent')
  return (
    <div
      className="relative rounded transition-all duration-200"
      style={{
        border,
        background: selected ? 'rgba(37,99,235,0.04)' : hovered ? 'rgba(37,99,235,0.02)' : 'transparent',
        cursor: 'pointer', padding: '2px',
      }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <ZoneBadge selected={selected} hovered={hovered} icon={icon} label={label} resizeHint={resizeHint} />
      {children}
    </div>
  )
}

// ============================================================
// SIMPLE REPORT CONFIG HELPERS (Planilla/Stock)
// ============================================================

function getSimpleLogo(cfg: ReportConfig) {
  const excel = cfg.excel as Record<string, unknown>
  const logo = (excel.logo || {}) as Record<string, unknown>
  return {
    visible: logo.visible as boolean ?? false,
    posicion: logo.posicion as string ?? 'izquierda',
    ancho: logo.ancho as number ?? 80,
    alto: logo.alto as number ?? 40,
    archivo: logo.archivo as string ?? 'logo.png',
  }
}

function getSimpleFuentes(cfg: ReportConfig) {
  const excel = cfg.excel as Record<string, unknown>
  return (excel.fuentes || {}) as Record<string, unknown>
}

function getSimplePagina(cfg: ReportConfig) {
  const excel = cfg.excel as Record<string, unknown>
  return (excel.pagina || { orientacion: 'landscape', ajustarAncho: true }) as Record<string, unknown>
}

function getSimpleMargenes(cfg: ReportConfig) {
  const excel = cfg.excel as Record<string, unknown>
  return (excel.margenes || { izquierdo: 0.4, derecho: 0.4, superior: 0.3, inferior: 0.3 }) as Record<string, number>
}

function getSimpleBordes(cfg: ReportConfig) {
  const excel = cfg.excel as Record<string, unknown>
  return (excel.bordes || {}) as Record<string, boolean>
}

function getSimpleSeparadores(cfg: ReportConfig) {
  const excel = cfg.excel as Record<string, unknown>
  return (excel.separadores || {}) as Record<string, string>
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function FormatoReportesPage() {
  const operador = useOperador()

  // Tab state
  const [activeTab, setActiveTab] = useState<ReportTab>('rinde-tropa')

  // Per-tab config state
  const [configs, setConfigs] = useState<Record<ReportTab, ReportConfig | null>>({
    'rinde-tropa': null,
    'planilla-01': null,
    'stock-corrales': null,
  })
  const [savedConfigs, setSavedConfigs] = useState<Record<ReportTab, ReportConfig | null>>({
    'rinde-tropa': null,
    'planilla-01': null,
    'stock-corrales': null,
  })

  // Per-tab selected zone state
  const [selectedZones, setSelectedZones] = useState<Record<ReportTab, string | null>>({
    'rinde-tropa': null,
    'planilla-01': null,
    'stock-corrales': null,
  })

  // General UI state
  const [loading, setLoading] = useState<Record<ReportTab, boolean>>({
    'rinde-tropa': true,
    'planilla-01': true,
    'stock-corrales': true,
  })
  const [saving, setSaving] = useState(false)
  const [hoveredZones, setHoveredZones] = useState<Record<ReportTab, string | null>>({
    'rinde-tropa': null,
    'planilla-01': null,
    'stock-corrales': null,
  })

  // Rinde-specific column resize state
  const [resizingCol, setResizingCol] = useState<string | null>(null)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null)
  const [currentResizeWidth, setCurrentResizeWidth] = useState(0)
  const [resizeTooltip, setResizeTooltip] = useState<{ x: number; y: number } | null>(null)

  // Logo upload state
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const tableRef = useRef<HTMLTableElement>(null)

  // Current tab helpers
  const currentConfig = configs[activeTab]
  const currentSavedConfig = savedConfigs[activeTab]
  const currentSelectedZone = selectedZones[activeTab]
  const currentHoveredZone = hoveredZones[activeTab]
  const currentLoading = loading[activeTab]

  // Set zone helper for current tab
  const setCurrentSelectedZone = (zone: string | null) => {
    setSelectedZones(prev => ({ ...prev, [activeTab]: zone }))
  }
  const setCurrentHoveredZone = (zone: string | null) => {
    setHoveredZones(prev => ({ ...prev, [activeTab]: zone }))
  }

  // Update config helper for current tab
  const updateCurrentConfig = (updater: (prev: ReportConfig) => ReportConfig) => {
    setConfigs(prev => ({
      ...prev,
      [activeTab]: prev[activeTab] ? updater(prev[activeTab]!) : null,
    }))
  }

  // Simple nested excel config updater
  const updateExcelField = (field: string, value: unknown) => {
    updateCurrentConfig(prev => ({
      ...prev,
      excel: { ...prev.excel, [field]: value },
    }))
  }

  // Update nested excel.logo
  const updateLogoField = (field: string, value: unknown) => {
    updateCurrentConfig(prev => ({
      ...prev,
      excel: {
        ...prev.excel,
        logo: { ...(prev.excel.logo as Record<string, unknown> || {}), [field]: value },
      },
    }))
  }

  // === ALL HOOKS BEFORE CONDITIONAL RETURNS ===

  // Load configs for all tabs
  useEffect(() => {
    TAB_INFO.forEach(tab => {
      async function load() {
        try {
          const res = await fetch(`/api/config/${tab.value}`)
          const data = await res.json()
          if (data.success) {
            const c = data.data as ReportConfig
            setConfigs(prev => ({ ...prev, [tab.value]: c }))
            setSavedConfigs(prev => ({ ...prev, [tab.value]: JSON.parse(JSON.stringify(c)) }))
          }
        } catch {
          // Only show error for the active tab
          if (tab.value === activeTab) toast.error('Error al cargar configuración')
        } finally {
          setLoading(prev => ({ ...prev, [tab.value]: false }))
        }
      }
      load()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rinde-specific excel helper
  const rindeExcel = currentConfig?.excel as RindeExcelConfig | undefined
  const rindeDefaults = DEFAULT_RINDE_CONFIG.excel as unknown as RindeExcelConfig
  const rinde = rindeExcel || rindeDefaults

  const rindeColPx = (key: string) => (rinde.anchoColumnas?.[key] || 8) * EXCEL_TO_PX
  const rindeZoneFont = (zone: RindeZoneId) => {
    const z = RINDE_ZONES.find(zz => zz.id === zone)
    return z ? (rinde.fuentes as unknown as Record<string, number>)[z.fontKey] : 10
  }

  function updateRindeColumnWidth(colKey: string, width: number) {
    updateCurrentConfig(prev => ({
      ...prev,
      excel: {
        ...prev.excel,
        anchoColumnas: { ...(prev.excel.anchoColumnas as Record<string, number>), [colKey]: width },
      },
    }))
  }

  function updateRindeAlignment(section: string, colKey: string, value: string) {
    updateCurrentConfig(prev => ({
      ...prev,
      excel: {
        ...prev.excel,
        [section]: { ...(prev.excel[section] as Record<string, unknown>), [colKey]: value },
      },
    }))
  }

  function updateRindeBorde(zoneKey: string, value: boolean) {
    updateCurrentConfig(prev => ({
      ...prev,
      excel: {
        ...prev.excel,
        bordes: { ...(prev.excel.bordes as Record<string, boolean>), [zoneKey]: value },
      },
    }))
  }

  function updateRindeSeparador(key: string, value: string) {
    updateCurrentConfig(prev => ({
      ...prev,
      excel: {
        ...prev.excel,
        separadores: { ...(prev.excel.separadores as Record<string, string>), [key]: value },
      },
    }))
  }

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, colKey: string) => {
    if (activeTab !== 'rinde-tropa') return
    e.preventDefault()
    e.stopPropagation()
    const currentWidth = (rinde.anchoColumnas?.[colKey] || 8)
    setResizingCol(colKey)
    setResizeStartX(e.clientX)
    setResizeStartWidth(currentWidth)
    setCurrentResizeWidth(currentWidth)
    setResizeTooltip({ x: e.clientX, y: e.clientY })
    setCurrentSelectedZone('animalTable')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, rinde.anchoColumnas])

  useEffect(() => {
    if (!resizingCol) return
    function handleMouseMove(e: MouseEvent) {
      const delta = (e.clientX - resizeStartX) / EXCEL_TO_PX
      const newWidth = Math.max(2, Math.round((resizeStartWidth + delta) * 10) / 10)
      setCurrentResizeWidth(newWidth)
      setResizeTooltip({ x: e.clientX, y: e.clientY })
      if (resizingCol) updateRindeColumnWidth(resizingCol, newWidth)
    }
    function handleMouseUp() { setResizingCol(null); setResizeTooltip(null) }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resizingCol, resizeStartX, resizeStartWidth])

  useEffect(() => {
    if (resizingCol) { document.body.style.userSelect = 'none'; document.body.style.cursor = 'col-resize' }
    else { document.body.style.userSelect = ''; document.body.style.cursor = '' }
    return () => { document.body.style.userSelect = ''; document.body.style.cursor = '' }
  }, [resizingCol])

  // Logo upload handler
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)
      const res = await fetch('/api/config/logo-upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.success) {
        toast.success('Logo subido correctamente')
        // Update current config to use the new file
        updateLogoField('archivo', data.filename)
      } else {
        toast.error(data.error || 'Error al subir logo')
      }
    } catch {
      toast.error('Error de conexión al subir logo')
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  // === CONDITIONAL RETURNS ===

  if (operador && !operador.permisos.puedeConfiguracion) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 p-8">
            <ShieldAlert className="h-12 w-12 text-red-500" />
            <h2 className="text-lg font-semibold">Acceso denegado</h2>
            <p className="text-sm text-muted-foreground text-center">No tenés permisos para acceder al diseño de formatos.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Loading state - check current tab config
  if (currentLoading || !currentConfig) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/config/${activeTab}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentConfig),
      })
      const data = await res.json()
      if (data.success) {
        setSavedConfigs(prev => ({ ...prev, [activeTab]: JSON.parse(JSON.stringify(currentConfig)) }))
        toast.success('Configuración guardada')
      } else {
        toast.error(data.error || 'Error al guardar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  function handleRestore() {
    if (currentSavedConfig) {
      setConfigs(prev => ({ ...prev, [activeTab]: JSON.parse(JSON.stringify(currentSavedConfig)) }))
      toast.info('Configuración restaurada')
    }
  }

  // ============================================================
  // RINDE-SPECIFIC HELPERS
  // ============================================================
  const getRindeZoneBorder = (zoneId: RindeZoneId) => {
    const z = RINDE_ZONES.find(zz => zz.id === zoneId)
    if (!z) return '2px solid transparent'
    const hasBorder = rinde.bordes?.[z.bordeKey]
    return hasBorder ? '1px solid #999' : '2px solid transparent'
  }

  const getRindeSeparator = (key: string) => {
    const val = rinde.separadores?.[key]
    if (val === 'simple') return { height: '1px', background: '#666', margin: '6px 0' }
    if (val === 'doble') return { height: '3px', borderTop: '2px solid #333', borderBottom: '1px solid #333', margin: '6px 0' }
    return null
  }

  const animalAlign = (colKey: string) => (rinde.alineacionAnimales?.[colKey] || 'center') as 'left' | 'center' | 'right'
  const menAlign = (colKey: string) => (rinde.alineacionMenudencia?.[colKey] || 'center') as 'left' | 'center' | 'right'
  const resAlign = (colKey: string) => (rinde.alineacionResumen?.[colKey] || 'left') as 'left' | 'center' | 'right'

  // Simple report helpers
  const simpleLogo = getSimpleLogo(currentConfig)
  const simpleFuentes = getSimpleFuentes(currentConfig)
  const simplePagina = getSimplePagina(currentConfig)
  const simpleMargenes = getSimpleMargenes(currentConfig)
  const simpleBordes = getSimpleBordes(currentConfig)
  const simpleSeparadores = getSimpleSeparadores(currentConfig)

  const getSimpleSeparator = (key: string) => {
    const val = simpleSeparadores[key]
    if (val === 'simple') return { height: '1px', background: '#666', margin: '6px 0' }
    if (val === 'doble') return { height: '3px', borderTop: '2px solid #333', borderBottom: '1px solid #333', margin: '6px 0' }
    return null
  }

  const getSimpleZoneBorder = (zoneId: string) => {
    const hasBorder = simpleBordes[zoneId]
    return hasBorder ? '1px solid #999' : '2px solid transparent'
  }

  // ============================================================
  // PROPERTIES PANEL - LOGO SECTION (common for all tabs)
  // ============================================================
  const renderLogoSection = () => {
    const logo: { visible: boolean; posicion: string; ancho: number; alto: number; archivo: string } = activeTab === 'rinde-tropa'
      ? { visible: rinde.logo?.visible ?? false, posicion: String(rinde.logo?.posicion ?? 'arriba-izquierda'), ancho: rinde.logo?.ancho ?? 100, alto: rinde.logo?.alto ?? 50, archivo: String((rinde.logo as Record<string, unknown>)?.archivo ?? 'logo.png') }
      : simpleLogo

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" /> Logo
          </Label>
          <Switch
            checked={logo.visible}
            onCheckedChange={(v) => {
              if (activeTab === 'rinde-tropa') {
                updateCurrentConfig(prev => ({
                  ...prev,
                  excel: { ...prev.excel, logo: { ...(prev.excel.logo as Record<string, unknown> || {}), visible: v } },
                }))
              } else {
                updateLogoField('visible', v)
              }
            }}
          />
        </div>

        <div className="mt-2">
          <input ref={logoInputRef} type="file" accept=".png,.jpg,.jpeg,.svg" className="hidden" onChange={handleLogoUpload} />
          <Button variant="outline" size="sm" className="w-full text-xs" disabled={uploadingLogo}
            onClick={() => logoInputRef.current?.click()}>
            {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
            Subir Logo
          </Button>
        </div>

        {logo.visible && (
          <>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">Archivo</Label>
              <Select
                value={logo.archivo}
                onValueChange={(v) => {
                  if (activeTab === 'rinde-tropa') {
                    updateCurrentConfig(prev => ({
                      ...prev,
                      excel: { ...prev.excel, logo: { ...(prev.excel.logo as Record<string, unknown> || {}), archivo: v } },
                    }))
                  } else {
                    updateLogoField('archivo', v)
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOGO_FILES.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">Posición</Label>
              <Select
                value={logo.posicion}
                onValueChange={(v) => {
                  if (activeTab === 'rinde-tropa') {
                    updateCurrentConfig(prev => ({
                      ...prev,
                      excel: { ...prev.excel, logo: { ...(prev.excel.logo as Record<string, unknown> || {}), posicion: v } },
                    }))
                  } else {
                    updateLogoField('posicion', v)
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="arriba-izquierda">Arriba Izquierda</SelectItem>
                  <SelectItem value="arriba-derecha">Arriba Derecha</SelectItem>
                  <SelectItem value="centro">Centro</SelectItem>
                  <SelectItem value="izquierda">Izquierda</SelectItem>
                  <SelectItem value="derecha">Derecha</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Ancho (px)</Label>
                <Input type="number" min={10} max={500} value={logo.ancho}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || 80
                    if (activeTab === 'rinde-tropa') {
                      updateCurrentConfig(prev => ({
                        ...prev,
                        excel: { ...prev.excel, logo: { ...(prev.excel.logo as Record<string, unknown> || {}), ancho: v } },
                      }))
                    } else {
                      updateLogoField('ancho', v)
                    }
                  }}
                  className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Alto (px)</Label>
                <Input type="number" min={10} max={500} value={logo.alto}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || 40
                    if (activeTab === 'rinde-tropa') {
                      updateCurrentConfig(prev => ({
                        ...prev,
                        excel: { ...prev.excel, logo: { ...(prev.excel.logo as Record<string, unknown> || {}), alto: v } },
                      }))
                    } else {
                      updateLogoField('alto', v)
                    }
                  }}
                  className="h-8 text-xs" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground">Vista previa</Label>
              <div className="rounded border bg-gray-50 p-2 flex items-center justify-center" style={{ minHeight: '60px' }}>
                <img
                  src={`/${logo.archivo}`}
                  alt="Logo"
                  style={{ maxWidth: logo.ancho, maxHeight: logo.alto, objectFit: 'contain' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </div>
            </div>

          </>
        )}
      </div>
    )
  }

  // ============================================================
  // PROPERTIES PANEL RENDER
  // ============================================================

  // Helper: get zone list for current tab
  const getCurrentZoneList = () => {
    if (activeTab === 'rinde-tropa') return RINDE_ZONES.map(z => ({ id: z.id, label: z.label, icon: z.icon }))
    if (activeTab === 'planilla-01') return PLANILLA_ZONES
    return STOCK_ZONES
  }

  // Helper: render zone-specific properties for Planilla/Stock (font, borders, separators)
  const renderSimpleZoneProps = () => {
    if (activeTab === 'rinde-tropa' || !currentSelectedZone) return null

    const zones = activeTab === 'planilla-01' ? PLANILLA_ZONES : STOCK_ZONES
    const zoneMeta = zones.find(z => z.id === currentSelectedZone)
    if (!zoneMeta) return null

    // Determine font key for this zone
    const fontKey = currentSelectedZone === 'header' ? 'tamanoTitulo' : 'tamanoDatos'
    const fontLabel = currentSelectedZone === 'header' ? 'Tamaño título (px)' : 'Tamaño datos (px)'

    return (
      <>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">{zoneMeta.icon}</span>
          <h3 className="text-sm font-semibold">{zoneMeta.label}</h3>
          <button
            className="ml-auto p-1 rounded hover:bg-gray-100 transition-colors text-muted-foreground hover:text-foreground"
            title="Deseleccionar"
            onClick={() => setCurrentSelectedZone(null)}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Font family */}
        <div className="space-y-1.5 mb-3">
          <Label className="text-xs font-medium">Fuente</Label>
          <Select
            value={String(simpleFuentes.familia || 'Arial')}
            onValueChange={(v) => updateExcelField('fuentes', { ...simpleFuentes, familia: v })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Font size for this zone */}
        <div className="space-y-1 mb-3">
          <Label className="text-[10px] text-muted-foreground">{fontLabel}</Label>
          <Input type="number" min={6} max={24}
            value={(simpleFuentes[fontKey] as number) || (currentSelectedZone === 'header' ? 14 : 10)}
            onChange={(e) => {
              const v = parseInt(e.target.value) || (currentSelectedZone === 'header' ? 14 : 10)
              updateExcelField('fuentes', { ...simpleFuentes, [fontKey]: v })
            }}
            className="h-8 text-xs" />
        </div>

        <Separator className="my-3" />

        {/* Borders */}
        <div className="space-y-2 mb-4">
          <Label className="text-xs font-medium">Bordes</Label>
          <div className="flex items-center gap-2">
            <Switch checked={!!simpleBordes[currentSelectedZone]}
              onCheckedChange={(v) => updateExcelField('bordes', { ...simpleBordes, [currentSelectedZone]: v })} />
            <span className="text-xs text-muted-foreground">Mostrar borde</span>
          </div>
        </div>

        {/* Separators for header */}
        {currentSelectedZone === 'header' && (
          <>
            <Separator className="my-3" />
            <div className="space-y-2">
              <Label className="text-xs font-medium">Separadores</Label>
              {Object.entries(simpleSeparadores).length > 0 && Object.entries(simpleSeparadores).map(([key, val]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</Label>
                  <Select value={val || 'ninguno'} onValueChange={(v) => updateExcelField('separadores', { ...simpleSeparadores, [key]: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ninguno">Ninguno</SelectItem>
                      <SelectItem value="simple">Simple</SelectItem>
                      <SelectItem value="doble">Doble</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </>
        )}
      </>
    )
  }

  const renderPropertiesPanel = () => {
    return (
      <>
        {/* Logo section - ALWAYS at top */}
        {renderLogoSection()}

        <Separator className="my-4" />

        {/* Zone-specific properties OR no-selection help */}
        {activeTab === 'rinde-tropa' && currentSelectedZone && (
          <RenderRindeZoneProps />
        )}

        {(activeTab === 'planilla-01' || activeTab === 'stock-corrales') && currentSelectedZone && (
          renderSimpleZoneProps()
        )}

        {!currentSelectedZone && (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <MousePointerClick className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground mb-1">Sin selección</p>
            <p className="text-xs text-muted-foreground">Hacé click en una sección para editar sus propiedades</p>

            {/* Sections List */}
            <div className="mt-4 w-full space-y-1">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-2">Secciones editables</p>
              {getCurrentZoneList().map(z => (
                <button key={z.id} className="flex items-center gap-2 w-full px-3 py-2 text-xs rounded-md hover:bg-gray-100 transition-colors text-left"
                  onClick={() => setCurrentSelectedZone(z.id)}>
                  <span>{z.icon}</span><span>{z.label}</span>
                  <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}
      </>
    )
  }

  // Rinde zone properties (extracted from main panel)
  const RenderRindeZoneProps = () => {
    if (!currentSelectedZone || activeTab !== 'rinde-tropa') return null
    const zoneMeta = RINDE_ZONES.find(z => z.id === currentSelectedZone)

    return (
      <>
        {/* Zone Header */}
        <div className="flex items-center gap-2 mb-4">
          {zoneMeta && <span className="text-lg">{zoneMeta.icon}</span>}
          <h3 className="text-sm font-semibold">{zoneMeta?.label || currentSelectedZone}</h3>
          <button
            className="ml-auto p-1 rounded hover:bg-gray-100 transition-colors text-muted-foreground hover:text-foreground"
            title="Deseleccionar"
            onClick={() => setCurrentSelectedZone(null)}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Font section */}
        {zoneMeta && (
          <div className="space-y-3 mb-4">
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Fuente</Label>
              <Select
                value={String((rinde.fuentes as Record<string, unknown>).familia || 'Calibri')}
                onValueChange={(v) => updateCurrentConfig(prev => ({
                  ...prev,
                  excel: { ...prev.excel, fuentes: { ...(prev.excel.fuentes as Record<string, unknown>), familia: v } },
                }))}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Tamaño de fuente (px)</Label>
              <Input type="number" min={6} max={24}
                value={(rinde.fuentes as unknown as Record<string, number>)[zoneMeta.fontKey] || 10}
                onChange={(e) => {
                  const v = parseInt(e.target.value) || 10
                  updateCurrentConfig(prev => ({
                    ...prev,
                    excel: { ...prev.excel, fuentes: { ...(prev.excel.fuentes as Record<string, unknown>), [zoneMeta.fontKey]: v } },
                  }))
                }}
                className="h-8 text-xs" />
            </div>
          </div>
        )}

        <Separator className="my-3" />

        {/* Borders */}
        {zoneMeta && (
          <div className="space-y-2 mb-4">
            <Label className="text-xs font-medium">Bordes</Label>
            <div className="flex items-center gap-2">
              <Switch checked={!!rinde.bordes?.[zoneMeta.bordeKey]}
                onCheckedChange={(v) => updateRindeBorde(zoneMeta.bordeKey, v)} />
              <span className="text-xs text-muted-foreground">Mostrar borde</span>
            </div>
          </div>
        )}

        {/* Separators */}
        {zoneMeta?.separadorKey && (
          <div className="space-y-2 mb-4">
            <Label className="text-xs font-medium">Separador</Label>
            <Select
              value={rinde.separadores?.[zoneMeta.separadorKey] || 'ninguno'}
              onValueChange={(v) => updateRindeSeparador(zoneMeta.separadorKey!, v)}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ninguno">Ninguno</SelectItem>
                <SelectItem value="simple">Simple</SelectItem>
                <SelectItem value="doble">Doble</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Animal Table specific: column alignment */}
        {currentSelectedZone === 'animalTable' && (
          <>
            <Separator className="my-3" />
            <Label className="text-xs font-medium mb-2 block">Alineación de columnas</Label>
            <div className="space-y-2">
              {ANIMAL_COL_KEYS.map(k => (
                <AlignmentPicker key={k} label={RINDE_COLUMN_MAP[k].label} value={animalAlign(k)}
                  onChange={(v) => updateRindeAlignment('alineacionAnimales', k, v)} />
              ))}
            </div>
          </>
        )}

        {/* Menudencia specific */}
        {currentSelectedZone === 'menudencia' && (
          <>
            <Separator className="my-3" />
            <Label className="text-xs font-medium mb-2 block">Alineación de columnas</Label>
            <div className="space-y-2">
              {MENUDENCIA_COL_KEYS.map(k => (
                <AlignmentPicker key={k} label={MENUDENCIA_COL_MAP[k].label} value={menAlign(k)}
                  onChange={(v) => updateRindeAlignment('alineacionMenudencia', k, v)} />
              ))}
            </div>
          </>
        )}

        {/* Summary specific */}
        {currentSelectedZone === 'summary' && (
          <>
            <Separator className="my-3" />
            <Label className="text-xs font-medium mb-2 block">Alineación de resumen</Label>
            <div className="space-y-2">
              {Object.keys(RESUMEN_COL_MAP).map(k => (
                <AlignmentPicker key={k} label={RESUMEN_COL_MAP[k].label} value={resAlign(k)}
                  onChange={(v) => updateRindeAlignment('alineacionResumen', k, v)} />
              ))}
            </div>
          </>
        )}

        {/* Spacing for menudencia */}
        {currentSelectedZone === 'menudencia' && (
          <>
            <Separator className="my-3" />
            <div className="space-y-2">
              <Label className="text-xs font-medium">Espacio antes de Menudencia</Label>
              <Input type="number" min={0} max={20} value={rinde.separacion?.filasAntesMenudencia ?? 4}
                onChange={(e) => updateCurrentConfig(prev => ({
                  ...prev,
                  excel: { ...prev.excel, separacion: { filasAntesMenudencia: parseInt(e.target.value) || 4 } },
                }))}
                className="h-8 text-xs" />
            </div>
          </>
        )}
      </>
    )
  }

  // ============================================================
  // CANVAS RENDERERS
  // ============================================================

  // Helper to render logo on canvas (tries actual image, falls back to placeholder)
  const CanvasLogoImage = ({ archivo, ancho, alto }: { archivo: string; ancho: number; alto: number }) => {
    const [imgError, setImgError] = useState(false)

    if (imgError) {
      return (
        <div className="flex flex-col items-center gap-1 text-[10px] text-gray-400">
          <ImageIcon className="h-6 w-6" />
          <span>Logo</span>
        </div>
      )
    }

    return (
      <img
        src={`/${archivo}`}
        alt="Logo"
        style={{ maxWidth: ancho, maxHeight: alto, objectFit: 'contain' }}
        onError={() => setImgError(true)}
      />
    )
  }

  const renderCanvasLogo = (logo: { visible: boolean; posicion: string; ancho: number; alto: number; archivo?: string }) => {
    if (!logo.visible) return null
    return (
      <div
        className="mb-2 flex items-center justify-center rounded border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden"
        style={{
          width: `${logo.ancho}px`,
          height: `${logo.alto}px`,
          marginLeft: logo.posicion === 'arriba-izquierda' || logo.posicion === 'izquierda' ? '0' : 'auto',
          marginRight: logo.posicion === 'arriba-derecha' || logo.posicion === 'derecha' ? '0' : 'auto',
          alignSelf: logo.posicion === 'centro' ? 'center' : undefined,
        }}
      >
        <CanvasLogoImage archivo={logo.archivo || 'logo.png'} ancho={logo.ancho} alto={logo.alto} />
      </div>
    )
  }

  // Page wrapper for canvas
  const CanvasPage = ({ children }: { children: React.ReactNode }) => {
    const orientacion = simplePagina.orientacion as string || 'landscape'
    const familia = activeTab === 'rinde-tropa' ? String((rinde.fuentes as Record<string, unknown>).familia || 'Calibri')
      : String(simpleFuentes.familia || 'Arial')
    const margenes = activeTab === 'rinde-tropa'
      ? rinde.margenes
      : simpleMargenes

    return (
      <div
        className="mx-auto bg-white shadow-lg border rounded"
        style={{
          width: orientacion === 'landscape' ? '1056px' : '756px',
          minWidth: orientacion === 'landscape' ? '1056px' : '756px',
          padding: `${(margenes.superior || 0.3) * 40}px ${(margenes.derecho || 0.4) * 40}px ${(margenes.inferior || 0.3) * 40}px ${(margenes.izquierdo || 0.4) * 40}px`,
          fontFamily: familia,
          fontSize: '10px',
        }}
      >
        {children}
      </div>
    )
  }

  // ============================================================
  // RINDE POR TROPA CANVAS
  // ============================================================
  const renderRindeCanvas = () => (
    <CanvasPage>
      {renderCanvasLogo({ visible: rinde.logo?.visible ?? false, posicion: rinde.logo?.posicion ?? 'arriba-izquierda', ancho: rinde.logo?.ancho ?? 100, alto: rinde.logo?.alto ?? 50 })}

      {/* Zone: Header */}
      <ZoneWrapper
        selected={currentSelectedZone === 'header'} hovered={currentHoveredZone === 'header'}
        zoneId="header" icon="📝" label="Encabezado"
        customBorder={currentSelectedZone === 'header' ? '2px solid #2563eb' : getRindeZoneBorder('header')}
        onClick={(e) => { e.stopPropagation(); setCurrentSelectedZone('header') }}
        onMouseEnter={() => setCurrentHoveredZone('header')}
        onMouseLeave={() => setCurrentHoveredZone(null)}
      >
        <div style={{ fontSize: `${rindeZoneFont('header')}px`, marginBottom: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
            <tr>
              <td colSpan={4} style={{ fontWeight: 'bold', fontSize: '13px', borderBottom: '2px solid #333', paddingBottom: '2px' }}>RINDE POR TROPA</td>
              <td colSpan={2} style={{ textAlign: 'right' }}><div style={{ border: '1px solid #000', padding: '2px 8px', fontWeight: 'bold' }}>RINDE</div></td>
            </tr>
            <tr style={{ fontSize: '11px' }}>
              <td colSpan={2}>Estab. Faenador: <strong>Solemar Alimentaria S.A.</strong></td>
              <td colSpan={2} rowSpan={2} style={{ textAlign: 'center', verticalAlign: 'middle', border: '1px solid #ccc', background: '#f9f9f9' }}><div style={{ fontWeight: 'bold', fontSize: '18px', color: '#1a1a1a' }}>RINDE</div></td>
              <td colSpan={2} style={{ textAlign: 'center' }}><div style={{ border: '1px solid #000', padding: '2px 8px' }}>PROM.</div></td>
            </tr>
            <tr style={{ fontSize: '11px' }}>
              <td>Matrícula: <strong>300</strong></td><td></td>
              <td colSpan={2} style={{ textAlign: 'center' }}><div style={{ border: '1px solid #000', padding: '2px 8px' }}></div></td>
            </tr>
            <tr style={{ fontSize: '11px' }}>
              <td>N° SENASA: <strong>3986</strong></td><td></td><td colSpan={4}></td>
            </tr>
          </tbody></table>
        </div>
      </ZoneWrapper>

      {getRindeSeparator('despuesEncabezado') && <div style={getRindeSeparator('despuesEncabezado')!} />}
      <div style={{ height: '24px' }} />

      {/* Zone: Operator Info */}
      <ZoneWrapper
        selected={currentSelectedZone === 'operator'} hovered={currentHoveredZone === 'operator'}
        zoneId="operator" icon="👤" label="Info Operador"
        customBorder={currentSelectedZone === 'operator' ? '2px solid #2563eb' : getRindeZoneBorder('operator')}
        onClick={(e) => { e.stopPropagation(); setCurrentSelectedZone('operator') }}
        onMouseEnter={() => setCurrentHoveredZone('operator')}
        onMouseLeave={() => setCurrentHoveredZone(null)}
      >
        <div style={{ fontSize: `${rindeZoneFont('operator')}px`, marginBottom: '4px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
            <tr><td colSpan={2} style={{ fontWeight: 'bold' }}>Usuario/Matarife:</td><td colSpan={3}>Juan Pérez</td><td style={{ fontWeight: 'bold' }}>Productor:</td><td>Ganadera del Sur S.R.L.</td></tr>
            <tr><td colSpan={2} style={{ fontWeight: 'bold' }}>Matrícula:</td><td colSpan={3}>12345</td><td style={{ fontWeight: 'bold' }}>N° DTE:</td><td>001-12345678-9</td></tr>
            <tr><td></td><td></td><td></td><td style={{ fontWeight: 'bold' }}>N° Guia:</td><td colSpan={3}>0001-00234567</td></tr>
            <tr><td colSpan={5}></td><td style={{ fontWeight: 'bold' }}>Fecha Ing.:</td><td>27/05/2026</td></tr>
            <tr><td colSpan={5}></td><td style={{ fontWeight: 'bold' }}>Hora:</td><td>14:30</td></tr>
          </tbody></table>
        </div>
      </ZoneWrapper>

      {getRindeSeparator('despuesInfoOperador') && <div style={getRindeSeparator('despuesInfoOperador')!} />}
      <div style={{ height: '16px' }} />

      {/* Zone: Summary */}
      <ZoneWrapper
        selected={currentSelectedZone === 'summary'} hovered={currentHoveredZone === 'summary'}
        zoneId="summary" icon="📊" label="Resumen"
        customBorder={currentSelectedZone === 'summary' ? '2px solid #2563eb' : getRindeZoneBorder('summary')}
        onClick={(e) => { e.stopPropagation(); setCurrentSelectedZone('summary') }}
        onMouseEnter={() => setCurrentHoveredZone('summary')}
        onMouseLeave={() => setCurrentHoveredZone(null)}
      >
        <div style={{ fontSize: `${rindeZoneFont('summary')}px` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
            <tr>
              <td colSpan={6} style={{ fontWeight: 'bold', fontSize: '12px', textAlign: resAlign('labels') }}>Fecha Faena: <span style={{ color: 'red' }}>27/05/2026</span></td>
              <td style={{ fontWeight: 'bold', textAlign: resAlign('cuartos') }}>Cuartos</td>
              <td style={{ fontWeight: 'bold', textAlign: resAlign('kgTipos') }}>Kg</td>
            </tr>
            <tr style={{ background: '#e0e0e0', fontWeight: 'bold' }}>
              <td style={{ textAlign: resAlign('labels') }}>N° Tropa</td>
              <td style={{ textAlign: resAlign('values') }}>Cabezas</td>
              <td style={{ textAlign: resAlign('values') }}>Kg Vivo</td>
              <td style={{ textAlign: resAlign('values') }}>Kg 1/2</td>
              <td style={{ textAlign: resAlign('values') }}>Rinde</td>
              <td style={{ textAlign: resAlign('values') }}>Promedio</td>
              <td style={{ textAlign: resAlign('cuartos') }}>VQ</td>
              <td style={{ textAlign: resAlign('kgTipos') }}>NT</td>
            </tr>
            <tr>
              <td style={{ textAlign: resAlign('values') }}>001</td>
              <td style={{ textAlign: resAlign('values') }}>3</td>
              <td style={{ textAlign: resAlign('values') }}>1,225</td>
              <td style={{ textAlign: resAlign('values') }}>633.6</td>
              <td style={{ textAlign: resAlign('values') }}>51.71%</td>
              <td style={{ textAlign: resAlign('values') }}>51.73%</td>
              <td style={{ textAlign: resAlign('cuartos') }}>2</td>
              <td style={{ textAlign: resAlign('kgTipos') }}>1</td>
            </tr>
            <tr style={{ background: '#f0f0f0', fontWeight: 'bold' }}>
              <td colSpan={2} style={{ textAlign: resAlign('values') }}>TOTALES</td>
              <td style={{ textAlign: resAlign('values') }}>1,225</td>
              <td style={{ textAlign: resAlign('values') }}>633.6</td>
              <td></td><td></td>
              <td style={{ textAlign: resAlign('cuartos') }}>2</td>
              <td style={{ textAlign: resAlign('kgTipos') }}>1</td>
            </tr>
          </tbody></table>
        </div>
      </ZoneWrapper>

      {getRindeSeparator('despuesResumen') && <div style={getRindeSeparator('despuesResumen')!} />}
      <div style={{ height: '16px' }} />

      {/* Zone: Animal Table */}
      <ZoneWrapper
        selected={currentSelectedZone === 'animalTable'} hovered={currentHoveredZone === 'animalTable'}
        zoneId="animalTable" icon="🐄" label="Tabla Animales" resizeHint="← Arrastrá bordes →"
        customBorder={currentSelectedZone === 'animalTable' ? '2px solid #2563eb' : getRindeZoneBorder('animalTable')}
        onClick={(e) => { e.stopPropagation(); setCurrentSelectedZone('animalTable') }}
        onMouseEnter={() => setCurrentHoveredZone('animalTable')}
        onMouseLeave={() => setCurrentHoveredZone(null)}
      >
        <div style={{ fontSize: `${rindeZoneFont('animalTable')}px`, overflowX: 'auto' }}>
          <table ref={tableRef} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: '#d9d9d9', fontWeight: 'bold' }}>
                {ANIMAL_COL_KEYS.map(k => {
                  const w = resizingCol === k ? currentResizeWidth * EXCEL_TO_PX : rindeColPx(k)
                  const isHov = hoveredHandle === k
                  const isRes = resizingCol === k
                  return (
                    <th key={k} className="relative select-none"
                      style={{
                        width: `${w}px`, border: '1px solid #999', padding: '3px 2px',
                        textAlign: 'center', fontSize: '9px',
                        background: isRes ? '#bfdbfe' : isHov ? '#e0edff' : '#d9d9d9',
                        transition: 'background 0.1s',
                      }}>
                      <span className="truncate block">{RINDE_COLUMN_MAP[k].label}</span>
                      <ColResizeHandle
                        isResizing={isRes} isHovered={isHov}
                        onMouseDown={(e) => handleResizeMouseDown(e, k)}
                        onMouseEnter={() => setHoveredHandle(k)}
                        onMouseLeave={() => setHoveredHandle(null)}
                      />
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {ANIMAL_DATA.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #ccc' }}>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: animalAlign('C_garron') }}>{row.garron}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: animalAlign('D_animal') }}>{row.animal}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: animalAlign('E_raza') }}>{row.raza}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: animalAlign('F_G_clasif') }}>{row.clasif}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: animalAlign('H_caravana') }}>{row.caravana}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: animalAlign('I_kgEntrada') }}>{row.kgEntrada.toLocaleString()}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: animalAlign('J_mediaA') }}>{row.mediaA.toFixed(1)}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: animalAlign('K_mediaB') }}>{row.mediaB.toFixed(1)}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: animalAlign('L_totalKg') }}>{row.totalKg.toFixed(1)}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: animalAlign('M_rinde') }}>{row.rinde}</td>
                </tr>
              ))}
              <tr style={{ background: '#f0f0f0', fontWeight: 'bold' }}>
                <td style={{ border: '1px solid #ccc', padding: '2px 4px', textAlign: animalAlign('C_garron') }} colSpan={2}>TOTALES</td>
                <td style={{ border: '1px solid #ccc', padding: '2px 4px' }} colSpan={3}></td>
                <td style={{ border: '1px solid #ccc', padding: '2px 4px', textAlign: animalAlign('I_kgEntrada') }}>1,225</td>
                <td style={{ border: '1px solid #ccc', padding: '2px 4px', textAlign: animalAlign('J_mediaA') }}>315.4</td>
                <td style={{ border: '1px solid #ccc', padding: '2px 4px', textAlign: animalAlign('K_mediaB') }}>318.2</td>
                <td style={{ border: '1px solid #ccc', padding: '2px 4px', textAlign: animalAlign('L_totalKg') }}>633.6</td>
                <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </ZoneWrapper>

      {getRindeSeparator('antesMenudencia') && <div style={getRindeSeparator('antesMenudencia')!} />}
      <div style={{ height: `${(rinde.separacion?.filasAntesMenudencia ?? 4) * 20}px` }} />

      {/* Zone: Menudencia */}
      <ZoneWrapper
        selected={currentSelectedZone === 'menudencia'} hovered={currentHoveredZone === 'menudencia'}
        zoneId="menudencia" icon="🫀" label="Menudencia"
        customBorder={currentSelectedZone === 'menudencia' ? '2px solid #2563eb' : getRindeZoneBorder('menudencia')}
        onClick={(e) => { e.stopPropagation(); setCurrentSelectedZone('menudencia') }}
        onMouseEnter={() => setCurrentHoveredZone('menudencia')}
        onMouseLeave={() => setCurrentHoveredZone(null)}
      >
        <div style={{ fontSize: `${rindeZoneFont('menudencia')}px` }}>
          <table style={{ width: '60%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#d9d9d9', fontWeight: 'bold' }}>
                <th colSpan={5} style={{ border: '1px solid #999', padding: '4px 6px', textAlign: 'center' }}>MENUDENCIA</th>
              </tr>
              <tr style={{ background: '#d9d9d9', fontWeight: 'bold' }}>
                {MENUDENCIA_COL_KEYS.map(k => (
                  <th key={k} style={{ border: '1px solid #999', padding: '3px 4px', textAlign: 'center' }}>
                    {MENUDENCIA_COL_MAP[k].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MENUDENCIA_DATA.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #ccc' }}>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', fontWeight: 'bold', textAlign: menAlign('tipo') }}>{row.tipo}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: menAlign('cantidades') }}>{row.cant}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: menAlign('kg') }}>{row.kg.toFixed(1)}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: menAlign('unidad') }}>{row.unidad}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: menAlign('kgDec') }}>{row.kgDec != null ? row.kgDec.toFixed(1) : '-'}</td>
                </tr>
              ))}
              <tr style={{ background: '#f0f0f0', fontWeight: 'bold' }}>
                <td style={{ border: '1px solid #ccc', padding: '2px 4px', textAlign: menAlign('tipo') }}>TOTALES</td>
                <td style={{ border: '1px solid #ccc', padding: '2px 4px', textAlign: menAlign('cantidades') }}>12</td>
                <td style={{ border: '1px solid #ccc', padding: '2px 4px', textAlign: menAlign('kg') }}>73.0</td>
                <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}></td>
                <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </ZoneWrapper>
    </CanvasPage>
  )

  // ============================================================
  // PLANILLA 01 CANVAS
  // ============================================================
  const renderPlanillaCanvas = () => (
    <CanvasPage>
      {renderCanvasLogo(simpleLogo)}

      {/* Zone: Header */}
      <ZoneWrapper
        selected={currentSelectedZone === 'header'} hovered={currentHoveredZone === 'header'}
        zoneId="header" icon="📝" label="Encabezado"
        customBorder={currentSelectedZone === 'header' ? '2px solid #2563eb' : getSimpleZoneBorder('header')}
        onClick={(e) => { e.stopPropagation(); setCurrentSelectedZone('header') }}
        onMouseEnter={() => setCurrentHoveredZone('header')}
        onMouseLeave={() => setCurrentHoveredZone(null)}
      >
        <div style={{ fontSize: `${(simpleFuentes.tamanoTitulo as number) || 14}px`, marginBottom: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
            <tr>
              <td colSpan={4} style={{ fontWeight: 'bold', fontSize: '16px', borderBottom: '2px solid #333', paddingBottom: '2px' }}>PLANILLA 01 - BOVINO</td>
            </tr>
            <tr style={{ fontSize: '11px' }}>
              <td colSpan={2}>Productor: <strong>Ganadera del Sur S.R.L.</strong></td>
              <td colSpan={2}>Tropa: <strong>001</strong></td>
            </tr>
            <tr style={{ fontSize: '11px' }}>
              <td>Corral: <strong>C01</strong></td>
              <td>DTE: <strong>001-12345678-9</strong></td>
              <td>Guía: <strong>0001-00234567</strong></td>
              <td style={{ textAlign: 'right' }}>Fecha: <strong>27/05/2026</strong></td>
            </tr>
          </tbody></table>
        </div>
      </ZoneWrapper>

      {getSimpleSeparator('despuesEncabezado') && <div style={getSimpleSeparator('despuesEncabezado')!} />}
      <div style={{ height: '16px' }} />

      {/* Zone: Data Table */}
      <ZoneWrapper
        selected={currentSelectedZone === 'dataTable'} hovered={currentHoveredZone === 'dataTable'}
        zoneId="dataTable" icon="📋" label="Tabla Datos"
        customBorder={currentSelectedZone === 'dataTable' ? '2px solid #2563eb' : getSimpleZoneBorder('dataTable')}
        onClick={(e) => { e.stopPropagation(); setCurrentSelectedZone('dataTable') }}
        onMouseEnter={() => setCurrentHoveredZone('dataTable')}
        onMouseLeave={() => setCurrentHoveredZone(null)}
      >
        <div style={{ fontSize: `${(simpleFuentes.tamanoDatos as number) || 9}px` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#d9d9d9', fontWeight: 'bold' }}>
                {PLANILLA_COLUMNS.map(col => (
                  <th key={col.key} style={{ border: '1px solid #999', padding: '4px 6px', textAlign: 'center', fontSize: '9px' }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLANILLA_DATA.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #ccc' }}>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'center' }}>{row.num}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'center' }}>{row.caravana}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px' }}>{row.tipo}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px' }}>{row.raza}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'right' }}>{row.peso}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'center' }}>{row.corral}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px' }}>{row.obs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ZoneWrapper>

      {getSimpleSeparator('despuesDatos') && <div style={getSimpleSeparator('despuesDatos')!} />}
      <div style={{ height: '16px' }} />

      {/* Zone: Totals */}
      <ZoneWrapper
        selected={currentSelectedZone === 'totals'} hovered={currentHoveredZone === 'totals'}
        zoneId="totals" icon="📊" label="Totales"
        customBorder={currentSelectedZone === 'totals' ? '2px solid #2563eb' : getSimpleZoneBorder('totals')}
        onClick={(e) => { e.stopPropagation(); setCurrentSelectedZone('totals') }}
        onMouseEnter={() => setCurrentHoveredZone('totals')}
        onMouseLeave={() => setCurrentHoveredZone(null)}
      >
        <div style={{ fontSize: `${(simpleFuentes.tamanoDatos as number) || 9}px` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ background: '#f0f0f0', fontWeight: 'bold' }}>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px' }}>Total Animales:</td>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px', textAlign: 'center' }}>3</td>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px' }}>Peso Total:</td>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px', textAlign: 'right' }}>1,250 kg</td>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px' }}>Peso Promedio:</td>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px', textAlign: 'right' }}>416.7 kg</td>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px' }}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </ZoneWrapper>
    </CanvasPage>
  )

  // ============================================================
  // STOCK CORRALES CANVAS
  // ============================================================
  const renderStockCanvas = () => (
    <CanvasPage>
      {renderCanvasLogo(simpleLogo)}

      {/* Zone: Header */}
      <ZoneWrapper
        selected={currentSelectedZone === 'header'} hovered={currentHoveredZone === 'header'}
        zoneId="header" icon="📝" label="Encabezado"
        customBorder={currentSelectedZone === 'header' ? '2px solid #2563eb' : getSimpleZoneBorder('header')}
        onClick={(e) => { e.stopPropagation(); setCurrentSelectedZone('header') }}
        onMouseEnter={() => setCurrentHoveredZone('header')}
        onMouseLeave={() => setCurrentHoveredZone(null)}
      >
        <div style={{ fontSize: `${(simpleFuentes.tamanoTitulo as number) || 12}px`, marginBottom: '8px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>
            <tr>
              <td colSpan={4} style={{ fontWeight: 'bold', fontSize: '14px', borderBottom: '2px solid #333', paddingBottom: '2px' }}>Planilla de Existencia, Movimiento y Autorización</td>
            </tr>
            <tr style={{ fontSize: '11px' }}>
              <td>Especie: <strong>Bovino</strong></td>
              <td>Establecimiento: <strong>Solemar Alimentaria S.A.</strong></td>
              <td>RENSPA: <strong>12.345.6.78901/12</strong></td>
              <td style={{ textAlign: 'right' }}>Fecha: <strong>27/05/2026</strong></td>
            </tr>
          </tbody></table>
        </div>
      </ZoneWrapper>

      {getSimpleSeparator('despuesEncabezado') && <div style={getSimpleSeparator('despuesEncabezado')!} />}
      <div style={{ height: '16px' }} />

      {/* Zone: Data Table */}
      <ZoneWrapper
        selected={currentSelectedZone === 'dataTable'} hovered={currentHoveredZone === 'dataTable'}
        zoneId="dataTable" icon="📋" label="Tabla Datos"
        customBorder={currentSelectedZone === 'dataTable' ? '2px solid #2563eb' : getSimpleZoneBorder('dataTable')}
        onClick={(e) => { e.stopPropagation(); setCurrentSelectedZone('dataTable') }}
        onMouseEnter={() => setCurrentHoveredZone('dataTable')}
        onMouseLeave={() => setCurrentHoveredZone(null)}
      >
        <div style={{ fontSize: `${(simpleFuentes.tamanoDatos as number) || 9}px`, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#d9d9d9', fontWeight: 'bold', fontSize: '8px' }}>
                {STOCK_COLUMNS.map(col => (
                  <th key={col.key} style={{ border: '1px solid #999', padding: '3px 5px', textAlign: 'center' }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STOCK_DATA.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #ccc' }}>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'center', fontSize: '8px' }}>{row.fecha}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'center', fontSize: '8px' }}>{row.hora}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'center' }}>{row.corral}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'center' }}>{row.tropa}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', fontSize: '8px' }}>{row.guia}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', fontSize: '8px' }}>{row.dte}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px' }}>{row.ue}</td>
                  <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'center', fontWeight: 'bold' }}>{row.cant}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ZoneWrapper>

      <div style={{ height: '16px' }} />

      {/* Zone: Totals */}
      <ZoneWrapper
        selected={currentSelectedZone === 'totals'} hovered={currentHoveredZone === 'totals'}
        zoneId="totals" icon="📊" label="Totales"
        customBorder={currentSelectedZone === 'totals' ? '2px solid #2563eb' : getSimpleZoneBorder('totals')}
        onClick={(e) => { e.stopPropagation(); setCurrentSelectedZone('totals') }}
        onMouseEnter={() => setCurrentHoveredZone('totals')}
        onMouseLeave={() => setCurrentHoveredZone(null)}
      >
        <div style={{ fontSize: `${(simpleFuentes.tamanoDatos as number) || 9}px` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ background: '#f0f0f0', fontWeight: 'bold' }}>
                <td colSpan={7} style={{ border: '1px solid #ccc', padding: '3px 6px' }}>TOTAL ANIMALES:</td>
                <td style={{ border: '1px solid #ccc', padding: '3px 6px', textAlign: 'center' }}>27</td>
              </tr>
            </tbody>
          </table>
        </div>
      </ZoneWrapper>
    </CanvasPage>
  )

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="flex flex-col h-full">
      {/* Global resize tooltip */}
      {resizingCol && resizeTooltip && (
        <div className="fixed z-[9999] pointer-events-none" style={{ left: resizeTooltip.x + 16, top: resizeTooltip.y - 12 }}>
          <div className="bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded-lg shadow-xl flex items-center gap-2 font-mono">
            <MoveHorizontal className="h-3 w-3" />
            <span>{currentResizeWidth.toFixed(1)} und</span>
            <span className="text-gray-400">({Math.round(currentResizeWidth * EXCEL_TO_PX)}px)</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white shrink-0">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold">Formato de Reportes</h1>
            <p className="text-xs text-muted-foreground">Diseño visual de formatos de exportación</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRestore} disabled={!currentSavedConfig}>
            <RotateCcw className="h-4 w-4 mr-1.5" />Restaurar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            Guardar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReportTab)} className="flex flex-col flex-1 min-h-0">
        <div className="px-4 pt-2 bg-white border-b">
          <TabsList>
            {TAB_INFO.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}>
                <span className="mr-1.5">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden text-xs">{tab.label.split(' ').pop()}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Tab Content */}
        <TabsContent value={activeTab} className="flex flex-1 min-h-0 flex-col lg:flex-row mt-0">
          {/* LEFT: Canvas */}
          <div className="flex-1 min-w-0 overflow-auto bg-gray-50 p-4 lg:p-6 relative" onClick={() => setCurrentSelectedZone(null)}>
            {/* Help overlay when no zone is selected */}
            {!currentSelectedZone && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/80 backdrop-blur-sm shadow-sm border border-gray-200 text-sm text-muted-foreground">
                  <MousePointerClick className="h-4 w-4" />
                  <span>Hacé click en una sección del reporte para editar sus propiedades</span>
                </div>
              </div>
            )}
            {activeTab === 'rinde-tropa' && renderRindeCanvas()}
            {activeTab === 'planilla-01' && renderPlanillaCanvas()}
            {activeTab === 'stock-corrales' && renderStockCanvas()}
          </div>

          {/* RIGHT: Properties Panel */}
          <div className="w-full lg:w-[380px] shrink-0 border-l bg-white flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <Ruler className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Propiedades</h2>
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {TAB_INFO.find(t => t.value === activeTab)?.label}
                </Badge>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4">
                {renderPropertiesPanel()}
              </div>
            </ScrollArea>

            {/* Common settings section at bottom */}
            <div className="border-t px-4 py-3 bg-gray-50">
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                  Configuración de página
                  <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                </summary>
                <div className="mt-3 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">Orientación</Label>
                    <Select
                      value={(simplePagina.orientacion as string) || 'landscape'}
                      onValueChange={(v) => updateExcelField('pagina', { ...simplePagina, orientacion: v })}
                    >
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="landscape">Horizontal</SelectItem>
                        <SelectItem value="portrait">Vertical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] text-muted-foreground">Márgenes (cm)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['izquierdo', 'derecho', 'superior', 'inferior'] as const).map(m => (
                        <div key={m} className="space-y-0.5">
                          <span className="text-[9px] text-muted-foreground capitalize">{m}</span>
                          <Input type="number" min={0} max={5} step={0.1}
                            value={activeTab === 'rinde-tropa' ? rinde.margenes?.[m] : simpleMargenes[m]}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 0
                              if (activeTab === 'rinde-tropa') {
                                updateCurrentConfig(prev => ({
                                  ...prev,
                                  excel: { ...prev.excel, margenes: { ...(prev.excel.margenes as Record<string, number>), [m]: v } },
                                }))
                              } else {
                                updateExcelField('margenes', { ...simpleMargenes, [m]: v })
                              }
                            }}
                            className="h-7 text-xs" />
                        </div>
                      ))}
                    </div>
                  </div>
                  {activeTab !== 'rinde-tropa' && (
                    <div className="space-y-1.5">
                      <Label className="text-[10px] text-muted-foreground">Fuente</Label>
                      <Select
                        value={(simpleFuentes.familia as string) || 'Arial'}
                        onValueChange={(v) => updateExcelField('fuentes', { ...simpleFuentes, familia: v })}
                      >
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FONT_OPTIONS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </details>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
