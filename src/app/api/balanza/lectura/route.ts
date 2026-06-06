import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { checkAnyPermission } from '@/lib/auth-helpers'

// Permisos válidos para leer la balanza (usada por múltiples módulos operativos)
const BALANZA_PERMISOS = [
  'puedePesajeIndividual',
  'puedeRomaneo',
  'puedeCuarteo',
  'puedeEmpaque',
  'puedeDesposte',
] as const

// Simulador de peso para testing
function simularPeso() {
  const peso = 400 + Math.random() * 200
  const estable = Math.random() > 0.3
  return {
    peso: Math.round(peso * 10) / 10,
    unidad: 'kg',
    estable,
    timestamp: new Date().toISOString(),
    simulado: true
  }
}

// ============ PARSERS POR PROTOCOLO ============

function parseGenerico(raw: string): number | null {
  const match = raw.match(/[\-+]?\d*\.?\d+/)
  if (!match) return null
  return parseFloat(match[0])
}

function parseToledo(raw: string): number | null {
  const match = raw.match(/[-+]?\s*\d+\.?\d*\s*kg/i)
  if (match) return parseFloat(match[0].replace(/[a-zA-Z\s]/g, ''))
  const numMatch = raw.match(/[-+]?\d+\.?\d+/)
  return numMatch ? parseFloat(numMatch[0]) : null
}

function parseMettler(raw: string): number | null {
  const cleaned = raw.replace(/[NUS\s]/gi, '')
  const match = cleaned.match(/[-+]?\d+\.?\d+/)
  return match ? parseFloat(match[0]) : null
}

function parseOhaus(raw: string): number | null {
  const match = raw.match(/[-+]?\d+\.?\d+/)
  return match ? parseFloat(match[0]) : null
}

function parseDigi(raw: string): number | null {
  const match = raw.match(/[-+]?\d+\.?\d+/)
  return match ? parseFloat(match[0]) : null
}

function parseAdam(raw: string): number | null {
  const match = raw.match(/[-+]?\d+\.?\d+/)
  return match ? parseFloat(match[0]) : null
}

function parseCustom(raw: string, formato: string | null): number | null {
  if (!formato) return parseGenerico(raw)
  try {
    const regex = new RegExp(formato)
    const match = raw.match(regex)
    if (match && match[1]) return parseFloat(match[1])
    return parseGenerico(raw)
  } catch {
    return parseGenerico(raw)
  }
}

function parsearPeso(raw: string, protocolo: string, formatoRespuesta: string | null): number | null {
  const parsers: Record<string, (r: string) => number | null> = {
    GENERICO: parseGenerico,
    TOLEDO: parseToledo,
    METTLER: parseMettler,
    OHAUS: parseOhaus,
    DIGI: parseDigi,
    ADAM: parseAdam,
    CUSTOM: (r) => parseCustom(r, formatoRespuesta),
  }
  const parser = parsers[protocolo] || parseGenerico
  return parser(raw)
}

// ============ LECTURA TCP (import dinámico de net) ============

async function leerTCP(ip: string, puerto: number, comando: string | null, timeoutMs: number = 3000): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const net = await import('net')

  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    let buffer = Buffer.alloc(0)
    let settled = false

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        socket.destroy()
        reject(new Error('Timeout de lectura'))
      }
    }, timeoutMs)

    socket.connect(puerto, ip, () => {
      if (comando) {
        socket.write(comando)
      }
    })

    socket.on('data', (data: Buffer) => {
      buffer = Buffer.concat([buffer, data])
    })

    socket.on('end', () => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        socket.destroy()
        resolve(buffer.toString('latin1'))
      }
    })

    socket.on('error', (err: Error) => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        socket.destroy()
        reject(err)
      }
    })

    // Si no se envía comando, cerrar después de recibir datos
    if (!comando) {
      socket.once('data', () => {
        setTimeout(() => {
          if (!settled) {
            settled = true
            clearTimeout(timer)
            socket.destroy()
            resolve(buffer.toString('latin1'))
          }
        }, 400)
      })
    }
  })
}

// GET - Lectura de peso en tiempo real
export async function GET(request: NextRequest) {
  const authError = await checkAnyPermission(request, [...BALANZA_PERMISOS])
  if (authError) return authError
  try {
    const { searchParams } = new URL(request.url)
    const simular = searchParams.get('simular') === 'true'

    if (simular) {
      return NextResponse.json({
        success: true,
        data: simularPeso()
      })
    }

    // Obtener configuración de balanza desde tabla Balanza
    const balanza = await db.balanza.findFirst({
      where: { activa: true }
    })

    if (!balanza) {
      return NextResponse.json({
        success: false,
        error: 'No hay balanza configurada',
        data: simularPeso()
      })
    }

    // Si es SIMULADA, devolver peso simulado
    if (balanza.tipoConexion === 'SIMULADA') {
      return NextResponse.json({
        success: true,
        data: simularPeso()
      })
    }

    // Si es TCP, intentar lectura real
    if (balanza.tipoConexion === 'TCP' && balanza.ip && balanza.puertoTcp) {
      try {
        const raw = await leerTCP(
          balanza.ip,
          balanza.puertoTcp,
          balanza.comandoPeso || null,
          3000
        )

        const peso = parsearPeso(
          raw,
          balanza.protocolo,
          balanza.formatoRespuesta
        )

        if (peso !== null && peso >= 0) {
          return NextResponse.json({
            success: true,
            data: {
              peso: Math.round(peso * 100) / 100,
              unidad: balanza.unidad || 'kg',
              estable: true,
              timestamp: new Date().toISOString(),
              simulado: false,
              raw: raw.trim(),
              configuracion: {
                ip: balanza.ip,
                puerto: balanza.puertoTcp,
                protocolo: balanza.protocolo
              }
            }
          })
        } else {
          return NextResponse.json({
            success: false,
            error: 'No se pudo interpretar el peso de la balanza',
            raw: raw.trim()
          })
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return NextResponse.json({
          success: false,
          error: `Error TCP: ${msg}`,
          data: simularPeso()
        })
      }
    }

    // Si es SERIAL, no disponible en Next.js serverless
    if (balanza.tipoConexion === 'SERIAL') {
      return NextResponse.json({
        success: false,
        error: 'Balanza serie no disponible (requiere instalación local)',
        data: simularPeso()
      })
    }

    // Fallback: simulación
    return NextResponse.json({
      success: true,
      data: simularPeso()
    })
  } catch (error) {
    console.error('Error reading balanza:', error)
    return NextResponse.json({
      success: false,
      error: 'Error de comunicación con balanza',
      data: simularPeso()
    }, { status: 500 })
  }
}
