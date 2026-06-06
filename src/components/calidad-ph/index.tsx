'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Activity, Download, AlertTriangle, TrendingUp, BarChart3, Filter, Save,
  Thermometer, Clock, User, Eye, Trash2, Edit2, Plus, Minus, ChevronLeft, ChevronRight
} from 'lucide-react'

// ============================================
// Tipos
// ============================================
interface Operador {
  id: string
  nombre: string
  rol: string
}

interface MedicionPH {
  id: string
  mediaResId: string
  valorPH: number
  clasificacion: string
  temperatura?: number
  horaMedicion: string
  numeroMedicion: number
  operadorId?: string
  medidoPor?: string
  tropaCodigo?: string
  garron?: number
  tipoAnimal?: string
  raza?: string
  ladoMedia?: string
  productorNombre?: string
  productorId?: string
  usuarioFaenaNombre?: string
  observaciones?: string
  mediaRes?: {
    id: string
    codigo: string
    peso: number
    estado: string
    lado: string
    sigla: string
  }
  operador?: { id: string; nombre: string }
}

interface MediaResItem {
  id: string
  codigo: string
  peso: number
  estado: string
  lado: string
  sigla: string
  romaneo: {
    id: string
    tropaCodigo?: string
    garron: number
    tipoAnimal?: string
    raza?: string
  }
  camara?: { id: string; nombre: string }
  usuarioFaena?: { id: string; nombre: string }
  medicionesPH?: MedicionPH[]
}

interface TropaItem {
  id: string
  numero: number
  codigo: string
  especie: string
  cantidadCabezas: number
  estado: string
  fechaFaena?: string
  productor?: { id: string; nombre: string }
  usuarioFaena?: { id: string; nombre: string }
}

// ============================================
// Configuración de rangos (compartida entre componentes)
// ============================================
interface ConfigPH {
  umbralPSE: number
  umbralNormMax: number
  umbralIntMax: number
  rangos?: {
    ALTO: string
    NORMAL: string
    INTERMEDIO: string
    DFD: string
  }
}

// Cache de configuración accesible globalmente en el cliente
let configCache: ConfigPH | null = null
let configFetchPromise: Promise<ConfigPH | null> | null = null

export async function fetchConfigPH(): Promise<ConfigPH> {
  if (configCache) return configCache
  if (configFetchPromise) return configFetchPromise.then(c => c!)
  configFetchPromise = fetch('/api/calidad-ph/config')
    .then(r => r.json())
    .then(json => {
      if (json.success && json.data) {
        configCache = json.data
        return configCache!
      }
      return { umbralPSE: 5.4, umbralNormMax: 5.7, umbralIntMax: 5.9 }
    })
    .catch(() => ({ umbralPSE: 5.4, umbralNormMax: 5.7, umbralIntMax: 5.9 }))
  return configFetchPromise as Promise<ConfigPH>
}

export function invalidateConfigCache() {
  configCache = null
  configFetchPromise = null
}

// ============================================
// Colores y utilidades de clasificación
// ============================================
function getColorClasificacion(clasificacion: string) {
  switch (clasificacion) {
    case 'NORMAL': return 'bg-green-100 text-green-800 border-green-300'
    case 'INTERMEDIO': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    case 'DFD': return 'bg-red-100 text-red-800 border-red-300'
    case 'ALTO': return 'bg-orange-100 text-orange-800 border-orange-300'
    default: return 'bg-gray-100 text-gray-600 border-gray-300'
  }
}

function getLabelClasificacion(clasificacion: string, config?: ConfigPH | null) {
  const c = config || configCache
  switch (clasificacion) {
    case 'NORMAL': return `Normal (${c?.umbralPSE || 5.4}-${c?.umbralNormMax || 5.7})`
    case 'INTERMEDIO': return `Intermedio (${Number(((c?.umbralNormMax || 5.7) + 0.1).toFixed(1))}-${c?.umbralIntMax || 5.9})`
    case 'DFD': return `DFD (>${c?.umbralIntMax || 5.9})`
    case 'ALTO': return `Alto (<${c?.umbralPSE || 5.4}) PSE`
    default: return 'Sin clasificar'
  }
}

async function clasificarPHLocal(valorPH: number): Promise<string> {
  const config = await fetchConfigPH()
  if (valorPH < config.umbralPSE) return 'ALTO'
  if (valorPH <= config.umbralNormMax) return 'NORMAL'
  if (valorPH <= config.umbralIntMax) return 'INTERMEDIO'
  return 'DFD'
}

// ============================================
// Componente Principal
// ============================================
interface CalidadPHModuleProps {
  operador: Operador
}

export function CalidadPHModule({ operador }: CalidadPHModuleProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-100">
            <Activity className="h-6 w-6 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-stone-800">Control de pH</h2>
            <p className="text-sm text-stone-500">Mediciones de pH en medias reses - Calidad</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="registro" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="registro" className="flex items-center gap-2">
            <Thermometer className="h-4 w-4" />
            Registro
          </TabsTrigger>
          <TabsTrigger value="reportes" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Reportes
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            Config
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registro">
          <RegistroPHTab operador={operador} />
        </TabsContent>
        <TabsContent value="reportes">
          <ReportesPHTab />
        </TabsContent>
        <TabsContent value="config">
          <ConfigPHTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Clasificación síncrona usando el cache (debe llamarse después de fetchConfigPH)
function clasificarPHSync(valorPH: number, config?: ConfigPH | null): string {
  const c = config || configCache
  if (!c) return 'SIN_CLASIFICAR'
  if (valorPH < c.umbralPSE) return 'ALTO'
  if (valorPH <= c.umbralNormMax) return 'NORMAL'
  if (valorPH <= c.umbralIntMax) return 'INTERMEDIO'
  return 'DFD'
}

// ============================================
// TAB 1: REGISTRO DE pH
// ============================================
function RegistroPHTab({ operador }: { operador: Operador }) {
  const [tropas, setTropas] = useState<TropaItem[]>([])
  const [tropaSeleccionada, setTropaSeleccionada] = useState<string>('')
  const [mediasRes, setMediasRes] = useState<MediaResItem[]>([])
  const [loading, setLoading] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [configPH, setConfigPH] = useState<ConfigPH | null>(null)

  // Formularios de pH por media res
  const [valoresPH, setValoresPH] = useState<Record<string, string>>({})
  const [temperaturas, setTemperaturas] = useState<Record<string, string>>({})
  const [horas, setHoras] = useState<Record<string, string>>({})
  const [observaciones, setObservaciones] = useState<Record<string, string>>({})
  const [medidor, setMedidor] = useState<string>(operador.nombre || '')

  // Segunda medición
  const [valoresPH2, setValoresPH2] = useState<Record<string, string>>({})
  const [horas2, setHoras2] = useState<Record<string, string>>({})

  // Tercera medición
  const [valoresPH3, setValoresPH3] = useState<Record<string, string>>({})
  const [horas3, setHoras3] = useState<Record<string, string>>({})

  // Dialog de detalle
  const [detalleOpen, setDetalleOpen] = useState(false)
  const [medicionDetalle, setMedicionDetalle] = useState<MedicionPH | null>(null)

  // Cargar tropas faenadas (últimos 30 días) y configuración de pH
  useEffect(() => {
    cargarTropas()
    fetchConfigPH().then(setConfigPH)
  }, [])

  const cargarTropas = async () => {
    setLoading(true)
    try {
      const desde = new Date()
      desde.setDate(desde.getDate() - 30)
      const res = await fetch(`/api/tropas?estado=FAENADO&fechaDesde=${desde.toISOString()}&limit=50`)
      if (res.ok) {
        const json = await res.json()
        setTropas(json.data || json.tropas || [])
      }
    } catch (err) {
      console.error('Error cargando tropas:', err)
    } finally {
      setLoading(false)
    }
  }

  // Cargar medias res de la tropa seleccionada
  const seleccionarTropa = async (tropaCodigo: string) => {
    setTropaSeleccionada(tropaCodigo)
    if (!tropaCodigo) {
      setMediasRes([])
      return
    }
    setLoading(true)
    try {
      // Buscar medias res directamente por tropaCodigo (con autoGenerar)
      const res = await fetch(`/api/medias-res?tropaCodigo=${encodeURIComponent(tropaCodigo)}&autoGenerar=true&limit=500`)
      if (res.ok) {
        const json = await res.json()
        const todasMedias: MediaResItem[] = (json.data || []).map((mr: any) => ({
          ...mr,
          romaneo: mr.romaneo || { tropaCodigo, garron: 0 }
        }))
        setMediasRes(todasMedias)

        // Cargar mediciones existentes para pre-llenar
        const resPH = await fetch(`/api/calidad-ph?tropaCodigo=${tropaCodigo}`)
        if (resPH.ok) {
          const jsonPH = await resPH.json()
          const mediciones = jsonPH.data || []
          const newPH: Record<string, string> = {}
          const newTemp: Record<string, string> = {}
          const newHoras: Record<string, string> = {}
          const newObs: Record<string, string> = {}
          const newPH2: Record<string, string> = {}
          const newHoras2: Record<string, string> = {}
          const newPH3: Record<string, string> = {}
          const newHoras3: Record<string, string> = {}

          mediciones.forEach((m: MedicionPH) => {
            if (m.numeroMedicion === 1) {
              newPH[m.mediaResId] = String(m.valorPH)
              if (m.temperatura) newTemp[m.mediaResId] = String(m.temperatura)
              newHoras[m.mediaResId] = new Date(m.horaMedicion).toISOString().slice(0, 16)
              newObs[m.mediaResId] = m.observaciones || ''
              if (m.medidoPor) setMedidor(m.medidoPor)
            } else if (m.numeroMedicion === 2) {
              newPH2[m.mediaResId] = String(m.valorPH)
              newHoras2[m.mediaResId] = new Date(m.horaMedicion).toISOString().slice(0, 16)
            } else if (m.numeroMedicion === 3) {
              newPH3[m.mediaResId] = String(m.valorPH)
              newHoras3[m.mediaResId] = new Date(m.horaMedicion).toISOString().slice(0, 16)
            }
          })

          setValoresPH(newPH)
          setTemperaturas(newTemp)
          setHoras(newHoras)
          setObservaciones(newObs)
          setValoresPH2(newPH2)
          setHoras2(newHoras2)
          setValoresPH3(newPH3)
          setHoras3(newHoras3)
        }
      }
    } catch (err) {
      console.error('Error cargando medias res:', err)
      toast.error('Error al cargar medias res')
    } finally {
      setLoading(false)
    }
  }

  // Guardar todas las mediciones
  const guardarMediciones = async () => {
    const medicionesAEnviar: any[] = []

    // Medición 1
    Object.entries(valoresPH as Record<string, string>).forEach(([mediaResId, valorStr]) => {
      const valorPH = parseFloat(valorStr as string)
      if (isNaN(valorPH) || valorPH <= 0) return
      const hora = horas[mediaResId] || new Date().toISOString().slice(0, 16)
      medicionesAEnviar.push({
        mediaResId,
        valorPH,
        temperatura: temperaturas[mediaResId] ? parseFloat(temperaturas[mediaResId]) : null,
        horaMedicion: new Date(hora).toISOString(),
        numeroMedicion: 1,
        observaciones: observaciones[mediaResId] || null,
        operadorId: operador.id
      })
    })

    // Medición 2 (opcional)
    Object.entries(valoresPH2 as Record<string, string>).forEach(([mediaResId, valorStr]) => {
      const valorPH = parseFloat(valorStr as string)
      if (isNaN(valorPH) || valorPH <= 0) return
      const hora = horas2[mediaResId] || new Date().toISOString().slice(0, 16)
      medicionesAEnviar.push({
        mediaResId,
        valorPH,
        horaMedicion: new Date(hora).toISOString(),
        numeroMedicion: 2,
        operadorId: operador.id
      })
    })

    // Medición 3 (opcional)
    Object.entries(valoresPH3 as Record<string, string>).forEach(([mediaResId, valorStr]) => {
      const valorPH = parseFloat(valorStr as string)
      if (isNaN(valorPH) || valorPH <= 0) return
      const hora = horas3[mediaResId] || new Date().toISOString().slice(0, 16)
      medicionesAEnviar.push({
        mediaResId,
        valorPH,
        horaMedicion: new Date(hora).toISOString(),
        numeroMedicion: 3,
        operadorId: operador.id
      })
    })

    if (medicionesAEnviar.length === 0) {
      toast.error('No hay mediciones para guardar')
      return
    }

    setGuardando(true)
    try {
      const res = await fetch('/api/calidad-ph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(medicionesAEnviar)
      })
      const json = await res.json()
      if (json.success) {
        const creadas = json.data.filter((r: any) => r.success).length
        toast.success(`${creadas} medicion(es) de pH guardada(s) correctamente`)
      } else {
        toast.error('Error al guardar mediciones')
      }
    } catch (err) {
      console.error('Error guardando:', err)
      toast.error('Error de conexión')
    } finally {
      setGuardando(false)
    }
  }

  // Ver detalle de mediciones de una media res
  const verDetalle = async (mediaResId: string) => {
    try {
      const res = await fetch(`/api/calidad-ph?mediaResId=${mediaResId}&incluirMediaRes=true`)
      if (res.ok) {
        const json = await res.json()
        const mediciones = json.data || []
        if (mediciones.length > 0) {
          setMedicionDetalle(mediciones[0])
          setDetalleOpen(true)
        } else {
          toast.info('No hay mediciones de pH para esta media res')
        }
      }
    } catch (err) {
      console.error('Error:', err)
    }
  }

  // Eliminar medición
  const eliminarMedicion = async (id: string) => {
    if (!confirm('¿Eliminar esta medición de pH?')) return
    try {
      const res = await fetch(`/api/calidad-ph?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Medición eliminada')
        if (tropaSeleccionada) seleccionarTropa(tropaSeleccionada)
        setDetalleOpen(false)
      }
    } catch (err) {
      toast.error('Error al eliminar')
    }
  }

  // KPIs de la tropa seleccionada
  const kpis = mediasRes.length > 0 ? (() => {
    const conPH = Object.entries(valoresPH as Record<string, string>).filter(([_, v]) => !isNaN(parseFloat(v as string)) && parseFloat(v as string) > 0)
    const valores = conPH.map(([_, v]) => parseFloat(v as string))
    const dfd = valores.filter(v => clasificarPHSync(v, configPH) === 'DFD').length
    const normal = valores.filter(v => clasificarPHSync(v, configPH) === 'NORMAL').length
    return {
      totalMedias: mediasRes.length,
      medidasConPH: conPH.length,
      pendientes: mediasRes.length - conPH.length,
      promedio: valores.length > 0 ? (valores.reduce((s, v) => s + v, 0) / valores.length).toFixed(2) : '-',
      dfd,
      normal,
      pctDFD: conPH.length > 0 ? ((dfd / conPH.length) * 100).toFixed(1) : '0',
      pctNormal: conPH.length > 0 ? ((normal / conPH.length) * 100).toFixed(1) : '0'
    }
  })() : null

  return (
    <div className="space-y-4">
      {/* Selector de tropa */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Selección de Tropa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label className="text-xs text-stone-500 mb-1 block">Tropa</Label>
              <Select value={tropaSeleccionada} onValueChange={seleccionarTropa}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={loading ? 'Cargando...' : 'Seleccionar tropa faenada'} />
                </SelectTrigger>
                <SelectContent>
                  {tropas.map(t => (
                    <SelectItem key={t.id} value={t.codigo}>
                      {t.codigo} - {t.usuarioFaena?.nombre || t.productor?.nombre || 'S/Usuario'} ({t.cantidadCabezas} cabezas)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-stone-500 mb-1 block">Medido por</Label>
              <Input value={medidor} onChange={e => setMedidor(e.target.value)} placeholder="Nombre del operador" />
            </div>
          </div>
        </CardContent>
      </Card>

      {tropaSeleccionada && kpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Card className="p-3 text-center">
            <p className="text-xs text-stone-500">Total Medias</p>
            <p className="text-2xl font-bold">{kpis.totalMedias}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-stone-500">Con pH</p>
            <p className="text-2xl font-bold text-green-700">{kpis.medidasConPH}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-stone-500">Pendientes</p>
            <p className="text-2xl font-bold text-yellow-700">{kpis.pendientes}</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-stone-500">Promedio pH</p>
            <p className="text-2xl font-bold">{kpis.promedio}</p>
          </Card>
          <Card className="p-3 text-center bg-green-50">
            <p className="text-xs text-stone-500">% Normal</p>
            <p className="text-2xl font-bold text-green-700">{kpis.pctNormal}%</p>
          </Card>
          <Card className="p-3 text-center bg-red-50">
            <p className="text-xs text-stone-500">% DFD</p>
            <p className="text-2xl font-bold text-red-700">{kpis.pctDFD}%</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xs text-stone-500">DFD (cant.)</p>
            <p className="text-2xl font-bold text-red-700">{kpis.dfd}</p>
          </Card>
        </div>
      )}

      {/* Tabla de medias res con pH */}
      {tropaSeleccionada && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-lg">
              Medias Reses - Registro de pH
            </CardTitle>
            <Button onClick={guardarMediciones} disabled={guardando} className="bg-emerald-600 hover:bg-emerald-700">
              <Save className="h-4 w-4 mr-2" />
              {guardando ? 'Guardando...' : 'Guardar Todas'}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-stone-50">
                    <TableHead className="text-xs">Garrón</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Lado</TableHead>
                    <TableHead className="text-xs">Peso (kg)</TableHead>
                    <TableHead className="text-xs">pH 1</TableHead>
                    <TableHead className="text-xs">Clasif.</TableHead>
                    <TableHead className="text-xs">Temp. (°C)</TableHead>
                    <TableHead className="text-xs">Hora Med.</TableHead>
                    <TableHead className="text-xs">pH 2</TableHead>
                    <TableHead className="text-xs">Hora 2</TableHead>
                    <TableHead className="text-xs">pH 3</TableHead>
                    <TableHead className="text-xs">Hora 3</TableHead>
                    <TableHead className="text-xs">Obs.</TableHead>
                    <TableHead className="text-xs">Acc.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center py-8 text-stone-500">
                        Cargando medias reses...
                      </TableCell>
                    </TableRow>
                  ) : mediasRes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center py-8 text-stone-500">
                        No se encontraron medias reses para esta tropa
                      </TableCell>
                    </TableRow>
                  ) : (
                    mediasRes.map((mr) => {
                      const ph1 = valoresPH[mr.id] || ''
                      const clasif1 = ph1 ? clasificarPHSync(parseFloat(ph1), configPH) : ''
                      return (
                        <TableRow key={mr.id} className={clasif1 === 'DFD' ? 'bg-red-50' : clasif1 === 'ALTO' ? 'bg-orange-50' : ''}>
                          <TableCell className="text-xs font-mono">{mr.romaneo?.garron || '-'}</TableCell>
                          <TableCell className="text-xs">{mr.romaneo?.tipoAnimal || '-'}</TableCell>
                          <TableCell className="text-xs">{mr.lado === 'IZQUIERDA' ? 'IZQ' : 'DER'}</TableCell>
                          <TableCell className="text-xs">{mr.peso.toFixed(1)}</TableCell>
                          {/* pH 1 */}
                          <TableCell className="w-20">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={ph1}
                              onChange={e => setValoresPH(prev => ({ ...prev, [mr.id]: e.target.value }))}
                              className="h-9 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder="pH"
                            />
                          </TableCell>
                          <TableCell>
                            {clasif1 && (
                              <Badge variant="outline" className={`text-xs ${getColorClasificacion(clasif1)}`}>
                                {clasif1}
                              </Badge>
                            )}
                          </TableCell>
                          {/* Temperatura */}
                          <TableCell className="w-20">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={temperaturas[mr.id] || ''}
                              onChange={e => setTemperaturas(prev => ({ ...prev, [mr.id]: e.target.value }))}
                              className="h-9 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder="°C"
                            />
                          </TableCell>
                          {/* Hora Medición 1 */}
                          <TableCell className="w-36">
                            <Input
                              type="datetime-local"
                              value={horas[mr.id] || ''}
                              onChange={e => setHoras(prev => ({ ...prev, [mr.id]: e.target.value }))}
                              className="h-8 text-xs"
                            />
                          </TableCell>
                          {/* pH 2 */}
                          <TableCell className="w-20">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={valoresPH2[mr.id] || ''}
                              onChange={e => setValoresPH2(prev => ({ ...prev, [mr.id]: e.target.value }))}
                              className="h-9 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder="pH2"
                            />
                          </TableCell>
                          {/* Hora 2 */}
                          <TableCell className="w-36">
                            <Input
                              type="datetime-local"
                              value={horas2[mr.id] || ''}
                              onChange={e => setHoras2(prev => ({ ...prev, [mr.id]: e.target.value }))}
                              className="h-8 text-xs"
                            />
                          </TableCell>
                          {/* pH 3 */}
                          <TableCell className="w-20">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={valoresPH3[mr.id] || ''}
                              onChange={e => setValoresPH3(prev => ({ ...prev, [mr.id]: e.target.value }))}
                              className="h-9 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder="pH3"
                            />
                          </TableCell>
                          {/* Hora 3 */}
                          <TableCell className="w-36">
                            <Input
                              type="datetime-local"
                              value={horas3[mr.id] || ''}
                              onChange={e => setHoras3(prev => ({ ...prev, [mr.id]: e.target.value }))}
                              className="h-8 text-xs"
                            />
                          </TableCell>
                          {/* Observaciones */}
                          <TableCell className="w-32">
                            <Input
                              value={observaciones[mr.id] || ''}
                              onChange={e => setObservaciones(prev => ({ ...prev, [mr.id]: e.target.value }))}
                              className="h-8 text-xs"
                              placeholder="Obs."
                            />
                          </TableCell>
                          {/* Acciones */}
                          <TableCell>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => verDetalle(mr.id)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leyenda de clasificación dinámica */}
      {tropaSeleccionada && configPH && (
        <Card className="p-3">
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="font-semibold text-stone-600">Leyenda:</span>
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Normal: {configPH.umbralPSE} - {configPH.umbralNormMax}</Badge>
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Intermedio: {Number((configPH.umbralNormMax + 0.1).toFixed(1))} - {configPH.umbralIntMax}</Badge>
            <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">DFD: &gt; {configPH.umbralIntMax}</Badge>
            <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">Alto (PSE): &lt; {configPH.umbralPSE}</Badge>
          </div>
        </Card>
      )}

      {/* Dialog de detalle */}
      <Dialog open={detalleOpen} onOpenChange={setDetalleOpen}>
        <DialogContent className="max-w-2xl" maximizable>
          <DialogHeader>
            <DialogTitle>Detalle de Mediciones de pH</DialogTitle>
            <DialogDescription>
              {medicionDetalle?.tropaCodigo} - Garrón {medicionDetalle?.garron} - {medicionDetalle?.ladoMedia} - {medicionDetalle?.tipoAnimal}
            </DialogDescription>
          </DialogHeader>
          {medicionDetalle && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-stone-500">Código Media Res</Label>
                  <p className="font-mono text-sm">{medicionDetalle.mediaRes?.codigo || '-'}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-stone-500">Productor</Label>
                  <p className="text-sm">{medicionDetalle.productorNombre || '-'}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-stone-500">Usuario Faena</Label>
                  <p className="text-sm">{medicionDetalle.usuarioFaenaNombre || '-'}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-stone-500">Medido por</Label>
                  <p className="text-sm">{medicionDetalle.medidoPor || '-'}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-stone-500">Clasificación</Label>
                  <Badge variant="outline" className={getColorClasificacion(medicionDetalle.clasificacion)}>
                    {getLabelClasificacion(medicionDetalle.clasificacion)}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-stone-500">Raza</Label>
                  <p className="text-sm">{medicionDetalle.raza || '-'}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="destructive" size="sm" onClick={() => eliminarMedicion(medicionDetalle.id)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar Medición
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// TAB 2: REPORTES DE pH
// ============================================
function ReportesPHTab() {
  const [subTab, setSubTab] = useState('resumen')
  const [loading, setLoading] = useState(false)

  // Filtros
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [filtroTropa, setFiltroTropa] = useState('')
  const [filtroProductor, setFiltroProductor] = useState('')
  const [filtroUsuarioFaena, setFiltroUsuarioFaena] = useState('__TODOS__')
  const [filtroTipoAnimal, setFiltroTipoAnimal] = useState('__TODOS__')
  const [filtroClasificacion, setFiltroClasificacion] = useState('TODAS')
  const [filtroPhMin, setFiltroPhMin] = useState('')
  const [filtroPhMax, setFiltroPhMax] = useState('')
  const [filtroPesoMin, setFiltroPesoMin] = useState('')
  const [filtroPesoMax, setFiltroPesoMax] = useState('')

  // Listas para dropdowns
  const [listaUsuariosFaena, setListaUsuariosFaena] = useState<{id: string, nombre: string}[]>([])
  const [listaProductores, setListaProductores] = useState<{id: string, nombre: string}[]>([])
  const [listaTropas, setListaTropas] = useState<{id: string, codigo: string, numero: number, label: string}[]>([])
  const [listaTiposAnimal, setListaTiposAnimal] = useState<{value: string, label: string}[]>([])

  // Datos
  const [resumen, setResumen] = useState<any>(null)
  const [detalle, setDetalle] = useState<any>(null)
  const [correlacionDFD, setCorrelacionDFD] = useState<any>(null)
  const [controlEstadistico, setControlEstadistico] = useState<any>(null)

  // Paginación
  const [page, setPage] = useState(1)

  // Cargar listas para dropdowns
  useEffect(() => {
    fetch('/api/calidad-ph/reportes?modo=listas')
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (json?.data) {
          setListaUsuariosFaena(json.data.usuariosFaena || [])
          setListaProductores(json.data.productores || [])
          setListaTropas(json.data.tropas || [])
          setListaTiposAnimal(json.data.tiposAnimal || [])
        }
      })
      .catch(err => console.error('Error cargando listas:', err))
  }, [])

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (fechaDesde) params.set('fechaDesde', fechaDesde)
      if (fechaHasta) params.set('fechaHasta', fechaHasta)
      if (filtroTropa && filtroTropa !== '__TODOS__') params.set('tropaCodigo', filtroTropa)
      if (filtroProductor && filtroProductor !== '__TODOS__') params.set('productorId', filtroProductor)
      if (filtroUsuarioFaena && filtroUsuarioFaena !== '__TODOS__') params.set('usuarioFaenaId', filtroUsuarioFaena)
      if (filtroTipoAnimal && filtroTipoAnimal !== '__TODOS__') params.set('tipoAnimal', filtroTipoAnimal)

      if (subTab === 'resumen') {
        const res = await fetch(`/api/calidad-ph/reportes?modo=resumen&${params}`)
        if (res.ok) {
          const json = await res.json()
          setResumen(json.data)
        }
      } else if (subTab === 'detalle') {
        const dParams = new URLSearchParams(params)
        if (filtroClasificacion !== 'TODAS') dParams.set('clasificacion', filtroClasificacion)
        if (filtroPhMin) dParams.set('phMin', filtroPhMin)
        if (filtroPhMax) dParams.set('phMax', filtroPhMax)
        if (filtroPesoMin) dParams.set('pesoMin', filtroPesoMin)
        if (filtroPesoMax) dParams.set('pesoMax', filtroPesoMax)
        dParams.set('page', String(page))
        const res = await fetch(`/api/calidad-ph/reportes?modo=detalle&${dParams}`)
        if (res.ok) {
          const json = await res.json()
          setDetalle(json.data)
        }
      } else if (subTab === 'dfd-productor') {
        const res = await fetch(`/api/calidad-ph/reportes?modo=dfd-productor&${params}`)
        if (res.ok) {
          const json = await res.json()
          setCorrelacionDFD(json.data)
        }
      } else if (subTab === 'control-estadistico') {
        const res = await fetch(`/api/calidad-ph/reportes?modo=control-estadistico&${params}`)
        if (res.ok) {
          const json = await res.json()
          setControlEstadistico(json.data)
        }
      }
    } catch (err) {
      console.error('Error cargando reporte:', err)
      toast.error('Error al cargar reporte')
    } finally {
      setLoading(false)
    }
  }, [subTab, fechaDesde, fechaHasta, filtroTropa, filtroProductor, filtroUsuarioFaena, filtroTipoAnimal, filtroClasificacion, filtroPhMin, filtroPhMax, filtroPesoMin, filtroPesoMax, page])

  useEffect(() => {
    cargarDatos()
  }, [cargarDatos])

  // Exportar a CSV
  const exportarCSV = async () => {
    try {
      const params = new URLSearchParams()
      if (fechaDesde) params.set('fechaDesde', fechaDesde)
      if (fechaHasta) params.set('fechaHasta', fechaHasta)
      if (filtroTropa && filtroTropa !== '__TODOS__') params.set('tropaCodigo', filtroTropa)
      if (filtroProductor && filtroProductor !== '__TODOS__') params.set('productorId', filtroProductor)
      params.set('limit', '10000')

      const res = await fetch(`/api/calidad-ph?${params}`)
      if (res.ok) {
        const json = await res.json()
        const data = json.data || []

        const headers = ['Tropa', 'Garrón', 'Tipo', 'Raza', 'Lado', 'pH', 'Clasificación', 'Temperatura', 'Hora', 'Medido por', 'Productor', 'Usuario Faena', 'Observaciones']
        const rows = data.map((m: MedicionPH) => [
          m.tropaCodigo || '', m.garron || '', m.tipoAnimal || '', m.raza || '', m.ladoMedia || '',
          m.valorPH, m.clasificacion, m.temperatura || '', m.horaMedicion, m.medidoPor || '',
          m.productorNombre || '', m.usuarioFaenaNombre || '', m.observaciones || ''
        ])

        const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n')
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `reporte_ph_${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('CSV exportado correctamente')
      }
    } catch (err) {
      toast.error('Error al exportar CSV')
    }
  }

  // Canvas para gráfico X-barra
  const canvasRef = useCallback((node: HTMLCanvasElement | null) => {
    if (!node || !controlEstadistico) return
    const ctx = node.getContext('2d')
    if (!ctx) return

    const { datosControl, limitesXBarra, limitesR } = controlEstadistico
    const W = node.width = node.offsetWidth * 2
    const H = node.height = 300 * 2
    ctx.scale(2, 2)
    const w = node.offsetWidth
    const h = 300

    ctx.fillStyle = '#fafaf9'
    ctx.fillRect(0, 0, w, h)

    // Gráfico X-barra (mitad superior)
    drawChart(ctx, 0, 0, w, h / 2 - 10, datosControl.map(d => d.media), limitesXBarra, 'X-barra (Media pH por Tropa)', '#059669')

    // Gráfico R (mitad inferior)
    drawChart(ctx, 0, h / 2 + 10, w, h / 2 - 10, datosControl.map(d => d.rango), limitesR, 'R (Rango por Tropa)', '#2563eb')
  }, [controlEstadistico])

  function drawChart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, values: number[], limits: any, title: string, color: string) {
    const padding = { top: 30, bottom: 30, left: 50, right: 20 }
    const chartW = w - padding.left - padding.right
    const chartH = h - padding.top - padding.bottom

    if (values.length === 0) return

    const allValues = [...values, limits.UCL, limits.CL, limits.LCL].filter(v => v !== undefined)
    const minV = Math.floor(Math.min(...allValues) * 2) / 2 - 0.5
    const maxV = Math.ceil(Math.max(...allValues) * 2) / 2 + 0.5

    // Título
    ctx.fillStyle = '#292524'
    ctx.font = 'bold 12px sans-serif'
    ctx.fillText(title, x + padding.left, y + 15)

    // Límites de control
    const yPos = (v: number) => y + padding.top + chartH - ((v - minV) / (maxV - minV)) * chartH

    // Zona fuera de control (roja clara)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)'
    if (limits.UCL !== undefined) {
      ctx.fillRect(x + padding.left, y + padding.top, chartW, yPos(limits.UCL) - y - padding.top)
    }
    if (limits.LCL !== undefined) {
      ctx.fillRect(x + padding.left, yPos(limits.LCL), chartW, y + padding.top + chartH - yPos(limits.LCL))
    }

    // Líneas de control
    const drawLine = (v: number, color: string, dash: number[]) => {
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.setLineDash(dash)
      ctx.beginPath()
      ctx.moveTo(x + padding.left, yPos(v))
      ctx.lineTo(x + padding.left + chartW, yPos(v))
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = color
      ctx.font = '9px sans-serif'
      ctx.fillText(v.toFixed(2), x + padding.left + chartW + 2, yPos(v) + 3)
    }

    if (limits.UCL !== undefined) drawLine(limits.UCL, '#ef4444', [4, 4])
    if (limits.CL !== undefined) drawLine(limits.CL, '#059669', [])
    if (limits.LCL !== undefined) drawLine(limits.LCL, '#ef4444', [4, 4])

    // Eje Y
    ctx.strokeStyle = '#a8a29e'
    ctx.lineWidth = 0.5
    for (let v = minV; v <= maxV; v += 0.5) {
      const py = yPos(v)
      ctx.beginPath()
      ctx.moveTo(x + padding.left, py)
      ctx.lineTo(x + padding.left + chartW, py)
      ctx.stroke()
      ctx.fillStyle = '#78716c'
      ctx.font = '9px sans-serif'
      ctx.fillText(v.toFixed(1), x + 5, py + 3)
    }

    // Puntos
    const step = values.length > 1 ? chartW / (values.length - 1) : 0
    values.forEach((v, i) => {
      const px = x + padding.left + (values.length > 1 ? i * step : chartW / 2)
      const py = yPos(v)
      const outOfControl = (limits.UCL !== undefined && v > limits.UCL) || (limits.LCL !== undefined && v < limits.LCL)

      ctx.fillStyle = outOfControl ? '#ef4444' : color
      ctx.beginPath()
      ctx.arc(px, py, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1
      ctx.stroke()
    })

    // Conectar puntos
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.beginPath()
    values.forEach((v, i) => {
      const px = x + padding.left + (values.length > 1 ? i * step : chartW / 2)
      const py = yPos(v)
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.stroke()
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros de Búsqueda
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportarCSV}>
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
              <Button size="sm" onClick={cargarDatos} disabled={loading}>
                <TrendingUp className="h-4 w-4 mr-2" />
                {loading ? 'Cargando...' : 'Buscar'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs text-stone-500">Fecha Desde</Label>
              <Input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs text-stone-500">Fecha Hasta</Label>
              <Input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className="h-9" />
            </div>
            <div>
              <Label className="text-xs text-stone-500">Usuario Faena</Label>
              <Select value={filtroUsuarioFaena} onValueChange={v => setFiltroUsuarioFaena(v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__TODOS__">Todos</SelectItem>
                  {listaUsuariosFaena.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-stone-500">Productor</Label>
              <Select value={filtroProductor} onValueChange={v => setFiltroProductor(v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__TODOS__">Todos</SelectItem>
                  {listaProductores.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-stone-500">Tropa</Label>
              <Select value={filtroTropa} onValueChange={v => setFiltroTropa(v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__TODOS__">Todas</SelectItem>
                  {listaTropas.map(t => (
                    <SelectItem key={t.id} value={t.codigo}>{t.codigo} (N° {t.numero})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-stone-500">Tipo Animal</Label>
              <Select value={filtroTipoAnimal} onValueChange={v => setFiltroTipoAnimal(v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__TODOS__">Todos</SelectItem>
                  {listaTiposAnimal.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-stone-500">Clasificación</Label>
              <Select value={filtroClasificacion} onValueChange={setFiltroClasificacion}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="INTERMEDIO">Intermedio</SelectItem>
                  <SelectItem value="DFD">DFD</SelectItem>
                  <SelectItem value="ALTO">Alto (PSE)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-stone-500">Rango pH</Label>
              <div className="flex gap-1">
                <Input type="number" step="0.1" value={filtroPhMin} onChange={e => setFiltroPhMin(e.target.value)} placeholder="Min" className="h-9" />
                <Input type="number" step="0.1" value={filtroPhMax} onChange={e => setFiltroPhMax(e.target.value)} placeholder="Max" className="h-9" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-stone-500">Rango Peso (kg)</Label>
              <div className="flex gap-1">
                <Input type="number" step="0.5" value={filtroPesoMin} onChange={e => setFiltroPesoMin(e.target.value)} placeholder="Min" className="h-9" />
                <Input type="number" step="0.5" value={filtroPesoMax} onChange={e => setFiltroPesoMax(e.target.value)} placeholder="Max" className="h-9" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sub-tabs de reportes */}
      <Tabs value={subTab} onValueChange={v => { setSubTab(v); setPage(1) }}>
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="detalle">Detalle</TabsTrigger>
          <TabsTrigger value="dfd-productor">DFD-Productor</TabsTrigger>
          <TabsTrigger value="control-estadistico">Control SPC</TabsTrigger>
        </TabsList>

        {/* RESUMEN */}
        <TabsContent value="resumen">
          {loading ? (
            <Card className="p-8 text-center text-stone-500">Cargando...</Card>
          ) : resumen ? (
            <div className="space-y-4">
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                <Card className="p-3 text-center">
                  <p className="text-xs text-stone-500">Total</p>
                  <p className="text-2xl font-bold">{resumen.kpis.total}</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-xs text-stone-500">Promedio pH</p>
                  <p className="text-2xl font-bold">{resumen.kpis.promedio}</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-xs text-stone-500">Mínimo</p>
                  <p className="text-2xl font-bold text-blue-700">{resumen.kpis.minimo}</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-xs text-stone-500">Máximo</p>
                  <p className="text-2xl font-bold text-red-700">{resumen.kpis.maximo}</p>
                </Card>
                <Card className="p-3 text-center bg-green-50">
                  <p className="text-xs text-stone-500">% Normal</p>
                  <p className="text-2xl font-bold text-green-700">{resumen.kpis.porcentajeNormal}%</p>
                </Card>
                <Card className="p-3 text-center bg-yellow-50">
                  <p className="text-xs text-stone-500">% Intermedio</p>
                  <p className="text-2xl font-bold text-yellow-700">{resumen.kpis.porcentajeIntermedio}%</p>
                </Card>
                <Card className="p-3 text-center bg-red-50">
                  <p className="text-xs text-stone-500">% DFD</p>
                  <p className="text-2xl font-bold text-red-700">{resumen.kpis.porcentajeDFD}%</p>
                </Card>
              </div>

              {/* Distribución */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Distribución por Clasificación</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {resumen.distribucion.map((d: any) => (
                      <div key={d.clasificacion} className="flex items-center gap-3">
                        <Badge variant="outline" className={`w-32 justify-center ${getColorClasificacion(d.clasificacion)}`}>
                          {getLabelClasificacion(d.clasificacion)}
                        </Badge>
                        <div className="flex-1 bg-stone-100 rounded-full h-6 relative overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              d.clasificacion === 'NORMAL' ? 'bg-green-500' :
                              d.clasificacion === 'INTERMEDIO' ? 'bg-yellow-500' :
                              d.clasificacion === 'DFD' ? 'bg-red-500' : 'bg-orange-500'
                            }`}
                            style={{ width: `${d.porcentaje}%` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                            {d.cantidad} ({d.porcentaje}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Por tropa */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Resumen por Tropa</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-stone-50">
                          <TableHead className="text-xs">Tropa</TableHead>
                          <TableHead className="text-xs">Mediciones</TableHead>
                          <TableHead className="text-xs">Promedio pH</TableHead>
                          <TableHead className="text-xs">Mínimo</TableHead>
                          <TableHead className="text-xs">Máximo</TableHead>
                          <TableHead className="text-xs">DFD (cant.)</TableHead>
                          <TableHead className="text-xs">% DFD</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resumen.porTropa.map((t: any) => (
                          <TableRow key={t.tropaCodigo} className={t.porcentajeDFD > 20 ? 'bg-red-50' : ''}>
                            <TableCell className="text-xs font-mono">{t.tropaCodigo}</TableCell>
                            <TableCell className="text-xs">{t.cantidad}</TableCell>
                            <TableCell className="text-xs font-bold">{t.promedio}</TableCell>
                            <TableCell className="text-xs text-blue-700">{t.minimo}</TableCell>
                            <TableCell className="text-xs text-red-700">{t.maximo}</TableCell>
                            <TableCell className="text-xs">{t.dfdCount}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className={t.porcentajeDFD > 10 ? 'bg-red-100 text-red-800 border-red-300' : 'bg-green-100 text-green-800 border-green-300'}>
                                {t.porcentajeDFD}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {resumen.porTropa.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-6 text-stone-500 text-sm">
                              No hay datos para los filtros seleccionados
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>

        {/* DETALLE */}
        <TabsContent value="detalle">
          {loading ? (
            <Card className="p-8 text-center text-stone-500">Cargando...</Card>
          ) : detalle ? (
            <div className="space-y-4">
              {/* Alertas DFD */}
              {detalle.alertasDFD && detalle.alertasDFD.length > 0 && (
                <Card className="border-red-200 bg-red-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-red-800 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Alertas DFD ({detalle.alertasDFD.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Fecha</TableHead>
                            <TableHead className="text-xs">Tropa</TableHead>
                            <TableHead className="text-xs">Garrón</TableHead>
                            <TableHead className="text-xs">pH</TableHead>
                            <TableHead className="text-xs">Productor</TableHead>
                            <TableHead className="text-xs">Matarife</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detalle.alertasDFD.slice(0, 10).map((a: any) => (
                            <TableRow key={a.id}>
                              <TableCell className="text-xs">{new Date(a.horaMedicion).toLocaleString('es-AR')}</TableCell>
                              <TableCell className="text-xs font-mono">{a.tropaCodigo}</TableCell>
                              <TableCell className="text-xs">{a.garron}</TableCell>
                              <TableCell className="text-xs font-bold text-red-700">{a.valorPH}</TableCell>
                              <TableCell className="text-xs">{a.productorNombre || '-'}</TableCell>
                              <TableCell className="text-xs">{a.usuarioFaenaNombre || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tabla de detalle */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Detalle de Mediciones</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-stone-50">
                          <TableHead className="text-xs">Fecha</TableHead>
                          <TableHead className="text-xs">Tropa</TableHead>
                          <TableHead className="text-xs">Garrón</TableHead>
                          <TableHead className="text-xs">Tipo</TableHead>
                          <TableHead className="text-xs">Lado</TableHead>
                          <TableHead className="text-xs">pH</TableHead>
                          <TableHead className="text-xs">Clasif.</TableHead>
                          <TableHead className="text-xs">Temp.</TableHead>
                          <TableHead className="text-xs">Productor</TableHead>
                          <TableHead className="text-xs">Medido por</TableHead>
                          <TableHead className="text-xs">Obs.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(detalle.mediciones || []).map((m: MedicionPH) => (
                          <TableRow key={m.id} className={
                            m.clasificacion === 'DFD' ? 'bg-red-50' :
                            m.clasificacion === 'ALTO' ? 'bg-orange-50' : ''
                          }>
                            <TableCell className="text-xs">
                              {new Date(m.horaMedicion).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </TableCell>
                            <TableCell className="text-xs font-mono">{m.tropaCodigo}</TableCell>
                            <TableCell className="text-xs">{m.garron}</TableCell>
                            <TableCell className="text-xs">{m.tipoAnimal || '-'}</TableCell>
                            <TableCell className="text-xs">{m.ladoMedia === 'IZQUIERDA' ? 'IZQ' : m.ladoMedia === 'DERECHA' ? 'DER' : '-'}</TableCell>
                            <TableCell className="text-xs font-bold">{m.valorPH}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-xs ${getColorClasificacion(m.clasificacion)}`}>
                                {m.clasificacion}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{m.temperatura ? `${m.temperatura}°C` : '-'}</TableCell>
                            <TableCell className="text-xs">{m.productorNombre || '-'}</TableCell>
                            <TableCell className="text-xs">{m.medidoPor || m.operador?.nombre || '-'}</TableCell>
                            <TableCell className="text-xs max-w-32 truncate">{m.observaciones || '-'}</TableCell>
                          </TableRow>
                        ))}
                        {(!detalle.mediciones || detalle.mediciones.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={11} className="text-center py-6 text-stone-500 text-sm">
                              No hay mediciones para los filtros seleccionados
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Paginación */}
                  {detalle.paginacion && detalle.paginacion.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-xs text-stone-500">
                        Página {detalle.paginacion.page} de {detalle.paginacion.totalPages} ({detalle.paginacion.total} registros)
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(detalle.paginacion.totalPages, p + 1))} disabled={page >= detalle.paginacion.totalPages}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>

        {/* DFD-PRODUCTOR */}
        <TabsContent value="dfd-productor">
          {loading ? (
            <Card className="p-8 text-center text-stone-500">Cargando...</Card>
          ) : correlacionDFD ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    Correlación DFD - Productor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-stone-50">
                          <TableHead className="text-xs">Productor</TableHead>
                          <TableHead className="text-xs">Total Med.</TableHead>
                          <TableHead className="text-xs">Prom. pH</TableHead>
                          <TableHead className="text-xs">Normal</TableHead>
                          <TableHead className="text-xs">Intermedio</TableHead>
                          <TableHead className="text-xs">DFD</TableHead>
                          <TableHead className="text-xs">Alto (PSE)</TableHead>
                          <TableHead className="text-xs">% DFD</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {correlacionDFD.correlation.map((p: any) => (
                          <TableRow key={p.productorId} className={p.dfdPorcentaje > 15 ? 'bg-red-50' : p.dfdPorcentaje > 5 ? 'bg-yellow-50' : ''}>
                            <TableCell className="text-xs font-medium">{p.productorNombre}</TableCell>
                            <TableCell className="text-xs">{p.totalMediciones}</TableCell>
                            <TableCell className="text-xs font-bold">{p.promedioPH}</TableCell>
                            <TableCell className="text-xs text-green-700">{p.normalCount}</TableCell>
                            <TableCell className="text-xs text-yellow-700">{p.intermedioCount}</TableCell>
                            <TableCell className="text-xs text-red-700 font-bold">{p.dfdCount}</TableCell>
                            <TableCell className="text-xs text-orange-700">{p.altoCount}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className={
                                p.dfdPorcentaje > 15 ? 'bg-red-100 text-red-800 border-red-300' :
                                p.dfdPorcentaje > 5 ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                                'bg-green-100 text-green-800 border-green-300'
                              }>
                                {p.dfdPorcentaje}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {correlacionDFD.correlation.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-6 text-stone-500 text-sm">
                              No hay datos de correlación para los filtros seleccionados
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Últimas tropas con DFD */}
              {correlacionDFD.ultimasTropasDFD && correlacionDFD.ultimasTropasDFD.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Últimas Tropas con DFD</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-stone-50">
                            <TableHead className="text-xs">Fecha</TableHead>
                            <TableHead className="text-xs">Tropa</TableHead>
                            <TableHead className="text-xs">pH</TableHead>
                            <TableHead className="text-xs">Productor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {correlacionDFD.ultimasTropasDFD.map((t: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs">{new Date(t.horaMedicion).toLocaleDateString('es-AR')}</TableCell>
                              <TableCell className="text-xs font-mono">{t.tropaCodigo}</TableCell>
                              <TableCell className="text-xs font-bold text-red-700">{t.valorPH}</TableCell>
                              <TableCell className="text-xs">{t.productorNombre || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}
        </TabsContent>

        {/* CONTROL ESTADÍSTICO (SPC) */}
        <TabsContent value="control-estadistico">
          {loading ? (
            <Card className="p-8 text-center text-stone-500">Cargando...</Card>
          ) : controlEstadistico ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="p-3 text-center">
                  <p className="text-xs text-stone-500">Total Grupos</p>
                  <p className="text-2xl font-bold">{controlEstadistico.totalGrupos}</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-xs text-stone-500">Total Mediciones</p>
                  <p className="text-2xl font-bold">{controlEstadistico.totalMediciones}</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-xs text-stone-500">X-barra (CL)</p>
                  <p className="text-2xl font-bold text-green-700">{controlEstadistico.limitesXBarra.CL}</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-xs text-stone-500">R-barra (CL)</p>
                  <p className="text-2xl font-bold text-blue-700">{controlEstadistico.limitesR.CL}</p>
                </Card>
              </div>

              {/* Límites de control */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Límites de Control</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-semibold text-green-700 mb-2">Gráfico X-barra (Media)</h4>
                      <div className="space-y-1 text-xs">
                        <p>UCL: <span className="font-mono font-bold text-red-700">{controlEstadistico.limitesXBarra.UCL}</span></p>
                        <p>CL: <span className="font-mono font-bold text-green-700">{controlEstadistico.limitesXBarra.CL}</span></p>
                        <p>LCL: <span className="font-mono font-bold text-red-700">{controlEstadistico.limitesXBarra.LCL}</span></p>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-blue-700 mb-2">Gráfico R (Rango)</h4>
                      <div className="space-y-1 text-xs">
                        <p>UCL: <span className="font-mono font-bold text-red-700">{controlEstadistico.limitesR.UCL}</span></p>
                        <p>CL: <span className="font-mono font-bold text-blue-700">{controlEstadistico.limitesR.CL}</span></p>
                        <p>LCL: <span className="font-mono font-bold text-red-700">{controlEstadistico.limitesR.LCL}</span></p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Gráfico Canvas */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Gráficos de Control SPC</CardTitle>
                </CardHeader>
                <CardContent>
                  {controlEstadistico.datosControl.length > 1 ? (
                    <canvas
                      ref={canvasRef}
                      className="w-full rounded border"
                      style={{ height: '300px' }}
                    />
                  ) : (
                    <p className="text-center text-stone-500 py-8">
                      Se necesitan al menos 2 tropas con mediciones para generar los gráficos de control
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Tabla de datos por tropa */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Datos por Tropa</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-stone-50">
                          <TableHead className="text-xs">Tropa</TableHead>
                          <TableHead className="text-xs">n</TableHead>
                          <TableHead className="text-xs">Media</TableHead>
                          <TableHead className="text-xs">Rango</TableHead>
                          <TableHead className="text-xs">Desv. Est.</TableHead>
                          <TableHead className="text-xs">Mín</TableHead>
                          <TableHead className="text-xs">Máx</TableHead>
                          <TableHead className="text-xs">Fuera Control</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {controlEstadistico.datosControl.map((d: any) => {
                          const fueraControl = d.media > controlEstadistico.limitesXBarra.UCL || d.media < controlEstadistico.limitesXBarra.LCL
                          return (
                            <TableRow key={d.grupo} className={fueraControl ? 'bg-red-50' : ''}>
                              <TableCell className="text-xs font-mono">{d.grupo}</TableCell>
                              <TableCell className="text-xs">{d.n}</TableCell>
                              <TableCell className="text-xs font-bold">{d.media}</TableCell>
                              <TableCell className="text-xs">{d.rango}</TableCell>
                              <TableCell className="text-xs">{d.desviacion}</TableCell>
                              <TableCell className="text-xs text-blue-700">{d.min}</TableCell>
                              <TableCell className="text-xs text-red-700">{d.max}</TableCell>
                              <TableCell>
                                {fueraControl && (
                                  <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Fuera de control
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============================================
// TAB 3: CONFIGURACIÓN DE UMBRALES pH
// ============================================
function ConfigPHTab() {
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [umbralPSE, setUmbralPSE] = useState('5.4')
  const [umbralNormMax, setUmbralNormMax] = useState('5.7')
  const [umbralIntMax, setUmbralIntMax] = useState('5.9')

  useEffect(() => {
    const cargar = async () => {
      try {
        const config = await fetchConfigPH()
        setUmbralPSE(String(config.umbralPSE))
        setUmbralNormMax(String(config.umbralNormMax))
        setUmbralIntMax(String(config.umbralIntMax))
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  const guardar = async () => {
    const pse = parseFloat(umbralPSE)
    const norm = parseFloat(umbralNormMax)
    const inter = parseFloat(umbralIntMax)

    if (isNaN(pse) || isNaN(norm) || isNaN(inter)) {
      toast.error('Todos los valores deben ser numéricos')
      return
    }
    if (pse > norm) {
      toast.error('El umbral PSE debe ser menor o igual al umbral Normal')
      return
    }
    if (norm >= inter) {
      toast.error('El umbral Normal debe ser menor al umbral Intermedio')
      return
    }

    setGuardando(true)
    try {
      const res = await fetch('/api/calidad-ph/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ umbralPSE: pse, umbralNormMax: norm, umbralIntMax: inter })
      })
      const json = await res.json()
      if (json.success) {
        toast.success('Configuración guardada correctamente')
        invalidateConfigCache()
      } else {
        toast.error(json.error || 'Error al guardar')
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setGuardando(false)
    }
  }

  const restablecer = () => {
    setUmbralPSE('5.4')
    setUmbralNormMax('5.7')
    setUmbralIntMax('5.9')
    toast.info('Valores restablecidos a los defaults')
  }

  // Preview de rangos en base a los valores actuales
  const pse = parseFloat(umbralPSE) || 5.4
  const norm = parseFloat(umbralNormMax) || 5.7
  const inter = parseFloat(umbralIntMax) || 5.9
  const interMin = parseFloat((norm + 0.1).toFixed(1))

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-stone-500 mt-2">Cargando configuración...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Save className="h-5 w-5 text-emerald-600" />
            Umbrales de Clasificación de pH
          </CardTitle>
          <p className="text-sm text-stone-500">
            Configure los rangos de pH para la clasificación automática. Los cambios aplican a nuevas mediciones.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Inputs de umbrales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <Label className="font-semibold text-orange-700">Umbral PSE (Alto)</Label>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-stone-500">pH menor a este valor se clasifica como PSE/ALTO</p>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="14"
                  value={umbralPSE}
                  onChange={e => setUmbralPSE(e.target.value)}
                  className="text-lg font-mono"
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <Label className="font-semibold text-green-700">Umbral Normal Max</Label>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-stone-500">pH desde {umbralPSE} hasta este valor = NORMAL</p>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="14"
                  value={umbralNormMax}
                  onChange={e => setUmbralNormMax(e.target.value)}
                  className="text-lg font-mono"
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <Label className="font-semibold text-yellow-700">Umbral Intermedio Max</Label>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-stone-500">pH por encima de este valor = DFD</p>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="14"
                  value={umbralIntMax}
                  onChange={e => setUmbralIntMax(e.target.value)}
                  className="text-lg font-mono"
                />
              </div>
            </div>
          </div>

          {/* Preview visual de rangos */}
          <div className="bg-stone-50 rounded-lg p-4 space-y-3">
            <p className="text-sm font-semibold text-stone-600">Vista previa de clasificación:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-orange-100 border border-orange-300 rounded-lg p-3 text-center">
                <p className="text-xs font-semibold text-orange-700">ALTO (PSE)</p>
                <p className="text-lg font-bold text-orange-800">pH &lt; {umbralPSE}</p>
              </div>
              <div className="bg-green-100 border border-green-300 rounded-lg p-3 text-center">
                <p className="text-xs font-semibold text-green-700">NORMAL</p>
                <p className="text-lg font-bold text-green-800">pH {umbralPSE} - {umbralNormMax}</p>
              </div>
              <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3 text-center">
                <p className="text-xs font-semibold text-yellow-700">INTERMEDIO</p>
                <p className="text-lg font-bold text-yellow-800">pH {interMin} - {umbralIntMax}</p>
              </div>
              <div className="bg-red-100 border border-red-300 rounded-lg p-3 text-center">
                <p className="text-xs font-semibold text-red-700">DFD</p>
                <p className="text-lg font-bold text-red-800">pH &gt; {umbralIntMax}</p>
              </div>
            </div>
          </div>

          {/* Nota informativa */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-800">
              <strong>Nota:</strong> Los cambios en los umbrales solo aplican a las nuevas mediciones que se guarden.
              Las mediciones ya registradas mantienen la clasificación que tenían al momento de su carga.
              Los valores por defecto son los estándar de la industria cárnica argentina.
            </p>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={restablecer}>
              Restablecer defaults
            </Button>
            <Button onClick={guardar} disabled={guardando} className="bg-emerald-600 hover:bg-emerald-700">
              {guardando ? 'Guardando...' : 'Guardar Configuración'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default CalidadPHModule
