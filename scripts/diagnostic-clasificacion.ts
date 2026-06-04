import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function denticionToPrefix(d: string | null | undefined): string {
  if (!d) return '';
  const num = d.replace(/\D/g, '');
  return num ? `${num}D` : '';
}

function buildClasifSIGICA(denticion: string | null | undefined, tipoAnimal: string | null | undefined): string {
  const prefix = denticionToPrefix(denticion);
  const tipo = tipoAnimal || '';
  return prefix && tipo ? `${prefix} - ${tipo}` : tipo || prefix || '';
}

function buildClasifRinde(denticion: string | null | undefined, tipoAnimal: string | null | undefined): string {
  const d = denticion || '';
  const t = tipoAnimal || '';
  return d && t ? `${d} - ${t}` : t || d || '';
}

async function main() {
  console.log('=== DIAGNOSTICO CLASIFICACION - TROPAS CON ROMANEOS ===\n');

  // Buscar las ultimas tropas con romaneos confirmados
  const ultimasTropas = await prisma.tropa.findMany({
    where: { especie: 'BOVINO' },
    orderBy: { numero: 'desc' },
    take: 10,
    select: { id: true, numero: true, codigo: true, estado: true }
  });

  let encontrada = false;
  for (const t of ultimasTropas) {
    const roms = await prisma.romaneo.findMany({
      where: { tropaCodigo: t.codigo },
      include: { mediasRes: { orderBy: { lado: 'asc' } } },
      orderBy: { garron: 'asc' }
    });

    if (roms.length === 0) continue;
    encontrada = true;

    const estados = [...new Set(roms.map(r => r.estado))];
    console.log(`Tropa ${t.numero} (${t.estado}): ${roms.length} romaneos | Estados: ${estados.join(', ')}`);

    for (const rom of roms) {
      const clasifSIGICA = buildClasifSIGICA(rom.denticion, rom.tipoAnimal as string | undefined);
      const clasifRinde = buildClasifRinde(rom.denticion, rom.tipoAnimal as string | undefined);

      console.log(`  Garron: ${rom.garron} | denticion(raw): "${rom.denticion || 'NULL'}" | tipoAnimal: ${rom.tipoAnimal || 'NULL'} | SIGICA: "${clasifSIGICA}" | Rinde: "${clasifRinde}" | mediasRes: ${rom.mediasRes.length}`);

      // Mostrar datos de medias res
      for (const mr of rom.mediasRes) {
        console.log(`    MediaRes | lado: ${mr.lado} | peso: ${mr.peso} | tipoAnimal: ${mr.tipoAnimal || 'NULL'} | estado: ${mr.estado}`);
      }
    }
    console.log('');
    break; // Solo la primera tropa con datos
  }

  // Si no hay romaneos, buscar medias res directamente
  if (!encontrada) {
    console.log('No se encontraron romaneos en las ultimas 10 tropas.');
    console.log('\nBuscando medias res de las ultimas tropas...\n');

    for (const t of ultimasTropas) {
      // Buscar romaneos de CUALQUIER estado para esta tropa
      const romIds = await prisma.romaneo.findMany({
        where: { tropaCodigo: t.codigo },
        select: { id: true }
      });
      const romIdList = romIds.map(r => r.id);

      if (romIdList.length === 0) continue;

      const medias = await prisma.mediaRes.findMany({
        where: { romaneoId: { in: romIdList } },
        orderBy: [{ romaneoId: 'asc' }, { lado: 'asc' }],
        take: 10
      });

      if (medias.length > 0) {
        console.log(`Tropa ${t.numero}: ${medias.length} medias res encontradas`);
        const tipos = [...new Set(medias.map(m => m.tipoAnimal).filter(Boolean))];
        console.log(`  Tipos Animal: ${tipos.join(', ') || 'NINGUNO'}`);
        for (const m of medias.slice(0, 5)) {
          console.log(`  romaneoId: ${m.romaneoId} | lado: ${m.lado} | tipoAnimal: ${m.tipoAnimal} | peso: ${m.peso}`);
        }
        break;
      }
    }
  }

  // Mostrar resumen de valores de denticion en toda la BD
  console.log('\n=== RESUMEN DENTICION EN TODA LA BD ===');
  const todosRomaneos = await prisma.romaneo.findMany({
    select: { denticion: true, tipoAnimal: true },
    where: { denticion: { not: null } }
  });
  const denticiones = [...new Set(todosRomaneos.map(r => r.denticion).filter(Boolean))];
  const tipos = [...new Set(todosRomaneos.map(r => r.tipoAnimal).filter(Boolean))];
  console.log(`Romaneos con denticion: ${todosRomaneos.length}`);
  console.log(`Valores unicos de denticion: ${denticiones.join(', ')}`);
  console.log(`Valores unicos de tipoAnimal: ${tipos.join(', ')}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
