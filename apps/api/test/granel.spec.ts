import { eq } from 'drizzle-orm';
import { formatearCantidad, gramosPorPlata, subtotalLinea } from '@elcuaderno/shared';
import { productos } from '../src/db/esquema';
import { conToken, Contexto, crearApp, crearCliente, crearProducto, crearTienda, limpiar } from './soporte';

describe('Venta a granel (por peso)', () => {
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

  // Queso a $ 24.000 el kilo (costo $ 19.000), con 3 kg en la nevera.
  const queso = () => crearProducto(ctx, tienda.id, { nombre: 'Queso', precio: 24000, costo: 19000, stock: 3000, stockMinimo: 1000, porPeso: true });
  const vender = (items: { productoId: number; cantidad: number }[], medio = 'EFECTIVO', clienteId?: number) =>
    ctx.http().post('/api/ventas').set(conToken(tienda.cajero)).send({ medio, clienteId, items });

  it('las cuentas: por kilo, redondeado a 50 pesos, y gramos que alcanzan por cierta plata', () => {
    expect(subtotalLinea(24000, 250, true)).toBe(6000); // media libra
    expect(subtotalLinea(24000, 125, true)).toBe(3000); // cuarto de libra
    expect(subtotalLinea(4800, 333, true)).toBe(1600); // 1.598,4 → 1.600
    expect(subtotalLinea(3200, 3, false)).toBe(9600); // por unidad, igual que antes
    expect(gramosPorPlata(24000, 2000)).toBe(83); // "deme 2.000 de queso"
    expect(formatearCantidad(250, true)).toBe('250 g');
    expect(formatearCantidad(1500, true)).toBe('1,5 kg');
    expect(formatearCantidad(4, false)).toBe('4 und.');
  });

  it('vende por gramos: cobra por el kilo, descuenta gramos y la ganancia sale de lo cobrado', async () => {
    const q = await queso();
    const arroz = await crearProducto(ctx, tienda.id, { nombre: 'Arroz', precio: 3000, costo: 2000, stock: 10 });
    const res = await vender([
      { productoId: q.id, cantidad: 250 },
      { productoId: arroz.id, cantidad: 1 },
    ]).expect(201);
    expect(res.body.total).toBe(6000 + 3000);
    expect(res.body.items).toEqual(
      expect.arrayContaining([
        { producto: 'Queso', cantidad: 250, precioUnitario: 24000, subtotal: 6000, porPeso: true },
        { producto: 'Arroz', cantidad: 1, precioUnitario: 3000, subtotal: 3000, porPeso: false },
      ]),
    );
    const [despues] = await ctx.db.select().from(productos).where(eq(productos.id, q.id));
    expect(despues.stock).toBe(2750);

    const caja = await ctx.http().get('/api/caja/resumen').set(conToken(tienda.dueno)).expect(200);
    // Queso: 6.000 − 19.000 × 0,25 = 1.250. Arroz: 3.000 − 2.000 = 1.000.
    expect(caja.body.ganancia).toBe(1250 + 1000);
    expect(caja.body.porMedio.EFECTIVO).toBe(9000);
    // Lo más vendido se ordena por plata, no por cantidad (250 g no son "250 unidades").
    expect(caja.body.masVendidos[0]).toEqual({ producto: 'Queso', unidades: 250, porPeso: true });
  });

  it('el fiado a granel respeta el cupo con el total redondeado', async () => {
    const q = await queso();
    const vecino = await crearCliente(ctx, tienda.id, 5000);
    const sinCupo = await vender([{ productoId: q.id, cantidad: 250 }], 'FIADO', vecino.id).expect(422);
    expect(sinCupo.body.message).toContain('supera el cupo');
    await vender([{ productoId: q.id, cantidad: 200 }], 'FIADO', vecino.id).expect(201); // 4.800
  });

  it('no deja vender más gramos de los que hay, ni tan poquito que no llegue a 50 pesos', async () => {
    const q = await queso();
    const falta = await vender([{ productoId: q.id, cantidad: 3500 }]).expect(422);
    expect(falta.body.message).toBe('No hay suficiente Queso: quedan 3 kg');
    const poquito = await vender([{ productoId: q.id, cantidad: 1 }]).expect(422);
    expect(poquito.body.message).toContain('muy poquito');
  });

  it('por unidad sigue con máximo 999; por peso deja hasta 50 kg', async () => {
    const arroz = await crearProducto(ctx, tienda.id, { stock: 2000 });
    const mucho = await vender([{ productoId: arroz.id, cantidad: 1000 }]).expect(422);
    expect(mucho.body.message).toBe('No se pueden vender más de 999 unidades de Arroz');
    const bulto = await crearProducto(ctx, tienda.id, { nombre: 'Arroz suelto', precio: 4800, costo: 3900, stock: 60000, porPeso: true });
    await vender([{ productoId: bulto.id, cantidad: 50000 }]).expect(201);
    await vender([{ productoId: bulto.id, cantidad: 50001 }]).expect(400);
  });

  it('anular devuelve los gramos; la llegada suma gramos con costo por kilo', async () => {
    const q = await queso();
    const venta = await vender([{ productoId: q.id, cantidad: 500 }]).expect(201);
    await ctx.http().post(`/api/ventas/${venta.body.id}/anular`).set(conToken(tienda.dueno)).send({ motivo: 'Se arrepintió' }).expect(200);
    // Llegan 2 kg a $ 21.000 el kilo: (3.000 g × 19.000 + 2.000 g × 21.000) ÷ 5.000 g = 19.800.
    const llegada = await ctx
      .http()
      .patch(`/api/productos/${q.id}/entrada`)
      .set(conToken(tienda.dueno))
      .send({ cantidad: 2000, costoUnitario: 21000 })
      .expect(200);
    expect(llegada.body).toMatchObject({ stock: 5000, costo: 19800, porPeso: true });
    const bitacora = await ctx.http().get('/api/bitacora').set(conToken(tienda.dueno)).expect(200);
    expect(bitacora.body[0].detalle).toBe('Queso: +2 kg a $ 21.000 el kilo');
  });

  it('crea productos por peso, pero no deja cambiar uno de unidades a peso', async () => {
    const creado = await ctx
      .http()
      .post('/api/productos')
      .set(conToken(tienda.dueno))
      .send({ nombre: 'Fríjol', precio: 12000, costo: 9800, stock: 5000, stockMinimo: 1000, porPeso: true })
      .expect(201);
    expect(creado.body.porPeso).toBe(true);
    const arroz = await crearProducto(ctx, tienda.id);
    const cambio = await ctx
      .http()
      .put(`/api/productos/${arroz.id}`)
      .set(conToken(tienda.dueno))
      .send({ nombre: 'Arroz', precio: 3000, costo: 2000, stock: 10, stockMinimo: 2, porPeso: true })
      .expect(422);
    expect(cambio.body.message).toContain('crea uno nuevo');
  });
});
