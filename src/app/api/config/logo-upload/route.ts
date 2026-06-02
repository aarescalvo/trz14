import { NextRequest, NextResponse } from 'next/server'
import { checkPermission } from '@/lib/auth-helpers'
import fs from 'fs'
import path from 'path'

const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg']
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

// POST - Subir logo
export async function POST(request: NextRequest) {
  const authError = await checkPermission(request, 'puedeConfiguracion')
  if (authError) return authError

  try {
    const formData = await request.formData()
    const file = formData.get('logo') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      )
    }

    // Validate file type
    const fileName = file.name.toLowerCase()
    const ext = path.extname(fileName)
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { success: false, error: 'Formato de archivo no válido. Usá PNG, JPG o SVG.' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'El archivo es demasiado grande. Máximo 5MB.' },
        { status: 400 }
      )
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Determine output filename - always save as logo.png for simplicity
    // If SVG, keep as logo.svg; otherwise logo.png
    const outputFileName = ext === '.svg' ? 'logo.svg' : 'logo.png'
    const outputPath = path.join(process.cwd(), 'public', outputFileName)

    fs.writeFileSync(outputPath, buffer)

    return NextResponse.json({
      success: true,
      message: 'Logo subido correctamente',
      filename: outputFileName
    })
  } catch (error) {
    console.error('Error al subir logo:', error)
    return NextResponse.json(
      { success: false, error: 'Error al subir el logo' },
      { status: 500 }
    )
  }
}
