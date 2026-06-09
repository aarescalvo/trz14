// Tipos para el módulo de Historial de Precios

export type TipoEntidadPrecio = 'PRODUCTO' | 'SERVICIO' | 'INSUMO' | 'CLIENTE_ESPECIAL'

export type TendenciaPrecio = 'SUBIENDO' | 'BAJANDO' | 'ESTABLE'

export interface PrecioHistorial {
  id: string
  tipo: TipoEntidadPrecio
  entidadId: string
  entidadNombre: string
  precioAnterior: number
  precioNuevo: number
  variacionPorcentaje: number
  moneda: string
  fecha: string
  operadorId?: string
  operador?: {
    id: string
    nombre: string
  }
  observaciones?: string
  createdAt: string
}

export interface PrecioActual {
  entidadId: string
  entidadNombre: string
  tipo: TipoEntidadPrecio
  precioActual: number
  precioAnterior?: number
  ultimaActualizacion: string
  variacion?: number
  tendencia: TendenciaPrecio
  moneda: string
}

export interface FiltrosPrecio {
  tipo?: TipoEntidadPrecio
  entidadId?: string
  fechaDesde?: string
  fechaHasta?: string
  busqueda?: string
  moneda?: string
}

export interface NuevoPrecioInput {
  tipo: TipoEntidadPrecio
  entidadId: string
  precio: number
  moneda: string
  observaciones?: string
  operadorId?: string
}

export interface EstadisticasPrecio {
  totalEntidades: number
  cambiosHoy: number
  cambiosSemana: number
  cambiosMes: number
  promedioVariacion: number
  maximaVariacion: number
  minimaVariacion: number
  tendenciaGeneral: TendenciaPrecio
}

export interface VariacionPorTipo {
  tipo: TipoEntidadPrecio
  cantidad: number
  promedioVariacion: number
  tendencia: TendenciaPrecio
}

// Constantes
export const MONEDAS = [
  { id: 'ARS', nombre: 'Pesos Argentinos', simbolo: '$' },
  { id: 'USD', nombre: 'Dólares Estadounidenses', simbolo: 'U$S' },
  { id: 'EUR', nombre: 'Euros', simbolo: '€' },
]

export const TIPOS_ENTIDAD_PRECIO = [
  { id: 'PRODUCTO', nombre: 'Productos', descripcion: 'Productos del catálogo' },
  { id: 'SERVICIO', nombre: 'Servicios', descripcion: 'Servicios ofrecidos' },
  { id: 'INSUMO', nombre: 'Insumos', descripcion: 'Materiales e insumos' },
  { id: 'CLIENTE_ESPECIAL', nombre: 'Precios Especiales', descripcion: 'Precios personalizados por cliente' },
]
