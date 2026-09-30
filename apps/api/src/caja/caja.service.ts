import { Injectable } from '@nestjs/common';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { MEDIOS_DE_PAGO, type MedioDePago, type ResumenCaja } from '@elcuaderno/shared';
import { BaseDeDatos, InjectDb } from '../db/db.module';
import { abonos, detallesVenta, productos, ventas } from '../db/esquema';
import { diaLocal, limitesDelDia } from '../tiempo';

@Injectable()
export class CajaService {
  constructor(@InjectDb() private readonly db: BaseDeDatos) {}

  /** HU-07: cierre de caja de un día en hora de Colombia. */
  async resumen(tiendaId: number, dia = diaLocal()): Promise<ResumenCaja> {
    const { desde, hasta } = limitesDelDia(dia);
    const delDia = and(eq(ventas.tiendaId, tiendaId), gte(ventas.creadaEn, desde), lt(ventas.creadaEn, hasta));
    const unidades = sql<number>`sum(${detallesVenta.cantidad})::int`;

    const [porMedioFilas, [abonado], [ganancia], masVendidos] = await Promise.all([
      this.db
        .select({
          medio: ventas.medio,
          total: sql<number>`coalesce(sum(${ventas.total}), 0)::int`,
          cantidad: sql<number>`count(*)::int`,
        })
        .from(ventas)
        .where(delDia)
        .groupBy(ventas.medio),
      this.db
        .select({ total: sql<number>`coalesce(sum(${abonos.monto}), 0)::int` })
        .from(abonos)
        .where(and(eq(abonos.tiendaId, tiendaId), gte(abonos.creadoEn, desde), lt(abonos.creadoEn, hasta))),
      this.db
        .select({
          total: sql<number>`coalesce(sum((${detallesVenta.precioUnitario} - ${detallesVenta.costoUnitario}) * ${detallesVenta.cantidad}), 0)::int`,
        })
        .from(detallesVenta)
        .innerJoin(ventas, eq(ventas.id, detallesVenta.ventaId))
        .where(delDia),
      this.db
        .select({ producto: productos.nombre, unidades })
        .from(detallesVenta)
        .innerJoin(ventas, eq(ventas.id, detallesVenta.ventaId))
        .innerJoin(productos, eq(productos.id, detallesVenta.productoId))
        .where(delDia)
        .groupBy(productos.nombre)
        .orderBy(desc(unidades))
        .limit(5),
    ]);

    const porMedio = Object.fromEntries(MEDIOS_DE_PAGO.map((m) => [m, 0])) as Record<MedioDePago, number>;
    let cantidadVentas = 0;
    for (const fila of porMedioFilas) {
      porMedio[fila.medio] = Number(fila.total);
      cantidadVentas += Number(fila.cantidad);
    }
    const abonosDelDia = Number(abonado.total);

    return {
      dia,
      ventas: cantidadVentas,
      porMedio,
      abonos: abonosDelDia,
      // Lo que debe haber en el cajón: ventas en efectivo más abonos (se reciben en efectivo).
      enCaja: porMedio.EFECTIVO + abonosDelDia,
      ganancia: Number(ganancia.total),
      masVendidos: masVendidos.map((m) => ({ producto: m.producto, unidades: Number(m.unidades) })),
    };
  }
}
