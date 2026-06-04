import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const inactivos = await prisma.cliente.findMany({
    where: { activo: false },
    include: {
      _count: {
        select: {
          tropasProductor: true,
          tropasUsuarioFaena: true,
          mediaRes: true,
          declaracionesJuradas: true,
          cuartos: true,
          cajasEmpaque: true,
          expedicionesCicloII: true,
          liquidacionesFaena: true,
        }
      }
    },
    orderBy: { nombre: 'asc' }
  });

  console.log('=== CLIENTES INACTIVOS Y SUS DATOS ASOCIADOS ===');
  console.log(`Total inactivos: ${inactivos.length}`);
  console.log('');

  let conDatos = 0;
  let sinDatos = 0;

  for (const c of inactivos) {
    const counts = c._count as Record<string, number>;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    console.log(`ID: ${c.id} | ${c.nombre} | CUIT: ${c.cuit || 'S/C'} | Obs: ${c.observaciones || '-'}`);
    
    if (total > 0) {
      conDatos++;
      console.log('  ⚠️  TIENE DATOS ASOCIADOS:');
      if (counts.tropasProductor) console.log(`    Tropas (productor): ${counts.tropasProductor}`);
      if (counts.tropasUsuarioFaena) console.log(`    Tropas (usuario faena): ${counts.tropasUsuarioFaena}`);
      if (counts.mediaRes) console.log(`    Medias Res: ${counts.mediaRes}`);
      if (counts.declaracionesJuradas) console.log(`    Declaraciones Juradas: ${counts.declaracionesJuradas}`);
      if (counts.cuartos) console.log(`    Cuartos: ${counts.cuartos}`);
      if (counts.cajasEmpaque) console.log(`    Cajas Empaque: ${counts.cajasEmpaque}`);
      if (counts.expedicionesCicloII) console.log(`    Expediciones Ciclo II: ${counts.expedicionesCicloII}`);
      if (counts.liquidacionesFaena) console.log(`    Liquidaciones Faena: ${counts.liquidacionesFaena}`);
      console.log(`    TOTAL: ${total}`);
    } else {
      sinDatos++;
      console.log('  ✅ Sin datos asociados (limpio)');
    }
    console.log('');
  }

  console.log('=====================================');
  console.log(`RESUMEN:`);
  console.log(`  Inactivos CON datos asociados: ${conDatos}`);
  console.log(`  Inactivos SIN datos asociados: ${sinDatos}`);
  console.log(`  Total inactivos: ${inactivos.length}`);
  
  // También mostrar total activos para referencia
  const totalActivos = await prisma.cliente.count({ where: { activo: true } });
  console.log(`  Total activos: ${totalActivos}`);
  console.log(`  Total clientes en BD: ${inactivos.length + totalActivos}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
