// NOTA: Componente disponible para uso futuro - verificar antes de eliminar
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { 
  Truck, Package, Loader2, RefreshCw, CheckCircle, Plus,
  Warehouse, Users, Scale, FileText, X, Eye, Trash2, 
  FileSpreadsheet, Ticket, User
} from 'lucide-react'

interface Operador {
  id: string
  nombre: string
  rol: string
}

interface Props {
  operador: Operador
}

interface MediaItem {
  id: string
  codigo: string
  lado: string
  peso: number
  garron: number
  usuarioId?: string | null
  usuarioNombre?: string
}

interface StockUsuario {
  usuarioId: string | null
  usuarioNombre: string
  cantidad: number
  pesoTotal: number
  medias: MediaItem[]
}

interface StockTropa {
  tropaCodigo: string
  cantidad: number
  pesoTotal: number
  porUsuario: StockUsuario[]
}

interface StockCamara {
  id: string
  nombre: string
  totalMedias: number
  totalKg: number
  porTropa: StockTropa[]
}

interface StockData {
  stock: StockCamara[]
  totalMedias: number
  totalKg: number
}

interface DespachoUsuario {
  usuarioId: string | null
  usuarioNombre: string
  cantidadMedias: number
  kgTotal: number
}

interface DespachoItem {
  id: string
  codigo: string
  lado: string
  peso: number
  garron: number
  tropaCodigo: string
  usuarioNombre: string
}

interface DespachoDetalle {
  id: string
  numero: number
  fecha: Date
  destino: string
  direccionDestino?: string
  patenteCamion: string | null
  patenteAcoplado: string | null
  chofer: string | null
  choferDni: string | null
  transportista: string | null
  remito: string | null
  numeroPrecintos: string | null
  kgTotal: number
  cantidadMedias: number
  estado: string
  observaciones?: string
  operador?: string
  ticketPesajeId?: string
  ticketPesaje?: {
    numeroTicket: string
    pesoBruto: number
    pesoTara: number
    pesoNeto: number
  }
  usuarios: DespachoUsuario[]
  items: DespachoItem[]
}

interface Despacho {
  id: string
  numero: number
  fecha: Date
  destino: string
  patenteCamion: string | null
  chofer: string | null
  remito: string | null
  kgTotal: number
  cantidadMedias: number
  estado: string
  operador?: string
  usuarios?: DespachoUsuario[]
  ticketPesajeId?: string | null
}

export function DespachoModule({ operador }: Props) {
  const [activeTab, setActiveTab] = useState('stock')
  
  // Stock
  const [stockData, setStockData] = useState<StockData | null>(null)
  const [loadingStock, setLoadingStock] = useState(true)
  const [expandedCamara, setExpandedCamara] = useState<string | null>(null)
  const [expandedTropa, setExpandedTropa] = useState<string | null>(null)
  
  // Selección
  const [selectedMedias, setSelectedMedias] = useState<MediaItem[]>([])
  
  // Despachos
  const [despachos, setDespachos] = useState<Despacho[]>([])
  const [loadingDespachos, setLoadingDespachos] = useState(false)
  
  // Dialogs
  const [showNewDespacho, setShowNewDespacho] = useState(false)
  const [savingDespacho, setSavingDespacho] = useState(false)
  const [showDetalle, setShowDetalle] = useState(false)
  const [despachoSeleccionado, setDespachoSeleccionado] = useState<DespachoDetalle | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [showAnular, setShowAnular] = useState(false)
  const [despachoAnular, setDespachoAnular] = useState<Despacho | null>(null)
  const [showFacturar, setShowFacturar] = useState(false)
  const [despachoFacturar, setDespachoFacturar] = useState<DespachoDetalle | null>(null)
  
  // Ticket de pesaje
  const [ticketPesaje, setTicketPesaje] = useState({
    ticketNumero: '',
    pesoBruto: '',
    pesoTara: ''
  })
  
  const [formData, setFormData] = useState({
    destino: '',
    direccionDestino: '',
    patenteCamion: '',
    patenteAcoplado: '',
    chofer: '',
    choferDni: '',
    transportista: '',
    remito: '',
    numeroPrecintos: '',
    observaciones: ''
  })

  // Cargar stock al iniciar
  useEffect(() => {
    fetchStock()
  }, [])

  useEffect(() => {
    if (activeTab === 'despachos') {
      fetchDespachos()
    }
  }, [activeTab])

  const fetchStock = async () => {
    setLoadingStock(true)
    try {
      const res = await fetch('/api/expedicion?tipo=stock')
      const data = await res.json()
      if (data.success) {
        setStockData(data.data)
      } else {
        toast.error(data.error || 'Error al cargar stock')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error de conexión')
    } finally {
      setLoadingStock(false)
    }
  }

  const fetchDespachos = async () => {
    setLoadingDespachos(true)
    try {
      const res = await fetch('/api/expedicion?tipo=despachos')
      const data = await res.json()
      if (data.success) {
        setDespachos(data.data)
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar despachos')
    } finally {
      setLoadingDespachos(false)
    }
  }

  const fetchDetalleDespacho = async (id: string) => {
    setLoadingDetalle(true)
    try {
      const res = await fetch(`/api/expedicion?tipo=despacho&id=${id}`)
      const data = await res.json()
      if (data.success) {
        setDespachoSeleccionado(data.data)
        setShowDetalle(true)
      } else {
        toast.error('Error al cargar detalle')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error de conexión')
    } finally {
      setLoadingDetalle(false)
    }
  }

  // Seleccionar/deseleccionar media
  const toggleMediaSelection = (media: MediaItem) => {
    setSelectedMedias(prev => {
      const exists = prev.find(m => m.id === media.id)
      if (exists) {
        return prev.filter(m => m.id !== media.id)
      }
      return [...prev, media]
    })
  }

  // Seleccionar todas las medias de un usuario
  const selectAllFromUsuario = (medias: MediaItem[]) => {
    setSelectedMedias(prev => {
      const notSelected = medias.filter(m => !prev.find(p => p.id === m.id))
      return [...prev, ...notSelected]
    })
  }

  // Crear despacho
  const handleCrearDespacho = async (crearFactura: boolean = false) => {
    if (!formData.destino) {
      toast.error('El destino es obligatorio')
      return
    }

    if (selectedMedias.length === 0) {
      toast.error('Debe seleccionar al menos una media res')
      return
    }

    setSavingDespacho(true)
    try {
      const res = await fetch('/api/expedicion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'crear',
          ...formData,
          operadorId: operador.id,
          mediasIds: selectedMedias.map(m => m.id),
          ticketPesaje: ticketPesaje.ticketNumero ? {
            numeroTicket: parseInt(ticketPesaje.ticketNumero),
            pesoBruto: parseFloat(ticketPesaje.pesoBruto) || 0,
            pesoTara: parseFloat(ticketPesaje.pesoTara) || 0
          } : null
        })
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        setShowNewDespacho(false)
        setSelectedMedias([])
        setFormData({
          destino: '',
          direccionDestino: '',
          patenteCamion: '',
          patenteAcoplado: '',
          chofer: '',
          choferDni: '',
          transportista: '',
          remito: '',
          numeroPrecintos: '',
          observaciones: ''
        })
        setTicketPesaje({ ticketNumero: '', pesoBruto: '', pesoTara: '' })
        fetchStock()
        fetchDespachos()
        
        // Si quiere crear factura
        if (crearFactura && data.data) {
          // Abrir modal de facturación con el despacho
          setDespachoFacturar(data.data)
          setShowFacturar(true)
        }
      } else {
        toast.error(data.error || 'Error al crear despacho')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error de conexión')
    } finally {
      setSavingDespacho(false)
    }
  }

  // Anular despacho
  const handleAnularDespacho = async () => {
    if (!despachoAnular) return
    
    setSavingDespacho(true)
    try {
      const res = await fetch('/api/expedicion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'anular',
          despachoId: despachoAnular.id
        })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Despacho anulado correctamente')
        setShowAnular(false)
        setDespachoAnular(null)
        fetchDespachos()
        fetchStock()
      } else {
        toast.error(data.error || 'Error al anular')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error de conexión')
    } finally {
      setSavingDespacho(false)
    }
  }

  // Calcular totales de selección
  const seleccionTotal = selectedMedias.length
  const seleccionKg = selectedMedias.reduce((sum, m) => sum + m.peso, 0)
  
  // Agrupar selección por usuario
  const seleccionPorUsuario = selectedMedias.reduce((acc, media) => {
    const usuarioId = media.usuarioId || 'sin-usuario'
    const usuarioNombre = media.usuarioNombre || 'Sin usuario'
    if (!acc[usuarioId]) {
      acc[usuarioId] = { usuarioId, usuarioNombre, cantidad: 0, kg: 0 }
    }
    acc[usuarioId].cantidad++
    acc[usuarioId].kg += media.peso
    return acc
  }, {} as Record<string, { usuarioId: string; usuarioNombre: string; cantidad: number; kg: number }>)

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-stone-800 flex items-center gap-2">
              <Truck className="w-8 h-8 text-amber-500" />
              Despacho 1/2 Res
            </h1>
            <p className="text-stone-500 mt-1">
              Despacho de medias reses - {operador.nombre}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchStock} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
            {seleccionTotal > 0 && (
              <Button 
                onClick={() => setShowNewDespacho(true)}
                className="bg-emerald-500 hover:bg-emerald-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Despacho ({seleccionTotal} medias)
              </Button>
            )}
          </div>
        </div>

        {/* Resumen de selección */}
        {seleccionTotal > 0 && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Badge className="bg-emerald-100 text-emerald-700 text-base px-4 py-2">
                    <Package className="w-4 h-4 mr-2" />
                    {seleccionTotal} medias seleccionadas
                  </Badge>
                  <Badge className="bg-amber-100 text-amber-700 text-base px-4 py-2">
                    <Scale className="w-4 h-4 mr-2" />
                    {seleccionKg.toFixed(1)} kg
                  </Badge>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedMedias([])}
                >
                  <X className="w-4 h-4 mr-2" />
                  Limpiar selección
                </Button>
              </div>
              
              {/* Desglose por usuario */}
              {Object.keys(seleccionPorUsuario).length > 1 && (
                <div className="mt-3 pt-3 border-t border-emerald-200">
                  <p className="text-xs text-stone-500 mb-2">Desglose por usuario/cliente:</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.values(seleccionPorUsuario).map((u) => (
                      <Badge key={u.usuarioId} variant="outline" className="text-xs">
                        <User className="w-3 h-3 mr-1" />
                        {u.usuarioNombre}: {u.cantidad} medias ({u.kg.toFixed(1)} kg)
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="stock" className="flex items-center gap-2">
              <Warehouse className="w-4 h-4" />
              Stock por Cámara
            </TabsTrigger>
            <TabsTrigger value="despachos" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Despachos
            </TabsTrigger>
          </TabsList>

          {/* Tab Stock */}
          <TabsContent value="stock" className="space-y-4">
            {loadingStock ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              </div>
            ) : !stockData || stockData.totalMedias === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center">
                  <Warehouse className="w-16 h-16 mx-auto mb-4 text-stone-300" />
                  <p className="text-lg text-stone-600">No hay stock en cámaras</p>
                  <p className="text-sm text-stone-400 mt-1">
                    Las medias reses aparecerán aquí después del romaneo
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Resumen general */}
                <Card className="border-0 shadow-md">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap gap-6">
                      <div>
                        <p className="text-sm text-stone-500">Total Medias</p>
                        <p className="text-2xl font-bold text-stone-800">{stockData.totalMedias}</p>
                      </div>
                      <div>
                        <p className="text-sm text-stone-500">Total Kg</p>
                        <p className="text-2xl font-bold text-stone-800">{stockData.totalKg.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-stone-500">Cámaras</p>
                        <p className="text-2xl font-bold text-stone-800">{stockData.stock.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Stock por cámara */}
                <div className="space-y-3">
                  {stockData.stock.map((camara) => (
                    <Card key={camara.id} className="border-0 shadow-md">
                      <CardHeader 
                        className="cursor-pointer hover:bg-stone-50 py-3"
                        onClick={() => setExpandedCamara(expandedCamara === camara.id ? null : camara.id)}
                      >
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Warehouse className="w-5 h-5 text-amber-500" />
                            {camara.nombre}
                          </CardTitle>
                          <div className="flex items-center gap-4">
                            <Badge variant="outline">{camara.totalMedias} medias</Badge>
                            <Badge variant="outline">{camara.totalKg.toFixed(1)} kg</Badge>
                            <span className="text-stone-400">
                              {expandedCamara === camara.id ? '▼' : '▶'}
                            </span>
                          </div>
                        </div>
                      </CardHeader>
                      
                      {expandedCamara === camara.id && (
                        <CardContent className="pt-0">
                          <div className="space-y-3">
                            {camara.porTropa.map((tropa, idx) => (
                              <div key={idx} className="border rounded-lg">
                                <div 
                                  className="flex items-center justify-between p-3 bg-stone-50 cursor-pointer"
                                  onClick={() => setExpandedTropa(
                                    expandedTropa === `${camara.id}-${tropa.tropaCodigo}` 
                                      ? null 
                                      : `${camara.id}-${tropa.tropaCodigo}`
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <Badge className="bg-blue-100 text-blue-700">
                                      Tropa: {tropa.tropaCodigo}
                                    </Badge>
                                    <span className="text-sm text-stone-500">
                                      {tropa.cantidad} medias • {tropa.pesoTotal.toFixed(1)} kg
                                    </span>
                                  </div>
                                  <span className="text-stone-400">
                                    {expandedTropa === `${camara.id}-${tropa.tropaCodigo}` ? '▼' : '▶'}
                                  </span>
                                </div>
                                
                                {expandedTropa === `${camara.id}-${tropa.tropaCodigo}` && (
                                  <div className="p-3">
                                    {tropa.porUsuario.map((usuario, uIdx) => (
                                      <div key={uIdx} className="mb-4 last:mb-0">
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-2">
                                            <Users className="w-4 h-4 text-stone-400" />
                                            <span className="font-medium">{usuario.usuarioNombre}</span>
                                            <Badge variant="outline" className="text-xs">
                                              {usuario.cantidad} medias • {usuario.pesoTotal.toFixed(1)} kg
                                            </Badge>
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => selectAllFromUsuario(usuario.medias)}
                                          >
                                            Seleccionar todas
                                          </Button>
                                        </div>
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead className="w-10"></TableHead>
                                              <TableHead>Código</TableHead>
                                              <TableHead>Lado</TableHead>
                                              <TableHead>Garrón</TableHead>
                                              <TableHead className="text-right">Peso</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {usuario.medias.map((media) => {
                                              const isSelected = selectedMedias.find(m => m.id === media.id)
                                              return (
                                                <TableRow 
                                                  key={media.id}
                                                  className={`cursor-pointer hover:bg-stone-50 ${isSelected ? 'bg-emerald-50' : ''}`}
                                                  onClick={() => toggleMediaSelection(media)}
                                                >
                                                  <TableCell>
                                                    <Checkbox 
                                                      checked={!!isSelected}
                                                      onCheckedChange={() => toggleMediaSelection(media)}
                                                    />
                                                  </TableCell>
                                                  <TableCell className="font-mono">{media.codigo}</TableCell>
                                                  <TableCell>{media.lado}</TableCell>
                                                  <TableCell>{media.garron}</TableCell>
                                                  <TableCell className="text-right">{media.peso.toFixed(1)} kg</TableCell>
                                                </TableRow>
                                              )
                                            })}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          {/* Tab Despachos */}
          <TabsContent value="despachos" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Lista de Despachos</h3>
              <Button onClick={fetchDespachos} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualizar
              </Button>
            </div>

            {loadingDespachos ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              </div>
            ) : despachos.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-stone-300" />
                  <p className="text-lg text-stone-600">No hay despachos registrados</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N°</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead>Usuario/s</TableHead>
                      <TableHead>Camión</TableHead>
                      <TableHead className="text-right">Kg</TableHead>
                      <TableHead className="text-right">Medias</TableHead>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {despachos.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-bold">#{d.numero}</TableCell>
                        <TableCell>{new Date(d.fecha).toLocaleDateString('es-AR')}</TableCell>
                        <TableCell>{d.destino}</TableCell>
                        <TableCell>
                          {d.usuarios && d.usuarios.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {d.usuarios.slice(0, 2).map((u, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {u.usuarioNombre} ({u.kgTotal.toFixed(0)}kg)
                                </Badge>
                              ))}
                              {d.usuarios.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{d.usuarios.length - 2} más
                                </Badge>
                              )}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{d.patenteCamion || '-'}</TableCell>
                        <TableCell className="text-right font-medium">{d.kgTotal.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{d.cantidadMedias}</TableCell>
                        <TableCell>
                          {d.ticketPesajeId ? (
                            <Badge className="bg-blue-100 text-blue-700">
                              <Ticket className="w-3 h-3 mr-1" />
                              Sí
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            d.estado === 'DESPACHADO' ? 'bg-emerald-100 text-emerald-700' :
                            d.estado === 'PENDIENTE' ? 'bg-amber-100 text-amber-700' :
                            d.estado === 'ANULADO' ? 'bg-red-100 text-red-700' :
                            'bg-stone-100 text-stone-700'
                          }>
                            {d.estado}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => fetchDetalleDespacho(d.id)}
                              title="Ver detalle"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {d.estado !== 'ANULADO' && d.estado !== 'DESPACHADO' && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-red-500 hover:text-red-700"
                                onClick={() => { setDespachoAnular(d); setShowAnular(true) }}
                                title="Anular"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                            {d.estado === 'DESPACHADO' && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-emerald-500 hover:text-emerald-700"
                                onClick={() => toast.info('Facturación disponible en el módulo de Facturación')}
                                title="Facturar"
                              >
                                <FileSpreadsheet className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog Nuevo Despacho */}
      <Dialog open={showNewDespacho} onOpenChange={setShowNewDespacho}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" maximizable>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-500" />
              Nuevo Despacho
            </DialogTitle>
            <DialogDescription>
              Complete los datos del despacho para {seleccionTotal} medias ({seleccionKg.toFixed(1)} kg)
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="md:col-span-2">
              <Label>Destino *</Label>
              <Input 
                value={formData.destino}
                onChange={(e) => setFormData({...formData, destino: e.target.value})}
                placeholder="Destino del despacho"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Dirección de entrega</Label>
              <Input 
                value={formData.direccionDestino}
                onChange={(e) => setFormData({...formData, direccionDestino: e.target.value})}
                placeholder="Dirección completa"
              />
            </div>
            <div>
              <Label>Patente Camión</Label>
              <Input 
                value={formData.patenteCamion}
                onChange={(e) => setFormData({...formData, patenteCamion: e.target.value.toUpperCase()})}
                placeholder="AB123CD"
                maxLength={10}
              />
            </div>
            <div>
              <Label>Patente Acoplado</Label>
              <Input 
                value={formData.patenteAcoplado}
                onChange={(e) => setFormData({...formData, patenteAcoplado: e.target.value.toUpperCase()})}
                placeholder="AB123CD"
                maxLength={10}
              />
            </div>
            <div>
              <Label>Chofer</Label>
              <Input 
                value={formData.chofer}
                onChange={(e) => setFormData({...formData, chofer: e.target.value})}
                placeholder="Nombre del chofer"
              />
            </div>
            <div>
              <Label>DNI Chofer</Label>
              <Input 
                value={formData.choferDni}
                onChange={(e) => setFormData({...formData, choferDni: e.target.value})}
                placeholder="12345678"
              />
            </div>
            <div>
              <Label>Transportista</Label>
              <Input 
                value={formData.transportista}
                onChange={(e) => setFormData({...formData, transportista: e.target.value})}
                placeholder="Empresa de transporte"
              />
            </div>
            <div>
              <Label>N° Remito</Label>
              <Input 
                value={formData.remito}
                onChange={(e) => setFormData({...formData, remito: e.target.value})}
                placeholder="Número de remito"
              />
            </div>
            <div className="md:col-span-2">
              <Label>N° Precintos</Label>
              <Input 
                value={formData.numeroPrecintos}
                onChange={(e) => setFormData({...formData, numeroPrecintos: e.target.value})}
                placeholder="Números de precintos (separados por coma)"
              />
            </div>
            
            {/* Ticket de Pesaje - Salida de Mercadería */}
            <div className="md:col-span-2 border-t pt-4 mt-2">
              <Label className="flex items-center gap-2 text-base font-semibold">
                <Ticket className="w-4 h-4" />
                Ticket de Pesaje (Salida de Mercadería)
              </Label>
              <p className="text-xs text-stone-500 mb-3">Opcional: registre el pesaje del camión cargado</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">N° Ticket</Label>
                  <Input 
                    value={ticketPesaje.ticketNumero}
                    onChange={(e) => setTicketPesaje({...ticketPesaje, ticketNumero: e.target.value})}
                    placeholder="Auto"
                    type="number"
                  />
                </div>
                <div>
                  <Label className="text-xs">Peso Bruto (kg)</Label>
                  <Input 
                    value={ticketPesaje.pesoBruto}
                    onChange={(e) => setTicketPesaje({...ticketPesaje, pesoBruto: e.target.value})}
                    placeholder="0.0"
                    type="number"
                    step="0.1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Peso Tara (kg)</Label>
                  <Input 
                    value={ticketPesaje.pesoTara}
                    onChange={(e) => setTicketPesaje({...ticketPesaje, pesoTara: e.target.value})}
                    placeholder="0.0"
                    type="number"
                    step="0.1"
                  />
                </div>
              </div>
              {ticketPesaje.pesoBruto && ticketPesaje.pesoTara && (
                <p className="text-sm text-stone-600 mt-2">
                  Peso Neto: <strong>{(parseFloat(ticketPesaje.pesoBruto || '0') - parseFloat(ticketPesaje.pesoTara || '0')).toFixed(1)} kg</strong>
                </p>
              )}
            </div>
            
            <div className="md:col-span-2">
              <Label>Observaciones</Label>
              <Input 
                value={formData.observaciones}
                onChange={(e) => setFormData({...formData, observaciones: e.target.value})}
                placeholder="Observaciones adicionales"
              />
            </div>
          </div>

          {/* Resumen por Usuario */}
          <div className="bg-stone-50 rounded-lg p-4 mb-4">
            <p className="text-sm font-medium text-stone-600 mb-2">Resumen por Usuario/Cliente:</p>
            <div className="space-y-2">
              {Object.values(seleccionPorUsuario).map((u) => (
                <div key={u.usuarioId} className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2">
                    <User className="w-4 h-4 text-stone-400" />
                    {u.usuarioNombre}
                  </span>
                  <span>
                    {u.cantidad} medias • <strong>{u.kg.toFixed(1)} kg</strong>
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t mt-3 pt-3 flex justify-between font-medium">
              <span>Total:</span>
              <span>{seleccionTotal} medias • {seleccionKg.toFixed(1)} kg</span>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setShowNewDespacho(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => handleCrearDespacho(false)}
              disabled={savingDespacho || !formData.destino}
              variant="secondary"
            >
              {savingDespacho ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Crear y Facturar Después
            </Button>
            <Button 
              onClick={() => handleCrearDespacho(true)}
              disabled={savingDespacho || !formData.destino}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              {savingDespacho ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 mr-2" />
              )}
              Crear y Facturar Ahora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Detalle Despacho */}
      <Dialog open={showDetalle} onOpenChange={setShowDetalle}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" maximizable>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
              Despacho #{despachoSeleccionado?.numero}
            </DialogTitle>
            <DialogDescription>
              {despachoSeleccionado && new Date(despachoSeleccionado.fecha).toLocaleDateString('es-AR')}
            </DialogDescription>
          </DialogHeader>
          
          {loadingDetalle ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
          ) : despachoSeleccionado && (
            <div className="space-y-4">
              {/* Datos del despacho */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-stone-500">Destino</p>
                  <p className="font-medium">{despachoSeleccionado.destino}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">Dirección</p>
                  <p className="font-medium">{despachoSeleccionado.direccionDestino || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">Camión</p>
                  <p className="font-medium">{despachoSeleccionado.patenteCamion || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">Acoplado</p>
                  <p className="font-medium">{despachoSeleccionado.patenteAcoplado || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">Chofer</p>
                  <p className="font-medium">{despachoSeleccionado.chofer || '-'} {despachoSeleccionado.choferDni ? `(${despachoSeleccionado.choferDni})` : ''}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">Transportista</p>
                  <p className="font-medium">{despachoSeleccionado.transportista || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">Remito</p>
                  <p className="font-medium">{despachoSeleccionado.remito || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">Precintos</p>
                  <p className="font-medium">{despachoSeleccionado.numeroPrecintos || '-'}</p>
                </div>
              </div>
              
              {/* Ticket de pesaje */}
              {despachoSeleccionado.ticketPesaje && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader className="py-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Ticket className="w-4 h-4" />
                      Ticket de Pesaje #{despachoSeleccionado.ticketPesaje.numeroTicket}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-stone-500">Peso Bruto</p>
                        <p className="font-bold">{(despachoSeleccionado.ticketPesaje.pesoBruto ?? 0).toFixed(1)} kg</p>
                      </div>
                      <div>
                        <p className="text-xs text-stone-500">Peso Tara</p>
                        <p className="font-bold">{(despachoSeleccionado.ticketPesaje.pesoTara ?? 0).toFixed(1)} kg</p>
                      </div>
                      <div>
                        <p className="text-xs text-stone-500">Peso Neto</p>
                        <p className="font-bold text-blue-700">{(despachoSeleccionado.ticketPesaje.pesoNeto ?? 0).toFixed(1)} kg</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Resumen por usuario */}
              <div>
                <h4 className="text-sm font-medium mb-2">Resumen por Usuario/Cliente:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {despachoSeleccionado.usuarios.map((u, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-stone-50 rounded">
                      <span className="flex items-center gap-2">
                        <User className="w-4 h-4 text-stone-400" />
                        {u.usuarioNombre}
                      </span>
                      <Badge variant="outline">{u.cantidadMedias} medias • {u.kgTotal.toFixed(1)} kg</Badge>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Totales */}
              <div className="flex justify-between items-center p-4 bg-emerald-50 rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-stone-500">Total Medias</p>
                  <p className="text-xl font-bold">{despachoSeleccionado.cantidadMedias}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-stone-500">Total Kg</p>
                  <p className="text-xl font-bold">{despachoSeleccionado.kgTotal.toFixed(1)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-stone-500">Estado</p>
                  <Badge className={
                    despachoSeleccionado.estado === 'DESPACHADO' ? 'bg-emerald-100 text-emerald-700' :
                    despachoSeleccionado.estado === 'PENDIENTE' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }>
                    {despachoSeleccionado.estado}
                  </Badge>
                </div>
              </div>
              
              {/* Detalle de medias */}
              <div>
                <h4 className="text-sm font-medium mb-2">Detalle de Medias ({despachoSeleccionado.items.length}):</h4>
                <ScrollArea className="h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Lado</TableHead>
                        <TableHead>Garrón</TableHead>
                        <TableHead>Tropa</TableHead>
                        <TableHead>Usuario</TableHead>
                        <TableHead className="text-right">Peso</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {despachoSeleccionado.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono">{item.codigo}</TableCell>
                          <TableCell>{item.lado}</TableCell>
                          <TableCell>{item.garron}</TableCell>
                          <TableCell>{item.tropaCodigo}</TableCell>
                          <TableCell>{item.usuarioNombre}</TableCell>
                          <TableCell className="text-right">{item.peso.toFixed(1)} kg</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
              
              {despachoSeleccionado.observaciones && (
                <div>
                  <p className="text-xs text-stone-500">Observaciones</p>
                  <p className="text-sm">{despachoSeleccionado.observaciones}</p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetalle(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Anular Despacho */}
      <AlertDialog open={showAnular} onOpenChange={setShowAnular}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Anular Despacho #{despachoAnular?.numero}</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción anulará el despacho y devolverá las {despachoAnular?.cantidadMedias} medias reses al stock de cámaras.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAnularDespacho}
              disabled={savingDespacho}
              className="bg-red-600 hover:bg-red-700"
            >
              {savingDespacho ? 'Anulando...' : 'Anular Despacho'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default DespachoModule
