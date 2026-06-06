import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { db } from '@/lib/db'
import { checkPermission } from '@/lib/auth-helpers'
import { decrypt } from '@/lib/crypto'

// POST - Enviar romaneo por email
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeReportes')
  if (authError) return authError

  try {
    const body = await request.json()
    const { tropaId, email, autorizado } = body

    if (!tropaId) {
      return NextResponse.json(
        { success: false, error: 'ID de tropa requerido' },
        { status: 400 }
      )
    }

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email destinatario requerido' },
        { status: 400 }
      )
    }

    if (!autorizado) {
      return NextResponse.json(
        { success: false, error: 'El romaneo debe estar autorizado antes de enviar' },
        { status: 400 }
      )
    }

    // Obtener datos de la tropa
    const tropa = await db.tropa.findUnique({
      where: { id: tropaId },
      include: {
        productor: true,
        usuarioFaena: true
      }
    })

    if (!tropa) {
      return NextResponse.json(
        { success: false, error: 'Tropa no encontrada' },
        { status: 404 }
      )
    }

    // Get romaneos separately
    const romaneos = await db.romaneo.findMany({
      where: { tropaCodigo: tropa.codigo },
      include: {
        mediasRes: true
      }
    })

    // Obtener configuración del frigorífico
    const config = await db.configuracionFrigorifico.findFirst()

    if (!config?.emailHabilitado || !config.emailHost || !config.emailUsuario || !config.emailPassword) {
      return NextResponse.json(
        { success: false, error: 'El envío de emails no está configurado. Configure SMTP en Configuración.' },
        { status: 400 }
      )
    }

    // Calcular estadísticas del romaneo
    const romaneosConfirmados = romaneos.filter(r => r.estado === 'CONFIRMADO')
    const kgVivoTotal = romaneosConfirmados.reduce((acc, r) => acc + (r.pesoVivo || 0), 0)
    const kgMediaTotal = romaneosConfirmados.reduce((acc, r) => acc + (r.pesoTotal || 0), 0)
    const rindeGeneral = kgVivoTotal > 0 ? (kgMediaTotal / kgVivoTotal) * 100 : 0

    // Preparar contenido del email
    const emailContent = `
ROMANEO DE FAENA - ${config.nombre || 'Solemar Alimentaria S.A.'}
Mat. ${config.numeroMatricula || '300'} - SENASA ${config.numeroEstablecimiento || '3986'}

========================================

TROPA: ${tropa.codigo}
FECHA DE FAENA: ${new Date().toLocaleDateString('es-AR')}
CANTIDAD DE CABEZAS: ${tropa.cantidadCabezas}

----------------------------------------
DATOS DEL PRODUCTOR
----------------------------------------
Productor: ${tropa.productor?.nombre || tropa.usuarioFaena?.nombre || '-'}
CUIT: ${tropa.productor?.cuit || tropa.usuarioFaena?.cuit || '-'}

----------------------------------------
RESUMEN DE FAENA
----------------------------------------
KG Vivo Total: ${kgVivoTotal.toFixed(0)} kg
KG 1/2 Res Total: ${kgMediaTotal.toFixed(0)} kg
Rinde General: ${rindeGeneral.toFixed(1)}%
Peso Promedio: ${tropa.cantidadCabezas > 0 ? (kgMediaTotal / tropa.cantidadCabezas).toFixed(0) : 0} kg

----------------------------------------
DETALLE POR ANIMAL
----------------------------------------
${romaneosConfirmados.map((r, i) => 
  `${i + 1}. Garrón ${r.garron} | Tipo: ${r.tipoAnimal || '-'} | KG Vivo: ${(r.pesoVivo || 0).toFixed(0)} | KG Media: ${(r.pesoTotal || 0).toFixed(0)} | Rinde: ${(r.pesoVivo && r.pesoVivo > 0 && r.pesoTotal && r.pesoTotal > 0) ? ((r.pesoTotal / r.pesoVivo) * 100).toFixed(1) : '-'}%`
).join('\n')}

========================================

Este es un mensaje automático del sistema de gestión frigorífica.
Por favor no responda a este correo.

${config.nombre || 'Solemar Alimentaria S.A.'}
${config.direccion || ''}
    `.trim()

    // Enviar email con nodemailer
    const transporter = nodemailer.createTransport({
      host: config.emailHost,
      port: config.emailPuerto || 587,
      secure: config.emailPuerto === 465,
      auth: {
        user: config.emailUsuario,
        pass: decrypt(config.emailPassword) || ''
      },
      tls: {
        rejectUnauthorized: false
      }
    })

    await transporter.sendMail({
      from: `"${config.nombre || 'Sistema Frigorífico'}" <${config.emailUsuario}>`,
      to: email,
      subject: `Romaneo Tropa ${tropa.codigo} - ${config.nombre || 'Frigorífico'}`,
      text: emailContent
    })

    await transporter.close()

    // Registrar envío en auditoría
    await db.auditoria.create({
      data: {
        modulo: 'REPORTES',
        accion: 'EMAIL',
        entidad: 'Tropa',
        entidadId: tropaId,
        descripcion: `Romaneo enviado por email a ${email}`,
      }
    })

    // Marcar romaneos como enviados
    await db.romaneo.updateMany({
      where: {
        tropaCodigo: tropa.codigo,
        estado: 'CONFIRMADO'
      },
      data: {
        emailEnviado: true
      }
    })

    return NextResponse.json({
      success: true,
      message: `Romaneo enviado exitosamente a ${email}`,
      data: {
        tropaCodigo: tropa.codigo,
        emailDestinatario: email,
        cantidadAnimales: tropa.cantidadCabezas,
        kgTotal: kgMediaTotal,
        rinde: rindeGeneral
      }
    })

  } catch (error) {
    console.error('Error enviando romaneo por email:', error)
    return NextResponse.json(
      { success: false, error: 'Error al enviar el email' },
      { status: 500 }
    )
  }
}
