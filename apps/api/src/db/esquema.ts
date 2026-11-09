// Tablas de ElCuaderno. RN-01: todo el dinero es `integer` (pesos enteros).
import { sql } from 'drizzle-orm';
import { boolean, check, date, index, integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const rolEnum = pgEnum('rol', ['DUENO', 'CAJERO']);
export const medioEnum = pgEnum('medio_de_pago', ['EFECTIVO', 'NEQUI', 'FIADO']);
export const movimientoCajaEnum = pgEnum('movimiento_caja', ['BASE', 'GASTO']);

export const tiendas = pgTable('tiendas', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull(),
});

export const usuarios = pgTable(
  'usuarios',
  {
    id: serial('id').primaryKey(),
    tiendaId: integer('tienda_id').notNull().references(() => tiendas.id),
    nombre: text('nombre').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    rol: rolEnum('rol').notNull(),
  },
  (t) => [uniqueIndex('usuarios_email_uk').on(t.email)],
);

export const productos = pgTable(
  'productos',
  {
    id: serial('id').primaryKey(),
    tiendaId: integer('tienda_id').notNull().references(() => tiendas.id),
    nombre: text('nombre').notNull(),
    precio: integer('precio').notNull(),
    costo: integer('costo').notNull(),
    stock: integer('stock').notNull(),
    stockMinimo: integer('stock_minimo').notNull().default(0),
    // Venta a granel: precio y costo por kilo; stock en gramos.
    porPeso: boolean('por_peso').notNull().default(false),
    activo: boolean('activo').notNull().default(true),
  },
  (t) => [
    // RN-02: la base de datos también protege que el stock nunca sea negativo.
    check('productos_stock_no_negativo', sql`${t.stock} >= 0`),
    check('productos_precio_positivo', sql`${t.precio} > 0`),
    check('productos_costo_valido', sql`${t.costo} >= 0 AND ${t.costo} <= ${t.precio}`),
    index('productos_tienda_idx').on(t.tiendaId),
  ],
);

export const clientes = pgTable(
  'clientes',
  {
    id: serial('id').primaryKey(),
    tiendaId: integer('tienda_id').notNull().references(() => tiendas.id),
    nombre: text('nombre').notNull(),
    telefono: text('telefono'),
    cupo: integer('cupo').notNull().default(0),
    // Ley 1581 de 2012: el vecino autoriza que la tienda guarde su nombre, teléfono y fiados.
    autorizaDatos: boolean('autoriza_datos').notNull().default(false),
    autorizadoEn: timestamp('autorizado_en', { withTimezone: true }),
    // Supresión: se borran sus datos personales y se conserva el historial sin nombre.
    suprimidoEn: timestamp('suprimido_en', { withTimezone: true }),
  },
  (t) => [check('clientes_cupo_valido', sql`${t.cupo} >= 0`), index('clientes_tienda_idx').on(t.tiendaId)],
);

export const ventas = pgTable(
  'ventas',
  {
    id: serial('id').primaryKey(),
    tiendaId: integer('tienda_id').notNull().references(() => tiendas.id),
    clienteId: integer('cliente_id').references(() => clientes.id),
    usuarioId: integer('usuario_id').notNull().references(() => usuarios.id),
    medio: medioEnum('medio').notNull(),
    total: integer('total').notNull(),
    creadaEn: timestamp('creada_en', { withTimezone: true }).notNull().defaultNow(),
    // Anulación: la venta no se borra (la caja y la bitácora deben cuadrar); se marca.
    anuladaEn: timestamp('anulada_en', { withTimezone: true }),
    anuladaPor: integer('anulada_por').references(() => usuarios.id),
    motivoAnulacion: text('motivo_anulacion'),
  },
  (t) => [
    check('ventas_fiado_con_cliente', sql`${t.medio} <> 'FIADO' OR ${t.clienteId} IS NOT NULL`),
    check(
      'ventas_anulacion_completa',
      sql`(${t.anuladaEn} IS NULL) = (${t.anuladaPor} IS NULL) AND (${t.anuladaEn} IS NULL) = (${t.motivoAnulacion} IS NULL)`,
    ),
    index('ventas_tienda_fecha_idx').on(t.tiendaId, t.creadaEn),
  ],
);

export const detallesVenta = pgTable(
  'detalles_venta',
  {
    id: serial('id').primaryKey(),
    ventaId: integer('venta_id').notNull().references(() => ventas.id),
    productoId: integer('producto_id').notNull().references(() => productos.id),
    cantidad: integer('cantidad').notNull(),
    // RN-04: precio y costo del momento de la venta.
    precioUnitario: integer('precio_unitario').notNull(),
    costoUnitario: integer('costo_unitario').notNull(),
    // Lo cobrado y lo que costó la línea, ya calculados (por peso se redondea a 50 pesos):
    // la caja y los reportes suman estas columnas y no recalculan precio × cantidad.
    subtotal: integer('subtotal').notNull(),
    costoTotal: integer('costo_total').notNull(),
  },
  (t) => [check('detalles_cantidad_positiva', sql`${t.cantidad} > 0`), index('detalles_venta_idx').on(t.ventaId)],
);

export const abonos = pgTable(
  'abonos',
  {
    id: serial('id').primaryKey(),
    tiendaId: integer('tienda_id').notNull().references(() => tiendas.id),
    clienteId: integer('cliente_id').notNull().references(() => clientes.id),
    usuarioId: integer('usuario_id').notNull().references(() => usuarios.id),
    monto: integer('monto').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('abonos_monto_positivo', sql`${t.monto} > 0`), index('abonos_cliente_idx').on(t.clienteId)],
);

/**
 * Bitácora: quién hizo cada cambio y cuándo. Sin llaves foráneas a propósito: el registro
 * sobrevive aunque se borre el usuario, por eso guarda también su nombre. Un trigger de la
 * migración 0001 impide editar o borrar filas (solo la recarga de la demo puede vaciarla).
 */
export const bitacora = pgTable(
  'bitacora',
  {
    id: serial('id').primaryKey(),
    tiendaId: integer('tienda_id').notNull(),
    usuarioId: integer('usuario_id'),
    usuarioNombre: text('usuario_nombre').notNull(),
    accion: text('accion').notNull(),
    detalle: text('detalle'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('bitacora_tienda_fecha_idx').on(t.tiendaId, t.creadoEn)],
);

/**
 * Movimientos del cajón que no son ventas: la base con que se abre el día y los gastos
 * que salen del cajón (pago al proveedor, el domicilio...). `dia` es el día local (Colombia).
 */
export const movimientosCaja = pgTable(
  'movimientos_caja',
  {
    id: serial('id').primaryKey(),
    tiendaId: integer('tienda_id').notNull().references(() => tiendas.id),
    dia: date('dia', { mode: 'string' }).notNull(),
    tipo: movimientoCajaEnum('tipo').notNull(),
    monto: integer('monto').notNull(),
    descripcion: text('descripcion'),
    usuarioId: integer('usuario_id').notNull().references(() => usuarios.id),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('movimientos_monto_valido', sql`${t.monto} >= 0 AND (${t.tipo} = 'BASE' OR ${t.monto} > 0)`),
    check('movimientos_gasto_con_descripcion', sql`${t.tipo} = 'BASE' OR ${t.descripcion} IS NOT NULL`),
    // Una sola base por tienda y día.
    uniqueIndex('movimientos_una_base_por_dia').on(t.tiendaId, t.dia).where(sql`${t.tipo} = 'BASE'`),
    index('movimientos_tienda_dia_idx').on(t.tiendaId, t.dia),
  ],
);

/** Cierre del día: lo que debía haber, lo que la dueña contó y la diferencia. Uno por día. */
export const cierresCaja = pgTable(
  'cierres_caja',
  {
    id: serial('id').primaryKey(),
    tiendaId: integer('tienda_id').notNull().references(() => tiendas.id),
    dia: date('dia', { mode: 'string' }).notNull(),
    esperado: integer('esperado').notNull(),
    contado: integer('contado').notNull(),
    nota: text('nota'),
    usuarioId: integer('usuario_id').notNull().references(() => usuarios.id),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('cierres_contado_valido', sql`${t.contado} >= 0`), uniqueIndex('cierres_uno_por_dia').on(t.tiendaId, t.dia)],
);

/** Historial de llegadas de mercancía: cuántas unidades, a qué costo y de qué proveedor. */
export const entradasInventario = pgTable(
  'entradas_inventario',
  {
    id: serial('id').primaryKey(),
    tiendaId: integer('tienda_id').notNull().references(() => tiendas.id),
    productoId: integer('producto_id').notNull().references(() => productos.id),
    cantidad: integer('cantidad').notNull(),
    costoUnitario: integer('costo_unitario').notNull(),
    proveedor: text('proveedor'),
    usuarioId: integer('usuario_id').notNull().references(() => usuarios.id),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('entradas_cantidad_positiva', sql`${t.cantidad} > 0`),
    check('entradas_costo_valido', sql`${t.costoUnitario} >= 0`),
    index('entradas_producto_idx').on(t.productoId, t.creadoEn),
  ],
);
