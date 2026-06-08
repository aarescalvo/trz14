/**
 * API para regenerar la plantilla de MEDIA_RES con logos correctamente escalados
 * Resuelve el problema del logo 2160x2160 que causaba error en la impresora
 *
 * GET /api/rotulos/regenerar-media-res
 * - Convierte logos PNG/JPG a GFA con sharp (tamaño correcto)
 * - Genera plantilla ZPL con variables {{DOBLE_LLAVE}}
 * - Actualiza el rótulo MEDIA_RES en la DB
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { checkPermission } from '@/lib/auth-helpers'
import { createLogger } from '@/lib/logger'

const log = createLogger('app.api.rotulos.regenerar-media-res')

export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeConfiguracion')
  if (authError) return authError
  try {
    const logosDir = path.join(process.cwd(), 'public', 'logos')

    // Buscar logos (PNG o JPG)
    const rutaSolemar = findLogo(logosDir, 'logo-solemar')
    const rutaSenasa = findLogo(logosDir, 'logo-senasa')

    // Convertir a GFA
    const gfaSolemar = await convertirLogoAGFA(rutaSolemar, 'Logo Solemar', 200, 60)
    const gfaSenasa = await convertirLogoAGFA(rutaSenasa, 'Logo SENASA', 60, 60)

    // Generar plantilla ZPL
    const templateZPL = crearTemplateZPL(gfaSolemar, gfaSenasa)

    // Variables disponibles
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

    // Actualizar o crear en DB
    const existente = await db.rotulo.findFirst({
      where: { tipo: 'MEDIA_RES' }
    })

    let rotulo
    if (existente) {
      rotulo = await db.rotulo.update({
        where: { id: existente.id },
        data: {
          nombre: 'Rótulo Media Res - Zebra ZT230 v2',
          tipoImpresora: 'ZEBRA',
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
      log.info('Rótulo MEDIA_RES actualizado con v2')
    } else {
      rotulo = await db.rotulo.create({
        data: {
          nombre: 'Rótulo Media Res - Zebra ZT230 v2',
          codigo: 'MEDIA_RES_ZT230_V2',
          tipo: 'MEDIA_RES',
          tipoImpresora: 'ZEBRA',
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
      log.info('Rótulo MEDIA_RES creado con v2')
    }

    return NextResponse.json({
      success: true,
      message: 'Plantilla MEDIA_RES v2 generada correctamente',
      rotulo: {
        id: rotulo.id,
        nombre: rotulo.nombre,
        codigo: rotulo.codigo,
        tieneLogoSolemar: !!gfaSolemar,
        tieneLogoSenasa: !!gfaSenasa
      },
      templateLength: templateZPL.length
    })

  } catch (error) {
    log.error('Error al regenerar plantilla MEDIA_RES:', error)
    return NextResponse.json(
      { error: 'Error al regenerar plantilla', detalle: String(error) },
      { status: 500 }
    )
  }
}

/**
 * Busca un archivo de logo por nombre base (sin extensión)
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
 */
async function convertirLogoAGFA(
  rutaArchivo: string | null,
  nombreLog: string,
  maxAncho: number,
  maxAlto: number
): Promise<string> {
  try {
    if (!rutaArchivo || !fs.existsSync(rutaArchivo)) {
      log.warn(`${nombreLog} no encontrado, sin logo`)
      return ''
    }

    const image = sharp(rutaArchivo)
    const metadata = await image.metadata()
    const width = metadata.width || 0
    const height = metadata.height || 0

    if (width === 0 || height === 0) {
      log.warn(`${nombreLog} con dimensiones inválidas`)
      return ''
    }

    // Escalar proporcionalmente (no agrandar)
    const scale = Math.min(maxAncho / width, maxAlto / height, 1)
    const targetWidth = Math.round(width * scale)
    const targetHeight = Math.round(height * scale)

    log.info(`${nombreLog}: ${width}x${height} -> ${targetWidth}x${targetHeight}px`)

    // Convertir a monocromo (1 bit)
    const { data } = await image
      .resize(targetWidth, targetHeight, { fit: 'fill' })
      .greyscale()
      .threshold(128)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    // Calcular bytes por fila (8 pixels por byte, MSB = pixel izquierdo)
    const bytesPerRow = Math.ceil(targetWidth / 8)
    const totalBytes = bytesPerRow * targetHeight
    const bitmapBuffer = Buffer.alloc(totalBytes)

    for (let y = 0; y < targetHeight; y++) {
      for (let x = 0; x < targetWidth; x++) {
        const pixelIndex = (y * targetWidth + x) * 4
        const alpha = data[pixelIndex + 3]
        const grey = data[pixelIndex]

        const isBlack = alpha > 128 && grey < 128
        if (isBlack) {
          const byteIndex = y * bytesPerRow + Math.floor(x / 8)
          const bitIndex = 7 - (x % 8)
          bitmapBuffer[byteIndex] |= (1 << bitIndex)
        }
      }
    }

    const hexData = bitmapBuffer.toString('hex').toUpperCase()
    log.info(`${nombreLog} GFA: ${targetWidth}x${targetHeight}, ${bytesPerRow} bytes/row, ${totalBytes} bytes`)

    return `${totalBytes},${bytesPerRow},${targetHeight},${hexData}`
  } catch (error) {
    log.error(`Error convirtiendo ${nombreLog}:`, error)
    return ''
  }
}

/**
 * Crea la plantilla ZPL con logos GFA y variables {{DOBLE_LLAVE}}
 */
function crearTemplateZPL(gfaSolemar: string, gfaSenasa: string): string {
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
^MD15

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
