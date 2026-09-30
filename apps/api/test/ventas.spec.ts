import { eq } from 'drizzle-orm';
import { productos } from '../src/db/esquema';
import { conToken, Contexto, crearApp, crearCliente, crearProducto, crearTienda, limpiar } from './soporte';

describe('Ventas', () => {
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

  const stockDe = async (id: number) =>
    (await ctx.db.select({ stock: productos.stock }).from(productos).where(eq(productos.id, id)))[0].stock;

  it('descuenta el stock y calcula el total con los precios guardados', async () => {
    const arroz = await crearProducto(ctx, tienda.id, { precio: 3200, stock: 10 });
    const res = await ctx
      .http()
      .post('/api/ventas')
      .set(conToken(tienda.cajero))
      // Aunque el navegador mande un precio, la API lo ignora: el total sale de la base de datos.
      .send({ medio: 'EFECTIVO', items: [{ productoId: arroz.id, cantidad: 3, precio: 1 }] })
      .expect(201);

    expect(res.body.total).toBe(9600);
    expect(res.body.items).toEqual([{ producto: 'Arroz', cantidad: 3, precioUnitario: 3200 }]);
    expect(await stockDe(arroz.id)).toBe(7);
  });

  it('si un producto no alcanza, no se guarda nada (transacción)', async () => {
    const arroz = await crearProducto(ctx, tienda.id, { nombre: 'Arroz', stock: 10 });
    const panela = await crearProducto(ctx, tienda.id, { nombre: 'Panela', stock: 1 });

    const res = await ctx
      .http()
      .post('/api/ventas')
      .set(conToken(tienda.cajero))
      .send({ medio: 'EFECTIVO', items: [{ productoId: arroz.id, cantidad: 2 }, { productoId: panela.id, cantidad: 5 }] })
      .expect(422);

    expect(res.body.message).toBe('No hay suficiente Panela: quedan 1');
    expect(await stockDe(arroz.id)).toBe(10); // El arroz no quedó descontado a medias.
    const ventas = await ctx.http().get('/api/ventas').set(conToken(tienda.dueno)).expect(200);
    expect(ventas.body).toHaveLength(0);
  });

  it('dos cajeros vendiendo la última unidad al mismo tiempo: solo una venta gana', async () => {
    const ultima = await crearProducto(ctx, tienda.id, { nombre: 'Chocoramo', stock: 1 });

    const intentos = await Promise.all(
      Array.from({ length: 5 }, () =>
        ctx
          .http()
          .post('/api/ventas')
          .set(conToken(tienda.cajero))
          .send({ medio: 'EFECTIVO', items: [{ productoId: ultima.id, cantidad: 1 }] }),
      ),
    );

    expect(intentos.filter((r) => r.status === 201)).toHaveLength(1);
    expect(intentos.filter((r) => r.status === 422)).toHaveLength(4);
    expect(await stockDe(ultima.id)).toBe(0);
  });

  it('guarda el precio del momento: si luego cambia el precio, la venta no cambia', async () => {
    const leche = await crearProducto(ctx, tienda.id, { nombre: 'Leche', precio: 4600, costo: 3900 });
    await ctx.http().post('/api/ventas').set(conToken(tienda.cajero)).send({ medio: 'NEQUI', items: [{ productoId: leche.id, cantidad: 1 }] }).expect(201);

    await ctx
      .http()
      .put(`/api/productos/${leche.id}`)
      .set(conToken(tienda.dueno))
      .send({ nombre: 'Leche', precio: 5000, costo: 4200, stock: 9, stockMinimo: 2 })
      .expect(200);

    const ventas = await ctx.http().get('/api/ventas').set(conToken(tienda.dueno)).expect(200);
    expect(ventas.body[0].total).toBe(4600);
    expect(ventas.body[0].items[0].precioUnitario).toBe(4600);
  });

  describe('fiado', () => {
    it('suma a la deuda del cliente cuando está dentro del cupo', async () => {
      const arroz = await crearProducto(ctx, tienda.id, { precio: 3000 });
      const jairo = await crearCliente(ctx, tienda.id, 50000);

      await ctx
        .http()
        .post('/api/ventas')
        .set(conToken(tienda.cajero))
        .send({ medio: 'FIADO', clienteId: jairo.id, items: [{ productoId: arroz.id, cantidad: 4 }] })
        .expect(201);

      const cliente = await ctx.http().get(`/api/clientes/${jairo.id}`).set(conToken(tienda.cajero)).expect(200);
      expect(cliente.body).toMatchObject({ deuda: 12000, disponible: 38000 });
      expect(cliente.body.movimientos[0]).toMatchObject({ tipo: 'FIADO', monto: 12000 });
    });

    it('no deja fiar por encima del cupo y no descuenta el stock', async () => {
      const aceite = await crearProducto(ctx, tienda.id, { nombre: 'Aceite', precio: 12000, costo: 9000, stock: 10 });
      const luis = await crearCliente(ctx, tienda.id, 20000, 'Luisito');

      const res = await ctx
        .http()
        .post('/api/ventas')
        .set(conToken(tienda.cajero))
        .send({ medio: 'FIADO', clienteId: luis.id, items: [{ productoId: aceite.id, cantidad: 2 }] })
        .expect(422);

      expect(res.body.message).toBe('El fiado supera el cupo del cliente: le quedan 20000 pesos disponibles');
      expect(await stockDe(aceite.id)).toBe(10);
    });

    it('exige escoger el cliente', async () => {
      const arroz = await crearProducto(ctx, tienda.id);
      const res = await ctx
        .http()
        .post('/api/ventas')
        .set(conToken(tienda.cajero))
        .send({ medio: 'FIADO', items: [{ productoId: arroz.id, cantidad: 1 }] })
        .expect(400);
      expect(res.body.errores.clienteId).toBe('Para fiar hay que escoger el cliente');
    });
  });

  it('valida la venta con el esquema compartido', async () => {
    const res = await ctx
      .http()
      .post('/api/ventas')
      .set(conToken(tienda.cajero))
      .send({ medio: 'TARJETA', items: [] })
      .expect(400);
    expect(Object.keys(res.body.errores)).toEqual(expect.arrayContaining(['medio', 'items']));
  });

  it('no deja vender productos de otra tienda', async () => {
    const otra = await crearTienda(ctx, 'Otra tienda');
    const ajeno = await crearProducto(ctx, otra.id);
    await ctx
      .http()
      .post('/api/ventas')
      .set(conToken(tienda.cajero))
      .send({ medio: 'EFECTIVO', items: [{ productoId: ajeno.id, cantidad: 1 }] })
      .expect(404);
    expect(await stockDe(ajeno.id)).toBe(10);
  });
});
