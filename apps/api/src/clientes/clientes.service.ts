import { Injectable } from '@nestjs/common';
import { asc, desc, eq, sql } from 'drizzle-orm';
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
  deuda: deudaExpr,
};

const aRespuesta = (c: { id: number; nombre: string; telefono: string | null; cupo: number; deuda: number }): Cliente => ({
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
      .where(soloDeudores ? sql`${clientes.tiendaId} = ${tiendaId} and ${deudaExpr} > 0` : eq(clientes.tiendaId, tiendaId))
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
    const [fila] = await this.db.insert(clientes).values({ ...datos, tiendaId }).returning({ id: clientes.id });
    return this.obtener(tiendaId, fila.id);
  }

  async actualizar(tiendaId: number, id: number, datos: ClienteDto) {
    const [fila] = await this.db
      .update(clientes)
      .set({ nombre: datos.nombre, telefono: datos.telefono ?? null, cupo: datos.cupo })
      .where(deLaTienda(id, tiendaId))
      .returning({ id: clientes.id });
    if (!fila) throw new NoEncontrado('El cliente');
    return this.obtener(tiendaId, id);
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
