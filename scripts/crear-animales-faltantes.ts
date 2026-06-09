/**
 * Crear los 3 animales faltantes y sus AsignacionGarron
 * 
 * Datos proporcionados por el usuario:
 * - Tropa 195, animal 15, garrón 9: caravana I244, raza AA, VQ, 362 kg entrada
 * - Tropa 195, animal 16, garrón 16: caravana A646, raza AA, 350 kg entrada
 * - Tropa 132, animal 23, garrón 21: caravana D241, raza AA, 441 kg entrada
 */

import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  console.log('========================================')
  console.log('CREAR ANIMALES FALTANTES')
  console.log('========================================\n')

  // Buscar tropas
  const tropa195 = await db.tropa.findFirst({ where: { numero: 195 } })
  const tropa132 = await db.tropa.findFirst({ where: { numero: 132 } })

  if (!tropa195 || !tropa132) {
    console.error('ERROR: No se encontraron las tropas 195 o 132')
    process.exit(1)
  }
  console.log(`Tropa 195: ${tropa195.codigo} (id: ${tropa195.id})`)
  console.log(`Tropa 132: ${tropa132.codigo} (id: ${tropa132.id})`)

  // Datos de los 3 animales
  const animalesACrear = [
    {
      tropa: tropa195,
      numero: 15,
      caravana: 'I244',
      raza: 'AA',
      tipoAnimal: 'VQ' as const,
      pesoVivo: 362,
      garron: 9,
    },
    {
      tropa: tropa195,
      numero: 16,
      caravana: 'A646',
      raza: 'AA',
      tipoAnimal: 'NO' as const,
      pesoVivo: 350,
      garron: 16,
    },
    {
      tropa: tropa132,
      numero: 23,
      caravana: 'D241',
      raza: 'AA',
      tipoAnimal: 'NO' as const,
      pesoVivo: 441,
      garron: 21,
    },
  ]

  // Buscar listaFaenaId para cada tropa
  const listaTropa195 = await db.listaFaenaTropa.findFirst({
    where: { tropaId: tropa195.id },
    select: { listaFaenaId: true }
  })
  const listaTropa132 = await db.listaFaenaTropa.findFirst({
    where: { tropaId: tropa132.id },
    select: { listaFaenaId: true }
  })

  if (!listaTropa195 || !listaTropa132) {
    console.error('ERROR: No se encontró lista de faena para alguna tropa')
    process.exit(1)
  }

  const listaIds = new Map([
    [tropa195.id, listaTropa195.listaFaenaId],
    [tropa132.id, listaTropa132.listaFaenaId],
  ])
  console.log(`Lista T195: ${listaTropa195.listaFaenaId}`)
  console.log(`Lista T132: ${listaTropa132.listaFaenaId}\n`)

  // Crear animales y asignaciones
  for (const data of animalesACrear) {
    const codigo = `${data.tropa.codigoSimplificado || data.tropa.codigo}-${String(data.numero).padStart(3, '0')}`
    const listaFaenaId = listaIds.get(data.tropa.id)!

    try {
      // 1. Crear animal
      const animal = await db.animal.create({
        data: {
          tropaId: data.tropa.id,
          numero: data.numero,
          codigo,
          caravana: data.caravana,
          tipoAnimal: data.tipoAnimal,
          raza: data.raza,
          pesoVivo: data.pesoVivo,
          estado: 'FAENADO',
        }
      })
      console.log(`✓ Animal creado: T${data.tropa.numero} Nº${data.numero} (${data.caravana}) → ${codigo}`)

      // 2. Crear asignación garrón
      const asignacion = await db.asignacionGarron.create({
        data: {
          listaFaenaId,
          garron: data.garron,
          animalId: animal.id,
          tropaCodigo: data.tropa.codigoSimplificado || data.tropa.codigo,
          animalNumero: data.numero,
          tipoAnimal: data.tipoAnimal,
          pesoVivo: data.pesoVivo,
          tieneMediaDer: false,
          tieneMediaIzq: false,
          completado: false,
          horaIngreso: new Date(),
        }
      })
      console.log(`  ✓ AsignacionGarron: garrón ${data.garron} → ${codigo} (lista: ${listaFaenaId.substring(0, 8)}...)`)

    } catch (err: any) {
      console.error(`✗ Error T${data.tropa.numero} Nº${data.numero}:`, err.message)
    }
  }

  console.log('\n✓ Proceso finalizado.')
}

main()
  .catch(err => { console.error('ERROR FATAL:', err); process.exit(1) })
  .finally(() => db.$disconnect())