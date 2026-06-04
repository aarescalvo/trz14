/**
 * Merge específico de 4 grupos pendientes de duplicados.
 * Ejecutar después del merge principal.
 *
 * 1. DISTRIBUIDORA DE LA PATAGONIA → DISTRIBUIDORA DE LA PATAGONIA SRL
 * 2. GANADERA NORTE NEUQUINO → GANADERA NORTE NEUQUINO SAS
 * 3. MORAGA → MORAGA MAXIMILIANO
 * 4. BOSQUES AMADOS SRL → BOSQUE AMADO SRL
 *
 * Uso:
 *   bun scripts/unificar-pendientes.ts --dry-run
 *   bun scripts/unificar-pendientes.ts
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// Pares: [nombre duplicado a eliminar, nombre correcto a conservar]
const MERGES: [string, string][] = [
  ['DISTRIBUIDORA DE LA PATAGONIA', 'DISTRIBUIDORA DE LA PATAGONIA SRL'],
  ['GANADERA NORTE NEUQUINO', 'GANADERA NORTE NEUQUINO SAS'],
  ['MORAGA', 'MORAGA MAXIMILIANO'],
  ['BOSQUES AMADOS SRL', 'BOSQUE AMADO SRL'],
]

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  console.log('═══════════════════════════════════════')
  console.log('  MERGE DE 4 GRUPOS PENDIENTES')
  console.log('═══════════════════════════════════════\n')

  if (dryRun) console.log('🔍 MODO DRY-RUN\n')

  let ok = 0
  let err = 0

  for (const [nombreEliminar, nombreConservar] of MERGES) {
    try {
      const eliminar = await db.cliente.findFirst({ where: { nombre: nombreEliminar, activo: true } })
      const conservar = await db.cliente.findFirst({ where: { nombre: nombreConservar, activo: true } })

      if (!eliminar) {
        console.log(`  ⚠️  "${nombreEliminar}" no encontrado o ya inactivo. Saltando.`)
        continue
      }
      if (!conservar) {
        console.log(`  ❌ "${nombreConservar}" no encontrado. Saltando.`)
        err++
        continue
      }
      if (eliminar.id === conservar.id) {
        console.log(`  ⚠️  Mismo registro. Saltando.`)
        continue
      }

      console.log(`\n  "${eliminar.nombre}" (ID:${eliminar.id.slice(0,8)}) → "${conservar.nombre}" (ID:${conservar.id.slice(0,8)})`)

      if (dryRun) {
        console.log('    [DRY-RUN] Se moverían relaciones y se marcaría inactivo.')
        ok++
        continue
      }

      const results = await db.$transaction(async (tx) => {
        let mov = 0
        const eid = eliminar.id
        const cid = conservar.id

        mov += (await tx.tropa.updateMany({ where: { productorId: eid }, data: { productorId: cid } })).count
        mov += (await tx.tropa.updateMany({ where: { usuarioFaenaId: eid }, data: { usuarioFaenaId: cid } })).count
        mov += (await tx.mediaRes.updateMany({ where: { usuarioFaenaId: eid }, data: { usuarioFaenaId: cid } })).count
        mov += (await tx.declaracionJurada.updateMany({ where: { productorId: eid }, data: { productorId: cid } })).count
        mov += (await tx.cuarto.updateMany({ where: { propietarioId: eid }, data: { propietarioId: cid } })).count
        mov += (await tx.cajaEmpaque.updateMany({ where: { propietarioId: eid }, data: { propietarioId: cid } })).count
        mov += (await tx.expedicionCicloII.updateMany({ where: { clienteId: eid }, data: { clienteId: cid } })).count
        mov += (await tx.liquidacionFaena.updateMany({ where: { clienteId: eid }, data: { clienteId: cid } })).count

        // Completar datos si falta
        if (!conservar.cuit && eliminar.cuit) {
          await tx.cliente.update({ where: { id: cid }, data: { cuit: eliminar.cuit } })
        }

        // Marcar inactivo
        await tx.cliente.update({
          where: { id: eid },
          data: {
            activo: false,
            observaciones: (eliminar.observaciones || '') +
              `\n[MERGE] Unificado con ${conservar.nombre} (ID: ${cid}) el ${new Date().toISOString().split('T')[0]}`
          }
        })

        return mov
      })

      console.log(`    ✅ ${results} relaciones movidas, marcado inactivo`)
      ok++
    } catch (e: any) {
      console.log(`    ❌ Error: ${e.message}`)
      err++
    }
  }

  console.log(`\n═══════════════════════════════════════`)
  console.log(`  Merges: ${ok} ok, ${err} errores`)

  const activos = await db.cliente.count({ where: { activo: true } })
  const inactivos = await db.cliente.count({ where: { activo: false } })
  console.log(`  Clientes activos: ${activos}, inactivos: ${inactivos}`)
  console.log('═══════════════════════════════════════')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
