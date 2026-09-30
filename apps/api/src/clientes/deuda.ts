import { and, eq, sql } from 'drizzle-orm';
import { abonos, clientes, ventas } from '../db/esquema';

// RN-07: la deuda no se guarda; se calcula como fiados − abonos. Estas expresiones se usan
// como subconsultas para que la base de datos haga la suma en una sola consulta.
export const totalFiado = sql<number>`coalesce((
  select sum(${ventas.total}) from ${ventas}
  where ${ventas.clienteId} = ${clientes.id} and ${ventas.medio} = 'FIADO'
), 0)::int`;

export const totalAbonado = sql<number>`coalesce((
  select sum(${abonos.monto}) from ${abonos} where ${abonos.clienteId} = ${clientes.id}
), 0)::int`;

export const deudaExpr = sql<number>`(${totalFiado} - ${totalAbonado})`;

/** Condición reutilizable: el cliente pertenece a la tienda del usuario. */
export const deLaTienda = (id: number, tiendaId: number) => and(eq(clientes.id, id), eq(clientes.tiendaId, tiendaId));
