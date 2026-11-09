import { eq } from 'drizzle-orm';
import { ventas } from '../src/db/esquema';
import { diaLocal } from '../src/tiempo';
import { conToken, Contexto, crearApp, crearCliente, crearProducto, crearTienda, limpiar } from './soporte';

const DIA_MS = 24 * 60 * 60 * 1000;
const haceDias = (n: number) => diaLocal(new Date(Date.now() - n * DIA_MS));

describe('Reporte por rango de días', () => {
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

  const reporte = (consulta = '', token = tienda.dueno) => ctx.http().get(`/api/caja/reporte${consulta}`).set(conToken(token));

  async function vender(productoId: number, cantidad: number, medio = 'EFECTIVO', clienteId?: number, diasAtras = 0) {
    const res = await ctx
      .http()
      .post('/api/ventas')
      .set(conToken(tienda.cajero))
      .send({ medio, clienteId, items: [{ productoId, cantidad }] })
      .expect(201);
    if (diasAtras) {
      await ctx.db
        .update(ventas)
        .set({ creadaEn: new Date(Date.now() - diasAtras * DIA_MS) })
        .where(eq(ventas.id, res.body.id));
    }
    return res.body.id as number;
  }

  it('suma el rango, separa cada día (también los que no vendieron) y no cuenta las anuladas', async () => {
    const arroz = await crearProducto(ctx, tienda.id, { nombre: 'Arroz', precio: 3000, costo: 2000, stock: 100 });
    const panela = await crearProducto(ctx, tienda.id, { nombre: 'Panela', precio: 4000, costo: 3000, stock: 100 });
    const cliente = await crearCliente(ctx, tienda.id, 100000);
    await vender(arroz.id, 2, 'EFECTIVO', undefined, 3); // hace 3 días: 6.000
    await vender(panela.id, 1, 'NEQUI', undefined, 1); // ayer: 4.000
    await vender(arroz.id, 1, 'FIADO', cliente.id); // hoy: 3.000
    const anulada = await vender(panela.id, 5); // hoy, se anula
    await ctx.http().post(`/api/ventas/${anulada}/anular`).set(conToken(tienda.dueno)).send({ motivo: 'Error' }).expect(200);
    await ctx.http().post('/api/caja/gastos').set(conToken(tienda.dueno)).send({ descripcion: 'Bolsas', monto: 1500 }).expect(201);

    const res = await reporte().expect(200);
    expect(res.body).toMatchObject({ desde: haceDias(6), hasta: haceDias(0) });
    expect(res.body.totales).toEqual({
      ventas: 3,
      vendido: 13000,
      porMedio: { EFECTIVO: 6000, NEQUI: 4000, FIADO: 3000 },
      ganancia: 2 * 1000 + 1000 + 1000,
      abonos: 0,
      gastos: 1500,
    });
    expect(res.body.dias).toHaveLength(7);
    const porDia = Object.fromEntries(res.body.dias.map((d: { dia: string; vendido: number }) => [d.dia, d.vendido]));
    expect(porDia).toMatchObject({ [haceDias(3)]: 6000, [haceDias(2)]: 0, [haceDias(1)]: 4000, [haceDias(0)]: 3000 });
    expect(res.body.masVendidos).toEqual([
      { producto: 'Arroz', unidades: 3, vendido: 9000 },
      { producto: 'Panela', unidades: 1, vendido: 4000 },
    ]);
  });

  it('acepta un rango a la medida', async () => {
    const res = await reporte(`?desde=${haceDias(29)}&hasta=${haceDias(0)}`).expect(200);
    expect(res.body.dias).toHaveLength(30);
    expect(res.body.totales.vendido).toBe(0);
  });

  it('valida el rango: orden, futuro, tamaño y formato', async () => {
    const invertido = await reporte(`?desde=${haceDias(0)}&hasta=${haceDias(3)}`).expect(422);
    expect(invertido.body.message).toBe('La fecha inicial no puede ser después de la final');
    const manana = diaLocal(new Date(Date.now() + DIA_MS));
    await reporte(`?hasta=${manana}`).expect(422);
    const largo = await reporte(`?desde=${haceDias(100)}&hasta=${haceDias(0)}`).expect(422);
    expect(largo.body.message).toBe('El rango máximo es de 92 días');
    await reporte('?desde=ayer').expect(400);
  });

  it('solo la dueña lo ve, y solo con los datos de su tienda', async () => {
    await reporte('', tienda.cajero).expect(403);
    const otra = await crearTienda(ctx, 'Otra');
    const p = await crearProducto(ctx, otra.id);
    await ctx.http().post('/api/ventas').set(conToken(otra.cajero)).send({ medio: 'EFECTIVO', items: [{ productoId: p.id, cantidad: 1 }] }).expect(201);
    const res = await reporte().expect(200);
    expect(res.body.totales.vendido).toBe(0);
  });
});
