import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Buscar romaneos con denticion, agrupados por tropaCodigo
  const romaneos = await prisma.romaneo.findMany({
    where: { denticion: { not: null } },
    select: { tropaCodigo: true, garron: true, denticion: true, tipoAnimal: true, estado: true },
    orderBy: { tropaCodigo: 'desc' }
  });

  // Agrupar por tropa
  const porTropa = new Map<string, typeof romaneos>();
  for (const r of romaneos) {
    const tc = r.tropaCodigo || 'SIN_TROPA';
    if (!porTropa.has(tc)) porTropa.set(tc, []);
    porTropa.get(tc)!.push(r);
  }

  console.log(`Total romaneos con denticion: ${romaneos.length}`);
  console.log(`Total tropas: ${porTropa.size}`);
  console.log('');

  // Mostrar las ultimas 5 tropas con datos
  const tropas = [...porTropa.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  for (const [tc, roms] of tropas.slice(0, 5)) {
    const estados = [...new Set(roms.map(r => r.estado))];
    const denticiones = [...new Set(roms.map(r => r.denticion))];
    const tipos = [...new Set(roms.map(r => r.tipoAnimal).filter(Boolean))];
    console.log(`TropaCodigo: "${tc}" | ${roms.length} romaneos | Estados: ${estados.join(',')} | Denticiones: ${denticiones.join(',')} | Tipos: ${tipos.join(',')}`);

    // Mostrar primeros 3 con el resultado de buildClasificacion
    for (const r of roms.slice(0, 3)) {
      function denticionToPrefix(d: string | null | undefined): string {
        if (!d) return '';
        const num = d.replace(/\D/g, '');
        return num ? `${num}D` : '';
      }
      const prefix = denticionToPrefix(r.denticion);
      const tipo = r.tipoAnimal || '';
      const clasifSIGICA = prefix && tipo ? `${prefix} - ${tipo}` : tipo || prefix || '';
      const clasifRinde = r.denticion && r.tipoAnimal ? `${r.denticion} - ${r.tipoAnimal}` : r.tipoAnimal || r.denticion || '';
      console.log(`  Garron: ${r.garron} | denticion: "${r.denticion}" | tipoAnimal: ${r.tipoAnimal} | SIGICA: "${clasifSIGICA}" | RindeExcel: "${clasifRinde}" | estado: ${r.estado}`);
    }
    console.log('');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
