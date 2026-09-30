import { conToken, Contexto, crearApp, crearCliente, crearProducto, crearTienda, limpiar } from './soporte';

describe('Clientes y abonos', () => {
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

  /** Deja al cliente debiendo `total` pesos con una venta fiada. */
  async function fiar(clienteId: number, total: number) {
    const p = await crearProducto(ctx, tienda.id, { nombre: `Producto ${total}`, precio: total, costo: 0, stock: 5 });
    await ctx
      .http()
      .post('/api/ventas')
      .set(conToken(tienda.cajero))
      .send({ medio: 'FIADO', clienteId, items: [{ productoId: p.id, cantidad: 1 }] })
      .expect(201);
  }

  it('el abono baja la deuda (la deuda se calcula, no se guarda)', async () => {
    const marta = await crearCliente(ctx, tienda.id, 100000, 'Doña Marta');
    await fiar(marta.id, 30000);

    const res = await ctx
      .http()
      .post(`/api/clientes/${marta.id}/abonos`)
      .set(conToken(tienda.cajero))
      .send({ monto: 10000 })
      .expect(201);

    expect(res.body).toMatchObject({ deuda: 20000, disponible: 80000 });
    expect(res.body.movimientos.map((m: { tipo: string }) => m.tipo)).toEqual(['ABONO', 'FIADO']);
  });

  it('no acepta un abono mayor que la deuda', async () => {
    const marta = await crearCliente(ctx, tienda.id);
    await fiar(marta.id, 5000);
    const res = await ctx
      .http()
      .post(`/api/clientes/${marta.id}/abonos`)
      .set(conToken(tienda.cajero))
      .send({ monto: 6000 })
      .expect(422);
    expect(res.body.message).toBe('El abono supera la deuda: debe 5000 pesos');
  });

  it('dos abonos al mismo tiempo no pueden dejar la deuda en negativo', async () => {
    const pedro = await crearCliente(ctx, tienda.id, 100000, 'Pedro');
    await fiar(pedro.id, 10000);

    const intentos = await Promise.all(
      [8000, 8000, 8000].map((monto) =>
        ctx.http().post(`/api/clientes/${pedro.id}/abonos`).set(conToken(tienda.cajero)).send({ monto }),
      ),
    );

    expect(intentos.filter((r) => r.status === 201)).toHaveLength(1);
    const cliente = await ctx.http().get(`/api/clientes/${pedro.id}`).set(conToken(tienda.dueno)).expect(200);
    expect(cliente.body.deuda).toBe(2000);
  });

  it('lista solo a los deudores, del que más debe al que menos', async () => {
    const a = await crearCliente(ctx, tienda.id, 100000, 'Carmenza');
    const b = await crearCliente(ctx, tienda.id, 100000, 'Don Jairo');
    await crearCliente(ctx, tienda.id, 100000, 'Al día');
    await fiar(a.id, 5000);
    await fiar(b.id, 9000);

    const res = await ctx.http().get('/api/clientes?deudores=true').set(conToken(tienda.dueno)).expect(200);
    expect(res.body.map((c: { nombre: string; deuda: number }) => [c.nombre, c.deuda])).toEqual([
      ['Don Jairo', 9000],
      ['Carmenza', 5000],
    ]);
  });

  it('solo el dueño crea clientes y define el cupo', async () => {
    const datos = { nombre: 'Nueva vecina', telefono: '3001234567', cupo: 40000 };
    await ctx.http().post('/api/clientes').set(conToken(tienda.cajero)).send(datos).expect(403);
    const res = await ctx.http().post('/api/clientes').set(conToken(tienda.dueno)).send(datos).expect(201);
    expect(res.body).toMatchObject({ nombre: 'Nueva vecina', cupo: 40000, deuda: 0, disponible: 40000 });
  });

  it('un cliente de otra tienda no existe para mí', async () => {
    const otra = await crearTienda(ctx, 'Otra');
    const ajeno = await crearCliente(ctx, otra.id);
    await ctx.http().get(`/api/clientes/${ajeno.id}`).set(conToken(tienda.dueno)).expect(404);
    await ctx.http().post(`/api/clientes/${ajeno.id}/abonos`).set(conToken(tienda.dueno)).send({ monto: 1000 }).expect(404);
  });
});
