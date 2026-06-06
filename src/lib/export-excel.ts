import ExcelJS from 'exceljs';

// Helper para descargar blobs sin file-saver
function saveAs(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  // Delay revokeObjectURL to allow the browser to start the download
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}

// ==================== TIPOS ====================

interface SheetData {
  name: string;
  headers: string[];
  data: any[][];
}

interface FaenaData {
  fecha: Date | string;
  tropaNumero: number;
  productor: string;
  cantidadAnimales: number;
  pesoVivoTotal: number;
  pesoFrioTotal: number;
  rinde: number;
  observaciones?: string;
}

interface RendimientoData {
  fecha: Date | string;
  periodo: string;
  tipoAnimal?: string;
  cantidadAnimales: number;
  pesoVivoTotal: number;
  pesoFrioTotal: number;
  rindePromedio: number;
  rindeMaximo: number;
  rindeMinimo: number;
}

interface StockData {
  codigo: string;
  insumo: string;
  categoria?: string;
  deposito: string;
  cantidad: number;
  unidad: string;
  stockMinimo: number;
  estado: 'NORMAL' | 'BAJO_MINIMO';
}

interface MovimientoCajaData {
  fecha: Date | string;
  tipo: 'INGRESO' | 'EGRESO';
  concepto: string;
  categoria?: string;
  monto: number;
  formaPago?: string;
  observaciones?: string;
}

interface CuentaCorrienteMovimiento {
  fecha: Date | string;
  tipo: 'FACTURA' | 'PAGO' | 'NOTA_CREDITO' | 'NOTA_DEBITO';
  comprobante: string;
  debe: number;
  haber: number;
  saldo: number;
}

interface CuentaCorrienteData {
  tercero: {
    nombre: string;
    cuit?: string;
    tipo: 'CLIENTE' | 'PROVEEDOR';
  };
  movimientos: CuentaCorrienteMovimiento[];
  saldoFinal: number;
  resumen: {
    dias30: number;
    dias60: number;
    dias90: number;
    masDe90: number;
    total: number;
  };
}

interface FacturaExportData {
  numero: string;
  fecha: Date | string;
  cliente: string;
  subtotal: number;
  iva: number;
  total: number;
  estado: string;
  condicionVenta?: string;
}

interface OrdenCompraExportData {
  numero: string;
  fecha: Date | string;
  proveedor: string;
  total: number;
  estado: string;
  condicionesPago?: string;
}

// ==================== UTILIDADES ====================

/**
 * Formatea una fecha para Excel
 */
function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-AR');
}

/**
 * Formatea un número como moneda
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(value);
}

/**
 * Aplica estilos a una hoja de Excel (auto-width de columnas)
 */
function applySheetStyles(ws: ExcelJS.Worksheet) {
  // Calcular ancho máximo por columna usando rowCount y columnCount
  const totalRows = ws.rowCount;
  const totalCols = ws.columnCount;

  if (totalRows === 0 || totalCols === 0) return;

  for (let colNum = 1; colNum <= totalCols; colNum++) {
    let maxW = 10;
    for (let rowNum = 1; rowNum <= totalRows; rowNum++) {
      const cell = ws.getCell(rowNum, colNum);
      if (cell.value) {
        const cellValue = String(cell.value);
        maxW = Math.max(maxW, cellValue.length + 2);
      }
    }
    ws.getColumn(colNum).width = Math.min(maxW, 50); // Máximo 50 caracteres
  }
}

/**
 * Crea una hoja de Excel con datos y estilos dentro de un workbook
 */
function createSheetWithData(
  wb: ExcelJS.Workbook,
  sheetName: string,
  headers: string[],
  data: any[][],
  title?: string
): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(sheetName.substring(0, 31)); // Excel limita a 31 caracteres

  // Agregar título si existe
  if (title) {
    ws.addRow([title]);
    ws.addRow([]); // blank row
  }

  // Agregar encabezado
  ws.addRow(headers);

  // Agregar datos
  data.forEach(row => ws.addRow(row));

  // Aplicar auto-width
  applySheetStyles(ws);

  return ws;
}

// ==================== CLASE EXPORTADORA EXCEL ====================

export class ExcelExporter {
  /**
   * Exporta datos a Excel genérico
   */
  static exportToExcel(options: {
    filename: string;
    sheets: SheetData[];
    title?: string;
  }): void {
    (async () => {
      const { filename, sheets, title } = options;
      const wb = new ExcelJS.Workbook();

      sheets.forEach((sheet) => {
        createSheetWithData(wb, sheet.name, sheet.headers, sheet.data, title);
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      saveAs(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
    })();
  }

  /**
   * Exporta reporte de faena
   */
  static exportFaenaReport(data: FaenaData[], filename: string = 'reporte_faena'): void {
    const headers = [
      'Fecha',
      'Tropa',
      'Productor',
      'Cantidad Animales',
      'Peso Vivo Total (kg)',
      'Peso Frío Total (kg)',
      'Rinde (%)',
      'Observaciones',
    ];

    const rows = data.map((d) => [
      formatDate(d.fecha),
      `T-${d.tropaNumero}`,
      d.productor,
      d.cantidadAnimales,
      d.pesoVivoTotal,
      d.pesoFrioTotal,
      d.rinde.toFixed(2),
      d.observaciones || '',
    ]);

    // Agregar fila de totales
    const totalAnimales = data.reduce((sum, d) => sum + d.cantidadAnimales, 0);
    const totalPesoVivo = data.reduce((sum, d) => sum + d.pesoVivoTotal, 0);
    const totalPesoFrio = data.reduce((sum, d) => sum + d.pesoFrioTotal, 0);
    const rindePromedio = totalPesoVivo > 0 ? (totalPesoFrio / totalPesoVivo) * 100 : 0;

    rows.push([
      '',
      '',
      'TOTALES',
      totalAnimales,
      totalPesoVivo,
      totalPesoFrio,
      rindePromedio.toFixed(2),
      '',
    ]);

    this.exportToExcel({
      filename,
      sheets: [{ name: 'Faena', headers, data: rows }],
      title: 'Reporte de Faena - Solemar Alimentaria',
    });
  }

  /**
   * Exporta reporte de rendimientos
   */
  static exportRendimientoReport(
    data: RendimientoData[],
    filename: string = 'reporte_rendimientos'
  ): void {
    const headers = [
      'Período',
      'Fecha',
      'Tipo Animal',
      'Cantidad Animales',
      'Peso Vivo Total (kg)',
      'Peso Frío Total (kg)',
      'Rinde Promedio (%)',
      'Rinde Máximo (%)',
      'Rinde Mínimo (%)',
    ];

    const rows = data.map((d) => [
      d.periodo,
      formatDate(d.fecha),
      d.tipoAnimal || 'Todos',
      d.cantidadAnimales,
      d.pesoVivoTotal,
      d.pesoFrioTotal,
      d.rindePromedio.toFixed(2),
      d.rindeMaximo.toFixed(2),
      d.rindeMinimo.toFixed(2),
    ]);

    // Estadísticas
    const rindePromedioGeneral =
      data.length > 0
        ? data.reduce((sum, d) => sum + d.rindePromedio, 0) / data.length
        : 0;
    const mejorRinde =
      data.length > 0 ? Math.max(...data.map((d) => d.rindePromedio)) : 0;
    const peorRinde =
      data.length > 0 ? Math.min(...data.map((d) => d.rindePromedio)) : 0;

    rows.push(['', '', '', '', '', '', '', '', '']);
    rows.push([
      'ESTADÍSTICAS',
      '',
      '',
      '',
      '',
      '',
      'Rinde Prom.',
      'Mejor Rinde',
      'Peor Rinde',
    ]);
    rows.push([
      '',
      '',
      '',
      '',
      '',
      '',
      rindePromedioGeneral.toFixed(2),
      mejorRinde.toFixed(2),
      peorRinde.toFixed(2),
    ]);

    this.exportToExcel({
      filename,
      sheets: [{ name: 'Rendimientos', headers, data: rows }],
      title: 'Reporte de Rendimientos - Solemar Alimentaria',
    });
  }

  /**
   * Exporta reporte de stock
   */
  static exportStockReport(
    data: StockData[],
    filename: string = 'reporte_stock'
  ): void {
    const headers = [
      'Código',
      'Insumo',
      'Categoría',
      'Depósito',
      'Cantidad',
      'Unidad',
      'Stock Mínimo',
      'Estado',
    ];

    const rows = data.map((d) => [
      d.codigo || '',
      d.insumo,
      d.categoria || '',
      d.deposito,
      d.cantidad,
      d.unidad,
      d.stockMinimo,
      d.estado,
    ]);

    // Resumen
    const bajoMinimo = data.filter((d) => d.estado === 'BAJO_MINIMO').length;
    rows.push(['', '', '', '', '', '', '', '']);
    rows.push(['RESUMEN', '', '', '', '', '', '', '']);
    rows.push(['Total items:', data.length, '', '', '', '', '', '']);
    rows.push(['Items bajo mínimo:', bajoMinimo, '', '', '', '', '', '']);

    this.exportToExcel({
      filename,
      sheets: [{ name: 'Stock', headers, data: rows }],
      title: 'Reporte de Stock de Insumos - Solemar Alimentaria',
    });
  }

  /**
   * Exporta cuenta corriente
   */
  static exportCuentaCorriente(
    data: CuentaCorrienteData,
    filename?: string
  ): void {
    const defaultFilename = `cuenta_corriente_${data.tercero.nombre.replace(/\s+/g, '_')}`;
    const headers = [
      'Fecha',
      'Tipo',
      'Comprobante',
      'Debe',
      'Haber',
      'Saldo',
    ];

    const rows = data.movimientos.map((m) => [
      formatDate(m.fecha),
      m.tipo,
      m.comprobante,
      m.debe > 0 ? m.debe : '',
      m.haber > 0 ? m.haber : '',
      m.saldo,
    ]);

    // Agregar resumen
    rows.push(['', '', '', '', '', '']);
    rows.push(['SALDO FINAL', '', '', '', '', data.saldoFinal]);
    rows.push(['', '', '', '', '', '']);
    rows.push(['RESUMEN POR ANTIGÜEDAD', '', '', '', '', '']);
    rows.push(['0-30 días:', data.resumen.dias30, '', '', '', '']);
    rows.push(['31-60 días:', data.resumen.dias60, '', '', '', '']);
    rows.push(['61-90 días:', data.resumen.dias90, '', '', '', '']);
    rows.push(['Más de 90 días:', data.resumen.masDe90, '', '', '', '']);
    rows.push(['TOTAL:', data.resumen.total, '', '', '', '']);

    this.exportToExcel({
      filename: filename || defaultFilename,
      sheets: [{ name: 'Cuenta Corriente', headers, data: rows }],
      title: `Cuenta Corriente - ${data.tercero.nombre}`,
    });
  }

  /**
   * Exporta movimientos de caja
   */
  static exportMovimientosCaja(
    data: MovimientoCajaData[],
    cajaNombre?: string,
    filename: string = 'movimientos_caja'
  ): void {
    const headers = [
      'Fecha',
      'Tipo',
      'Concepto',
      'Categoría',
      'Monto',
      'Forma de Pago',
      'Observaciones',
    ];

    const rows = data.map((d) => [
      formatDate(d.fecha),
      d.tipo,
      d.concepto,
      d.categoria || '',
      d.monto,
      d.formaPago || '',
      d.observaciones || '',
    ]);

    // Totales
    const totalIngresos = data
      .filter((d) => d.tipo === 'INGRESO')
      .reduce((sum, d) => sum + d.monto, 0);
    const totalEgresos = data
      .filter((d) => d.tipo === 'EGRESO')
      .reduce((sum, d) => sum + d.monto, 0);
    const saldo = totalIngresos - totalEgresos;

    rows.push(['', '', '', '', '', '', '']);
    rows.push(['RESUMEN', '', '', '', '', '', '']);
    rows.push(['Total Ingresos:', totalIngresos, '', '', '', '', '']);
    rows.push(['Total Egresos:', totalEgresos, '', '', '', '', '']);
    rows.push(['Saldo:', saldo, '', '', '', '', '']);

    this.exportToExcel({
      filename,
      sheets: [
        { name: cajaNombre?.substring(0, 31) || 'Movimientos', headers, data: rows },
      ],
      title: cajaNombre
        ? `Movimientos de Caja: ${cajaNombre}`
        : 'Movimientos de Caja',
    });
  }

  /**
   * Exporta listado de facturas
   */
  static exportFacturas(
    data: FacturaExportData[],
    filename: string = 'facturas'
  ): void {
    const headers = [
      'Número',
      'Fecha',
      'Cliente',
      'Subtotal',
      'IVA',
      'Total',
      'Estado',
      'Condición Venta',
    ];

    const rows = data.map((d) => [
      d.numero,
      formatDate(d.fecha),
      d.cliente,
      d.subtotal,
      d.iva,
      d.total,
      d.estado,
      d.condicionVenta || '',
    ]);

    // Totales
    const totalSubtotal = data.reduce((sum, d) => sum + d.subtotal, 0);
    const totalIVA = data.reduce((sum, d) => sum + d.iva, 0);
    const totalGeneral = data.reduce((sum, d) => sum + d.total, 0);

    rows.push(['', '', '', '', '', '', '', '']);
    rows.push(['TOTALES', '', '', totalSubtotal, totalIVA, totalGeneral, '', '']);

    this.exportToExcel({
      filename,
      sheets: [{ name: 'Facturas', headers, data: rows }],
      title: 'Listado de Facturas - Solemar Alimentaria',
    });
  }

  /**
   * Exporta órdenes de compra
   */
  static exportOrdenesCompra(
    data: OrdenCompraExportData[],
    filename: string = 'ordenes_compra'
  ): void {
    const headers = [
      'Número',
      'Fecha',
      'Proveedor',
      'Total',
      'Estado',
      'Condiciones de Pago',
    ];

    const rows = data.map((d) => [
      d.numero,
      formatDate(d.fecha),
      d.proveedor,
      d.total,
      d.estado,
      d.condicionesPago || '',
    ]);

    const totalGeneral = data.reduce((sum, d) => sum + d.total, 0);
    rows.push(['', '', '', '', '', '']);
    rows.push(['TOTAL GENERAL', '', '', totalGeneral, '', '']);

    this.exportToExcel({
      filename,
      sheets: [{ name: 'Ordenes de Compra', headers, data: rows }],
      title: 'Listado de Órdenes de Compra - Solemar Alimentaria',
    });
  }

  /**
   * Exporta datos genéricos a CSV
   */
  static exportToCSV(
    headers: string[],
    data: any[][],
    filename: string
  ): void {
    const csvData = [headers, ...data];
    const csv = csvData.map((row) => row.join(';')).join('\n');

    // Agregar BOM para que Excel reconozca UTF-8
    const blob = new Blob(['\ufeff' + csv], {
      type: 'text/csv;charset=utf-8;',
    });

    saveAs(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
  }

  /**
   * Exporta múltiples hojas desde un objeto
   */
  static exportMultipleSheets(
    data: Record<string, { headers: string[]; rows: any[][] }>,
    filename: string
  ): void {
    const sheets: SheetData[] = Object.entries(data).map(([name, content]) => ({
      name,
      headers: content.headers,
      data: content.rows,
    }));

    this.exportToExcel({ filename, sheets });
  }

  /**
   * Crea un archivo Excel desde un arreglo de objetos
   */
  static exportFromObjects<T extends Record<string, any>>(
    data: T[],
    filename: string,
    sheetName: string = 'Datos'
  ): void {
    if (data.length === 0) {
      throw new Error('No hay datos para exportar');
    }

    const headers = Object.keys(data[0]);
    const rows = data.map((item) => headers.map((h) => item[h]));

    this.exportToExcel({
      filename,
      sheets: [{ name: sheetName, headers, data: rows }],
    });
  }

  /**
   * Exporta datos de auditoría
   */
  static exportAuditoria(
    data: {
      fecha: Date | string;
      operador: string;
      modulo: string;
      accion: string;
      entidad: string;
      descripcion: string;
    }[],
    filename: string = 'auditoria'
  ): void {
    const headers = [
      'Fecha',
      'Operador',
      'Módulo',
      'Acción',
      'Entidad',
      'Descripción',
    ];

    const rows = data.map((d) => [
      formatDate(d.fecha),
      d.operador,
      d.modulo,
      d.accion,
      d.entidad,
      d.descripcion,
    ]);

    this.exportToExcel({
      filename,
      sheets: [{ name: 'Auditoría', headers, data: rows }],
      title: 'Registro de Auditoría - Solemar Alimentaria',
    });
  }

  /**
   * Exporta datos de producción
   */
  static exportProduccion(
    data: {
      fecha: Date | string;
      tropa: string;
      productor: string;
      cantidad: number;
      pesoVivo: number;
      pesoFrio: number;
      rinde: number;
    }[],
    filename: string = 'reporte_produccion'
  ): void {
    const headers = [
      'Fecha',
      'Tropa',
      'Productor',
      'Cantidad',
      'Peso Vivo (kg)',
      'Peso Frío (kg)',
      'Rinde (%)',
    ];

    const rows = data.map((d) => [
      formatDate(d.fecha),
      d.tropa,
      d.productor,
      d.cantidad,
      d.pesoVivo,
      d.pesoFrio,
      d.rinde.toFixed(2),
    ]);

    // Totales
    const totalCantidad = data.reduce((sum, d) => sum + d.cantidad, 0);
    const totalPesoVivo = data.reduce((sum, d) => sum + d.pesoVivo, 0);
    const totalPesoFrio = data.reduce((sum, d) => sum + d.pesoFrio, 0);
    const rindePromedio =
      totalPesoVivo > 0 ? (totalPesoFrio / totalPesoVivo) * 100 : 0;

    rows.push(['', '', 'TOTALES', totalCantidad, totalPesoVivo, totalPesoFrio, rindePromedio.toFixed(2)]);

    this.exportToExcel({
      filename,
      sheets: [{ name: 'Producción', headers, data: rows }],
      title: 'Reporte de Producción - Solemar Alimentaria',
    });
  }
}

export default ExcelExporter;
