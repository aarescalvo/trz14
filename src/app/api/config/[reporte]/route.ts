import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-helpers'
import fs from 'fs'
import path from 'path'

const ALLOWED_REPORTES = ['rinde-tropa', 'planilla-01', 'stock-corrales']

function getConfigPath(reporte: string): string {
  return path.join(process.cwd(), `src/config/reporte-${reporte}.json`)
}

// GET - Leer configuración de formato de reporte
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reporte: string }> }
) {
  const authError = await checkPermission(request, 'puedeConfiguracion')
  if (authError) return authError

  const { reporte } = await params

  if (!ALLOWED_REPORTES.includes(reporte)) {
    return NextResponse.json(
      { success: false, error: 'Reporte no válido' },
      { status: 400 }
    )
  }

  try {
    const configPath = getConfigPath(reporte)
    const raw = fs.readFileSync(configPath, 'utf-8')
    const config = JSON.parse(raw)
    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error(`Error al leer configuración de reporte-${reporte}:`, error)
    return NextResponse.json(
      { success: false, error: 'Error al leer configuración' },
      { status: 500 }
    )
  }
}

// PUT - Guardar configuración de formato de reporte
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ reporte: string }> }
) {
  const authError = await checkPermission(request, 'puedeConfiguracion')
  if (authError) return authError

  const { reporte } = await params

  if (!ALLOWED_REPORTES.includes(reporte)) {
    return NextResponse.json(
      { success: false, error: 'Reporte no válido' },
      { status: 400 }
    )
  }

  try {
    const body = await request.json()

    // Validar que tiene la estructura básica
    if (!body.excel || !body.pdf) {
      return NextResponse.json(
        { success: false, error: 'Estructura de configuración inválida' },
        { status: 400 }
      )
    }

    const configPath = getConfigPath(reporte)
    fs.writeFileSync(configPath, JSON.stringify(body, null, 2), 'utf-8')

    return NextResponse.json({ success: true, message: 'Configuración guardada correctamente' })
  } catch (error) {
    console.error(`Error al guardar configuración de reporte-${reporte}:`, error)
    return NextResponse.json(
      { success: false, error: 'Error al guardar configuración' },
      { status: 500 }
    )
  }
}
