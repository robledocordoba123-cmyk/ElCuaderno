// Esquemas y tipos compartidos entre la API (NestJS) y el frontend (React).
// Un solo esquema valida el formulario en el navegador y el cuerpo de la petición en el servidor.
import { z } from 'zod';

// RN-01: el dinero son pesos enteros. Nunca decimales.
const pesos = z.number().int('Debe ser un valor en pesos, sin decimales').nonnegative('No puede ser negativo');
const texto = (min: number, max: number, campo: string) =>
  z
    .string()
    .trim()
    .min(min, `${campo} es obligatorio`)
    .max(max, `${campo} es demasiado largo`);

export const ROLES = ['DUENO', 'CAJERO'] as const;
export type Rol = (typeof ROLES)[number];

export const MEDIOS_DE_PAGO = ['EFECTIVO', 'NEQUI', 'FIADO'] as const;
export type MedioDePago = (typeof MEDIOS_DE_PAGO)[number];

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo no válido'),
  password: z.string().min(1, 'Escribe tu contraseña'),
});
export type LoginDto = z.infer<typeof loginSchema>;

/**
 * Venta a granel: un producto "por peso" (queso, arroz suelto, carne) guarda el precio y el
 * costo POR KILO, como en las básculas, y el stock y las cantidades en GRAMOS (enteros).
 * Los productos por unidad siguen igual: precio por unidad y stock en unidades.
 */
export const GRAMOS_POR_LIBRA = 500;
export const PESO_MAXIMO_GRAMOS = 50_000;

export const productoSchema = z
  .object({
    nombre: texto(2, 80, 'El nombre'),
    precio: pesos.positive('El precio debe ser mayor que cero'),
    costo: pesos,
    stock: z.number().int().nonnegative('El stock no puede ser negativo'),
    stockMinimo: z.number().int().nonnegative(),
    porPeso: z.boolean().default(false),
  })
  .refine((p) => p.costo <= p.precio, {
    message: 'El costo no puede ser mayor que el precio de venta',
    path: ['costo'],
  });
export type ProductoDto = z.infer<typeof productoSchema>;

/**
 * Llegada de mercancía: suma unidades al stock y guarda a cuánto se compraron.
 * Si no se dice el costo, se toma el costo actual del producto.
 */
export const entradaStockSchema = z.object({
  /** Unidades, o gramos si el producto es por peso. */
  cantidad: z.number().int().positive('La cantidad debe ser mayor que cero').max(1_000_000),
  /** Costo por unidad, o por kilo si el producto es por peso. */
  costoUnitario: pesos.optional(),
  proveedor: z.string().trim().max(60, 'El nombre del proveedor es demasiado largo').optional(),
});
export type EntradaStockDto = z.infer<typeof entradaStockSchema>;

export interface EntradaInventario {
  id: number;
  cantidad: number;
  costoUnitario: number;
  proveedor: string | null;
  usuario: string;
  fecha: string;
}

export const clienteSchema = z.object({
  nombre: texto(2, 80, 'El nombre'),
  telefono: z
    .string()
    .trim()
    .regex(/^[0-9 +]{7,15}$/, 'Teléfono no válido')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  cupo: pesos,
  // Ley 1581 de 2012: sin la autorización del vecino no se guardan sus datos.
  autorizaDatos: z.boolean().refine((v) => v, 'El vecino debe autorizar que se guarden sus datos'),
});
export type ClienteDto = z.infer<typeof clienteSchema>;

export const ventaSchema = z
  .object({
    medio: z.enum(MEDIOS_DE_PAGO),
    clienteId: z.number().int().positive().optional(),
    items: z
      .array(
        z.object({
          productoId: z.number().int().positive(),
          /** Unidades (máx. 999), o gramos si el producto es por peso (máx. 50 kg). */
          cantidad: z.number().int().positive('La cantidad debe ser mayor que cero').max(PESO_MAXIMO_GRAMOS),
        }),
      )
      .min(1, 'Agrega al menos un producto'),
  })
  .refine((v) => v.medio !== 'FIADO' || v.clienteId !== undefined, {
    message: 'Para fiar hay que escoger el cliente',
    path: ['clienteId'],
  })
  .refine((v) => new Set(v.items.map((i) => i.productoId)).size === v.items.length, {
    message: 'Un producto está repetido en la venta',
    path: ['items'],
  });
export type VentaDto = z.infer<typeof ventaSchema>;

/** Base: el efectivo con que se abre el cajón del día (puede ser cero). */
export const baseCajaSchema = z.object({ monto: pesos });
export type BaseCajaDto = z.infer<typeof baseCajaSchema>;

/** Gasto: plata que sale del cajón (pago al proveedor, domicilio...). */
export const gastoSchema = z.object({
  descripcion: texto(3, 80, 'El concepto'),
  monto: pesos.positive('El gasto debe ser mayor que cero'),
});
export type GastoDto = z.infer<typeof gastoSchema>;

/** Cierre: lo que la dueña cuenta en el cajón al final del día. */
export const cierreSchema = z.object({
  contado: pesos,
  nota: z.string().trim().max(200, 'La nota es demasiado larga').optional(),
});
export type CierreDto = z.infer<typeof cierreSchema>;

/** Anular una venta: la dueña debe dejar escrito por qué. */
export const anulacionSchema = z.object({
  motivo: texto(3, 120, 'El motivo'),
});
export type AnulacionDto = z.infer<typeof anulacionSchema>;

export const abonoSchema = z.object({
  monto: pesos.positive('El abono debe ser mayor que cero'),
});
export type AbonoDto = z.infer<typeof abonoSchema>;

// Respuestas de la API (lo que el frontend recibe).
export interface Producto extends ProductoDto {
  id: number;
  activo: boolean;
  bajoStock: boolean;
}
export interface Cliente {
  id: number;
  nombre: string;
  telefono: string | null;
  cupo: number;
  deuda: number;
  disponible: number;
  autorizaDatos: boolean;
}
export interface Venta {
  id: number;
  medio: MedioDePago;
  total: number;
  cliente: string | null;
  creadaEn: string;
  /** precioUnitario es por unidad, o por kilo si porPeso; subtotal es lo que se cobró por la línea. */
  items: { producto: string; cantidad: number; precioUnitario: number; subtotal: number; porPeso: boolean }[];
  /** Si la dueña la anuló: cuándo, quién y por qué. Las anuladas no cuentan en caja ni en deudas. */
  anulada: { en: string; por: string; motivo: string } | null;
}
export interface ResumenCaja {
  dia: string;
  ventas: number;
  porMedio: Record<MedioDePago, number>;
  abonos: number;
  /** Efectivo con que se abrió el cajón. */
  base: number;
  /** Total de gastos que salieron del cajón. */
  gastos: number;
  /** Lo que debe haber en el cajón: base + ventas en efectivo + abonos − gastos. */
  enCaja: number;
  ganancia: number;
  masVendidos: { producto: string; unidades: number; porPeso: boolean }[];
  listaGastos: GastoCaja[];
  cierre: CierreCaja | null;
}
/** Reporte de un rango de días (máximo 92): totales, cada día y lo más vendido. */
export interface ReportePeriodo {
  desde: string;
  hasta: string;
  totales: {
    ventas: number;
    vendido: number;
    porMedio: Record<MedioDePago, number>;
    ganancia: number;
    abonos: number;
    gastos: number;
  };
  /** Un registro por cada día del rango, también los días sin ventas (en cero). */
  dias: { dia: string; ventas: number; vendido: number; ganancia: number }[];
  /** Ordenados por lo vendido en pesos (no se pueden comparar unidades con gramos). */
  masVendidos: { producto: string; unidades: number; porPeso: boolean; vendido: number }[];
}

export interface GastoCaja {
  id: number;
  descripcion: string;
  monto: number;
  usuario: string;
  en: string;
}
export interface CierreCaja {
  esperado: number;
  contado: number;
  /** contado − esperado: positivo sobra, negativo falta. */
  diferencia: number;
  nota: string | null;
  por: string;
  en: string;
  /** El cajón cambió después de cerrar (por ejemplo, otra venta en efectivo). */
  cambioDespues: boolean;
}
/** La sesión viaja en una cookie httpOnly: el navegador la guarda y JavaScript no puede leerla. */
export interface Sesion {
  usuario: { id: number; nombre: string; rol: Rol; tienda: string };
}
export interface RegistroBitacora {
  id: number;
  usuario: string;
  accion: string;
  detalle: string | null;
  fecha: string;
}

/** Formatea pesos colombianos: 12500 → "$ 12.500". */
export function formatearPesos(valor: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor);
}

/**
 * Lo que se cobra por una línea. Por unidad: precio × cantidad. Por peso: precio del kilo ×
 * gramos ÷ 1000, redondeado a los 50 pesos más cercanos (no hay monedas más pequeñas).
 */
export function subtotalLinea(precio: number, cantidad: number, porPeso: boolean): number {
  if (!porPeso) return precio * cantidad;
  return Math.round((precio * cantidad) / 1000 / 50) * 50;
}

/** Gramos que alcanzan para cierta plata ("deme 2.000 de queso"). */
export function gramosPorPlata(precioKilo: number, plata: number): number {
  return Math.floor((plata * 1000) / precioKilo);
}

/** 3 → "3 und.", 250 → "250 g", 1500 → "1,5 kg". */
export function formatearCantidad(cantidad: number, porPeso: boolean): string {
  if (!porPeso) return `${cantidad} und.`;
  if (cantidad < 1000) return `${cantidad} g`;
  return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(cantidad / 1000)} kg`;
}
