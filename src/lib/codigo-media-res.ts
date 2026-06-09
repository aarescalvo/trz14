/**
 * Generación unificada de códigos para MediaRes.
 *
 * Formato: ESPECIE AÑO TROPA_NUM-GARRON-LADO-HASH
 * Ejemplo: B 2026 0146-18-D-MPMO1Q3Y
 *
 * Donde:
 *   ESPECIE  = 'B' (Bovino) o 'E' (Equino)
 *   AÑO     = 4 dígitos
 *   TROPA_NUM = número de tropa extraído del tropaCodigo (ej: "B 2026 0146" → 0146)
 *   GARRON  = número de garrón
 *   LADO    = 'I' (Izquierda) o 'D' (Derecha)
 *   HASH    = 8 caracteres alfanuméricos aleatorios para unicidad
 */

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function randomHash(length: number = 8): string {
  const array = new Uint8Array(length)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array)
  } else {
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * CHARS.length)
    }
  }
  return Array.from(array, b => CHARS[b % CHARS.length]).join('')
}

/**
 * Extrae el número de tropa del tropaCodigo.
 * Soporta formatos como:
 *   "B 2026 0146" → 0146
 *   "E 2026 0023" → 0023
 *   "T146"        → 0146
 *   "146"         → 0146
 *   null/undefined → "0000"
 */
function extraerNumeroTropa(tropaCodigo: string | null | undefined): string {
  if (!tropaCodigo) return '0000'

  // Formato "B 2026 0146" o "E 2026 0023"
  const matchEspacio = tropaCodigo.match(/^[BE]\s+\d{4}\s+(\d+)$/)
  if (matchEspacio) {
    return matchEspacio[1].padStart(4, '0')
  }

  // Formato "T146" o "t146"
  const matchT = tropaCodigo.match(/^[Tt](\d+)$/)
  if (matchT) {
    return matchT[1].padStart(4, '0')
  }

  // Solo números
  const matchNum = tropaCodigo.match(/^(\d+)$/)
  if (matchNum) {
    return matchNum[1].padStart(4, '0')
  }

  // Fallback: tomar el último segmento numérico
  const partes = tropaCodigo.trim().split(/[\s-]+/)
  for (let i = partes.length - 1; i >= 0; i--) {
    const m = partes[i].match(/^(\d+)$/)
    if (m) return m[1].padStart(4, '0')
  }

  return '0000'
}

/**
 * Determina la letra de especie.
 * Prioridad: 1) especie explícita, 2) primera letra del tropaCodigo, 3) default 'B'
 */
function especieLetra(especie: string | null | undefined, tropaCodigo?: string | null): string {
  if (especie) {
    const upper = especie.toUpperCase()
    if (upper.startsWith('E')) return 'E'
    return 'B'
  }
  // Inferir desde el tropaCodigo: "E 2026 0023" → 'E', "B 2026 0146" → 'B'
  if (tropaCodigo) {
    const first = tropaCodigo.trim().charAt(0).toUpperCase()
    if (first === 'E') return 'E'
  }
  return 'B'
}

export interface GenerarCodigoMediaResParams {
  tropaCodigo: string | null | undefined
  especie?: string | null
  garron: number
  lado: 'IZQUIERDA' | 'DERECHA'
}

/**
 * Genera el código unificado para una MediaRes.
 *
 * Formato: B 2026 0146-18-D-MPMO1Q3Y
 *
 * @param params
 * @returns código de la media res
 */
export function generarCodigoMediaRes(params: GenerarCodigoMediaResParams): string {
  const { tropaCodigo, especie, garron, lado } = params

  const letra = especieLetra(especie, tropaCodigo)
  const tropaNum = extraerNumeroTropa(tropaCodigo)
  const año = new Date().getFullYear()
  const ladoChar = lado === 'IZQUIERDA' ? 'I' : 'D'
  const hash = randomHash(8)

  return `${letra} ${año} ${tropaNum}-${garron}-${ladoChar}-${hash}`
}