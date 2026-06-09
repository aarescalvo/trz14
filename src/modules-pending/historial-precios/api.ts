// API functions para el módulo de Historial de Precios

import type { PrecioHistorial, PrecioActual, FiltrosPrecio, NuevoPrecioInput, EstadisticasPrecio } from './types'

const API_BASE = '/api/historial-precios'

// Obtener historial de precios con filtros
export async function getHistorialPrecios(filtros?: FiltrosPrecio): Promise<PrecioHistorial[]> {
  const params = new URLSearchParams()
  if (filtros?.tipo) params.append('tipo', filtros.tipo)
  if (filtros?.entidadId) params.append('entidadId', filtros.entidadId)
  if (filtros?.fechaDesde) params.append('fechaDesde', filtros.fechaDesde)
  if (filtros?.fechaHasta) params.append('fechaHasta', filtros.fechaHasta)
  if (filtros?.busqueda) params.append('busqueda', filtros.busqueda)
  if (filtros?.moneda) params.append('moneda', filtros.moneda)

  const res = await fetch(`${API_BASE}?${params}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Error al obtener historial')
  return data.data
}

// Obtener precios actuales
export async function getPreciosActuales(tipo?: string): Promise<PrecioActual[]> {
  const params = new URLSearchParams()
  if (tipo) params.append('tipo', tipo)

  const res = await fetch(`${API_BASE}/actuales?${params}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Error al obtener precios actuales')
  return data.data
}

// Obtener historial de una entidad específica
export async function getHistorialEntidad(entidadId: string): Promise<PrecioHistorial[]> {
  const res = await fetch(`${API_BASE}/entidad/${entidadId}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Error al obtener historial de entidad')
  return data.data
}

// Registrar nuevo precio
export async function registrarPrecio(input: NuevoPrecioInput): Promise<PrecioHistorial> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input)
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Error al registrar precio')
  return data.data
}

// Actualizar precio (con cálculo automático de variación)
export async function actualizarPrecio(
  entidadId: string, 
  nuevoPrecio: number, 
  observaciones?: string
): Promise<PrecioHistorial> {
  const res = await fetch(API_BASE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entidadId, nuevoPrecio, observaciones })
  })
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Error al actualizar precio')
  return data.data
}

// Obtener estadísticas
export async function getEstadisticas(fechaDesde?: string, fechaHasta?: string): Promise<EstadisticasPrecio> {
  const params = new URLSearchParams()
  if (fechaDesde) params.append('fechaDesde', fechaDesde)
  if (fechaHasta) params.append('fechaHasta', fechaHasta)

  const res = await fetch(`${API_BASE}/estadisticas?${params}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Error al obtener estadísticas')
  return data.data
}

// Exportar a CSV
export async function exportarHistorial(filtros?: FiltrosPrecio): Promise<Blob> {
  const params = new URLSearchParams()
  if (filtros?.tipo) params.append('tipo', filtros.tipo)
  if (filtros?.fechaDesde) params.append('fechaDesde', filtros.fechaDesde)
  if (filtros?.fechaHasta) params.append('fechaHasta', filtros.fechaHasta)
  params.append('formato', 'csv')

  const res = await fetch(`${API_BASE}/exportar?${params}`)
  if (!res.ok) throw new Error('Error al exportar')
  return res.blob()
}

// Obtener variaciones por tipo
export async function getVariacionesPorTipo(): Promise<{ tipo: string; variacion: number }[]> {
  const res = await fetch(`${API_BASE}/variaciones-tipo`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Error al obtener variaciones')
  return data.data
}

// Obtener últimas variaciones
export async function getUltimasVariaciones(limite?: number): Promise<PrecioHistorial[]> {
  const params = new URLSearchParams()
  if (limite) params.append('limite', limite.toString())

  const res = await fetch(`${API_BASE}/ultimas?${params}`)
  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Error al obtener últimas variaciones')
  return data.data
}
