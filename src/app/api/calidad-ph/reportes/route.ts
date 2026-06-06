import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// ============================================
// GET - Reportes de pH con agregaciones
// Soporta múltiples modos de reporte:
//   - resumen: KPIs y resumen por tropa
//   - detalle: Mediciones individuales paginadas
//   - dfd-productor: Correlación DFD por productor
//   - control-estadistico: Datos para gráficos X-bar y R
//   - listas: Opciones para dropdowns de filtros
// ============================================
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeReportes')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const modo = searchParams.get('modo') || 'resumen'

    switch (modo) {
      case 'resumen':
        return generarResumen(searchParams)
      case 'detalle':
        return generarDetalle(searchParams)
      case 'dfd-productor':
        return generarCorrelacionDFD(searchParams)
      case 'control-estadistico':
        return generarControlEstadistico(searchParams)
      case 'listas':
        return generarListas()
      default:
        return NextResponse.json({ success: false, error: 'Modo de reporte no válido' }, { status: 400 })
    }
  } catch (error) {
    console.error('[calidad-ph/reportes GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Error al generar reporte de pH' }, { status: 500 })
  }
}

// ============================================
// Listas: Opciones para los dropdowns de filtros
// ============================================
async function generarListas() {
  try {
    // Usuarios de faena (clientes con esUsuarioFaena=true que tienen tropas)
    const usuariosFaena = await db.cliente.findMany({
      where: { esUsuarioFaena: true, activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' }
    })

    // Productores (clientes con esProductor=true que tienen tropas)
    const productores = await db.cliente.findMany({
      where: { esProductor: true, activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' }
    })

    // Tropas faenadas (últimos 90 días)
    const noventaDias = new Date()
    noventaDias.setDate(noventaDias.getDate() - 90)
    const tropas = await db.tropa.findMany({
      where: {
        estado: { in: ['FAENADO', 'EN_FAENA'] },
        fechaFaena: { gte: noventaDias }
      },
      select: { id: true, codigo: true, numero: true },
      orderBy: { numero: 'desc' },
      take: 200
    })

    // Tipos de animal desde los enum del schema
    const tiposAnimal = [
      { value: 'TO', label: 'Toro (TO)' },
      { value: 'VA', label: 'Vaca (VA)' },
      { value: 'VQ', label: 'Vaquillona (VQ)' },
      { value: 'MEJ', label: 'Torito/Mej (MEJ)' },
      { value: 'NO', label: 'Novillo (NO)' },
      { value: 'NT', label: 'Novillito (NT)' },
      { value: 'PADRILLO', label: 'Padrillo' },
      { value: 'POTRILLO', label: 'Potrillo' },
      { value: 'YEGUA', label: 'Yegua' },
      { value: 'CABALLO', label: 'Caballo' },
    ]

    return NextResponse.json({
      success: true,
      data: {
        usuariosFaena,
        productores,
        tropas: tropas.map(t => ({
          id: t.id,
          codigo: t.codigo,
          numero: t.numero,
          label: `${t.codigo} (N° ${t.numero})`
        })),
        tiposAnimal
      }
    })
  } catch (error) {
    console.error('[calidad-ph/reportes] Error generando listas:', error)
    return NextResponse.json({ success: false, error: 'Error al cargar listas' }, { status: 500 })
  }
}

// ============================================
// Resumen: KPIs + distribución + por tropa
// ============================================
async function generarResumen(searchParams: URLSearchParams) {
  const fechaDesde = searchParams.get('fechaDesde')
  const fechaHasta = searchParams.get('fechaHasta')
  const tropaCodigo = searchParams.get('tropaCodigo')
  const productorId = searchParams.get('productorId')
  const usuarioFaenaId = searchParams.get('usuarioFaenaId')
  const tipoAnimal = searchParams.get('tipoAnimal')

  const where: any = { numeroMedicion: 1 } // Solo primera medición para resumen
  if (fechaDesde || fechaHasta) {
    where.horaMedicion = {}
    if (fechaDesde) where.horaMedicion.gte = new Date(fechaDesde)
    if (fechaHasta) where.horaMedicion.lte = new Date(fechaHasta)
  }
  if (tropaCodigo) where.tropaCodigo = tropaCodigo
  if (productorId) where.productorId = productorId
  if (usuarioFaenaId) where.usuarioFaenaId = usuarioFaenaId
  if (tipoAnimal) where.tipoAnimal = tipoAnimal

  // KPIs generales
  const total = await db.medicionPH.count({ where })
  const kpis = await db.medicionPH.aggregate({
    where,
    _avg: { valorPH: true },
    _min: { valorPH: true },
    _max: { valorPH: true },
    _count: true
  })

  // Distribución por clasificación
  const distribucion = await db.medicionPH.groupBy({
    by: ['clasificacion'],
    where,
    _count: { id: true },
    _avg: { valorPH: true }
  })

  // Resumen por tropa
  const porTropa = await db.medicionPH.groupBy({
    by: ['tropaCodigo'],
    where,
    _count: { id: true },
    _avg: { valorPH: true },
    _min: { valorPH: true },
    _max: { valorPH: true },
    orderBy: { tropaCodigo: 'desc' },
    take: 50
  })

  // DFD por tropa
  const dfdPorTropa = await db.medicionPH.groupBy({
    by: ['tropaCodigo'],
    where: { ...where, clasificacion: 'DFD' },
    _count: { id: true }
  })

  return NextResponse.json({
    success: true,
    data: {
      kpis: {
        total,
        promedio: kpis._avg.valorPH ? parseFloat(kpis._avg.valorPH.toFixed(2)) : 0,
        minimo: kpis._min.valorPH ? parseFloat(kpis._min.valorPH.toFixed(2)) : 0,
        maximo: kpis._max.valorPH ? parseFloat(kpis._max.valorPH.toFixed(2)) : 0,
        porcentajeDFD: total > 0 ? parseFloat(((dfdPorTropa.reduce((s, d) => s + d._count.id, 0) / total) * 100).toFixed(1)) : 0,
        porcentajeNormal: total > 0 ? parseFloat(((distribucion.find(d => d.clasificacion === 'NORMAL')?._count.id || 0) / total * 100).toFixed(1)) : 0,
        porcentajeIntermedio: total > 0 ? parseFloat(((distribucion.find(d => d.clasificacion === 'INTERMEDIO')?._count.id || 0) / total * 100).toFixed(1)) : 0,
        porcentajeAlto: total > 0 ? parseFloat(((distribucion.find(d => d.clasificacion === 'ALTO')?._count.id || 0) / total * 100).toFixed(1)) : 0
      },
      distribucion: distribucion.map(d => ({
        clasificacion: d.clasificacion,
        cantidad: d._count.id,
        porcentaje: total > 0 ? parseFloat(((d._count.id / total) * 100).toFixed(1)) : 0,
        promedioPH: d._avg.valorPH ? parseFloat(d._avg.valorPH.toFixed(2)) : null
      })),
      porTropa: porTropa.map(t => {
        const dfd = dfdPorTropa.find(d => d.tropaCodigo === t.tropaCodigo)
        return {
          tropaCodigo: t.tropaCodigo,
          cantidad: t._count.id,
          promedio: t._avg.valorPH ? parseFloat(t._avg.valorPH.toFixed(2)) : 0,
          minimo: t._min.valorPH ? parseFloat(t._min.valorPH.toFixed(2)) : 0,
          maximo: t._max.valorPH ? parseFloat(t._max.valorPH.toFixed(2)) : 0,
          dfdCount: dfd?._count.id || 0,
          porcentajeDFD: t._count.id > 0 ? parseFloat(((dfd?._count.id || 0) / t._count.id * 100).toFixed(1)) : 0
        }
      })
    }
  })
}

// ============================================
// Detalle: Mediciones individuales con filtros avanzados
// ============================================
async function generarDetalle(searchParams: URLSearchParams) {
  const fechaDesde = searchParams.get('fechaDesde')
  const fechaHasta = searchParams.get('fechaHasta')
  const tropaCodigo = searchParams.get('tropaCodigo')
  const productorId = searchParams.get('productorId')
  const clasificacion = searchParams.get('clasificacion')
  const operadorId = searchParams.get('operadorId')
  const usuarioFaenaId = searchParams.get('usuarioFaenaId')
  const tipoAnimal = searchParams.get('tipoAnimal')
  const pesoMin = searchParams.get('pesoMin')
  const pesoMax = searchParams.get('pesoMax')
  const phMin = searchParams.get('phMin')
  const phMax = searchParams.get('phMax')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '100')

  const where: any = {}
  if (fechaDesde || fechaHasta) {
    where.horaMedicion = {}
    if (fechaDesde) where.horaMedicion.gte = new Date(fechaDesde)
    if (fechaHasta) where.horaMedicion.lte = new Date(fechaHasta)
  }
  if (tropaCodigo) where.tropaCodigo = tropaCodigo
  if (productorId) where.productorId = productorId
  if (clasificacion && clasificacion !== 'TODAS') where.clasificacion = clasificacion
  if (operadorId) where.operadorId = operadorId
  if (usuarioFaenaId) where.usuarioFaenaId = usuarioFaenaId
  if (tipoAnimal) where.tipoAnimal = tipoAnimal
  if (pesoMin || pesoMax) {
    where.mediaRes = { peso: {} }
    if (pesoMin) where.mediaRes.peso.gte = parseFloat(pesoMin)
    if (pesoMax) where.mediaRes.peso.lte = parseFloat(pesoMax)
  }
  if (phMin || phMax) {
    where.valorPH = {}
    if (phMin) where.valorPH.gte = parseFloat(phMin)
    if (phMax) where.valorPH.lte = parseFloat(phMax)
  }

  const [mediciones, total] = await Promise.all([
    db.medicionPH.findMany({
      where,
      include: {
        mediaRes: {
          include: {
            romaneo: { include: { tipificador: true } },
            camara: true,
            usuarioFaena: true
          }
        },
        operador: { select: { id: true, nombre: true } }
      },
      orderBy: { horaMedicion: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    }),
    db.medicionPH.count({ where })
  ])

  // Alertas DFD (solo primera medición con DFD)
  const alertasDFD = await db.medicionPH.findMany({
    where: { ...where, clasificacion: 'DFD', numeroMedicion: 1 },
    include: {
      mediaRes: { include: { romaneo: true, usuarioFaena: true } }
    },
    orderBy: { horaMedicion: 'desc' },
    take: 20
  })

  return NextResponse.json({
    success: true,
    data: {
      mediciones,
      paginacion: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      alertasDFD
    }
  })
}

// ============================================
// Correlación DFD-Productor
// ============================================
async function generarCorrelacionDFD(searchParams: URLSearchParams) {
  const fechaDesde = searchParams.get('fechaDesde')
  const fechaHasta = searchParams.get('fechaHasta')

  const where: any = { numeroMedicion: 1 }
  if (fechaDesde || fechaHasta) {
    where.horaMedicion = {}
    if (fechaDesde) where.horaMedicion.gte = new Date(fechaDesde)
    if (fechaHasta) where.horaMedicion.lte = new Date(fechaHasta)
  }

  // Total de mediciones por productor
  const porProductor = await db.medicionPH.groupBy({
    by: ['productorId', 'productorNombre'],
    where,
    _count: { id: true },
    _avg: { valorPH: true },
    having: { productorId: { not: null } },
    orderBy: { _count: { id: 'desc' } }
  })

  // DFD por productor
  const dfdPorProductor = await db.medicionPH.groupBy({
    by: ['productorId', 'productorNombre'],
    where: { ...where, clasificacion: 'DFD' },
    _count: { id: true }
  })

  // Intermedio por productor
  const intermedioPorProductor = await db.medicionPH.groupBy({
    by: ['productorId'],
    where: { ...where, clasificacion: 'INTERMEDIO' },
    _count: { id: true }
  })

  // Alto (PSE) por productor
  const altoPorProductor = await db.medicionPH.groupBy({
    by: ['productorId'],
    where: { ...where, clasificacion: 'ALTO' },
    _count: { id: true }
  })

  // Últimas tropas por productor con DFD
  const ultimasTropasDFD = await db.medicionPH.findMany({
    where: { ...where, clasificacion: 'DFD', numeroMedicion: 1 },
    distinct: ['tropaCodigo'],
    select: {
      tropaCodigo: true,
      productorId: true,
      productorNombre: true,
      horaMedicion: true,
      valorPH: true
    },
    orderBy: { horaMedicion: 'desc' },
    take: 50
  })

  const correlation = porProductor.map(p => {
    const dfd = dfdPorProductor.find(d => d.productorId === p.productorId)
    const intermedio = intermedioPorProductor.find(d => d.productorId === p.productorId)
    const alto = altoPorProductor.find(d => d.productorId === p.productorId)

    return {
      productorId: p.productorId,
      productorNombre: p.productorNombre,
      totalMediciones: p._count.id,
      promedioPH: p._avg.valorPH ? parseFloat(p._avg.valorPH.toFixed(2)) : 0,
      dfdCount: dfd?._count.id || 0,
      dfdPorcentaje: p._count.id > 0 ? parseFloat(((dfd?._count.id || 0) / p._count.id * 100).toFixed(1)) : 0,
      intermedioCount: intermedio?._count.id || 0,
      altoCount: alto?._count.id || 0,
      normalCount: p._count.id - (dfd?._count.id || 0) - (intermedio?._count.id || 0) - (alto?._count.id || 0)
    }
  })

  // Ordenar por porcentaje DFD descendente (productores problemáticos primero)
  correlation.sort((a, b) => b.dfdPorcentaje - a.dfdPorcentaje)

  return NextResponse.json({
    success: true,
    data: {
      correlation,
      ultimasTropasDFD
    }
  })
}

// ============================================
// Control Estadístico (X-bar y R para SPC)
// Agrupa mediciones por tropa para calcular
// media y rango por grupo
// ============================================
async function generarControlEstadistico(searchParams: URLSearchParams) {
  const fechaDesde = searchParams.get('fechaDesde')
  const fechaHasta = searchParams.get('fechaHasta')

  const where: any = { numeroMedicion: 1 }
  if (fechaDesde || fechaHasta) {
    where.horaMedicion = {}
    if (fechaDesde) where.horaMedicion.gte = new Date(fechaDesde)
    if (fechaHasta) where.horaMedicion.lte = new Date(fechaHasta)
  }

  // Obtener todas las mediciones para calcular por grupo
  const mediciones = await db.medicionPH.findMany({
    where,
    select: {
      id: true,
      tropaCodigo: true,
      valorPH: true,
      horaMedicion: true,
      clasificacion: true,
      garron: true
    },
    orderBy: { horaMedicion: 'asc' }
  })

  // Agrupar por tropa para gráfico X-bar y R
  const grupos: Record<string, number[]> = {}
  mediciones.forEach(m => {
    const key = m.tropaCodigo || 'SIN_TROPA'
    if (!grupos[key]) grupos[key] = []
    grupos[key].push(m.valorPH)
  })

  // Calcular estadísticas por grupo (tropa)
  const datosControl = Object.entries(grupos).map(([tropa, valores]) => {
    const n = valores.length
    const media = valores.reduce((s, v) => s + v, 0) / n
    const rango = Math.max(...valores) - Math.min(...valores)
    const desviacion = Math.sqrt(valores.reduce((s, v) => s + Math.pow(v - media, 2), 0) / n)

    return {
      grupo: tropa,
      n,
      media: parseFloat(media.toFixed(2)),
      rango: parseFloat(rango.toFixed(2)),
      desviacion: parseFloat(desviacion.toFixed(2)),
      min: Math.min(...valores),
      max: Math.max(...valores)
    }
  }).sort((a, b) => {
    // Ordenar por fecha de la tropa
    const idxA = mediciones.findIndex(m => m.tropaCodigo === a.grupo)
    const idxB = mediciones.findIndex(m => m.tropaCodigo === b.grupo)
    return idxA - idxB
  })

  // Calcular límites de control (X-bar y R chart)
  const medias = datosControl.map(d => d.media)
  const rangos = datosControl.map(d => d.rango)

  const XBarra = medias.length > 0 ? medias.reduce((s, v) => s + v, 0) / medias.length : 0
  const RBarra = rangos.length > 0 ? rangos.reduce((s, v) => s + v, 0) / rangos.length : 0

  // Factores de control para diferentes tamaños de subgrupo (n)
  const factoresA2: Record<number, number> = { 2: 1.88, 3: 1.02, 4: 0.73, 5: 0.58, 6: 0.48, 7: 0.42, 8: 0.37, 9: 0.34, 10: 0.31 }
  const factoresD3: Record<number, number> = { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0.08, 8: 0.14, 9: 0.18, 10: 0.22 }
  const factoresD4: Record<number, number> = { 2: 3.27, 3: 2.57, 4: 2.28, 5: 2.11, 6: 2.00, 7: 1.92, 8: 1.86, 9: 1.82, 10: 1.78 }

  // Tamaño promedio de subgrupo
  const nPromedio = datosControl.length > 0 ? Math.round(datosControl.reduce((s, d) => s + d.n, 0) / datosControl.length) : 5
  const nClamped = Math.max(2, Math.min(10, nPromedio))

  const A2 = factoresA2[nClamped] || 0.58
  const D3 = factoresD3[nClamped] || 0
  const D4 = factoresD4[nClamped] || 2.11

  const limitesXBarra = {
    UCL: parseFloat((XBarra + A2 * RBarra).toFixed(2)),
    CL: parseFloat(XBarra.toFixed(2)),
    LCL: parseFloat((XBarra - A2 * RBarra).toFixed(2))
  }

  const limitesR = {
    UCL: parseFloat((D4 * RBarra).toFixed(2)),
    CL: parseFloat(RBarra.toFixed(2)),
    LCL: parseFloat((D3 * RBarra).toFixed(2))
  }

  return NextResponse.json({
    success: true,
    data: {
      datosControl,
      limitesXBarra,
      limitesR,
      nPromedio,
      totalMediciones: mediciones.length,
      totalGrupos: datosControl.length
    }
  })
}
