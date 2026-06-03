import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Get tropa by ID with animals
import { checkPermission } from '@/lib/auth-helpers'
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await checkPermission(request, 'puedeMovimientoHacienda')
  if (authError) return authError

  try {
    const { id } = await params

    const tropa = await db.tropa.findUnique({
      where: { id },
      include: {
        productor: true,
        usuarioFaena: true,
        corral: true,
        tiposAnimales: true,
        pesajeCamion: {
          select: {
            id: true, numeroTicket: true, tipo: true, patenteChasis: true, patenteAcoplado: true,
            choferNombre: true, choferDni: true, transportista: { select: { id: true, nombre: true, cuit: true } },
            precintos: true, pesoBruto: true, pesoTara: true, pesoNeto: true, estado: true
          }
        },
        animales: {
          orderBy: { numero: 'asc' },
          include: {
            corral: { select: { id: true, nombre: true } },
            pesajeIndividual: { select: { id: true, peso: true, fecha: true } }
          }
        }
      }
    })

    if (!tropa) {
      return NextResponse.json(
        { success: false, error: 'Tropa no encontrada' },
        { status: 404 }
      )
    }

    // Buscar tropas que comparten el mismo ticket de pesaje
    let ticketCompartidoCon: Array<{ numero: number; codigo: string }> = []
    if (tropa.pesajeCamion?.numeroTicket) {
      const hermanas = await db.tropa.findMany({
        where: {
          pesajeCamionId: { not: tropa.pesajeCamionId },
          pesajeCamion: { numeroTicket: tropa.pesajeCamion.numeroTicket }
        },
        select: { numero: true, codigo: true },
        orderBy: { numero: 'asc' }
      })
      ticketCompartidoCon = hermanas
    }

    return NextResponse.json({
      success: true,
      data: {
        ...tropa,
        ticketCompartidoCon,
        animales: tropa.animales.map(a => ({
          id: a.id,
          numero: a.numero,
          codigo: a.codigo,
          tipoAnimal: a.tipoAnimal,
          caravana: a.caravana,
          raza: a.raza,
          pesoVivo: a.pesoVivo,
          estado: a.estado,
          corral: a.corral ? { id: a.corral.id, nombre: a.corral.nombre } : null,
          fechaBaja: a.fechaBaja,
          motivoBaja: a.motivoBaja,
          pesajeIndividual: a.pesajeIndividual ? { peso: a.pesajeIndividual.peso, fecha: a.pesajeIndividual.fecha } : null
        })),
        pesajeCamion: tropa.pesajeCamion ? {
          id: tropa.pesajeCamion.id,
          numeroTicket: tropa.pesajeCamion.numeroTicket,
          patenteChasis: tropa.pesajeCamion.patenteChasis,
          patenteAcoplado: tropa.pesajeCamion.patenteAcoplado,
          choferNombre: tropa.pesajeCamion.choferNombre,
          choferDni: tropa.pesajeCamion.choferDni,
          transportista: tropa.pesajeCamion.transportista ? {
            id: tropa.pesajeCamion.transportista.id,
            nombre: tropa.pesajeCamion.transportista.nombre,
            cuit: tropa.pesajeCamion.transportista.cuit
          } : null,
          precintos: tropa.pesajeCamion.precintos,
          pesoBruto: tropa.pesajeCamion.pesoBruto,
          pesoTara: tropa.pesajeCamion.pesoTara,
          pesoNeto: tropa.pesajeCamion.pesoNeto,
          estado: tropa.pesajeCamion.estado
        } : null
      }
    })
  } catch (error) {
    console.error('Error fetching tropa:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener tropa' },
      { status: 500 }
    )
  }
}
