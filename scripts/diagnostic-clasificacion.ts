import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== DIAGNOSTICO CLASIFICACION TROPA 203 (y ultimas) ===\n');

  // Buscar tropa 203
  const tropa203 = await prisma.tropa.findFirst({
    where: { numero: 203 },
    select: { id: true, numero: true, codigo: true, especie: true, estado: true }
  });

  if (!tropa203) {
    console.log('Tropa 203 no encontrada. Buscando las últimas tropas...');
    const ultimas = await prisma.tropa.findMany({
      orderBy: { numero: 'desc' },
      take: 5,
      select: { id: true, numero: true, codigo: true, especie: true, estado: true }
    });
    for (const t of ultimas) {
      console.log(`  Tropa ${t.numero} | codigo: ${t.codigo} | especie: ${t.especie} | estado: ${t.estado}`);
    }
    // Usar la última
    if (ultimas.length > 0) {
      const t = ultimas[0];
      console.log(`\nUsando tropa ${t.numero}...`);
      await diagnosticarTropa(t.codigo, t.numero);
    }
  } else {
    console.log(`Tropa 203: codigo=${tropa203.codigo} | especie=${tropa203.especie} | estado=${tropa203.estado}`);
    await diagnosticarTropa(tropa203.codigo, 203);
  }
}

async function diagnosticarTropa(codigo: string, numero: number) {
  const romaneos = await prisma.romaneo.findMany({
    where: { tropaCodigo: codigo, estado: 'CONFIRMADO' },
    select: {
      id: true,
      garron: true,
      numeroAnimal: true,
      tipoAnimal: true,
      denticion: true,
      raza: true,
      pesoVivo: true,
      estado: true,
    },
    orderBy: { garron: 'asc' }
  });

  console.log(`\nRomaneos confirmados: ${romaneos.length}`);
  console.log('');

  // Mostrar columnas como se verían en SIGICA y en la planilla Excel
  console.log('Garron | Animal | Raza | Denticion(raw) | Denticion(SIGICA) | TipoAnimal | Clasificacion(SIGICA) | Clasificacion(Rinde)');
  console.log('-------|--------|------|----------------|------------------|------------|---------------------|---------------------');

  for (const rom of romaneos) {
    // Cómo lo hace SIGICA (exportacion-csv)
    function denticionToPrefix(d: string | null | undefined): string {
      if (!d) return '';
      const num = d.replace(/\D/g, '');
      return num ? `${num}D` : '';
    }
    const prefix = denticionToPrefix(rom.denticion);
    const tipo = rom.tipoAnimal || '';
    const clasifSIGICA = prefix && tipo ? `${prefix} - ${tipo}` : tipo || prefix || '';

    // Cómo lo hace Rinde (rinde-tropa-detalle)
    const dStr = rom.denticion || '';
    const tStr = rom.tipoAnimal || '';
    const clasifRinde = dStr && tStr ? `${dStr} - ${tStr}` : tStr || dStr || '';

    console.log(`${String(rom.garron).padStart(5)} | ${String(rom.numeroAnimal || '-').padStart(6)} | ${(rom.raza || '-').padStart(4)} | ${(rom.denticion || 'NULL').padStart(14)} | ${prefix.padStart(16)} | ${tipo.padStart(10)} | ${clasifSIGICA.padStart(19)} | ${clasifRinde.padStart(19)}`);
  }

  // Mostrar valores únicos de denticion para ver qué hay en BD
  const denticiones = [...new Set(romaneos.map(r => r.denticion).filter(Boolean))];
  const tipos = [...new Set(romaneos.map(r => r.tipoAnimal).filter(Boolean))];
  console.log(`\nValores de denticion en BD: ${denticiones.join(', ') || 'NINGUNO'}`);
  console.log(`Valores de tipoAnimal en BD: ${tipos.join(', ') || 'NINGUNO'}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
