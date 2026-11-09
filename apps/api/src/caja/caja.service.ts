import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import {
  MEDIOS_DE_PAGO,
  type BaseCajaDto,
  type CierreDto,
  type GastoDto,
  type MedioDePago,
  type ReportePeriodo,
  type ResumenCaja,
} from '@elcuaderno/shared';
import { NoEncontrado, ReglaDeNegocio } from '../comun/errores';
import { BaseDeDatos, InjectDb } from '../db/db.module';
import { abonos, cierresCaja, detallesVenta, movimientosCaja, productos, usuarios, ventas } from '../db/esquema';
import { config } from '../config';
import { diaLocal, limitesDelDia } from '../tiempo';

@Injectable()
export class CajaService {
  constructor(@InjectDb() private readonly db: BaseDeDatos) {}

  /** HU-07: caja de un día en hora de Colombia, con base, gastos y cierre. */
  async resumen(tiendaId: number, dia = diaLocal()): Promise<ResumenCaja> {
    const { desde, hasta } = limitesDelDia(dia);
    // Las ventas anuladas no cuentan: ni en la caja, ni en la ganancia, ni en lo más vendido.
    const delDia = and(eq(ventas.tiendaId, tiendaId), gte(ventas.creadaEn, desde), lt(ventas.creadaEn, hasta), isNull(ventas.anuladaEn));
    const unidades = sql<number>`sum(${detallesVenta.cantidad})::int`;
    const vendido = sql<number>`sum(${detallesVenta.subtotal})::int`;
    const movimientosDelDia = and(eq(movimientosCaja.tiendaId, tiendaId), eq(movimientosCaja.dia, dia));

    const [porMedioFilas, [abonado], [ganancia], masVendidos, movimientos, [cierre]] = await Promise.all([
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
          total: sql<number>`coalesce(sum(${detallesVenta.subtotal} - ${detallesVenta.costoTotal}), 0)::int`,
        })
        .from(detallesVenta)
        .innerJoin(ventas, eq(ventas.id, detallesVenta.ventaId))
        .where(delDia),
      this.db
        .select({ producto: productos.nombre, porPeso: productos.porPeso, unidades })
        .from(detallesVenta)
        .innerJoin(ventas, eq(ventas.id, detallesVenta.ventaId))
        .innerJoin(productos, eq(productos.id, detallesVenta.productoId))
        .where(delDia)
        .groupBy(productos.nombre, productos.porPeso)
        .orderBy(desc(vendido))
        .limit(5),
      this.db
        .select({
          id: movimientosCaja.id,
          tipo: movimientosCaja.tipo,
          monto: movimientosCaja.monto,
          descripcion: movimientosCaja.descripcion,
          usuario: usuarios.nombre,
          en: movimientosCaja.creadoEn,
        })
        .from(movimientosCaja)
        .innerJoin(usuarios, eq(usuarios.id, movimientosCaja.usuarioId))
        .where(movimientosDelDia)
        .orderBy(asc(movimientosCaja.creadoEn), asc(movimientosCaja.id)),
      this.db
        .select({
          esperado: cierresCaja.esperado,
          contado: cierresCaja.contado,
          nota: cierresCaja.nota,
          por: usuarios.nombre,
          en: cierresCaja.creadoEn,
        })
        .from(cierresCaja)
        .innerJoin(usuarios, eq(usuarios.id, cierresCaja.usuarioId))
        .where(and(eq(cierresCaja.tiendaId, tiendaId), eq(cierresCaja.dia, dia))),
    ]);

    const porMedio = Object.fromEntries(MEDIOS_DE_PAGO.map((m) => [m, 0])) as Record<MedioDePago, number>;
    let cantidadVentas = 0;
    for (const fila of porMedioFilas) {
      porMedio[fila.medio] = Number(fila.total);
      cantidadVentas += Number(fila.cantidad);
    }
    const abonosDelDia = Number(abonado.total);
    const base = movimientos.find((m) => m.tipo === 'BASE')?.monto ?? 0;
    const listaGastos = movimientos
      .filter((m) => m.tipo === 'GASTO')
      .map((m) => ({ id: m.id, descripcion: m.descripcion ?? '', monto: m.monto, usuario: m.usuario, en: m.en.toISOString() }));
    const gastos = listaGastos.reduce((suma, g) => suma + g.monto, 0);
    // Lo que debe haber en el cajón. Los abonos se reciben en efectivo; Nequi y fiado no pasan por el cajón.
    const enCaja = base + porMedio.EFECTIVO + abonosDelDia - gastos;

    return {
      dia,
      ventas: cantidadVentas,
      porMedio,
      abonos: abonosDelDia,
      base,
      gastos,
      enCaja,
      ganancia: Number(ganancia.total),
      masVendidos: masVendidos.map((m) => ({ producto: m.producto, unidades: Number(m.unidades), porPeso: m.porPeso })),
      listaGastos,
      cierre: cierre
        ? {
            esperado: cierre.esperado,
            contado: cierre.contado,
            diferencia: cierre.contado - cierre.esperado,
            nota: cierre.nota,
            por: cierre.por,
            en: cierre.en.toISOString(),
            cambioDespues: enCaja !== cierre.esperado,
          }
        : null,
    };
  }

  /**
   * Reporte de un rango de días (hora de Colombia): totales, cada día del rango (también
   * los días sin ventas, en cero, para que la gráfica no salte días) y los 10 más vendidos.
   */
  async reporte(tiendaId: number, desde: string, hasta: string): Promise<ReportePeriodo> {
    const inicio = limitesDelDia(desde).desde;
    const fin = limitesDelDia(hasta).hasta;
    const delRango = and(eq(ventas.tiendaId, tiendaId), gte(ventas.creadaEn, inicio), lt(ventas.creadaEn, fin), isNull(ventas.anuladaEn));
    // La zona va escrita en la consulta y no como parámetro: si fuera parámetro, PostgreSQL
    // vería distintas la expresión del SELECT y la del GROUP BY. Se valida antes de usarla.
    if (!/^[A-Za-z_]+(\/[A-Za-z_]+)*$/.test(config.zonaHoraria)) throw new Error('ZONA_HORARIA no es válida');
    const diaDeVenta = sql<string>`to_char(${ventas.creadaEn} at time zone '${sql.raw(config.zonaHoraria)}', 'YYYY-MM-DD')`;
    const gananciaExpr = sql<number>`coalesce(sum(${detallesVenta.subtotal} - ${detallesVenta.costoTotal}), 0)::int`;
    const unidades = sql<number>`sum(${detallesVenta.cantidad})::int`;
    const vendido = sql<number>`sum(${detallesVenta.subtotal})::int`;

    const [porDiaYMedio, gananciaPorDia, masVendidos, [abonado], [gastado]] = await Promise.all([
      this.db
        .select({
          dia: diaDeVenta,
          medio: ventas.medio,
          total: sql<number>`coalesce(sum(${ventas.total}), 0)::int`,
          cantidad: sql<number>`count(*)::int`,
        })
        .from(ventas)
        .where(delRango)
        .groupBy(diaDeVenta, ventas.medio),
      this.db
        .select({ dia: diaDeVenta, ganancia: gananciaExpr })
        .from(detallesVenta)
        .innerJoin(ventas, eq(ventas.id, detallesVenta.ventaId))
        .where(delRango)
        .groupBy(diaDeVenta),
      this.db
        .select({
          producto: productos.nombre,
          porPeso: productos.porPeso,
          unidades,
          vendido,
        })
        .from(detallesVenta)
        .innerJoin(ventas, eq(ventas.id, detallesVenta.ventaId))
        .innerJoin(productos, eq(productos.id, detallesVenta.productoId))
        .where(delRango)
        .groupBy(productos.nombre, productos.porPeso)
        .orderBy(desc(vendido))
        .limit(10),
      this.db
        .select({ total: sql<number>`coalesce(sum(${abonos.monto}), 0)::int` })
        .from(abonos)
        .where(and(eq(abonos.tiendaId, tiendaId), gte(abonos.creadoEn, inicio), lt(abonos.creadoEn, fin))),
      this.db
        .select({ total: sql<number>`coalesce(sum(${movimientosCaja.monto}), 0)::int` })
        .from(movimientosCaja)
        .where(
          and(
            eq(movimientosCaja.tiendaId, tiendaId),
            eq(movimientosCaja.tipo, 'GASTO'),
            gte(movimientosCaja.dia, desde),
            sql`${movimientosCaja.dia} <= ${hasta}`,
          ),
        ),
    ]);

    // Todos los días del rango, en orden, empezando en cero.
    const dias = new Map<string, { dia: string; ventas: number; vendido: number; ganancia: number }>();
    for (let d = new Date(`${desde}T12:00:00Z`); d <= new Date(`${hasta}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
      const dia = d.toISOString().slice(0, 10);
      dias.set(dia, { dia, ventas: 0, vendido: 0, ganancia: 0 });
    }
    const porMedio = Object.fromEntries(MEDIOS_DE_PAGO.map((m) => [m, 0])) as Record<MedioDePago, number>;
    for (const f of porDiaYMedio) {
      const d = dias.get(f.dia);
      if (d) {
        d.ventas += Number(f.cantidad);
        d.vendido += Number(f.total);
      }
      porMedio[f.medio] += Number(f.total);
    }
    for (const f of gananciaPorDia) {
      const d = dias.get(f.dia);
      if (d) d.ganancia = Number(f.ganancia);
    }
    const lista = [...dias.values()];

    return {
      desde,
      hasta,
      totales: {
        ventas: lista.reduce((s, d) => s + d.ventas, 0),
        vendido: lista.reduce((s, d) => s + d.vendido, 0),
        porMedio,
        ganancia: lista.reduce((s, d) => s + d.ganancia, 0),
        abonos: Number(abonado.total),
        gastos: Number(gastado.total),
      },
      dias: lista,
      masVendidos: masVendidos.map((m) => ({ producto: m.producto, unidades: Number(m.unidades), porPeso: m.porPeso, vendido: Number(m.vendido) })),
    };
  }

  /** La base se fija (o se corrige) mientras el día de hoy no esté cerrado. */
  async fijarBase(tiendaId: number, usuarioId: number, { monto }: BaseCajaDto) {
    const dia = diaLocal();
    await this.exigirAbierto(tiendaId, dia);
    await this.db
      .insert(movimientosCaja)
      .values({ tiendaId, dia, tipo: 'BASE', monto, usuarioId })
      .onConflictDoUpdate({
        target: [movimientosCaja.tiendaId, movimientosCaja.dia],
        targetWhere: sql`${movimientosCaja.tipo} = 'BASE'`,
        set: { monto, usuarioId, creadoEn: new Date() },
      });
    return this.resumen(tiendaId, dia);
  }

  async registrarGasto(tiendaId: number, usuarioId: number, { descripcion, monto }: GastoDto) {
    const dia = diaLocal();
    await this.exigirAbierto(tiendaId, dia);
    await this.db.insert(movimientosCaja).values({ tiendaId, dia, tipo: 'GASTO', monto, descripcion, usuarioId });
    return this.resumen(tiendaId, dia);
  }

  /** Un gasto mal anotado se quita, solo hoy y antes del cierre (queda en la bitácora). */
  async quitarGasto(tiendaId: number, id: number) {
    const dia = diaLocal();
    await this.exigirAbierto(tiendaId, dia);
    const borrados = await this.db
      .delete(movimientosCaja)
      .where(and(eq(movimientosCaja.id, id), eq(movimientosCaja.tiendaId, tiendaId), eq(movimientosCaja.tipo, 'GASTO'), eq(movimientosCaja.dia, dia)))
      .returning({ id: movimientosCaja.id });
    if (borrados.length === 0) throw new NoEncontrado('El gasto de hoy');
    return this.resumen(tiendaId, dia);
  }

  /**
   * Cierre: la dueña cuenta el cajón y se guarda cuánto debía haber en ese momento.
   * Un día se cierra una sola vez (índice único); se puede cerrar hoy o un día anterior olvidado.
   */
  async cerrar(tiendaId: number, usuarioId: number, { contado, nota }: CierreDto, dia = diaLocal()) {
    if (dia > diaLocal()) throw new ReglaDeNegocio('No se puede cerrar un día que todavía no llega');
    await this.exigirAbierto(tiendaId, dia);
    const { enCaja } = await this.resumen(tiendaId, dia);
    const insertados = await this.db
      .insert(cierresCaja)
      .values({ tiendaId, dia, esperado: enCaja, contado, nota: nota || null, usuarioId })
      .onConflictDoNothing()
      .returning({ id: cierresCaja.id });
    if (insertados.length === 0) throw new ReglaDeNegocio('La caja de ese día ya está cerrada');
    return this.resumen(tiendaId, dia);
  }

  /** Después del cierre no se mueve la base, ni los gastos, ni se anulan ventas de ese día. */
  async exigirAbierto(tiendaId: number, dia: string) {
    const [cierre] = await this.db
      .select({ id: cierresCaja.id })
      .from(cierresCaja)
      .where(and(eq(cierresCaja.tiendaId, tiendaId), eq(cierresCaja.dia, dia)));
    if (cierre) throw new ReglaDeNegocio('La caja de ese día ya está cerrada');
  }
}
