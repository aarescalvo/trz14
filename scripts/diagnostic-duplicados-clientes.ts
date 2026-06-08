/**
 * DIAGNÓSTICO DE DUPLICADOS EN CLIENTES (Productores / Usuarios de Faena)
 *
 * Detecta:
 * 1. Nombres idénticos con CUITs diferentes
 * 2. Nombres similares (variaciones de puntuación, abreviaturas, etc.)
 * 3. Mismos CUIT con nombres diferentes
 * 4. Clientes sin CUIT que podrían ser duplicados
 *
 * Genera un JSON con los grupos de duplicados sugeridos para revisión.
 *
 * Uso:
 *   bun scripts/diagnostic-duplicados-clientes.ts
 *   bun scripts/diagnostic-duplicados-clientes.ts --json       # Genera archivo JSON para el script de merge
 */
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const db = new PrismaClient()

// ─── Utilidades de normalización de texto ───
function normalizar(texto: string): string {
  return texto
    .toUpperCase()
    .trim()
    // Quitar acentos
    .replace(/[ÁÀÄÂ]/g, 'A')
    .replace(/[ÉÈËÊ]/g, 'E')
    .replace(/[ÍÌÏÎ]/g, 'I')
    .replace(/[ÓÒÖÔ]/g, 'O')
    .replace(/[ÚÙÜÛ]/g, 'U')
    // Quitar puntuación y espacios extra
    .replace(/[^A-Z0-9Ñ]/g, '')
}

function normalizarSuave(texto: string): string {
  return texto
    .toUpperCase()
    .trim()
    .replace(/[ÁÀÄÂ]/g, 'A')
    .replace(/[ÉÈËÊ]/g, 'E')
    .replace(/[ÍÌÏÎ]/g, 'I')
    .replace(/[ÓÒÖÔ]/g, 'O')
    .replace(/[ÚÙÜÛ]/g, 'U')
    // Conservar puntos y comas pero normalizar
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
}

// Similaridad entre dos textos (0 a 1)
function similaridad(a: string, b: string): number {
  const na = normalizar(a)
  const nb = normalizar(b)
  if (na === nb) return 1.0
  if (na.includes(nb) || nb.includes(na)) return 0.95

  // Longest common subsequence ratio
  const lenA = na.length
  const lenB = nb.length
  if (lenA === 0 || lenB === 0) return 0

  const dp: number[][] = Array(lenA + 1).fill(null).map(() => Array(lenB + 1).fill(0))
  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      dp[i][j] = na[i-1] === nb[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1])
    }
  }
  return dp[lenA][lenB] / Math.max(lenA, lenB)
}

interface ClienteRow {
  id: string
  nombre: string
  cuit: string | null
  tipo: string
  esProductor: boolean
  esUsuarioFaena: boolean
  activo: boolean
  nTropasProductor: number
  nTropasUsuarioFaena: number
}

interface GrupoDuplicado {
  tipo: 'CUIT_DIFERENTE' | 'NOMBRE_SIMILAR' | 'CUIT_IGUAL_NOMBRE_DIFERENTE'
  motivo: string
  clientes: ClienteRow[]
  sugerencia: string
  /** IDs a conservar (el principal). Si vacío, requiere decisión manual. */
  conservar?: string[]
  /** IDs a eliminar/mergear */
  eliminar?: string[]
}

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  DIAGNÓSTICO DE DUPLICADOS EN CLIENTES')
  console.log('═══════════════════════════════════════════════════\n')

  const args = process.argv.slice(2)
  const outputJson = args.includes('--json')

  // ─── 1. Cargar todos los clientes con conteo de relaciones ───
  console.log('── Cargando clientes... ──')
  const clientes = await db.cliente.findMany({
    orderBy: { nombre: 'asc' }
  })

  // Conteo de tropas por cliente
  const tropas = await db.tropa.findMany({
    select: { productorId: true, usuarioFaenaId: true }
  })
  const countProductor = new Map<string, number>()
  const countUsuarioFaena = new Map<string, number>()
  for (const t of tropas) {
    if (t.productorId) countProductor.set(t.productorId, (countProductor.get(t.productorId) || 0) + 1)
    if (t.usuarioFaenaId) countUsuarioFaena.set(t.usuarioFaenaId, (countUsuarioFaena.get(t.usuarioFaenaId) || 0) + 1)
  }

  const rows: ClienteRow[] = clientes.map(c => ({
    id: c.id,
    nombre: c.nombre,
    cuit: c.cuit,
    tipo: c.esProductor && c.esUsuarioFaena ? 'AMBOS' : c.esProductor ? 'PRODUCTOR' : c.esUsuarioFaena ? 'USUARIO_FAENA' : 'SIN_TIPO',
    esProductor: c.esProductor,
    esUsuarioFaena: c.esUsuarioFaena,
    activo: c.activo,
    nTropasProductor: countProductor.get(c.id) || 0,
    nTropasUsuarioFaena: countUsuarioFaena.get(c.id) || 0,
  }))

  console.log(`Total clientes: ${clientes.length}`)
  console.log(`  Productores: ${rows.filter(r => r.esProductor).length}`)
  console.log(`  Usuarios Faena: ${rows.filter(r => r.esUsuarioFaena).length}`)
  console.log(`  Ambos: ${rows.filter(r => r.esProductor && r.esUsuarioFaena).length}`)
  console.log(`  Sin tipo: ${rows.filter(r => !r.esProductor && !r.esUsuarioFaena).length}`)
  console.log(`  Con CUIT: ${rows.filter(r => r.cuit).length}`)
  console.log(`  Sin CUIT: ${rows.filter(r => !r.cuit).length}`)

  // ─── 2. Detectar duplicados ───
  const grupos: GrupoDuplicado[] = []
  const yaAgrupados = new Set<string>()

  // 2A. Nombres normalizados idénticos (CUIT diferente)
  console.log('\n── Buscando nombres idénticos con CUIT diferente... ──')
  const porNorm = new Map<string, ClienteRow[]>()
  for (const r of rows) {
    const key = normalizar(r.nombre)
    if (!porNorm.has(key)) porNorm.set(key, [])
    porNorm.get(key)!.push(r)
  }

  for (const [, grupo] of porNorm) {
    if (grupo.length < 2) continue
    const conCuit = grupo.filter(r => r.cuit)
    const cuits = new Set(conCuit.map(r => r.cuit))
    if (cuits.size > 1 || (cuits.size === 1 && conCuit.length < grupo.length)) {
      const activos = grupo.filter(r => r.activo)
      const inactivos = grupo.filter(r => !r.activo)
      const conMasTropas = [...grupo].sort((a, b) =>
        (b.nTropasProductor + b.nTropasUsuarioFaena) - (a.nTropasProductor + a.nTropasUsuarioFaena)
      )[0]

      grupos.push({
        tipo: 'CUIT_DIFERENTE',
        motivo: `Mismo nombre normalizado: "${normalizar(grupo[0].nombre)}" | CUITs: [${grupo.map(r => r.cuit || 'SIN CUIT').join(', ')}]`,
        clientes: grupo,
        sugerencia: activos.length > 0
          ? `Conservar el activo con más tropas (${conMasTropas.nombre}, ${conMasTropas.cuit || 'sin CUIT'}).`
          : `Requiere decisión manual.`,
        conservar: activos.length > 0 ? [conMasTropas.id] : undefined,
        eliminar: activos.length > 0 ? grupo.filter(r => r.id !== conMasTropas.id).map(r => r.id) : undefined,
      })
      grupo.forEach(r => yaAgrupados.add(r.id))
    }
  }

  // 2B. Nombres similares (LCS ratio >= 0.8) pero no idénticos normalizados
  console.log('── Buscando nombres similares... ──')
  const umbrales: [number, string][] = [
    [0.90, 'ALTA'],
    [0.80, 'MEDIA'],
  ]

  for (const [umbral, nivel] of umbrales) {
    for (let i = 0; i < rows.length; i++) {
      if (yaAgrupados.has(rows[i].id)) continue
      for (let j = i + 1; j < rows.length; j++) {
        if (yaAgrupados.has(rows[j].id)) continue

        // Solo comparar si al menos uno es productor o usuario faena
        if (!rows[i].esProductor && !rows[i].esUsuarioFaena && !rows[j].esProductor && !rows[j].esUsuarioFaena) continue

        const sim = similaridad(rows[i].nombre, rows[j].nombre)
        if (sim >= umbral) {
          // Verificar si ya existe un grupo que contenga alguno
          let grupoExistente = grupos.find(g =>
            g.clientes.some(c => c.id === rows[i].id || c.id === rows[j].id)
          )
          if (grupoExistente) {
            // Agregar al grupo existente si no está
            if (!grupoExistente.clientes.some(c => c.id === rows[j].id)) {
              grupoExistente.clientes.push(rows[j])
            }
          } else {
            const conMasTropas = [rows[i], rows[j]].sort((a, b) =>
              (b.nTropasProductor + b.nTropasUsuarioFaena) - (a.nTropasProductor + a.nTropasUsuarioFaena)
            )[0]

            grupos.push({
              tipo: 'NOMBRE_SIMILAR',
              motivo: `Similitud ${Math.round(sim * 100)}% (${nivel}): "${rows[i].nombre}" ≈ "${rows[j].nombre}"`,
              clientes: [rows[i], rows[j]],
              sugerencia: `Requiere revisión manual. Posible merge.`,
            })
          }
        }
      }
    }
  }

  // 2C. Mismos CUIT con nombres diferentes
  console.log('── Buscando CUITs duplicados con nombres diferentes... ──')
  const porCuit = new Map<string, ClienteRow[]>()
  for (const r of rows) {
    if (!r.cuit) continue
    if (!porCuit.has(r.cuit)) porCuit.set(r.cuit, [])
    porCuit.get(r.cuit)!.push(r)
  }

  for (const [cuit, grupo] of porCuit) {
    if (grupo.length < 2) continue
    const nombresNorm = new Set(grupo.map(r => normalizar(r.nombre)))
    if (nombresNorm.size > 1) {
      // Nombres realmente diferentes con mismo CUIT
      const conMasTropas = [...grupo].sort((a, b) =>
        (b.nTropasProductor + b.nTropasUsuarioFaena) - (a.nTropasProductor + a.nTropasUsuarioFaena)
      )[0]

      grupos.push({
        tipo: 'CUIT_IGUAL_NOMBRE_DIFERENTE',
        motivo: `Mismo CUIT ${cuit}: nombres diferentes [${grupo.map(r => `"${r.nombre}"`).join(', ')}]`,
        clientes: grupo,
        sugerencia: `ERROR probable. Verificar cuál nombre es correcto.`,
      })
      grupo.forEach(r => yaAgrupados.add(r.id))
    }
  }

  // ─── 3. Mostrar resultados ───
  const grupoCuit = grupos.filter(g => g.tipo === 'CUIT_DIFERENTE')
  const grupoSimilar = grupos.filter(g => g.tipo === 'NOMBRE_SIMILAR')
  const grupoCuitNombre = grupos.filter(g => g.tipo === 'CUIT_IGUAL_NOMBRE_DIFERENTE')

  console.log('\n═══════════════════════════════════════════════════')
  console.log(`  RESULTADOS: ${grupos.length} grupos de duplicados`)
  console.log('═══════════════════════════════════════════════════')
  console.log(`  Nombres idénticos con CUIT diferente: ${grupoCuit.length}`)
  console.log(`  Nombres similares: ${grupoSimilar.length}`)
  console.log(`  Mismo CUIT nombre diferente: ${grupoCuitNombre.length}`)

  // Mostrar cada grupo
  for (const g of grupos) {
    console.log(`\n${'─'.repeat(60)}`)
    console.log(`[${g.tipo}] ${g.motivo}`)
    console.log(`Sugerencia: ${g.sugerencia}`)
    console.log('Registros:')
    for (const c of g.clientes) {
      const tropas = c.nTropasProductor + c.nTropasUsuarioFaena
      console.log(
        `  ${c.activo ? '✅' : '⬜'} ${c.nombre} | CUIT: ${c.cuit || '-'} | ` +
        `Tipo: ${c.tipo} | Tropas: ${tropas} (P:${c.nTropasProductor} UF:${c.nTropasUsuarioFaena}) | ` +
        `ID: ${c.id.slice(0, 8)}...`
      )
    }
  }

  // ─── 4. Clientes que NO son duplicados pero podrían revisarse ───
  console.log(`\n${'─'.repeat(60)}`)
  console.log('LISTADO COMPLETO DE CLIENTES (ordenado por nombre):')
  console.log(`${'─'.repeat(60)}`)
  for (const r of rows) {
    const marker = r.activo ? '✅' : '⬜'
    const tropas = r.nTropasProductor + r.nTropasUsuarioFaena
    const dup = yaAgrupados.has(r.id) ? ' ⚠️ DUP' : ''
    console.log(
      `  ${marker} ${r.nombre.padEnd(45)} | CUIT: ${(r.cuit || '-').padEnd(15)} | ` +
      `${r.tipo.padEnd(15)} | Tropas:${String(tropas).padStart(3)}${dup}`
    )
  }

  // ─── 5. Generar JSON para script de merge ───
  if (outputJson) {
    const outputPath = path.join(__dirname, 'duplicados-clientes-sugerencia.json')
    const jsonData = {
      generado: new Date().toISOString(),
      totalClientes: rows.length,
      totalGrupos: grupos.length,
      grupos: grupos.map(g => ({
        tipo: g.tipo,
        motivo: g.motivo,
        sugerencia: g.sugerencia,
        conservar: g.conservar || [],
        eliminar: g.eliminar || [],
        clientes: g.clientes.map(c => ({
          id: c.id,
          nombre: c.nombre,
          cuit: c.cuit,
          tipo: c.tipo,
          activo: c.activo,
          nTropasProductor: c.nTropasProductor,
          nTropasUsuarioFaena: c.nTropasUsuarioFaena,
        })),
      })),
    }
    fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2))
    console.log(`\n📄 JSON de sugerencias generado: ${outputPath}`)
    console.log('   Editá este archivo para confirmar/desmentir las sugerencias,')
    console.log('   luego ejecutá: bun scripts/unificar-clientes.ts')
  }

  console.log(`\n═══════════════════════════════════════════════════`)
  console.log(`  RESUMEN: ${grupos.length} grupos encontrados`)
  if (!outputJson) {
    console.log('  💡 Ejecutá con --json para generar archivo de merge:')
    console.log('     bun scripts/diagnostic-duplicados-clientes.ts --json')
  }
  console.log('═══════════════════════════════════════════════════')
}

main()
  .catch(err => {
    console.error('❌ Error fatal:', err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
