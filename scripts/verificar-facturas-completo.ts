import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=====================================================');
  console.log('  VERIFICACION COMPLETA DE FACTURAS POR CLIENTE');
  console.log('=====================================================\n');

  // 1. Total general
  const totalFacturas = await prisma.factura.count();
  console.log(`Total de facturas en el sistema: ${totalFacturas}\n`);

  // 2. Obtener todos los clientes con conteo de facturas
  const clientes = await prisma.cliente.findMany({
    orderBy: { nombre: 'asc' }
  });

  let conFacturas = 0;
  let totalFacturasContadas = 0;

  const activosConFactura: string[] = [];
  const inactivosConFactura: string[] = [];

  for (const c of clientes) {
    const cant = await prisma.factura.count({ where: { clienteId: c.id } });

    if (cant > 0) {
      conFacturas++;
      totalFacturasContadas += cant;
      const total = await prisma.factura.aggregate({
        where: { clienteId: c.id },
        _sum: { total: true }
      });

      const estado = c.activo ? 'ACTIVO' : 'INACTIVO';
      const entry = `  ${c.nombre} | CUIT: ${c.cuit || 'S/C'} | ${cant} facturas | Total: $${(total._sum.total || 0).toLocaleString('es-AR')} | ${estado}`;

      if (c.activo) {
        activosConFactura.push(entry);
      } else {
        inactivosConFactura.push(entry);
      }
    }
  }

  console.log(`--- CLIENTES ACTIVOS CON FACTURAS (${activosConFactura.length}) ---`);
  if (activosConFactura.length === 0) {
    console.log('  (ninguno)');
  } else {
    activosConFactura.forEach(e => console.log(e));
  }

  console.log(`\n--- CLIENTES INACTIVOS CON FACTURAS (${inactivosConFactura.length}) ---`);
  if (inactivosConFactura.length === 0) {
    console.log('  ✅ Ninguno - Todos limpios!');
  } else {
    inactivosConFactura.forEach(e => console.log(e));
  }

  console.log(`\n=====================================================`);
  console.log('  RESUMEN');
  console.log('=====================================================');
  console.log(`  Total de clientes: ${clientes.length}`);
  console.log(`  Clientes activos: ${clientes.filter(c => c.activo).length}`);
  console.log(`  Clientes inactivos: ${clientes.filter(c => !c.activo).length}`);
  console.log(`  Clientes con facturas: ${conFacturas}`);
  console.log(`  Total facturas contadas: ${totalFacturasContadas}`);
  console.log(`  Total facturas en BD: ${totalFacturas}`);
  console.log(`  Facturas huérfanas (sin cliente): ${totalFacturas - totalFacturasContadas}`);
  console.log(`  Inactivos con facturas: ${inactivosConFactura.length}`);

  // 3. Verificar facturas huérfanas (clienteId que no existe)
  const todasFacturas = await prisma.factura.findMany({
    select: { clienteId: true, id: true, numero: true }
  });
  const clienteIds = new Set(clientes.map(c => c.id));
  const huerfanas = todasFacturas.filter(f => !clienteIds.has(f.clienteId));

  if (huerfanas.length > 0) {
    console.log(`\n  ⚠️ FACTURAS HUÉRFANAS (${huerfanas.length}):`);
    for (const f of huerfanas) {
      console.log(`    Factura ${f.numero} | clienteId: ${f.clienteId} (no existe)`);
    }
  } else {
    console.log('\n  ✅ No hay facturas huérfanas');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
