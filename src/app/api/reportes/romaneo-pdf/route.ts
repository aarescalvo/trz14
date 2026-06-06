import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { checkPermission } from '@/lib/auth-helpers'

// GET - Generar PDF de Romaneo por Tropa
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
        estado: { in: ['CONFIRMADO', 'PENDIENTE'] } as any
      },
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
    doc.text('ROMANEO VACUNO', pageWidth / 2, y, { align: 'center' })
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

    // ===== DATOS DE LA TROPA =====
    doc.setFontSize(9)
    const rowHeight = 6

    // Fila 1: Usuario/Matarife y Productor
    doc.setFont('helvetica', 'bold')
    doc.text('Usuario/Matarife:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.usuarioFaena?.nombre || '', margin + 35, y)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Productor:', margin + 100, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.productor?.nombre || tropa.usuarioFaena?.nombre || '', margin + 120, y)
    y += rowHeight

    // Fila 2: Nº DTE y Nº Guía
    doc.setFont('helvetica', 'bold')
    doc.text('Nº DTE:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.dte || '', margin + 18, y)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Nº Guía:', margin + 55, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.guia || '', margin + 73, y)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Nº Tropa:', margin + 110, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.numero.toString(), margin + 130, y)
    y += rowHeight

    // Fila 3: Fecha Faena y Cantidad
    const fechaFaena = romaneos.length > 0 
      ? new Date(romaneos[0].fecha).toLocaleDateString('es-AR')
      : tropa.fechaRecepcion 
        ? new Date(tropa.fechaRecepcion).toLocaleDateString('es-AR')
        : ''
    
    doc.setFont('helvetica', 'bold')
    doc.text('Fecha Faena:', margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(fechaFaena, margin + 25, y)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Cantidad Cabezas:', margin + 55, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.cantidadCabezas.toString(), margin + 88, y)
    y += rowHeight + 3

    // ===== RESUMEN DE PESOS =====
    // Calcular totales
    const kgVivoEntrada = romaneos.reduce((acc, r) => acc + (r.pesoVivo || 0), 0)
    const kgMediaRes = romaneos.reduce((acc, r) => acc + (r.pesoTotal || 0), 0)
    const rindeGeneral = kgVivoEntrada > 0 ? (kgMediaRes / kgVivoEntrada) * 100 : 0
    const promedio = romaneos.length > 0 ? kgMediaRes / romaneos.length : 0

    // Cuadro de resumen
    doc.setFillColor(240, 240, 240)
    doc.rect(margin, y - 2, pageWidth - margin * 2, rowHeight + 2, 'F')
    
    doc.setFont('helvetica', 'bold')
    doc.text('RESUMEN:', margin + 2, y + 2)
    doc.setFont('helvetica', 'normal')
    doc.text(`Kg Vivo Entrada: ${kgVivoEntrada.toFixed(0)}`, margin + 30, y + 2)
    doc.text(`Kg 1/2 Res: ${kgMediaRes.toFixed(0)}`, margin + 75, y + 2)
    doc.text(`Rinde: ${rindeGeneral.toFixed(1)}%`, margin + 115, y + 2)
    doc.text(`Promedio: ${promedio.toFixed(0)} kg`, margin + 150, y + 2)
    y += rowHeight + 5

    // Línea separadora
    doc.line(margin, y, pageWidth - margin, y)
    y += 3

    // ===== TABLA DE ROMANEO =====
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('DETALLE POR ANIMAL', pageWidth / 2, y, { align: 'center' })
    y += 5

    // Preparar datos de la tabla
    const tableData = romaneos.map((romaneo) => {
      const romaneoExt = romaneo as typeof romaneo & { categoria?: string | null; caravana?: string }
      const tipoDent = formatTipoDenticion((romaneoExt.denticion ?? null) as unknown as number | null, romaneoExt.categoria ?? null)
      const pesoEntrada = romaneo.pesoVivo || 0
      const kgMediaA = romaneo.pesoMediaIzq || 0
      const kgMediaB = romaneo.pesoMediaDer || 0
      const totalKg = romaneo.pesoTotal || 0
      const rindeFaena = pesoEntrada > 0 ? ((totalKg / pesoEntrada) * 100).toFixed(1) : ''

      return [
        romaneo.garron.toString(),
        (romaneo.numeroAnimal || 0).toString(),
        formatRaza(romaneo.raza),
        tipoDent,
        romaneoExt.caravana || '',
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
        'KG Entr.',
        'KG 1/2 A',
        'KG 1/2 B',
        'Total KG',
        'Rinde'
      ]],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [200, 200, 200],
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
        // Pie de página en cada página
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

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

    // ===== RESUMEN POR CATEGORÍAS =====
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('RESUMEN POR CATEGORÍAS', pageWidth / 2, y, { align: 'center' })
    y += 5

    // Contar por categoría
    const categorias: Record<string, { count: number; pesoTotal: number; pesoVivo: number }> = {}
    romaneos.forEach(r => {
      const cat = (r as typeof r & { categoria?: string | null }).categoria || 'NT'
      if (!categorias[cat]) {
        categorias[cat] = { count: 0, pesoTotal: 0, pesoVivo: 0 }
      }
      categorias[cat].count++
      categorias[cat].pesoTotal += r.pesoTotal || 0
      categorias[cat].pesoVivo += r.pesoVivo || 0
    })

    const categoriasData = Object.entries(categorias).map(([cat, data]) => {
      const rinde = data.pesoVivo > 0 ? (data.pesoTotal / data.pesoVivo * 100) : 0
      return [
        cat,
        data.count.toString(),
        data.pesoVivo.toFixed(0),
        data.pesoTotal.toFixed(0),
        rinde.toFixed(1) + '%'
      ]
    })

    autoTable(doc, {
      startY: y,
      head: [[
        'Categoría',
        'Cantidad',
        'KG Vivo',
        'KG 1/2 Res',
        'Rinde'
      ]],
      body: categoriasData,
      theme: 'grid',
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 8
      },
      bodyStyles: {
        fontSize: 8
      },
      margin: { left: margin + 30, right: margin + 30 }
    })

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

    // ===== LEYENDA DE CATEGORÍAS =====
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('REFERENCIAS DE CATEGORÍAS:', margin, y)
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.text('VQ = Vaquillona | NT = Novillito | NO = Novillo | TO = Toro | VA = Vaca | MEJ = Torito', margin, y)
    y += 4
    doc.text('RAZAS: HE=Hereford | CA=Careta | AA=Angus | HO=Holando | BN=Brahman | BS=Brangus | BD=Braford', margin, y)
    y += 6

    // ===== FIRMAS =====
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('Tipificador:', margin, y)
    doc.rect(margin, y + 3, 60, 15)
    doc.text('Supervisor:', pageWidth - margin - 60, y)
    doc.rect(pageWidth - margin - 60, y + 3, 60, 15)

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
        'Content-Disposition': `attachment; filename="romaneo-tropa-${tropa.numero}.pdf"`
      }
    })
  } catch (error) {
    console.error('Error generando Romaneo PDF:', error)
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
  
  // Formato: "2D-VQ" (2 dientes - Vaquillona)
  const denticionStr = d + 'D'
  return `${denticionStr}-${cat}`
}

function formatRaza(raza: string | null): string {
  if (!raza) return ''
  return raza.toUpperCase().substring(0, 2)
}
