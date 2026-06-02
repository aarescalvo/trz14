/**
 * Migración: Producto + C2ProductoDesposte → ProductoVendible
 * 
 * Ejecutar: npx tsx prisma/seed-migrar-productos.ts
 * 
 * Este script:
 * 1. Lee todos los registros de Producto (configuración)
 * 2. Lee todos los registros de C2ProductoDesposte (Ciclo II)
 * 3. Los migra a ProductoVendible sin duplicar códigos
 * 4. NO elimina los modelos originales (se mantienen por relaciones existentes)
 */

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('=== MIGRACIÓN PRODUCTOS → ProductoVendible ===\n')

  // 1. Leer productos existentes de ProductoVendible (para no duplicar)
  const existentes = await db.productoVendible.findMany({ select: { codigo: true } })
  const codigosExistentes = new Set(existentes.map(e => e.codigo))
  console.log(`Productos vendibles existentes: ${existentes.length}`)

  // 2. Migrar desde Producto (Configuración)
  const productos = await db.producto.findMany({
    where: { activo: true },
  })
  console.log(`Productos (Configuración) a migrar: ${productos.length}`)

  let migradosProducto = 0
  let omitidosProducto = 0

  for (const p of productos) {
    // Generar código único: usar el código existente o P-{original} si hay conflicto
    let codigo = p.codigo
    if (codigosExistentes.has(codigo)) {
      codigo = `P-${p.codigo}`
    }
    if (codigosExistentes.has(codigo)) {
      console.log(`  OMITIDO (código duplicado): ${p.codigo} - ${p.nombre}`)
      omitidosProducto++
      continue
    }

    try {
      await db.productoVendible.upsert({
        where: { codigo },
        create: {
          codigo,
          nombre: p.nombre,
          descripcion: null,
          tara: p.tara || 0,
          vencimientoDias: p.diasConservacion || 0,
          numeroRegistroSenasa: null,
          unidadMedida: 'KG',
          cantidadEtiquetas: 1,
          tieneTipificacion: p.requiereTipificacion || false,
          tipificacion: p.codigoTipificacion || null,
          categoria: p.tipoRotulo || null,
          subcategoria: null,
          especie: p.especie, // BOVINO | EQUINO
          tipo: p.tipoRotulo || null,
          delCuarto: null,
          tipoVenta: 'POR_KG',
          descripcionCircular: p.nombreReportes || null,
          precioBase: p.precio || null,
          precioDolar: 0,
          precioEuro: 0,
          precioArs: p.precio || 0,
          moneda: 'ARS',
          alicuotaIva: 21,
          producidoParaCliente: null,
          productoGeneral: false,
          productoReporteRinde: p.apareceRendimiento || false,
          tipoTrabajo: p.codigoTipoTrabajo || null,
          idiomaEtiqueta: 'ES',
          activo: p.activo,
          requiereTrazabilidad: false,
          precioActual: p.precio || 0,
        },
        update: {} // No sobrescribir si ya existe
      })
      codigosExistentes.add(codigo)
      migradosProducto++
    } catch (err: any) {
      console.log(`  ERROR migrando ${p.codigo}: ${err.message}`)
      omitidosProducto++
    }
  }

  console.log(`  Migrados: ${migradosProducto}, Omitidos: ${omitidosProducto}\n`)

  // 3. Migrar desde C2ProductoDesposte (Ciclo II)
  const productosC2 = await db.c2ProductoDesposte.findMany({
    where: { activo: true },
    include: {
      rubro: { select: { nombre: true } },
    },
  })
  console.log(`Productos Desposte (Ciclo II) a migrar: ${productosC2.length}`)

  let migradosC2 = 0
  let omitidosC2 = 0

  for (const p of productosC2) {
    let codigo = p.codigo
    if (codigosExistentes.has(codigo)) {
      codigo = `C2-${p.codigo}`
    }
    if (codigosExistentes.has(codigo)) {
      console.log(`  OMITIDO (código duplicado): ${p.codigo} - ${p.nombre}`)
      omitidosC2++
      continue
    }

    try {
      await db.productoVendible.upsert({
        where: { codigo },
        create: {
          codigo,
          nombre: p.nombre,
          descripcion: p.observaciones || null,
          tara: p.pesoTaraCaja || 0,
          vencimientoDias: p.diasVencimiento || 0,
          numeroRegistroSenasa: null,
          unidadMedida: 'KG',
          cantidadEtiquetas: 1,
          tieneTipificacion: false,
          tipificacion: null,
          categoria: p.rubro?.nombre || null,
          subcategoria: null,
          especie: p.especie, // BOVINO | EQUINO
          tipo: p.tipoCuartoOrigen || null,
          delCuarto: p.tipoCuartoOrigen || null,
          tipoVenta: 'POR_KG',
          descripcionCircular: p.nombre,
          precioBase: p.precioKg || null,
          precioDolar: 0,
          precioEuro: 0,
          precioArs: p.precioKg || 0,
          moneda: 'ARS',
          alicuotaIva: 21,
          producidoParaCliente: null,
          productoGeneral: false,
          productoReporteRinde: p.apareceRendimiento || false,
          tipoTrabajo: null,
          idiomaEtiqueta: 'ES',
          activo: p.activo,
          requiereTrazabilidad: false,
          precioActual: p.precioKg || 0,
        },
        update: {}
      })
      codigosExistentes.add(codigo)
      migradosC2++
    } catch (err: any) {
      console.log(`  ERROR migrando ${p.codigo}: ${err.message}`)
      omitidosC2++
    }
  }

  console.log(`  Migrados: ${migradosC2}, Omitidos: ${omitidosC2}\n`)

  // 4. Resumen final
  const totalFinal = await db.productoVendible.count()
  const totalActivos = await db.productoVendible.count({ where: { activo: true } })

  console.log('=== RESUMEN FINAL ===')
  console.log(`Total ProductoVendible: ${totalFinal}`)
  console.log(`Total Activos: ${totalActivos}`)
  console.log(`Migrados desde Producto: ${migradosProducto}`)
  console.log(`Migrados desde C2ProductoDesposte: ${migradosC2}`)
  console.log(`Total migrados: ${migradosProducto + migradosC2}`)
  console.log('\nModelos originales (Producto y C2ProductoDesposte) NO fueron eliminados.')
  console.log('Pueden eliminarse en el futuro cuando las relaciones estén migradas.')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
