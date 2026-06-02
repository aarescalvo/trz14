import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { checkPermission } from '@/lib/auth-helpers'

// GET - Generar PDF Planilla 01 - Bovino (A4 Horizontal)
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeReportes')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const tropaId = searchParams.get('tropaId')

    if (!tropaId) {
      return NextResponse.json(
        { success: false, error: 'ID de tropa requerido' },
        { status: 400 }
      )
    }

    // Obtener datos de la tropa
    const tropa = await db.tropa.findUnique({
      where: { id: tropaId },
      include: {
        productor: true,
        usuarioFaena: true,
        corral: true,
        tiposAnimales: true,
        animales: {
          include: {
            pesajeIndividual: true,
            asignacionGarron: true
          },
          orderBy: { numero: 'asc' }
        },
        pesajeCamion: {
          include: {
            transportista: true
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

    // Obtener configuración del frigorífico
    const config = await db.configuracionFrigorifico.findFirst()

    // ===== CÁLCULOS DE PESAJE =====
    const kgNetosCamion = tropa.pesajeCamion?.pesoNeto ?? null
    const kgNetosIndividuales = tropa.animales.reduce((acc, a) => {
      return acc + (a.pesajeIndividual?.peso || a.pesoVivo || 0)
    }, 0)
    const diferenciaKg = kgNetosCamion !== null ? kgNetosCamion - kgNetosIndividuales : null

    // Crear PDF A4 Horizontal
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    })

    const pageWidth = doc.internal.pageSize.getWidth()  // 297mm en landscape
    const pageHeight = doc.internal.pageSize.getHeight() // 210mm en landscape
    const margin = 8
    let y = 10

    // ===== ENCABEZADO =====
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('PLANILLA 01 - BOVINO', margin, y)

    // Tropa N° GRANDE a la derecha del título
    doc.setFontSize(20)
    doc.text(`TROPA N\u00b0 ${tropa.numero}`, pageWidth - margin, y, { align: 'right' })
    y += 5

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('REGISTRO DE INGRESO DE HACIENDA', pageWidth / 2, y, { align: 'center' })
    y += 6

    // ===== DATOS DEL ESTABLECIMIENTO =====
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('ESTABLECIMIENTO:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(config?.nombre || 'Solemar Alimentaria S.A.', margin + 30, y)
    doc.setFont('helvetica', 'bold')
    doc.text('Mat.:', margin + 90, y)
    doc.setFont('helvetica', 'normal')
    doc.text(config?.numeroMatricula || '300', margin + 98, y)
    doc.setFont('helvetica', 'bold')
    doc.text('SENASA:', margin + 115, y)
    doc.setFont('helvetica', 'normal')
    doc.text(config?.numeroEstablecimiento || '3986', margin + 127, y)
    // Semana y fecha a la derecha
    doc.setFont('helvetica', 'bold')
    doc.text('Sem.:', margin + 155, y)
    doc.setFont('helvetica', 'normal')
    const semana = tropa.fechaRecepcion ? getWeekNumber(new Date(tropa.fechaRecepcion)) : ''
    doc.text(semana.toString(), margin + 163, y)
    doc.setFont('helvetica', 'bold')
    doc.text('Fecha:', margin + 178, y)
    doc.setFont('helvetica', 'normal')
    const fechaPlanilla = tropa.fechaRecepcion ? new Date(tropa.fechaRecepcion).toLocaleDateString('es-AR') : ''
    doc.text(fechaPlanilla, margin + 190, y)
    doc.setFont('helvetica', 'bold')
    doc.text('Hora:', margin + 215, y)
    doc.setFont('helvetica', 'normal')
    const horaIngreso = tropa.fechaRecepcion ? new Date(tropa.fechaRecepcion).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''
    doc.text(horaIngreso, margin + 226, y)
    y += 5

    // Línea separadora
    doc.setDrawColor(0)
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)
    y += 4

    // ===== FILA DE DATOS =====
    const datosRow = 5
    doc.setFontSize(8)

    // --- Fila 1: Productor ---
    doc.setFont('helvetica', 'bold')
    doc.text('PRODUCTOR:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.productor?.nombre || '-', margin + 20, y)
    doc.setFont('helvetica', 'bold')
    doc.text('CUIT:', margin + 120, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.productor?.cuit || '-', margin + 132, y)
    doc.setFont('helvetica', 'bold')
    doc.text('Tropa N\u00b0:', margin + 190, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.numero.toString(), margin + 210, y)
    doc.setFont('helvetica', 'bold')
    doc.text('Cabezas:', margin + 240, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(tropa.cantidadCabezas), margin + 258, y)
    y += datosRow

    // --- Fila 2: Usuario Faena ---
    doc.setFont('helvetica', 'bold')
    doc.text('USUARIO FAENA:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.usuarioFaena?.nombre || '-', margin + 28, y)
    doc.setFont('helvetica', 'bold')
    doc.text('CUIT:', margin + 120, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.usuarioFaena?.cuit || '-', margin + 132, y)
    doc.setFont('helvetica', 'bold')
    doc.text('N\u00b0 Reg.:', margin + 190, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.numero.toString(), margin + 210, y)
    doc.setFont('helvetica', 'bold')
    doc.text('Corral:', margin + 240, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.corral?.nombre || '-', margin + 258, y)
    y += datosRow

    // --- Transporte ---
    doc.setFont('helvetica', 'bold')
    doc.text('TRANSPORTE:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.pesajeCamion?.transportista?.nombre || '-', margin + 24, y)
    doc.setFont('helvetica', 'bold')
    doc.text('Chofer:', margin + 85, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.pesajeCamion?.choferNombre || '-', margin + 100, y)
    doc.setFont('helvetica', 'bold')
    doc.text('DNI:', margin + 140, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.pesajeCamion?.choferDni || '-', margin + 148, y)
    y += datosRow

    doc.setFont('helvetica', 'bold')
    doc.text('Patente Chasis:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.pesajeCamion?.patenteChasis || '-', margin + 28, y)
    doc.setFont('helvetica', 'bold')
    doc.text('Acoplado:', margin + 55, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.pesajeCamion?.patenteAcoplado || '-', margin + 75, y)
    doc.setFont('helvetica', 'bold')
    doc.text('Precintos:', margin + 105, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.pesajeCamion?.precintos || '-', margin + 125, y)
    y += datosRow

    // --- Documentación ---
    doc.setFont('helvetica', 'bold')
    doc.text('Gu\u00eda:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.guia || '-', margin + 12, y)
    doc.setFont('helvetica', 'bold')
    doc.text('DTE:', margin + 150, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.dte || '-', margin + 165, y)
    // N° de pesada de camión (Ticket)
    doc.setFont('helvetica', 'bold')
    doc.text('N\u00b0 Pesada:', margin + 220, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(tropa.pesajeCamion?.numeroTicket || '-'), margin + 245, y)
    y += datosRow + 1

    // Línea separadora
    doc.setDrawColor(0)
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)
    y += 3

    // ===== TABLA DE ANIMALES =====
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('DETALLE DE ANIMALES', pageWidth / 2, y, { align: 'center' })
    y += 3

    // Preparar datos de la tabla
    const tableData = tropa.animales.map((animal, index) => {
      const tipoAnimalStr = formatTipoAnimal(animal.tipoAnimal)
      const peso = animal.pesajeIndividual?.peso || animal.pesoVivo || null

      return [
        (index + 1).toString(),
        animal.caravana || '',
        tipoAnimalStr,
        animal.raza || '',
        peso ? peso.toFixed(1) : '',
        tropa.corral?.nombre || '',
        animal.pesajeIndividual?.observaciones || ''
      ]
    })

    // Headers
    const headers = [
      'N\u00ba',
      'Caravana',
      'Tipo',
      'Raza',
      'Peso (kg)',
      'Corral',
      'Observaciones'
    ]

    autoTable(doc, {
      startY: y,
      head: [headers],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [200, 200, 200],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 7
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: 1.5
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 30, halign: 'center' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 18, halign: 'center' },
        6: { cellWidth: 30, halign: 'left' }
      },
      margin: { left: margin, right: margin },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) {
          doc.setFontSize(8)
          doc.setFont('helvetica', 'bold')
          doc.text(`PLANILLA 01 - BOVINO | Tropa N\u00b0 ${tropa.numero}`, pageWidth / 2, 8, { align: 'center' })
        }
      }
    })

    // ===== TOTALES (debajo de la tabla) =====
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4

    const pesoTotal = tropa.animales.reduce((acc, a) => acc + (a.pesajeIndividual?.peso || a.pesoVivo || 0), 0)
    const pesoPromedio = tropa.animales.length > 0 ? pesoTotal / tropa.animales.filter(a => (a.pesajeIndividual?.peso || a.pesoVivo || 0) > 0).length : 0

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(`TOTALES:  Cabezas: ${tropa.cantidadCabezas}  |  Suma Pesos Indiv.: ${pesoTotal.toFixed(1)} kg  |  Peso Promedio: ${pesoPromedio.toFixed(1)} kg`, margin, y)

    y += 5

    // ===== 4 CUADROS COMPARATIVOS (debajo de la tabla) =====
    doc.setDrawColor(0)
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageWidth - margin, y)
    y += 2

    const boxW = 55
    const boxH = 14
    const boxGap = 15
    const boxStartX = margin

    // Cuadro 1: Kg Netos Camión
    doc.setDrawColor(120)
    doc.setFillColor(240, 240, 240)
    doc.roundedRect(boxStartX, y, boxW, boxH, 1.5, 1.5, 'FD')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(80)
    doc.text('KG NETOS CAMIÓN', boxStartX + 3, y + 4)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(kgNetosCamion !== null ? kgNetosCamion.toFixed(1) + ' kg' : 'S/D', boxStartX + 3, y + 11)
    doc.setTextColor(0)

    // Cuadro 2: Kg Netos Individuales
    const box2X = boxStartX + boxW + boxGap
    doc.setDrawColor(120)
    doc.setFillColor(240, 240, 240)
    doc.roundedRect(box2X, y, boxW, boxH, 1.5, 1.5, 'FD')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(80)
    doc.text('KG NETOS INDIVIDUALES', box2X + 3, y + 4)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(kgNetosIndividuales.toFixed(1) + ' kg', box2X + 3, y + 11)
    doc.setTextColor(0)

    // Cuadro 3: Diferencia
    const box3X = box2X + boxW + boxGap
    doc.setDrawColor(120)
    doc.setFillColor(240, 240, 240)
    doc.roundedRect(box3X, y, boxW, boxH, 1.5, 1.5, 'FD')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(80)
    doc.text('DIFERENCIA (Camión - Indiv.)', box3X + 3, y + 4)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(diferenciaKg !== null ? ((diferenciaKg >= 0 ? '+' : '') + diferenciaKg.toFixed(1) + ' kg') : 'Sin pesada camión', box3X + 3, y + 11)
    doc.setTextColor(0)

    // Cuadro 4: Promedio Kg Netos
    const box4X = box3X + boxW + boxGap
    doc.setDrawColor(120)
    doc.setFillColor(240, 240, 240)
    doc.roundedRect(box4X, y, 45, boxH, 1.5, 1.5, 'FD')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(80)
    doc.text('PROMEDIO KG NETOS', box4X + 3, y + 4)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(pesoPromedio.toFixed(1) + ' kg', box4X + 3, y + 11)
    doc.setTextColor(0)

    y += boxH + 4
    doc.setDrawColor(0)
    doc.setLineWidth(0.3)
    doc.line(margin, y, pageWidth - margin, y)
    y += 3

    // ===== OBSERVACIONES =====
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('OBSERVACIONES:', margin, y)
    doc.rect(margin, y + 2, pageWidth - margin * 2, 12)
    doc.setFont('helvetica', 'normal')
    if (tropa.observaciones) {
      doc.text(tropa.observaciones, margin + 2, y + 7, { maxWidth: pageWidth - margin * 2 - 4 })
    }

    y += 20

    // ===== FIRMA Y SELLO =====
    if (y > pageHeight - 20) {
      doc.addPage()
      y = 15
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('FIRMA RESPONSABLE:', margin + 10, y)
    doc.text('SELLO:', pageWidth / 2 + 30, y)

    doc.rect(margin + 5, y + 3, 70, 15)
    doc.rect(pageWidth / 2 + 25, y + 3, 70, 15)

    // ===== PIE DE PÁGINA =====
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text(
        `P\u00e1gina ${i} de ${pageCount}`,
        pageWidth / 2,
        pageHeight - 5,
        { align: 'center' }
      )
    }

    // Devolver PDF como blob
    const pdfBytes = doc.output('arraybuffer')

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="planilla-01-tropa-${tropa.numero}.pdf"`
      }
    })
  } catch (error) {
    console.error('Error generando Planilla 01:', error)
    return NextResponse.json(
      { success: false, error: 'Error al generar el PDF' },
      { status: 500 }
    )
  }
}

// Funciones auxiliares
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function formatTipoAnimal(tipo: string): string {
  const tipos: Record<string, string> = {
    'TO': 'Toro',
    'VA': 'Vaca',
    'VQ': 'Vaquillona',
    'MEJ': 'Torito/Mej',
    'NO': 'Novillo',
    'NT': 'Novillito',
    'PADRILLO': 'Padrillo',
    'POTRILLO': 'Potrillo',
    'YEGUA': 'Yegua',
    'CABALLO': 'Caballo',
    'BURRO': 'Burro',
    'MULA': 'Mula'
  }
  return tipos[tipo] || tipo
}

function getSexoFromTipo(tipo: string): string {
  const machos = ['TO', 'MEJ', 'NO', 'NT', 'PADRILLO', 'POTRILLO', 'CABALLO', 'BURRO']
  const hembras = ['VA', 'VQ', 'YEGUA', 'MULA']

  if (machos.includes(tipo)) return 'M'
  if (hembras.includes(tipo)) return 'H'
  return ''
}
