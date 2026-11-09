import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, sql } from 'drizzle-orm';
import type { EntradaInventario, EntradaStockDto, Producto, ProductoDto } from '@elcuaderno/shared';
import { NoEncontrado, ReglaDeNegocio } from '../comun/errores';
import { BaseDeDatos, InjectDb } from '../db/db.module';
import { detallesVenta, entradasInventario, productos, usuarios } from '../db/esquema';

type FilaProducto = typeof productos.$inferSelect;

const aRespuesta = (p: FilaProducto): Producto => ({
  id: p.id,
  nombre: p.nombre,
  precio: p.precio,
  costo: p.costo,
  stock: p.stock,
  stockMinimo: p.stockMinimo,
  porPeso: p.porPeso,
  activo: p.activo,
  bajoStock: p.stock <= p.stockMinimo,
});

@Injectable()
export class ProductosService {
  constructor(@InjectDb() private readonly db: BaseDeDatos) {}

  async listar(tiendaId: number, filtro: { q?: string; bajoStock?: boolean; incluirInactivos?: boolean }) {
    const condiciones = [eq(productos.tiendaId, tiendaId)];
    if (!filtro.incluirInactivos) condiciones.push(eq(productos.activo, true));
    if (filtro.q) condiciones.push(ilike(productos.nombre, `%${filtro.q}%`));
    if (filtro.bajoStock) condiciones.push(sql`${productos.stock} <= ${productos.stockMinimo}`);
    const filas = await this.db.select().from(productos).where(and(...condiciones)).orderBy(asc(productos.nombre));
    return filas.map(aRespuesta);
  }

  async crear(tiendaId: number, datos: ProductoDto) {
    const [fila] = await this.db.insert(productos).values({ ...datos, tiendaId }).returning();
    return aRespuesta(fila);
  }

  async actualizar(tiendaId: number, id: number, datos: ProductoDto) {
    // Pasar de unidades a gramos (o al revés) cambiaría el sentido del stock y de las ventas viejas.
    const [actual] = await this.db
      .select({ porPeso: productos.porPeso })
      .from(productos)
      .where(and(eq(productos.id, id), eq(productos.tiendaId, tiendaId)));
    if (!actual) throw new NoEncontrado('El producto');
    if (actual.porPeso !== datos.porPeso) {
      throw new ReglaDeNegocio('No se puede cambiar si un producto se vende por unidad o por peso: crea uno nuevo');
    }
    const [fila] = await this.db
      .update(productos)
      .set(datos)
      .where(and(eq(productos.id, id), eq(productos.tiendaId, tiendaId)))
      .returning();
    if (!fila) throw new NoEncontrado('El producto');
    return aRespuesta(fila);
  }

  /**
   * Llegada de mercancía: suma unidades, guarda el historial y actualiza el costo con el
   * promedio ponderado, para que la ganancia refleje lo que de verdad pagó la tienda.
   * Ej.: 10 unidades a $ 2.000 + 10 a $ 2.400 → el costo queda en $ 2.200.
   * La fila del producto se bloquea: dos llegadas al mismo tiempo no calculan con datos viejos.
   */
  async entrada(tiendaId: number, usuarioId: number, id: number, { cantidad, costoUnitario, proveedor }: EntradaStockDto) {
    const fila = await this.db.transaction(async (tx) => {
      const [actual] = await tx
        .select()
        .from(productos)
        .where(and(eq(productos.id, id), eq(productos.tiendaId, tiendaId)))
        .for('update');
      if (!actual) throw new NoEncontrado('El producto');

      const costoCompra = costoUnitario ?? actual.costo;
      const stockAnterior = Math.max(actual.stock, 0);
      const nuevoCosto = Math.round((stockAnterior * actual.costo + cantidad * costoCompra) / (stockAnterior + cantidad));
      if (nuevoCosto > actual.precio) {
        throw new ReglaDeNegocio(
          `Con esta compra el costo quedaría en ${nuevoCosto} pesos, más que el precio de venta (${actual.precio}). Sube primero el precio.`,
        );
      }

      await tx.insert(entradasInventario).values({
        tiendaId,
        productoId: id,
        cantidad,
        costoUnitario: costoCompra,
        proveedor: proveedor || null,
        usuarioId,
      });
      const [actualizado] = await tx
        .update(productos)
        .set({ stock: sql`${productos.stock} + ${cantidad}`, costo: nuevoCosto })
        .where(eq(productos.id, id))
        .returning();
      return actualizado;
    });
    return aRespuesta(fila);
  }

  /** Las últimas 20 llegadas de un producto, la más reciente primero. */
  async entradas(tiendaId: number, id: number): Promise<EntradaInventario[]> {
    const [existe] = await this.db
      .select({ id: productos.id })
      .from(productos)
      .where(and(eq(productos.id, id), eq(productos.tiendaId, tiendaId)));
    if (!existe) throw new NoEncontrado('El producto');
    const filas = await this.db
      .select({
        id: entradasInventario.id,
        cantidad: entradasInventario.cantidad,
        costoUnitario: entradasInventario.costoUnitario,
        proveedor: entradasInventario.proveedor,
        usuario: usuarios.nombre,
        fecha: entradasInventario.creadoEn,
      })
      .from(entradasInventario)
      .innerJoin(usuarios, eq(usuarios.id, entradasInventario.usuarioId))
      .where(eq(entradasInventario.productoId, id))
      .orderBy(desc(entradasInventario.creadoEn), desc(entradasInventario.id))
      .limit(20);
    return filas.map((f) => ({ ...f, fecha: f.fecha.toISOString() }));
  }

  /** RN-10: si el producto ya tiene ventas se desactiva para no perder el historial; si no, se borra. */
  async eliminar(tiendaId: number, id: number) {
    const donde = and(eq(productos.id, id), eq(productos.tiendaId, tiendaId));
    const [existe] = await this.db.select({ id: productos.id }).from(productos).where(donde);
    if (!existe) throw new NoEncontrado('El producto');
    const [vendido] = await this.db.select({ id: detallesVenta.id }).from(detallesVenta).where(eq(detallesVenta.productoId, id)).limit(1);
    // Con llegadas registradas tampoco se borra: se perdería el historial de compras.
    const [conEntradas] = await this.db.select({ id: entradasInventario.id }).from(entradasInventario).where(eq(entradasInventario.productoId, id)).limit(1);
    if (vendido || conEntradas) {
      await this.db.update(productos).set({ activo: false }).where(donde);
      return { desactivado: true };
    }
    await this.db.delete(productos).where(donde);
    return { desactivado: false };
  }
}
