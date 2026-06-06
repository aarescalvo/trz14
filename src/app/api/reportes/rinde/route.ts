import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { checkPermission } from '@/lib/auth-helpers'

// GET - Generar PDF de Rinde de Faena por Tropa
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
        animales: {
          include: {
            pesajeIndividual: true,
            asignacionGarron: true
          },
          orderBy: { numero: 'asc' }
        }
      }
    })

    if (!tropa) {
      return NextResponse.json(
        { success: false, error: 'Tropa no encontrada' },
        { status: 404 }
      )
    }

    // Obtener romaneos de la tropa
    const romaneos = await db.romaneo.findMany({
      where: {
        tropaCodigo: tropa.codigo,
        estado: { in: ['CONFIRMADO', 'PENDIENTE'] }
      } as Prisma.RomaneoWhereInput,
      include: {
        tipificador: true,
        mediasRes: true
      },
      orderBy: { garron: 'asc' }
    })

    // Obtener configuración del frigorífico
    const config = await db.configuracionFrigorifico.findFirst()

    // Crear PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 10
    let y = 15

    // ===== ENCABEZADO =====
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('RINDE DE FAENA BOVINO', pageWidth / 2, y, { align: 'center' })
    y += 8

    // Datos del establecimiento
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Establecimiento:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(config?.nombre || 'Solemar Alimentaria S.A.', margin + 32, y)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Mat.:', margin + 100, y)
    doc.setFont('helvetica', 'normal')
    doc.text(config?.numeroMatricula || '300', margin + 112, y)
    
    doc.setFont('helvetica', 'bold')
    doc.text('SENASA:', margin + 130, y)
    doc.setFont('helvetica', 'normal')
    doc.text(config?.numeroEstablecimiento || '3986', margin + 148, y)
    y += 6

    // Línea separadora
    doc.setDrawColor(0)
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)
    y += 5

    // ===== RESUMEN GENERAL =====
    const kgVivoEntrada = romaneos.reduce((acc, r) => acc + (r.pesoVivo || 0), 0)
    const kgMediaRes = romaneos.reduce((acc, r) => acc + (r.pesoTotal || 0), 0)
    const rindeGeneral = kgVivoEntrada > 0 ? (kgMediaRes / kgVivoEntrada) * 100 : 0
    const cantidadAnimales = romaneos.length || tropa.cantidadCabezas
    const promedio = cantidadAnimales > 0 ? kgMediaRes / cantidadAnimales : 0

    // Cuadro de resumen superior
    doc.setFillColor(220, 240, 220)
    doc.rect(margin, y - 2, pageWidth - margin * 2, 20, 'F')
    
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('SOBRE kg vivo de:', margin + 5, y + 4)
    doc.setFont('helvetica', 'normal')
    doc.text(kgVivoEntrada.toFixed(0) + ' kg', margin + 40, y + 4)
    
    doc.setFont('helvetica', 'bold')
    doc.text('SOBRE 1/2 res de:', margin + 70, y + 4)
    doc.setFont('helvetica', 'normal')
    doc.text(kgMediaRes.toFixed(0) + ' kg', margin + 105, y + 4)
    
    doc.setFont('helvetica', 'bold')
    doc.text('RINDE %:', margin + 135, y + 4)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 100, 0)
    doc.text(rindeGeneral.toFixed(1) + '%', margin + 155, y + 4)
    doc.setTextColor(0, 0, 0)
    y += 10

    // Segunda línea de resumen
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('TROPA Nº:', margin + 5, y + 4)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.numero.toString(), margin + 28, y + 4)
    
    doc.setFont('helvetica', 'bold')
    doc.text('CANTIDAD ANIMALES:', margin + 45, y + 4)
    doc.setFont('helvetica', 'normal')
    doc.text(cantidadAnimales.toString(), margin + 88, y + 4)
    
    doc.setFont('helvetica', 'bold')
    doc.text('PROMEDIO:', margin + 105, y + 4)
    doc.setFont('helvetica', 'normal')
    doc.text(promedio.toFixed(0) + ' kg', margin + 125, y + 4)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Nº DTE:', margin + 150, y + 4)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.dte || '', margin + 165, y + 4)
    y += 15

    // ===== DATOS ADICIONALES =====
    doc.setFontSize(9)
    const rowHeight = 5

    // Fecha de Faena y Matarife
    const fechaFaena = romaneos.length > 0 
      ? new Date(romaneos[0].fecha).toLocaleDateString('es-AR')
      : tropa.fechaRecepcion 
        ? new Date(tropa.fechaRecepcion).toLocaleDateString('es-AR')
        : ''

    doc.setFont('helvetica', 'bold')
    doc.text('Fecha de Faena:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(fechaFaena, margin + 28, y)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Productor:', margin + 55, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.productor?.nombre || tropa.usuarioFaena?.nombre || '', margin + 72, y)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Matarife:', margin + 130, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.usuarioFaena?.nombre || '', margin + 148, y)
    y += rowHeight + 3

    // Línea separadora
    doc.line(margin, y, pageWidth - margin, y)
    y += 3

    // ===== TABLA DE RINDE POR ANIMAL =====
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('DETALLE DE RINDE POR ANIMAL', pageWidth / 2, y, { align: 'center' })
    y += 5

    // Preparar datos de la tabla
    const tableData = romaneos.map((romaneo) => {
      const pesoEntrada = romaneo.pesoVivo || 0
      const kgMediaA = romaneo.pesoMediaIzq || 0
      const kgMediaB = romaneo.pesoMediaDer || 0
      const totalKg = romaneo.pesoTotal || 0
      const rindeFaena = pesoEntrada > 0 ? ((totalKg / pesoEntrada) * 100).toFixed(1) : '0.0'

      return [
        romaneo.garron.toString(),
        (romaneo.numeroAnimal || 0).toString(),
        formatRaza(romaneo.raza),
        formatTipoDenticion((romaneo.denticion ?? null) as unknown as number | null, (romaneo as typeof romaneo & { categoria?: string | null }).categoria ?? null),
        (romaneo as typeof romaneo & { caravana?: string | null }).caravana || '',
        pesoEntrada.toFixed(0),
        kgMediaA.toFixed(0),
        kgMediaB.toFixed(0),
        totalKg.toFixed(0),
        rindeFaena + '%'
      ]
    })

    autoTable(doc, {
      startY: y,
      head: [[
        'Garrón',
        'Nº Anim.',
        'Raza',
        'Tipo/Dent.',
        'Caravana',
        'KG Entrada',
        'KG 1/2 A',
        'KG 1/2 B',
        'Total KG',
        'Rinde %'
      ]],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [180, 200, 180],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 7
      },
      bodyStyles: {
        fontSize: 7
      },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 15 },
        2: { cellWidth: 15 },
        3: { cellWidth: 20 },
        4: { cellWidth: 25 },
        5: { cellWidth: 18 },
        6: { cellWidth: 18 },
        7: { cellWidth: 18 },
        8: { cellWidth: 18 },
        9: { cellWidth: 15 }
      },
      margin: { left: margin, right: margin },
      didDrawPage: () => {
        const pageCount = doc.getNumberOfPages()
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.text(
          `Página ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        )
      }
    })

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

    // ===== TOTALES =====
    doc.setFillColor(240, 240, 240)
    doc.rect(margin, y - 2, pageWidth - margin * 2, 8, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTALES:', margin + 2, y + 3)
    doc.setFont('helvetica', 'normal')
    doc.text(kgVivoEntrada.toFixed(0), margin + 93, y + 3)
    doc.text(kgMediaRes.toFixed(0), margin + 111, y + 3)
    doc.text((kgVivoEntrada - kgMediaRes).toFixed(0), margin + 129, y + 3)
    doc.text(rindeGeneral.toFixed(1) + '%', margin + 170, y + 3)
    y += 12

    // ===== ESTADÍSTICAS ADICIONALES =====
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('ESTADÍSTICAS', pageWidth / 2, y, { align: 'center' })
    y += 5

    // Calcular estadísticas
    const rindes = romaneos.map(r => r.pesoVivo && r.pesoTotal ? (r.pesoTotal / r.pesoVivo * 100) : 0).filter(r => r > 0)
    const rindeMax = Math.max(...rindes)
    const rindeMin = Math.min(...rindes)
    const rindePromedio = rindes.length > 0 ? rindes.reduce((a, b) => a + b, 0) / rindes.length : 0

    const pesosMedias = romaneos.flatMap(r => [r.pesoMediaIzq, r.pesoMediaDer]).filter(p => p && p > 0) as number[]
    const pesoMax = Math.max(...pesosMedias)
    const pesoMin = Math.min(...pesosMedias)
    const pesoPromedioMedias = pesosMedias.length > 0 ? pesosMedias.reduce((a, b) => a + b, 0) / pesosMedias.length : 0

    const statsData = [
      ['Rinde Máximo', rindeMax.toFixed(1) + '%'],
      ['Rinde Mínimo', rindeMin.toFixed(1) + '%'],
      ['Rinde Promedio', rindePromedio.toFixed(1) + '%'],
      ['Peso Media Máx.', pesoMax.toFixed(0) + ' kg'],
      ['Peso Media Mín.', pesoMin.toFixed(0) + ' kg'],
      ['Peso Media Prom.', pesoPromedioMedias.toFixed(0) + ' kg']
    ]

    autoTable(doc, {
      startY: y,
      body: statsData,
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 40 }
      },
      bodyStyles: {
        fontSize: 8
      },
      margin: { left: margin + 40, right: margin + 40 }
    })

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

    // ===== LEYENDA =====
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('REFERENCIAS:', margin, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.text('RAZAS: HE=Hereford | CA=Careta | AA=Angus | HO=Holando | BN=Brahman | BS=Brangus | BD=Braford', margin, y)
    y += 3
    doc.text('TIPOS: VQ=Vaquillona | NT=Novillito | NO=Novillo | TO=Toro | VA=Vaca | MEJ=Torito', margin, y)
    y += 3
    doc.text('DENTICIÓN: 0D=Sin dientes | 2D=2 dientes | 4D=4 dientes | 6D=6 dientes | 8D=8 dientes', margin, y)
    y += 6

    // ===== FIRMAS =====
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('Elaborado por:', margin, y)
    doc.rect(margin, y + 3, 60, 12)
    doc.text('Autorizado por:', pageWidth - margin - 60, y)
    doc.rect(pageWidth - margin - 60, y + 3, 60, 12)

    // Agregar numeración de páginas
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text(
        `Página ${i} de ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      )
    }

    // Devolver PDF como blob
    const pdfBytes = doc.output('arraybuffer')
    
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="rinde-tropa-${tropa.numero}.pdf"`
      }
    })
  } catch (error) {
    console.error('Error generando Rinde PDF:', error)
    return NextResponse.json(
      { success: false, error: 'Error al generar el PDF' },
      { status: 500 }
    )
  }
}

// Funciones auxiliares
function formatTipoDenticion(denticion: number | null, categoria: string | null): string {
  const d = denticion || 0
  const cat = categoria || ''
  return `${d}D-${cat}`
}

function formatRaza(raza: string | null): string {
  if (!raza) return ''
  return raza.toUpperCase().substring(0, 2)
}
