import { Injectable } from '@nestjs/common';
import { and, asc, eq, ilike, sql } from 'drizzle-orm';
import type { EntradaStockDto, Producto, ProductoDto } from '@elcuaderno/shared';
import { NoEncontrado } from '../comun/errores';
import { BaseDeDatos, InjectDb } from '../db/db.module';
import { detallesVenta, productos } from '../db/esquema';

type FilaProducto = typeof productos.$inferSelect;

const aRespuesta = (p: FilaProducto): Producto => ({
  id: p.id,
  nombre: p.nombre,
  precio: p.precio,
  costo: p.costo,
  stock: p.stock,
  stockMinimo: p.stockMinimo,
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
    const [fila] = await this.db
      .update(productos)
      .set(datos)
      .where(and(eq(productos.id, id), eq(productos.tiendaId, tiendaId)))
      .returning();
    if (!fila) throw new NoEncontrado('El producto');
    return aRespuesta(fila);
  }

  /** Entrada de mercancía: suma unidades de forma atómica (sin leer y luego escribir). */
  async entrada(tiendaId: number, id: number, { cantidad }: EntradaStockDto) {
    const [fila] = await this.db
      .update(productos)
      .set({ stock: sql`${productos.stock} + ${cantidad}` })
      .where(and(eq(productos.id, id), eq(productos.tiendaId, tiendaId)))
      .returning();
    if (!fila) throw new NoEncontrado('El producto');
    return aRespuesta(fila);
  }

  /** RN-10: si el producto ya tiene ventas se desactiva para no perder el historial; si no, se borra. */
  async eliminar(tiendaId: number, id: number) {
    const donde = and(eq(productos.id, id), eq(productos.tiendaId, tiendaId));
    const [existe] = await this.db.select({ id: productos.id }).from(productos).where(donde);
    if (!existe) throw new NoEncontrado('El producto');
    const [vendido] = await this.db.select({ id: detallesVenta.id }).from(detallesVenta).where(eq(detallesVenta.productoId, id)).limit(1);
    if (vendido) {
      await this.db.update(productos).set({ activo: false }).where(donde);
      return { desactivado: true };
    }
    await this.db.delete(productos).where(donde);
    return { desactivado: false };
  }
}
