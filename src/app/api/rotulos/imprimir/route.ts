import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import net from 'net'
import { checkPermission } from '@/lib/auth-helpers'

// POST - Imprimir rótulo (ZPL, DPL o binario)
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeConfiguracion')
  if (authError) return authError
  try {
    const data = await request.json()
    const { rotuloId, datos, cantidad = 1, impresoraIp, impresoraPuerto = 9100, calor } = data

    if (!rotuloId) {
      return NextResponse.json(
        { error: 'ID de rótulo requerido' },
        { status: 400 }
      )
    }

    // Obtener el rótulo
    const rotulo = await db.rotulo.findUnique({
      where: { id: rotuloId }
    })

    if (!rotulo) {
      return NextResponse.json(
        { error: 'Rótulo no encontrado' },
        { status: 404 }
      )
    }

    if (!rotulo.activo) {
      return NextResponse.json(
        { error: 'El rótulo no está activo' },
        { status: 400 }
      )
    }

    // Resolver contenido (si es base64, decodificar)
    let contenidoBase = rotulo.contenido
    try {
      if (contenidoBase && !contenidoBase.startsWith('^') && !contenidoBase.startsWith('\x02') && !contenidoBase.startsWith('<STX>') && !contenidoBase.startsWith('n\n') && !contenidoBase.startsWith('SO')) {
        const decoded = Buffer.from(contenidoBase, 'base64').toString('latin1')
        if (decoded.startsWith('^') || decoded.startsWith('\x02') || decoded.startsWith('<STX>')) {
          contenidoBase = decoded
        }
      }
    } catch (e) {
      // No es base64 valido, usar tal cual
    }

    // Procesar el contenido según tipo de impresora (para archivos de texto)
    let contenidoProcesado = contenidoBase
    
    // Reemplazar variables con datos
    contenidoProcesado = reemplazarVariables(contenidoProcesado, datos, rotulo.tipoImpresora)

    // Agregar comandos de cantidad según tipo de impresora
    let contenidoFinal = contenidoProcesado
    if (rotulo.tipoImpresora === 'ZEBRA') {
      // ZPL: Inyectar ^MD (calor/oscuridad) si se proporciona
      if (calor !== undefined && calor !== null) {
        const calorVal = Math.max(-30, Math.min(30, Number(calor)))
        // Insertar ^MD después del ^XA inicial
        if (contenidoFinal.includes('^XA')) {
          contenidoFinal = contenidoFinal.replace('^XA', `^XA\n^MD${calorVal}`)
        } else {
          contenidoFinal = `^MD${calorVal}\n${contenidoFinal}`
        }
      }
      // ZPL: Agregar cantidad de etiquetas
      contenidoFinal = agregarCantidadZPL(contenidoFinal, cantidad)
    } else if (rotulo.tipoImpresora === 'DATAMAX' || rotulo.tipoImpresora === 'NETTIRA') {
      // DPL: Agregar cantidad de etiquetas (Nettira usa DPL)
      contenidoFinal = agregarCantidadDPL(contenidoProcesado, cantidad)
    }

    // Si se proporciona IP de impresora, enviar directamente
    if (impresoraIp) {
      try {
        await enviarAImpresora(contenidoFinal, impresoraIp, impresoraPuerto)
        return NextResponse.json({
          success: true,
          message: `Enviado a impresora ${impresoraIp}:${impresoraPuerto}`,
          tipoImpresora: rotulo.tipoImpresora
        })
      } catch (printError) {
        console.error('Error al imprimir:', printError)
        return NextResponse.json({
          success: false,
          error: 'Error al enviar a la impresora',
          details: String(printError)
        }, { status: 500 })
      }
    }

    // Si no hay impresora, devolver contenido procesado + metadata del rótulo
    return NextResponse.json({
      success: true,
      contenido: contenidoFinal,
      tipoImpresora: rotulo.tipoImpresora,
      rotulo: {
        id: rotulo.id,
        nombre: rotulo.nombre,
        codigo: rotulo.codigo,
        ancho: rotulo.ancho,
        alto: rotulo.alto,
        dpi: rotulo.dpi
      }
    })
  } catch (error) {
    console.error('Error al imprimir rótulo:', error)
    return NextResponse.json(
      { error: 'Error al imprimir rótulo' },
      { status: 500 }
    )
  }
}

// GET - Vista previa del rótulo
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeConfiguracion')
  if (authError) return authError
  try {
    const { searchParams } = new URL(request.url)
    const rotuloId = searchParams.get('rotuloId')

    if (!rotuloId) {
      return NextResponse.json(
        { error: 'ID de rótulo requerido' },
        { status: 400 }
      )
    }

    const rotulo = await db.rotulo.findUnique({
      where: { id: rotuloId }
    })

    if (!rotulo) {
      return NextResponse.json(
        { error: 'Rótulo no encontrado' },
        { status: 404 }
      )
    }

    // Generar datos de prueba
    const datosPrueba = generarDatosPrueba(rotulo.diasConsumo || 30)
    
    // Procesar contenido
    const contenidoProcesado = reemplazarVariables(rotulo.contenido, datosPrueba, rotulo.tipoImpresora)

    // Parsear variables
    let variables: Array<{ variable: string; campo: string; descripcion: string }> = []
    if (rotulo.variables) {
      try {
        variables = JSON.parse(rotulo.variables)
      } catch (e) {
        console.error('Error al parsear variables:', e)
      }
    }

    return NextResponse.json({
      contenidoOriginal: rotulo.contenido,
      contenidoProcesado,
      datosPrueba,
      variables,
      tipoImpresora: rotulo.tipoImpresora,
      rotulo: {
        id: rotulo.id,
        nombre: rotulo.nombre,
        codigo: rotulo.codigo,
        ancho: rotulo.ancho,
        alto: rotulo.alto,
        dpi: rotulo.dpi
      }
    })
  } catch (error) {
    console.error('Error al generar preview:', error)
    return NextResponse.json(
      { error: 'Error al generar preview' },
      { status: 500 }
    )
  }
}

// Función para reemplazar variables
function reemplazarVariables(contenido: string, datos: Record<string, any>, tipoImpresora: string): string {
  let resultado = contenido

  // Regex según tipo de impresora
  const regex = tipoImpresora === 'DATAMAX' || tipoImpresora === 'NETTIRA'
    ? /\{([A-Z_0-9]+)\}/g  // Datamax/Nettira: {VARIABLE}
    : /\{\{([A-Z_0-9]+)\}\}/g  // Zebra: {{VARIABLE}}

  resultado = resultado.replace(regex, (match, variable) => {
    const valor = datos[variable.toLowerCase()] ?? datos[variable] ?? ''
    return String(valor)
  })

  // Variables compuestas: se resuelven DESPUÉS del reemplazo individual
  // CODIGO_ITF = TROPA_CODIGO + NUMERO_ANIMAL + NUMERO_CARAVANA
  const tropaCodigo = datos['tropa_codigo'] || datos['TROPA_CODIGO'] || ''
  const numeroAnimal = datos['numero_animal'] || datos['NUMERO_ANIMAL'] || ''
  const numeroCaravana = datos['numero_caravana'] || datos['NUMERO_CARAVANA'] || ''
  const codigoItf = String(tropaCodigo) + String(numeroAnimal) + String(numeroCaravana)

  // Reemplazar CODIGO_ITF (formato Datamax {CODIGO_ITF} o Zebra {{CODIGO_ITF}})
  if (tipoImpresora === 'DATAMAX' || tipoImpresora === 'NETTIRA') {
    resultado = resultado.replace(/\{CODIGO_ITF\}/g, codigoItf)
  } else {
    resultado = resultado.replace(/\{\{CODIGO_ITF\}\}/g, codigoItf)
  }

  return resultado
}

// Agregar cantidad para ZPL
function agregarCantidadZPL(contenido: string, cantidad: number): string {
  // ZPL usa ^PQ para cantidad
  if (contenido.includes('^PQ')) {
    return contenido.replace(/\^PQ\d+/, `^PQ${cantidad}`)
  }
  // Agregar antes del ^XZ final
  if (contenido.includes('^XZ')) {
    return contenido.replace('^XZ', `^PQ${cantidad}\n^XZ`)
  }
  return `${contenido}\n^PQ${cantidad}\n^XZ`
}

// Agregar cantidad para DPL
function agregarCantidadDPL(contenido: string, cantidad: number): string {
  // DPL usa <STX>C para cantidad de copias
  if (contenido.includes('<STX>C')) {
    return contenido.replace(/<STX>C\d+/, `<STX>C${cantidad}`)
  }
  // Agregar al inicio
  return `<STX>C${cantidad}\n${contenido}`
}

// Enviar a impresora via socket TCP
async function enviarAImpresora(contenido: string, ip: string, puerto: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket()
    
    client.connect(puerto, ip, () => {
      client.write(contenido, 'utf8', () => {
        client.end()
        resolve()
      })
    })
    
    client.on('error', (err: Error) => {
      reject(err)
    })
    
    client.on('timeout', () => {
      client.destroy()
      reject(new Error('Timeout conectando a impresora'))
    })
    
    client.setTimeout(10000) // 10 segundos de timeout
  })
}

// Enviar buffer binario a impresora via socket TCP
async function enviarBufferAImpresora(buffer: Buffer, ip: string, puerto: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = new net.Socket()
    
    client.connect(puerto, ip, () => {
      client.write(buffer, () => {
        client.end()
        resolve()
      })
    })
    
    client.on('error', (err: Error) => {
      reject(err)
    })
    
    client.on('timeout', () => {
      client.destroy()
      reject(new Error('Timeout conectando a impresora'))
    })
    
    client.setTimeout(10000) // 10 segundos de timeout
  })
}

// Generar datos de prueba
function generarDatosPrueba(diasConsumo: number): Record<string, any> {
  const hoy = new Date()
  const fechaVenc = new Date(hoy.getTime() + diasConsumo * 24 * 60 * 60 * 1000)
  
  return {
    // Fechas
    fecha: formatearFecha(hoy),
    fecha_faena: formatearFecha(hoy),
    fecha_actual: formatearFecha(hoy),
    fecha_venc: formatearFecha(fechaVenc),
    fecha_vencimiento: formatearFecha(fechaVenc),
    
    // Tropa y animal
    tropa: 'B0001',
    tropa_codigo: 'B20260001',
    garron: '001',
    numero_garron: '001',
    correlativo: '0001',
    lote: 'L2026001',
    numero_animal: '015',
    numero: '015',
    numero_caravana: '1234567890',
    caravana: '1234567890',
    codigo_itf: 'B202600010151234567890',
    
    // Pesos
    peso: '125.50',
    peso_kg: '125.50 KG',
    peso_vivo: '450.00',
    peso_canal: '250.00',
    
    // Producto
    producto: 'MEDIA RES',
    nombre_producto: 'MEDIA RES',
    especie: 'BOVINO',
    tipo_animal: '2D - NT',
    denticion: '2',
    categoria: 'VACA',
    
    // Lado y sigla
    lado: 'I',
    lado_media: 'IZQUIERDA',
    sigla: 'A',
    sigla_media: 'A',
    
    // Establecimiento
    establecimiento: 'FRIGORÍFICO EJEMPLO S.A.',
    nombre_establecimiento: 'FRIGORÍFICO EJEMPLO S.A.',
    nro_establecimiento: '3986',
    numero_establecimiento: '3986',
    cuit_establecimiento: '30-12345678-9',
    
    // Usuario de faena
    usuario_faena: 'USUARIO FAENA EJEMPLO',
    nombre_usuario_faena: 'USUARIO FAENA EJEMPLO',
    cuit_usuario: '20-87654321-0',
    matricula_tipificador: 'TIP-001',
    cuit_usuario_faena: '20-87654321-0',
    matricula: 'MAT-001',
    matricula_usuario_faena: 'MAT-001',
    
    // Productor
    productor: 'PRODUCTOR EJEMPLO',
    nombre_productor: 'PRODUCTOR EJEMPLO',
    cuit_productor: '20-12345678-9',
    
    // Oficiales
    senasa: '3986',
    nro_senasa: '3986',
    habilitacion: 'HAB-001',
    
    // Código de barras
    codigo_barras: '123456789012',
    barras: '123456789012',
    
    // Conservación
    dias_consumo: String(diasConsumo),
    dia_consumo: String(diasConsumo),
    temperatura: '5°C',
    temp_max: '5°C',
    temperatura_max: '5.0',
    
    // Transporte
    transportista: 'TRANSPORTE EJEMPLO',
    patente: 'AB123CD',
    
    // Documentos
    dte: 'DTE-001',
    guia: 'G-001',
    remito: 'R-001',
    
    // Otros
    observaciones: 'Sin observaciones',
    destino: 'MERCADO INTERNO',
    procedencia: 'CAMPO EJEMPLO'
  }
}

function formatearFecha(fecha: Date): string {
  const dia = String(fecha.getDate()).padStart(2, '0')
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const anio = fecha.getFullYear()
  return `${dia}/${mes}/${anio}`
}
