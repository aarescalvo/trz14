'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { 
  Scale, Plus, Loader2, Trash, Edit, Power, Wifi, Usb, Monitor, Printer, Save,
  Download, Cable, Settings, CheckCircle, AlertTriangle, ExternalLink, ChevronRight, Info
} from 'lucide-react'

interface Operador { id: string; nombre: string; rol: string }

interface Balanza {
  id: string
  nombre: string
  codigo: string | null
  tipoConexion: string
  puerto: string | null
  baudRate: number
  ip: string | null
  puertoTcp: number | null
  protocolo: string
  capacidadMax: number | null
  division: number
  unidad: string
  activa: boolean
  estado: string
  fechaCalibracion: string | null
  puestos?: { id: string; nombre: string; sector: string }[]
}

interface PuestoTrabajo {
  id: string
  nombre: string
  codigo: string | null
  sector: string | null
  ubicacion: string | null
  balanzaId: string | null
  balanza?: { id: string; nombre: string; estado: string; activa: boolean }
  impresoraIp: string | null
  impresoraPuerto: number | null
  impresoraModelo: string | null
  rotuloDefaultId: string | null
  scannerHabilitado: boolean
  activo: boolean
  operativo: boolean
}

interface Props { operador: Operador }

const TIPOS_CONEXION = [
  { value: 'SERIAL', label: 'Puerto Serie (COM)', icon: Usb },
  { value: 'TCP', label: 'TCP/IP (Red)', icon: Wifi },
  { value: 'SIMULADA', label: 'Simulada (Demo)', icon: Monitor },
]

const PROTOCOLOS = [
  { value: 'GENERICO', label: 'Genérico ASCII' },
  { value: 'TOLEDO', label: 'Toledo' },
  { value: 'METTLER', label: 'Mettler Toledo' },
  { value: 'OHAUS', label: 'Ohaus' },
  { value: 'DIGI', label: 'Digi' },
  { value: 'ADAM', label: 'Adam Equipment' },
  { value: 'CUSTOM', label: 'Personalizado' },
]

const SECTORES = [
  { value: 'ROMANEO', label: 'Romaneo' },
  { value: 'FAENA', label: 'Faena' },
  { value: 'PESAJE_CAMIONES', label: 'Pesaje Camiones' },
  { value: 'DESPACHO', label: 'Despacho' },
  { value: 'DEPOSTADA', label: 'Despostada' },
  { value: 'MENUDENCIAS', label: 'Menudencias' },
]

export function ConfigBalanzasModule({ operador }: Props) {
  const [balanzas, setBalanzas] = useState<Balanza[]>([])
  const [puestos, setPuestos] = useState<PuestoTrabajo[]>([])
  const [loading, setLoading] = useState(true)
  const [modalBalanza, setModalBalanza] = useState(false)
  const [modalPuesto, setModalPuesto] = useState(false)
  const [editandoBalanza, setEditandoBalanza] = useState<Balanza | null>(null)
  const [editandoPuesto, setEditandoPuesto] = useState<PuestoTrabajo | null>(null)
  const [guardando, setGuardando] = useState(false)

  const [balanzaForm, setBalanzaForm] = useState({
    nombre: '',
    codigo: '',
    tipoConexion: 'SIMULADA',
    puerto: 'COM1',
    baudRate: '9600',
    ip: '',
    puertoTcp: '',
    protocolo: 'GENERICO',
    capacidadMax: '',
    division: '0.1',
    unidad: 'kg',
    observaciones: ''
  })

  const [puestoForm, setPuestoForm] = useState({
    nombre: '',
    codigo: '',
    sector: '',
    ubicacion: '',
    balanzaId: '',
    impresoraIp: '',
    impresoraPuerto: '9100',
    impresoraModelo: '',
    scannerHabilitado: false
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [balRes, puestoRes] = await Promise.all([
        fetch('/api/balanzas'),
        fetch('/api/puestos-trabajo')
      ])
      
      const balData = await balRes.json()
      const puestoData = await puestoRes.json()
      
      if (balData.success) setBalanzas(balData.data || [])
      if (puestoData.success) setPuestos(puestoData.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  // ================ BALANZAS ================

  const handleGuardarBalanza = async () => {
    if (!balanzaForm.nombre) {
      toast.error('Ingrese el nombre')
      return
    }
    
    setGuardando(true)
    try {
      const payload = {
        id: editandoBalanza?.id,
        nombre: balanzaForm.nombre,
        codigo: balanzaForm.codigo || null,
        tipoConexion: balanzaForm.tipoConexion,
        puerto: balanzaForm.tipoConexion === 'SERIAL' ? balanzaForm.puerto : null,
        baudRate: parseInt(balanzaForm.baudRate) || 9600,
        ip: balanzaForm.tipoConexion === 'TCP' ? balanzaForm.ip : null,
        puertoTcp: balanzaForm.tipoConexion === 'TCP' ? parseInt(balanzaForm.puertoTcp) || null : null,
        protocolo: balanzaForm.protocolo,
        capacidadMax: parseFloat(balanzaForm.capacidadMax) || null,
        division: parseFloat(balanzaForm.division) || 0.1,
        unidad: balanzaForm.unidad,
        observaciones: balanzaForm.observaciones || null,
        activa: true
      }

      const res = await fetch('/api/balanzas', {
        method: editandoBalanza ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      
      if (data.success) {
        toast.success(editandoBalanza ? 'Balanza actualizada' : 'Balanza creada')
        setModalBalanza(false)
        resetBalanzaForm()
        fetchData()
      } else {
        toast.error(data.error || 'Error al guardar')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error de conexión')
    } finally {
      setGuardando(false)
    }
  }

  const handleToggleBalanza = async (balanza: Balanza) => {
    try {
      const res = await fetch('/api/balanzas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: balanza.id, activa: !balanza.activa })
      })
      
      if (res.ok) {
        toast.success(balanza.activa ? 'Balanza desactivada' : 'Balanza activada')
        fetchData()
      }
    } catch (error) {
      toast.error('Error al cambiar estado')
    }
  }

  const handleEliminarBalanza = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta balanza?')) return
    
    try {
      const res = await fetch(`/api/balanzas?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      
      if (data.success) {
        toast.success('Balanza eliminada')
        fetchData()
      } else {
        toast.error(data.error || 'Error al eliminar')
      }
    } catch (error) {
      toast.error('Error al eliminar')
    }
  }

  const resetBalanzaForm = () => {
    setBalanzaForm({
      nombre: '',
      codigo: '',
      tipoConexion: 'SIMULADA',
      puerto: 'COM1',
      baudRate: '9600',
      ip: '',
      puertoTcp: '',
      protocolo: 'GENERICO',
      capacidadMax: '',
      division: '0.1',
      unidad: 'kg',
      observaciones: ''
    })
    setEditandoBalanza(null)
  }

  // ================ PUESTOS ================

  const handleGuardarPuesto = async () => {
    if (!puestoForm.nombre) {
      toast.error('Ingrese el nombre')
      return
    }
    
    setGuardando(true)
    try {
      const payload = {
        id: editandoPuesto?.id,
        nombre: puestoForm.nombre,
        codigo: puestoForm.codigo || null,
        sector: puestoForm.sector || null,
        ubicacion: puestoForm.ubicacion || null,
        balanzaId: (puestoForm.balanzaId && puestoForm.balanzaId !== 'all') ? puestoForm.balanzaId : null,
        impresoraIp: puestoForm.impresoraIp || null,
        impresoraPuerto: parseInt(puestoForm.impresoraPuerto) || 9100,
        impresoraModelo: puestoForm.impresoraModelo || null,
        scannerHabilitado: puestoForm.scannerHabilitado,
        activo: true
      }

      const res = await fetch('/api/puestos-trabajo', {
        method: editandoPuesto ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      
      if (data.success) {
        toast.success(editandoPuesto ? 'Puesto actualizado' : 'Puesto creado')
        setModalPuesto(false)
        resetPuestoForm()
        fetchData()
      } else {
        toast.error(data.error || 'Error al guardar')
      }
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error de conexión')
    } finally {
      setGuardando(false)
    }
  }

  const handleEliminarPuesto = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este puesto?')) return
    
    try {
      const res = await fetch(`/api/puestos-trabajo?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      
      if (data.success) {
        toast.success('Puesto eliminado')
        fetchData()
      } else {
        toast.error(data.error || 'Error al eliminar')
      }
    } catch (error) {
      toast.error('Error al eliminar')
    }
  }

  const resetPuestoForm = () => {
    setPuestoForm({
      nombre: '',
      codigo: '',
      sector: '',
      ubicacion: '',
      balanzaId: '',
      impresoraIp: '',
      impresoraPuerto: '9100',
      impresoraModelo: '',
      scannerHabilitado: false
    })
    setEditandoPuesto(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Scale className="w-6 h-6 text-amber-500" />
            Configuración de Balanzas y Puestos
          </h2>
          <p className="text-sm text-stone-500">Configuración de hardware por puesto de trabajo</p>
        </div>
      </div>

      <Tabs defaultValue="balanzas" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="balanzas">Balanzas</TabsTrigger>
          <TabsTrigger value="puestos">Puestos</TabsTrigger>
          <TabsTrigger value="instalador">Instalador</TabsTrigger>
        </TabsList>

        {/* TAB BALANZAS */}
        <TabsContent value="balanzas" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { resetBalanzaForm(); setModalBalanza(true); }} className="bg-amber-500 hover:bg-amber-600">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Balanza
            </Button>
          </div>

          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-stone-50">
                    <TableHead>Nombre</TableHead>
                    <TableHead>Conexión</TableHead>
                    <TableHead>Protocolo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Puestos</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-500" />
                      </TableCell>
                    </TableRow>
                  ) : balanzas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-stone-400 py-8">
                        No hay balanzas configuradas
                      </TableCell>
                    </TableRow>
                  ) : (
                    balanzas.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{b.nombre}</p>
                            {b.codigo && <p className="text-xs text-stone-400">{b.codigo}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {b.tipoConexion === 'SERIAL' && <><Usb className="w-4 h-4" /> {b.puerto}</>}
                            {b.tipoConexion === 'TCP' && <><Wifi className="w-4 h-4" /> {b.ip}:{b.puertoTcp}</>}
                            {b.tipoConexion === 'SIMULADA' && <><Monitor className="w-4 h-4" /> Simulada</>}
                          </div>
                        </TableCell>
                        <TableCell>{PROTOCOLOS.find(p => p.value === b.protocolo)?.label || b.protocolo}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch checked={b.activa} onCheckedChange={() => handleToggleBalanza(b)} />
                            <Badge variant={b.activa ? 'default' : 'secondary'}>
                              {b.activa ? 'Activa' : 'Inactiva'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {b.puestos && b.puestos.length > 0 
                            ? b.puestos.map(p => p.nombre).join(', ')
                            : <span className="text-stone-400">Sin asignar</span>
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => {
                              setEditandoBalanza(b)
                              setBalanzaForm({
                                nombre: b.nombre,
                                codigo: b.codigo || '',
                                tipoConexion: b.tipoConexion,
                                puerto: b.puerto || 'COM1',
                                baudRate: String(b.baudRate),
                                ip: b.ip || '',
                                puertoTcp: b.puertoTcp ? String(b.puertoTcp) : '',
                                protocolo: b.protocolo,
                                capacidadMax: b.capacidadMax ? String(b.capacidadMax) : '',
                                division: String(b.division),
                                unidad: b.unidad,
                                observaciones: ''
                              })
                              setModalBalanza(true)
                            }}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEliminarBalanza(b.id)} className="text-red-500">
                              <Trash className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB PUESTOS */}
        <TabsContent value="puestos" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { resetPuestoForm(); setModalPuesto(true); }} className="bg-amber-500 hover:bg-amber-600">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Puesto
            </Button>
          </div>

          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-stone-50">
                    <TableHead>Nombre</TableHead>
                    <TableHead>Sector</TableHead>
                    <TableHead>Balanza</TableHead>
                    <TableHead>Impresora</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-500" />
                      </TableCell>
                    </TableRow>
                  ) : puestos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-stone-400 py-8">
                        No hay puestos configurados
                      </TableCell>
                    </TableRow>
                  ) : (
                    puestos.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{p.nombre}</p>
                            {p.codigo && <p className="text-xs text-stone-400">{p.codigo}</p>}
                          </div>
                        </TableCell>
                        <TableCell>{SECTORES.find(s => s.value === p.sector)?.label || p.sector || '-'}</TableCell>
                        <TableCell>
                          {p.balanza 
                            ? <Badge variant={p.balanza.activa ? 'default' : 'secondary'}>{p.balanza.nombre}</Badge>
                            : <span className="text-stone-400">Sin balanza</span>
                          }
                        </TableCell>
                        <TableCell>
                          {p.impresoraIp 
                            ? <div className="flex items-center gap-1"><Printer className="w-4 h-4" /> {p.impresoraIp}</div>
                            : <span className="text-stone-400">Sin configurar</span>
                          }
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.activo ? 'default' : 'secondary'}>
                            {p.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => {
                              setEditandoPuesto(p)
                              setPuestoForm({
                                nombre: p.nombre,
                                codigo: p.codigo || '',
                                sector: p.sector || '',
                                ubicacion: p.ubicacion || '',
                                balanzaId: p.balanzaId || '',
                                impresoraIp: p.impresoraIp || '',
                                impresoraPuerto: p.impresoraPuerto ? String(p.impresoraPuerto) : '9100',
                                impresoraModelo: p.impresoraModelo || '',
                                scannerHabilitado: p.scannerHabilitado
                              })
                              setModalPuesto(true)
                            }}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEliminarPuesto(p.id)} className="text-red-500">
                              <Trash className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        {/* TAB INSTALADOR */}
        <TabsContent value="instalador" className="space-y-4">
          <Card className="border-0 shadow-md">
            <CardHeader className="bg-blue-50">
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="w-5 h-5 text-blue-600" />
                Guia de Instalacion - Balanza por Puerto Serie (RS232) en Windows
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-8">

              {/* INTRO */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-800">Como funciona</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Las balanzas con puerto serie (RS232) no pueden conectarse directamente a la aplicacion web. 
                      Se necesita un programa intermediario ("bridge") que lea el puerto COM y lo convierta a TCP/IP. 
                      La aplicacion se conecta por TCP al bridge, y este se comunica con la balanza por el cable serie.
                    </p>
                  </div>
                </div>
              </div>

              {/* DIAGRAMA */}
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Diagrama de conexion</p>
                <div className="flex items-center justify-center gap-3 flex-wrap text-sm">
                  <div className="bg-white border-2 border-blue-300 rounded-lg px-4 py-3 text-center">
                    <Scale className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                    <p className="font-bold text-blue-700">Balanza</p>
                    <p className="text-[10px] text-stone-500">Puerto RS232</p>
                  </div>
                  <div className="flex items-center gap-1 text-stone-400">
                    <div className="w-8 h-0.5 bg-stone-300"></div>
                    <Cable className="w-4 h-4" />
                    <div className="w-8 h-0.5 bg-stone-300"></div>
                  </div>
                  <div className="bg-white border-2 border-amber-300 rounded-lg px-4 py-3 text-center">
                    <Monitor className="w-6 h-6 text-amber-600 mx-auto mb-1" />
                    <p className="font-bold text-amber-700">PC Windows</p>
                    <p className="text-[10px] text-stone-500">Puerto COM</p>
                  </div>
                  <div className="flex items-center gap-1 text-stone-400">
                    <div className="w-8 h-0.5 bg-stone-300"></div>
                    <Settings className="w-4 h-4" />
                    <div className="w-8 h-0.5 bg-stone-300"></div>
                  </div>
                  <div className="bg-white border-2 border-green-300 rounded-lg px-4 py-3 text-center">
                    <Wifi className="w-6 h-6 text-green-600 mx-auto mb-1" />
                    <p className="font-bold text-green-700">Bridge TCP</p>
                    <p className="text-[10px] text-stone-500">Puerto 5000</p>
                  </div>
                  <div className="flex items-center gap-1 text-stone-400">
                    <div className="w-8 h-0.5 bg-stone-300"></div>
                    <Wifi className="w-4 h-4" />
                    <div className="w-8 h-0.5 bg-stone-300"></div>
                  </div>
                  <div className="bg-white border-2 border-purple-300 rounded-lg px-4 py-3 text-center">
                    <Monitor className="w-6 h-6 text-purple-600 mx-auto mb-1" />
                    <p className="font-bold text-purple-700">App Traza</p>
                    <p className="text-[10px] text-stone-500">Lectura TCP</p>
                  </div>
                </div>
              </div>

              {/* PASO 1 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                  <h3 className="font-bold text-base">Verificar el puerto COM de la balanza</h3>
                </div>
                <div className="ml-9 space-y-2 text-sm text-stone-700">
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li>Conecta el cable RS232 de la balanza a la PC (puerto serie o adaptador USB-Serial)</li>
                    <li>Hacé clic derecho en <strong>Inicio</strong> &gt; <strong>Administrador de dispositivos</strong></li>
                    <li>Expandi <strong>"Puertos (COM y LPT)"</strong></li>
                    <li>Anota el numero de puerto COM asignado (ej: <Badge variant="outline" className="text-xs">COM3</Badge>, <Badge variant="outline" className="text-xs">COM4</Badge>)</li>
                    <li>Si no aparece, puede que falte el driver del adaptador USB-Serial (Prolific, FTDI, CH340)</li>
                  </ol>
                  <div className="bg-stone-100 rounded-md p-3 text-xs">
                    <p className="font-semibold text-stone-600">Drivers comunes de adaptadores USB-Serial:</p>
                    <ul className="mt-1 space-y-1">
                      <li>- <strong>Prolific PL2303:</strong> <a href="https://prolificusa.com/pl2303hx-drivers/" target="_blank" rel="noopener" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">prolificusa.com <ExternalLink className="w-3 h-3" /></a></li>
                      <li>- <strong>FTDI FT232:</strong> <a href="https://ftdichip.com/drivers/vcp-drivers/" target="_blank" rel="noopener" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">ftdichip.com <ExternalLink className="w-3 h-3" /></a></li>
                      <li>- <strong>CH340/CH341:</strong> <a href="https://www.wch-ic.com/downloads/CH341SER_EXE.html" target="_blank" rel="noopener" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">wch-ic.com <ExternalLink className="w-3 h-3" /></a></li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* PASO 2 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                  <h3 className="font-bold text-base">Descargar e instalar el programa Bridge</h3>
                </div>
                <div className="ml-9 space-y-3 text-sm text-stone-700">
                  <p>Descarga uno de estos programas gratuitos que convierten puerto serie a TCP:</p>
                  
                  {/* Opcion A */}
                  <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="font-bold text-green-800">Opcion A: HW VSP (Recomendado - mas simple)</span>
                    </div>
                    <ul className="space-y-1 text-xs text-green-700">
                      <li>- Crea un <strong>puerto COM virtual</strong> que redirige a TCP/IP</li>
                      <li>- Interfaz grafica simple, no necesita linea de comandos</li>
                      <li>- Compatible con Windows 7/8/10/11</li>
                      <li>- <a href="https://www.hw-group.com/free-hw-vsp" target="_blank" rel="noopener" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">Descargar HW VSP Free <ExternalLink className="w-3 h-3" /></a></li>
                    </ul>
                  </div>

                  {/* Opcion B */}
                  <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="w-4 h-4 text-blue-600" />
                      <span className="font-bold text-blue-800">Opcion B: com2tcp (Vía linea de comandos)</span>
                    </div>
                    <ul className="space-y-1 text-xs text-blue-700">
                      <li>- Ligero, de codigo abierto</li>
                      <li>- Se ejecuta desde consola CMD</li>
                      <li>- <a href="https://sourceforge.net/projects/com2tcp/" target="_blank" rel="noopener" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">Descargar com2tcp <ExternalLink className="w-3 h-3" /></a></li>
                    </ul>
                  </div>

                  {/* Opcion C */}
                  <div className="border border-purple-200 bg-purple-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="w-4 h-4 text-purple-600" />
                      <span className="font-bold text-purple-800">Opcion C: Serial to Ethernet Connector (De pago)</span>
                    </div>
                    <ul className="space-y-1 text-xs text-purple-700">
                      <li>- Profesional, con interfaz completa</li>
                      <li>- Soporte tecnico incluido</li>
                      <li>- <a href="https://www.eltima.com/serial-to-ethernet/" target="_blank" rel="noopener" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">Serial to Ethernet Connector <ExternalLink className="w-3 h-3" /></a></li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* PASO 3 - HW VSP */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                  <h3 className="font-bold text-base">Configurar el Bridge (con HW VSP)</h3>
                </div>
                <div className="ml-9 space-y-2 text-sm text-stone-700">
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li>Abris <strong>HW VSP</strong> instalado en tu PC</li>
                    <li>En <strong>"Virtual Serial Port"</strong>, selecciona un puerto COM nuevo (ej: <Badge variant="outline" className="text-xs">COM10</Badge>)</li>
                    <li>En <strong>"TCP Server"</strong>, configurar:</li>
                  </ol>
                  <div className="bg-stone-100 rounded-md p-3 ml-5">
                    <table className="text-xs w-full">
                      <tbody>
                        <tr className="border-b border-stone-200">
                          <td className="py-1 font-semibold w-40">IP de escucha:</td>
                          <td className="py-1"><code className="bg-white px-2 py-0.5 rounded border">0.0.0.0</code> (todas las interfaces) o la IP de la PC</td>
                        </tr>
                        <tr className="border-b border-stone-200">
                          <td className="py-1 font-semibold">Puerto TCP:</td>
                          <td className="py-1"><code className="bg-white px-2 py-0.5 rounded border">5000</code> (o el que prefieras)</td>
                        </tr>
                        <tr>
                          <td className="py-1 font-semibold">Baud Rate:</td>
                          <td className="py-1"><code className="bg-white px-2 py-0.5 rounded border">9600</code> (debe coincidir con la balanza)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <ol start={4} className="list-decimal list-inside space-y-1.5">
                    <li>En <strong>"Mapping"</strong>: mapear el <strong>puerto COM virtual</strong> al <strong>puerto COM real</strong> de la balanza</li>
                    <li>Apretar <strong>"Create"</strong> o <strong>"Apply"</strong> para activar la conexion</li>
                    <li>Verificar que el estado sea <Badge className="bg-green-100 text-green-700 text-xs">Activo</Badge></li>
                  </ol>
                </div>
              </div>

              {/* PASO 3B - com2tcp */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="bg-stone-400 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">3b</span>
                  <h3 className="font-bold text-base">Alternativa: Configurar con com2tcp (CMD)</h3>
                </div>
                <div className="ml-9 space-y-2 text-sm text-stone-700">
                  <p>Abris una consola <strong>CMD</strong> como administrador y ejecuta:</p>
                  <div className="bg-stone-900 text-green-400 rounded-lg p-3 font-mono text-xs">
                    <p className="text-stone-500"># Sintaxis:</p>
                    <p>com2tcp --baudrate 9600 COM3 5000</p>
                    <p className="mt-2 text-stone-500"># Ejemplo con tu balanza:</p>
                    <p>com2tcp --baudrate 9600 COM3 5000</p>
                    <p className="mt-2 text-stone-500"># Si la balanza usa 19200 baudios:</p>
                    <p>com2tcp --baudrate 19200 COM3 5000</p>
                  </div>
                  <p className="text-xs text-stone-500">Donde <code>COM3</code> es el puerto de la balanza y <code>5000</code> es el puerto TCP que va a escuchar.</p>
                </div>
              </div>

              {/* PASO 4 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">4</span>
                  <h3 className="font-bold text-base">Probar la conexion</h3>
                </div>
                <div className="ml-9 space-y-2 text-sm text-stone-700">
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li>Abris una consola <strong>CMD</strong> en la PC donde corre el bridge</li>
                    <li>Ejecuta este comando para probar que responde:</li>
                  </ol>
                  <div className="bg-stone-900 text-green-400 rounded-lg p-3 font-mono text-xs">
                    <p className="text-stone-500"># Probar conexion local (desde la misma PC):</p>
                    <p>telnet localhost 5000</p>
                    <p className="mt-2 text-stone-500"># Probar desde otra PC en la red:</p>
                    <p>telnet 192.168.1.50 5000</p>
                  </div>
                  <p className="text-xs text-stone-500">Si la balanza esta enviando datos, deberias ver caracteres en la pantalla (el peso en formato de texto).</p>
                  <p className="text-xs text-stone-500">Tambien podes usar <strong>PuTTY</strong> en modo "Raw" o <strong>HyperTerminal</strong> para probar.</p>
                </div>
              </div>

              {/* PASO 5 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">5</span>
                  <h3 className="font-bold text-base">Configurar la balanza en la aplicacion</h3>
                </div>
                <div className="ml-9 space-y-2 text-sm text-stone-700">
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li>Volve a la pestana <strong>"Balanzas"</strong> en esta pantalla</li>
                    <li>Hacé clic en <strong>"Nueva Balanza"</strong></li>
                    <li>Completar los datos:</li>
                  </ol>
                  <div className="bg-stone-100 rounded-md p-3 ml-5">
                    <table className="text-xs w-full">
                      <tbody>
                        <tr className="border-b border-stone-200">
                          <td className="py-1 font-semibold w-40">Tipo de conexion:</td>
                          <td className="py-1"><strong>TCP/IP (Red)</strong></td>
                        </tr>
                        <tr className="border-b border-stone-200">
                          <td className="py-1 font-semibold">IP:</td>
                          <td className="py-1">La IP de la PC donde corre el bridge (ej: <code className="bg-white px-1 rounded border">192.168.1.50</code> o <code className="bg-white px-1 rounded border">localhost</code> si es la misma PC)</td>
                        </tr>
                        <tr className="border-b border-stone-200">
                          <td className="py-1 font-semibold">Puerto TCP:</td>
                          <td className="py-1"><code className="bg-white px-1 rounded border">5000</code> (el que configuraste en el bridge)</td>
                        </tr>
                        <tr className="border-b border-stone-200">
                          <td className="py-1 font-semibold">Protocolo:</td>
                          <td className="py-1">Seleccionar la marca de la balanza (Toledo, Mettler, etc.)</td>
                        </tr>
                        <tr>
                          <td className="py-1 font-semibold">Unidad:</td>
                          <td className="py-1"><code className="bg-white px-1 rounded border">kg</code></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <ol start={4} className="list-decimal list-inside space-y-1.5">
                    <li>Guarda la balanza y <strong>activa el switch</strong></li>
                    <li>En el modulo de <strong>Romaneo</strong>, pulsá el boton <strong>"BALANZA"</strong> para activar la lectura automatica</li>
                  </ol>
                </div>
              </div>

              {/* PASO 6 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">6</span>
                  <h3 className="font-bold text-base">Hacer que el bridge arranque con Windows (opcional)</h3>
                </div>
                <div className="ml-9 space-y-2 text-sm text-stone-700">
                  <p>Para que no tengas que abrir el programa cada vez que prendes la PC:</p>
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li>Presiona <strong>Win + R</strong>, escribí <code className="bg-stone-100 px-1 rounded">shell:startup</code> y apreta Enter</li>
                    <li>Se abre la carpeta de inicio de Windows</li>
                    <li>Creá un acceso directo al programa del bridge (o al .bat con el comando com2tcp)</li>
                    <li>Cada vez que Windows arranque, el bridge se ejecutara automaticamente</li>
                  </ol>
                </div>
              </div>

              {/* TROUBLESHOOTING */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-base">Solucion de problemas</h3>
                </div>
                <div className="ml-9 space-y-2">
                  <div className="border border-stone-200 rounded-lg divide-y">
                    <div className="p-3">
                      <p className="font-semibold text-sm text-stone-800">No aparece el puerto COM</p>
                      <p className="text-xs text-stone-600 mt-0.5">Verifica que el adaptador USB-Serial este conectado. Probá en otro puerto USB. Instalá los drivers de la seccion Paso 1.</p>
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-sm text-stone-800">El bridge se conecta pero no recibe datos</p>
                      <p className="text-xs text-stone-600 mt-0.5">Verifica el Baud Rate. La balanza y el bridge deben tener el mismo valor (generalmente 9600). Revisá el manual de la balanza para confirmar. Probá con Putty conectando directamente al COM para ver si la balanza envia datos.</p>
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-sm text-stone-800">La app dice "Error TCP" o "Timeout"</p>
                      <p className="text-xs text-stone-600 mt-0.5">Verifica que el firewall de Windows no este bloqueando el puerto TCP (5000). Agregá una regla de entrada en el firewall. Tambien verificá que la IP en la app coincida con la IP de la PC donde corre el bridge.</p>
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-sm text-stone-800">El peso se ve pero aparece "No se pudo interpretar"</p>
                      <p className="text-xs text-stone-600 mt-0.5">Cambia el protocolo en la configuracion de la balanza. Si no sabes el formato exacto, usa "Generico ASCII" que intenta detectar numeros automaticamente. Si tu balanza es Toledo, Mettler o similar, selecciona la marca correspondiente.</p>
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-sm text-stone-800">El puerto COM cambia al reiniciar</p>
                      <p className="text-xs text-stone-600 mt-0.5">En Administrador de dispositivos, clic derecho en el puerto COM &gt; Propiedades &gt; Port Settings &gt; Advanced &gt; desmarcar "Automaticamente asignar numero de puerto" y elegí un numero fijo.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* CONFIGURACION FIREWALL */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="bg-red-500 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">!</span>
                  <h3 className="font-bold text-base">Configurar Firewall de Windows</h3>
                </div>
                <div className="ml-9 space-y-2 text-sm text-stone-700">
                  <p>Si la app corre en otra PC y no puede conectarse al bridge, abrí el puerto en el firewall:</p>
                  <ol className="list-decimal list-inside space-y-1.5">
                    <li>Busca <strong>"Firewall de Windows Defender"</strong> en el menu inicio</li>
                    <li>Clic en <strong>"Configuracion avanzada"</strong></li>
                    <li>A la izquierda, <strong>"Reglas de entrada"</strong> &gt; <strong>"Nueva regla"</strong></li>
                    <li>Selecciona <strong>"Puerto"</strong> &gt; Siguiente</li>
                    <li>Elegi <strong>TCP</strong>, puerto especifico: <code className="bg-stone-100 px-1 rounded">5000</code> &gt; Siguiente</li>
                    <li>Permitir la conexion &gt; Siguiente</li>
                    <li>Nombre: <code className="bg-stone-100 px-1 rounded">Bridge Balanza</code> &gt; Finalizar</li>
                  </ol>
                </div>
              </div>

            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Balanza */}
      <Dialog open={modalBalanza} onOpenChange={setModalBalanza}>
        <DialogContent className="max-w-lg" maximizable>
          <DialogHeader>
            <DialogTitle>{editandoBalanza ? 'Editar Balanza' : 'Nueva Balanza'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input value={balanzaForm.nombre} onChange={(e) => setBalanzaForm({...balanzaForm, nombre: e.target.value})} placeholder="Balanza Principal" />
              </div>
              <div className="space-y-2">
                <Label>Código</Label>
                <Input value={balanzaForm.codigo} onChange={(e) => setBalanzaForm({...balanzaForm, codigo: e.target.value})} placeholder="BAL-001" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Conexión</Label>
              <Select value={balanzaForm.tipoConexion} onValueChange={(v) => setBalanzaForm({...balanzaForm, tipoConexion: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_CONEXION.map(tc => (
                    <SelectItem key={tc.value} value={tc.value}>
                      <div className="flex items-center gap-2">
                        <tc.icon className="w-4 h-4" /> {tc.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {balanzaForm.tipoConexion === 'SERIAL' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Puerto</Label>
                  <Input value={balanzaForm.puerto} onChange={(e) => setBalanzaForm({...balanzaForm, puerto: e.target.value})} placeholder="COM1" />
                </div>
                <div className="space-y-2">
                  <Label>Baud Rate</Label>
                  <Select value={balanzaForm.baudRate} onValueChange={(v) => setBalanzaForm({...balanzaForm, baudRate: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="9600">9600</SelectItem>
                      <SelectItem value="19200">19200</SelectItem>
                      <SelectItem value="38400">38400</SelectItem>
                      <SelectItem value="57600">57600</SelectItem>
                      <SelectItem value="115200">115200</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {balanzaForm.tipoConexion === 'TCP' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dirección IP</Label>
                  <Input value={balanzaForm.ip} onChange={(e) => setBalanzaForm({...balanzaForm, ip: e.target.value})} placeholder="192.168.1.100" />
                </div>
                <div className="space-y-2">
                  <Label>Puerto TCP</Label>
                  <Input value={balanzaForm.puertoTcp} onChange={(e) => setBalanzaForm({...balanzaForm, puertoTcp: e.target.value})} placeholder="5000" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Protocolo</Label>
                <Select value={balanzaForm.protocolo} onValueChange={(v) => setBalanzaForm({...balanzaForm, protocolo: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROTOCOLOS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unidad</Label>
                <Select value={balanzaForm.unidad} onValueChange={(v) => setBalanzaForm({...balanzaForm, unidad: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">Kilogramos (kg)</SelectItem>
                    <SelectItem value="lb">Libras (lb)</SelectItem>
                    <SelectItem value="g">Gramos (g)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Capacidad Máx (kg)</Label>
                <Input type="number" value={balanzaForm.capacidadMax} onChange={(e) => setBalanzaForm({...balanzaForm, capacidadMax: e.target.value})} placeholder="1000" />
              </div>
              <div className="space-y-2">
                <Label>División mínima</Label>
                <Input type="number" step="0.01" value={balanzaForm.division} onChange={(e) => setBalanzaForm({...balanzaForm, division: e.target.value})} placeholder="0.1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalBalanza(false)}>Cancelar</Button>
            <Button onClick={handleGuardarBalanza} disabled={guardando} className="bg-amber-500 hover:bg-amber-600">
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Puesto */}
      <Dialog open={modalPuesto} onOpenChange={setModalPuesto}>
        <DialogContent className="max-w-lg" maximizable>
          <DialogHeader>
            <DialogTitle>{editandoPuesto ? 'Editar Puesto' : 'Nuevo Puesto de Trabajo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input value={puestoForm.nombre} onChange={(e) => setPuestoForm({...puestoForm, nombre: e.target.value})} placeholder="Romaneo 1" />
              </div>
              <div className="space-y-2">
                <Label>Código</Label>
                <Input value={puestoForm.codigo} onChange={(e) => setPuestoForm({...puestoForm, codigo: e.target.value})} placeholder="PUESTO-001" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sector</Label>
                <Select value={puestoForm.sector} onValueChange={(v) => setPuestoForm({...puestoForm, sector: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {SECTORES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Balanza Asignada</Label>
                <Select value={puestoForm.balanzaId} onValueChange={(v) => setPuestoForm({...puestoForm, balanzaId: v})}>
                  <SelectTrigger><SelectValue placeholder="Sin balanza" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Sin balanza</SelectItem>
                    {balanzas.filter(b => b.activa).map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ubicación</Label>
              <Input value={puestoForm.ubicacion} onChange={(e) => setPuestoForm({...puestoForm, ubicacion: e.target.value})} placeholder="Planta baja, sector A" />
            </div>

            <div className="border-t pt-4">
              <Label className="flex items-center gap-2"><Printer className="w-4 h-4" /> Impresora de Rótulos</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="space-y-2">
                  <Label className="text-sm text-stone-500">Dirección IP</Label>
                  <Input value={puestoForm.impresoraIp} onChange={(e) => setPuestoForm({...puestoForm, impresoraIp: e.target.value})} placeholder="192.168.1.50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-stone-500">Puerto</Label>
                  <Input value={puestoForm.impresoraPuerto} onChange={(e) => setPuestoForm({...puestoForm, impresoraPuerto: e.target.value})} placeholder="9100" />
                </div>
              </div>
              <div className="space-y-2 mt-2">
                <Label className="text-sm text-stone-500">Modelo</Label>
                <Input value={puestoForm.impresoraModelo} onChange={(e) => setPuestoForm({...puestoForm, impresoraModelo: e.target.value})} placeholder="Zebra ZT410" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={puestoForm.scannerHabilitado} onCheckedChange={(v) => setPuestoForm({...puestoForm, scannerHabilitado: v})} />
              <Label>Scanner de código de barras habilitado</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalPuesto(false)}>Cancelar</Button>
            <Button onClick={handleGuardarPuesto} disabled={guardando} className="bg-amber-500 hover:bg-amber-600">
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ConfigBalanzasModule
