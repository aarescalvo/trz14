import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'

// GET - Obtener romaneos del día con sus datos
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeRomaneo')
  if (authError) return authError
  try {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    
    const romaneos = await db.romaneo.findMany({
      where: {
        fecha: {
          gte: hoy,
          lt: new Date(hoy.getTime() + 24 * 60 * 60 * 1000)
        }
      },
      include: {
        mediasRes: true,
        tipificador: true
      },
      orderBy: { garron: 'asc' }
    })

    const data = romaneos.map(r => ({
      id: r.id,
      garron: r.garron,
      tropaCodigo: r.tropaCodigo,
      numeroAnimal: r.numeroAnimal,
      tipoAnimal: r.tipoAnimal?.toString() || null,
      pesoVivo: r.pesoVivo,
      denticion: r.denticion,
      pesoMediaIzq: r.pesoMediaIzq,
      pesoMediaDer: r.pesoMediaDer,
      pesoTotal: r.pesoTotal,
      rinde: (r.pesoVivo && r.pesoVivo > 0 && r.pesoTotal && r.pesoTotal > 0)
        ? Math.round((r.pesoTotal / r.pesoVivo) * 10000) / 100
        : r.rinde,
      estado: r.estado?.toString() || 'PENDIENTE',
      tipificador: r.tipificador ? {
        id: r.tipificador.id,
        nombre: `${r.tipificador.nombre} ${r.tipificador.apellido}`,
        matricula: r.tipificador.matricula
      } : null
    }))

    return NextResponse.json({
      success: true,
      data
    })

  } catch (error) {
    console.error('Error obteniendo romaneos:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener romaneos' },
      { status: 500 }
    )
  }
}
