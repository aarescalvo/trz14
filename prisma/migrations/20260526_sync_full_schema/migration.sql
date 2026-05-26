-- ============================================================================
-- COMPLETE SCHEMA SYNC MIGRATION
-- Generated from Prisma schema.prisma
-- Safe for existing databases with partial schema
-- ============================================================================
-- DO NOT USE DROP, DELETE, or TRUNCATE statements
-- All statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- ============================================================================

-- ============================================================================
-- 1. ENUM TYPES
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE "TipoCamara" AS ENUM ('FAENA', 'CUARTEO', 'DEPOSITO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoRotulo" AS ENUM ('MEDIA_RES', 'CUARTO', 'MENUDENCIA', 'PRODUCTO_TERMINADO_ENVASE_PRIMARIO', 'PRODUCTO_TERMINADO_ENVASE_SECUNDARIO', 'PRODUCTO_TERMINADO_UN_ENVASE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "RolOperador" AS ENUM ('OPERADOR', 'SUPERVISOR', 'ADMINISTRADOR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoProductor" AS ENUM ('PRODUCTOR', 'CONSIGNATARIO', 'AMBOS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "Especie" AS ENUM ('BOVINO', 'EQUINO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoAnimal" AS ENUM ('TO', 'VA', 'VQ', 'MEJ', 'NO', 'NT', 'PADRILLO', 'POTRILLO', 'YEGUA', 'CABALLO', 'BURRO', 'MULA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoTropa" AS ENUM ('RECIBIDO', 'EN_CORRAL', 'EN_PESAJE', 'PESADO', 'LISTO_FAENA', 'EN_FAENA', 'FAENADO', 'DESPACHADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoAnimal" AS ENUM ('RECIBIDO', 'PESADO', 'EN_FAENA', 'FAENADO', 'EN_CAMARA', 'DESPACHADO', 'FALLECIDO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoPesajeCamion" AS ENUM ('INGRESO_HACIENDA', 'PESAJE_PARTICULAR', 'SALIDA_MERCADERIA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoPesaje" AS ENUM ('ABIERTO', 'CERRADO', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoListaFaena" AS ENUM ('ABIERTA', 'EN_PROCESO', 'CERRADA', 'ANULADA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoRomaneo" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "LadoMedia" AS ENUM ('IZQUIERDA', 'DERECHA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "SiglaMedia" AS ENUM ('A', 'T', 'D');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoMediaRes" AS ENUM ('EN_CAMARA', 'EN_CUARTEO', 'DESPACHADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoCCIR" AS ENUM ('EMITIDO', 'ANULADO', 'EXPORTADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoDeclaracionJurada" AS ENUM ('ACTIVA', 'ANULADA', 'UTILIZADA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoFactura" AS ENUM ('PENDIENTE', 'EMITIDA', 'PAGADA', 'ANULADA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoProductoFactura" AS ENUM ('MEDIA_RES', 'CUARTO_DELANTERO', 'CUARTO_TRASERO', 'MENUDENCIA', 'OTRO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "CategoriaInsumo" AS ENUM ('EMBALAJE', 'ETIQUETAS', 'HIGIENE', 'PROTECCION', 'HERRAMIENTAS', 'OFICINA', 'OTROS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoProductoEnum" AS ENUM ('CORTE_VACUNO', 'CORTE_EQUINO', 'MENUDENCIA', 'SUBPRODUCTO', 'PRODUCTO_ELAVORADO', 'DESPOSTADO', 'OTRO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoCuarto" AS ENUM ('EN_CAMARA', 'EN_DESPOSTADA', 'DESPOSTADO', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "SiglaCuarto" AS ENUM ('A', 'D', 'T');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoLote" AS ENUM ('ABIERTO', 'CERRADO', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoCaja" AS ENUM ('EN_CAMARA', 'EN_PALLETS', 'DESPACHADA', 'ANULADA', 'ARMADA', 'DEGRADADA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoPallet" AS ENUM ('ARMADO', 'COMPLETO', 'DESPACHADO', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoMermaDespostada" AS ENUM ('HUESO', 'GRASA', 'INCOMESTIBLE', 'RECORTES', 'OTRO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoExpedicion" AS ENUM ('PENDIENTE', 'EN_CARGA', 'DESPACHADO', 'ENTREGADO', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoReclamo" AS ENUM ('RECLAMO', 'QUEJA', 'INCIDENTE', 'CONSULTA', 'SUGERENCIA', 'OTRO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoRespuesta" AS ENUM ('RESPUESTA_CLIENTE', 'NOTA_INTERNA', 'SEGUIMIENTO', 'CIERRE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoArchivo" AS ENUM ('FOTO', 'PDF', 'DOCUMENTO', 'OTRO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoReclamo" AS ENUM ('PENDIENTE', 'EN_REVISION', 'RESPONDIDO', 'RESUELTO', 'CERRADO', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "PrioridadReclamo" AS ENUM ('BAJA', 'NORMAL', 'ALTA', 'URGENTE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoReporteEmail" AS ENUM ('STOCK_DIARIO', 'STOCK_SEMANAL', 'FAENA_DIARIO', 'FAENA_SEMANAL', 'RENDIMIENTO_DIARIO', 'RENDIMIENTO_SEMANAL', 'ALERTA_STOCK_BAJO', 'ALERTA_CAMARA', 'RESUMEN_MENSUAL', 'PERSONALIZADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "FrecuenciaEmail" AS ENUM ('DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'MANUAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoEnvioEmail" AS ENUM ('PENDIENTE', 'ENVIANDO', 'ENVIADO', 'ERROR', 'REINTENTO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "FormatoReporte" AS ENUM ('PDF', 'EXCEL', 'AMBOS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoDespacho" AS ENUM ('PENDIENTE', 'EN_CARGA', 'DESPACHADO', 'ENTREGADO', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoProductoPrecio" AS ENUM ('MEDIA_RES_BOVINA', 'MEDIA_RES_EQUINA', 'CUARTO_DELANTERO', 'CUARTO_TRASERO', 'MENUDENCIA', 'SERVICIO_DESPOSTE', 'SERVICIO_FRIO', 'CARNE_CORTE', 'OTRO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoRendering" AS ENUM ('GRASA', 'DESPERDICIOS', 'FONDO_DIGESTOR', 'SANGRE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "CategoriaCuero" AS ENUM ('SALADO', 'FRESCO', 'CORTADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoDestinoCuero" AS ENUM ('CURTIEMBRE', 'VENTA_DIRECTA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoMovimientoDespostada" AS ENUM ('CORTE', 'LIMPIEZA', 'DESPERDICIO', 'HUESO', 'GRASA', 'MERMA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "DestinoCorte" AS ENUM ('PRODUCCION', 'RECORTE', 'DESECHO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "AlicuotaIVA" AS ENUM ('CERO', 'DIEZ_CINCO', 'VEINTIUNO', 'VEINTISIETE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "CategoriaInsumoTipo" AS ENUM ('EMBALAJE', 'ETIQUETAS', 'HIGIENE', 'PROTECCION', 'HERRAMIENTAS', 'OFICINA', 'OTROS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "ClasificacionPH" AS ENUM ('NORMAL', 'INTERMEDIO', 'DFD', 'ALTO', 'SIN_CLASIFICAR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "CondicionIva" AS ENUM ('RI', 'CF', 'MT', 'EX', 'NC');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "ConservacionCuero" AS ENUM ('SALADO', 'FRESCO', 'CORTADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoAsientoContable" AS ENUM ('BORRADOR', 'CONFIRMADO', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoBalanza" AS ENUM ('DESCONECTADA', 'CONECTADA', 'ERROR', 'CALIBRANDO', 'LISTA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoBorrador" AS ENUM ('ACTIVO', 'RECUPERADO', 'DESCARTADO', 'EXPIRADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoCheque" AS ENUM ('RECIBIDO', 'DEPOSITADO', 'COBRADO', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoCuero" AS ENUM ('PENDIENTE', 'DESPACHADO', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoDetalleOrden" AS ENUM ('PENDIENTE', 'PARCIAL', 'COMPLETADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoEmpaque" AS ENUM ('PENDIENTE', 'EMPACADO', 'DESPACHADO', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoIngreso" AS ENUM ('PENDIENTE', 'INGRESADO', 'EN_PROCESO', 'PROCESADO', 'DEVUELTO', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoInventario" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'COMPLETADO', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoNota" AS ENUM ('EMITIDA', 'APLICADA', 'ANULADA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoOrdenCompra" AS ENUM ('PENDIENTE', 'APROBADA', 'ENVIADA', 'PARCIAL', 'COMPLETADA', 'ANULADA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'APLICADO', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoRecepcion" AS ENUM ('PARCIAL', 'COMPLETA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoRendering" AS ENUM ('REGISTRADO', 'DESPACHADO', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "EstadoReporteSenasa" AS ENUM ('PENDIENTE', 'ENVIADO', 'CONFIRMADO', 'ERROR', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "ProtocoloBalanza" AS ENUM ('GENERICO', 'TOLEDO', 'METTLER', 'OHAUS', 'DIGI', 'ADAM', 'CUSTOM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoAsientoContable" AS ENUM ('INGRESO', 'EGRESO', 'AJUSTE', 'APERTURA', 'CIERRE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoCliente" AS ENUM ('USUARIO_FAENA', 'COMPRADOR', 'PROVEEDOR_TERCE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoComprobante" AS ENUM ('FACTURA_A', 'FACTURA_B', 'FACTURA_C', 'REMITO', 'NOTA_CREDITO', 'NOTA_DEBITO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoConexionBalanza" AS ENUM ('SERIAL', 'TCP', 'SIMULADA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoCuarteo" AS ENUM ('DELANTERO_TRASERO', 'CUARTOS_IGUALES', 'OTRO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoCuarto" AS ENUM ('DELANTERO', 'TRASERO', 'ASADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoDecomiso" AS ENUM ('TOTAL', 'PARCIAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoDegradacion" AS ENUM ('TRIMMING', 'GOLPEADO', 'DECOMISO_PARCIAL', 'APROVECHAMIENTO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoGrasa" AS ENUM ('RENDERING', 'GRASA_DRESSING', 'GRASA_COMESTIBLE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoMedia" AS ENUM ('DELANTERA', 'TRASERA', 'ENTERA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoMovimientoInsumo" AS ENUM ('INGRESO', 'EGRESO', 'TRANSFERENCIA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'PERDIDA', 'DEVOLUCION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoPlanCuenta" AS ENUM ('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'EGRESO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoProveedor" AS ENUM ('INSUMOS', 'SERVICIOS', 'EQUIPOS', 'EMPAQUES', 'LIMPIEZA', 'VETERINARIOS', 'OTROS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoReporteSenasa" AS ENUM ('FAENA_MENSUAL', 'EXISTENCIAS', 'MOVIMIENTOS', 'DECOMISOS', 'PRODUCCION', 'STOCK');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    CREATE TYPE "TipoSubproducto" AS ENUM ('HUESO', 'GRASA', 'INCOMESTIBLE', 'RECORTES', 'OTRO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 2. MISSING COLUMNS FOR EXISTING TABLES
-- ============================================================================

-- Tropa: missing columns
ALTER TABLE "Tropa" ADD COLUMN IF NOT EXISTS "codigoSimplificado" TEXT;
ALTER TABLE "Tropa" ADD COLUMN IF NOT EXISTS "fechaFaena" TIMESTAMP(3);
ALTER TABLE "Tropa" ADD COLUMN IF NOT EXISTS "kgGancho" DOUBLE PRECISION;

-- MediaRes: missing column
ALTER TABLE "MediaRes" ADD COLUMN IF NOT EXISTS "usuarioFaenaId" TEXT;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "MediaRes" LIMIT 0) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'MediaRes_usuarioFaenaId_fkey' AND table_name = 'MediaRes'
  ) THEN
    ALTER TABLE "MediaRes" ADD CONSTRAINT "MediaRes_usuarioFaenaId_fkey" FOREIGN KEY ("usuarioFaenaId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Operador: missing columns
ALTER TABLE "Operador" ADD COLUMN IF NOT EXISTS "pinSupervisor" TEXT;
ALTER TABLE "Operador" ADD COLUMN IF NOT EXISTS "puedeCalidad" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Operador" ADD COLUMN IF NOT EXISTS "puedeAutorizarReportes" BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- 3. NEW TABLES (models not in existing DB)
-- ============================================================================

-- ConfiguracionFrigorifico
CREATE TABLE IF NOT EXISTS "ConfiguracionFrigorifico" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL DEFAULT 'Solemar Alimentaria',
    "direccion" TEXT,
    "numeroEstablecimiento" TEXT,
    "cuit" TEXT,
    "numeroMatricula" TEXT,
    "logo" TEXT,
    "emailHost" TEXT,
    "emailPuerto" INTEGER DEFAULT 587,
    "emailUsuario" TEXT,
    "emailPassword" TEXT,
    "emailHabilitado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConfiguracionFrigorifico_pkey" PRIMARY KEY ("id")
);

-- Tipificador
CREATE TABLE IF NOT EXISTS "Tipificador" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "numero" TEXT,
    "matricula" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tipificador_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Tipificador_matricula_key" ON "Tipificador"("matricula");

-- Producto
CREATE TABLE IF NOT EXISTS "Producto" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombreReportes" TEXT,
    "especie" "Especie" NOT NULL DEFAULT 'BOVINO',
    "codigoTipificacion" TEXT,
    "codigoTipoTrabajo" TEXT,
    "codigoTransporte" TEXT,
    "codigoDestino" TEXT,
    "tara" DOUBLE PRECISION,
    "diasConservacion" INTEGER,
    "requiereTipificacion" BOOLEAN NOT NULL DEFAULT false,
    "tipoRotulo" "TipoRotulo",
    "precio" DOUBLE PRECISION,
    "temperaturaConservacion" TEXT,
    "apareceRendimiento" BOOLEAN NOT NULL DEFAULT false,
    "apareceStock" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Producto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Producto_codigo_especie_key" ON "Producto"("codigo", "especie");
CREATE INDEX IF NOT EXISTS "Producto_especie_idx" ON "Producto"("especie");

-- TipoMenudencia
CREATE TABLE IF NOT EXISTS "TipoMenudencia" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TipoMenudencia_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TipoMenudencia_nombre_key" ON "TipoMenudencia"("nombre");

-- Transportista
CREATE TABLE IF NOT EXISTS "Transportista" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "cuit" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transportista_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Transportista_cuit_key" ON "Transportista"("cuit");

-- ProductorConsignatario
CREATE TABLE IF NOT EXISTS "ProductorConsignatario" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "cuit" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "tipo" "TipoProductor" NOT NULL DEFAULT 'PRODUCTOR',
    "numeroRenspa" TEXT,
    "numeroEstablecimiento" TEXT,
    "localidad" TEXT,
    "provincia" TEXT,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductorConsignatario_pkey" PRIMARY KEY ("id")
);

-- CodigoEspecie
CREATE TABLE IF NOT EXISTS "CodigoEspecie" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodigoEspecie_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CodigoEspecie_codigo_key" ON "CodigoEspecie"("codigo");

-- CodigoTransporte
CREATE TABLE IF NOT EXISTS "CodigoTransporte" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodigoTransporte_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CodigoTransporte_codigo_key" ON "CodigoTransporte"("codigo");

-- CodigoDestino
CREATE TABLE IF NOT EXISTS "CodigoDestino" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodigoDestino_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CodigoDestino_codigo_key" ON "CodigoDestino"("codigo");

-- CodigoTipoTrabajo
CREATE TABLE IF NOT EXISTS "CodigoTipoTrabajo" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodigoTipoTrabajo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CodigoTipoTrabajo_codigo_key" ON "CodigoTipoTrabajo"("codigo");

-- CodigoTipificacion
CREATE TABLE IF NOT EXISTS "CodigoTipificacion" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "especie" "Especie" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodigoTipificacion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CodigoTipificacion_codigo_key" ON "CodigoTipificacion"("codigo");

-- TropaAnimalCantidad
CREATE TABLE IF NOT EXISTS "TropaAnimalCantidad" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tropaId" TEXT NOT NULL,
    "tipoAnimal" "TipoAnimal" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TropaAnimalCantidad_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TropaAnimalCantidad_tropaId_tipoAnimal_key" ON "TropaAnimalCantidad"("tropaId", "tipoAnimal");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'TropaAnimalCantidad_tropaId_fkey') THEN
    ALTER TABLE "TropaAnimalCantidad" ADD CONSTRAINT "TropaAnimalCantidad_tropaId_fkey" FOREIGN KEY ("tropaId") REFERENCES "Tropa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Tropa indexes
CREATE INDEX IF NOT EXISTS "Tropa_especie_idx" ON "Tropa"("especie");
CREATE INDEX IF NOT EXISTS "Tropa_estado_idx" ON "Tropa"("estado");
CREATE INDEX IF NOT EXISTS "Tropa_fechaRecepcion_idx" ON "Tropa"("fechaRecepcion");

-- PesajeIndividual
CREATE TABLE IF NOT EXISTS "PesajeIndividual" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "animalId" TEXT NOT NULL,
    "peso" DOUBLE PRECISION NOT NULL,
    "caravana" TEXT,
    "observaciones" TEXT,
    "operadorId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PesajeIndividual_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PesajeIndividual_animalId_key" ON "PesajeIndividual"("animalId");
CREATE INDEX IF NOT EXISTS "PesajeIndividual_fecha_idx" ON "PesajeIndividual"("fecha");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PesajeIndividual_animalId_fkey') THEN
    ALTER TABLE "PesajeIndividual" ADD CONSTRAINT "PesajeIndividual_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Menudencia
CREATE TABLE IF NOT EXISTS "Menudencia" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tipoMenudenciaId" TEXT NOT NULL,
    "tropaCodigo" TEXT,
    "pesoIngreso" DOUBLE PRECISION,
    "pesoElaborado" DOUBLE PRECISION,
    "numeroBolsa" INTEGER,
    "cantidadBolsas" INTEGER,
    "operadorElaboracion" TEXT,
    "fechaIngreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaElaboracion" TIMESTAMP(3),
    "rotuloImpreso" BOOLEAN NOT NULL DEFAULT false,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Menudencia_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Menudencia_tropaCodigo_idx" ON "Menudencia"("tropaCodigo");
CREATE INDEX IF NOT EXISTS "Menudencia_fechaIngreso_idx" ON "Menudencia"("fechaIngreso");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Menudencia_tipoMenudenciaId_fkey') THEN
    ALTER TABLE "Menudencia" ADD CONSTRAINT "Menudencia_tipoMenudenciaId_fkey" FOREIGN KEY ("tipoMenudenciaId") REFERENCES "TipoMenudencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Auditoria
CREATE TABLE IF NOT EXISTS "Auditoria" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "operadorId" TEXT,
    "modulo" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "descripcion" TEXT NOT NULL,
    "datosAntes" TEXT,
    "datosDespues" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Auditoria_modulo_idx" ON "Auditoria"("modulo");
CREATE INDEX IF NOT EXISTS "Auditoria_fecha_idx" ON "Auditoria"("fecha");

-- Numerador
CREATE TABLE IF NOT EXISTS "Numerador" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "ultimoNumero" INTEGER NOT NULL DEFAULT 0,
    "anio" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Numerador_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Numerador_nombre_key" ON "Numerador"("nombre");

-- CCIR
CREATE TABLE IF NOT EXISTS "CCIR" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "numeroCertificado" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "producto" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "lote" TEXT,
    "paisDestino" TEXT NOT NULL,
    "puertoDestino" TEXT,
    "numeroEstablecimiento" TEXT,
    "nombreEstablecimiento" TEXT,
    "cuitEstablecimiento" TEXT,
    "nombreImportador" TEXT,
    "direccionImportador" TEXT,
    "numeroContenedor" TEXT,
    "matriculaTransporte" TEXT,
    "numeroPrecintos" TEXT,
    "observaciones" TEXT,
    "estado" "EstadoCCIR" NOT NULL DEFAULT 'EMITIDO',
    "operadorId" TEXT,
    "fechaImpresion" TIMESTAMP(3),
    "vecesImpreso" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CCIR_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CCIR_numeroCertificado_key" ON "CCIR"("numeroCertificado");
CREATE INDEX IF NOT EXISTS "CCIR_fechaEmision_idx" ON "CCIR"("fechaEmision");
CREATE INDEX IF NOT EXISTS "CCIR_estado_idx" ON "CCIR"("estado");
CREATE INDEX IF NOT EXISTS "CCIR_paisDestino_idx" ON "CCIR"("paisDestino");

-- DeclaracionJurada
CREATE TABLE IF NOT EXISTS "DeclaracionJurada" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "numeroDeclaracion" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productorId" TEXT,
    "nombreProductor" TEXT NOT NULL,
    "cuitProductor" TEXT,
    "direccionProductor" TEXT,
    "procedencia" TEXT,
    "especie" "Especie" NOT NULL DEFAULT 'BOVINO',
    "cantidadCabezas" INTEGER NOT NULL,
    "numeroTropa" TEXT,
    "numeroLote" TEXT,
    "numeroDTE" TEXT,
    "numeroGuia" TEXT,
    "declaracionSanidad" TEXT,
    "procedenciaLibre" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "estado" "EstadoDeclaracionJurada" NOT NULL DEFAULT 'ACTIVA',
    "operadorId" TEXT,
    "fechaImpresion" TIMESTAMP(3),
    "vecesImpreso" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeclaracionJurada_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DeclaracionJurada_numeroDeclaracion_key" ON "DeclaracionJurada"("numeroDeclaracion");
CREATE INDEX IF NOT EXISTS "DeclaracionJurada_fecha_idx" ON "DeclaracionJurada"("fecha");
CREATE INDEX IF NOT EXISTS "DeclaracionJurada_estado_idx" ON "DeclaracionJurada"("estado");
CREATE INDEX IF NOT EXISTS "DeclaracionJurada_especie_idx" ON "DeclaracionJurada"("especie");

-- Factura
CREATE TABLE IF NOT EXISTS "Factura" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "numero" TEXT NOT NULL,
    "numeroInterno" INTEGER NOT NULL,
    "clienteId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEmision" TIMESTAMP(3),
    "fechaPago" TIMESTAMP(3),
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "iva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estado" "EstadoFactura" NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "condicionVenta" TEXT,
    "remito" TEXT,
    "tipoComprobante" "TipoComprobante",
    "puntoVenta" INTEGER,
    "numeroComprobante" TEXT,
    "numeroAfip" TEXT,
    "cae" TEXT,
    "caeVencimiento" TIMESTAMP(3),
    "fechaEmisionAFIP" TIMESTAMP(3),
    "qrData" TEXT,
    "operadorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Factura_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Factura_numero_key" ON "Factura"("numero");
CREATE INDEX IF NOT EXISTS "Factura_numero_idx" ON "Factura"("numero");
CREATE INDEX IF NOT EXISTS "Factura_clienteId_idx" ON "Factura"("clienteId");
CREATE INDEX IF NOT EXISTS "Factura_estado_idx" ON "Factura"("estado");
CREATE INDEX IF NOT EXISTS "Factura_fecha_idx" ON "Factura"("fecha");

-- DetalleFactura
CREATE TABLE IF NOT EXISTS "DetalleFactura" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "facturaId" TEXT NOT NULL,
    "tipoProducto" "TipoProductoFactura" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unidad" TEXT NOT NULL DEFAULT 'KG',
    "precioUnitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tropaCodigo" TEXT,
    "garron" INTEGER,
    "mediaResId" TEXT,
    "pesoKg" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DetalleFactura_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DetalleFactura_facturaId_idx" ON "DetalleFactura"("facturaId");
CREATE INDEX IF NOT EXISTS "DetalleFactura_tipoProducto_idx" ON "DetalleFactura"("tipoProducto");

-- Insumo
CREATE TABLE IF NOT EXISTS "Insumo" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" "CategoriaInsumo" NOT NULL,
    "subcategoria" TEXT,
    "unidadMedida" TEXT NOT NULL DEFAULT 'UN',
    "stockActual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockMinimo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockMaximo" DOUBLE PRECISION,
    "puntoReposicion" DOUBLE PRECISION,
    "proveedorId" TEXT,
    "proveedorNombre" TEXT,
    "codigoProveedor" TEXT,
    "precioUnitario" DOUBLE PRECISION,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "ubicacion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Insumo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Insumo_codigo_key" ON "Insumo"("codigo");
CREATE INDEX IF NOT EXISTS "Insumo_categoria_idx" ON "Insumo"("categoria");
CREATE INDEX IF NOT EXISTS "Insumo_activo_idx" ON "Insumo"("activo");

-- TipoProducto
CREATE TABLE IF NOT EXISTS "TipoProducto" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoriaPadreId" TEXT,
    "especie" "Especie",
    "tipo" "TipoProductoEnum" NOT NULL,
    "requiereFrio" BOOLEAN NOT NULL DEFAULT true,
    "diasConservacion" INTEGER,
    "temperaturaMax" DOUBLE PRECISION,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TipoProducto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TipoProducto_codigo_key" ON "TipoProducto"("codigo");
CREATE INDEX IF NOT EXISTS "TipoProducto_tipo_idx" ON "TipoProducto"("tipo");
CREATE INDEX IF NOT EXISTS "TipoProducto_activo_idx" ON "TipoProducto"("activo");

-- SubproductoConfig
CREATE TABLE IF NOT EXISTS "SubproductoConfig" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "especie" TEXT,
    "requiereFrio" BOOLEAN NOT NULL DEFAULT true,
    "temperaturaMax" DOUBLE PRECISION,
    "unidadMedida" TEXT NOT NULL DEFAULT 'KG',
    "rendimientoPct" DOUBLE PRECISION,
    "generaRotulo" BOOLEAN NOT NULL DEFAULT false,
    "codigoRotulo" TEXT,
    "precioReferencia" DOUBLE PRECISION,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubproductoConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SubproductoConfig_codigo_key" ON "SubproductoConfig"("codigo");
CREATE INDEX IF NOT EXISTS "SubproductoConfig_categoria_idx" ON "SubproductoConfig"("categoria");
CREATE INDEX IF NOT EXISTS "SubproductoConfig_activo_idx" ON "SubproductoConfig"("activo");

-- CondicionEmbalaje
CREATE TABLE IF NOT EXISTS "CondicionEmbalaje" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "temperaturaMin" DOUBLE PRECISION,
    "temperaturaMax" DOUBLE PRECISION,
    "humedadMin" DOUBLE PRECISION,
    "humedadMax" DOUBLE PRECISION,
    "tipoEmpaque" TEXT NOT NULL,
    "materialEmpaque" TEXT,
    "requiereFrio" BOOLEAN NOT NULL DEFAULT true,
    "requiereCongelado" BOOLEAN NOT NULL DEFAULT false,
    "diasValidez" INTEGER,
    "requiereRefrigeracion" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CondicionEmbalaje_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CondicionEmbalaje_codigo_key" ON "CondicionEmbalaje"("codigo");
CREATE INDEX IF NOT EXISTS "CondicionEmbalaje_activo_idx" ON "CondicionEmbalaje"("activo");

-- ReclamoCliente
CREATE TABLE IF NOT EXISTS "ReclamoCliente" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "clienteId" TEXT NOT NULL,
    "tipo" "TipoReclamo" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tropaCodigo" TEXT,
    "registradoPor" TEXT,
    "estado" "EstadoReclamo" NOT NULL DEFAULT 'PENDIENTE',
    "prioridad" "PrioridadReclamo" NOT NULL DEFAULT 'NORMAL',
    "respuesta" TEXT,
    "fechaRespuesta" TIMESTAMP(3),
    "respondidoPor" TEXT,
    "fechaResolucion" TIMESTAMP(3),
    "resueltoPor" TEXT,
    "resultado" TEXT,
    "seguimiento" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReclamoCliente_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ReclamoCliente_clienteId_idx" ON "ReclamoCliente"("clienteId");
CREATE INDEX IF NOT EXISTS "ReclamoCliente_tipo_idx" ON "ReclamoCliente"("tipo");
CREATE INDEX IF NOT EXISTS "ReclamoCliente_estado_idx" ON "ReclamoCliente"("estado");
CREATE INDEX IF NOT EXISTS "ReclamoCliente_fecha_idx" ON "ReclamoCliente"("fecha");
CREATE INDEX IF NOT EXISTS "ReclamoCliente_prioridad_idx" ON "ReclamoCliente"("prioridad");

-- RespuestaReclamo
CREATE TABLE IF NOT EXISTS "RespuestaReclamo" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "reclamoId" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "tipo" "TipoRespuesta" NOT NULL DEFAULT 'RESPUESTA_CLIENTE',
    "autorId" TEXT,
    "autorNombre" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RespuestaReclamo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RespuestaReclamo_reclamoId_idx" ON "RespuestaReclamo"("reclamoId");
CREATE INDEX IF NOT EXISTS "RespuestaReclamo_tipo_idx" ON "RespuestaReclamo"("tipo");
CREATE INDEX IF NOT EXISTS "RespuestaReclamo_fecha_idx" ON "RespuestaReclamo"("fecha");

-- ArchivoReclamo
CREATE TABLE IF NOT EXISTS "ArchivoReclamo" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "reclamoId" TEXT,
    "respuestaId" TEXT,
    "nombre" TEXT NOT NULL,
    "nombreInterno" TEXT NOT NULL,
    "tipo" "TipoArchivo" NOT NULL DEFAULT 'OTRO',
    "mimeType" TEXT,
    "tamaño" INTEGER NOT NULL,
    "contenido" TEXT NOT NULL,
    "subidoPor" TEXT,
    "operadorId" TEXT,
    "descripcion" TEXT,
    "fechaSubida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArchivoReclamo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ArchivoReclamo_reclamoId_idx" ON "ArchivoReclamo"("reclamoId");
CREATE INDEX IF NOT EXISTS "ArchivoReclamo_respuestaId_idx" ON "ArchivoReclamo"("respuestaId");
CREATE INDEX IF NOT EXISTS "ArchivoReclamo_tipo_idx" ON "ArchivoReclamo"("tipo");

-- Rotulo
CREATE TABLE IF NOT EXISTS "Rotulo" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoRotulo" NOT NULL,
    "categoria" TEXT,
    "tipoImpresora" TEXT NOT NULL DEFAULT 'ZEBRA',
    "ancho" INTEGER NOT NULL DEFAULT 80,
    "alto" INTEGER NOT NULL DEFAULT 50,
    "dpi" INTEGER NOT NULL DEFAULT 203,
    "contenido" TEXT NOT NULL,
    "variables" TEXT,
    "nombreArchivo" TEXT,
    "diasConsumo" INTEGER DEFAULT 30,
    "temperaturaMax" DOUBLE PRECISION DEFAULT 5.0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "esDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Rotulo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Rotulo_codigo_key" ON "Rotulo"("codigo");
CREATE INDEX IF NOT EXISTS "Rotulo_tipo_idx" ON "Rotulo"("tipo");
CREATE INDEX IF NOT EXISTS "Rotulo_activo_idx" ON "Rotulo"("activo");
CREATE INDEX IF NOT EXISTS "Rotulo_tipoImpresora_idx" ON "Rotulo"("tipoImpresora");

-- DestinatarioReporte
CREATE TABLE IF NOT EXISTS "DestinatarioReporte" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "recibeStock" BOOLEAN NOT NULL DEFAULT false,
    "recibeFaena" BOOLEAN NOT NULL DEFAULT false,
    "recibeRendimiento" BOOLEAN NOT NULL DEFAULT false,
    "recibeAlertas" BOOLEAN NOT NULL DEFAULT false,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DestinatarioReporte_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DestinatarioReporte_email_idx" ON "DestinatarioReporte"("email");
CREATE INDEX IF NOT EXISTS "DestinatarioReporte_activo_idx" ON "DestinatarioReporte"("activo");

-- ProgramacionReporte
CREATE TABLE IF NOT EXISTS "ProgramacionReporte" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "tipoReporte" "TipoReporteEmail" NOT NULL,
    "frecuencia" "FrecuenciaEmail" NOT NULL,
    "horaEnvio" INTEGER NOT NULL DEFAULT 8,
    "diaSemana" INTEGER,
    "diaMes" INTEGER,
    "destinatarios" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoEnvio" TIMESTAMP(3),
    "proximoEnvio" TIMESTAMP(3),
    "incluirGraficos" BOOLEAN NOT NULL DEFAULT true,
    "formato" "FormatoReporte" NOT NULL DEFAULT 'PDF',
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProgramacionReporte_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProgramacionReporte_tipoReporte_idx" ON "ProgramacionReporte"("tipoReporte");
CREATE INDEX IF NOT EXISTS "ProgramacionReporte_activo_idx" ON "ProgramacionReporte"("activo");
CREATE INDEX IF NOT EXISTS "ProgramacionReporte_proximoEnvio_idx" ON "ProgramacionReporte"("proximoEnvio");

-- HistorialEnvio
CREATE TABLE IF NOT EXISTS "HistorialEnvio" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "programacionId" TEXT,
    "destinatarioId" TEXT,
    "tipoReporte" "TipoReporteEmail" NOT NULL,
    "asunto" TEXT NOT NULL,
    "destinatarioEmail" TEXT NOT NULL,
    "estado" "EstadoEnvioEmail" NOT NULL DEFAULT 'PENDIENTE',
    "fechaEnvio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaProcesado" TIMESTAMP(3),
    "error" TEXT,
    "reintentos" INTEGER NOT NULL DEFAULT 0,
    "tamanoArchivo" INTEGER,
    "contenidoResumen" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistorialEnvio_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HistorialEnvio_tipoReporte_idx" ON "HistorialEnvio"("tipoReporte");
CREATE INDEX IF NOT EXISTS "HistorialEnvio_estado_idx" ON "HistorialEnvio"("estado");
CREATE INDEX IF NOT EXISTS "HistorialEnvio_fechaEnvio_idx" ON "HistorialEnvio"("fechaEnvio");
CREATE INDEX IF NOT EXISTS "HistorialEnvio_destinatarioEmail_idx" ON "HistorialEnvio"("destinatarioEmail");

-- LayoutGlobalModulo
CREATE TABLE IF NOT EXISTS "LayoutGlobalModulo" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "modulo" TEXT NOT NULL,
    "layout" TEXT,
    "bloques" TEXT,
    "botones" TEXT,
    "tema" TEXT,
    "colorPrincipal" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LayoutGlobalModulo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LayoutGlobalModulo_modulo_key" ON "LayoutGlobalModulo"("modulo");
CREATE INDEX IF NOT EXISTS "LayoutGlobalModulo_modulo_idx" ON "LayoutGlobalModulo"("modulo");

-- Despacho
CREATE TABLE IF NOT EXISTS "Despacho" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "numero" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "destino" TEXT NOT NULL,
    "direccionDestino" TEXT,
    "patenteCamion" TEXT,
    "patenteAcoplado" TEXT,
    "chofer" TEXT,
    "choferDni" TEXT,
    "transportista" TEXT,
    "transportistaId" TEXT,
    "remito" TEXT,
    "numeroPrecintos" TEXT,
    "kgTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cantidadMedias" INTEGER NOT NULL DEFAULT 0,
    "ticketPesajeId" TEXT,
    "estado" "EstadoDespacho" NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "operadorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Despacho_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Despacho_numero_key" ON "Despacho"("numero");
CREATE INDEX IF NOT EXISTS "Despacho_fecha_idx" ON "Despacho"("fecha");
CREATE INDEX IF NOT EXISTS "Despacho_estado_idx" ON "Despacho"("estado");
CREATE INDEX IF NOT EXISTS "Despacho_destino_idx" ON "Despacho"("destino");

-- DespachoItem
CREATE TABLE IF NOT EXISTS "DespachoItem" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "despachoId" TEXT NOT NULL,
    "mediaResId" TEXT NOT NULL,
    "tropaCodigo" TEXT,
    "garron" INTEGER,
    "peso" DOUBLE PRECISION NOT NULL,
    "camaraId" TEXT,
    "usuarioId" TEXT,
    "usuarioNombre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DespachoItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DespachoItem_despachoId_idx" ON "DespachoItem"("despachoId");
CREATE INDEX IF NOT EXISTS "DespachoItem_tropaCodigo_idx" ON "DespachoItem"("tropaCodigo");
CREATE INDEX IF NOT EXISTS "DespachoItem_usuarioId_idx" ON "DespachoItem"("usuarioId");
CREATE INDEX IF NOT EXISTS "DespachoItem_camaraId_idx" ON "DespachoItem"("camaraId");

-- PrecioCliente
CREATE TABLE IF NOT EXISTS "PrecioCliente" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "clienteId" TEXT NOT NULL,
    "tipoProducto" "TipoProductoPrecio" NOT NULL,
    "precioKg" DOUBLE PRECISION NOT NULL,
    "fechaDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaHasta" TIMESTAMP(3),
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrecioCliente_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PrecioCliente_clienteId_idx" ON "PrecioCliente"("clienteId");
CREATE INDEX IF NOT EXISTS "PrecioCliente_tipoProducto_idx" ON "PrecioCliente"("tipoProducto");
CREATE INDEX IF NOT EXISTS "PrecioCliente_fechaDesde_idx" ON "PrecioCliente"("fechaDesde");

-- HistorialPrecio
CREATE TABLE IF NOT EXISTS "HistorialPrecio" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "clienteId" TEXT NOT NULL,
    "tipoProducto" "TipoProductoPrecio" NOT NULL,
    "precioAnterior" DOUBLE PRECISION NOT NULL,
    "precioNuevo" DOUBLE PRECISION NOT NULL,
    "fechaCambio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operadorId" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistorialPrecio_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HistorialPrecio_clienteId_idx" ON "HistorialPrecio"("clienteId");
CREATE INDEX IF NOT EXISTS "HistorialPrecio_tipoProducto_idx" ON "HistorialPrecio"("tipoProducto");
CREATE INDEX IF NOT EXISTS "HistorialPrecio_fechaCambio_idx" ON "HistorialPrecio"("fechaCambio");

-- Cuarto
CREATE TABLE IF NOT EXISTS "Cuarto" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "mediaResId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "sigla" "SiglaCuarto" NOT NULL,
    "pesoOriginal" DOUBLE PRECISION NOT NULL,
    "pesoCuarto" DOUBLE PRECISION NOT NULL,
    "peso" DOUBLE PRECISION,
    "merma" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tipoCuartoId" TEXT,
    "tipo" TEXT,
    "tropaCodigo" TEXT,
    "garron" TEXT,
    "registroCuarteoId" TEXT,
    "camaraId" TEXT,
    "propietarioId" TEXT,
    "estado" "EstadoCuarto" NOT NULL DEFAULT 'EN_CAMARA',
    "fechaCuarteo" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaIngresoDespostada" TIMESTAMP(3),
    "operadorCuarteoId" TEXT,
    "loteDespostadaId" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cuarto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Cuarto_codigo_key" ON "Cuarto"("codigo");
CREATE INDEX IF NOT EXISTS "Cuarto_mediaResId_idx" ON "Cuarto"("mediaResId");
CREATE INDEX IF NOT EXISTS "Cuarto_sigla_idx" ON "Cuarto"("sigla");
CREATE INDEX IF NOT EXISTS "Cuarto_estado_idx" ON "Cuarto"("estado");
CREATE INDEX IF NOT EXISTS "Cuarto_camaraId_idx" ON "Cuarto"("camaraId");
CREATE INDEX IF NOT EXISTS "Cuarto_fechaCuarteo_idx" ON "Cuarto"("fechaCuarteo");
CREATE INDEX IF NOT EXISTS "Cuarto_loteDespostadaId_idx" ON "Cuarto"("loteDespostadaId");

-- LoteDespostada
CREATE TABLE IF NOT EXISTS "LoteDespostada" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "numero" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" TIMESTAMP(3),
    "tropasCodigos" TEXT,
    "kgIngresados" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kgProducidos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kgMermas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rendimiento" DOUBLE PRECISION,
    "estado" "EstadoLote" NOT NULL DEFAULT 'ABIERTO',
    "operadorId" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoteDespostada_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LoteDespostada_numero_key" ON "LoteDespostada"("numero");
CREATE INDEX IF NOT EXISTS "LoteDespostada_numero_idx" ON "LoteDespostada"("numero");
CREATE INDEX IF NOT EXISTS "LoteDespostada_anio_idx" ON "LoteDespostada"("anio");
CREATE INDEX IF NOT EXISTS "LoteDespostada_fecha_idx" ON "LoteDespostada"("fecha");
CREATE INDEX IF NOT EXISTS "LoteDespostada_estado_idx" ON "LoteDespostada"("estado");

-- CajaEmpaque
CREATE TABLE IF NOT EXISTS "CajaEmpaque" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigoBarras" TEXT NOT NULL,
    "codigoArticulo" TEXT NOT NULL,
    "codigoEspecie" TEXT NOT NULL,
    "codigoTipificacion" TEXT NOT NULL,
    "codigoTrabajo" TEXT NOT NULL,
    "codigoTransporte" TEXT NOT NULL,
    "codigoDestino" TEXT NOT NULL,
    "fechaProduccion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loteNumero" INTEGER NOT NULL,
    "unidades" INTEGER NOT NULL,
    "pesoNeto" DOUBLE PRECISION NOT NULL,
    "numeradorCaja" INTEGER NOT NULL,
    "pesoBruto" DOUBLE PRECISION NOT NULL,
    "productoId" TEXT,
    "loteId" TEXT,
    "propietarioId" TEXT,
    "camaraId" TEXT,
    "palletId" TEXT,
    "productoDesposteId" TEXT,
    "cuartoId" TEXT,
    "numero" TEXT,
    "tara" DOUBLE PRECISION,
    "piezas" INTEGER,
    "tropaCodigo" TEXT,
    "fechaFaena" TIMESTAMP(3),
    "fechaDesposte" TIMESTAMP(3),
    "barcodeGs1_128" TEXT,
    "estado" "EstadoCaja" NOT NULL DEFAULT 'EN_CAMARA',
    "fechaVencimiento" TIMESTAMP(3),
    "operadorId" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CajaEmpaque_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CajaEmpaque_codigoBarras_key" ON "CajaEmpaque"("codigoBarras");
CREATE INDEX IF NOT EXISTS "CajaEmpaque_codigoBarras_idx" ON "CajaEmpaque"("codigoBarras");
CREATE INDEX IF NOT EXISTS "CajaEmpaque_productoId_idx" ON "CajaEmpaque"("productoId");
CREATE INDEX IF NOT EXISTS "CajaEmpaque_loteId_idx" ON "CajaEmpaque"("loteId");
CREATE INDEX IF NOT EXISTS "CajaEmpaque_estado_idx" ON "CajaEmpaque"("estado");
CREATE INDEX IF NOT EXISTS "CajaEmpaque_fechaProduccion_idx" ON "CajaEmpaque"("fechaProduccion");
CREATE INDEX IF NOT EXISTS "CajaEmpaque_palletId_idx" ON "CajaEmpaque"("palletId");

-- Pallet
CREATE TABLE IF NOT EXISTS "Pallet" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "numero" INTEGER NOT NULL,
    "codigo" TEXT,
    "ssccCode" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "destino" TEXT,
    "destinoId" TEXT,
    "camaraId" TEXT,
    "esMixto" BOOLEAN NOT NULL DEFAULT false,
    "cantidadCajas" INTEGER NOT NULL DEFAULT 0,
    "pesoTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expedicionId" TEXT,
    "estado" "EstadoPallet" NOT NULL DEFAULT 'ARMADO',
    "operadorId" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pallet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Pallet_numero_key" ON "Pallet"("numero");
CREATE INDEX IF NOT EXISTS "Pallet_numero_idx" ON "Pallet"("numero");
CREATE INDEX IF NOT EXISTS "Pallet_fecha_idx" ON "Pallet"("fecha");
CREATE INDEX IF NOT EXISTS "Pallet_estado_idx" ON "Pallet"("estado");

-- MermaDespostada
CREATE TABLE IF NOT EXISTS "MermaDespostada" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "loteId" TEXT NOT NULL,
    "tipo" "TipoMermaDespostada" NOT NULL,
    "pesoKg" DOUBLE PRECISION NOT NULL,
    "observaciones" TEXT,
    "operadorId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MermaDespostada_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MermaDespostada_loteId_idx" ON "MermaDespostada"("loteId");
CREATE INDEX IF NOT EXISTS "MermaDespostada_tipo_idx" ON "MermaDespostada"("tipo");

-- ExpedicionCicloII
CREATE TABLE IF NOT EXISTS "ExpedicionCicloII" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "numero" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "destino" TEXT NOT NULL,
    "direccionDestino" TEXT,
    "clienteId" TEXT,
    "patenteCamion" TEXT,
    "patenteAcoplado" TEXT,
    "chofer" TEXT,
    "choferDni" TEXT,
    "transportista" TEXT,
    "remito" TEXT,
    "numeroPrecintos" TEXT,
    "cantidadPallets" INTEGER NOT NULL DEFAULT 0,
    "cantidadCajas" INTEGER NOT NULL DEFAULT 0,
    "kgTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estado" "EstadoExpedicion" NOT NULL DEFAULT 'PENDIENTE',
    "operadorId" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExpedicionCicloII_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ExpedicionCicloII_numero_key" ON "ExpedicionCicloII"("numero");
CREATE INDEX IF NOT EXISTS "ExpedicionCicloII_numero_idx" ON "ExpedicionCicloII"("numero");
CREATE INDEX IF NOT EXISTS "ExpedicionCicloII_fecha_idx" ON "ExpedicionCicloII"("fecha");
CREATE INDEX IF NOT EXISTS "ExpedicionCicloII_estado_idx" ON "ExpedicionCicloII"("estado");
CREATE INDEX IF NOT EXISTS "ExpedicionCicloII_clienteId_idx" ON "ExpedicionCicloII"("clienteId");

-- PrecioCorte
CREATE TABLE IF NOT EXISTS "PrecioCorte" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "clienteId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "precioKg" DOUBLE PRECISION NOT NULL,
    "fechaDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaHasta" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrecioCorte_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PrecioCorte_clienteId_idx" ON "PrecioCorte"("clienteId");
CREATE INDEX IF NOT EXISTS "PrecioCorte_productoId_idx" ON "PrecioCorte"("productoId");
CREATE INDEX IF NOT EXISTS "PrecioCorte_fechaDesde_idx" ON "PrecioCorte"("fechaDesde");
CREATE INDEX IF NOT EXISTS "PrecioCorte_activo_idx" ON "PrecioCorte"("activo");

-- HistorialPrecioCorte
CREATE TABLE IF NOT EXISTS "HistorialPrecioCorte" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "clienteId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "precioAnterior" DOUBLE PRECISION NOT NULL,
    "precioNuevo" DOUBLE PRECISION NOT NULL,
    "fechaCambio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operadorId" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistorialPrecioCorte_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HistorialPrecioCorte_clienteId_idx" ON "HistorialPrecioCorte"("clienteId");
CREATE INDEX IF NOT EXISTS "HistorialPrecioCorte_productoId_idx" ON "HistorialPrecioCorte"("productoId");
CREATE INDEX IF NOT EXISTS "HistorialPrecioCorte_fechaCambio_idx" ON "HistorialPrecioCorte"("fechaCambio");

-- CodigoArticulo
CREATE TABLE IF NOT EXISTS "CodigoArticulo" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "productoId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodigoArticulo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CodigoArticulo_codigo_key" ON "CodigoArticulo"("codigo");
CREATE INDEX IF NOT EXISTS "CodigoArticulo_codigo_idx" ON "CodigoArticulo"("codigo");
CREATE INDEX IF NOT EXISTS "CodigoArticulo_activo_idx" ON "CodigoArticulo"("activo");

-- CodigoEspecieBarcode
CREATE TABLE IF NOT EXISTS "CodigoEspecieBarcode" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodigoEspecieBarcode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CodigoEspecieBarcode_codigo_key" ON "CodigoEspecieBarcode"("codigo");
CREATE INDEX IF NOT EXISTS "CodigoEspecieBarcode_codigo_idx" ON "CodigoEspecieBarcode"("codigo");

-- CodigoTipificacionBarcode
CREATE TABLE IF NOT EXISTS "CodigoTipificacionBarcode" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodigoTipificacionBarcode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CodigoTipificacionBarcode_codigo_key" ON "CodigoTipificacionBarcode"("codigo");
CREATE INDEX IF NOT EXISTS "CodigoTipificacionBarcode_codigo_idx" ON "CodigoTipificacionBarcode"("codigo");

-- CodigoTrabajoBarcode
CREATE TABLE IF NOT EXISTS "CodigoTrabajoBarcode" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodigoTrabajoBarcode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CodigoTrabajoBarcode_codigo_key" ON "CodigoTrabajoBarcode"("codigo");
CREATE INDEX IF NOT EXISTS "CodigoTrabajoBarcode_codigo_idx" ON "CodigoTrabajoBarcode"("codigo");

-- CodigoTransporteBarcode
CREATE TABLE IF NOT EXISTS "CodigoTransporteBarcode" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodigoTransporteBarcode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CodigoTransporteBarcode_codigo_key" ON "CodigoTransporteBarcode"("codigo");
CREATE INDEX IF NOT EXISTS "CodigoTransporteBarcode_codigo_idx" ON "CodigoTransporteBarcode"("codigo");

-- CodigoDestinoBarcode
CREATE TABLE IF NOT EXISTS "CodigoDestinoBarcode" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodigoDestinoBarcode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CodigoDestinoBarcode_codigo_key" ON "CodigoDestinoBarcode"("codigo");
CREATE INDEX IF NOT EXISTS "CodigoDestinoBarcode_codigo_idx" ON "CodigoDestinoBarcode"("codigo");

-- NumeradorCicloII
CREATE TABLE IF NOT EXISTS "NumeradorCicloII" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "ultimoNumero" INTEGER NOT NULL DEFAULT 0,
    "anio" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NumeradorCicloII_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "NumeradorCicloII_nombre_key" ON "NumeradorCicloII"("nombre");

-- RegistroRendering
CREATE TABLE IF NOT EXISTS "RegistroRendering" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tipo" "TipoRendering" NOT NULL,
    "fechaFaena" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tropaId" TEXT,
    "pesoKg" DOUBLE PRECISION NOT NULL,
    "destino" TEXT,
    "despachado" BOOLEAN NOT NULL DEFAULT false,
    "fechaDespacho" TIMESTAMP(3),
    "observaciones" TEXT,
    "operadorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegistroRendering_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegistroRendering_tipo_idx" ON "RegistroRendering"("tipo");
CREATE INDEX IF NOT EXISTS "RegistroRendering_fechaFaena_idx" ON "RegistroRendering"("fechaFaena");
CREATE INDEX IF NOT EXISTS "RegistroRendering_despachado_idx" ON "RegistroRendering"("despachado");

-- RegistroCuero
CREATE TABLE IF NOT EXISTS "RegistroCuero" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "fechaFaena" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tropaId" TEXT,
    "categoria" "CategoriaCuero" NOT NULL,
    "pesoKg" DOUBLE PRECISION,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "destino" TEXT,
    "tipoDestino" "TipoDestinoCuero",
    "despachado" BOOLEAN NOT NULL DEFAULT false,
    "fechaDespacho" TIMESTAMP(3),
    "pesoDespacho" DOUBLE PRECISION,
    "remito" TEXT,
    "observaciones" TEXT,
    "operadorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegistroCuero_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RegistroCuero_categoria_idx" ON "RegistroCuero"("categoria");
CREATE INDEX IF NOT EXISTS "RegistroCuero_fechaFaena_idx" ON "RegistroCuero"("fechaFaena");
CREATE INDEX IF NOT EXISTS "RegistroCuero_despachado_idx" ON "RegistroCuero"("despachado");

-- MovimientoDespostada
CREATE TABLE IF NOT EXISTS "MovimientoDespostada" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "loteId" TEXT NOT NULL,
    "productoId" TEXT,
    "nombreCorte" TEXT,
    "pesoOriginal" DOUBLE PRECISION NOT NULL,
    "pesoLimpio" DOUBLE PRECISION,
    "pesoNeto" DOUBLE PRECISION,
    "pesoDesperdicio" DOUBLE PRECISION,
    "destino" "DestinoCorte",
    "tipo" "TipoMovimientoDespostada" NOT NULL,
    "causa" TEXT,
    "esHueso" BOOLEAN NOT NULL DEFAULT false,
    "esGrasa" BOOLEAN NOT NULL DEFAULT false,
    "operadorId" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovimientoDespostada_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MovimientoDespostada_loteId_idx" ON "MovimientoDespostada"("loteId");
CREATE INDEX IF NOT EXISTS "MovimientoDespostada_tipo_idx" ON "MovimientoDespostada"("tipo");
CREATE INDEX IF NOT EXISTS "MovimientoDespostada_createdAt_idx" ON "MovimientoDespostada"("createdAt");

-- ============================================================================
-- 4. REMAINING NEW TABLES (from auto-merged schema section)
-- ============================================================================

-- AFIPConfig
CREATE TABLE IF NOT EXISTS "AFIPConfig" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "puntoVenta" INTEGER NOT NULL DEFAULT 1,
    "ambiente" TEXT NOT NULL DEFAULT 'testing',
    "habilitado" BOOLEAN NOT NULL DEFAULT false,
    "cuit" TEXT,
    "razonSocial" TEXT,
    "domicilio" TEXT,
    "inicioActividades" TEXT,
    "certificado" TEXT,
    "clavePrivada" TEXT,
    "clave" TEXT,
    "certificadoPath" TEXT,
    "clavePrivadaPath" TEXT,
    "fechaVencimiento" TIMESTAMP(3),
    "ultimoToken" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AFIPConfig_pkey" PRIMARY KEY ("id")
);

-- ActividadOperador
CREATE TABLE IF NOT EXISTS "ActividadOperador" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "operadorId" TEXT,
    "tipo" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "entidad" TEXT,
    "entidadId" TEXT,
    "datos" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActividadOperador_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ActividadOperador_operadorId_idx" ON "ActividadOperador"("operadorId");
CREATE INDEX IF NOT EXISTS "ActividadOperador_tipo_idx" ON "ActividadOperador"("tipo");
CREATE INDEX IF NOT EXISTS "ActividadOperador_modulo_idx" ON "ActividadOperador"("modulo");
CREATE INDEX IF NOT EXISTS "ActividadOperador_fecha_idx" ON "ActividadOperador"("fecha");

-- AlertaStock
CREATE TABLE IF NOT EXISTS "AlertaStock" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tipo" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "entidadNombre" TEXT NOT NULL,
    "stockActual" DOUBLE PRECISION NOT NULL,
    "stockMinimo" DOUBLE PRECISION,
    "stockDeseado" DOUBLE PRECISION,
    "camaraId" TEXT,
    "prioridad" TEXT NOT NULL DEFAULT 'MEDIA',
    "estado" TEXT NOT NULL DEFAULT 'ACTIVA',
    "fechaResolucion" TIMESTAMP(3),
    "resueltaPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlertaStock_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AlertaStock_tipo_idx" ON "AlertaStock"("tipo");
CREATE INDEX IF NOT EXISTS "AlertaStock_prioridad_idx" ON "AlertaStock"("prioridad");
CREATE INDEX IF NOT EXISTS "AlertaStock_estado_idx" ON "AlertaStock"("estado");
CREATE INDEX IF NOT EXISTS "AlertaStock_entidad_idx" ON "AlertaStock"("entidad");
CREATE INDEX IF NOT EXISTS "AlertaStock_camaraId_idx" ON "AlertaStock"("camaraId");

-- Articulo
CREATE TABLE IF NOT EXISTS "Articulo" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT,
    "especie" TEXT,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Articulo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Articulo_codigo_key" ON "Articulo"("codigo");

-- AsientoContable
CREATE TABLE IF NOT EXISTS "AsientoContable" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "numero" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concepto" TEXT NOT NULL DEFAULT '',
    "tipoOrigen" "TipoAsientoContable" NOT NULL DEFAULT 'AJUSTE',
    "estado" "EstadoAsientoContable" NOT NULL DEFAULT 'BORRADOR',
    "origenId" TEXT,
    "origenDetalle" TEXT,
    "operadorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AsientoContable_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AsientoContable_numero_key" ON "AsientoContable"("numero");
CREATE INDEX IF NOT EXISTS "AsientoContable_fecha_idx" ON "AsientoContable"("fecha");
CREATE INDEX IF NOT EXISTS "AsientoContable_estado_idx" ON "AsientoContable"("estado");
CREATE INDEX IF NOT EXISTS "AsientoContable_tipoOrigen_idx" ON "AsientoContable"("tipoOrigen");
CREATE INDEX IF NOT EXISTS "AsientoContable_operadorId_idx" ON "AsientoContable"("operadorId");

-- AsientoContableLinea
CREATE TABLE IF NOT EXISTS "AsientoContableLinea" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "asientoId" TEXT NOT NULL,
    "cuentaId" TEXT,
    "codigoCuenta" TEXT NOT NULL,
    "nombreCuenta" TEXT NOT NULL,
    "debe" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "haber" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "auxiliarCodigo" TEXT,
    "auxiliarNombre" TEXT,
    "concepto" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AsientoContableLinea_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AsientoContableLinea_asientoId_idx" ON "AsientoContableLinea"("asientoId");
CREATE INDEX IF NOT EXISTS "AsientoContableLinea_cuentaId_idx" ON "AsientoContableLinea"("cuentaId");

-- AutorizacionReporte
CREATE TABLE IF NOT EXISTS "AutorizacionReporte" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tipoReporte" TEXT NOT NULL,
    "datosReporte" TEXT,
    "resumenReporte" TEXT,
    "solicitadoPorId" TEXT NOT NULL,
    "solicitadoPor" TEXT NOT NULL,
    "destinatarios" TEXT NOT NULL,
    "copiasOcultas" TEXT,
    "motivoSolicitud" TEXT,
    "fechaVigencia" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "autorizadoPorId" TEXT,
    "autorizadoPor" TEXT,
    "fechaAutorizacion" TIMESTAMP(3),
    "motivoRechazo" TEXT,
    "fechaSolicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutorizacionReporte_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AutorizacionReporte_estado_idx" ON "AutorizacionReporte"("estado");

-- BalanceFaena
CREATE TABLE IF NOT EXISTS "BalanceFaena" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tropaId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pesoVivoTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cantidadCabezas" INTEGER NOT NULL DEFAULT 0,
    "pesoFrioTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cantidadMedias" INTEGER NOT NULL DEFAULT 0,
    "rindePromedio" DOUBLE PRECISION,
    "rindeMinimo" DOUBLE PRECISION,
    "rindeMaximo" DOUBLE PRECISION,
    "pesoMenudencias" DOUBLE PRECISION,
    "pesoMerma" DOUBLE PRECISION,
    "porcentajeMerma" DOUBLE PRECISION,
    "facturaId" TEXT,
    "centroCostoId" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BalanceFaena_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BalanceFaena_tropaId_idx" ON "BalanceFaena"("tropaId");
CREATE INDEX IF NOT EXISTS "BalanceFaena_facturaId_idx" ON "BalanceFaena"("facturaId");
CREATE INDEX IF NOT EXISTS "BalanceFaena_fecha_idx" ON "BalanceFaena"("fecha");

-- BalanceInsumos
CREATE TABLE IF NOT EXISTS "BalanceInsumos" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "fechaDesde" TIMESTAMP(3) NOT NULL,
    "fechaHasta" TIMESTAMP(3) NOT NULL,
    "centroCostoId" TEXT,
    "consumoTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kgProducidos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cabezasFaenadas" INTEGER NOT NULL DEFAULT 0,
    "costoPorKg" DOUBLE PRECISION,
    "costoPorCabeza" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BalanceInsumos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BalanceInsumos_centroCostoId_idx" ON "BalanceInsumos"("centroCostoId");

-- Borrador
CREATE TABLE IF NOT EXISTS "Borrador" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "modulo" TEXT NOT NULL,
    "operadorId" TEXT,
    "datos" TEXT NOT NULL,
    "estado" "EstadoBorrador" NOT NULL DEFAULT 'ACTIVO',
    "sesionKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Borrador_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Borrador_modulo_sesionKey_key" ON "Borrador"("modulo", "sesionKey");
CREATE INDEX IF NOT EXISTS "Borrador_modulo_idx" ON "Borrador"("modulo");
CREATE INDEX IF NOT EXISTS "Borrador_operadorId_idx" ON "Borrador"("operadorId");
CREATE INDEX IF NOT EXISTS "Borrador_estado_idx" ON "Borrador"("estado");

-- C2BOM
CREATE TABLE IF NOT EXISTS "C2BOM" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "productoDesposteId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidadPorCaja" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "C2BOM_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "C2BOM_productoDesposteId_insumoId_key" ON "C2BOM"("productoDesposteId", "insumoId");
CREATE INDEX IF NOT EXISTS "C2BOM_productoDesposteId_idx" ON "C2BOM"("productoDesposteId");
CREATE INDEX IF NOT EXISTS "C2BOM_insumoId_idx" ON "C2BOM"("insumoId");

-- C2ExpedicionItem
CREATE TABLE IF NOT EXISTS "C2ExpedicionItem" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "ordenId" TEXT NOT NULL,
    "cajaId" TEXT NOT NULL,
    "palletId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "C2ExpedicionItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "C2ExpedicionItem_ordenId_idx" ON "C2ExpedicionItem"("ordenId");
CREATE INDEX IF NOT EXISTS "C2ExpedicionItem_cajaId_idx" ON "C2ExpedicionItem"("cajaId");
CREATE INDEX IF NOT EXISTS "C2ExpedicionItem_palletId_idx" ON "C2ExpedicionItem"("palletId");

-- C2ExpedicionOrden
CREATE TABLE IF NOT EXISTS "C2ExpedicionOrden" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "numero" INTEGER NOT NULL,
    "clienteId" TEXT NOT NULL,
    "transporteNombre" TEXT,
    "patenteCamion" TEXT,
    "choferNombre" TEXT,
    "choferDni" TEXT,
    "nroRemito" TEXT,
    "fechaDespacho" TIMESTAMP(3),
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoExpedicion" NOT NULL DEFAULT 'PENDIENTE',
    "cantidadCajas" INTEGER NOT NULL DEFAULT 0,
    "pesoTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "operadorId" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "C2ExpedicionOrden_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "C2ExpedicionOrden_numero_key" ON "C2ExpedicionOrden"("numero");
CREATE INDEX IF NOT EXISTS "C2ExpedicionOrden_clienteId_idx" ON "C2ExpedicionOrden"("clienteId");
CREATE INDEX IF NOT EXISTS "C2ExpedicionOrden_estado_idx" ON "C2ExpedicionOrden"("estado");
CREATE INDEX IF NOT EXISTS "C2ExpedicionOrden_fecha_idx" ON "C2ExpedicionOrden"("fecha");

-- C2MovimientoDegradacion
CREATE TABLE IF NOT EXISTS "C2MovimientoDegradacion" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "cajaIdOriginal" TEXT NOT NULL,
    "tipo" "TipoDegradacion" NOT NULL DEFAULT 'TRIMMING',
    "pesoDegradado" DOUBLE PRECISION NOT NULL,
    "pesoAprovechamiento" DOUBLE PRECISION,
    "pesoDescarte" DOUBLE PRECISION,
    "nuevoProductoId" TEXT,
    "motivo" TEXT NOT NULL,
    "operadorId" TEXT,
    "observaciones" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "C2MovimientoDegradacion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "C2MovimientoDegradacion_cajaIdOriginal_idx" ON "C2MovimientoDegradacion"("cajaIdOriginal");
CREATE INDEX IF NOT EXISTS "C2MovimientoDegradacion_tipo_idx" ON "C2MovimientoDegradacion"("tipo");
CREATE INDEX IF NOT EXISTS "C2MovimientoDegradacion_fecha_idx" ON "C2MovimientoDegradacion"("fecha");

-- C2Rubro
CREATE TABLE IF NOT EXISTS "C2Rubro" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "C2Rubro_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "C2Rubro_nombre_key" ON "C2Rubro"("nombre");
CREATE INDEX IF NOT EXISTS "C2Rubro_activo_idx" ON "C2Rubro"("activo");
CREATE INDEX IF NOT EXISTS "C2Rubro_orden_idx" ON "C2Rubro"("orden");

-- C2ProductoDesposte
CREATE TABLE IF NOT EXISTS "C2ProductoDesposte" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "rubroId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "gtin" TEXT,
    "especie" "Especie" NOT NULL DEFAULT 'BOVINO',
    "tipoCuartoOrigen" TEXT,
    "diasVencimiento" INTEGER,
    "tempMin" DOUBLE PRECISION,
    "tempMax" DOUBLE PRECISION,
    "pesoTaraCaja" DOUBLE PRECISION,
    "precioKg" DOUBLE PRECISION,
    "apareceRendimiento" BOOLEAN NOT NULL DEFAULT true,
    "apareceStock" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "C2ProductoDesposte_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "C2ProductoDesposte_codigo_key" ON "C2ProductoDesposte"("codigo");
CREATE INDEX IF NOT EXISTS "C2ProductoDesposte_rubroId_idx" ON "C2ProductoDesposte"("rubroId");
CREATE INDEX IF NOT EXISTS "C2ProductoDesposte_especie_idx" ON "C2ProductoDesposte"("especie");
CREATE INDEX IF NOT EXISTS "C2ProductoDesposte_activo_idx" ON "C2ProductoDesposte"("activo");
CREATE INDEX IF NOT EXISTS "C2ProductoDesposte_tipoCuartoOrigen_idx" ON "C2ProductoDesposte"("tipoCuartoOrigen");

-- C2SubproductoPesaje
CREATE TABLE IF NOT EXISTS "C2SubproductoPesaje" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tipo" "TipoSubproducto" NOT NULL DEFAULT 'HUESO',
    "tropaCodigo" TEXT,
    "pesoKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "destino" TEXT,
    "operadorId" TEXT,
    "observaciones" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "C2SubproductoPesaje_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "C2SubproductoPesaje_tipo_idx" ON "C2SubproductoPesaje"("tipo");
CREATE INDEX IF NOT EXISTS "C2SubproductoPesaje_tropaCodigo_idx" ON "C2SubproductoPesaje"("tropaCodigo");
CREATE INDEX IF NOT EXISTS "C2SubproductoPesaje_fecha_idx" ON "C2SubproductoPesaje"("fecha");

-- C2TipoCuarto
CREATE TABLE IF NOT EXISTS "C2TipoCuarto" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "C2TipoCuarto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "C2TipoCuarto_nombre_key" ON "C2TipoCuarto"("nombre");
CREATE UNIQUE INDEX IF NOT EXISTS "C2TipoCuarto_codigo_key" ON "C2TipoCuarto"("codigo");
CREATE INDEX IF NOT EXISTS "C2TipoCuarto_activo_idx" ON "C2TipoCuarto"("activo");
CREATE INDEX IF NOT EXISTS "C2TipoCuarto_orden_idx" ON "C2TipoCuarto"("orden");

-- CentroCosto
CREATE TABLE IF NOT EXISTS "CentroCosto" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" TEXT NOT NULL,
    "responsable" TEXT,
    "presupuestoMensual" DOUBLE PRECISION,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CentroCosto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CentroCosto_codigo_key" ON "CentroCosto"("codigo");
CREATE INDEX IF NOT EXISTS "CentroCosto_activo_idx" ON "CentroCosto"("activo");

-- ConsumoCentro
CREATE TABLE IF NOT EXISTS "ConsumoCentro" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "centroCostoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concepto" TEXT NOT NULL,
    "categoria" TEXT,
    "cantidad" DOUBLE PRECISION,
    "monto" DOUBLE PRECISION NOT NULL,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsumoCentro_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ConsumoCentro_centroCostoId_idx" ON "ConsumoCentro"("centroCostoId");
CREATE INDEX IF NOT EXISTS "ConsumoCentro_fecha_idx" ON "ConsumoCentro"("fecha");

-- ConsumoInsumo
CREATE TABLE IF NOT EXISTS "ConsumoInsumo" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "insumoId" TEXT NOT NULL,
    "centroCostoId" TEXT,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "costoUnitario" DOUBLE PRECISION,
    "costoTotal" DOUBLE PRECISION,
    "tropaId" TEXT,
    "produccionFecha" TIMESTAMP(3),
    "cantidadProducida" DOUBLE PRECISION,
    "consumoEstandar" DOUBLE PRECISION,
    "desviacion" DOUBLE PRECISION,
    "observaciones" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsumoInsumo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ConsumoInsumo_insumoId_idx" ON "ConsumoInsumo"("insumoId");
CREATE INDEX IF NOT EXISTS "ConsumoInsumo_centroCostoId_idx" ON "ConsumoInsumo"("centroCostoId");
CREATE INDEX IF NOT EXISTS "ConsumoInsumo_tropaId_idx" ON "ConsumoInsumo"("tropaId");
CREATE INDEX IF NOT EXISTS "ConsumoInsumo_fecha_idx" ON "ConsumoInsumo"("fecha");

-- CostoFaena
CREATE TABLE IF NOT EXISTS "CostoFaena" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "monedaId" TEXT,
    "aplicaA" TEXT NOT NULL DEFAULT 'TODOS',
    "fechaDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaHasta" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CostoFaena_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CostoFaena_tipo_idx" ON "CostoFaena"("tipo");
CREATE INDEX IF NOT EXISTS "CostoFaena_activo_idx" ON "CostoFaena"("activo");

-- CostoFaenaAplicado
CREATE TABLE IF NOT EXISTS "CostoFaenaAplicado" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "listaFaenaId" TEXT NOT NULL,
    "costoFaenaId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "montoUnitario" DOUBLE PRECISION NOT NULL,
    "montoTotal" DOUBLE PRECISION NOT NULL,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CostoFaenaAplicado_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CostoFaenaAplicado_listaFaenaId_idx" ON "CostoFaenaAplicado"("listaFaenaId");
CREATE INDEX IF NOT EXISTS "CostoFaenaAplicado_costoFaenaId_idx" ON "CostoFaenaAplicado"("costoFaenaId");

-- Cotizacion
CREATE TABLE IF NOT EXISTS "Cotizacion" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "monedaId" TEXT NOT NULL,
    "compra" DOUBLE PRECISION NOT NULL,
    "venta" DOUBLE PRECISION NOT NULL,
    "fuente" TEXT NOT NULL DEFAULT 'MANUAL',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cotizacion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Cotizacion_monedaId_idx" ON "Cotizacion"("monedaId");

-- CuentaBancaria
CREATE TABLE IF NOT EXISTS "CuentaBancaria" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "banco" TEXT NOT NULL,
    "tipoCuenta" TEXT NOT NULL,
    "numeroCuenta" TEXT NOT NULL,
    "cbu" TEXT,
    "alias" TEXT,
    "saldoActual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "saldoConciliado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "titular" TEXT,
    "cuitTitular" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CuentaBancaria_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CuentaBancaria_cbu_key" ON "CuentaBancaria"("cbu");

-- Cuero
CREATE TABLE IF NOT EXISTS "Cuero" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tropaCodigo" TEXT,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "pesoKg" DOUBLE PRECISION NOT NULL,
    "conservacion" "ConservacionCuero" NOT NULL DEFAULT 'SALADO',
    "destino" TEXT,
    "tipoDestino" "TipoDestinoCuero" DEFAULT 'CURTIEMBRE',
    "estado" "EstadoCuero" NOT NULL DEFAULT 'PENDIENTE',
    "remito" TEXT,
    "fechaDespacho" TIMESTAMP(3),
    "observaciones" TEXT,
    "operadorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cuero_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Cuero_fecha_idx" ON "Cuero"("fecha");
CREATE INDEX IF NOT EXISTS "Cuero_estado_idx" ON "Cuero"("estado");
CREATE INDEX IF NOT EXISTS "Cuero_conservacion_idx" ON "Cuero"("conservacion");

-- Decomiso
CREATE TABLE IF NOT EXISTS "Decomiso" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "garron" INTEGER NOT NULL,
    "tipo" "TipoDecomiso" NOT NULL,
    "tropaCodigo" TEXT,
    "motivo" TEXT NOT NULL,
    "pesoKg" DOUBLE PRECISION,
    "peso" DOUBLE PRECISION,
    "parte" TEXT,
    "observaciones" TEXT,
    "mediaResId" TEXT,
    "romaneoId" TEXT,
    "operadorId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Decomiso_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Decomiso_garron_idx" ON "Decomiso"("garron");
CREATE INDEX IF NOT EXISTS "Decomiso_tipo_idx" ON "Decomiso"("tipo");
CREATE INDEX IF NOT EXISTS "Decomiso_fecha_idx" ON "Decomiso"("fecha");
CREATE INDEX IF NOT EXISTS "Decomiso_mediaResId_idx" ON "Decomiso"("mediaResId");

-- Deposito
CREATE TABLE IF NOT EXISTS "Deposito" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "ubicacion" TEXT,
    "responsable" TEXT,
    "capacidadM2" DOUBLE PRECISION,
    "capacidadM3" DOUBLE PRECISION,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Deposito_pkey" PRIMARY KEY ("id")
);

-- FacturaTributo
CREATE TABLE IF NOT EXISTS "FacturaTributo" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "facturaId" TEXT NOT NULL,
    "tributoId" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "baseImponible" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "alicuota" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "importe" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FacturaTributo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FacturaTributo_facturaId_idx" ON "FacturaTributo"("facturaId");
CREATE INDEX IF NOT EXISTS "FacturaTributo_tributoId_idx" ON "FacturaTributo"("tributoId");

-- FiltroReporte
CREATE TABLE IF NOT EXISTS "FiltroReporte" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "operadorId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "filtros" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FiltroReporte_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FiltroReporte_operadorId_idx" ON "FiltroReporte"("operadorId");
CREATE INDEX IF NOT EXISTS "FiltroReporte_reportType_idx" ON "FiltroReporte"("reportType");

-- FlujoFaena
CREATE TABLE IF NOT EXISTS "FlujoFaena" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "listaFaenaId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'INICIADO',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "datosVerificados" BOOLEAN NOT NULL DEFAULT false,
    "vistoBueno" BOOLEAN NOT NULL DEFAULT false,
    "datosSubidos" BOOLEAN NOT NULL DEFAULT false,
    "reportesEmitidos" BOOLEAN NOT NULL DEFAULT false,
    "romaneosEnviados" BOOLEAN NOT NULL DEFAULT false,
    "fechaVerificacion" TIMESTAMP(3),
    "fechaVistoBueno" TIMESTAMP(3),
    "comentarioVistoBueno" TEXT,
    "fechaSubida" TIMESTAMP(3),
    "fechaReportes" TIMESTAMP(3),
    "fechaEnvioRomaneos" TIMESTAMP(3),
    "verificadorId" TEXT,
    "supervisorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FlujoFaena_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "FlujoFaena_listaFaenaId_key" ON "FlujoFaena"("listaFaenaId");
CREATE INDEX IF NOT EXISTS "FlujoFaena_estado_idx" ON "FlujoFaena"("estado");
CREATE INDEX IF NOT EXISTS "FlujoFaena_fecha_idx" ON "FlujoFaena"("fecha");

-- GrasaDressing
CREATE TABLE IF NOT EXISTS "GrasaDressing" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tropaCodigo" TEXT,
    "garron" INTEGER,
    "tipo" "TipoGrasa" NOT NULL DEFAULT 'RENDERING',
    "pesoTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "enStock" BOOLEAN NOT NULL DEFAULT true,
    "fechaFaena" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "destino" TEXT,
    "operadorId" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrasaDressing_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GrasaDressing_tropaCodigo_idx" ON "GrasaDressing"("tropaCodigo");
CREATE INDEX IF NOT EXISTS "GrasaDressing_fechaFaena_idx" ON "GrasaDressing"("fechaFaena");
CREATE INDEX IF NOT EXISTS "GrasaDressing_enStock_idx" ON "GrasaDressing"("enStock");

-- IngresoDespostada
CREATE TABLE IF NOT EXISTS "IngresoDespostada" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "mediaResId" TEXT,
    "tropaCodigo" TEXT,
    "mediaCodigo" TEXT,
    "tipoMedia" "TipoMedia" NOT NULL DEFAULT 'DELANTERA',
    "pesoKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "camaraOrigenId" TEXT,
    "camaraDestinoId" TEXT,
    "loteId" TEXT,
    "estado" "EstadoIngreso" NOT NULL DEFAULT 'PENDIENTE',
    "operadorId" TEXT,
    "observaciones" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IngresoDespostada_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IngresoDespostada_tropaCodigo_idx" ON "IngresoDespostada"("tropaCodigo");
CREATE INDEX IF NOT EXISTS "IngresoDespostada_estado_idx" ON "IngresoDespostada"("estado");
CREATE INDEX IF NOT EXISTS "IngresoDespostada_fecha_idx" ON "IngresoDespostada"("fecha");

-- IngresoTercero
CREATE TABLE IF NOT EXISTS "IngresoTercero" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "terceroId" TEXT NOT NULL,
    "tipoCuarto" TEXT NOT NULL DEFAULT 'ASADO',
    "tipificacion" TEXT,
    "especie" TEXT NOT NULL DEFAULT 'EQUINO',
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "pesoTotal" DOUBLE PRECISION NOT NULL,
    "camaraDestinoId" TEXT,
    "dte" TEXT,
    "guia" TEXT,
    "operadorId" TEXT,
    "observaciones" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IngresoTercero_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IngresoTercero_codigo_key" ON "IngresoTercero"("codigo");
CREATE INDEX IF NOT EXISTS "IngresoTercero_terceroId_idx" ON "IngresoTercero"("terceroId");
CREATE INDEX IF NOT EXISTS "IngresoTercero_fecha_idx" ON "IngresoTercero"("fecha");
CREATE INDEX IF NOT EXISTS "IngresoTercero_camaraDestinoId_idx" ON "IngresoTercero"("camaraDestinoId");

-- IntentoLogin
CREATE TABLE IF NOT EXISTS "IntentoLogin" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "operadorId" TEXT,
    "ip" TEXT NOT NULL,
    "exitoso" BOOLEAN NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntentoLogin_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IntentoLogin_ip_idx" ON "IntentoLogin"("ip");
CREATE INDEX IF NOT EXISTS "IntentoLogin_operadorId_idx" ON "IntentoLogin"("operadorId");
CREATE INDEX IF NOT EXISTS "IntentoLogin_fecha_idx" ON "IntentoLogin"("fecha");

-- LiquidacionFaena
CREATE TABLE IF NOT EXISTS "LiquidacionFaena" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "numero" INTEGER NOT NULL,
    "tropaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "fechaFaena" TIMESTAMP(3) NOT NULL,
    "dteSenasa" TEXT,
    "certFaena" TEXT,
    "cantCabezas" INTEGER NOT NULL,
    "kgRomaneo" DOUBLE PRECISION NOT NULL,
    "tarifaFaenaId" TEXT,
    "tarifaFaenaValor" DOUBLE PRECISION NOT NULL,
    "subtotalNeto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalIVA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalRetenciones" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalFinal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "facturaId" TEXT,
    "supervisorId" TEXT,
    "operadorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiquidacionFaena_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LiquidacionFaena_numero_key" ON "LiquidacionFaena"("numero");
CREATE UNIQUE INDEX IF NOT EXISTS "LiquidacionFaena_tropaId_key" ON "LiquidacionFaena"("tropaId");
CREATE UNIQUE INDEX IF NOT EXISTS "LiquidacionFaena_facturaId_key" ON "LiquidacionFaena"("facturaId");
CREATE INDEX IF NOT EXISTS "LiquidacionFaena_tropaId_idx" ON "LiquidacionFaena"("tropaId");
CREATE INDEX IF NOT EXISTS "LiquidacionFaena_clienteId_idx" ON "LiquidacionFaena"("clienteId");
CREATE INDEX IF NOT EXISTS "LiquidacionFaena_estado_idx" ON "LiquidacionFaena"("estado");
CREATE INDEX IF NOT EXISTS "LiquidacionFaena_fechaFaena_idx" ON "LiquidacionFaena"("fechaFaena");

-- LiquidacionItem
CREATE TABLE IF NOT EXISTS "LiquidacionItem" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "liquidacionId" TEXT NOT NULL,
    "tipoTarifaId" TEXT,
    "descripcion" TEXT NOT NULL,
    "unidad" TEXT NOT NULL DEFAULT 'POR_KG',
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tarifaValor" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "alicuotaIVA" DOUBLE PRECISION NOT NULL DEFAULT 21,
    "importeIVA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "esDescuento" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiquidacionItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LiquidacionItem_liquidacionId_idx" ON "LiquidacionItem"("liquidacionId");
CREATE INDEX IF NOT EXISTS "LiquidacionItem_tipoTarifaId_idx" ON "LiquidacionItem"("tipoTarifaId");

-- MedicionPH
CREATE TABLE IF NOT EXISTS "MedicionPH" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "mediaResId" TEXT NOT NULL,
    "valorPH" DOUBLE PRECISION NOT NULL,
    "clasificacion" "ClasificacionPH" NOT NULL DEFAULT 'SIN_CLASIFICAR',
    "temperatura" DOUBLE PRECISION,
    "horaMedicion" TIMESTAMP(3) NOT NULL,
    "numeroMedicion" INTEGER NOT NULL DEFAULT 1,
    "operadorId" TEXT,
    "medidoPor" TEXT,
    "tropaCodigo" TEXT,
    "garron" INTEGER,
    "tipoAnimal" TEXT,
    "raza" TEXT,
    "ladoMedia" TEXT,
    "productorNombre" TEXT,
    "productorId" TEXT,
    "usuarioFaenaId" TEXT,
    "usuarioFaenaNombre" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MedicionPH_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MedicionPH_mediaResId_numeroMedicion_key" ON "MedicionPH"("mediaResId", "numeroMedicion");
CREATE INDEX IF NOT EXISTS "MedicionPH_mediaResId_idx" ON "MedicionPH"("mediaResId");
CREATE INDEX IF NOT EXISTS "MedicionPH_tropaCodigo_idx" ON "MedicionPH"("tropaCodigo");
CREATE INDEX IF NOT EXISTS "MedicionPH_clasificacion_idx" ON "MedicionPH"("clasificacion");
CREATE INDEX IF NOT EXISTS "MedicionPH_horaMedicion_idx" ON "MedicionPH"("horaMedicion");
CREATE INDEX IF NOT EXISTS "MedicionPH_productorId_idx" ON "MedicionPH"("productorId");
CREATE INDEX IF NOT EXISTS "MedicionPH_operadorId_idx" ON "MedicionPH"("operadorId");

-- Moneda
CREATE TABLE IF NOT EXISTS "Moneda" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "simbolo" TEXT NOT NULL,
    "esDefault" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Moneda_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Moneda_codigo_key" ON "Moneda"("codigo");

-- PlanCuenta
CREATE TABLE IF NOT EXISTS "PlanCuenta" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" "TipoPlanCuenta" NOT NULL,
    "imputable" BOOLEAN NOT NULL DEFAULT true,
    "padreId" TEXT,
    "nivel" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanCuenta_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlanCuenta_codigo_key" ON "PlanCuenta"("codigo");
CREATE INDEX IF NOT EXISTS "PlanCuenta_codigo_idx" ON "PlanCuenta"("codigo");
CREATE INDEX IF NOT EXISTS "PlanCuenta_tipo_idx" ON "PlanCuenta"("tipo");
CREATE INDEX IF NOT EXISTS "PlanCuenta_activo_idx" ON "PlanCuenta"("activo");
CREATE INDEX IF NOT EXISTS "PlanCuenta_padreId_idx" ON "PlanCuenta"("padreId");

-- Proveedor
CREATE TABLE IF NOT EXISTS "Proveedor" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "cuit" TEXT,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "tipo" "TipoProveedor" NOT NULL DEFAULT 'OTROS',
    "contacto" TEXT,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- ProductoVendible
CREATE TABLE IF NOT EXISTS "ProductoVendible" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tara" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vencimientoDias" INTEGER NOT NULL DEFAULT 0,
    "numeroRegistroSenasa" TEXT,
    "unidadMedida" TEXT NOT NULL DEFAULT 'KG',
    "cantidadEtiquetas" INTEGER NOT NULL DEFAULT 1,
    "tieneTipificacion" BOOLEAN NOT NULL DEFAULT false,
    "tipificacion" TEXT,
    "categoria" TEXT,
    "subcategoria" TEXT,
    "especie" TEXT,
    "tipo" TEXT,
    "delCuarto" TEXT,
    "tipoVenta" TEXT NOT NULL DEFAULT 'POR_KG',
    "descripcionCircular" TEXT,
    "precioBase" DOUBLE PRECISION,
    "precioDolar" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precioEuro" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precioArs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "alicuotaIva" DOUBLE PRECISION NOT NULL DEFAULT 21,
    "producidoParaCliente" TEXT,
    "productoGeneral" BOOLEAN NOT NULL DEFAULT false,
    "productoReporteRinde" BOOLEAN NOT NULL DEFAULT false,
    "tipoTrabajo" TEXT,
    "idiomaEtiqueta" TEXT NOT NULL DEFAULT 'ES',
    "formatoEtiqueta" TEXT,
    "textoEtiqueta" TEXT,
    "textoEspanol" TEXT,
    "textoIngles" TEXT,
    "textoTercerIdioma" TEXT,
    "temperaturaTransporte" TEXT,
    "tipoConsumo" TEXT,
    "empresa" TEXT,
    "tipoTrabajoId" TEXT,
    "tipoCarne" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "requiereTrazabilidad" BOOLEAN NOT NULL DEFAULT false,
    "precioActual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductoVendible_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProductoVendible_codigo_key" ON "ProductoVendible"("codigo");
CREATE INDEX IF NOT EXISTS "ProductoVendible_categoria_idx" ON "ProductoVendible"("categoria");
CREATE INDEX IF NOT EXISTS "ProductoVendible_activo_idx" ON "ProductoVendible"("activo");

-- PuestoTrabajo
CREATE TABLE IF NOT EXISTS "PuestoTrabajo" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "sector" TEXT,
    "ubicacion" TEXT,
    "balanzaId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PuestoTrabajo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PuestoTrabajo_codigo_key" ON "PuestoTrabajo"("codigo");

-- EnvioSIGICA
CREATE TABLE IF NOT EXISTS "EnvioSIGICA" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tipo" TEXT NOT NULL,
    "datosEnviados" TEXT,
    "cantidadRegistros" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'ENVIANDO',
    "respuestaSIGICA" TEXT,
    "codigoTransaccion" TEXT,
    "mensajeError" TEXT,
    "romaneoIds" TEXT,
    "operadorId" TEXT,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoIntento" TIMESTAMP(3),
    "fechaEnvio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnvioSIGICA_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EnvioSIGICA_tipo_idx" ON "EnvioSIGICA"("tipo");
CREATE INDEX IF NOT EXISTS "EnvioSIGICA_estado_idx" ON "EnvioSIGICA"("estado");
CREATE INDEX IF NOT EXISTS "EnvioSIGICA_operadorId_idx" ON "EnvioSIGICA"("operadorId");
CREATE INDEX IF NOT EXISTS "EnvioSIGICA_fechaEnvio_idx" ON "EnvioSIGICA"("fechaEnvio");

-- ============================================================================
-- 5. FOREIGN KEY CONSTRAINTS (for tables that reference existing tables)
-- ============================================================================

-- Tipificador FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Romaneo_tipificadorId_fkey') THEN
    ALTER TABLE "Romaneo" ADD CONSTRAINT "Romaneo_tipificadorId_fkey" FOREIGN KEY ("tipificadorId") REFERENCES "Tipificador"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Transportista FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PesajeCamion_transportistaId_fkey') THEN
    ALTER TABLE "PesajeCamion" ADD CONSTRAINT "PesajeCamion_transportistaId_fkey" FOREIGN KEY ("transportistaId") REFERENCES "Transportista"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Despacho -> PesajeCamion
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Despacho_ticketPesajeId_fkey') THEN
    ALTER TABLE "Despacho" ADD CONSTRAINT "Despacho_ticketPesajeId_fkey" FOREIGN KEY ("ticketPesajeId") REFERENCES "PesajeCamion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Factura FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Factura_clienteId_fkey') THEN
    ALTER TABLE "Factura" ADD CONSTRAINT "Factura_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'DetalleFactura_facturaId_fkey') THEN
    ALTER TABLE "DetalleFactura" ADD CONSTRAINT "DetalleFactura_facturaId_fkey" FOREIGN KEY ("facturaId") REFERENCES "Factura"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Cuarto -> MediaRes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Cuarto_mediaResId_fkey') THEN
    ALTER TABLE "Cuarto" ADD CONSTRAINT "Cuarto_mediaResId_fkey" FOREIGN KEY ("mediaResId") REFERENCES "MediaRes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- CajaEmpaque FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CajaEmpaque_productoId_fkey') THEN
    ALTER TABLE "CajaEmpaque" ADD CONSTRAINT "CajaEmpaque_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CajaEmpaque_loteId_fkey') THEN
    ALTER TABLE "CajaEmpaque" ADD CONSTRAINT "CajaEmpaque_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "LoteDespostada"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CajaEmpaque_cuartoId_fkey') THEN
    ALTER TABLE "CajaEmpaque" ADD CONSTRAINT "CajaEmpaque_cuartoId_fkey" FOREIGN KEY ("cuartoId") REFERENCES "Cuarto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- PrecioCorte FKs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'PrecioCorte_productoId_fkey') THEN
    ALTER TABLE "PrecioCorte" ADD CONSTRAINT "PrecioCorte_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ReclamoCliente FK
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'ReclamoCliente_clienteId_fkey') THEN
    ALTER TABLE "ReclamoCliente" ADD CONSTRAINT "ReclamoCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 6. MISSING INDEXES ON EXISTING TABLES
-- ============================================================================

-- ListaFaena indexes
CREATE INDEX IF NOT EXISTS "ListaFaena_fecha_idx" ON "ListaFaena"("fecha");
CREATE INDEX IF NOT EXISTS "ListaFaena_estado_idx" ON "ListaFaena"("estado");
CREATE INDEX IF NOT EXISTS "ListaFaena_numero_idx" ON "ListaFaena"("numero");

-- ListaFaenaTropa indexes
CREATE INDEX IF NOT EXISTS "ListaFaenaTropa_corralId_idx" ON "ListaFaenaTropa"("corralId");

-- AsignacionGarron indexes
CREATE INDEX IF NOT EXISTS "AsignacionGarron_garron_idx" ON "AsignacionGarron"("garron");
CREATE INDEX IF NOT EXISTS "AsignacionGarron_horaIngreso_idx" ON "AsignacionGarron"("horaIngreso");

-- Romaneo indexes
CREATE INDEX IF NOT EXISTS "Romaneo_fecha_idx" ON "Romaneo"("fecha");
CREATE INDEX IF NOT EXISTS "Romaneo_garron_idx" ON "Romaneo"("garron");
CREATE INDEX IF NOT EXISTS "Romaneo_estado_idx" ON "Romaneo"("estado");

-- Animal indexes
CREATE INDEX IF NOT EXISTS "Animal_estado_idx" ON "Animal"("estado");
CREATE INDEX IF NOT EXISTS "Animal_corralId_idx" ON "Animal"("corralId");

-- MediaRes indexes
CREATE INDEX IF NOT EXISTS "MediaRes_estado_idx" ON "MediaRes"("estado");
CREATE INDEX IF NOT EXISTS "MediaRes_usuarioFaenaId_idx" ON "MediaRes"("usuarioFaenaId");

-- StockMediaRes unique index
CREATE UNIQUE INDEX IF NOT EXISTS "StockMediaRes_camaraId_tropaCodigo_especie_key" ON "StockMediaRes"("camaraId", "tropaCodigo", "especie");

-- MovimientoCorral index
CREATE INDEX IF NOT EXISTS "MovimientoCorral_fecha_idx" ON "MovimientoCorral"("fecha");

-- PesajeCamion indexes
CREATE INDEX IF NOT EXISTS "PesajeCamion_tipo_idx" ON "PesajeCamion"("tipo");
CREATE INDEX IF NOT EXISTS "PesajeCamion_estado_idx" ON "PesajeCamion"("estado");
CREATE INDEX IF NOT EXISTS "PesajeCamion_fecha_idx" ON "PesajeCamion"("fecha");

-- MovimientoCamara index
CREATE INDEX IF NOT EXISTS "MovimientoCamara_fecha_idx" ON "MovimientoCamara"("fecha");

-- ListFaenaTropa unique indexes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ListaFaenaTropa_listaFaenaId_tropaId_corralId_key') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "ListaFaenaTropa_listaFaenaId_tropaId_corralId_key" ON "ListaFaenaTropa"("listaFaenaId", "tropaId", "corralId");
  END IF;
END $$;

-- Animal unique indexes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'Animal_tropaId_numero_key') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "Animal_tropaId_numero_key" ON "Animal"("tropaId", "numero");
  END IF;
END $$;

-- MediaRes unique indexes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'MediaRes_romaneoId_lado_sigla_key') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "MediaRes_romaneoId_lado_sigla_key" ON "MediaRes"("romaneoId", "lado", "sigla");
  END IF;
END $$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
-- ============================================================================
-- MISSING TABLES - Generated from Prisma schema
-- 70 tables that were not present in the migration
-- ============================================================================

-- 1. ArqueoCaja
CREATE TABLE IF NOT EXISTS "ArqueoCaja" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "cajaId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saldoSistema" DOUBLE PRECISION NOT NULL,
    "saldoFisico" DOUBLE PRECISION NOT NULL,
    "diferencia" DOUBLE PRECISION NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "operadorId" TEXT,
    "supervisorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArqueoCaja_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ArqueoCaja_cajaId_idx" ON "ArqueoCaja"("cajaId");
CREATE INDEX IF NOT EXISTS "ArqueoCaja_estado_idx" ON "ArqueoCaja"("estado");
CREATE INDEX IF NOT EXISTS "ArqueoCaja_fecha_idx" ON "ArqueoCaja"("fecha");

-- 2. Balanza
CREATE TABLE IF NOT EXISTS "Balanza" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT,
    "tipoConexion" "TipoConexionBalanza" NOT NULL DEFAULT 'SERIAL',
    "puerto" TEXT,
    "baudRate" INTEGER NOT NULL DEFAULT 9600,
    "dataBits" INTEGER NOT NULL DEFAULT 8,
    "parity" TEXT NOT NULL DEFAULT 'none',
    "stopBits" INTEGER DEFAULT 1,
    "ip" TEXT,
    "puertoTcp" INTEGER,
    "protocolo" "ProtocoloBalanza" NOT NULL DEFAULT 'GENERICO',
    "comandoPeso" TEXT,
    "formatoRespuesta" TEXT,
    "capacidadMax" DOUBLE PRECISION,
    "division" DOUBLE PRECISION DEFAULT 0.1,
    "unidad" TEXT NOT NULL DEFAULT 'kg',
    "fechaCalibracion" TIMESTAMP(3),
    "proximaCalibracion" TIMESTAMP(3),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "estado" "EstadoBalanza" NOT NULL DEFAULT 'DESCONECTADA',
    "ultimoError" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Balanza_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Balanza_codigo_key" ON "Balanza"("codigo");
CREATE INDEX IF NOT EXISTS "Balanza_activa_idx" ON "Balanza"("activa");
CREATE INDEX IF NOT EXISTS "Balanza_estado_idx" ON "Balanza"("estado");

-- 3. Caja
CREATE TABLE IF NOT EXISTS "Caja" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "saldoActual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cuentaBancariaId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Caja_pkey" PRIMARY KEY ("id")
);

-- 4. CategoriaInsumoTabla
CREATE TABLE IF NOT EXISTS "CategoriaInsumoTabla" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoriaInsumoTabla_pkey" PRIMARY KEY ("id")
);

-- 5. Cheque
CREATE TABLE IF NOT EXISTS "Cheque" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "numero" TEXT NOT NULL,
    "banco" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "fechaCobro" TIMESTAMP(3),
    "cuentaBancariaId" TEXT,
    "libradorNombre" TEXT NOT NULL,
    "libradorCuit" TEXT,
    "libradorTelefono" TEXT,
    "estado" "EstadoCheque" NOT NULL DEFAULT 'RECIBIDO',
    "destino" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cheque_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cheque_numero_banco" ON "Cheque"("numero", "banco");

-- 6. CodigoBarrasConfig
CREATE TABLE IF NOT EXISTS "CodigoBarrasConfig" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tipo" TEXT NOT NULL,
    "prefijo" TEXT NOT NULL,
    "formato" TEXT NOT NULL,
    "descripcion" TEXT,
    "variables" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "esDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodigoBarrasConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CodigoBarrasConfig_tipo_key" ON "CodigoBarrasConfig"("tipo");
CREATE INDEX IF NOT EXISTS "CodigoBarrasConfig_tipo_idx" ON "CodigoBarrasConfig"("tipo");
CREATE INDEX IF NOT EXISTS "CodigoBarrasConfig_activo_idx" ON "CodigoBarrasConfig"("activo");

-- 7. ConciliacionBancaria
CREATE TABLE IF NOT EXISTS "ConciliacionBancaria" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "cuentaBancariaId" TEXT NOT NULL,
    "fechaDesde" TIMESTAMP(3) NOT NULL,
    "fechaHasta" TIMESTAMP(3) NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "totalRegistros" INTEGER NOT NULL DEFAULT 0,
    "totalDebitos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCreditos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conciliados" INTEGER NOT NULL DEFAULT 0,
    "pendientes" INTEGER NOT NULL DEFAULT 0,
    "diferencias" INTEGER NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "creadoPor" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConciliacionBancaria_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ConciliacionBancaria_cuentaBancariaId_idx" ON "ConciliacionBancaria"("cuentaBancariaId");
CREATE INDEX IF NOT EXISTS "ConciliacionBancaria_estado_idx" ON "ConciliacionBancaria"("estado");

-- 8. ConfigBalanza
CREATE TABLE IF NOT EXISTS "ConfigBalanza" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "modelo" TEXT,
    "marca" TEXT,
    "tipoConexion" TEXT NOT NULL DEFAULT 'SERIAL',
    "puertoSerial" TEXT,
    "baudRate" INTEGER NOT NULL DEFAULT 9600,
    "dataBits" INTEGER NOT NULL DEFAULT 8,
    "stopBits" INTEGER NOT NULL DEFAULT 1,
    "paridad" TEXT NOT NULL DEFAULT 'NONE',
    "direccionIP" TEXT,
    "puertoTCP" INTEGER,
    "protocolo" TEXT NOT NULL DEFAULT 'CONTINUO',
    "timeout" INTEGER NOT NULL DEFAULT 5000,
    "intervaloLectura" INTEGER NOT NULL DEFAULT 500,
    "comandoPesar" TEXT,
    "comandoTara" TEXT,
    "comandoCero" TEXT,
    "formatoTrama" TEXT,
    "posicionPeso" INTEGER,
    "decimales" INTEGER NOT NULL DEFAULT 2,
    "unidad" TEXT NOT NULL DEFAULT 'KG',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "esPrincipal" BOOLEAN NOT NULL DEFAULT false,
    "ubicacion" TEXT,
    "terminalId" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigBalanza_pkey" PRIMARY KEY ("id")
);

-- 9. ConfiguracionAFIP
CREATE TABLE IF NOT EXISTS "ConfiguracionAFIP" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "certificadoPath" TEXT,
    "clavePrivadaPath" TEXT,
    "entorno" TEXT NOT NULL DEFAULT 'testing',
    "cuit" TEXT,
    "razonSocial" TEXT,
    "inicioActividades" TIMESTAMP(3),
    "puntosVenta" TEXT,
    "wsaaUrl" TEXT,
    "wsfeUrl" TEXT,
    "tokenWsfe" TEXT,
    "signWsfe" TEXT,
    "tokenExpiracion" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfiguracionAFIP_pkey" PRIMARY KEY ("id")
);

-- 10. ConfiguracionBackup
CREATE TABLE IF NOT EXISTS "ConfiguracionBackup" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "backupDiario" BOOLEAN NOT NULL DEFAULT true,
    "horaBackup" TEXT NOT NULL DEFAULT '02:00',
    "retenerDias" INTEGER NOT NULL DEFAULT 30,
    "nubeHabilitado" BOOLEAN NOT NULL DEFAULT false,
    "proveedorNube" TEXT,
    "credenciales" TEXT,
    "pointInTime" BOOLEAN NOT NULL DEFAULT false,
    "intervaloPIT" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoBackup" TIMESTAMP(3),
    "ultimoExitoso" BOOLEAN NOT NULL DEFAULT false,
    "tamanoUltimo" DOUBLE PRECISION,
    "espacioUsado" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfiguracionBackup_pkey" PRIMARY KEY ("id")
);

-- 11. ConfiguracionPH (@@map("configuracion_ph"))
CREATE TABLE IF NOT EXISTS "configuracion_ph" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "umbralPSE" DOUBLE PRECISION NOT NULL DEFAULT 5.4,
    "umbralNormMax" DOUBLE PRECISION NOT NULL DEFAULT 5.7,
    "umbralIntMax" DOUBLE PRECISION NOT NULL DEFAULT 5.9,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuracion_ph_pkey" PRIMARY KEY ("id")
);

-- 12. ConfiguracionRotulo
CREATE TABLE IF NOT EXISTS "ConfiguracionRotulo" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ancho" INTEGER NOT NULL DEFAULT 100,
    "alto" INTEGER NOT NULL DEFAULT 50,
    "campos" TEXT,
    "incluyeCodigoBarras" BOOLEAN NOT NULL DEFAULT true,
    "codigoBarrasTipo" TEXT NOT NULL DEFAULT 'CODE128',
    "codigoBarrasPosicion" TEXT,
    "orientacion" TEXT NOT NULL DEFAULT 'HORIZONTAL',
    "margenes" TEXT,
    "plantilla" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfiguracionRotulo_pkey" PRIMARY KEY ("id")
);

-- 13. ConfiguracionSIGICA
CREATE TABLE IF NOT EXISTS "ConfiguracionSIGICA" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "habilitado" BOOLEAN NOT NULL DEFAULT false,
    "urlServicio" TEXT,
    "usuario" TEXT,
    "password" TEXT,
    "certificado" TEXT,
    "establecimiento" TEXT,
    "ultimaSincronizacion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfiguracionSIGICA_pkey" PRIMARY KEY ("id")
);

-- 14. ConfiguracionSeguridad
CREATE TABLE IF NOT EXISTS "ConfiguracionSeguridad" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "passwordMinLength" INTEGER NOT NULL DEFAULT 8,
    "passwordRequireUppercase" BOOLEAN NOT NULL DEFAULT true,
    "passwordRequireLowercase" BOOLEAN NOT NULL DEFAULT true,
    "passwordRequireNumbers" BOOLEAN NOT NULL DEFAULT true,
    "passwordRequireSpecialChars" BOOLEAN NOT NULL DEFAULT false,
    "passwordMaxAge" INTEGER NOT NULL DEFAULT 90,
    "sessionTimeout" INTEGER NOT NULL DEFAULT 480,
    "maxConcurrentSessions" INTEGER NOT NULL DEFAULT 1,
    "maxLoginAttempts" INTEGER NOT NULL DEFAULT 5,
    "lockoutDuration" INTEGER NOT NULL DEFAULT 30,
    "notifyNewIp" BOOLEAN NOT NULL DEFAULT true,
    "notifyFailedAttempts" BOOLEAN NOT NULL DEFAULT true,
    "notifyPasswordChange" BOOLEAN NOT NULL DEFAULT true,
    "notifyOutOfHoursAccess" BOOLEAN NOT NULL DEFAULT false,
    "restrictedHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "allowedHourStart" INTEGER,
    "allowedHourEnd" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfiguracionSeguridad_pkey" PRIMARY KEY ("id")
);

-- 15. DetalleConciliacion
CREATE TABLE IF NOT EXISTS "DetalleConciliacion" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "conciliacionId" TEXT NOT NULL,
    "movimientoCajaId" TEXT,
    "fechaExtracto" TIMESTAMP(3) NOT NULL,
    "descripcionExtracto" TEXT NOT NULL,
    "referenciaExtracto" TEXT,
    "montoExtracto" DOUBLE PRECISION NOT NULL,
    "tipoExtracto" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "confianza" DOUBLE PRECISION,
    "montoAjuste" DOUBLE PRECISION,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DetalleConciliacion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DetalleConciliacion_conciliacionId_idx" ON "DetalleConciliacion"("conciliacionId");
CREATE INDEX IF NOT EXISTS "DetalleConciliacion_estado_idx" ON "DetalleConciliacion"("estado");

-- 16. DetalleInventario
CREATE TABLE IF NOT EXISTS "DetalleInventario" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "inventarioId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidadSistema" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cantidadFisica" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diferencia" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costoUnitario" DOUBLE PRECISION,
    "costoDiferencia" DOUBLE PRECISION,
    "estado" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DetalleInventario_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "detalleInventario_insumo_deposito" ON "DetalleInventario"("inventarioId", "insumoId");
CREATE INDEX IF NOT EXISTS "DetalleInventario_inventarioId_idx" ON "DetalleInventario"("inventarioId");

-- 17. DetalleNotaCredito
CREATE TABLE IF NOT EXISTS "DetalleNotaCredito" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "notaCreditoId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "precioUnitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DetalleNotaCredito_pkey" PRIMARY KEY ("id")
);

-- 18. DetalleNotaDebito
CREATE TABLE IF NOT EXISTS "DetalleNotaDebito" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "notaDebitoId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "precioUnitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DetalleNotaDebito_pkey" PRIMARY KEY ("id")
);

-- 19. DetalleOrdenCompra
CREATE TABLE IF NOT EXISTS "DetalleOrdenCompra" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "ordenCompraId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidadPedida" DOUBLE PRECISION NOT NULL,
    "cantidadRecibida" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precioUnitario" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "centroCostoId" TEXT,
    "estado" "EstadoDetalleOrden" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DetalleOrdenCompra_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DetalleOrdenCompra_ordenCompraId_idx" ON "DetalleOrdenCompra"("ordenCompraId");
CREATE INDEX IF NOT EXISTS "DetalleOrdenCompra_insumoId_idx" ON "DetalleOrdenCompra"("insumoId");
CREATE INDEX IF NOT EXISTS "DetalleOrdenCompra_centroCostoId_idx" ON "DetalleOrdenCompra"("centroCostoId");

-- 20. FormaPago
CREATE TABLE IF NOT EXISTS "FormaPago" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" TEXT NOT NULL,
    "requiereBanco" BOOLEAN NOT NULL DEFAULT false,
    "requiereCheque" BOOLEAN NOT NULL DEFAULT false,
    "requiereTarjeta" BOOLEAN NOT NULL DEFAULT false,
    "cuentaContable" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormaPago_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FormaPago_nombre_key" ON "FormaPago"("nombre");

-- 21. HistorialBackup
CREATE TABLE IF NOT EXISTS "HistorialBackup" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tipo" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rutaArchivo" TEXT NOT NULL,
    "nombreArchivo" TEXT,
    "tamanio" DOUBLE PRECISION,
    "tablasIncluidas" TEXT,
    "estado" TEXT,
    "descripcion" TEXT,
    "mensajeError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialBackup_pkey" PRIMARY KEY ("id")
);

-- 22. HistorialPrecioInsumo
CREATE TABLE IF NOT EXISTS "HistorialPrecioInsumo" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "insumoId" TEXT NOT NULL,
    "precioAnterior" DOUBLE PRECISION,
    "precioNuevo" DOUBLE PRECISION,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "motivo" TEXT,
    "operadorId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistorialPrecioInsumo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HistorialPrecioInsumo_insumoId_idx" ON "HistorialPrecioInsumo"("insumoId");
CREATE INDEX IF NOT EXISTS "HistorialPrecioInsumo_fecha_idx" ON "HistorialPrecioInsumo"("fecha");

-- 23. HistoricoPrecio
CREATE TABLE IF NOT EXISTS "HistoricoPrecio" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "productoVendibleId" TEXT,
    "precioAnterior" DOUBLE PRECISION,
    "precioNuevo" DOUBLE PRECISION NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "fechaVigencia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT,
    "operadorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoPrecio_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HistoricoPrecio_productoVendibleId_idx" ON "HistoricoPrecio"("productoVendibleId");

-- 24. HistoricoPrecioProducto
CREATE TABLE IF NOT EXISTS "HistoricoPrecioProducto" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "productoVendibleId" TEXT NOT NULL,
    "precioAnterior" DOUBLE PRECISION,
    "precioNuevo" DOUBLE PRECISION NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "motivo" TEXT,
    "fechaVigencia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clienteId" TEXT,
    "operadorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoPrecioProducto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HistoricoPrecioProducto_productoVendibleId_fechaVigencia_idx" ON "HistoricoPrecioProducto"("productoVendibleId", "fechaVigencia" DESC);
CREATE INDEX IF NOT EXISTS "HistoricoPrecioProducto_clienteId_idx" ON "HistoricoPrecioProducto"("clienteId");

-- 25. HistoricoTarifa
CREATE TABLE IF NOT EXISTS "HistoricoTarifa" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tipoTarifaId" TEXT NOT NULL,
    "clienteId" TEXT,
    "especie" TEXT,
    "categoria" TEXT,
    "valor" DOUBLE PRECISION NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "vigenciaDesde" TIMESTAMP(3) NOT NULL,
    "vigenciaHasta" TIMESTAMP(3),
    "operadorId" TEXT,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoTarifa_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HistoricoTarifa_tipoTarifaId_vigenciaDesde_idx" ON "HistoricoTarifa"("tipoTarifaId", "vigenciaDesde");
CREATE INDEX IF NOT EXISTS "HistoricoTarifa_clienteId_tipoTarifaId_idx" ON "HistoricoTarifa"("clienteId", "tipoTarifaId");
CREATE INDEX IF NOT EXISTS "HistoricoTarifa_especie_idx" ON "HistoricoTarifa"("especie");
CREATE INDEX IF NOT EXISTS "HistoricoTarifa_vigenciaHasta_idx" ON "HistoricoTarifa"("vigenciaHasta");

-- 26. Impresora
CREATE TABLE IF NOT EXISTS "Impresora" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "puerto" TEXT NOT NULL DEFAULT 'USB',
    "direccionIP" TEXT,
    "anchoEtiqueta" INTEGER NOT NULL DEFAULT 80,
    "altoEtiqueta" INTEGER NOT NULL DEFAULT 50,
    "dpi" INTEGER NOT NULL DEFAULT 203,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "predeterminada" BOOLEAN NOT NULL DEFAULT false,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Impresora_pkey" PRIMARY KEY ("id")
);

-- 27. Indicador
CREATE TABLE IF NOT EXISTS "Indicador" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "unidad" TEXT NOT NULL,
    "meta" DOUBLE PRECISION,
    "alertaMinima" DOUBLE PRECISION,
    "alertaMaxima" DOUBLE PRECISION,
    "categoria" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Indicador_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Indicador_codigo_key" ON "Indicador"("codigo");
CREATE INDEX IF NOT EXISTS "Indicador_categoria_idx" ON "Indicador"("categoria");
CREATE INDEX IF NOT EXISTS "Indicador_activo_idx" ON "Indicador"("activo");

-- 28. Inventario
CREATE TABLE IF NOT EXISTS "Inventario" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "numero" INTEGER NOT NULL,
    "depositoId" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFin" TIMESTAMP(3),
    "operadorId" TEXT,
    "supervisorId" TEXT,
    "estado" "EstadoInventario" NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "itemsTotal" INTEGER NOT NULL DEFAULT 0,
    "itemsConDiferencia" INTEGER NOT NULL DEFAULT 0,
    "valorDiferencia" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inventario_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Inventario_depositoId_idx" ON "Inventario"("depositoId");
CREATE INDEX IF NOT EXISTS "Inventario_estado_idx" ON "Inventario"("estado");

-- 29. IpBloqueada
CREATE TABLE IF NOT EXISTS "IpBloqueada" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "ip" TEXT NOT NULL,
    "motivo" TEXT NOT NULL DEFAULT 'MANUAL',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaBloqueo" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaExpiracion" TIMESTAMP(3),
    "operadorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IpBloqueada_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IpBloqueada_ip_idx" ON "IpBloqueada"("ip");
CREATE INDEX IF NOT EXISTS "IpBloqueada_activo_idx" ON "IpBloqueada"("activo");

-- 30. MovimientoCaja
CREATE TABLE IF NOT EXISTS "MovimientoCaja" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "cajaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "saldoAnterior" DOUBLE PRECISION NOT NULL,
    "saldoNueva" DOUBLE PRECISION NOT NULL,
    "documentoTipo" TEXT,
    "documentoId" TEXT,
    "documentoNumero" TEXT,
    "concepto" TEXT NOT NULL,
    "observaciones" TEXT,
    "terceroNombre" TEXT,
    "terceroCuit" TEXT,
    "operadorId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoCaja_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MovimientoCaja_cajaId_idx" ON "MovimientoCaja"("cajaId");
CREATE INDEX IF NOT EXISTS "MovimientoCaja_tipo_idx" ON "MovimientoCaja"("tipo");
CREATE INDEX IF NOT EXISTS "MovimientoCaja_fecha_idx" ON "MovimientoCaja"("fecha");
CREATE INDEX IF NOT EXISTS "MovimientoCaja_documentoId_idx" ON "MovimientoCaja"("documentoId");

-- 31. MovimientoInsumo
CREATE TABLE IF NOT EXISTS "MovimientoInsumo" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "insumoId" TEXT NOT NULL,
    "tipo" "TipoMovimientoInsumo" NOT NULL,
    "depositoOrigenId" TEXT,
    "depositoDestinoId" TEXT,
    "cantidad" DOUBLE PRECISION NOT NULL,
    "loteInsumoId" TEXT,
    "precioUnitario" DOUBLE PRECISION,
    "costoTotal" DOUBLE PRECISION,
    "documentoTipo" TEXT,
    "documentoNumero" TEXT,
    "centroCostoId" TEXT,
    "produccionId" TEXT,
    "observaciones" TEXT,
    "operadorId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoInsumo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MovimientoInsumo_insumoId_idx" ON "MovimientoInsumo"("insumoId");
CREATE INDEX IF NOT EXISTS "MovimientoInsumo_tipo_idx" ON "MovimientoInsumo"("tipo");
CREATE INDEX IF NOT EXISTS "MovimientoInsumo_fecha_idx" ON "MovimientoInsumo"("fecha");

-- 32. NotaCredito
CREATE TABLE IF NOT EXISTS "NotaCredito" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "numero" TEXT NOT NULL,
    "numeroInterno" INTEGER NOT NULL,
    "clienteId" TEXT NOT NULL,
    "facturaId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "iva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "motivo" TEXT NOT NULL,
    "estado" "EstadoNota" NOT NULL DEFAULT 'EMITIDA',
    "observaciones" TEXT,
    "operadorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaCredito_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NotaCredito_clienteId_idx" ON "NotaCredito"("clienteId");
CREATE INDEX IF NOT EXISTS "NotaCredito_fecha_idx" ON "NotaCredito"("fecha");
CREATE INDEX IF NOT EXISTS "NotaCredito_estado_idx" ON "NotaCredito"("estado");

-- 33. NotaCreditoDebito
CREATE TABLE IF NOT EXISTS "NotaCreditoDebito" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tipo" TEXT NOT NULL,
    "tipoComprobante" INTEGER NOT NULL,
    "facturaId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "puntoVenta" INTEGER NOT NULL DEFAULT 1,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT NOT NULL,
    "descripcion" TEXT,
    "cae" TEXT,
    "caeVencimiento" TIMESTAMP(3),
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "iva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'EMITIDA',
    "operadorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaCreditoDebito_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NotaCreditoDebito_facturaId_idx" ON "NotaCreditoDebito"("facturaId");
CREATE INDEX IF NOT EXISTS "NotaCreditoDebito_tipo_idx" ON "NotaCreditoDebito"("tipo");
CREATE INDEX IF NOT EXISTS "NotaCreditoDebito_fecha_idx" ON "NotaCreditoDebito"("fecha");
CREATE INDEX IF NOT EXISTS "NotaCreditoDebito_estado_idx" ON "NotaCreditoDebito"("estado");

-- 34. NotaDebito
CREATE TABLE IF NOT EXISTS "NotaDebito" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "numero" TEXT NOT NULL,
    "numeroInterno" INTEGER NOT NULL,
    "clienteId" TEXT NOT NULL,
    "facturaId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "iva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "motivo" TEXT NOT NULL,
    "estado" "EstadoNota" NOT NULL DEFAULT 'EMITIDA',
    "observaciones" TEXT,
    "operadorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaDebito_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NotaDebito_clienteId_idx" ON "NotaDebito"("clienteId");
CREATE INDEX IF NOT EXISTS "NotaDebito_fecha_idx" ON "NotaDebito"("fecha");
CREATE INDEX IF NOT EXISTS "NotaDebito_estado_idx" ON "NotaDebito"("estado");

-- 35. NovedadCalidad
CREATE TABLE IF NOT EXISTS "NovedadCalidad" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaVencimiento" TIMESTAMP(3),
    "responsableId" TEXT,
    "responsableNombre" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "acciones" TEXT,
    "adjuntoUrl" TEXT,
    "observaciones" TEXT,
    "fechaResolucion" TIMESTAMP(3),
    "resueltoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NovedadCalidad_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NovedadCalidad_usuarioId_idx" ON "NovedadCalidad"("usuarioId");
CREATE INDEX IF NOT EXISTS "NovedadCalidad_estado_idx" ON "NovedadCalidad"("estado");
CREATE INDEX IF NOT EXISTS "NovedadCalidad_fecha_idx" ON "NovedadCalidad"("fecha");

-- 36. ObservacionUsuario
CREATE TABLE IF NOT EXISTS "ObservacionUsuario" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "clienteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'NOTA',
    "observacion" TEXT NOT NULL,
    "fechaSeguimiento" TIMESTAMP(3),
    "resuelto" BOOLEAN NOT NULL DEFAULT false,
    "resolucion" TEXT,
    "fechaResolucion" TIMESTAMP(3),
    "operadorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservacionUsuario_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ObservacionUsuario_clienteId_idx" ON "ObservacionUsuario"("clienteId");
CREATE INDEX IF NOT EXISTS "ObservacionUsuario_resuelto_idx" ON "ObservacionUsuario"("resuelto");

-- 37. OrdenCarga
CREATE TABLE IF NOT EXISTS "OrdenCarga" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "despachoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "horaPreparacion" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "firmaOperario" TEXT,
    "firmaChofer" TEXT,
    "tempCargaOK" BOOLEAN,
    "tempTransporteOK" BOOLEAN,
    "precintosOK" BOOLEAN,
    "fechaPreparacion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrdenCarga_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrdenCarga_despachoId_key" ON "OrdenCarga"("despachoId");
CREATE INDEX IF NOT EXISTS "OrdenCarga_estado_idx" ON "OrdenCarga"("estado");

-- 38. OrdenCompra
CREATE TABLE IF NOT EXISTS "OrdenCompra" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "numero" INTEGER NOT NULL,
    "proveedorId" TEXT,
    "fechaEmision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEntrega" TIMESTAMP(3),
    "fechaRecepcion" TIMESTAMP(3),
    "estado" "EstadoOrdenCompra" NOT NULL DEFAULT 'PENDIENTE',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "iva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "operadorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrdenCompra_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrdenCompra_estado_idx" ON "OrdenCompra"("estado");
CREATE INDEX IF NOT EXISTS "OrdenCompra_proveedorId_idx" ON "OrdenCompra"("proveedorId");
CREATE INDEX IF NOT EXISTS "OrdenCompra_fechaEmision_idx" ON "OrdenCompra"("fechaEmision");

-- 39. Pago
CREATE TABLE IF NOT EXISTS "Pago" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "numero" INTEGER NOT NULL,
    "terceroId" TEXT,
    "terceroNombre" TEXT NOT NULL,
    "terceroCuit" TEXT,
    "terceroTipo" TEXT NOT NULL,
    "formaPagoId" TEXT,
    "monto" DOUBLE PRECISION NOT NULL,
    "chequeId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "comprobante" TEXT,
    "observaciones" TEXT,
    "operadorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Pago_terceroId_idx" ON "Pago"("terceroId");
CREATE INDEX IF NOT EXISTS "Pago_fecha_idx" ON "Pago"("fecha");
CREATE INDEX IF NOT EXISTS "Pago_estado_idx" ON "Pago"("estado");

-- 40. PagoFactura
CREATE TABLE IF NOT EXISTS "PagoFactura" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "facturaId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "monto" DOUBLE PRECISION NOT NULL,
    "metodoPago" TEXT NOT NULL DEFAULT 'EFECTIVO',
    "referencia" TEXT,
    "banco" TEXT,
    "numeroCheque" TEXT,
    "fechaCheque" TIMESTAMP(3),
    "observaciones" TEXT,
    "operadorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagoFactura_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PagoFactura_facturaId_idx" ON "PagoFactura"("facturaId");
CREATE INDEX IF NOT EXISTS "PagoFactura_fecha_idx" ON "PagoFactura"("fecha");
CREATE INDEX IF NOT EXISTS "PagoFactura_metodoPago_idx" ON "PagoFactura"("metodoPago");

-- 41. PesajeInterno
CREATE TABLE IF NOT EXISTS "PesajeInterno" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tropaCodigo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grasa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lavadito" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bolsaAzul" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hueso" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grasaBascula" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "despojo" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "operadorId" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PesajeInterno_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PesajeInterno_tropaCodigo_key" ON "PesajeInterno"("tropaCodigo");
CREATE INDEX IF NOT EXISTS "PesajeInterno_tropaCodigo_idx" ON "PesajeInterno"("tropaCodigo");
CREATE INDEX IF NOT EXISTS "PesajeInterno_fecha_idx" ON "PesajeInterno"("fecha");

-- 42. PlantillaReporte
CREATE TABLE IF NOT EXISTS "PlantillaReporte" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,
    "archivoNombre" TEXT NOT NULL,
    "archivoContenido" TEXT NOT NULL,
    "marcadores" TEXT,
    "hojaDatos" TEXT NOT NULL DEFAULT 'Datos',
    "filaInicio" INTEGER NOT NULL DEFAULT 1,
    "rangoDatos" TEXT,
    "columnas" TEXT,
    "orientacion" TEXT NOT NULL DEFAULT 'portrait',
    "tamanoPapel" TEXT NOT NULL DEFAULT 'A4',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "categoria" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantillaReporte_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlantillaReporte_nombre_key" ON "PlantillaReporte"("nombre");
CREATE UNIQUE INDEX IF NOT EXISTS "PlantillaReporte_codigo_key" ON "PlantillaReporte"("codigo");
CREATE INDEX IF NOT EXISTS "PlantillaReporte_categoria_idx" ON "PlantillaReporte"("categoria");
CREATE INDEX IF NOT EXISTS "PlantillaReporte_activo_idx" ON "PlantillaReporte"("activo");

-- 43. PrecioHistorial
CREATE TABLE IF NOT EXISTS "PrecioHistorial" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "precioServicioId" TEXT,
    "tipoServicioId" TEXT NOT NULL,
    "tipoServicioNombre" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "clienteNombre" TEXT NOT NULL,
    "precioAnterior" DOUBLE PRECISION,
    "precioNuevo" DOUBLE PRECISION NOT NULL,
    "fechaDesde" TIMESTAMP(3) NOT NULL,
    "fechaHasta" TIMESTAMP(3),
    "motivo" TEXT,
    "operadorId" TEXT,
    "operadorNombre" TEXT,
    "tipoCambio" TEXT NOT NULL DEFAULT 'CREACION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrecioHistorial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PrecioHistorial_precioServicioId_idx" ON "PrecioHistorial"("precioServicioId");
CREATE INDEX IF NOT EXISTS "PrecioHistorial_tipoServicioId_idx" ON "PrecioHistorial"("tipoServicioId");
CREATE INDEX IF NOT EXISTS "PrecioHistorial_clienteId_idx" ON "PrecioHistorial"("clienteId");
CREATE INDEX IF NOT EXISTS "PrecioHistorial_fechaDesde_idx" ON "PrecioHistorial"("fechaDesde");
CREATE INDEX IF NOT EXISTS "PrecioHistorial_operadorId_idx" ON "PrecioHistorial"("operadorId");
CREATE INDEX IF NOT EXISTS "PrecioHistorial_tipoCambio_idx" ON "PrecioHistorial"("tipoCambio");

-- 44. PrecioRendering
CREATE TABLE IF NOT EXISTS "PrecioRendering" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "clienteId" TEXT NOT NULL,
    "tipoProducto" TEXT NOT NULL,
    "precioKg" DOUBLE PRECISION NOT NULL,
    "fechaDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaHasta" TIMESTAMP(3),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrecioRendering_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PrecioRendering_clienteId_idx" ON "PrecioRendering"("clienteId");
CREATE INDEX IF NOT EXISTS "PrecioRendering_tipoProducto_idx" ON "PrecioRendering"("tipoProducto");

-- 45. PrecioServicio
CREATE TABLE IF NOT EXISTS "PrecioServicio" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tipoServicioId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "precio" DOUBLE PRECISION NOT NULL,
    "fechaDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaHasta" TIMESTAMP(3),
    "observaciones" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrecioServicio_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PrecioServicio_tipoServicioId_idx" ON "PrecioServicio"("tipoServicioId");
CREATE INDEX IF NOT EXISTS "PrecioServicio_clienteId_idx" ON "PrecioServicio"("clienteId");
CREATE INDEX IF NOT EXISTS "PrecioServicio_fechaDesde_idx" ON "PrecioServicio"("fechaDesde");
CREATE INDEX IF NOT EXISTS "PrecioServicio_fechaHasta_idx" ON "PrecioServicio"("fechaHasta");

-- 46. PreferenciasUI
CREATE TABLE IF NOT EXISTS "PreferenciasUI" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "operadorId" TEXT NOT NULL,
    "moduloOrden" TEXT,
    "moduloTamano" TEXT,
    "moduloVisible" TEXT,
    "moduloColor" TEXT,
    "sidebarExpandido" BOOLEAN NOT NULL DEFAULT true,
    "gruposExpandidos" TEXT,
    "tema" TEXT NOT NULL DEFAULT 'light',
    "tamanoFuente" TEXT NOT NULL DEFAULT 'normal',
    "densidad" TEXT NOT NULL DEFAULT 'normal',
    "paginaInicio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreferenciasUI_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PreferenciasUI_operadorId_key" ON "PreferenciasUI"("operadorId");
CREATE INDEX IF NOT EXISTS "PreferenciasUI_operadorId_idx" ON "PreferenciasUI"("operadorId");

-- 47. PresupuestoCentro
CREATE TABLE IF NOT EXISTS "PresupuestoCentro" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "centroCostoId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "presupuesto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ejecutado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "desviacion" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresupuestoCentro_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PresupuestoCentro_centroCostoId_anio_mes_key" ON "PresupuestoCentro"("centroCostoId", "anio", "mes");

-- 48. Raza
CREATE TABLE IF NOT EXISTS "Raza" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "especie" TEXT NOT NULL,
    "observaciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Raza_pkey" PRIMARY KEY ("id")
);

-- 49. RecepcionCompra
CREATE TABLE IF NOT EXISTS "RecepcionCompra" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "ordenCompraId" TEXT NOT NULL,
    "numeroRemito" TEXT,
    "fechaRecepcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoRecepcion" NOT NULL DEFAULT 'PARCIAL',
    "observaciones" TEXT,
    "operadorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecepcionCompra_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RecepcionCompra_ordenCompraId_idx" ON "RecepcionCompra"("ordenCompraId");
CREATE INDEX IF NOT EXISTS "RecepcionCompra_estado_idx" ON "RecepcionCompra"("estado");

-- 50. RegistroCuarteo
CREATE TABLE IF NOT EXISTS "RegistroCuarteo" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "mediaResId" TEXT,
    "tipoCorte" "TipoCuarteo" NOT NULL DEFAULT 'DELANTERO_TRASERO',
    "pesoTotal" DOUBLE PRECISION NOT NULL,
    "pesoDelantero" DOUBLE PRECISION,
    "pesoTrasero" DOUBLE PRECISION,
    "camaraId" TEXT,
    "operadorId" TEXT,
    "observaciones" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroCuarteo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RegistroCuarteo_fecha_idx" ON "RegistroCuarteo"("fecha");
CREATE INDEX IF NOT EXISTS "RegistroCuarteo_tipoCorte_idx" ON "RegistroCuarteo"("tipoCorte");

-- 51. RegistroEmpaque
CREATE TABLE IF NOT EXISTS "RegistroEmpaque" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "paqueteId" TEXT NOT NULL,
    "producto" TEXT NOT NULL,
    "productoId" TEXT,
    "pesoKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "destino" TEXT,
    "camaraId" TEXT,
    "estado" "EstadoEmpaque" NOT NULL DEFAULT 'PENDIENTE',
    "loteId" TEXT,
    "operadorId" TEXT,
    "fechaDespacho" TIMESTAMP(3),
    "observaciones" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroEmpaque_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RegistroEmpaque_paqueteId_key" ON "RegistroEmpaque"("paqueteId");
CREATE INDEX IF NOT EXISTS "RegistroEmpaque_producto_idx" ON "RegistroEmpaque"("producto");
CREATE INDEX IF NOT EXISTS "RegistroEmpaque_estado_idx" ON "RegistroEmpaque"("estado");
CREATE INDEX IF NOT EXISTS "RegistroEmpaque_fecha_idx" ON "RegistroEmpaque"("fecha");

-- 52. RendimientoHistorico
CREATE TABLE IF NOT EXISTS "RendimientoHistorico" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "especie" "Especie" NOT NULL,
    "tipoAnimal" "TipoAnimal" NOT NULL,
    "cantidadAnimales" INTEGER NOT NULL DEFAULT 0,
    "pesoVivoPromedio" DOUBLE PRECISION,
    "pesoFrioPromedio" DOUBLE PRECISION,
    "rindePromedio" DOUBLE PRECISION,
    "rindeMinimo" DOUBLE PRECISION,
    "rindeMaximo" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RendimientoHistorico_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "rendimientoHistorico_anio_mes_especie_tipo" ON "RendimientoHistorico"("anio", "mes", "especie", "tipoAnimal");
CREATE INDEX IF NOT EXISTS "RendimientoHistorico_anio_idx" ON "RendimientoHistorico"("anio");
CREATE INDEX IF NOT EXISTS "RendimientoHistorico_mes_idx" ON "RendimientoHistorico"("mes");
CREATE INDEX IF NOT EXISTS "RendimientoHistorico_especie_idx" ON "RendimientoHistorico"("especie");

-- 53. ReporteAutomatico
CREATE TABLE IF NOT EXISTS "ReporteAutomatico" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" TEXT NOT NULL,
    "formato" TEXT NOT NULL DEFAULT 'PDF',
    "frecuencia" TEXT NOT NULL,
    "diaSemana" INTEGER,
    "diaMes" INTEGER,
    "hora" TEXT NOT NULL DEFAULT '08:00',
    "destinatarios" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "proximoEnvio" TIMESTAMP(3),
    "ultimoEnvio" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReporteAutomatico_pkey" PRIMARY KEY ("id")
);

-- 54. ReporteSenasa
CREATE TABLE IF NOT EXISTS "ReporteSenasa" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tipoReporte" "TipoReporteSenasa" NOT NULL,
    "fechaDesde" TIMESTAMP(3) NOT NULL,
    "fechaHasta" TIMESTAMP(3) NOT NULL,
    "periodo" TEXT NOT NULL,
    "estado" "EstadoReporteSenasa" NOT NULL DEFAULT 'PENDIENTE',
    "fechaEnvio" TIMESTAMP(3),
    "fechaConfirmacion" TIMESTAMP(3),
    "mensajeError" TEXT,
    "reintentos" INTEGER NOT NULL DEFAULT 0,
    "archivoNombre" TEXT,
    "archivoUrl" TEXT,
    "datosReporte" TEXT,
    "observaciones" TEXT,
    "operadorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReporteSenasa_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReporteSenasa_tipoReporte_idx" ON "ReporteSenasa"("tipoReporte");
CREATE INDEX IF NOT EXISTS "ReporteSenasa_estado_idx" ON "ReporteSenasa"("estado");
CREATE INDEX IF NOT EXISTS "ReporteSenasa_fechaDesde_idx" ON "ReporteSenasa"("fechaDesde");
CREATE INDEX IF NOT EXISTS "ReporteSenasa_fechaEnvio_idx" ON "ReporteSenasa"("fechaEnvio");

-- 55. ResumenCostosFaena
CREATE TABLE IF NOT EXISTS "ResumenCostosFaena" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "listaFaenaId" TEXT NOT NULL,
    "totalAnimales" INTEGER,
    "totalKg" DOUBLE PRECISION,
    "costoTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costoPorKg" DOUBLE PRECISION,
    "costoPorAnimal" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumenCostosFaena_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ResumenCostosFaena_listaFaenaId_key" ON "ResumenCostosFaena"("listaFaenaId");

-- 56. RindeFaena
CREATE TABLE IF NOT EXISTS "RindeFaena" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tropaId" TEXT,
    "tropaCodigo" TEXT,
    "numeroGarron" INTEGER,
    "numeroAnimal" INTEGER,
    "caravana" TEXT,
    "raza" TEXT,
    "tipoAnimal" TEXT,
    "pesoVivo" DOUBLE PRECISION NOT NULL,
    "pesoMediaA" DOUBLE PRECISION,
    "pesoMediaB" DOUBLE PRECISION,
    "pesoTotalMedia" DOUBLE PRECISION NOT NULL,
    "rinde" DOUBLE PRECISION NOT NULL,
    "rindePorcentaje" DOUBLE PRECISION NOT NULL,
    "fechaFaena" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matarife" TEXT,
    "numeroDTE" TEXT,
    "operadorId" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RindeFaena_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RindeFaena_tropaId_idx" ON "RindeFaena"("tropaId");
CREATE INDEX IF NOT EXISTS "RindeFaena_tropaCodigo_idx" ON "RindeFaena"("tropaCodigo");
CREATE INDEX IF NOT EXISTS "RindeFaena_fechaFaena_idx" ON "RindeFaena"("fechaFaena");

-- 57. RotuloElemento
CREATE TABLE IF NOT EXISTS "RotuloElemento" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "rotuloId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "campo" TEXT,
    "textoFijo" TEXT,
    "posX" INTEGER NOT NULL DEFAULT 0,
    "posY" INTEGER NOT NULL DEFAULT 0,
    "ancho" INTEGER DEFAULT 100,
    "alto" INTEGER DEFAULT 30,
    "fuente" TEXT DEFAULT '0',
    "tamano" INTEGER DEFAULT 10,
    "negrita" BOOLEAN NOT NULL DEFAULT false,
    "anchoFuente" INTEGER DEFAULT 0,
    "alineacion" TEXT DEFAULT 'LEFT',
    "tipoCodigo" TEXT DEFAULT 'CODE128',
    "altoCodigo" INTEGER DEFAULT 60,
    "mostrarTexto" BOOLEAN NOT NULL DEFAULT true,
    "grosorLinea" INTEGER DEFAULT 2,
    "color" TEXT DEFAULT 'B',
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RotuloElemento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RotuloElemento_rotuloId_idx" ON "RotuloElemento"("rotuloId");
CREATE INDEX IF NOT EXISTS "RotuloElemento_tipo_idx" ON "RotuloElemento"("tipo");

-- 58. Sesion
CREATE TABLE IF NOT EXISTS "Sesion" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "operadorId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "userAgent" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaExpiracion" TIMESTAMP(3) NOT NULL,
    "fechaCierre" TIMESTAMP(3),
    "motivoCierre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sesion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Sesion_operadorId_idx" ON "Sesion"("operadorId");
CREATE INDEX IF NOT EXISTS "Sesion_activa_idx" ON "Sesion"("activa");

-- 59. SesionRomaneo
CREATE TABLE IF NOT EXISTS "SesionRomaneo" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "operadorId" TEXT NOT NULL,
    "tipificadorId" TEXT,
    "camaraId" TEXT,
    "ultimoGarron" INTEGER,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaFin" TIMESTAMP(3),

    CONSTRAINT "SesionRomaneo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SesionRomaneo_operadorId_idx" ON "SesionRomaneo"("operadorId");
CREATE INDEX IF NOT EXISTS "SesionRomaneo_activa_idx" ON "SesionRomaneo"("activa");

-- 60. StockCamara
CREATE TABLE IF NOT EXISTS "StockCamara" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "productoId" TEXT NOT NULL,
    "camaraId" TEXT NOT NULL,
    "cantidad" INTEGER,
    "pesoTotal" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockCamara_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StockCamara_productoId_idx" ON "StockCamara"("productoId");
CREATE INDEX IF NOT EXISTS "StockCamara_camaraId_idx" ON "StockCamara"("camaraId");

-- 61. StockCamaraSIGICA
CREATE TABLE IF NOT EXISTS "StockCamaraSIGICA" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "camaraId" TEXT NOT NULL,
    "totalMedias" INTEGER NOT NULL DEFAULT 0,
    "totalKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bovinosMedias" INTEGER NOT NULL DEFAULT 0,
    "bovinosKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "equinosMedias" INTEGER NOT NULL DEFAULT 0,
    "equinosKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remanenteKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sincronizado" BOOLEAN NOT NULL DEFAULT false,
    "ultimaActualizacion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockCamaraSIGICA_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StockCamaraSIGICA_camaraId_key" ON "StockCamaraSIGICA"("camaraId");

-- 62. StockInsumo
CREATE TABLE IF NOT EXISTS "StockInsumo" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "insumoId" TEXT NOT NULL,
    "depositoId" TEXT NOT NULL,
    "cantidad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cantidadMinima" DOUBLE PRECISION,
    "cantidadMaxima" DOUBLE PRECISION,
    "precioPromedio" DOUBLE PRECISION,
    "valorTotal" DOUBLE PRECISION,
    "ultimoIngreso" TIMESTAMP(3),
    "ultimaSalida" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockInsumo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stockInsumo_insumo_deposito" ON "StockInsumo"("insumoId", "depositoId");
CREATE INDEX IF NOT EXISTS "StockInsumo_depositoId_idx" ON "StockInsumo"("depositoId");

-- 63. StockProducto
CREATE TABLE IF NOT EXISTS "StockProducto" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "productoNombre" TEXT NOT NULL,
    "productoId" TEXT,
    "productoDesposteId" TEXT,
    "lote" TEXT,
    "tropaCodigo" TEXT,
    "camaraId" TEXT,
    "cantidad" INTEGER NOT NULL DEFAULT 0,
    "pesoTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tipo" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'DISPONIBLE',
    "fechaIngreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockProducto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StockProducto_productoId_idx" ON "StockProducto"("productoId");
CREATE INDEX IF NOT EXISTS "StockProducto_camaraId_idx" ON "StockProducto"("camaraId");
CREATE INDEX IF NOT EXISTS "StockProducto_estado_idx" ON "StockProducto"("estado");
CREATE INDEX IF NOT EXISTS "StockProducto_tropaCodigo_idx" ON "StockProducto"("tropaCodigo");

-- 64. SubproductoIncomestible
CREATE TABLE IF NOT EXISTS "SubproductoIncomestible" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT,
    "kilos" DOUBLE PRECISION NOT NULL,
    "cantidad" INTEGER,
    "tropaCodigo" TEXT,
    "fechaFaena" TIMESTAMP(3),
    "destino" TEXT,
    "clienteId" TEXT,
    "precioKg" DOUBLE PRECISION,
    "montoTotal" DOUBLE PRECISION,
    "estado" TEXT NOT NULL DEFAULT 'DISPONIBLE',
    "operadorId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubproductoIncomestible_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SubproductoIncomestible_tipo_idx" ON "SubproductoIncomestible"("tipo");
CREATE INDEX IF NOT EXISTS "SubproductoIncomestible_estado_idx" ON "SubproductoIncomestible"("estado");
CREATE INDEX IF NOT EXISTS "SubproductoIncomestible_fecha_idx" ON "SubproductoIncomestible"("fecha");

-- 65. Terminal
CREATE TABLE IF NOT EXISTS "Terminal" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "ubicacion" TEXT,
    "balanzaId" TEXT,
    "impresoraId" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Terminal_pkey" PRIMARY KEY ("id")
);

-- 66. TipoServicio
CREATE TABLE IF NOT EXISTS "TipoServicio" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "unidad" TEXT NOT NULL DEFAULT 'KG',
    "seFactura" BOOLEAN NOT NULL DEFAULT true,
    "incluidoEn" TEXT,
    "porcentajeIva" DOUBLE PRECISION NOT NULL DEFAULT 21,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TipoServicio_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TipoServicio_codigo_key" ON "TipoServicio"("codigo");
CREATE INDEX IF NOT EXISTS "TipoServicio_activo_idx" ON "TipoServicio"("activo");
CREATE INDEX IF NOT EXISTS "TipoServicio_orden_idx" ON "TipoServicio"("orden");

-- 67. TipoTarifa
CREATE TABLE IF NOT EXISTS "TipoTarifa" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "unidad" TEXT NOT NULL DEFAULT 'POR_KG',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TipoTarifa_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TipoTarifa_codigo_key" ON "TipoTarifa"("codigo");
CREATE INDEX IF NOT EXISTS "TipoTarifa_activo_idx" ON "TipoTarifa"("activo");
CREATE INDEX IF NOT EXISTS "TipoTarifa_orden_idx" ON "TipoTarifa"("orden");

-- 68. TipoTrabajo
CREATE TABLE IF NOT EXISTS "TipoTrabajo" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "esDefault" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TipoTrabajo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TipoTrabajo_codigo_key" ON "TipoTrabajo"("codigo");

-- 69. UsuarioCalidad
CREATE TABLE IF NOT EXISTS "UsuarioCalidad" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT,
    "cuit" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'EMPLEADO',
    "area" TEXT,
    "sector" TEXT,
    "puesto" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "fechaIngreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaEgreso" TIMESTAMP(3),
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsuarioCalidad_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UsuarioCalidad_dni_key" ON "UsuarioCalidad"("dni");
CREATE INDEX IF NOT EXISTS "UsuarioCalidad_estado_idx" ON "UsuarioCalidad"("estado");

-- 70. ValorIndicador
CREATE TABLE IF NOT EXISTS "ValorIndicador" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "indicadorId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valor" DOUBLE PRECISION NOT NULL,
    "valorMeta" DOUBLE PRECISION,
    "desviacion" DOUBLE PRECISION,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValorIndicador_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "valorIndicador_indicador_fecha" ON "ValorIndicador"("indicadorId", "fecha");
CREATE INDEX IF NOT EXISTS "ValorIndicador_indicadorId_idx" ON "ValorIndicador"("indicadorId");
CREATE INDEX IF NOT EXISTS "ValorIndicador_fecha_idx" ON "ValorIndicador"("fecha");
