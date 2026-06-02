/**
 * Genera Excel template para recopilar datos de Pesaje de Camión
 * Crea: /home/z/my-project/download/PLANTILLA_PESAJE_CAMION.xlsx
 * 
 * Ejecutar: npx tsx prisma/generar-plantilla-pesaje.ts
 */
import * as XLSX from 'xlsx'
import * as path from 'path'

function main() {
  console.log('=== GENERANDO PLANTILLA PESAJE CAMIÓN ===\n')

  // Obtener lista de tropas desde argumento o usar default 1-203
  const maxTropa = parseInt(process.argv[2] || '203')
  const minTropa = parseInt(process.argv[3] || '1')

  // Estilos
  const headerStyle = { fill: { fgColor: { rgb: '1E40AF' } }, font: { bold: true, color: { rgb: 'FFFFFF' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } }
  const subHeaderStyle = { fill: { fgColor: { rgb: 'DBEAFE' } }, font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } }
  const exampleStyle = { fill: { fgColor: { rgb: 'FEF9C3' } } }

  // Crear hoja
  const ws: XLSX.WorkSheet = {}

  // Título
  XLSX.utils.sheet_add_aoa(ws, [
    ['PLANTILLA DE PESAJE DE CAMIÓN - CICLO I'],
    ['Completar los datos faltantes por cada tropa recibida. Los campos con * son obligatorios.'],
    [''],
  ], { origin: 'A1' })

  // Headers
  const headers = [
    { col: 'A', label: 'N° Tropa*', width: 10 },
    { col: 'B', label: 'Fecha Ingreso', width: 14 },
    { col: 'C', label: 'Hora Ingreso', width: 12 },
    { col: 'D', label: 'Patente Chasis*', width: 14 },
    { col: 'E', label: 'Patente Acoplado', width: 14 },
    { col: 'F', label: 'Chofer Nombre*', width: 22 },
    { col: 'G', label: 'Chofer DNI', width: 14 },
    { col: 'H', label: 'Transportista', width: 22 },
    { col: 'I', label: 'N° Ticket Balanza*', width: 14 },
    { col: 'J', label: 'Peso Bruto (kg)*', width: 14 },
    { col: 'K', label: 'Peso Tara (kg)*', width: 14 },
    { col: 'L', label: 'Peso Neto (kg)', width: 14 },
    { col: 'M', label: 'Productor', width: 22 },
    { col: 'N', label: 'N° DTE', width: 16 },
    { col: 'O', label: 'N° Guía', width: 14 },
    { col: 'P', label: 'Observaciones', width: 24 },
  ]

  // Sub-header con descripciones
  const subHeaders = [
    'Ej: 1', 'DD/MM/AAAA', 'HH:MM', 'ABC 123 o AB 123 CD',
    'Igual formato', 'Nombre completo', 'Sin puntos',
    'Nombre empresa', 'N° ticket balanza',
    'Camión + hacienda', 'Camión vacío', '= J - K (auto)',
    'Nombre productor', 'Ej: 30942026-8', 'N° guía SENASA',
    'Notas adicionales'
  ]

  // Ejemplo de fila
  const exampleRow = [
    1, '10/01/2026', '06:30', 'AB 123 CD', 'CD 456 EF',
    'Juan Pérez', '12345678', 'Transportes XYZ SRL',
    '1234', 25000, 12000, '=J5-K5', 'Establecimiento Los Pinos',
    '30942026-8', 'G-001234', 'Sin novedad'
  ]

  // Escribir headers (fila 4)
  const headerRow = headers.map(h => h.label)
  const headerAoA: (string | number)[][] = [
    headerRow,
    subHeaders,
    exampleRow,
  ]

  XLSX.utils.sheet_add_aoa(ws, headerAoA, { origin: 'A4' })

  // Crear filas de tropas (desde fila 7 en adelante)
  const dataRows: (string | number)[][] = []
  for (let i = minTropa; i <= maxTropa; i++) {
    dataRows.push([i, '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''])
  }

  XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: 'A7' })

  // Agregar fórmula de peso neto para todas las filas de datos
  const lastDataRow = 6 + (maxTropa - minTropa + 1)
  for (let r = 7; r <= lastDataRow; r++) {
    const netoAddr = XLSX.utils.encode_cell({ r: r - 1, c: 11 }) // Columna L (index 11)
    ws[netoAddr] = { f: `J${r}-K${r}`, t: 'n' }
  }

  // Establecer anchos de columna
  ws['!cols'] = headers.map(h => ({ wch: h.width }))

  // Crear workbook y guardar
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'PESAJE CAMION')

  // Hoja 2: RESUMEN con tropas que ya tienen datos
  const ws2: XLSX.WorkSheet = {}
  XLSX.utils.sheet_add_aoa(ws2, [
    ['INSTRUCCIONES'],
    [''],
    ['1. Los campos con * son obligatorios para el pesaje de camión.'],
    ['2. El Peso Neto se calcula automáticamente (Peso Bruto - Peso Tara).'],
    ['3. Complete una fila por cada tropa recibida.'],
    ['4. Si una tropa no tiene datos de pesaje, deje la fila vacía (excepto N° Tropa).'],
    ['5. Las patentes se escriben sin espacios ni puntos (ej: AB123CD).'],
    ['6. La fecha se ingresa como DD/MM/AAAA.'],
    [''],
    ['CAMPOS'],
    ['- N° Tropa: Número de tropa en el sistema (1 a 203)'],
    ['- Fecha Ingreso: Fecha en que llegó el camión al frigorífico'],
    ['- Hora Ingreso: Hora de llegada del camión'],
    ['- Patente Chasis: Patente del camión tractor'],
    ['- Patente Acoplado: Patente del acoplado/jaula (si aplica)'],
    ['- Chofer: Nombre completo del conductor'],
    ['- Chofer DNI: Documento del chofer (sin puntos)'],
    ['- Transportista: Empresa de transporte'],
    ['- N° Ticket: Número de ticket de balanza'],
    ['- Peso Bruto: Peso del camión con hacienda'],
    ['- Peso Tara: Peso del camión vacío'],
    ['- Peso Neto: Se calcula automáticamente'],
    ['- Productor: Nombre del productor/establecimiento'],
    ['- N° DTE: Documento de tránsito electrónica'],
    ['- N° Guía: N° de guía SENASA'],
    ['- Observaciones: Notas adicionales'],
  ])
  ws2['!cols'] = [{ wch: 80 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'INSTRUCCIONES')

  // Guardar
  const outputPath = path.join(__dirname, '..', 'download', 'PLANTILLA_PESAJE_CAMION.xlsx')
  XLSX.writeFile(wb, outputPath)
  console.log(`Archivo generado: ${outputPath}`)
  console.log(`Tropas incluidas: ${minTropa} a ${maxTropa} (${maxTropa - minTropa + 1} filas)`)
}

main()
