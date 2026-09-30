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

export const productoSchema = z
  .object({
    nombre: texto(2, 80, 'El nombre'),
    precio: pesos.positive('El precio debe ser mayor que cero'),
    costo: pesos,
    stock: z.number().int().nonnegative('El stock no puede ser negativo'),
    stockMinimo: z.number().int().nonnegative(),
  })
  .refine((p) => p.costo <= p.precio, {
    message: 'El costo no puede ser mayor que el precio de venta',
    path: ['costo'],
  });
export type ProductoDto = z.infer<typeof productoSchema>;

/** Entrada de mercancía: suma unidades al stock. */
export const entradaStockSchema = z.object({
  cantidad: z.number().int().positive('La cantidad debe ser mayor que cero').max(100000),
});
export type EntradaStockDto = z.infer<typeof entradaStockSchema>;

export const clienteSchema = z.object({
  nombre: texto(2, 80, 'El nombre'),
  telefono: z
    .string()
    .trim()
    .regex(/^[0-9 +]{7,15}$/, 'Teléfono no válido')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  cupo: pesos,
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
          cantidad: z.number().int().positive('La cantidad debe ser mayor que cero').max(999),
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
}
export interface Venta {
  id: number;
  medio: MedioDePago;
  total: number;
  cliente: string | null;
  creadaEn: string;
  items: { producto: string; cantidad: number; precioUnitario: number }[];
}
export interface ResumenCaja {
  dia: string;
  ventas: number;
  porMedio: Record<MedioDePago, number>;
  abonos: number;
  enCaja: number;
  ganancia: number;
  masVendidos: { producto: string; unidades: number }[];
}
export interface Sesion {
  token: string;
  usuario: { id: number; nombre: string; rol: Rol; tienda: string };
}

/** Formatea pesos colombianos: 12500 → "$ 12.500". */
export function formatearPesos(valor: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor);
}
