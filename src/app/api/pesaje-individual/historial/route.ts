import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// GET - Obtener historial de tropas pesadas con resumen detallado
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedePesajeIndividual')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const busqueda = searchParams.get('busqueda')?.trim()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))

    // Buscar tropas en estado PESADO (o con animales pesados)
    const where: Record<string, unknown> = {
      estado: 'PESADO',
    }

    // Búsqueda por número de tropa o código
    if (busqueda) {
      where.OR = [
        { codigo: { contains: busqueda, mode: 'insensitive' } },
        { codigoSimplificado: { contains: busqueda, mode: 'insensitive' } },
      ]
    }

    const total = await db.tropa.count({ where })

    const tropas = await db.tropa.findMany({
      where,
      include: {
        productor: { select: { id: true, nombre: true, cuit: true } },
        usuarioFaena: { select: { id: true, nombre: true } },
        corral: { select: { id: true, nombre: true } },
        tiposAnimales: true,
        animales: {
          where: {
            estado: 'PESADO',
          },
          select: {
            id: true,
            numero: true,
            tipoAnimal: true,
            pesoVivo: true,
          },
          orderBy: { numero: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    // Para cada tropa, calcular resumen por tipo
    const resultado = tropas.map(tropa => {
      const animales = tropa.animales
      const cantidadAnimales = animales.length

      // Agrupar por tipo y sumar kg
      const resumenPorTipo: Record<string, { cantidad: number; kgTotal: number }> = {}
      let kgNetosTotales = 0

      for (const animal of animales) {
        const tipo = animal.tipoAnimal
        if (!resumenPorTipo[tipo]) {
          resumenPorTipo[tipo] = { cantidad: 0, kgTotal: 0 }
        }
        resumenPorTipo[tipo].cantidad++
        resumenPorTipo[tipo].kgTotal += animal.pesoVivo || 0
        kgNetosTotales += animal.pesoVivo || 0
      }

      // Buscar fecha del último pesaje de la tropa (updatedAt de la tropa o el más reciente de los animales)
      // Como no hay fecha en PesajeIndividual directamente asociada, usamos updatedAt de la tropa
      const fechaPesaje = tropa.updatedAt

      return {
        id: tropa.id,
        numero: tropa.numero,
        codigo: tropa.codigo,
        especie: tropa.especie,
        cantidadCabezas: tropa.cantidadCabezas,
        cantidadAnimalesPesados: cantidadAnimales,
        corral: tropa.corral,
        productor: tropa.productor,
        usuarioFaena: tropa.usuarioFaena,
        fechaPesaje: fechaPesaje.toISOString(),
        kgNetosTotales: Math.round(kgNetosTotales * 10) / 10,
        pesoTotalIndividual: tropa.pesoTotalIndividual,
        resumenPorTipo: Object.entries(resumenPorTipo).map(([tipo, data]) => ({
          tipo,
          cantidad: data.cantidad,
          kgTotal: Math.round(data.kgTotal * 10) / 10,
        })),
        tiposDTE: tropa.tiposAnimales,
      }
    })

    return NextResponse.json({
      success: true,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      data: resultado,
    })
  } catch (error) {
    console.error('Error fetching historial pesajes:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener historial de pesajes' },
      { status: 500 }
    )
  }
}
