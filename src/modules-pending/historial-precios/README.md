# Módulo: Historial de Precios

## Prioridad: MEDIA

## Descripción
Sistema de gestión y seguimiento de precios para productos, servicios e insumos, con historial completo de cambios y análisis de tendencias.

## Funcionalidades

### Precios Actuales
- Vista de todos los precios vigentes
- Filtro por tipo de entidad
- Indicador de tendencia (subiendo/bajando/estable)
- Variación porcentual respecto al precio anterior
- Búsqueda rápida

### Historial de Cambios
- Registro completo de todos los cambios de precio
- Filtros por fecha, tipo y entidad
- Variación porcentual calculada automáticamente
- Operador que realizó el cambio
- Observaciones

### Actualización de Precios
- Formulario para registrar nuevos precios
- Cálculo automático de variación
- Soporte para múltiples monedas (ARS, USD)
- Registro de observaciones

### Análisis
- Estadísticas de variación
- Promedio de cambios
- Tendencia general

## Tipos de Entidades con Precio
| Tipo | Descripción |
|------|-------------|
| PRODUCTO | Productos del catálogo |
| SERVICIO | Servicios ofrecidos |
| INSUMO | Materiales e insumos |
| CLIENTE_ESPECIAL | Precios personalizados por cliente |

## Dependencias
- `@/components/ui/*` - Componentes de UI
- `lucide-react` - Iconos
- `sonner` - Notificaciones

## Modelos Prisma a Crear

```prisma
model HistorialPrecio {
  id              String    @id @default(cuid())
  tipo            String    // PRODUCTO, SERVICIO, INSUMO, CLIENTE_ESPECIAL
  entidadId       String
  entidadNombre   String
  precioAnterior  Float
  precioNuevo     Float
  variacionPct    Float     @default(0)
  moneda          String    @default("ARS")
  fecha           DateTime  @default(now())
  operadorId      String?
  observaciones   String?
  
  createdAt       DateTime  @default(now())
  
  @@index([tipo])
  @@index([entidadId])
  @@index([fecha])
}
```

## APIs Requeridas

- `GET /api/historial-precios` - Listar historial
- `GET /api/historial-precios/actuales` - Precios actuales
- `POST /api/historial-precios` - Registrar nuevo precio
- `PUT /api/historial-precios` - Actualizar precio
- `GET /api/historial-precios/estadisticas` - Estadísticas
- `GET /api/historial-precios/exportar` - Exportar CSV

## Cómo Implementar

1. Crear modelo `HistorialPrecio` en Prisma
2. Ejecutar `bun run db:push`
3. Crear APIs correspondientes
4. Agregar al menú de navegación:
```typescript
{ id: 'historialPrecios', label: 'Historial Precios', icon: DollarSign, permiso: 'puedeConfiguracion' }
```

## Mejoras Futuras
- [ ] Gráficos de tendencias
- [ ] Alertas de variaciones significativas
- [ ] Integración con facturación
- [ ] Actualización masiva de precios
- [ ] Aprobación de cambios por supervisor

## Estado
- **Creado**: Pendiente de implementación
- **Versión**: 3.7.17
