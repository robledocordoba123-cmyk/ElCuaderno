import { detallesVenta, usuarios, ventas } from '../src/db/esquema';
import { eq } from 'drizzle-orm';
import { diaLocal } from '../src/tiempo';
import { conToken, Contexto, crearApp, crearCliente, crearProducto, crearTienda, limpiar } from './soporte';

describe('Caja del día', () => {
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

  const vender = (token: string, cuerpo: object) =>
    ctx.http().post('/api/ventas').set(conToken(token)).send(cuerpo).expect(201);

  it('suma por medio de pago, abonos, lo que debe haber en el cajón y la ganancia', async () => {
    const gaseosa = await crearProducto(ctx, tienda.id, { nombre: 'Gaseosa', precio: 2500, costo: 1800, stock: 50 });
    const cafe = await crearProducto(ctx, tienda.id, { nombre: 'Café', precio: 10500, costo: 8700, stock: 50 });
    const jairo = await crearCliente(ctx, tienda.id, 100000);

    await vender(tienda.cajero, { medio: 'EFECTIVO', items: [{ productoId: gaseosa.id, cantidad: 4 }] }); // 10.000
    await vender(tienda.cajero, { medio: 'NEQUI', items: [{ productoId: cafe.id, cantidad: 1 }] }); // 10.500
    await vender(tienda.cajero, { medio: 'FIADO', clienteId: jairo.id, items: [{ productoId: cafe.id, cantidad: 2 }] }); // 21.000
    await ctx.http().post(`/api/clientes/${jairo.id}/abonos`).set(conToken(tienda.cajero)).send({ monto: 5000 }).expect(201);

    const res = await ctx.http().get('/api/caja/resumen').set(conToken(tienda.dueno)).expect(200);
    expect(res.body).toEqual({
      dia: diaLocal(),
      ventas: 3,
      porMedio: { EFECTIVO: 10000, NEQUI: 10500, FIADO: 21000 },
      abonos: 5000,
      enCaja: 15000,
      // (2500-1800)*4 + (10500-8700)*3
      ganancia: 2800 + 5400,
      masVendidos: [
        { producto: 'Gaseosa', unidades: 4 },
        { producto: 'Café', unidades: 3 },
      ],
    });
  });

  it('una venta a las 11:30 p. m. de Colombia cuenta en ese día, no en el siguiente (UTC)', async () => {
    const p = await crearProducto(ctx, tienda.id, { precio: 1000, costo: 500 });
    const [usuario] = await ctx.db.select().from(usuarios).where(eq(usuarios.tiendaId, tienda.id));
    // 2026-03-10 23:30 en Bogotá = 2026-03-11 04:30 UTC.
    const [venta] = await ctx.db
      .insert(ventas)
      .values({ tiendaId: tienda.id, usuarioId: usuario.id, medio: 'EFECTIVO', total: 1000, creadaEn: new Date('2026-03-11T04:30:00Z') })
      .returning();
    await ctx.db.insert(detallesVenta).values({ ventaId: venta.id, productoId: p.id, cantidad: 1, precioUnitario: 1000, costoUnitario: 500 });

    const dia10 = await ctx.http().get('/api/caja/resumen?dia=2026-03-10').set(conToken(tienda.dueno)).expect(200);
    const dia11 = await ctx.http().get('/api/caja/resumen?dia=2026-03-11').set(conToken(tienda.dueno)).expect(200);
    expect(dia10.body.ventas).toBe(1);
    expect(dia11.body.ventas).toBe(0);
  });

  it('solo el dueño ve la caja, y el día debe venir bien escrito', async () => {
    await ctx.http().get('/api/caja/resumen').set(conToken(tienda.cajero)).expect(403);
    await ctx.http().get('/api/caja/resumen?dia=ayer').set(conToken(tienda.dueno)).expect(400);
  });
});
