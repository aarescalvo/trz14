'use client'

import { useState } from 'react'
import { Plus, Beef, UserCheck, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'

interface QuickAddDialogProps {
  tipo: 'transportista' | 'productor' | 'usuarioFaena'
  onAdd: (data: { id: string; nombre: string }) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface FormData {
  nombre: string
  cuit: string
  matricula: string
  direccion: string
  telefono: string
  email: string
}

export function QuickAddDialog({ 
  tipo, 
  onAdd, 
  open, 
  onOpenChange 
}: QuickAddDialogProps) {
  const [formData, setFormData] = useState<FormData>({
    nombre: '',
    cuit: '',
    matricula: '',
    direccion: '',
    telefono: '',
    email: '',
  })
  const [saving, setSaving] = useState(false)

  // Resetear formulario cuando se abre/cierra
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setFormData({
        nombre: '',
        cuit: '',
        matricula: '',
        direccion: '',
        telefono: '',
        email: '',
      })
    }
    onOpenChange(isOpen)
  }

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      toast.error('Ingrese el nombre / razón social')
      return
    }

    setSaving(true)
    try {
      let url = ''
      let body: Record<string, unknown> = {}
      
      if (tipo === 'transportista') {
        url = '/api/transportistas'
        body = { 
          nombre: formData.nombre,
          cuit: formData.cuit || undefined,
          telefono: formData.telefono || undefined
        }
      } else if (tipo === 'productor') {
        url = '/api/clientes'
        body = { 
          nombre: formData.nombre,
          cuit: formData.cuit || undefined,
          tipo: 'PRODUCTOR',
          telefono: formData.telefono || undefined,
          direccion: formData.direccion || undefined,
          email: formData.email || undefined
        }
      } else {
        url = '/api/clientes'
        body = { 
          nombre: formData.nombre,
          cuit: formData.cuit || undefined,
          matricula: formData.matricula || undefined,
          direccion: formData.direccion || undefined,
          telefono: formData.telefono || undefined,
          email: formData.email || undefined
        }
      }
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      
      const data = await res.json()
      
      if (data.success) {
        toast.success(`${tipo === 'transportista' ? 'Transportista' : tipo === 'productor' ? 'Productor' : 'Cliente'} creado correctamente`)
        onAdd(data.data)
        handleOpenChange(false)
      } else {
        toast.error(data.error || 'Error al crear')
      }
    } catch (error) {
      console.error('Error creating:', error)
      toast.error('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const labels = {
    transportista: 'Transportista',
    productor: 'Productor',
    usuarioFaena: 'Usuario de Faena'
  }

  const isTransportista = tipo === 'transportista'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg" maximizable>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {tipo === 'transportista' && <Truck className="w-5 h-5 text-amber-600" />}
            {tipo === 'productor' && <Beef className="w-5 h-5 text-green-600" />}
            {tipo === 'usuarioFaena' && <UserCheck className="w-5 h-5 text-blue-600" />}
            Agregar {labels[tipo]}
          </DialogTitle>
          <DialogDescription>
            Complete los datos para agregar rápidamente
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          {/* Nombre - Siempre visible */}
          <div className="space-y-2">
            <Label>Nombre / Razón Social *</Label>
            <Input
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              placeholder={`Nombre del ${labels[tipo].toLowerCase()}`}
              autoFocus
            />
          </div>

          {/* CUIT y Teléfono - Para todos */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CUIT</Label>
              <Input
                value={formData.cuit}
                onChange={(e) => setFormData({ ...formData, cuit: e.target.value })}
                placeholder="20-12345678-9"
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={formData.telefono}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                placeholder="011-1234-5678"
              />
            </div>
          </div>

          {/* Datos adicionales solo para clientes (no transportistas) */}
          {!isTransportista && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Matrícula</Label>
                  <Input
                    value={formData.matricula}
                    onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
                    placeholder="N° de matrícula"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="correo@ejemplo.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  placeholder="Dirección del cliente"
                />
              </div>

              {/* Tipo de cliente - Pre-seleccionado según el botón */}
              <div className="pt-2 border-t">
                <Label className="text-sm text-stone-500">Tipo de Cliente</Label>
                <div className="flex items-center gap-2 mt-2">
                  {tipo === 'productor' ? (
                    <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                      <Beef className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-green-700">Productor</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <UserCheck className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-700">Usuario de Faena</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-amber-500 hover:bg-amber-600">
            {saving ? 'Guardando...' : 'Agregar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Componente para el botón que abre el diálogo
interface QuickAddButtonProps {
  tipo: 'transportista' | 'productor' | 'usuarioFaena'
  onAdd: (data: { id: string; nombre: string }) => void
}

export function QuickAddButton({ tipo, onAdd }: QuickAddButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button 
        type="button" 
        variant="ghost" 
        size="sm" 
        className="h-7 text-amber-600 hover:text-amber-700"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4 mr-1" />
        Nuevo
      </Button>
      <QuickAddDialog
        tipo={tipo}
        onAdd={onAdd}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
