import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-helpers'
import fs from 'fs'
import path from 'path'

const CONFIG_PATH = path.join(process.cwd(), 'src/config/reporte-rinde-tropa.json')

// GET - Leer configuración de formato de reportes
export async function GET(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeConfiguracion')
  if (authError) return authError

  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
    const config = JSON.parse(raw)
    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error('Error al leer configuración de reportes:', error)
    return NextResponse.json(
      { success: false, error: 'Error al leer configuración' },
      { status: 500 }
    )
  }
}

// PUT - Guardar configuración de formato de reportes
export async function PUT(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeConfiguracion')
  if (authError) return authError

  try {
    const body = await request.json()

    // Validar que tiene la estructura básica
    if (!body.excel || !body.pdf) {
      return NextResponse.json(
        { success: false, error: 'Estructura de configuración inválida' },
        { status: 400 }
      )
    }

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(body, null, 2), 'utf-8')

    return NextResponse.json({ success: true, message: 'Configuración guardada correctamente' })
  } catch (error) {
    console.error('Error al guardar configuración de reportes:', error)
    return NextResponse.json(
      { success: false, error: 'Error al guardar configuración' },
      { status: 500 }
    )
  }
}
