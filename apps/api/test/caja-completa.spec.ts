import { conToken, Contexto, crearApp, crearCliente, crearProducto, crearTienda, limpiar } from './soporte';

describe('Caja: base, gastos y cierre', () => {
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

  const resumen = async () => (await ctx.http().get('/api/caja/resumen').set(conToken(tienda.dueno)).expect(200)).body;
  const base = (monto: number, token = tienda.dueno) => ctx.http().put('/api/caja/base').set(conToken(token)).send({ monto });
  const gasto = (descripcion: string, monto: number, token = tienda.dueno) =>
    ctx.http().post('/api/caja/gastos').set(conToken(token)).send({ descripcion, monto });
  const cerrar = (contado: number, dia?: string) =>
    ctx.http().post(`/api/caja/cierre${dia ? `?dia=${dia}` : ''}`).set(conToken(tienda.dueno)).send({ contado, nota: 'Cierre de prueba' });

  async function venderEnEfectivo(cantidad = 2) {
    const p = await crearProducto(ctx, tienda.id, { precio: 5000, costo: 3000, stock: 50 });
    return ctx.http().post('/api/ventas').set(conToken(tienda.cajero)).send({ medio: 'EFECTIVO', items: [{ productoId: p.id, cantidad }] }).expect(201);
  }

  it('el cajón suma base, ventas en efectivo y abonos, y resta los gastos', async () => {
    await base(50000).expect(200);
    await venderEnEfectivo(2); // 10.000
    const cliente = await crearCliente(ctx, tienda.id, 30000);
    const p = await crearProducto(ctx, tienda.id, { nombre: 'Leche', precio: 4000, costo: 3000 });
    await ctx.http().post('/api/ventas').set(conToken(tienda.cajero)).send({ medio: 'FIADO', clienteId: cliente.id, items: [{ productoId: p.id, cantidad: 2 }] }).expect(201);
    await ctx.http().post(`/api/clientes/${cliente.id}/abonos`).set(conToken(tienda.cajero)).send({ monto: 3000 }).expect(201);
    // El cajero también anota gastos: él le pagó al proveedor.
    await gasto('Pago al de la gaseosa', 7000, tienda.cajero).expect(201);

    const r = await resumen();
    expect(r).toMatchObject({ base: 50000, gastos: 7000, abonos: 3000, enCaja: 50000 + 10000 + 3000 - 7000 });
    expect(r.listaGastos).toEqual([expect.objectContaining({ descripcion: 'Pago al de la gaseosa', monto: 7000, usuario: 'Cajero' })]);
  });

  it('la base se corrige (no se duplica) y solo la fija la dueña', async () => {
    await base(20000, tienda.cajero).expect(403);
    await base(20000).expect(200);
    const r = await (await base(35000).expect(200)).body;
    expect(r.base).toBe(35000);
  });

  it('valida los gastos con el esquema compartido', async () => {
    const sinDescripcion = await gasto('', 5000).expect(400);
    expect(sinDescripcion.body.errores.descripcion).toBe('El concepto es obligatorio');
    const cero = await gasto('Algo', 0).expect(400);
    expect(cero.body.errores.monto).toBe('El gasto debe ser mayor que cero');
  });

  it('un gasto mal anotado lo quita la dueña, no el cajero ni otra tienda', async () => {
    const r = (await gasto('Equivocado', 9000).expect(201)).body;
    const id = r.listaGastos[0].id as number;
    const otra = await crearTienda(ctx, 'Otra');
    await ctx.http().delete(`/api/caja/gastos/${id}`).set(conToken(otra.dueno)).expect(404);
    await ctx.http().delete(`/api/caja/gastos/${id}`).set(conToken(tienda.cajero)).expect(403);
    const despues = (await ctx.http().delete(`/api/caja/gastos/${id}`).set(conToken(tienda.dueno)).expect(200)).body;
    expect(despues).toMatchObject({ gastos: 0, listaGastos: [] });
  });

  it('el cierre guarda lo esperado, lo contado y la diferencia, y se anota en la bitácora', async () => {
    await base(50000).expect(200);
    await venderEnEfectivo(2);
    const r = (await cerrar(58000).expect(201)).body;
    expect(r.cierre).toMatchObject({ esperado: 60000, contado: 58000, diferencia: -2000, nota: 'Cierre de prueba', por: 'Dueña', cambioDespues: false });

    const bitacora = (await ctx.http().get('/api/bitacora').set(conToken(tienda.dueno)).expect(200)).body;
    expect(bitacora[0].accion).toBe('Cerró la caja');
    expect(bitacora[0].detalle).toContain('faltaron');
  });

  it('después del cierre no se mueve la base, ni los gastos, ni se anulan ventas', async () => {
    const venta = await venderEnEfectivo(1);
    const g = (await gasto('Antes del cierre', 1000).expect(201)).body.listaGastos[0];
    await cerrar(4000).expect(201);

    for (const res of [
      await base(10000),
      await gasto('Tarde', 1000),
      await ctx.http().delete(`/api/caja/gastos/${g.id}`).set(conToken(tienda.dueno)),
      await ctx.http().post(`/api/ventas/${venta.body.id}/anular`).set(conToken(tienda.dueno)).send({ motivo: 'Tarde' }),
      await cerrar(4000),
    ]) {
      expect(res.status).toBe(422);
      expect(res.body.message).toBe('La caja de ese día ya está cerrada');
    }
  });

  it('avisa si el cajón cambió después de cerrar (por ejemplo, otra venta)', async () => {
    await cerrar(0).expect(201);
    await venderEnEfectivo(1);
    const r = await resumen();
    expect(r.cierre).toMatchObject({ esperado: 0, cambioDespues: true });
    expect(r.enCaja).toBe(5000);
  });

  it('se puede cerrar un día anterior olvidado, pero no uno que no ha llegado', async () => {
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    await cerrar(0, ayer).expect(201);
    const futuro = await cerrar(0, manana).expect(422);
    expect(futuro.body.message).toBe('No se puede cerrar un día que todavía no llega');
  });

  it('el cajero no ve la caja ni la cierra', async () => {
    await ctx.http().get('/api/caja/resumen').set(conToken(tienda.cajero)).expect(403);
    await ctx.http().post('/api/caja/cierre').set(conToken(tienda.cajero)).send({ contado: 0 }).expect(403);
  });
});
