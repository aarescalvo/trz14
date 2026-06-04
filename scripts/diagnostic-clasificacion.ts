import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tropa203 = await prisma.tropa.findFirst({
    where: { numero: 203 },
    select: { id: true, numero: true, codigo: true, especie: true, estado: true }
  });

  if (!tropa203) {
    console.log('Tropa 203 no encontrada');
    return;
  }

  console.log(`Tropa 203: codigo=${tropa203.codigo} | estado=${tropa203.estado}`);

  // 1. Buscar romaneos de CUALQUIER estado
  const romaneosAll = await prisma.romaneo.findMany({
    where: { tropaCodigo: tropa203.codigo },
    select: { id: true, garron: true, tipoAnimal: true, denticion: true, raza: true, estado: true },
    orderBy: { garron: 'asc' }
  });
  console.log(`\n1. Romaneos (TODOS los estados): ${romaneosAll.length}`);
  const estadosRom = [...new Set(romaneosAll.map(r => r.estado))];
  console.log(`   Estados: ${estadosRom.join(', ') || 'NINGUNO'}`);
  if (romaneosAll.length > 0) {
    for (const r of romaneosAll.slice(0, 5)) {
      console.log(`   Garron: ${r.garron} | tipoAnimal: ${r.tipoAnimal} | denticion: ${r.denticion} | estado: ${r.estado}`);
    }
  }

  // 2. Buscar medias res
  const medias = await prisma.mediaRes.findMany({
    where: { tropaCodigo: tropa203.codigo },
    select: { id: true, garron: true, tipoAnimal: true, lado: true, peso: true, estado: true },
    orderBy: [{ garron: 'asc' }, { lado: 'asc' }]
  });
  console.log(`\n2. Medias Res: ${medias.length}`);
  if (medias.length > 0) {
    const estadosMR = [...new Set(medias.map(m => m.estado))];
    console.log(`   Estados: ${estadosMR.join(', ')}`);
    const tiposMR = [...new Set(medias.map(m => m.tipoAnimal).filter(Boolean))];
    console.log(`   Tipos Animal: ${tiposMR.join(', ') || 'NINGUNO'}`);
    for (const m of medias.slice(0, 5)) {
      console.log(`   Garron: ${m.garron} | tipoAnimal: ${m.tipoAnimal} | lado: ${m.lado} | peso: ${m.peso} | estado: ${m.estado}`);
    }
  }

  // 3. Buscar animales
  const animales = await prisma.animal.findMany({
    where: { tropaCodigo: tropa203.codigo },
    select: { id: true, numeroAnimal: true, tipoAnimal: true, raza: true, estado: true },
    orderBy: { numeroAnimal: 'asc' }
  });
  console.log(`\n3. Animales: ${animales.length}`);
  if (animales.length > 0) {
    const tipos = [...new Set(animales.map(a => a.tipoAnimal).filter(Boolean))];
    console.log(`   Tipos Animal: ${tipos.join(', ') || 'NINGUNO'}`);
    for (const a of animales.slice(0, 5)) {
      console.log(`   Animal: ${a.numeroAnimal} | tipoAnimal: ${a.tipoAnimal} | raza: ${a.raza} | estado: ${a.estado}`);
    }
  }

  // 4. Buscar PesoTropa o PesajeFaena
  // Ver si hay tabla de pesaje faena
  try {
    const pesajeFaena = await (prisma as any).pesoTropa?.findMany?.({
      where: { tropaCodigo: tropa203.codigo },
      take: 5
    }) || [];
    console.log(`\n4. PesoTropa: ${pesajeFaena.length}`);
  } catch {
    console.log(`\n4. PesoTropa: tabla no encontrada`);
  }

  // 5. Buscar Tipificaciones por tropa
  const tipificaciones = await (prisma as any).tipificacion?.findMany?.({
    where: { tropaCodigo: tropa203.codigo },
    take: 5
  }) || [];
  console.log(`\n5. Tipificacion: ${tipificaciones.length}`);

  // 6. Buscar romaneos de las ultimas 5 tropas con datos
  console.log(`\n=== ROMANEOS DE ULTIMAS TROPAS CON DATOS ===`);
  const ultimasTropas = await prisma.tropa.findMany({
    where: { especie: 'BOVINO' },
    orderBy: { numero: 'desc' },
    take: 10,
    select: { id: true, numero: true, codigo: true, estado: true }
  });

  for (const t of ultimasTropas) {
    const roms = await prisma.romaneo.findMany({
      where: { tropaCodigo: t.codigo, estado: 'CONFIRMADO' },
      select: { garron: true, tipoAnimal: true, denticion: true, estado: true },
      orderBy: { garron: 'asc' }
    });
    if (roms.length > 0) {
      console.log(`\nTropa ${t.numero} (${t.estado}): ${roms.length} romaneos confirmados`);
      for (const r of roms.slice(0, 3)) {
        function denticionToPrefix(d: string | null | undefined): string {
          if (!d) return '';
          const num = d.replace(/\D/g, '');
          return num ? `${num}D` : '';
        }
        const prefix = denticionToPrefix(r.denticion);
        const tipo = r.tipoAnimal || '';
        const clasif = prefix && tipo ? `${prefix} - ${tipo}` : tipo || prefix || '';
        console.log(`  Garron: ${r.garron} | denticion(raw): "${r.denticion}" | tipoAnimal: ${r.tipoAnimal} | Clasif: "${clasif}"`);
      }
      if (roms.length > 3) console.log(`  ... y ${roms.length - 3} mas`);
      break; // Solo mostrar la primera tropa con datos
    }
  }

  // 7. Ver MediaRes de ultimas tropas
  console.log(`\n=== MEDIAS RES DE ULTIMAS TROPAS ===`);
  for (const t of ultimasTropas) {
    const mrs = await prisma.mediaRes.findMany({
      where: { tropaCodigo: t.codigo },
      select: { garron: true, tipoAnimal: true, lado: true, peso: true },
      orderBy: [{ garron: 'asc' }, { lado: 'asc' }],
      take: 6
    });
    if (mrs.length > 0) {
      console.log(`\nTropa ${t.numero}: ${mrs.length} medias res`);
      const tipos = [...new Set(mrs.map(m => m.tipoAnimal).filter(Boolean))];
      console.log(`  Tipos Animal en MediaRes: ${tipos.join(', ') || 'NINGUNO'}`);
      for (const m of mrs.slice(0, 6)) {
        console.log(`  Garron: ${m.garron} | tipoAnimal: ${m.tipoAnimal} | lado: ${m.lado} | peso: ${m.peso}`);
      }
      break;
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
