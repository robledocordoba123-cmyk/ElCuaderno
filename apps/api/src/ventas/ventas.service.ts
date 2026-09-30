import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import type { Venta, VentaDto } from '@elcuaderno/shared';
import { NoEncontrado, ReglaDeNegocio } from '../comun/errores';
import { BaseDeDatos, InjectDb } from '../db/db.module';
import { clientes, detallesVenta, productos, ventas } from '../db/esquema';
import { deLaTienda, deudaExpr } from '../clientes/deuda';
import { diaLocal, limitesDelDia } from '../tiempo';

@Injectable()
export class VentasService {
  constructor(@InjectDb() private readonly db: BaseDeDatos) {}

  /**
   * Registra una venta completa en una sola transacción (RN-03):
   * si un producto no alcanza o el fiado supera el cupo, no se guarda nada.
   */
  async registrar(tiendaId: number, usuarioId: number, datos: VentaDto): Promise<Venta> {
    const ventaId = await this.db.transaction(async (tx) => {
      // Se procesan en orden de id para que dos ventas simultáneas bloqueen las filas en el
      // mismo orden y no se crucen (evita interbloqueos).
      const items = [...datos.items].sort((a, b) => a.productoId - b.productoId);
      const ids = items.map((i) => i.productoId);

      const encontrados = await tx
        .select()
        .from(productos)
        .where(and(eq(productos.tiendaId, tiendaId), inArray(productos.id, ids), eq(productos.activo, true)));
      if (encontrados.length !== ids.length) throw new NoEncontrado('Uno de los productos');
      const porId = new Map(encontrados.map((p) => [p.id, p]));

      // RN-04: el total sale de los precios guardados, nunca de lo que mande el navegador.
      const total = items.reduce((suma, i) => suma + porId.get(i.productoId)!.precio * i.cantidad, 0);

      let clienteId: number | null = null;
      if (datos.medio === 'FIADO') {
        const [cliente] = await tx
          .select({ id: clientes.id, cupo: clientes.cupo })
          .from(clientes)
          .where(deLaTienda(datos.clienteId!, tiendaId))
          .for('update'); // Bloquea al cliente: dos fiados al mismo tiempo no pueden pasarse del cupo.
        if (!cliente) throw new NoEncontrado('El cliente');
        const [{ deuda }] = await tx.select({ deuda: deudaExpr }).from(clientes).where(eq(clientes.id, cliente.id));
        const disponible = cliente.cupo - Number(deuda);
        if (total > disponible) {
          throw new ReglaDeNegocio(
            `El fiado supera el cupo del cliente: le quedan ${Math.max(disponible, 0)} pesos disponibles`,
          );
        }
        clienteId = cliente.id;
      }

      // RN-02: descuento condicional. Si otro cajero ya se llevó las últimas unidades,
      // el UPDATE no encuentra fila y la venta completa se cancela.
      for (const item of items) {
        const actualizado = await tx
          .update(productos)
          .set({ stock: sql`${productos.stock} - ${item.cantidad}` })
          .where(and(eq(productos.id, item.productoId), gte(productos.stock, item.cantidad)))
          .returning({ id: productos.id });
        if (actualizado.length === 0) {
          const [{ stock }] = await tx
            .select({ stock: productos.stock })
            .from(productos)
            .where(eq(productos.id, item.productoId));
          const nombre = porId.get(item.productoId)!.nombre;
          throw new ReglaDeNegocio(`No hay suficiente ${nombre}: quedan ${stock}`);
        }
      }

      const [venta] = await tx
        .insert(ventas)
        .values({ tiendaId, usuarioId, clienteId, medio: datos.medio, total })
        .returning({ id: ventas.id });
      await tx.insert(detallesVenta).values(
        items.map((i) => {
          const p = porId.get(i.productoId)!;
          return {
            ventaId: venta.id,
            productoId: p.id,
            cantidad: i.cantidad,
            precioUnitario: p.precio,
            costoUnitario: p.costo,
          };
        }),
      );
      return venta.id;
    });

    const [venta] = await this.listar(tiendaId, { id: ventaId });
    return venta;
  }

  /** Ventas de un día (hora de Colombia), las más recientes primero. */
  async listar(tiendaId: number, filtro: { dia?: string; id?: number } = {}): Promise<Venta[]> {
    const condiciones = [eq(ventas.tiendaId, tiendaId)];
    if (filtro.id) {
      condiciones.push(eq(ventas.id, filtro.id));
    } else {
      const { desde, hasta } = limitesDelDia(filtro.dia ?? diaLocal());
      condiciones.push(gte(ventas.creadaEn, desde), lt(ventas.creadaEn, hasta));
    }

    const cabeceras = await this.db
      .select({
        id: ventas.id,
        medio: ventas.medio,
        total: ventas.total,
        cliente: clientes.nombre,
        creadaEn: ventas.creadaEn,
      })
      .from(ventas)
      .leftJoin(clientes, eq(clientes.id, ventas.clienteId))
      .where(and(...condiciones))
      .orderBy(desc(ventas.creadaEn), desc(ventas.id));
    if (cabeceras.length === 0) return [];

    const detalles = await this.db
      .select({
        ventaId: detallesVenta.ventaId,
        producto: productos.nombre,
        cantidad: detallesVenta.cantidad,
        precioUnitario: detallesVenta.precioUnitario,
      })
      .from(detallesVenta)
      .innerJoin(productos, eq(productos.id, detallesVenta.productoId))
      .where(
        inArray(
          detallesVenta.ventaId,
          cabeceras.map((c) => c.id),
        ),
      )
      .orderBy(asc(detallesVenta.id));

    return cabeceras.map((c) => ({
      ...c,
      creadaEn: c.creadaEn.toISOString(),
      items: detalles
        .filter((d) => d.ventaId === c.id)
        .map((d) => ({ producto: d.producto, cantidad: d.cantidad, precioUnitario: d.precioUnitario })),
    }));
  }
}
