import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=====================================================');
  console.log('  DIAGNOSTICO DE 3 PUNTOS');
  console.log('=====================================================\n');

  // 1. CLIENTES SIN IDENTIFICACION
  console.log('--- 1. CLIENTES SIN IDENTIFICACION / CON NOMBRE VACIO ---');
  const sinNombre = await prisma.cliente.findMany({
    where: {
      OR: [
        { nombre: { equals: null } },
        { nombre: { equals: '' } },
        { nombre: { equals: ' ' } },
        { nombre: { startsWith: 'Cliente' } },
        { nombre: { startsWith: 'Sin identificar' } },
      ]
    },
    orderBy: { nombre: 'asc' }
  });

  if (sinNombre.length === 0) {
    console.log('  No se encontraron clientes sin identificacion obvia.');
    console.log('  Mostrando todos los clientes activos para revisar:');
    const todos = await prisma.cliente.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, cuit: true, esProductor: true, esUsuarioFaena: true },
      orderBy: { nombre: 'asc' }
    });
    for (const c of todos) {
      const tipo = [c.esProductor ? 'Productor' : '', c.esUsuarioFaena ? 'UsuarioFaena' : ''].filter(Boolean).join(', ') || 'Sin tipo';
      console.log(`  ${c.nombre} | ${c.cuit || 'S/C'} | ${tipo}`);
    }
  } else {
    for (const c of sinNombre) {
      console.log(`  ⚠️ ID: ${c.id} | nombre: "${c.nombre}" | CUIT: ${c.cuit || 'S/C'} | activo: ${c.activo}`);
    }
  }

  // 2. FERREYRA DUPLICADOS
  console.log('\n--- 2. BUSQUEDA FERREYRA ---');
  const ferreyra = await prisma.cliente.findMany({
    where: {
      nombre: { contains: 'FERREYRA' },
      activo: true
    },
    orderBy: { nombre: 'asc' }
  });

  for (const c of ferreyra) {
    const facturas = await prisma.factura.count({ where: { clienteId: c.id } });
    const tropasP = await prisma.tropa.count({ where: { productorId: c.id } });
    const tropasU = await prisma.tropa.count({ where: { usuarioFaenaId: c.id } });
    const medias = await prisma.mediaRes.count({ where: { usuarioFaenaId: c.id } });
    const dj = await prisma.declaracionJurada.count({ where: { productorId: c.id } });
    console.log(`  ID: ${c.id} | ${c.nombre} | CUIT: ${c.cuit || 'S/C'} | Productor: ${c.esProductor} | UsuarioFaena: ${c.esUsuarioFaena}`);
    console.log(`    Facturas: ${facturas} | Tropas(P): ${tropasP} | Tropas(UF): ${tropasU} | MediasRes: ${medias} | DJ: ${dj}`);
  }

  // También buscar inactivos por si ya hay un merge previo
  const ferreyraInactivos = await prisma.cliente.findMany({
    where: {
      nombre: { contains: 'FERREYRA' },
      activo: false
    },
    orderBy: { nombre: 'asc' }
  });
  if (ferreyraInactivos.length > 0) {
    console.log('  Inactivos con FERREYRA:');
    for (const c of ferreyraInactivos) {
      console.log(`    ID: ${c.id} | ${c.nombre} | Obs: ${c.observaciones || '-'}`);
    }
  }

  // 3. LONGIPET / LOGINPET
  console.log('\n--- 3. BUSQUEDA LONGIPET / LOGINPET ---');
  const longipet = await prisma.cliente.findMany({
    where: {
      OR: [
        { nombre: { contains: 'LONGIPET' } },
        { nombre: { contains: 'LOGINPET' } },
        { nombre: { contains: 'LONGI' } },
        { nombre: { contains: 'LOGI' } },
        { nombre: { contains: 'PET' } },
      ],
      activo: true
    },
    orderBy: { nombre: 'asc' }
  });

  for (const c of longipet) {
    const facturas = await prisma.factura.count({ where: { clienteId: c.id } });
    const tropasP = await prisma.tropa.count({ where: { productorId: c.id } });
    const tropasU = await prisma.tropa.count({ where: { usuarioFaenaId: c.id } });
    console.log(`  ID: ${c.id} | ${c.nombre} | CUIT: ${c.cuit || 'S/C'} | Productor: ${c.esProductor} | UsuarioFaena: ${c.esUsuarioFaena}`);
    console.log(`    Facturas: ${facturas} | Tropas(P): ${tropasP} | Tropas(UF): ${tropasU}`);
  }

  console.log('\n=====================================================');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
