import PDFDocument from 'pdfkit'
import { PassThrough } from 'stream'
import { db } from '@/lib/db'

// Tipos de animales bovinos con sus etiquetas
const TIPOS_ANIMALES_LABELS: Record<string, string> = {
  'VQ': 'Vaquillona',
  'NT': 'Novillito',
  'NO': 'Novillo',
  'TO': 'Toro',
  'VA': 'Vaca',
  'MEJ': 'Mej/Torito'
}

interface AnimalRomaneo {
  garron: number
  numeroAnimal: number | null
  tipoAnimal: string | null
  raza: string | null
  caravana: string | null
  denticion: string | null
  pesoVivo: number | null
  pesoMediaIzq: number | null
  pesoMediaDer: number | null
  pesoTotal: number | null
  rinde: number | null
}

interface DatosTropa {
  codigo: string
  numero: number
  dte: string
  guia: string
  cantidadCabezas: number
  usuarioFaena: {
    nombre: string
    matricula?: string
  } | null
  productor: {
    nombre: string
  } | null
  pesoNeto: number | null
  pesoTotalIndividual: number | null
}

interface ResumenTipoAnimal {
  tipo: string
  cantidad: number
  kgTotal: number
}

interface DatosRomaneoPDF {
  tropa: DatosTropa
  animales: AnimalRomaneo[]
  resumenTipos: ResumenTipoAnimal[]
  kgVivoEntrada: number
  kgMediasRes: number
  rindeGeneral: number
  promedio: number
  fechaFaena: Date
  operador?: {
    nombre: string
  }
}

/**
 * Obtiene los datos del romaneo para una tropa específica
 */
export async function getDatosRomaneoPorTropa(tropaCodigo: string): Promise<DatosRomaneoPDF | null> {
  // Obtener la tropa con todos sus datos
  const tropa = await db.tropa.findUnique({
    where: { codigo: tropaCodigo },
    include: {
      usuarioFaena: true,
      productor: true,
      tiposAnimales: true,
      animales: {
        include: {
          pesajeIndividual: true,
          asignacionGarron: true
        }
      }
    }
  })

  if (!tropa) return null

  // Obtener romaneos de los animales de esta tropa
  const romaneos = await db.romaneo.findMany({
    where: { tropaCodigo: tropa.codigo },
    include: {
      tipificador: true,
      operador: true
    },
    orderBy: { garron: 'asc' }
  })

  // Calcular peso vivo total (del pesaje individual)
  const kgVivoEntrada = tropa.pesoTotalIndividual || 
    tropa.animales.reduce((sum, a) => sum + (a.pesoVivo || 0), 0)

  // Construir lista de animales con datos de romaneo
  const animales: AnimalRomaneo[] = romaneos.map(r => {
    const animal = tropa.animales.find(a => a.numero === r.numeroAnimal)
    return {
      garron: r.garron,
      numeroAnimal: r.numeroAnimal,
      tipoAnimal: r.tipoAnimal,
      raza: r.raza || animal?.raza || null,
      caravana: animal?.caravana || null,
      denticion: r.denticion,
      pesoVivo: r.pesoVivo || animal?.pesoVivo || null,
      pesoMediaIzq: r.pesoMediaIzq,
      pesoMediaDer: r.pesoMediaDer,
      pesoTotal: r.pesoTotal,
      rinde: (r.pesoVivo && r.pesoVivo > 0 && r.pesoTotal && r.pesoTotal > 0)
        ? Math.round((r.pesoTotal / r.pesoVivo) * 10000) / 100
        : r.rinde
    }
  })

  // Si no hay romaneos, crear lista desde los animales
  if (animales.length === 0) {
    tropa.animales.forEach((a, index) => {
      animales.push({
        garron: index + 1,
        numeroAnimal: a.numero,
        tipoAnimal: a.tipoAnimal,
        raza: a.raza,
        caravana: a.caravana,
        denticion: null,
        pesoVivo: a.pesoVivo,
        pesoMediaIzq: null,
        pesoMediaDer: null,
        pesoTotal: null,
        rinde: null
      })
    })
  }

  // Calcular resumen por tipo de animal
  const resumenMap = new Map<string, { cantidad: number; kgTotal: number }>()
  
  animales.forEach(a => {
    if (a.tipoAnimal) {
      const actual = resumenMap.get(a.tipoAnimal) || { cantidad: 0, kgTotal: 0 }
      actual.cantidad++
      actual.kgTotal += a.pesoTotal || 0
      resumenMap.set(a.tipoAnimal, actual)
    }
  })

  const resumenTipos: ResumenTipoAnimal[] = ['VQ', 'NT', 'NO', 'TO', 'VA', 'MEJ'].map(tipo => ({
    tipo,
    cantidad: resumenMap.get(tipo)?.cantidad || 0,
    kgTotal: resumenMap.get(tipo)?.kgTotal || 0
  }))

  // Calcular totales
  const kgMediasRes = animales.reduce((sum, a) => sum + (a.pesoTotal || 0), 0)
  const rindeGeneral = kgVivoEntrada > 0 ? (kgMediasRes / kgVivoEntrada) * 100 : 0
  const animalesConPeso = animales.filter(a => a.pesoTotal && a.pesoTotal > 0)
  const promedio = animalesConPeso.length > 0 
    ? kgMediasRes / animalesConPeso.length 
    : 0

  // Obtener operador del primer romaneo si existe
  const operador = romaneos[0]?.operador || undefined

  return {
    tropa: {
      codigo: tropa.codigo,
      numero: tropa.numero,
      dte: tropa.dte,
      guia: tropa.guia,
      cantidadCabezas: tropa.cantidadCabezas,
      usuarioFaena: tropa.usuarioFaena ? {
        nombre: tropa.usuarioFaena.nombre,
        matricula: tropa.usuarioFaena.cuit || undefined
      } : null,
      productor: tropa.productor ? { nombre: tropa.productor.nombre } : null,
      pesoNeto: tropa.pesoNeto,
      pesoTotalIndividual: tropa.pesoTotalIndividual
    },
    animales,
    resumenTipos,
    kgVivoEntrada,
    kgMediasRes,
    rindeGeneral,
    promedio,
    fechaFaena: romaneos[0]?.fecha || new Date(),
    operador
  }
}

/**
 * Genera el PDF del romaneo para una tropa
 */
export async function generarPDFRomaneoTropa(datos: DatosRomaneoPDF): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 30, bottom: 30, left: 30, right: 30 }
      })

      const chunks: Buffer[] = []
      const stream = new PassThrough()
      
      stream.on('data', (chunk) => chunks.push(chunk))
      stream.on('end', () => resolve(Buffer.concat(chunks)))
      stream.on('error', reject)

      doc.pipe(stream)

      // Colores
      const colorHeader = '#1a1a1a'
      const colorTexto = '#333333'
      const colorBorde = '#cccccc'
      const colorFondoClaro = '#f5f5f5'

      let y = 30

      // ============== ENCABEZADO ==============
      // Título principal
      doc.fontSize(16).font('Helvetica-Bold')
        .fillColor(colorHeader)
        .text('ROMANEO DE FAENA', 30, y, { align: 'center' })
      y += 25

      // Datos del frigorífico (lado izquierdo)
      doc.fontSize(10).font('Helvetica-Bold')
        .text('Estab. Faenador:', 30, y)
      doc.font('Helvetica').text('Solemar Alimentaria S.A.', 120, y)
      y += 15

      doc.font('Helvetica-Bold').text('Matricula:', 30, y)
      doc.font('Helvetica').text('300', 85, y)
      y += 15

      doc.font('Helvetica-Bold').text('N SENASA:', 30, y)
      doc.font('Helvetica').text('3986', 90, y)
      y += 25

      // Rinde y Promedio (lado derecho)
      const rightCol = 420
      const rindeY = y - 55
      
      doc.font('Helvetica-Bold').fontSize(12).text('RINDE', rightCol, rindeY)
      doc.fontSize(18).fillColor('#2563eb').text(
        `${datos.rindeGeneral.toFixed(2)}%`,
        rightCol + 60, rindeY - 3
      )
      
      doc.fontSize(12).fillColor(colorHeader).font('Helvetica-Bold')
        .text('PROM.', rightCol, rindeY + 25)
      doc.fontSize(18).fillColor('#2563eb')
        .text(datos.promedio.toFixed(2), rightCol + 60, rindeY + 22)

      // Línea separadora
      y += 5
      doc.moveTo(30, y).lineTo(doc.page.width - 30, y)
        .strokeColor(colorBorde).stroke()
      y += 15

      // ============== DATOS DE LA TROPA ==============
      // Usuario/Matarife
      doc.fontSize(9).font('Helvetica-Bold').fillColor(colorHeader)
        .text('Usuario/Matarife:', 30, y)
      doc.font('Helvetica').fillColor(colorTexto)
        .text(datos.tropa.usuarioFaena?.nombre || '-', 115, y)
      
      doc.font('Helvetica-Bold').text('Matricula:', 300, y)
      doc.font('Helvetica').text(datos.tropa.usuarioFaena?.matricula || '-', 355, y)
      y += 15

      // Productor
      doc.font('Helvetica-Bold').text('Productor:', 30, y)
      doc.font('Helvetica').text(datos.tropa.productor?.nombre || '-', 85, y)
      
      doc.font('Helvetica-Bold').text('N DTE:', 300, y)
      doc.font('Helvetica').text(datos.tropa.dte, 340, y)
      
      doc.font('Helvetica-Bold').text('N Guia:', 430, y)
      doc.font('Helvetica').text(datos.tropa.guia, 475, y)
      y += 20

      // Fecha, Tropa, Cantidad
      doc.font('Helvetica-Bold').text('Fecha Faena:', 30, y)
      doc.font('Helvetica').text(
        datos.fechaFaena.toLocaleDateString('es-AR'),
        95, y
      )
      
      doc.font('Helvetica-Bold').text('N Tropa:', 200, y)
      doc.font('Helvetica').text(datos.tropa.numero.toString(), 250, y)
      
      doc.font('Helvetica-Bold').text('Cantidad Cabeza:', 320, y)
      doc.font('Helvetica').text(datos.tropa.cantidadCabezas.toString(), 410, y)
      y += 20

      // ============== RESUMEN POR TIPO ==============
      // Tabla de resumen (lado derecho)
      const resumenX = 420
      let resumenY = y - 55

      doc.font('Helvetica-Bold').fontSize(9)
        .fillColor(colorHeader)
        .text('Cuartos', resumenX, resumenY)
        .text('Cantidad', resumenX + 50, resumenY)
        .text('Kg', resumenX + 105, resumenY)
      resumenY += 12

      doc.font('Helvetica').fontSize(9).fillColor(colorTexto)
      datos.resumenTipos.forEach(r => {
        doc.text(r.tipo, resumenX, resumenY)
          .text(r.cantidad.toString(), resumenX + 65, resumenY, { width: 30, align: 'right' })
          .text(r.kgTotal.toFixed(1), resumenX + 115, resumenY, { width: 40, align: 'right' })
        resumenY += 10
      })

      y += 15

      // ============== TOTALES ==============
      // Fondo para totales
      doc.rect(30, y, 370, 50).fill(colorFondoClaro)
      
      doc.fontSize(10).font('Helvetica-Bold').fillColor(colorHeader)
      doc.text('Kg Vivo entrada:', 40, y + 10)
      doc.font('Helvetica').text(datos.kgVivoEntrada.toLocaleString('es-AR', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      }), 145, y + 10)

      doc.font('Helvetica-Bold').text('Kg 1/2 Res', 40, y + 25)
      doc.font('Helvetica').text(datos.kgMediasRes.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }), 145, y + 25)

      doc.font('Helvetica-Bold').text('Rinde:', 250, y + 10)
      doc.font('Helvetica').text(`${datos.rindeGeneral.toFixed(2)}%`, 285, y + 10)

      doc.font('Helvetica-Bold').text('Promedio:', 250, y + 25)
      doc.font('Helvetica').text(datos.promedio.toFixed(2), 310, y + 25)

      y += 65

      // ============== TABLA DE DETALLE ==============
      // Encabezados de tabla
      const colWidths = [50, 50, 70, 50, 65, 55, 55, 55, 55, 50] // Ajustado
      const headers = ['N GARRON', 'N ANIMAL', 'TIPO ANIMAL', 'RAZA', 'N CARAVANA', 'DENTICION', 'CLASIF.', 'KG ENTRADA', 'KG 1/2 IZQ', 'KG 1/2 DER']

      doc.rect(30, y, doc.page.width - 60, 18).fill(colorFondoClaro)
      doc.font('Helvetica-Bold').fontSize(7).fillColor(colorHeader)
      
      let xPos = 35
      headers.forEach((header, i) => {
        doc.text(header, xPos, y + 5, { width: colWidths[i] - 5, align: 'center' })
        xPos += colWidths[i]
      })
      y += 20

      // Filas de datos
      doc.font('Helvetica').fontSize(8).fillColor(colorTexto)
      
      datos.animales.forEach((animal, index) => {
        // Verificar si necesitamos nueva página
        if (y > doc.page.height - 100) {
          doc.addPage()
          y = 30
          
          // Repetir encabezados en nueva página
          doc.rect(30, y, doc.page.width - 60, 18).fill(colorFondoClaro)
          doc.font('Helvetica-Bold').fontSize(7).fillColor(colorHeader)
          
          xPos = 35
          headers.forEach((header, i) => {
            doc.text(header, xPos, y + 5, { width: colWidths[i] - 5, align: 'center' })
            xPos += colWidths[i]
          })
          y += 20
          doc.font('Helvetica').fontSize(8).fillColor(colorTexto)
        }

        // Fila alterna con fondo claro
        if (index % 2 === 0) {
          doc.rect(30, y, doc.page.width - 60, 14).fill('#fafafa')
        }

        xPos = 35
        const clasificacion = animal.denticion && animal.tipoAnimal 
          ? `${animal.denticion}D - ${animal.tipoAnimal}`
          : animal.tipoAnimal || '-'

        const row = [
          animal.garron.toString(),
          animal.numeroAnimal?.toString() || '-',
          TIPOS_ANIMALES_LABELS[animal.tipoAnimal || ''] || animal.tipoAnimal || '-',
          animal.raza || '-',
          animal.caravana || '-',
          animal.denticion ? `${animal.denticion}D` : '-',
          clasificacion,
          animal.pesoVivo?.toFixed(2) || '-',
          animal.pesoMediaIzq?.toFixed(1) || '-',
          animal.pesoMediaDer?.toFixed(1) || '-'
        ]

        row.forEach((cell, i) => {
          doc.text(cell, xPos, y + 3, { width: colWidths[i] - 5, align: 'center' })
          xPos += colWidths[i]
        })

        y += 14
      })

      // ============== FILA DE TOTALES ==============
      y += 5
      doc.rect(30, y, doc.page.width - 60, 18).fill(colorFondoClaro)
      doc.font('Helvetica-Bold').fontSize(8).fillColor(colorHeader)

      const totalesRow = [
        'TOTALES',
        datos.animales.length.toString(),
        '',
        '',
        '',
        '',
        '',
        datos.kgVivoEntrada.toFixed(2),
        datos.animales.reduce((s, a) => s + (a.pesoMediaIzq || 0), 0).toFixed(1),
        datos.animales.reduce((s, a) => s + (a.pesoMediaDer || 0), 0).toFixed(1)
      ]

      xPos = 35
      totalesRow.forEach((cell, i) => {
        doc.text(cell, xPos, y + 5, { width: colWidths[i] - 5, align: 'center' })
        xPos += colWidths[i]
      })
      y += 25

      // ============== PIE DEL DOCUMENTO ==============
      // Verificar si necesitamos nueva página para el pie
      if (y > doc.page.height - 60) {
        doc.addPage()
        y = 30
      }

      // Línea separadora
      doc.moveTo(30, y).lineTo(doc.page.width - 30, y)
        .strokeColor(colorBorde).stroke()
      y += 10

      doc.fontSize(8).font('Helvetica').fillColor(colorTexto)
      doc.text(
        `Documento generado el ${new Date().toLocaleDateString('es-AR')} a las ${new Date().toLocaleTimeString('es-AR')}`,
        30, y
      )

      if (datos.operador) {
        doc.text(`Operador: ${datos.operador.nombre}`, 400, y)
      }

      y += 15

      // Pie de página
      doc.fontSize(7).fillColor('#666666')
        .text('Solemar Alimentaria S.A. - Matricula: 300 - N SENASA: 3986', 30, y, {
          align: 'center',
          width: doc.page.width - 60
        })

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Función principal para generar el PDF del romaneo
 */
export async function generarRomaneoPDF(tropaCodigo: string): Promise<Buffer | null> {
  const datos = await getDatosRomaneoPorTropa(tropaCodigo)
  
  if (!datos) {
    return null
  }

  return generarPDFRomaneoTropa(datos)
}
