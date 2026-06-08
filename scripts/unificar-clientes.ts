/**
 * UNIFICACIÓN DE CLIENTES DUPLICADOS
 *
 * Lee el archivo 'duplicados-clientes-sugerencia.json' (generado por el script
 * de diagnóstico) y ejecuta el merge de los grupos de duplicados.
 *
 * Para cada grupo:
 * 1. Mueve todas las relaciones FK del cliente "a eliminar" al cliente "a conservar"
 * 2. Mergear datos: conserva el CUIT, teléfono, dirección más completos
 * 3. Marca el cliente duplicado como inactivo (NO lo elimina por seguridad)
 *
 * Tablas con FK a Cliente que se actualizan:
 * - Tropa (productorId, usuarioFaenaId)
 * - MediaRes (usuarioFaenaId)
 * - DeclaracionJurada (productorId)
 * - Cuarto (propietarioId)
 * - CajaEmpaque (propietarioId)
 * - ExpedicionCicloII (clienteId)
 * - LiquidacionFaena (usuarioFaenaId)
 *
 * Uso:
 *   bun scripts/diagnostic-duplicados-clientes.ts --json    # Paso 1: generar sugerencias
 *   bun scripts/unificar-clientes.ts                          # Paso 2: ejecutar merge
 *   bun scripts/unificar-clientes.ts --dry-run                # Paso 2b: previsualizar
 */
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const db = new PrismaClient()

interface MergeItem {
  id: string
  nombre: string
  cuit: string | null
  tipo: string
  activo: boolean
  nTropasProductor: number
  nTropasUsuarioFaena: number
}

interface MergeGrupo {
  tipo: string
  motivo: string
  sugerencia: string
  conservar: string[]   // IDs a conservar (el principal)
  eliminar: string[]     // IDs a eliminar/mergear
  clientes: MergeItem[]
}

interface MergeData {
  generado: string
  totalClientes: number
  totalGrupos: number
  grupos: MergeGrupo[]
}

async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  UNIFICACIÓN DE CLIENTES DUPLICADOS')
  console.log('═══════════════════════════════════════════════════\n')

  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  if (dryRun) {
    console.log('🔍 MODO DRY-RUN: No se ejecutarán cambios.\n')
  }

  // ─── 1. Leer JSON de sugerencias ───
  const jsonPath = path.join(__dirname, 'duplicados-clientes-sugerencia.json')
  if (!fs.existsSync(jsonPath)) {
    console.error('❌ No encontré el archivo de sugerencias.')
    console.error('   Ejecutá primero: bun scripts/diagnostic-duplicados-clientes.ts --json')
    process.exit(1)
  }

  const data: MergeData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
  console.log(`📄 Archivo: ${jsonPath}`)
  console.log(`   Generado: ${data.generado}`)
  console.log(`   Total grupos: ${data.totalGrupos}`)
  console.log(`   Total clientes: ${data.totalClientes}`)

  // Filtrar grupos que tienen al menos un registro para eliminar
  const gruposActivos = data.grupos.filter(g => g.eliminar.length > 0)
  console.log(`   Grupos con merge pendiente: ${gruposActivos.length}`)

  if (gruposActivos.length === 0) {
    console.log('\n✅ No hay grupos pendientes de merge.')
    process.exit(0)
  }

  // ─── 2. Resumen de acciones ───
  console.log('\n── ACCIONES A EJECUTAR ──')
  for (const g of gruposActivos) {
    const conservar = g.clientes.find(c => g.conservar.includes(c.id))
    console.log(`\n  [${g.tipo}]`)
    console.log(`    Motivo: ${g.motivo}`)
    console.log(`    Conservar: ${conservar?.nombre || g.conservar[0]} (ID: ${g.conservar[0].slice(0,8)}...)`)
    console.log(`    Mergear (${g.eliminar.length}):`)
    for (const elimId of g.eliminar) {
      const c = g.clientes.find(x => x.id === elimId)
      console.log(`      - ${c?.nombre || elimId} (CUIT: ${c?.cuit || '-'})`)
    }
  }

  if (dryRun) {
    console.log('\n✅ DRY-RUN completado. No se hicieron cambios.')
    process.exit(0)
  }

  // ─── 3. EJECUTAR MERGE ───
  console.log('\n═══════════════════════════════════════════════════')
  console.log('  EJECUTANDO UNIFICACIÓN...')
  console.log('═══════════════════════════════════════════════════\n')

  let totalMerges = 0
  let totalErrores = 0

  for (const g of gruposActivos) {
    if (g.conservar.length === 0) {
      console.log(`  ⚠️  Grupo sin "conservar" definido. Saltando.`)
      totalErrores++
      continue
    }

    const conservarId = g.conservar[0]

    // Verificar que el cliente a conservar existe
    const clientePrincipal = await db.cliente.findUnique({ where: { id: conservarId } })
    if (!clientePrincipal) {
      console.log(`  ❌ Cliente principal ${conservarId.slice(0,8)}... no encontrado. Saltando.`)
      totalErrores++
      continue
    }

    for (const eliminarId of g.eliminar) {
      const duplicado = await db.cliente.findUnique({ where: { id: eliminarId } })
      if (!duplicado) {
        console.log(`  ⚠️  Duplicado ${eliminarId.slice(0,8)}... no encontrado (ya mergeado?). Saltando.`)
        continue
      }

      try {
        console.log(`\n  ── Merge: "${duplicado.nombre}" → "${clientePrincipal.nombre}" ──`)

        // Mover relaciones FK
        const results = await db.$transaction(async (tx) => {
          let movidos = 0

          // Tropa: productorId
          const tropasProductor = await tx.tropa.updateMany({
            where: { productorId: eliminarId },
            data: { productorId: conservarId }
          })
          movidos += tropasProductor.count

          // Tropa: usuarioFaenaId
          const tropasUF = await tx.tropa.updateMany({
            where: { usuarioFaenaId: eliminarId },
            data: { usuarioFaenaId: conservarId }
          })
          movidos += tropasUF.count

          // MediaRes: usuarioFaenaId
          const medias = await tx.mediaRes.updateMany({
            where: { usuarioFaenaId: eliminarId },
            data: { usuarioFaenaId: conservarId }
          })
          movidos += medias.count

          // DeclaracionJurada: productorId
          const decl = await tx.declaracionJurada.updateMany({
            where: { productorId: eliminarId },
            data: { productorId: conservarId }
          })
          movidos += decl.count

          // Cuarto: propietarioId
          const cuartos = await tx.cuarto.updateMany({
            where: { propietarioId: eliminarId },
            data: { propietarioId: conservarId }
          })
          movidos += cuartos.count

          // CajaEmpaque: propietarioId
          const cajas = await tx.cajaEmpaque.updateMany({
            where: { propietarioId: eliminarId },
            data: { propietarioId: conservarId }
          })
          movidos += cajas.count

          // ExpedicionCicloII: clienteId
          const exp = await tx.expedicionCicloII.updateMany({
            where: { clienteId: eliminarId },
            data: { clienteId: conservarId }
          })
          movidos += exp.count

          // LiquidacionFaena: clienteId
          const liq = await tx.liquidacionFaena.updateMany({
            where: { clienteId: eliminarId },
            data: { clienteId: conservarId }
          })
          movidos += liq.count

          // Merge datos: si el principal no tiene CUIT pero el duplicado sí
          if (!clientePrincipal.cuit && duplicado.cuit) {
            await tx.cliente.update({
              where: { id: conservarId },
              data: { cuit: duplicado.cuit }
            })
          }

          // Si el principal no tiene teléfono pero el duplicado sí
          if (!clientePrincipal.telefono && duplicado.telefono) {
            await tx.cliente.update({
              where: { id: conservarId },
              data: { telefono: duplicado.telefono }
            })
          }

          // Si el principal no tiene dirección pero el duplicado sí
          if (!clientePrincipal.direccion && duplicado.direccion) {
            await tx.cliente.update({
              where: { id: conservarId },
              data: { direccion: duplicado.direccion }
            })
          }

          // Marcar duplicado como inactivo (NO eliminar por seguridad)
          await tx.cliente.update({
            where: { id: eliminarId },
            data: {
              activo: false,
              observaciones: (duplicado.observaciones || '') +
                `\n[MERGE] Unificado con ${clientePrincipal.nombre} (ID: ${conservarId}) el ${new Date().toISOString().split('T')[0]}`
            }
          })

          return movidos
        })

        console.log(`    ✅ ${results} relaciones movidas`)
        console.log(`    ✅ Duplicado marcado como inactivo`)
        totalMerges++
      } catch (err: any) {
        console.error(`    ❌ Error: ${err.message}`)
        totalErrores++
      }
    }
  }

  // ─── 4. Resumen final ───
  console.log('\n═══════════════════════════════════════════════════')
  console.log('  RESUMEN FINAL')
  console.log('═══════════════════════════════════════════════════')
  console.log(`  Merges ejecutados: ${totalMerges}`)
  console.log(`  Errores: ${totalErrores}`)
  console.log('═══════════════════════════════════════════════════')

  // ─── 5. Verificación ───
  console.log('\n── VERIFICACIÓN POST-MERGE ──')
  const clientesActivos = await db.cliente.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' }
  })
  const clientesInactivos = await db.cliente.findMany({
    where: { activo: false },
    orderBy: { nombre: 'asc' }
  })
  console.log(`Clientes activos: ${clientesActivos.length}`)
  console.log(`Clientes inactivos (mergeados): ${clientesInactivos.length}`)

  if (clientesInactivos.length > 0) {
    console.log('\nInactivos:')
    for (const c of clientesInactivos) {
      console.log(`  ⬜ ${c.nombre} | CUIT: ${c.cuit || '-'} | ${c.observaciones?.slice(-80) || ''}`)
    }
  }
}

main()
  .catch(err => {
    console.error('❌ Error fatal:', err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
