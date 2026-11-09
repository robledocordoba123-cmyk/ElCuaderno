import { formatearPesos } from '@elcuaderno/shared';
import { conToken, Contexto, crearApp, crearProducto, crearTienda, limpiar } from './soporte';

describe('Llegada de mercancía', () => {
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

  const llegada = (id: number, cuerpo: object, token = tienda.dueno) =>
    ctx.http().patch(`/api/productos/${id}/entrada`).set(conToken(token)).send(cuerpo);
  const historial = (id: number, token = tienda.dueno) => ctx.http().get(`/api/productos/${id}/entradas`).set(conToken(token));

  it('actualiza el costo con el promedio ponderado y guarda el historial', async () => {
    const p = await crearProducto(ctx, tienda.id, { nombre: 'Gaseosa', precio: 3000, costo: 2000, stock: 10 });
    const res = await llegada(p.id, { cantidad: 10, costoUnitario: 2400, proveedor: 'Postobón' }).expect(200);
    expect(res.body).toMatchObject({ stock: 20, costo: 2200 });

    const lista = await historial(p.id).expect(200);
    expect(lista.body).toEqual([expect.objectContaining({ cantidad: 10, costoUnitario: 2400, proveedor: 'Postobón', usuario: 'Dueña' })]);

    const bitacora = await ctx.http().get('/api/bitacora').set(conToken(tienda.dueno)).expect(200);
    expect(bitacora.body[0].detalle).toBe(`Gaseosa: +10 und. a ${formatearPesos(2400)} c/u · Postobón`);
  });

  it('sin costo, usa el costo actual y no lo cambia', async () => {
    const p = await crearProducto(ctx, tienda.id, { precio: 3000, costo: 2000, stock: 4 });
    const res = await llegada(p.id, { cantidad: 6 }).expect(200);
    expect(res.body).toMatchObject({ stock: 10, costo: 2000 });
    expect((await historial(p.id)).body[0]).toMatchObject({ costoUnitario: 2000, proveedor: null });
  });

  it('si no había unidades, el costo nuevo es el de la compra', async () => {
    const p = await crearProducto(ctx, tienda.id, { precio: 3000, costo: 1000, stock: 0 });
    const res = await llegada(p.id, { cantidad: 12, costoUnitario: 2500 }).expect(200);
    expect(res.body).toMatchObject({ stock: 12, costo: 2500 });
  });

  it('no deja que el costo quede por encima del precio de venta', async () => {
    const p = await crearProducto(ctx, tienda.id, { precio: 3000, costo: 2800, stock: 1 });
    const res = await llegada(p.id, { cantidad: 9, costoUnitario: 3500 }).expect(422);
    expect(res.body.message).toMatch(/Sube primero el precio/);
    const lista = await historial(p.id).expect(200);
    expect(lista.body).toHaveLength(0);
    const productos = await ctx.http().get('/api/productos').set(conToken(tienda.dueno)).expect(200);
    expect(productos.body[0]).toMatchObject({ stock: 1, costo: 2800 });
  });

  it('solo la dueña registra llegadas y ve el historial, y solo de su tienda', async () => {
    const p = await crearProducto(ctx, tienda.id);
    await llegada(p.id, { cantidad: 1 }, tienda.cajero).expect(403);
    await historial(p.id, tienda.cajero).expect(403);
    const otra = await crearTienda(ctx, 'Otra');
    await llegada(p.id, { cantidad: 1 }, otra.dueno).expect(404);
    await historial(p.id, otra.dueno).expect(404);
  });

  it('valida la cantidad y el costo con el esquema compartido', async () => {
    const p = await crearProducto(ctx, tienda.id);
    const res = await llegada(p.id, { cantidad: 0, costoUnitario: 10.5 }).expect(400);
    expect(res.body.errores).toMatchObject({
      cantidad: 'La cantidad debe ser mayor que cero',
      costoUnitario: 'Debe ser un valor en pesos, sin decimales',
    });
  });

  it('dos llegadas al mismo tiempo suman las dos y el promedio sale con datos al día', async () => {
    const p = await crearProducto(ctx, tienda.id, { precio: 5000, costo: 2000, stock: 10 });
    await Promise.all([llegada(p.id, { cantidad: 10, costoUnitario: 3000 }).expect(200), llegada(p.id, { cantidad: 10, costoUnitario: 3000 }).expect(200)]);
    const productos = await ctx.http().get('/api/productos').set(conToken(tienda.dueno)).expect(200);
    // (10 × 2000 + 10 × 3000) / 20 = 2500; luego (20 × 2500 + 10 × 3000) / 30 = 2667.
    expect(productos.body[0]).toMatchObject({ stock: 30, costo: 2667 });
  });

  it('un producto con llegadas registradas se desactiva en lugar de borrarse', async () => {
    const p = await crearProducto(ctx, tienda.id);
    await llegada(p.id, { cantidad: 3 }).expect(200);
    const res = await ctx.http().delete(`/api/productos/${p.id}`).set(conToken(tienda.dueno)).expect(200);
    expect(res.body.desactivado).toBe(true);
  });
});
