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
    // Kg netos del camión (peso bruto - peso tara)
    const kgNetosCamion = tropa.pesajeCamion?.pesoNeto ?? null
    // Kg netos sumatoria de pesaje individual por animal
    const kgNetosIndividuales = tropa.animales.reduce((acc, a) => {
      return acc + (a.pesajeIndividual?.peso || a.pesoVivo || 0)
    }, 0)
    // Diferencia (Camión - Individual): positivo = sobra, negativo = falta
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
    doc.text(`TROPA N° ${tropa.numero}`, pageWidth - margin, y, { align: 'right' })
    y += 5

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('FORMULARIO DE INGRESO DE HACIENDA', pageWidth / 2, y, { align: 'center' })
    y += 6

    // ===== DATOS DEL ESTABLECIMIENTO (fila horizontal) =====
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

    // ===== FILA DE DATOS (Productor, Transporte, Documentos) =====
    const datosRow = 5
    doc.setFontSize(8)

    // --- Columna izquierda: Productor ---
    doc.setFont('helvetica', 'bold')
    doc.text('PRODUCTOR:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.productor?.nombre || tropa.usuarioFaena?.nombre || '-', margin + 20, y)
    y += datosRow
    doc.setFont('helvetica', 'bold')
    doc.text('CUIT:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.productor?.cuit || tropa.usuarioFaena?.cuit || '-', margin + 20, y)
    doc.setFont('helvetica', 'bold')
    doc.text('Tropa N°:', margin + 60, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.numero.toString(), margin + 75, y)
    doc.setFont('helvetica', 'bold')
    doc.text('N° Reg.:', margin + 95, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.numero.toString(), margin + 112, y)
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
    doc.text('Guía:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.guia || '-', margin + 12, y)
    doc.setFont('helvetica', 'bold')
    doc.text('DTE:', margin + 55, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.dte || '-', margin + 67, y)
    doc.setFont('helvetica', 'bold')
    doc.text('Corral:', margin + 100, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.corral?.nombre || '-', margin + 115, y)
    // Ticket de pesada
    doc.setFont('helvetica', 'bold')
    doc.text('Ticket Pesada:', margin + 150, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(tropa.pesajeCamion?.numeroTicket || '-'), margin + 180, y)
    y += datosRow + 1

    // ===== COMPARATIVO DE PESAJE (fila horizontal compacta) =====
    doc.setDrawColor(0)
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)
    y += 2

    // Fila compacta: label + valor horizontal
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('PESAJE:', margin, y + 4)

    // Bruto
    doc.setFontSize(7)
    doc.text('Bruto:', margin + 22, y + 2)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(tropa.pesajeCamion?.pesoBruto ? tropa.pesajeCamion.pesoBruto.toFixed(1) : '-', margin + 32, y + 2)
    // Tara
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.text('Tara:', margin + 60, y + 2)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(tropa.pesajeCamion?.pesoTara ? tropa.pesajeCamion.pesoTara.toFixed(1) : '-', margin + 68, y + 2)
    // Neto Camión
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(0, 0, 150)
    doc.text('NETO CAMIÓN:', margin + 98, y + 2)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(kgNetosCamion !== null ? kgNetosCamion.toFixed(1) + ' kg' : 'S/D', margin + 125, y + 2)
    doc.setTextColor(0, 0, 0)
    // Neto Individuales
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(0, 100, 0)
    doc.text('NETO INDIVID.:', margin + 165, y + 2)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(kgNetosIndividuales.toFixed(1) + ' kg', margin + 195, y + 2)
    doc.setTextColor(0, 0, 0)
    // Diferencia
    if (diferenciaKg !== null) {
      const esPositivo = diferenciaKg >= 0
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      doc.setTextColor(esPositivo ? 150 : 200, 0, 0)
      doc.text('DIFERENCIA:', margin + 230, y + 2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.text((esPositivo ? '+' : '') + diferenciaKg.toFixed(1) + ' kg', margin + 257, y + 2)
      doc.setTextColor(0, 0, 0)
    }

    y += 8

    // ===== TABLA DE ANIMALES =====
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('DETALLE DE ANIMALES', pageWidth / 2, y, { align: 'center' })
    y += 3

    // Preparar datos de la tabla
    const tableData = tropa.animales.map((animal, index) => {
      const tipoAnimalStr = formatTipoAnimal(animal.tipoAnimal)
      const sexo = getSexoFromTipo(animal.tipoAnimal)
      const peso = animal.pesajeIndividual?.peso || animal.pesoVivo || null

      return [
        (index + 1).toString(),
        tipoAnimalStr,
        sexo,
        peso ? peso.toFixed(1) : '',
        animal.caravana || '',
        '', // Tipificación
        animal.corralId || tropa.corral?.nombre || ''
      ]
    })

    // Headers
    const headers = [
      'Nº',
      'Tipo',
      'Sexo',
      'Peso Entrada (kg)',
      'Caravana',
      'Tipificación',
      'Corral'
    ]

    // Calcular filas por página (espacio disponible ~95mm para la tabla)
    const startY = y
    autoTable(doc, {
      startY: startY,
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
        1: { cellWidth: 22, halign: 'center' },
        2: { cellWidth: 12, halign: 'center' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 35, halign: 'center' },
        5: { cellWidth: 25 },
        6: { cellWidth: 20, halign: 'center' }
      },
      margin: { left: margin, right: margin },
      didDrawPage: (data) => {
        // Encabezado en cada página (excepto la primera que ya lo tiene)
        if (data.pageNumber > 1) {
          doc.setFontSize(8)
          doc.setFont('helvetica', 'bold')
          doc.text(`PLANILLA 01 - BOVINO | Tropa N° ${tropa.numero}`, pageWidth / 2, 8, { align: 'center' })
        }
      }
    })

    // ===== TOTALES (debajo de la tabla) =====
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5

    // Verificar si hay espacio, si no, nueva página
    if (y > pageHeight - 35) {
      doc.addPage()
      y = 15
    }

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTALES:', margin, y)

    doc.setFont('helvetica', 'normal')
    doc.text(`Cabezas: ${tropa.cantidadCabezas}`, margin + 20, y)
    const pesoTotal = tropa.animales.reduce((acc, a) => acc + (a.pesajeIndividual?.peso || a.pesoVivo || 0), 0)
    doc.text(`Suma Pesos Indiv.: ${pesoTotal.toFixed(1)} kg`, margin + 55, y)
    if (kgNetosCamion !== null) {
      doc.text(`Peso Neto Camión: ${kgNetosCamion.toFixed(1)} kg`, margin + 115, y)
      const signo = diferenciaKg !== null ? (diferenciaKg >= 0 ? '+' : '') : ''
      doc.text(`Diferencia: ${signo}${diferenciaKg?.toFixed(1)} kg`, margin + 195, y)
    }

    const pesoPromedio = tropa.animales.length > 0 ? pesoTotal / tropa.animales.filter(a => (a.pesajeIndividual?.peso || a.pesoVivo || 0) > 0).length : 0
    y += 5
    doc.text(`Peso Promedio: ${pesoPromedio.toFixed(1)} kg`, margin + 55, y)

    y += 8

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
        `Página ${i} de ${pageCount}`,
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
