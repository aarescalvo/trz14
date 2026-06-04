import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const inactivos = await prisma.cliente.findMany({
    where: { activo: false },
    orderBy: { nombre: 'asc' }
  });

  console.log('=== CLIENTES INACTIVOS Y SUS DATOS ASOCIADOS ===');
  console.log(`Total inactivos: ${inactivos.length}`);
  console.log('');

  let conDatos = 0;
  let sinDatos = 0;

  for (const c of inactivos) {
    // Contar relaciones usando prisma.count directamente
    const [
      tropasProductor,
      tropasUsuarioFaena,
      mediasRes,
      declaracionesJuradas,
      cuartos,
      cajasEmpaque,
      expediciones,
      liquidacionesFaena,
      facturas,
      reclamos,
      precios,
      historialPrecios,
      preciosCortes,
      expedicionesC2,
      notasCredito,
      notasDebito
    ] = await Promise.all([
      prisma.tropa.count({ where: { productorId: c.id } }),
      prisma.tropa.count({ where: { usuarioFaenaId: c.id } }),
      prisma.mediaRes.count({ where: { usuarioFaenaId: c.id } }),
      prisma.declaracionJurada.count({ where: { productorId: c.id } }),
      prisma.cuarto.count({ where: { propietarioId: c.id } }),
      prisma.cajaEmpaque.count({ where: { propietarioId: c.id } }),
      prisma.expedicionCicloII.count({ where: { clienteId: c.id } }),
      prisma.liquidacionFaena.count({ where: { clienteId: c.id } }),
      prisma.factura.count({ where: { clienteId: c.id } }),
      prisma.reclamoCliente.count({ where: { clienteId: c.id } }),
      prisma.precioCliente.count({ where: { clienteId: c.id } }),
      prisma.historialPrecio.count({ where: { clienteId: c.id } }),
      prisma.precioCorte.count({ where: { clienteId: c.id } }),
      prisma.c2ExpedicionOrden.count({ where: { clienteId: c.id } }),
      prisma.notaCredito.count({ where: { clienteId: c.id } }),
      prisma.notaDebito.count({ where: { clienteId: c.id } }),
    ]);

    const datos: Record<string, number> = {};
    let total = 0;

    if (tropasProductor) { datos['Tropas (productor)'] = tropasProductor; total += tropasProductor; }
    if (tropasUsuarioFaena) { datos['Tropas (usuario faena)'] = tropasUsuarioFaena; total += tropasUsuarioFaena; }
    if (mediasRes) { datos['Medias Res'] = mediasRes; total += mediasRes; }
    if (declaracionesJuradas) { datos['Declaraciones Juradas'] = declaracionesJuradas; total += declaracionesJuradas; }
    if (cuartos) { datos['Cuartos'] = cuartos; total += cuartos; }
    if (cajasEmpaque) { datos['Cajas Empaque'] = cajasEmpaque; total += cajasEmpaque; }
    if (expediciones) { datos['Expediciones Ciclo II'] = expediciones; total += expediciones; }
    if (liquidacionesFaena) { datos['Liquidaciones Faena'] = liquidacionesFaena; total += liquidacionesFaena; }
    if (facturas) { datos['Facturas'] = facturas; total += facturas; }
    if (reclamos) { datos['Reclamos'] = reclamos; total += reclamos; }
    if (precios) { datos['Precios'] = precios; total += precios; }
    if (historialPrecios) { datos['Historial Precios'] = historialPrecios; total += historialPrecios; }
    if (preciosCortes) { datos['Precios Cortes'] = preciosCortes; total += preciosCortes; }
    if (expedicionesC2) { datos['Expediciones C2'] = expedicionesC2; total += expedicionesC2; }
    if (notasCredito) { datos['Notas Credito'] = notasCredito; total += notasCredito; }
    if (notasDebito) { datos['Notas Debito'] = notasDebito; total += notasDebito; }

    console.log(`ID: ${c.id} | ${c.nombre} | CUIT: ${c.cuit || 'S/C'}`);
    console.log(`  Obs: ${c.observaciones || 'Sin observaciones'}`);

    if (total > 0) {
      conDatos++;
      console.log('  ⚠️  TIENE DATOS ASOCIADOS:');
      for (const [key, val] of Object.entries(datos)) {
        console.log(`    ${key}: ${val}`);
      }
      console.log(`    TOTAL: ${total}`);
    } else {
      sinDatos++;
      console.log('  ✅ Sin datos asociados (limpio)');
    }
    console.log('');
  }

  console.log('=====================================');
  console.log('RESUMEN:');
  console.log(`  Inactivos CON datos asociados: ${conDatos}`);
  console.log(`  Inactivos SIN datos asociados: ${sinDatos}`);
  console.log(`  Total inactivos: ${inactivos.length}`);

  const totalActivos = await prisma.cliente.count({ where: { activo: true } });
  console.log(`  Total activos: ${totalActivos}`);
  console.log(`  Total clientes en BD: ${inactivos.length + totalActivos}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
