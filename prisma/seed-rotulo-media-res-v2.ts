/**
 * Seed v2 para crear el rótulo de MEDIA RES para Zebra ZT230
 * TrazaSole v3.7.24
 *
 * Mejoras sobre v1:
 * - Logos convertidos desde PNG con sharp (escalado correcto)
 * - Formato ^GFA correcto (bytes por fila, no total de bytes)
 * - Variables en formato {{DOBLE_LLAVE}} para compatibilidad con /api/rotulos/imprimir
 * - Variables alineadas con lo que envía el romaneo
 * - Logos embebidos directamente como GFA (no ~DG) para impresión directa
 */

import { db } from '../src/lib/db'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

async function main() {
  console.log('🔄 Creando rótulo MEDIA RES v2 para Zebra ZT230...')

  const logosDir = path.join(process.cwd(), 'public', 'logos')

  // Convertir logos a GFA usando sharp (buscar PNG o JPG)
  const gfaSolemar = await convertirLogoAGFA(
    findLogo(logosDir, 'logo-solemar'),
    'Logo Solemar',
    200, // max width in pixels (~100mm at 203 DPI)
    60   // max height in pixels
  )

  const gfaSenasa = await convertirLogoAGFA(
    findLogo(logosDir, 'logo-senasa'),
    'Logo SENASA',
    60,  // max width
    60   // max height
  )

  // Verificar si ya existe
  const existente = await db.rotulo.findFirst({
    where: { tipo: 'MEDIA_RES' }
  })

  const templateZPL = crearTemplateZPL(gfaSolemar, gfaSenasa)

  // Variables disponibles en el template (alineadas con lo que envía romaneo/index.tsx)
  const variables = JSON.stringify([
    { nombre: 'USUARIO_FAENA', descripcion: 'Nombre del titular de faena / productor' },
    { nombre: 'CUIT_USUARIO', descripcion: 'CUIT del titular de faena' },
    { nombre: 'MATRICULA_USUARIO_FAENA', descripcion: 'Matrícula del titular de faena' },
    { nombre: 'FECHA_FAENA', descripcion: 'Fecha de faena (DD/MM/YYYY)' },
    { nombre: 'FECHA_VENCIMIENTO', descripcion: 'Fecha de vencimiento (DD/MM/YYYY)' },
    { nombre: 'TROPA', descripcion: 'Código de tropa' },
    { nombre: 'TROPA_CODIGO', descripcion: 'Código de tropa (sin espacios)' },
    { nombre: 'GARRON', descripcion: 'Número de garrón (3 dígitos)' },
    { nombre: 'LADO', descripcion: 'Lado de la media (D/I)' },
    { nombre: 'LADO_MEDIA', descripcion: 'Lado completo (DERECHA/IZQUIERDA)' },
    { nombre: 'SIGLA', descripcion: 'Clasificación del cuarto (A/T/D)' },
    { nombre: 'PESO_KG', descripcion: 'Peso en kilogramos con unidad' },
    { nombre: 'PESO', descripcion: 'Peso en kilogramos (solo número)' },
    { nombre: 'PESO_VIVO', descripcion: 'Peso vivo del animal' },
    { nombre: 'TIPO_ANIMAL', descripcion: 'Tipo de animal (VA, TO, NO, etc.)' },
    { nombre: 'DENTICION', descripcion: 'Dentición del animal' },
    { nombre: 'TIPIFICADOR', descripcion: 'Nombre del tipificador' },
    { nombre: 'MATRICULA_TIPIFICADOR', descripcion: 'Matrícula del tipificador' },
    { nombre: 'CAMARA', descripcion: 'Nombre de la cámara' },
    { nombre: 'CODIGO_BARRAS', descripcion: 'Código de barras completo' },
    { nombre: 'DECOMISADO', descripcion: 'Indicador de decomiso (SI/NO)' }
  ])

  if (existente) {
    console.log('⚠️  Ya existe un rótulo MEDIA_RES, actualizando con v2...')
    await db.rotulo.update({
      where: { id: existente.id },
      data: {
        nombre: 'Rótulo Media Res - Zebra ZT230 v2',
        codigo: 'MEDIA_RES_ZT230_V2',
        tipo: 'MEDIA_RES',
        tipoImpresora: 'ZEBRA',
        modeloImpresora: 'ZT230',
        ancho: 100,
        alto: 150,
        dpi: 203,
        contenido: templateZPL,
        variables: variables,
        diasConsumo: 13,
        temperaturaMax: 5.0,
        esDefault: true,
        activo: true
      }
    })
    console.log('✅ Rótulo actualizado con v2')
  } else {
    await db.rotulo.create({
      data: {
        nombre: 'Rótulo Media Res - Zebra ZT230 v2',
        codigo: 'MEDIA_RES_ZT230_V2',
        tipo: 'MEDIA_RES',
        tipoImpresora: 'ZEBRA',
        modeloImpresora: 'ZT230',
        ancho: 100,
        alto: 150,
        dpi: 203,
        contenido: templateZPL,
        variables: variables,
        diasConsumo: 13,
        temperaturaMax: 5.0,
        esDefault: true,
        activo: true
      }
    })
    console.log('✅ Rótulo creado con v2')
  }
}

/**
 * Busca un archivo de logo por nombre base (sin extensión)
 * Retorna la ruta del PNG o JPG si existe, o null
 */
function findLogo(dir: string, name: string): string | null {
  for (const ext of ['png', 'jpg', 'jpeg']) {
    const ruta = path.join(dir, `${name}.${ext}`)
    if (fs.existsSync(ruta)) return ruta
  }
  return null
}

/**
 * Convierte una imagen a formato ^GFA para ZPL
 * Escala la imagen al tamaño máximo especificado y genera los datos hexadecimales
 */
async function convertirLogoAGFA(
  rutaArchivo: string | null,
  nombreLog: string,
  maxAncho: number,
  maxAlto: number
): Promise<string> {
  try {
    if (!rutaArchivo || !fs.existsSync(rutaArchivo)) {
      console.log(`   ⚠️ ${nombreLog} no encontrado (${rutaArchivo}), usando placeholder vacío`)
      return '' // Sin logo = no se imprime nada
    }

    const image = sharp(rutaArchivo)
    const metadata = await image.metadata()
    const width = metadata.width || 0
    const height = metadata.height || 0

    if (width === 0 || height === 0) {
      console.log(`   ⚠️ ${nombreLog} con dimensiones inválidas, usando placeholder`)
      return ''
    }

    // Escalar proporcionalmente
    const scaleW = maxAncho / width
    const scaleH = maxAlto / height
    const scale = Math.min(scaleW, scaleH, 1) // No agrandar, solo achicar
    const targetWidth = Math.round(width * scale)
    const targetHeight = Math.round(height * scale)

    console.log(`   📐 ${nombreLog}: ${width}x${height} → ${targetWidth}x${targetHeight}px`)

    // Convertir a monocromo (1 bit)
    const { data } = await image
      .resize(targetWidth, targetHeight, { fit: 'fill' })
      .greyscale()
      .threshold(128)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    // Calcular bytes por fila (8 pixels por byte)
    const bytesPerRow = Math.ceil(targetWidth / 8)
    const totalBytes = bytesPerRow * targetHeight
    const bitmapBuffer = Buffer.alloc(totalBytes)

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const pixelIndex = (y * targetWidth + x) * 4
        const alpha = data[pixelIndex + 3]
        const grey = data[pixelIndex]

        // Pixel negro si tiene opacidad y es oscuro
        const isBlack = alpha > 128 && grey < 128

        if (isBlack) {
          const byteIndex = y * bytesPerRow + Math.floor(x / 8)
          const bitIndex = 7 - (x % 8) // MSB = pixel izquierdo
          bitmapBuffer[byteIndex] |= (1 << bitIndex)
        }
      }
    }

    // Convertir a hexadecimal
    const hexData = bitmapBuffer.toString('hex').toUpperCase()

    console.log(`   ✅ ${nombreLog} GFA: ${targetWidth}x${targetHeight}, ${bytesPerRow} bytes/row, ${totalBytes} bytes total`)

    // Formato ^GFA: totalBytes,bytesPerRow,height,hexData
    return `${totalBytes},${bytesPerRow},${targetHeight},${hexData}`

  } catch (error) {
    console.error(`   ❌ Error convirtiendo ${nombreLog}:`, error)
    return ''
  }
}

/**
 * Crea la plantilla ZPL con logos GFA embebidos y variables en {{DOBLE_LLAVE}}
 */
function crearTemplateZPL(gfaSolemar: string, gfaSenasa: string): string {
  // Construimos las líneas de logo condicionalmente
  const logoSolemarLine = gfaSolemar
    ? `^FO260,10^GFA,${gfaSolemar}^FS`
    : ''

  const logoSenasaLine = gfaSenasa
    ? `^FO60,475^GFA,${gfaSenasa}^FS`
    : ''

  return `^XA
^FX Configuracion de etiqueta - TrazaSole v3.7.24 (v2)
^CI28
^PW800
^LL1150

^FX ============ ENCABEZADO - LOGO SOLEMAR ============
${logoSolemarLine}
^FO40,80^A0N,28,28^FDESTABLECIMIENTO FAENADOR SOLEMAR ALIMENTARIA S.A^FS
^FO200,115^A0N,26,26^FDEST. OFICIAL N 3986^FS
^FO230,150^A0N,24,24^FDCUIT: 30-70919450-6^FS
^FO210,185^A0N,24,24^FDMATRICULA N: 300^FS
^FO50,220^A0N,22,22^FDRUTA NAC. N 22, KM 1043 - CHIMPAY - RIO NEGRO^FS

^FX ============ LINEA SEPARADORA ============
^FO30,260^GB740,3,3^FS

^FX ============ DATOS DEL CLIENTE / USUARIO DE FAENA ============
^FO50,280^A0N,26,26^FDTITULAR DE FAENA: {{USUARIO_FAENA}}^FS
^FO50,315^A0N,26,26^FDCUIT N: {{CUIT_USUARIO}}^FS
^FO50,350^A0N,26,26^FDMATRICULA N: {{MATRICULA_USUARIO_FAENA}}^FS

^FX ============ LINEA SEPARADORA ============
^FO30,390^GB740,3,3^FS

^FX ============ TIPO DE PRODUCTO ============
^FO150,415^A0N,30,30^FDCARNE VACUNA CON HUESO ENFRIADA^FS

^FX ============ LOGO SENASA CON LEYENDA ============
${logoSenasaLine}
^FO160,490^A0N,24,24^FDSENASA N 3986/141334/1^FS
^FO160,520^A0N,24,24^FDINDUSTRIA ARGENTINA^FS

^FX ============ MEDIA RES DESTACADO ============
^FO150,570^GB500,70,50^FS
^FO230,588^A0N,50,50^FDMEDIA RES^FS

^FX ============ LINEA SEPARADORA ============
^FO30,670^GB740,3,3^FS

^FX ============ DATOS VARIABLES ============
^FO50,695^A0N,28,28^FDFECHA FAENA: {{FECHA_FAENA}}^FS
^FO420,695^A0N,28,28^FDTROPA N: {{TROPA}}^FS
^FO50,735^A0N,28,28^FDGARRON N: {{GARRON}} {{LADO}}^FS
^FO420,735^A0N,28,28^FDCLASIF: {{SIGLA}}^FS
^FO50,775^A0N,30,30^FDVENTA AL PESO: {{PESO_KG}}^FS

^FX ============ MENSAJES INFORMATIVOS ============
^FO100,835^A0N,26,26^FDMANTENER REFRIGERADO A MENOS DE 5C^FS
^FO50,870^A0N,26,26^FDCONSUMIR PREFERENTEMENTE ANTES DEL DIA: {{FECHA_VENCIMIENTO}}^FS

^FX ============ LINEA SEPARADORA ============
^FO30,910^GB740,3,3^FS

^FX ============ CODIGO DE BARRAS ============
^FO150,935^BY3,3,80^BCN,80,N,N,N^FD{{CODIGO_BARRAS}}^FS
^FO180,1025^A0N,26,26^FD{{CODIGO_BARRAS}}^FS

^FX Fin de etiqueta
^XZ`
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
