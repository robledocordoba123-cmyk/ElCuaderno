// Tablas de ElCuaderno. RN-01: todo el dinero es `integer` (pesos enteros).
import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const rolEnum = pgEnum('rol', ['DUENO', 'CAJERO']);
export const medioEnum = pgEnum('medio_de_pago', ['EFECTIVO', 'NEQUI', 'FIADO']);

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
  },
  (t) => [
    check('ventas_fiado_con_cliente', sql`${t.medio} <> 'FIADO' OR ${t.clienteId} IS NOT NULL`),
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
