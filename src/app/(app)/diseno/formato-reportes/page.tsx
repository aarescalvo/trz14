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
import { toast } from 'sonner'
import {
  Save, RotateCcw, ShieldAlert, Loader2, Columns3, FileSpreadsheet,
  Eye, Ruler, GripVertical, ChevronRight, MoveHorizontal, ZoomIn
} from 'lucide-react'

// ============================================================
// TYPES
// ============================================================

interface ReportConfig {
  excel: {
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
    formatosNumericos: {
      kgEntero: string
      kgDecimal: string
      porcentaje: string
      fecha: string
      hora: string
    }
    separacion: { filasAntesMenudencia: number }
  }
  pdf: Record<string, unknown>
}

type ZoneId = 'header' | 'operator' | 'summary' | 'animalTable' | 'menudencia'

interface ZoneMeta {
  id: ZoneId
  label: string
  icon: string
  fontKey: 'tamanoEncabezado' | 'tamanoInfo' | 'tamanoDatos' | 'tamanoMenudencia'
}

const ZONES: ZoneMeta[] = [
  { id: 'header', label: 'Encabezado', icon: '📝', fontKey: 'tamanoEncabezado' },
  { id: 'operator', label: 'Info Operador', icon: '👤', fontKey: 'tamanoInfo' },
  { id: 'summary', label: 'Resumen', icon: '📊', fontKey: 'tamanoDatos' },
  { id: 'animalTable', label: 'Tabla Animales', icon: '🐄', fontKey: 'tamanoDatos' },
  { id: 'menudencia', label: 'Menudencia', icon: '🫀', fontKey: 'tamanoMenudencia' },
]

const COLUMN_MAP: Record<string, { label: string; key: string }> = {
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

const FONT_OPTIONS = ['Calibri', 'Arial', 'Times New Roman', 'Verdana', 'Tahoma']
const EXCEL_TO_PX = 7
const ANIMAL_COL_KEYS = Object.keys(COLUMN_MAP)

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

const DEFAULT_CONFIG: ReportConfig = {
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
  },
  pdf: {},
}

// ============================================================
// COLUMN RESIZE HANDLE COMPONENT
// ============================================================

function ColResizeHandle({
  colKey,
  isResizing,
  isHovered,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
}: {
  colKey: string
  isResizing: boolean
  isHovered: boolean
  onMouseDown: (e: React.MouseEvent) => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  return (
    <div
      className="absolute z-30 top-0 bottom-0"
      style={{
        right: '-4px',
        width: '9px',
        cursor: 'col-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Visible handle line */}
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
// COLUMN WIDTH DISPLAY
// ============================================================

function ColWidthIndicator({
  width,
  isResizing,
  isHovered,
}: {
  width: number
  isResizing: boolean
  isHovered: boolean
}) {
  if (!isResizing && !isHovered) return null
  return (
    <div
      className="absolute -bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
      style={{ whiteSpace: 'nowrap' }}
    >
      <div
        className="bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded shadow-md font-mono"
      >
        {width.toFixed(1)}
      </div>
    </div>
  )
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function FormatoReportesPage() {
  const operador = useOperador()
  const [config, setConfig] = useState<ReportConfig | null>(null)
  const [savedConfig, setSavedConfig] = useState<ReportConfig | null>(null)
  const [selectedZone, setSelectedZone] = useState<ZoneId | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hoveredZone, setHoveredZone] = useState<ZoneId | null>(null)

  // Column resize state
  const [resizingCol, setResizingCol] = useState<string | null>(null)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null)
  const [currentResizeWidth, setCurrentResizeWidth] = useState(0)
  const [resizeTooltip, setResizeTooltip] = useState<{ x: number; y: number } | null>(null)

  const tableRef = useRef<HTMLTableElement>(null)

  // === ALL HOOKS BEFORE ANY CONDITIONAL RETURNS ===

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/config/reporte-rinde-tropa')
        const data = await res.json()
        if (data.success) {
          const c = data.data as ReportConfig
          setConfig(c)
          setSavedConfig(JSON.parse(JSON.stringify(c)))
        }
      } catch {
        toast.error('Error al cargar configuración')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const excel = config?.excel || DEFAULT_CONFIG.excel
  const colPx = (key: string) => (excel.anchoColumnas[key] || 8) * EXCEL_TO_PX
  const zoneFont = (zone: ZoneId) => {
    const z = ZONES.find(zz => zz.id === zone)
    return z ? excel.fuentes[z.fontKey] : 10
  }

  function updateColumnWidth(colKey: string, width: number) {
    setConfig(prev => {
      if (!prev) return prev
      return { ...prev, excel: { ...prev.excel, anchoColumnas: { ...prev.excel.anchoColumnas, [colKey]: width } } }
    })
  }

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, colKey: string) => {
    e.preventDefault()
    e.stopPropagation()
    const currentWidth = excel.anchoColumnas[colKey] || 8
    setResizingCol(colKey)
    setResizeStartX(e.clientX)
    setResizeStartWidth(currentWidth)
    setCurrentResizeWidth(currentWidth)
    setResizeTooltip({ x: e.clientX, y: e.clientY })
    setSelectedZone('animalTable')
  }, [excel.anchoColumnas])

  useEffect(() => {
    if (!resizingCol) return
    function handleMouseMove(e: MouseEvent) {
      const delta = (e.clientX - resizeStartX) / EXCEL_TO_PX
      const newWidth = Math.max(2, Math.round((resizeStartWidth + delta) * 10) / 10)
      setCurrentResizeWidth(newWidth)
      setResizeTooltip({ x: e.clientX, y: e.clientY })
      // Live preview: update config in real-time
      if (resizingCol) updateColumnWidth(resizingCol, newWidth)
    }
    function handleMouseUp() {
      setResizingCol(null)
      setResizeTooltip(null)
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingCol, resizeStartX, resizeStartWidth])

  useEffect(() => {
    if (resizingCol) {
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'col-resize'
    } else {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    return () => { document.body.style.userSelect = ''; document.body.style.cursor = '' }
  }, [resizingCol])

  // === CONDITIONAL RETURNS (after all hooks) ===

  if (operador && !operador.permisos.puedeConfiguracion) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 p-8">
            <ShieldAlert className="h-12 w-12 text-red-500" />
            <h2 className="text-lg font-semibold">Acceso denegado</h2>
            <p className="text-sm text-muted-foreground text-center">No tenés permisos para acceder al diseño de formatos de reportes.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/config/reporte-rinde-tropa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (data.success) {
        setSavedConfig(JSON.parse(JSON.stringify(config)))
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
    if (savedConfig) {
      setConfig(JSON.parse(JSON.stringify(savedConfig)))
      toast.info('Configuración restaurada')
    }
  }

  const selectedZoneMeta = selectedZone ? ZONES.find(z => z.id === selectedZone) : null

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="flex flex-col h-full">
      {/* Global resize tooltip */}
      {resizingCol && resizeTooltip && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: resizeTooltip.x + 16,
            top: resizeTooltip.y - 12,
          }}
        >
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
            <p className="text-xs text-muted-foreground">Diseño visual — Rinde por Tropa</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRestore} disabled={!savedConfig}>
            <RotateCcw className="h-4 w-4 mr-1.5" />Restaurar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            Guardar Cambios
          </Button>
        </div>
      </div>

      {/* Instructions bar */}
      <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-3 text-xs text-blue-700 shrink-0">
        <ZoomIn className="h-3.5 w-3.5 shrink-0" />
        <span>
          <strong>Tip:</strong> Hacé click en una sección para editarla. En la tabla de animales, arrastrá los bordes de las columnas para cambiar el ancho.
        </span>
      </div>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* LEFT: Canvas */}
        <div className="flex-1 min-w-0 overflow-auto bg-gray-50 p-4 lg:p-6" onClick={() => setSelectedZone(null)}>
          <div
            className="mx-auto bg-white shadow-lg border rounded"
            style={{
              width: excel.pagina.orientacion === 'landscape' ? '1056px' : '756px',
              minWidth: excel.pagina.orientacion === 'landscape' ? '1056px' : '756px',
              padding: `${excel.margenes.superior * 40}px ${excel.margenes.derecho * 40}px ${excel.margenes.inferior * 40}px ${excel.margenes.izquierdo * 40}px`,
              fontFamily: excel.fuentes.familia,
              fontSize: '10px',
            }}
          >
            {/* Zone: Header */}
            <div
              className="relative group rounded transition-all duration-200"
              style={{
                border: selectedZone === 'header' ? '2px solid #2563eb' : '2px solid transparent',
                background: selectedZone === 'header' ? 'rgba(37,99,235,0.04)' : hoveredZone === 'header' ? 'rgba(37,99,235,0.02)' : 'transparent',
                cursor: 'pointer',
                padding: selectedZone === 'header' ? '4px' : hoveredZone === 'header' ? '3px' : '0px',
              }}
              onClick={(e) => { e.stopPropagation(); setSelectedZone('header') }}
              onMouseEnter={() => setHoveredZone('header')}
              onMouseLeave={() => setHoveredZone(null)}
            >
              {/* Zone label */}
              {(selectedZone === 'header' || hoveredZone === 'header') && (
                <div
                  className="absolute -top-3 left-3 z-10 flex items-center gap-1 px-2 py-0 rounded text-[10px] font-medium"
                  style={{
                    background: selectedZone === 'header' ? '#2563eb' : '#e0e7ff',
                    color: selectedZone === 'header' ? '#fff' : '#3730a3',
                  }}
                >
                  <span>📝</span>
                  <span>Encabezado</span>
                </div>
              )}
              <div style={{ fontSize: `${zoneFont('header')}px`, marginBottom: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
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
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ height: '24px' }} />

            {/* Zone: Operator Info */}
            <div
              className="relative group rounded transition-all duration-200"
              style={{
                border: selectedZone === 'operator' ? '2px solid #2563eb' : '2px solid transparent',
                background: selectedZone === 'operator' ? 'rgba(37,99,235,0.04)' : hoveredZone === 'operator' ? 'rgba(37,99,235,0.02)' : 'transparent',
                cursor: 'pointer',
                padding: selectedZone === 'operator' ? '4px' : hoveredZone === 'operator' ? '3px' : '0px',
              }}
              onClick={(e) => { e.stopPropagation(); setSelectedZone('operator') }}
              onMouseEnter={() => setHoveredZone('operator')}
              onMouseLeave={() => setHoveredZone(null)}
            >
              {(selectedZone === 'operator' || hoveredZone === 'operator') && (
                <div
                  className="absolute -top-3 left-3 z-10 flex items-center gap-1 px-2 py-0 rounded text-[10px] font-medium"
                  style={{
                    background: selectedZone === 'operator' ? '#2563eb' : '#e0e7ff',
                    color: selectedZone === 'operator' ? '#fff' : '#3730a3',
                  }}
                >
                  <span>👤</span>
                  <span>Info Operador</span>
                </div>
              )}
              <div style={{ fontSize: `${zoneFont('operator')}px`, marginBottom: '4px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr><td colSpan={2} style={{ fontWeight: 'bold' }}>Usuario/Matarife:</td><td colSpan={3}>Juan Pérez</td><td style={{ fontWeight: 'bold' }}>Productor:</td><td>Ganadera del Sur S.R.L.</td></tr>
                    <tr><td colSpan={2} style={{ fontWeight: 'bold' }}>Matrícula:</td><td colSpan={3}>12345</td><td style={{ fontWeight: 'bold' }}>N° DTE:</td><td>001-12345678-9</td></tr>
                    <tr><td></td><td></td><td></td><td style={{ fontWeight: 'bold' }}>N° Guia:</td><td colSpan={3}>0001-00234567</td></tr>
                    <tr><td colSpan={5}></td><td style={{ fontWeight: 'bold' }}>Fecha Ing.:</td><td>27/05/2026</td></tr>
                    <tr><td colSpan={5}></td><td style={{ fontWeight: 'bold' }}>Hora:</td><td>14:30</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ height: '16px' }} />

            {/* Zone: Summary */}
            <div
              className="relative group rounded transition-all duration-200"
              style={{
                border: selectedZone === 'summary' ? '2px solid #2563eb' : '2px solid transparent',
                background: selectedZone === 'summary' ? 'rgba(37,99,235,0.04)' : hoveredZone === 'summary' ? 'rgba(37,99,235,0.02)' : 'transparent',
                cursor: 'pointer',
                padding: selectedZone === 'summary' ? '4px' : hoveredZone === 'summary' ? '3px' : '0px',
              }}
              onClick={(e) => { e.stopPropagation(); setSelectedZone('summary') }}
              onMouseEnter={() => setHoveredZone('summary')}
              onMouseLeave={() => setHoveredZone(null)}
            >
              {(selectedZone === 'summary' || hoveredZone === 'summary') && (
                <div
                  className="absolute -top-3 left-3 z-10 flex items-center gap-1 px-2 py-0 rounded text-[10px] font-medium"
                  style={{
                    background: selectedZone === 'summary' ? '#2563eb' : '#e0e7ff',
                    color: selectedZone === 'summary' ? '#fff' : '#3730a3',
                  }}
                >
                  <span>📊</span>
                  <span>Resumen</span>
                </div>
              )}
              <div style={{ fontSize: `${zoneFont('summary')}px` }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr><td colSpan={6} style={{ fontWeight: 'bold', fontSize: '12px' }}>Fecha Faena: <span style={{ color: 'red' }}>27/05/2026</span></td><td style={{ fontWeight: 'bold', textAlign: 'center' }}>Cuartos</td><td style={{ fontWeight: 'bold', textAlign: 'center' }}>Kg</td></tr>
                    <tr style={{ background: '#e0e0e0', fontWeight: 'bold' }}><td>N° Tropa</td><td>Cabezas</td><td>Kg Vivo</td><td>Kg 1/2</td><td>Rinde</td><td>Promedio</td><td style={{ textAlign: 'center' }}>VQ</td><td style={{ textAlign: 'center' }}>NT</td></tr>
                    <tr><td>001</td><td>3</td><td>1,225</td><td>633.6</td><td>51.71%</td><td>51.73%</td><td style={{ textAlign: 'center' }}>2</td><td style={{ textAlign: 'center' }}>1</td></tr>
                    <tr style={{ background: '#f0f0f0', fontWeight: 'bold' }}><td colSpan={2}>TOTALES</td><td>1,225</td><td>633.6</td><td></td><td></td><td style={{ textAlign: 'center' }}>2</td><td style={{ textAlign: 'center' }}>1</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ height: '16px' }} />

            {/* Zone: Animal Table with RESIZABLE COLUMNS */}
            <div
              className="relative rounded transition-all duration-200"
              style={{
                border: selectedZone === 'animalTable' ? '2px solid #2563eb' : '2px solid transparent',
                background: selectedZone === 'animalTable' ? 'rgba(37,99,235,0.04)' : hoveredZone === 'animalTable' ? 'rgba(37,99,235,0.02)' : 'transparent',
                padding: selectedZone === 'animalTable' ? '4px' : hoveredZone === 'animalTable' ? '3px' : '0px',
              }}
              onClick={(e) => { e.stopPropagation(); setSelectedZone('animalTable') }}
              onMouseEnter={() => setHoveredZone('animalTable')}
              onMouseLeave={() => setHoveredZone(null)}
            >
              {/* Zone label + resize hint */}
              {(selectedZone === 'animalTable' || hoveredZone === 'animalTable') && (
                <div
                  className="absolute -top-3 left-3 z-10 flex items-center gap-1 px-2 py-0 rounded text-[10px] font-medium"
                  style={{
                    background: selectedZone === 'animalTable' ? '#2563eb' : '#e0e7ff',
                    color: selectedZone === 'animalTable' ? '#fff' : '#3730a3',
                  }}
                >
                  <span>🐄</span>
                  <span>Tabla Animales</span>
                  {selectedZone === 'animalTable' && (
                    <span className="ml-2 text-[9px] opacity-80">← Arrastrá bordes de columna →</span>
                  )}
                </div>
              )}

              {/* Resize hint banner when animalTable is selected */}
              {selectedZone === 'animalTable' && !resizingCol && (
                <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-800">
                  <MoveHorizontal className="h-3.5 w-3.5 shrink-0" />
                  <span>Pará el mouse sobre los bordes de las columnas del encabezado y arrastrá para cambiar el ancho</span>
                </div>
              )}

              <div style={{ fontSize: `${zoneFont('animalTable')}px`, overflowX: 'auto' }}>
                <table
                  ref={tableRef}
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    tableLayout: 'fixed',
                  }}
                >
                  <thead>
                    <tr style={{ background: '#d9d9d9', fontWeight: 'bold' }}>
                      {ANIMAL_COL_KEYS.map(k => {
                        const w = resizingCol === k ? currentResizeWidth * EXCEL_TO_PX : colPx(k)
                        const isHov = hoveredHandle === k
                        const isRes = resizingCol === k
                        return (
                          <th
                            key={k}
                            className="relative select-none"
                            style={{
                              width: `${w}px`,
                              border: '1px solid #999',
                              padding: '3px 2px',
                              textAlign: 'center',
                              fontSize: '9px',
                              background: isRes ? '#bfdbfe' : isHov ? '#e0edff' : '#d9d9d9',
                              transition: 'background 0.1s',
                            }}
                          >
                            {/* Column header text */}
                            <span className="truncate block">{COLUMN_MAP[k].label}</span>

                            {/* Width indicator below header */}
                            <ColWidthIndicator
                              width={isRes ? currentResizeWidth : (excel.anchoColumnas[k] || 8)}
                              isResizing={isRes}
                              isHovered={isHov}
                            />

                            {/* Resize handle */}
                            <ColResizeHandle
                              colKey={k}
                              isResizing={isRes}
                              isHovered={isHov}
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
                        <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'center' }}>{row.garron}</td>
                        <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'center' }}>{row.animal}</td>
                        <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'center' }}>{row.raza}</td>
                        <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'center' }}>{row.clasif}</td>
                        <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'center' }}>{row.caravana}</td>
                        <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'right' }}>{row.kgEntrada.toLocaleString()}</td>
                        <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'right' }}>{row.mediaA.toFixed(1)}</td>
                        <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'right' }}>{row.mediaB.toFixed(1)}</td>
                        <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'right' }}>{row.totalKg.toFixed(1)}</td>
                        <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'right' }}>{row.rinde}</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f0f0f0', fontWeight: 'bold' }}>
                      <td style={{ border: '1px solid #ccc', padding: '2px 4px' }} colSpan={2}>TOTALES</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px 4px' }} colSpan={3}></td>
                      <td style={{ border: '1px solid #ccc', padding: '2px 4px', textAlign: 'right' }}>1,225</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px 4px', textAlign: 'right' }}>315.4</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px 4px', textAlign: 'right' }}>318.2</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px 4px', textAlign: 'right' }}>633.6</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ height: `${excel.separacion.filasAntesMenudencia * 20}px` }} />

            {/* Zone: Menudencia */}
            <div
              className="relative group rounded transition-all duration-200"
              style={{
                border: selectedZone === 'menudencia' ? '2px solid #2563eb' : '2px solid transparent',
                background: selectedZone === 'menudencia' ? 'rgba(37,99,235,0.04)' : hoveredZone === 'menudencia' ? 'rgba(37,99,235,0.02)' : 'transparent',
                cursor: 'pointer',
                padding: selectedZone === 'menudencia' ? '4px' : hoveredZone === 'menudencia' ? '3px' : '0px',
              }}
              onClick={(e) => { e.stopPropagation(); setSelectedZone('menudencia') }}
              onMouseEnter={() => setHoveredZone('menudencia')}
              onMouseLeave={() => setHoveredZone(null)}
            >
              {(selectedZone === 'menudencia' || hoveredZone === 'menudencia') && (
                <div
                  className="absolute -top-3 left-3 z-10 flex items-center gap-1 px-2 py-0 rounded text-[10px] font-medium"
                  style={{
                    background: selectedZone === 'menudencia' ? '#2563eb' : '#e0e7ff',
                    color: selectedZone === 'menudencia' ? '#fff' : '#3730a3',
                  }}
                >
                  <span>🫀</span>
                  <span>Menudencia</span>
                </div>
              )}
              <div style={{ fontSize: `${zoneFont('menudencia')}px` }}>
                <table style={{ width: '60%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#d9d9d9', fontWeight: 'bold' }}><th colSpan={5} style={{ border: '1px solid #999', padding: '4px 6px', textAlign: 'center' }}>MENUDENCIA</th></tr>
                    <tr style={{ background: '#d9d9d9', fontWeight: 'bold' }}>
                      <th style={{ border: '1px solid #999', padding: '3px 4px', textAlign: 'center' }}>Tipo</th>
                      <th style={{ border: '1px solid #999', padding: '3px 4px', textAlign: 'center' }}>Cantidades</th>
                      <th style={{ border: '1px solid #999', padding: '3px 4px', textAlign: 'center' }}>Kg</th>
                      <th style={{ border: '1px solid #999', padding: '3px 4px', textAlign: 'center' }}>Unidad</th>
                      <th style={{ border: '1px solid #999', padding: '3px 4px', textAlign: 'center' }}>Kg Dec.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MENUDENCIA_DATA.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #ccc' }}>
                        <td style={{ border: '1px solid #ddd', padding: '2px 4px', fontWeight: 'bold' }}>{row.tipo}</td>
                        <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'center' }}>{row.cant}</td>
                        <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'right' }}>{row.kg.toFixed(1)}</td>
                        <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'center' }}>{row.unidad}</td>
                        <td style={{ border: '1px solid #ddd', padding: '2px 4px', textAlign: 'right' }}>{row.kgDec != null ? row.kgDec.toFixed(1) : '-'}</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f0f0f0', fontWeight: 'bold' }}>
                      <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}>TOTALES</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px 4px', textAlign: 'center' }}>12</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px 4px', textAlign: 'right' }}>73.0</td>
                      <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}></td>
                      <td style={{ border: '1px solid #ccc', padding: '2px 4px' }}></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Properties Panel */}
        <div className="w-full lg:w-[360px] shrink-0 border-l bg-white flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Propiedades</h2>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4">
              {!selectedZone ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Eye className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground mb-1">Sin selección</p>
                  <p className="text-xs text-muted-foreground">Hacé click en una sección del reporte para editar sus propiedades.</p>
                  <div className="mt-6 w-full space-y-2">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Secciones disponibles</p>
                    {ZONES.map(z => (
                      <button
                        key={z.id}
                        className="flex items-center gap-2 w-full px-3 py-2 text-xs rounded-md hover:bg-gray-100 transition-colors text-left"
                        onClick={() => setSelectedZone(z.id)}
                      >
                        <span>{z.icon}</span>
                        <span>{z.label}</span>
                        <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Zone header */}
                  <div className="flex items-center gap-2">
                    <span className="text-base">{selectedZoneMeta?.icon}</span>
                    <Badge variant="secondary">{selectedZoneMeta?.label}</Badge>
                  </div>
                  <Separator />

                  {/* Font family */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Fuente</Label>
                    <Select
                      value={excel.fuentes.familia}
                      onValueChange={(val) => setConfig(prev => prev ? {
                        ...prev, excel: { ...prev.excel, fuentes: { ...prev.excel.fuentes, familia: val } }
                      } : prev)}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map(f => <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Font size for this zone */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Tamaño de fuente (px)</Label>
                    <Input
                      type="number"
                      min={6}
                      max={24}
                      value={selectedZoneMeta ? excel.fuentes[selectedZoneMeta.fontKey] : 10}
                      onChange={(e) => {
                        if (!selectedZoneMeta) return
                        const val = parseInt(e.target.value) || 10
                        setConfig(prev => prev ? {
                          ...prev, excel: { ...prev.excel, fuentes: { ...prev.excel.fuentes, [selectedZoneMeta.fontKey]: val } }
                        } : prev)
                      }}
                      className="h-8 text-xs"
                    />
                  </div>

                  {/* Animal Table: Column Widths */}
                  {selectedZone === 'animalTable' && (<>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Columns3 className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-xs font-medium">Anchos de Columna</Label>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        También podés arrastrar los bordes directamente en la tabla de arriba.
                      </p>
                      <div className="space-y-2">
                        {ANIMAL_COL_KEYS.map(colKey => (
                          <div key={colKey} className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground w-28 truncate" title={COLUMN_MAP[colKey]?.label}>
                              {COLUMN_MAP[colKey]?.label}
                            </Label>
                            <Input
                              type="number"
                              min={2}
                              max={50}
                              step={0.5}
                              value={excel.anchoColumnas[colKey] || 8}
                              onChange={(e) => updateColumnWidth(colKey, parseFloat(e.target.value) || 8)}
                              className="h-7 text-xs w-20"
                            />
                            <span className="text-[10px] text-muted-foreground w-10">
                              {Math.round((excel.anchoColumnas[colKey] || 8) * EXCEL_TO_PX)}px
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-xs font-medium">Formatos Numéricos</Label>
                      </div>
                      <div className="space-y-2">
                        {Object.entries(excel.formatosNumericos).map(([key, val]) => (
                          <div key={key} className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground w-28 capitalize">
                              {key === 'kgEntero' ? 'Kg Entero' : key === 'kgDecimal' ? 'Kg Decimal' : key === 'porcentaje' ? 'Porcentaje' : key === 'fecha' ? 'Fecha' : 'Hora'}
                            </Label>
                            <Input
                              value={val}
                              onChange={(e) => setConfig(prev => prev ? {
                                ...prev, excel: { ...prev.excel, formatosNumericos: { ...prev.excel.formatosNumericos, [key]: e.target.value } }
                              } : prev)}
                              className="h-7 text-xs flex-1"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </>)}

                  {/* Menudencia: Separation */}
                  {selectedZone === 'menudencia' && (<>
                    <Separator />
                    <div className="space-y-3">
                      <Label className="text-xs font-medium">Separación</Label>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Filas antes de Menudencia</Label>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={excel.separacion.filasAntesMenudencia}
                          onChange={(e) => setConfig(prev => prev ? {
                            ...prev, excel: { ...prev.excel, separacion: { filasAntesMenudencia: parseInt(e.target.value) || 4 } }
                          } : prev)}
                          className="h-7 text-xs w-20"
                        />
                      </div>
                    </div>
                  </>)}
                </div>
              )}

              {/* General Config (always visible) */}
              <Separator className="my-4" />
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-xs font-semibold">Configuración General</Label>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Orientación de Página</Label>
                  <Select
                    value={excel.pagina.orientacion}
                    onValueChange={(val) => setConfig(prev => prev ? {
                      ...prev, excel: { ...prev.excel, pagina: { ...prev.excel.pagina, orientacion: val } }
                    } : prev)}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="landscape" className="text-xs">Horizontal (Apaisado)</SelectItem>
                      <SelectItem value="portrait" className="text-xs">Vertical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Ajustar al ancho</Label>
                  <Switch
                    checked={excel.pagina.ajustarAncho}
                    onCheckedChange={(checked) => setConfig(prev => prev ? {
                      ...prev, excel: { ...prev.excel, pagina: { ...prev.excel.pagina, ajustarAncho: checked } }
                    } : prev)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Márgenes (cm)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['izquierdo', 'derecho', 'superior', 'inferior'] as const).map(m => (
                      <div key={m} className="flex items-center gap-1.5">
                        <Label className="text-[10px] text-muted-foreground capitalize w-16">{m}</Label>
                        <Input
                          type="number"
                          min={0}
                          max={5}
                          step={0.1}
                          value={excel.margenes[m]}
                          onChange={(e) => setConfig(prev => prev ? {
                            ...prev, excel: { ...prev.excel, margenes: { ...prev.excel.margenes, [m]: parseFloat(e.target.value) || 0 } }
                          } : prev)}
                          className="h-7 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
