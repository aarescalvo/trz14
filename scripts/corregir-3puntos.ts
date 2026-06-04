import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const HOY = new Date().toISOString().split('T')[0];
  const OBS_MERGE = `\n[MERGE] Unificado el ${HOY}`;

  // ============================================
  // 1. DESACTIVAR "Cliente sin identificar"
  // ============================================
  const sinIdent = await prisma.cliente.findFirst({
    where: { nombre: 'Cliente sin identificar', activo: true }
  });

  if (sinIdent) {
    // Verificar datos asociados
    const tropasP = await prisma.tropa.count({ where: { productorId: sinIdent.id } });
    const tropasU = await prisma.tropa.count({ where: { usuarioFaenaId: sinIdent.id } });
    const facturas = await prisma.factura.count({ where: { clienteId: sinIdent.id } });
    console.log(`1. "Cliente sin identificar" (ID: ${sinIdent.id})`);
    console.log(`   Tropas(P): ${tropasP} | Tropas(UF): ${tropasU} | Facturas: ${facturas}`);

    if (tropasP + tropasU + facturas === 0) {
      await prisma.cliente.update({
        where: { id: sinIdent.id },
        data: {
          activo: false,
          observaciones: `Registro de ejemplo/datos sin identificar${OBS_MERGE}`
        }
      });
      console.log('   ✅ Desactivado (sin datos asociados)');
    } else {
      console.log('   ⚠️ TIENE DATOS - No se desactiva');
    }
  } else {
    console.log('1. "Cliente sin identificar" no encontrado o ya inactivo');
  }

  // ============================================
  // 2. UNIFICAR FERREYRA: PAOLA ANDREA -> ANDREA PAOLA
  // ============================================
  // FERREYRA PAOLA ANDREA (tiene CUIT + 3 tropas) -> renombrar a FERREYRA ANDREA PAOLA
  // FERREYRA ANDREA PAOLA (sin datos) -> desactivar
  const ferreyraPA = await prisma.cliente.findFirst({
    where: { nombre: 'FERREYRA PAOLA ANDREA', activo: true }
  });
  const ferreyraAP = await prisma.cliente.findFirst({
    where: { nombre: 'FERREYRA ANDREA PAOLA', activo: true }
  });

  if (ferreyraPA && ferreyraAP) {
    console.log(`\n2. Unificar FERREYRA:`);
    console.log(`   Mantener: FERREYRA PAOLA ANDREA (${ferreyraPA.id}) -> renombrar a FERREYRA ANDREA PAOLA`);
    console.log(`   Desactivar: FERREYRA ANDREA PAOLA (${ferreyraAP.id})`);

    // Migrar cualquier dato de ferreyraAP a ferreyraPA (por si tiene algo)
    const tropasM = await prisma.tropa.count({ where: { usuarioFaenaId: ferreyraAP.id } });
    const facturasM = await prisma.factura.count({ where: { clienteId: ferreyraAP.id } });
    console.log(`   Datos en ANDREA PAOLA a migrar: Tropas(UF): ${tropasM} | Facturas: ${facturasM}`);

    if (tropasM > 0) {
      await prisma.tropa.updateMany({
        where: { usuarioFaenaId: ferreyraAP.id },
        data: { usuarioFaenaId: ferreyraPA.id }
      });
      console.log(`   ✅ Migradas ${tropasM} tropas`);
    }
    if (facturasM > 0) {
      await prisma.factura.updateMany({
        where: { clienteId: ferreyraAP.id },
        data: { clienteId: ferreyraPA.id }
      });
      console.log(`   ✅ Migradas ${facturasM} facturas`);
    }

    // Renombrar PAOLA ANDREA -> ANDREA PAOLA (nombre correcto)
    await prisma.cliente.update({
      where: { id: ferreyraPA.id },
      data: { nombre: 'FERREYRA ANDREA PAOLA' }
    });
    console.log('   ✅ Renombrado FERREYRA PAOLA ANDREA -> FERREYRA ANDREA PAOLA');

    // Desactivar el ANDREA PAOLA original (sin datos)
    await prisma.cliente.update({
      where: { id: ferreyraAP.id },
      data: {
        activo: false,
        observaciones: `[MERGE] Unificado con FERREYRA ANDREA PAOLA (ID: ${ferreyraPA.id}) el ${HOY}`
      }
    });
    console.log('   ✅ Desactivado FERREYRA ANDREA PAOLA duplicado');
  } else {
    console.log('\n2. No se encontraron ambos FERREYRA para unificar');
    if (!ferreyraPA) console.log('   Faltante: FERREYRA PAOLA ANDREA');
    if (!ferreyraAP) console.log('   Faltante: FERREYRA ANDREA PAOLA');
  }

  // ============================================
  // 3. RENOMBRAR LONGIPET SRL -> LOGINPET SRL
  // ============================================
  const longipet = await prisma.cliente.findFirst({
    where: { nombre: 'LONGIPET SRL', activo: true }
  });

  if (longipet) {
    console.log(`\n3. LONGIPET SRL -> LOGINPET SRL (ID: ${longipet.id})`);
    await prisma.cliente.update({
      where: { id: longipet.id },
      data: { nombre: 'LOGINPET SRL' }
    });
    console.log('   ✅ Renombrado a LOGINPET SRL');
  } else {
    console.log('\n3. LONGIPET SRL no encontrado');
  }

  // ============================================
  // VERIFICACION FINAL
  // ============================================
  console.log('\n=====================================================');
  console.log('  VERIFICACION FINAL');
  console.log('=====================================================');

  const totalActivos = await prisma.cliente.count({ where: { activo: true } });
  const totalInactivos = await prisma.cliente.count({ where: { activo: false } });
  console.log(`Activos: ${totalActivos} | Inactivos: ${totalInactivos} | Total: ${totalActivos + totalInactivos}`);

  // Verificar FERREYRA
  const ferreyraFinal = await prisma.cliente.findMany({
    where: { nombre: { contains: 'FERREYRA' }, activo: true },
    orderBy: { nombre: 'asc' }
  });
  console.log(`\nFerreyra activos (${ferreyraFinal.length}):`);
  ferreyraFinal.forEach(c => console.log(`  ${c.nombre} | ${c.cuit || 'S/C'}`));

  // Verificar LOGINPET
  const loginpet = await prisma.cliente.findFirst({
    where: { nombre: 'LOGINPET SRL', activo: true }
  });
  console.log(`\nLOGINPET SRL: ${loginpet ? '✅ Existe' : '❌ No encontrado'}`);

  const longipetCheck = await prisma.cliente.findFirst({
    where: { nombre: 'LONGIPET SRL' }
  });
  console.log(`LONGIPET SRL: ${longipetCheck ? `❌ Aun existe (${longipetCheck.activo ? 'activo' : 'inactivo'})` : '✅ No existe'}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
