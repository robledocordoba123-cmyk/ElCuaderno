import { eq } from 'drizzle-orm';
import { productos, ventas } from '../src/db/esquema';
import { conToken, Contexto, crearApp, crearCliente, crearProducto, crearTienda, limpiar } from './soporte';

describe('Anular una venta', () => {
  let ctx: Contexto;
  let tienda: Awaited<ReturnType<typeof crearTienda>>;

  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.app.close());
  beforeEach(async () => {
    await limpiar(ctx.db);
    tienda = await crearTienda(ctx);
  });

  const vender = (cuerpo: object) => ctx.http().post('/api/ventas').set(conToken(tienda.cajero)).send(cuerpo).expect(201);
  const anular = (id: number, token = tienda.dueno, motivo = 'El cajero marcó dos veces') =>
    ctx.http().post(`/api/ventas/${id}/anular`).set(conToken(token)).send({ motivo });
  const stock = async (id: number) => (await ctx.db.select().from(productos).where(eq(productos.id, id)))[0].stock;

  it('devuelve las unidades y la saca de la caja, la ganancia y lo más vendido', async () => {
    const arroz = await crearProducto(ctx, tienda.id, { nombre: 'Arroz', precio: 3000, costo: 2000, stock: 10 });
    const panela = await crearProducto(ctx, tienda.id, { nombre: 'Panela', precio: 4000, costo: 3000, stock: 5 });
    const buena = await vender({ medio: 'EFECTIVO', items: [{ productoId: arroz.id, cantidad: 1 }] });
    const mala = await vender({ medio: 'EFECTIVO', items: [{ productoId: panela.id, cantidad: 2 }, { productoId: arroz.id, cantidad: 3 }] });
    expect(await stock(arroz.id)).toBe(6);

    const res = await anular(mala.body.id).expect(200);
    expect(res.body.anulada).toMatchObject({ por: 'Dueña', motivo: 'El cajero marcó dos veces' });
    expect(await stock(arroz.id)).toBe(9);
    expect(await stock(panela.id)).toBe(5);

    const caja = await ctx.http().get('/api/caja/resumen').set(conToken(tienda.dueno)).expect(200);
    expect(caja.body).toMatchObject({ ventas: 1, enCaja: 3000, ganancia: 1000 });
    expect(caja.body.masVendidos).toEqual([{ producto: 'Arroz', unidades: 1 }]);

    // Sigue en la lista del día, marcada como anulada, para que la dueña la vea.
    const lista = await ctx.http().get('/api/ventas').set(conToken(tienda.dueno)).expect(200);
    expect(lista.body.map((v: { id: number; anulada: unknown }) => [v.id, v.anulada !== null])).toEqual([
      [mala.body.id, true],
      [buena.body.id, false],
    ]);

    const bitacora = await ctx.http().get('/api/bitacora').set(conToken(tienda.dueno)).expect(200);
    expect(bitacora.body[0]).toMatchObject({ usuario: 'Dueña', accion: 'Anuló una venta' });
    expect(bitacora.body[0].detalle).toContain('El cajero marcó dos veces');
  });

  it('solo la dueña anula, con motivo, y una sola vez', async () => {
    const p = await crearProducto(ctx, tienda.id);
    const venta = await vender({ medio: 'EFECTIVO', items: [{ productoId: p.id, cantidad: 1 }] });
    await anular(venta.body.id, tienda.cajero).expect(403);
    const sinMotivo = await anular(venta.body.id, tienda.dueno, '  ').expect(400);
    expect(sinMotivo.body.errores.motivo).toBe('El motivo es obligatorio');
    await anular(venta.body.id).expect(200);
    const otraVez = await anular(venta.body.id).expect(422);
    expect(otraVez.body.message).toBe('Esa venta ya estaba anulada');
    expect(await stock(p.id)).toBe(10);
  });

  it('dos anulaciones al mismo tiempo devuelven el inventario una sola vez', async () => {
    const p = await crearProducto(ctx, tienda.id, { stock: 10 });
    const venta = await vender({ medio: 'EFECTIVO', items: [{ productoId: p.id, cantidad: 4 }] });
    const [a, b] = await Promise.all([anular(venta.body.id), anular(venta.body.id)]);
    expect([a.status, b.status].sort()).toEqual([200, 422]);
    expect(await stock(p.id)).toBe(10);
  });

  it('un fiado anulado baja la deuda del vecino', async () => {
    const p = await crearProducto(ctx, tienda.id, { precio: 5000, costo: 3000 });
    const cliente = await crearCliente(ctx, tienda.id, 50000);
    const fiado = await vender({ medio: 'FIADO', clienteId: cliente.id, items: [{ productoId: p.id, cantidad: 2 }] });
    await anular(fiado.body.id).expect(200);
    const detalle = await ctx.http().get(`/api/clientes/${cliente.id}`).set(conToken(tienda.dueno)).expect(200);
    expect(detalle.body).toMatchObject({ deuda: 0, disponible: 50000 });
    expect(detalle.body.movimientos).toHaveLength(0);
  });

  it('no anula un fiado si el vecino ya abonó más de lo que quedaría debiendo', async () => {
    const p = await crearProducto(ctx, tienda.id, { precio: 5000, costo: 3000 });
    const cliente = await crearCliente(ctx, tienda.id, 50000);
    const fiado = await vender({ medio: 'FIADO', clienteId: cliente.id, items: [{ productoId: p.id, cantidad: 2 }] });
    await ctx.http().post(`/api/clientes/${cliente.id}/abonos`).set(conToken(tienda.cajero)).send({ monto: 4000 }).expect(201);
    const res = await anular(fiado.body.id).expect(422);
    expect(res.body.message).toMatch(/saldo a favor de 4000 pesos/);
  });

  it('no anula ventas de días anteriores', async () => {
    const p = await crearProducto(ctx, tienda.id);
    const venta = await vender({ medio: 'EFECTIVO', items: [{ productoId: p.id, cantidad: 1 }] });
    await ctx.db
      .update(ventas)
      .set({ creadaEn: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) })
      .where(eq(ventas.id, venta.body.id));
    const res = await anular(venta.body.id).expect(422);
    expect(res.body.message).toMatch(/Solo se pueden anular ventas de hoy/);
  });

  it('no se puede anular una venta de otra tienda', async () => {
    const otra = await crearTienda(ctx, 'Otra');
    const p = await crearProducto(ctx, otra.id);
    const venta = await ctx.http().post('/api/ventas').set(conToken(otra.cajero)).send({ medio: 'EFECTIVO', items: [{ productoId: p.id, cantidad: 1 }] }).expect(201);
    await anular(venta.body.id).expect(404);
  });
});
