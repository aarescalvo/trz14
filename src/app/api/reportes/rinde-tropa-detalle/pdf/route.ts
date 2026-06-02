import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { checkPermission } from '@/lib/auth-helpers'
import reporteConfig from '@/config/reporte-rinde-tropa.json'

// GET - Generar PDF Rinde por Tropa
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeReportes')
  if (authError) return authError

  try {
    const { searchParams } = new URL(request.url)
    const tropaId = searchParams.get('tropaId')

    if (!tropaId) {
      return NextResponse.json({ success: false, error: 'ID de tropa requerido' }, { status: 400 })
    }

    const tropa = await db.tropa.findUnique({
      where: { id: tropaId },
      include: {
        productor: true,
        usuarioFaena: true,
        animales: { orderBy: { numero: 'asc' } }
      }
    })

    if (!tropa) {
      return NextResponse.json({ success: false, error: 'Tropa no encontrada' }, { status: 404 })
    }

    const romaneos = await db.romaneo.findMany({
      where: { tropaCodigo: tropa.codigo, estado: 'CONFIRMADO' },
      include: { tipificador: true },
      orderBy: { garron: 'asc' }
    })

    const listaFaenaTropa = await db.listaFaenaTropa.findFirst({
      where: { tropaId: tropa.id },
      include: { listaFaena: true },
      orderBy: { createdAt: 'desc' }
    })

    const menudencias = await db.menudencia.findMany({
      where: { tropaCodigo: tropa.codigo },
      include: { tipoMenudencia: true },
      orderBy: { tipoMenudencia: { nombre: 'asc' } }
    })

    const animalMap = new Map(tropa.animales.map(a => [a.numero, a]))
    const fechaFaena = listaFaenaTropa?.listaFaena?.fecha
      || (romaneos.length > 0 ? romaneos[0].fecha : tropa.fechaFaena)

    // Cálculos
    const pesoVivoTotal = romaneos.reduce((s, r) => s + (r.pesoVivo || 0), 0)
    const pesoMedioTotal = romaneos.reduce((s, r) => s + (r.pesoTotal || 0), 0)
    const rindeGeneral = pesoVivoTotal > 0 ? pesoMedioTotal / pesoVivoTotal : 0
    const promedio = romaneos.length > 0 ? pesoMedioTotal / romaneos.length : 0

    // Resumen por tipo
    const tipoResumen: Record<string, { cantidad: number; kg: number; cuartos: number }> = {}
    for (const r of romaneos) {
      const tipo = r.tipoAnimal || 'SIN_TIPO'
      if (!tipoResumen[tipo]) tipoResumen[tipo] = { cantidad: 0, kg: 0, cuartos: 0 }
      tipoResumen[tipo].cantidad++
      tipoResumen[tipo].kg += r.pesoTotal || 0
      tipoResumen[tipo].cuartos += 2
    }

    const cfg = reporteConfig.pdf
    const fnt = cfg.fuentes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const colors = cfg.colores as any
    const sep = cfg.separacion

    // ===== GENERAR PDF =====
    const doc = new jsPDF('landscape', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()
    const mg = cfg.margenes.izquierdo
    let y = 10

    // Título
    doc.setFontSize(fnt.tamanoTitulo)
    doc.setFont('helvetica', 'bold')
    doc.text('RINDE POR TROPA', pageWidth / 2, y, { align: 'center' })
    y += 6

    // Establecimiento
    doc.setFontSize(fnt.tamanoInfo)
    doc.setFont('helvetica', 'normal')
    doc.text('Estab. Faenador: Solemar Alimentaria S.A.  |  Ruta Nacional N\u00ba 22, km 1043, Chimpay, Rio Negro', mg, y)
    y += 4
    doc.text('Matr\u00edcula: 300  |  N\u00ba SENASA: 3986', mg, y)

    // RINDE y PROM a la derecha
    doc.setFont('helvetica', 'bold')
    doc.text('RINDE:', pageWidth - mg - 55, y - 4)
    doc.text(`${(rindeGeneral * 100).toFixed(2)}%`, pageWidth - mg - 38, y - 4)
    doc.text('PROM:', pageWidth - mg - 55, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`${promedio.toFixed(1)} kg`, pageWidth - mg - 38, y)
    y += 5

    doc.setDrawColor(0)
    doc.setLineWidth(0.5)
    doc.line(mg, y, pageWidth - mg, y)
    y += 4

    // Usuario/Matarife y Productor
    doc.setFontSize(fnt.tamanoInfo)
    doc.setFont('helvetica', 'bold')
    doc.text('Usuario/Matarife:', mg, y)
    doc.text(tropa.usuarioFaena?.nombre || '-', mg + 38, y)
    doc.text('Matr\u00edcula:', mg + 110, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.usuarioFaena?.matricula || tropa.usuarioFaena?.cuit || '-', mg + 130, y)
    doc.setFont('helvetica', 'bold')
    doc.text('Productor:', mg + 170, y)
    doc.text(tropa.productor?.nombre || '-', mg + 192, y)
    y += 5

    doc.text('N\u00ba DTE:', mg, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.dte || '-', mg + 20, y)
    doc.setFont('helvetica', 'bold')
    doc.text('N\u00ba Gu\u00eda:', mg + 80, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.guia || '-', mg + 102, y)
    doc.setFont('helvetica', 'bold')
    doc.text('Fecha Ing.:', mg + 155, y)
    doc.setFont('helvetica', 'normal')
    doc.text(tropa.fechaRecepcion ? new Date(tropa.fechaRecepcion).toLocaleDateString('es-AR') : '-', mg + 175, y)
    y += 5

    doc.setFont('helvetica', 'bold')
    doc.text('Fecha Faena:', mg, y)
    const fc = colors.fechaFaena as number[]; doc.setTextColor(fc[0], fc[1], fc[2])
    doc.text(fechaFaena ? new Date(fechaFaena).toLocaleDateString('es-AR') : '-', mg + 25, y)
    doc.setTextColor(0)
    doc.text('N\u00ba Tropa:', mg + 155, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(tropa.numero || '-'), mg + 180, y)
    doc.setFont('helvetica', 'bold')
    doc.text('Cabezas:', mg + 200, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(tropa.cantidadCabezas), mg + 225, y)
    y += 5

    doc.setFont('helvetica', 'bold')
    doc.text('Kg Vivo:', mg, y)
    doc.setFont('helvetica', 'normal')
    doc.text(Math.round(pesoVivoTotal).toString(), mg + 18, y)
    doc.setFont('helvetica', 'bold')
    doc.text('Kg 1/2 Res:', mg + 55, y)
    doc.setFont('helvetica', 'normal')
    doc.text(Math.round(pesoMedioTotal).toString(), mg + 82, y)
    doc.setFont('helvetica', 'bold')
    doc.text('Rinde:', mg + 130, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`${(rindeGeneral * 100).toFixed(2)}%`, mg + 148, y)
    doc.setFont('helvetica', 'bold')
    doc.text('Promedio:', mg + 190, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`${promedio.toFixed(1)} kg`, mg + 218, y)
    y += 5

    doc.setLineWidth(0.3)
    doc.line(mg, y, pageWidth - mg, y)
    y += sep.antesDeTabla

    // ===== RESUMEN POR TIPO =====
    const tiposOrden = ['VQ', 'NT', 'NO', 'TO', 'VA', 'MEJ']
    const tiposActivos = tiposOrden.filter(t => tipoResumen[t] && tipoResumen[t].cantidad > 0)
    if (tiposActivos.length > 0) {
      doc.setFontSize(fnt.tamanoInfo)
      doc.setFont('helvetica', 'bold')
      let tipoX = mg + 180
      doc.text('Tipo', tipoX, y)
      doc.text('Cuartos', tipoX + 22, y)
      doc.text('Kg', tipoX + 48, y)
      y += 4
      doc.setFont('helvetica', 'normal')
      for (const tipo of tiposActivos) {
        const tr = tipoResumen[tipo]
        doc.text(tipo, tipoX, y)
        doc.text(tr.cuartos.toString(), tipoX + 28, y, { align: 'right' })
        doc.text(Math.round(tr.kg).toString(), tipoX + 55, y, { align: 'right' })
        y += 3.5
      }
      y += 1
      doc.setLineWidth(0.2)
      doc.line(mg, y, pageWidth - mg, y)
      y += 3
    }

    // ===== TABLA DE ANIMALES =====
    const tableData = romaneos.map((rom, idx) => {
      const animal = rom.numeroAnimal ? animalMap.get(rom.numeroAnimal) : null
      const caravana = animal?.caravana || ''
      const pesoTotalVal = (rom.pesoMediaIzq || 0) + (rom.pesoMediaDer || 0)
      const rindeVal = rom.pesoVivo && rom.pesoVivo > 0 ? pesoTotalVal / rom.pesoVivo : null
      const denticionStr = rom.denticion || ''
      const tipoStr = rom.tipoAnimal || ''
      const clasif = denticionStr && tipoStr ? `${denticionStr} - ${tipoStr}` : tipoStr || denticionStr || ''

      return [
        rom.garron.toString(),
        rom.numeroAnimal?.toString() || '',
        rom.raza || animal?.raza || '',
        clasif,
        caravana,
        rom.pesoVivo ? Math.round(rom.pesoVivo).toString() : '',
        rom.pesoMediaIzq ? rom.pesoMediaIzq.toFixed(1) : '',
        rom.pesoMediaDer ? rom.pesoMediaDer.toFixed(1) : '',
        pesoTotalVal > 0 ? pesoTotalVal.toFixed(1) : '',
        rindeVal ? `${(rindeVal * 100).toFixed(2)}%` : ''
      ]
    })

    // Totales
    const sumA = romaneos.reduce((s, rom) => s + (rom.pesoMediaIzq || 0), 0)
    const sumB = romaneos.reduce((s, rom) => s + (rom.pesoMediaDer || 0), 0)
    tableData.push([
      '', romaneos.length.toString(), '', '', '',
      Math.round(pesoVivoTotal).toString(),
      sumA.toFixed(1), sumB.toFixed(1),
      pesoMedioTotal.toFixed(1),
      `${(rindeGeneral * 100).toFixed(2)}%`
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ha = (v: string) => v as any

    autoTable(doc, {
      startY: y,
      head: [['N\u00ba Garr\u00f3n', 'N\u00ba Animal', 'Raza', 'Clasificaci\u00f3n', 'Caravana', 'Kg Entrada', 'Kg 1/2 A', 'Kg 1/2 B', 'Total Kg', 'Rinde Faena']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: colors.encabezadoTabla, textColor: colors.textoEncabezado, fontStyle: 'bold', fontSize: fnt.tamanoTablaEncabezado },
      bodyStyles: { fontSize: fnt.tamanoTablaCuerpo, cellPadding: 1.5 },
      columnStyles: {
        0: { cellWidth: cfg.tablaAnimales.anchoColumnas.garron, halign: ha(cfg.tablaAnimales.alineacion.garron) },
        1: { cellWidth: cfg.tablaAnimales.anchoColumnas.animal, halign: ha(cfg.tablaAnimales.alineacion.animal) },
        2: { cellWidth: cfg.tablaAnimales.anchoColumnas.raza, halign: ha(cfg.tablaAnimales.alineacion.raza) },
        3: { cellWidth: cfg.tablaAnimales.anchoColumnas.clasificacion, halign: ha(cfg.tablaAnimales.alineacion.clasificacion) },
        4: { cellWidth: cfg.tablaAnimales.anchoColumnas.caravana, halign: ha(cfg.tablaAnimales.alineacion.caravana) },
        5: { cellWidth: cfg.tablaAnimales.anchoColumnas.kgEntrada, halign: ha(cfg.tablaAnimales.alineacion.kgEntrada) },
        6: { cellWidth: cfg.tablaAnimales.anchoColumnas.mediaA, halign: ha(cfg.tablaAnimales.alineacion.mediaA) },
        7: { cellWidth: cfg.tablaAnimales.anchoColumnas.mediaB, halign: ha(cfg.tablaAnimales.alineacion.mediaB) },
        8: { cellWidth: cfg.tablaAnimales.anchoColumnas.totalKg, halign: ha(cfg.tablaAnimales.alineacion.totalKg) },
        9: { cellWidth: cfg.tablaAnimales.anchoColumnas.rinde, halign: ha(cfg.tablaAnimales.alineacion.rinde) }
      },
      didParseCell: (data: any) => {
        if (data.row.index === tableData.length - 1 && data.section === 'body') {
          data.cell.styles.fontStyle = 'bold'
          data.cell.styles.fillColor = colors.filaTotales
        }
      },
      margin: { left: mg, right: mg }
    })

    // ===== MENUDENCIA =====
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + sep.despuesDeTabla
    let menY: number
    if (finalY + menudencias.length * 5 + 15 > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage()
      menY = 15
    } else {
      menY = finalY
    }

    doc.setFontSize(fnt.tamanoInfo)
    doc.setFont('helvetica', 'bold')
    doc.text('MENUDENCIA', mg, menY)
    menY += 3

    if (menudencias.length > 0) {
      const menData = menudencias.map(men => {
        // Intentar extraer kg decomiso de observaciones
        let kgDec = ''
        if (men.observaciones?.includes('Decomiso:')) {
          const parsed = parseFloat(men.observaciones.split('Decomiso:')[1]?.split('kg')[0]?.trim() || '')
          if (parsed && !isNaN(parsed)) kgDec = parsed.toFixed(1)
        }
        return [
          men.tipoMenudencia.nombre,
          (men.cantidadBolsas || 0).toString(),
          men.pesoIngreso ? men.pesoIngreso.toFixed(1) : '',
          '',
          kgDec
        ]
      })
      const totalCant = menudencias.reduce((s, men) => s + (men.cantidadBolsas || 0), 0)
      const totalKg = menudencias.reduce((s, men) => s + (men.pesoIngreso || 0), 0)
      menData.push(['TOTALES', totalCant.toString(), totalKg.toFixed(1), '', ''])

      autoTable(doc, {
        startY: menY,
        head: [['Tipo', 'Cantidades', 'Kg', 'Unidad', 'Kg Dec.']],
        body: menData,
        theme: 'grid',
        headStyles: { fillColor: colors.encabezadoTabla, textColor: colors.textoEncabezado, fontStyle: 'bold', fontSize: fnt.tamanoMenudencia },
        bodyStyles: { fontSize: fnt.tamanoMenudencia, cellPadding: 1.5 },
        columnStyles: {
          0: { cellWidth: cfg.tablaMenudencia.anchoColumnas.tipo },
          1: { cellWidth: cfg.tablaMenudencia.anchoColumnas.cantidades, halign: 'center' },
          2: { cellWidth: cfg.tablaMenudencia.anchoColumnas.kg, halign: 'right' },
          3: { cellWidth: cfg.tablaMenudencia.anchoColumnas.unidad, halign: 'center' },
          4: { cellWidth: cfg.tablaMenudencia.anchoColumnas.kgDec, halign: 'right' }
        },
        didParseCell: (data: any) => {
          if (data.row.index === menData.length - 1 && data.section === 'body') {
            data.cell.styles.fontStyle = 'bold'
            data.cell.styles.fillColor = colors.filaTotales
          }
        },
        margin: { left: mg, right: mg }
      })
    }

    // Pie de página
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(fnt.tamanoPie)
      doc.setFont('helvetica', 'normal')
      doc.text(`P\u00e1gina ${i} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' })
    }

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Rinde_Tropa_${tropa.numero || tropa.codigo}.pdf"`
      }
    })

  } catch (error) {
    console.error('Error generando PDF rinde tropa:', error)
    return NextResponse.json({ success: false, error: 'Error al generar el PDF' }, { status: 500 })
  }
}
