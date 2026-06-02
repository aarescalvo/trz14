'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  History, DollarSign, Plus, Loader2, RefreshCw, TrendingUp, TrendingDown,
  Tag, Building2, Beaker, Shield, ChevronDown, ChevronUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface TipoTarifa { id: string; codigo: string; descripcion: string; unidad: string; activo: boolean }
interface HistoricoTarifa {
  id: string; tipoTarifaId: string; tipoTarifa?: TipoTarifa; clienteId?: string | null;
  especie?: string | null; categoria?: string | null; valor: number; moneda: string;
  vigenciaDesde: string; vigenciaHasta?: string | null; operadorId?: string | null;
  motivo?: string | null; createdAt: string;
  cliente?: { id: string; nombre: string; razonSocial?: string }
  operador?: { id: string; nombre: string }
}
interface Cliente { id: string; nombre: string; razonSocial?: string }

interface Props { operador: { id: string; nombre: string; rol: string } }

export function HistoricoPrecios({ operador }: Props) {
  const [tarifas, setTarifas] = useState<HistoricoTarifa[]>([])
  const [historico, setHistorico] = useState<HistoricoTarifa[]>([])
  const [tipos, setTipos] = useState<TipoTarifa[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // Filters
  const [filtroTipo, setFiltroTipo] = useState('TODOS')
  const [filtroCliente, setFiltroCliente] = useState('TODOS')
  const [filtroEspecie, setFiltroEspecie] = useState('TODOS')

  // New tarifa form
  const [form, setForm] = useState({
    tipoTarifaCodigo: '',
    valor: 0,
    vigenciaDesde: new Date().toISOString().split('T')[0],
    clienteId: '' as string | null,
    especie: '' as string | null,
    categoria: '' as string | null,
    motivo: '',
  })

  const esAdmin = operador.rol === 'ADMINISTRADOR'
  const formatCurrency = (v: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(v)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [tiposRes, clientesRes] = await Promise.all([
        fetch('/api/tarifas?modo=tipos'),
        fetch('/api/clientes'),
      ])
      const tiposData = await tiposRes.json()
      const clientesData = await clientesRes.json()
      if (tiposData.success) setTipos(tiposData.data)
      if (clientesData.success) setClientes(clientesData.data)
    } catch (error) { console.error(error) } finally { setLoading(false) }
  }, [])

  const fetchVigentes = useCallback(async () => {
    try {
      const res = await fetch('/api/tarifas?modo=vigentes')
      const data = await res.json()
      if (data.success) setTarifas(data.data)
    } catch (error) { console.error(error) }
  }, [])

  const fetchHistorico = useCallback(async () => {
    try {
      const params = new URLSearchParams({ modo: 'historico' })
      if (filtroTipo !== 'TODOS') params.set('tipo', filtroTipo)
      if (filtroCliente !== 'TODOS') params.set('clienteId', filtroCliente)
      if (filtroEspecie !== 'TODOS') params.set('especie', filtroEspecie)
      const res = await fetch(`/api/tarifas?${params.toString()}`)
      const data = await res.json()
      if (data.success) setHistorico(data.data)
    } catch (error) { console.error(error) }
  }, [filtroTipo, filtroCliente, filtroEspecie])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { fetchVigentes() }, [fetchVigentes])
  useEffect(() => { fetchHistorico() }, [fetchHistorico])

  const handleSeed = async () => {
    try {
      const res = await fetch('/api/tarifas?modo=seed')
      const data = await res.json()
      if (data.success) { toast.success(data.message); fetchAll(); fetchVigentes(); fetchHistorico() }
    } catch { toast.error('Error al inicializar') }
  }

  const handleCrearTarifa = async () => {
    if (!form.tipoTarifaCodigo || form.valor <= 0 || !form.motivo) {
      toast.error('Complete todos los campos obligatorios')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/tarifas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, operadorId: operador.id, clienteId: form.clienteId || null, especie: form.especie || null, categoria: form.categoria || null })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Tarifa creada exitosamente')
        setDialogOpen(false)
        setForm({ tipoTarifaCodigo: '', valor: 0, vigenciaDesde: new Date().toISOString().split('T')[0], clienteId: null, especie: null, categoria: null, motivo: '' })
        fetchVigentes()
        fetchHistorico()
      } else {
        toast.error(data.error || 'Error al crear tarifa')
      }
    } catch { toast.error('Error de conexión') } finally { setSaving(false) }
  }

  const calcularVariacion = (tarifa: HistoricoTarifa, lista: HistoricoTarifa[]) => {
    const anteriores = lista.filter(t =>
      t.tipoTarifaId === tarifa.tipoTarifaId &&
      t.clienteId === tarifa.clienteId &&
      t.especie === tarifa.especie &&
      new Date(t.vigenciaDesde) < new Date(tarifa.vigenciaDesde)
    ).sort((a, b) => new Date(b.vigenciaDesde).getTime() - new Date(a.vigenciaDesde).getTime())

    if (anteriores.length === 0) return null
    const anterior = anteriores[0].valor
    if (anterior === 0) return null
    return ((tarifa.valor - anterior) / anterior * 100)
  }

  // Unified list: show vigentes with their history grouped underneath
  // Group historico by tipo+cliente+especie
  const getHistorialForTarifa = (tarifa: HistoricoTarifa) => {
    return historico
      .filter(h =>
        h.tipoTarifaId === tarifa.tipoTarifaId &&
        h.clienteId === tarifa.clienteId &&
        h.especie === tarifa.especie
      )
      .sort((a, b) => new Date(b.vigenciaDesde).getTime() - new Date(a.vigenciaDesde).getTime())
  }

  const filteredTarifas = tarifas.filter(t => {
    if (filtroTipo !== 'TODOS' && t.tipoTarifa?.codigo !== filtroTipo) return false
    if (filtroCliente !== 'TODOS' && t.clienteId !== filtroCliente) return false
    if (filtroEspecie !== 'TODOS' && t.especie !== filtroEspecie) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm bg-stone-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2"><Tag className="w-5 h-5 text-stone-600" /><div><p className="text-xs text-stone-500">Total Tarifas</p><p className="text-xl font-bold text-stone-700">{tarifas.length}</p></div></div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-emerald-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-emerald-600" /><div><p className="text-xs text-stone-500">Vigentes</p><p className="text-xl font-bold text-emerald-700">{tarifas.filter(t => !t.vigenciaHasta).length}</p></div></div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-amber-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2"><Building2 className="w-5 h-5 text-amber-600" /><div><p className="text-xs text-stone-500">Clientes Especiales</p><p className="text-xl font-bold text-amber-700">{new Set(tarifas.filter(t => t.clienteId).map(t => t.clienteId)).size}</p></div></div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-blue-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2"><History className="w-5 h-5 text-blue-600" /><div><p className="text-xs text-stone-500">Historial</p><p className="text-xl font-bold text-blue-700">{historico.length}</p></div></div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros + Acciones */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2 items-end justify-between">
            <div className="flex flex-wrap gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    {tipos.map(t => <SelectItem key={t.id} value={t.codigo}>{t.descripcion}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cliente</Label>
                <Select value={filtroCliente} onValueChange={setFiltroCliente}>
                  <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Especie</Label>
                <Select value={filtroEspecie} onValueChange={setFiltroEspecie}>
                  <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todas</SelectItem>
                    <SelectItem value="BOVINO">Bovino</SelectItem>
                    <SelectItem value="EQUINO">Equino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" className="h-9" onClick={() => { setFiltroTipo('TODOS'); setFiltroCliente('TODOS'); setFiltroEspecie('TODOS') }}>Limpiar</Button>
            </div>
            <div className="flex gap-2">
              {tipos.length === 0 && <Button size="sm" variant="outline" className="h-9" onClick={handleSeed}><Beaker className="w-4 h-4 mr-1" />Inicializar</Button>}
              {esAdmin && <Button size="sm" className="h-9 bg-amber-500 hover:bg-amber-600" onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-1" />Nueva Tarifa</Button>}
              <Button size="sm" variant="outline" className="h-9" onClick={() => { fetchVigentes(); fetchHistorico(); }}><RefreshCw className="w-4 h-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unified Table: Vigentes with expandable history */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
          ) : filteredTarifas.length === 0 ? (
            <div className="py-12 text-center text-stone-400"><Tag className="w-16 h-16 mx-auto mb-4 opacity-50" /><p>No hay tarifas vigentes</p></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-stone-50">
                  <TableHead className="text-xs font-semibold w-8"></TableHead>
                  <TableHead className="text-xs font-semibold">Tipo</TableHead>
                  <TableHead className="text-xs font-semibold">Especie</TableHead>
                  <TableHead className="text-xs font-semibold">Cliente</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Valor Actual</TableHead>
                  <TableHead className="text-xs font-semibold">Unidad</TableHead>
                  <TableHead className="text-xs font-semibold">Vigencia</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Var.</TableHead>
                  <TableHead className="text-xs font-semibold">Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTarifas.map((t) => {
                  const isExpanded = expandedRow === `${t.tipoTarifaId}-${t.clienteId || 'general'}-${t.especie || 'all'}`
                  const historialForTarifa = getHistorialForTarifa(t)
                  const variacion = calcularVariacion(t, historico)

                  return (
                    <tbody key={t.id}>
                      <TableRow
                        className="text-xs cursor-pointer hover:bg-stone-50"
                        onClick={() => {
                          const key = `${t.tipoTarifaId}-${t.clienteId || 'general'}-${t.especie || 'all'}`
                          setExpandedRow(isExpanded ? null : key)
                        }}
                      >
                        <TableCell className="w-8">
                          {historialForTarifa.length > 0 && (
                            isExpanded ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{t.tipoTarifa?.descripcion || '-'}</TableCell>
                        <TableCell>{t.especie || <span className="text-stone-400">General</span>}</TableCell>
                        <TableCell>{t.cliente?.nombre || <span className="text-stone-400">General</span>}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatCurrency(t.valor)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{t.tipoTarifa?.unidad || 'POR_KG'}</Badge></TableCell>
                        <TableCell>
                          <p>{new Date(t.vigenciaDesde).toLocaleDateString('es-AR')}</p>
                          {t.vigenciaHasta && <p className="text-stone-400">hasta {new Date(t.vigenciaHasta).toLocaleDateString('es-AR')}</p>}
                          {!t.vigenciaHasta && <Badge className="bg-emerald-100 text-emerald-700 text-xs mt-1">Vigente</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          {variacion !== null ? (
                            <Badge className={`text-xs ${variacion > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              {variacion > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                              {variacion > 0 ? '+' : ''}{variacion.toFixed(1)}%
                            </Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate" title={t.motivo || ''}>{t.motivo || '-'}</TableCell>
                      </TableRow>
                      {/* Expandable history rows */}
                      {isExpanded && historialForTarifa.length > 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="bg-stone-50/50 px-6 py-2">
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-stone-500 mb-2">Historial de cambios ({historialForTarifa.length})</p>
                              {historialForTarifa.map((h) => {
                                const varH = calcularVariacion(h, historialForTarifa)
                                return (
                                  <div key={h.id} className="flex items-center gap-4 text-xs py-1 border-b border-stone-100 last:border-0">
                                    <span className="text-stone-400 w-24">{new Date(h.vigenciaDesde).toLocaleDateString('es-AR')}</span>
                                    {h.vigenciaHasta && <span className="text-stone-400 w-24">hasta {new Date(h.vigenciaHasta).toLocaleDateString('es-AR')}</span>}
                                    {!h.vigenciaHasta && <span className="w-24"></span>}
                                    <span className="font-mono">{formatCurrency(h.valor)}</span>
                                    {varH !== null && (
                                      <Badge className={`text-xs ${varH > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                        {varH > 0 ? '+' : ''}{varH.toFixed(1)}%
                                      </Badge>
                                    )}
                                    <span className="text-stone-500">{h.operador?.nombre || '-'}</span>
                                    <span className="text-stone-400 truncate max-w-[200px]" title={h.motivo || ''}>{h.motivo || ''}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </tbody>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Nueva Tarifa Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg" maximizable>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-amber-500" />Nueva Tarifa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Tarifa *</Label>
              <Select value={form.tipoTarifaCodigo} onValueChange={v => setForm({ ...form, tipoTarifaCodigo: v })}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {tipos.map(t => <SelectItem key={t.id} value={t.codigo}>{t.descripcion} ({t.unidad})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Aplica a</Label>
              <Select value={form.clienteId ? 'cliente' : 'general'} onValueChange={v => setForm({ ...form, clienteId: v === 'cliente' ? '' : null })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">Tarifa General</SelectItem>
                  <SelectItem value="cliente">Cliente Específico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.clienteId !== null && (
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={form.clienteId || ''} onValueChange={v => setForm({ ...form, clienteId: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar cliente..." /></SelectTrigger>
                  <SelectContent>
                    {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Especie</Label>
                <Select value={form.especie || 'TODAS'} onValueChange={v => setForm({ ...form, especie: v === 'TODAS' ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todas</SelectItem>
                    <SelectItem value="BOVINO">Bovino</SelectItem>
                    <SelectItem value="EQUINO">Equino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nuevo Valor ($) *</Label>
                <Input type="number" value={form.valor || ''} onChange={e => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Vigencia Desde *</Label>
              <Input type="date" value={form.vigenciaDesde} onChange={e => setForm({ ...form, vigenciaDesde: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Motivo del cambio *</Label>
              <Textarea value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} placeholder="Ej: Actualización por inflación, Acuerdo con cliente..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-amber-500 hover:bg-amber-600" onClick={handleCrearTarifa} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}Crear Tarifa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
