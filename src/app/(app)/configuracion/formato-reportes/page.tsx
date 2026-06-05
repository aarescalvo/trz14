'use client'

import { useState, useEffect, useCallback } from 'react'
import { useOperador } from '@/components/providers/auth-provider'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { FileSpreadsheet, Save, RotateCcw, Loader2, ShieldAlert, FileText } from 'lucide-react'

// ============================================================
// TYPES
// ============================================================

interface ExcelConfig {
  pagina: { orientacion: string; ajustarAncho: boolean }
  margenes: { izquierdo: number; derecho: number; superior: number; inferior: number }
  anchoColumnas: Record<string, number>
  fuentes: { familia: string; tamanoEncabezado: number; tamanoDatos: number; tamanoInfo: number; tamanoMenudencia: number }
  formatosNumericos: Record<string, string>
  separacion: { filasAntesMenudencia: number }
}

interface PdfConfig {
  pagina: { orientacion: string; tamano: string }
  margenes: { izquierdo: number; derecho: number; superior: number; inferior: number }
  fuentes: { tamanoTitulo: number; tamanoInfo: number; tamanoTablaEncabezado: number; tamanoTablaCuerpo: number; tamanoMenudencia: number; tamanoPie: number }
  tablaAnimales: {
    anchoColumnas: Record<string, number>
    alineacion: Record<string, string>
  }
  tablaMenudencia: { anchoColumnas: Record<string, number> }
  colores: Record<string, number[]>
  separacion: { antesDeTabla: number; despuesDeTabla: number }
}

interface ReportConfig {
  excel: ExcelConfig
  pdf: PdfConfig
}

// ============================================================
// COLUMN DEFINITIONS
// ============================================================

const EXCEL_COLUMNS = [
  { key: 'A', label: 'A', desc: '' },
  { key: 'B', label: 'B', desc: '' },
  { key: 'C_garron', label: 'C', desc: 'N° Garrón' },
  { key: 'D_animal', label: 'D', desc: 'N° Animal' },
  { key: 'E_raza', label: 'E', desc: 'Raza' },
  { key: 'F_G_clasif', label: 'F-G', desc: 'Clasificación' },
  { key: 'H_caravana', label: 'H', desc: 'Caravana' },
  { key: 'I_kgEntrada', label: 'I', desc: 'Kg Entrada' },
  { key: 'J_mediaA', label: 'J', desc: 'Kg 1/2 A' },
  { key: 'K_mediaB', label: 'K', desc: 'Kg 1/2 B' },
  { key: 'L_totalKg', label: 'L', desc: 'Total Kg' },
  { key: 'M_rinde', label: 'M', desc: 'Rinde' },
  { key: 'N', label: 'N', desc: '' },
] as const

const FORMATO_PREVIEWS: Record<string, string> = {
  kgEntero: '350',
  kgDecimal: '350.5',
  porcentaje: '52.30%',
  fecha: '28/05/2026',
  hora: '14:30',
}

const FORMATO_LABELS: Record<string, string> = {
  kgEntero: 'Kg Entero',
  kgDecimal: 'Kg Decimal',
  porcentaje: 'Porcentaje',
  fecha: 'Fecha',
  hora: 'Hora',
}

const FUENTE_FAMILIAS = ['Calibri', 'Arial', 'Times New Roman', 'Verdana', 'Tahoma']

const PDF_TABLA_ANIMALES_COLS = [
  { key: 'garron', label: 'Garrón' },
  { key: 'animal', label: 'Animal' },
  { key: 'raza', label: 'Raza' },
  { key: 'clasificacion', label: 'Clasificación' },
  { key: 'caravana', label: 'Caravana' },
  { key: 'kgEntrada', label: 'Kg Entrada' },
  { key: 'mediaA', label: 'Media A' },
  { key: 'mediaB', label: 'Media B' },
  { key: 'totalKg', label: 'Total Kg' },
  { key: 'rinde', label: 'Rinde' },
] as const

const PDF_TABLA_MENUDENCIA_COLS = [
  { key: 'tipo', label: 'Tipo' },
  { key: 'cantidades', label: 'Cantidades' },
  { key: 'kg', label: 'Kg' },
  { key: 'unidad', label: 'Unidad' },
  { key: 'kgDec', label: 'Kg Dec.' },
] as const

const COLOR_LABELS: Record<string, string> = {
  encabezadoTabla: 'Encabezado de Tabla',
  textoEncabezado: 'Texto Encabezado',
  filaTotales: 'Fila de Totales',
  fechaFaena: 'Fecha Faena',
}

// ============================================================
// COMPONENT
// ============================================================

export default function FormatoReportesPage() {
  const operador = useOperador()
  const [config, setConfig] = useState<ReportConfig | null>(null)
  const [initialConfig, setInitialConfig] = useState<ReportConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/config/reporte-rinde-tropa')
      const json = await res.json()
      if (json.success) {
        const cfg = json.data as ReportConfig
        setConfig(cfg)
        setInitialConfig(JSON.parse(JSON.stringify(cfg)))
      } else {
        toast.error('Error al cargar la configuración')
      }
    } catch {
      toast.error('Error de conexión al cargar la configuración')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  // Permission guard
  if (!operador || !operador.permisos.puedeConfiguracion) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="p-8 text-center max-w-md">
          <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-lg font-semibold mb-2">Acceso Denegado</h2>
          <p className="text-muted-foreground">
            No tiene permisos para acceder a la configuración de formatos de reportes.
          </p>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!config) return null

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await fetch('/api/config/reporte-rinde-tropa', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const json = await res.json()
      if (json.success) {
        setInitialConfig(JSON.parse(JSON.stringify(config)))
        toast.success('Configuración guardada correctamente')
      } else {
        toast.error(json.error || 'Error al guardar')
      }
    } catch {
      toast.error('Error de conexión al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (initialConfig) {
      setConfig(JSON.parse(JSON.stringify(initialConfig)))
      toast.info('Valores restaurados a la última versión guardada')
    }
  }

  // ---- Update helpers ----
  const updateExcel = <K extends keyof ExcelConfig>(section: K, field: string, value: unknown) => {
    setConfig(prev => {
      if (!prev) return prev
      const sectionVal = prev.excel[section]
      if (typeof sectionVal === 'object' && sectionVal !== null) {
        return {
          ...prev,
          excel: {
            ...prev.excel,
            [section]: { ...sectionVal, [field]: value },
          },
        }
      }
      return {
        ...prev,
        excel: { ...prev.excel, [section]: value } as unknown as ExcelConfig,
      }
    })
  }

  const updatePdf = <K extends keyof PdfConfig>(section: K, field: string, value: unknown) => {
    setConfig(prev => {
      if (!prev) return prev
      const sectionVal = prev.pdf[section]
      if (typeof sectionVal === 'object' && sectionVal !== null) {
        return {
          ...prev,
          pdf: {
            ...prev.pdf,
            [section]: { ...sectionVal, [field]: value },
          },
        }
      }
      return {
        ...prev,
        pdf: { ...prev.pdf, [section]: value } as unknown as PdfConfig,
      }
    })
  }

  const updatePdfArrayColor = (colorKey: string, index: number, value: number) => {
    setConfig(prev => {
      if (!prev) return prev
      const arr = [...prev.pdf.colores[colorKey]] as number[]
      arr[index] = value
      return {
        ...prev,
        pdf: {
          ...prev.pdf,
          colores: { ...prev.pdf.colores, [colorKey]: arr },
        },
      }
    })
  }

  return (
    <div className="space-y-6 pb-32">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Formato de Reportes</h1>
        <p className="text-muted-foreground mt-1">
          Configure el formato de los reportes de Rinde por Tropa (Excel y PDF)
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="excel" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="excel" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </TabsTrigger>
          <TabsTrigger value="pdf" className="gap-2">
            <FileText className="h-4 w-4" />
            PDF
          </TabsTrigger>
        </TabsList>

        {/* ===== EXCEL TAB ===== */}
        <TabsContent value="excel" className="space-y-4 mt-4">
          {/* Página */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Página</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Orientación</Label>
                <Select
                  value={config.excel.pagina.orientacion}
                  onValueChange={v => updateExcel('pagina', 'orientacion', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="landscape">Horizontal (Landscape)</SelectItem>
                    <SelectItem value="portrait">Vertical (Portrait)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  id="ajustar-ancho"
                  checked={config.excel.pagina.ajustarAncho}
                  onCheckedChange={v => updateExcel('pagina', 'ajustarAncho', v)}
                />
                <Label htmlFor="ajustar-ancho">Ajustar ancho</Label>
              </div>
            </CardContent>
          </Card>

          {/* Márgenes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Márgenes (cm)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(['izquierdo', 'derecho', 'superior', 'inferior'] as const).map(m => (
                <div key={m} className="space-y-2">
                  <Label className="capitalize">{m}</Label>
                  <Input
                    type="number"
                    step={0.1}
                    min={0}
                    value={config.excel.margenes[m]}
                    onChange={e => updateExcel('margenes', m, parseFloat(e.target.value) || 0)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Columnas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ancho de Columnas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {EXCEL_COLUMNS.map(col => (
                  <div key={col.key} className="flex items-center gap-2">
                    <div className="min-w-[90px]">
                      <span className="text-sm font-medium">{col.label}</span>
                      {col.desc && (
                        <span className="text-xs text-muted-foreground ml-1">({col.desc})</span>
                      )}
                    </div>
                    <Input
                      type="number"
                      step={0.5}
                      min={0}
                      value={config.excel.anchoColumnas[col.key] ?? 0}
                      onChange={e =>
                        setConfig(prev => {
                          if (!prev) return prev
                          return {
                            ...prev,
                            excel: {
                              ...prev.excel,
                              anchoColumnas: {
                                ...prev.excel.anchoColumnas,
                                [col.key]: parseFloat(e.target.value) || 0,
                              },
                            },
                          }
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Fuentes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Fuentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Familia</Label>
                  <Select
                    value={config.excel.fuentes.familia}
                    onValueChange={v => updateExcel('fuentes', 'familia', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FUENTE_FAMILIAS.map(f => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Encabezado</Label>
                  <Input
                    type="number"
                    step={1}
                    min={6}
                    max={72}
                    value={config.excel.fuentes.tamanoEncabezado}
                    onChange={e => updateExcel('fuentes', 'tamanoEncabezado', parseInt(e.target.value) || 10)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Datos</Label>
                  <Input
                    type="number"
                    step={1}
                    min={6}
                    max={72}
                    value={config.excel.fuentes.tamanoDatos}
                    onChange={e => updateExcel('fuentes', 'tamanoDatos', parseInt(e.target.value) || 10)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Info</Label>
                  <Input
                    type="number"
                    step={1}
                    min={6}
                    max={72}
                    value={config.excel.fuentes.tamanoInfo}
                    onChange={e => updateExcel('fuentes', 'tamanoInfo', parseInt(e.target.value) || 12)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Menudencia</Label>
                  <Input
                    type="number"
                    step={1}
                    min={6}
                    max={72}
                    value={config.excel.fuentes.tamanoMenudencia}
                    onChange={e => updateExcel('fuentes', 'tamanoMenudencia', parseInt(e.target.value) || 12)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Formatos Numéricos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Formatos Numéricos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(Object.entries(config.excel.formatosNumericos) as [string, string][]).map(([key, value]) => (
                <div key={key} className="grid grid-cols-[1fr_1fr_auto] gap-4 items-center">
                  <div>
                    <Label className="text-sm">{FORMATO_LABELS[key] || key}</Label>
                  </div>
                  <Input
                    value={value}
                    onChange={e =>
                      setConfig(prev => {
                        if (!prev) return prev
                        return {
                          ...prev,
                          excel: {
                            ...prev.excel,
                            formatosNumericos: {
                              ...prev.excel.formatosNumericos,
                              [key]: e.target.value,
                            },
                          },
                        }
                      })
                    }
                    placeholder="Formato"
                  />
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded min-w-[80px] text-center font-mono">
                    {FORMATO_PREVIEWS[key] || '—'}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Espaciado */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Espaciado</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Filas antes de menudencia</Label>
                <Input
                  type="number"
                  step={1}
                  min={0}
                  value={config.excel.separacion.filasAntesMenudencia}
                  onChange={e => updateExcel('separacion', 'filasAntesMenudencia', parseInt(e.target.value) || 0)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== PDF TAB ===== */}
        <TabsContent value="pdf" className="space-y-4 mt-4">
          {/* Página */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Página</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Orientación</Label>
                <Select
                  value={config.pdf.pagina.orientacion}
                  onValueChange={v => updatePdf('pagina', 'orientacion', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="landscape">Horizontal (Landscape)</SelectItem>
                    <SelectItem value="portrait">Vertical (Portrait)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tamaño</Label>
                <Select
                  value={config.pdf.pagina.tamano}
                  onValueChange={v => updatePdf('pagina', 'tamano', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4</SelectItem>
                    <SelectItem value="letter">Letter</SelectItem>
                    <SelectItem value="legal">Legal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Márgenes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Márgenes (mm)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(['izquierdo', 'derecho', 'superior', 'inferior'] as const).map(m => (
                <div key={m} className="space-y-2">
                  <Label className="capitalize">{m}</Label>
                  <Input
                    type="number"
                    step={1}
                    min={0}
                    value={config.pdf.margenes[m]}
                    onChange={e => updatePdf('margenes', m, parseFloat(e.target.value) || 0)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Fuentes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tamaños de Fuente (pt)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {([
                ['tamanoTitulo', 'Título'],
                ['tamanoInfo', 'Info'],
                ['tamanoTablaEncabezado', 'Encabezado Tabla'],
                ['tamanoTablaCuerpo', 'Cuerpo Tabla'],
                ['tamanoMenudencia', 'Menudencia'],
                ['tamanoPie', 'Pie de Página'],
              ] as const).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label>{label}</Label>
                  <Input
                    type="number"
                    step={1}
                    min={4}
                    max={72}
                    value={config.pdf.fuentes[key]}
                    onChange={e => updatePdf('fuentes', key, parseInt(e.target.value) || 7)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Tabla Animales */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tabla Animales — Ancho de Columnas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {PDF_TABLA_ANIMALES_COLS.map(col => (
                  <div key={col.key} className="flex items-center gap-2">
                    <Label className="min-w-[100px] text-sm">{col.label}</Label>
                    <Input
                      type="number"
                      step={1}
                      min={0}
                      value={config.pdf.tablaAnimales.anchoColumnas[col.key] ?? 0}
                      onChange={e =>
                        setConfig(prev => {
                          if (!prev) return prev
                          return {
                            ...prev,
                            pdf: {
                              ...prev.pdf,
                              tablaAnimales: {
                                ...prev.pdf.tablaAnimales,
                                anchoColumnas: {
                                  ...prev.pdf.tablaAnimales.anchoColumnas,
                                  [col.key]: parseFloat(e.target.value) || 0,
                                },
                              },
                            },
                          }
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
              <div className="space-y-3">
                <Label className="text-sm font-medium">Alineación</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {PDF_TABLA_ANIMALES_COLS.map(col => (
                    <div key={col.key} className="flex items-center gap-2">
                      <Label className="min-w-[100px] text-sm">{col.label}</Label>
                      <Select
                        value={config.pdf.tablaAnimales.alineacion[col.key]}
                        onValueChange={v =>
                          setConfig(prev => {
                            if (!prev) return prev
                            return {
                              ...prev,
                              pdf: {
                                ...prev.pdf,
                                tablaAnimales: {
                                  ...prev.pdf.tablaAnimales,
                                  alineacion: {
                                    ...prev.pdf.tablaAnimales.alineacion,
                                    [col.key]: v,
                                  },
                                },
                              },
                            }
                          })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Izquierda</SelectItem>
                          <SelectItem value="center">Centro</SelectItem>
                          <SelectItem value="right">Derecha</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabla Menudencia */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tabla Menudencia — Ancho de Columnas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {PDF_TABLA_MENUDENCIA_COLS.map(col => (
                  <div key={col.key} className="flex items-center gap-2">
                    <Label className="min-w-[100px] text-sm">{col.label}</Label>
                    <Input
                      type="number"
                      step={1}
                      min={0}
                      value={config.pdf.tablaMenudencia.anchoColumnas[col.key] ?? 0}
                      onChange={e =>
                        setConfig(prev => {
                          if (!prev) return prev
                          return {
                            ...prev,
                            pdf: {
                              ...prev.pdf,
                              tablaMenudencia: {
                                ...prev.pdf.tablaMenudencia,
                                anchoColumnas: {
                                  ...prev.pdf.tablaMenudencia.anchoColumnas,
                                  [col.key]: parseFloat(e.target.value) || 0,
                                },
                              },
                            },
                          }
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Colores */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Colores (RGB)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(Object.entries(COLOR_LABELS) as [string, string][]).map(([colorKey, label]) => {
                const rgb = config.pdf.colores[colorKey] || [0, 0, 0]
                return (
                  <div key={colorKey} className="space-y-2">
                    <Label className="text-sm font-medium">{label}</Label>
                    <div className="flex items-center gap-3">
                      {/* Color preview */}
                      <div
                        className="w-8 h-8 rounded border shrink-0"
                        style={{ backgroundColor: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` }}
                      />
                      <div className="flex gap-2">
                        {(['R', 'G', 'B'] as const).map((ch, idx) => (
                          <div key={ch} className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground w-3">{ch}</span>
                            <Input
                              type="number"
                              min={0}
                              max={255}
                              className="w-16"
                              value={rgb[idx]}
                              onChange={e => {
                                const val = Math.min(255, Math.max(0, parseInt(e.target.value) || 0))
                                updatePdfArrayColor(colorKey, idx, val)
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">
                        [{rgb[0]}, {rgb[1]}, {rgb[2]}]
                      </span>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Separación */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Separación</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Filas antes de tabla</Label>
                <Input
                  type="number"
                  step={1}
                  min={0}
                  value={config.pdf.separacion.antesDeTabla}
                  onChange={e => updatePdf('separacion', 'antesDeTabla', parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Filas después de tabla</Label>
                <Input
                  type="number"
                  step={1}
                  min={0}
                  value={config.pdf.separacion.despuesDeTabla}
                  onChange={e => updatePdf('separacion', 'despuesDeTabla', parseInt(e.target.value) || 0)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur-sm z-50">
        <div className="container mx-auto flex items-center justify-end gap-3 px-6 py-3">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={saving}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Restaurar Valores por Defecto
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Guardar Cambios
          </Button>
        </div>
      </div>
    </div>
  )
}
