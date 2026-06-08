import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const INACTIVO_ID = 'cmpqw58c00006zseow7bi77nf'; // BOSQUES AMADOS SRL
  const ACTIVO_ID = 'cmpelhu92000uzsdo5ua240n3';    // BOSQUE AMADO SRL

  // Verificar datos antes
  const facturasAntes = await prisma.factura.findMany({
    where: { clienteId: INACTIVO_ID },
    select: { id: true, numero: true, fecha: true, total: true }
  });

  console.log(`Facturas a migrar de BOSQUES AMADOS SRL -> BOSQUE AMADO SRL:`);
  console.log(`Total: ${facturasAntes.length}`);
  for (const f of facturasAntes) {
    console.log(`  Factura ${f.numero} | ${f.fecha} | $${f.total}`);
  }

  // Migrar facturas
  if (facturasAntes.length > 0) {
    const result = await prisma.factura.updateMany({
      where: { clienteId: INACTIVO_ID },
      data: { clienteId: ACTIVO_ID }
    });
    console.log(`\n✅ Migradas ${result.count} facturas exitosamente`);
  }

  // Verificar después
  const facturasDespues = await prisma.factura.count({ where: { clienteId: INACTIVO_ID } });
  const facturasNuevo = await prisma.factura.count({ where: { clienteId: ACTIVO_ID } });
  console.log(`\nVerificación:`);
  console.log(`  Facturas en BOSQUES AMADOS SRL (inactivo): ${facturasDespues}`);
  console.log(`  Facturas en BOSQUE AMADO SRL (activo): ${facturasNuevo}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
