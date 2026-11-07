import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import type { AbonoDto, Cliente, ClienteDto } from '@elcuaderno/shared';
import { NoEncontrado, ReglaDeNegocio } from '../comun/errores';
import { BaseDeDatos, InjectDb } from '../db/db.module';
import { abonos, clientes, ventas } from '../db/esquema';
import { deLaTienda, deudaExpr } from './deuda';

const columnas = {
  id: clientes.id,
  nombre: clientes.nombre,
  telefono: clientes.telefono,
  cupo: clientes.cupo,
  autorizaDatos: clientes.autorizaDatos,
  deuda: deudaExpr,
};

type Fila = { id: number; nombre: string; telefono: string | null; cupo: number; autorizaDatos: boolean; deuda: number };
const aRespuesta = (c: Fila): Cliente => ({
  ...c,
  deuda: Number(c.deuda),
  disponible: Math.max(c.cupo - Number(c.deuda), 0),
});

@Injectable()
export class ClientesService {
  constructor(@InjectDb() private readonly db: BaseDeDatos) {}

  async listar(tiendaId: number, soloDeudores = false) {
    const filas = await this.db
      .select(columnas)
      .from(clientes)
      .where(
        and(
          eq(clientes.tiendaId, tiendaId),
          isNull(clientes.suprimidoEn),
          soloDeudores ? sql`${deudaExpr} > 0` : undefined,
        ),
      )
      .orderBy(soloDeudores ? desc(deudaExpr) : asc(clientes.nombre));
    return filas.map(aRespuesta);
  }

  async obtener(tiendaId: number, id: number) {
    const [fila] = await this.db.select(columnas).from(clientes).where(deLaTienda(id, tiendaId));
    if (!fila) throw new NoEncontrado('El cliente');
    const [fiados, pagos] = await Promise.all([
      this.db
        .select({ id: ventas.id, monto: ventas.total, fecha: ventas.creadaEn })
        .from(ventas)
        .where(sql`${ventas.clienteId} = ${id} and ${ventas.medio} = 'FIADO'`),
      this.db.select({ id: abonos.id, monto: abonos.monto, fecha: abonos.creadoEn }).from(abonos).where(eq(abonos.clienteId, id)),
    ]);
    const movimientos = [
      ...fiados.map((f) => ({ tipo: 'FIADO' as const, ...f })),
      ...pagos.map((p) => ({ tipo: 'ABONO' as const, ...p })),
    ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
    return { ...aRespuesta(fila), movimientos };
  }

  async crear(tiendaId: number, datos: ClienteDto) {
    const { autorizaDatos, ...resto } = datos;
    const [fila] = await this.db
      .insert(clientes)
      .values({ ...resto, tiendaId, autorizaDatos, autorizadoEn: new Date() })
      .returning({ id: clientes.id });
    return this.obtener(tiendaId, fila.id);
  }

  async actualizar(tiendaId: number, id: number, datos: ClienteDto) {
    const [fila] = await this.db
      .update(clientes)
      .set({
        nombre: datos.nombre,
        telefono: datos.telefono ?? null,
        cupo: datos.cupo,
        autorizaDatos: true,
        // Si ya había autorizado se conserva la fecha original.
        autorizadoEn: sql`coalesce(${clientes.autorizadoEn}, now())`,
      })
      .where(and(deLaTienda(id, tiendaId), isNull(clientes.suprimidoEn)))
      .returning({ id: clientes.id });
    if (!fila) throw new NoEncontrado('El cliente');
    return this.obtener(tiendaId, id);
  }

  /**
   * Ley 1581: el vecino pide que borren sus datos. Solo se puede si no debe nada (la deuda
   * es un registro que la tienda necesita). Se borran nombre y teléfono y se conserva el
   * historial de ventas sin datos personales, porque cuadra la caja de días anteriores.
   */
  async suprimir(tiendaId: number, id: number) {
    return this.db.transaction(async (tx) => {
      const [cliente] = await tx
        .select({ id: clientes.id })
        .from(clientes)
        .where(and(deLaTienda(id, tiendaId), isNull(clientes.suprimidoEn)))
        .for('update');
      if (!cliente) throw new NoEncontrado('El cliente');
      const [{ deuda }] = await tx.select({ deuda: deudaExpr }).from(clientes).where(eq(clientes.id, id));
      if (Number(deuda) > 0) throw new ReglaDeNegocio('No se pueden borrar sus datos mientras tenga deuda');
      await tx
        .update(clientes)
        .set({ nombre: `Cliente retirado #${id}`, telefono: null, cupo: 0, autorizaDatos: false, suprimidoEn: new Date() })
        .where(eq(clientes.id, id));
      return { suprimido: true };
    });
  }

  /**
   * RN-06: el abono no puede ser mayor que la deuda. La fila del cliente se bloquea
   * (SELECT ... FOR UPDATE) para que dos abonos al mismo tiempo no pasen ambos la validación.
   */
  async abonar(tiendaId: number, usuarioId: number, clienteId: number, { monto }: AbonoDto) {
    await this.db.transaction(async (tx) => {
      const [cliente] = await tx.select({ id: clientes.id }).from(clientes).where(deLaTienda(clienteId, tiendaId)).for('update');
      if (!cliente) throw new NoEncontrado('El cliente');
      const [{ deuda }] = await tx.select({ deuda: deudaExpr }).from(clientes).where(eq(clientes.id, clienteId));
      if (monto > Number(deuda)) {
        throw new ReglaDeNegocio(`El abono supera la deuda: debe ${Number(deuda)} pesos`);
      }
      await tx.insert(abonos).values({ tiendaId, clienteId, usuarioId, monto });
    });
    return this.obtener(tiendaId, clienteId);
  }
}
