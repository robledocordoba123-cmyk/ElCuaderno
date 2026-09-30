import { conToken, Contexto, crearApp, crearProducto, crearTienda, limpiar } from './soporte';

describe('Autenticación', () => {
  let ctx: Contexto;
  let tienda: Awaited<ReturnType<typeof crearTienda>>;

  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.app.close());
  beforeEach(async () => {
    await limpiar(ctx.db);
    tienda = await crearTienda(ctx, 'Tienda Doña Rosa');
  });

  it('inicia sesión y devuelve el usuario con su rol y su tienda', async () => {
    const res = await ctx
      .http()
      .post('/api/auth/login')
      .send({ email: `  DUENO${tienda.id}@prueba.co `, password: 'Clave123!' })
      .expect(200);
    expect(res.body.usuario).toMatchObject({ rol: 'DUENO', tienda: 'Tienda Doña Rosa' });
    expect(res.body.token).toEqual(expect.any(String));
  });

  it('responde igual si el correo no existe o si la clave es incorrecta', async () => {
    const malaClave = await ctx.http().post('/api/auth/login').send({ email: `dueno${tienda.id}@prueba.co`, password: 'otra' }).expect(401);
    const noExiste = await ctx.http().post('/api/auth/login').send({ email: 'nadie@prueba.co', password: 'otra' }).expect(401);
    expect(malaClave.body.message).toBe(noExiste.body.message);
  });

  it('las rutas exigen token, salvo login y salud', async () => {
    await ctx.http().get('/api/salud').expect(200);
    await ctx.http().get('/api/productos').expect(401);
    await ctx.http().get('/api/productos').set(conToken('token.falso.xx')).expect(401);
  });
});

describe('Productos', () => {
  let ctx: Contexto;
  let tienda: Awaited<ReturnType<typeof crearTienda>>;
  const nuevo = { nombre: 'Café Sello Rojo 250 g', precio: 10500, costo: 8700, stock: 12, stockMinimo: 4 };

  beforeAll(async () => {
    ctx = await crearApp();
  });
  afterAll(() => ctx.app.close());
  beforeEach(async () => {
    await limpiar(ctx.db);
    tienda = await crearTienda(ctx);
  });

  it('el dueño crea productos; el cajero no', async () => {
    await ctx.http().post('/api/productos').set(conToken(tienda.cajero)).send(nuevo).expect(403);
    const res = await ctx.http().post('/api/productos').set(conToken(tienda.dueno)).send(nuevo).expect(201);
    expect(res.body).toMatchObject({ ...nuevo, activo: true, bajoStock: false });
  });

  it('valida con el esquema compartido: sin decimales y costo no mayor que el precio', async () => {
    const res = await ctx
      .http()
      .post('/api/productos')
      .set(conToken(tienda.dueno))
      .send({ ...nuevo, precio: 10500.5, costo: 20000 })
      .expect(400);
    expect(res.body.errores.precio).toBe('Debe ser un valor en pesos, sin decimales');

    const res2 = await ctx.http().post('/api/productos').set(conToken(tienda.dueno)).send({ ...nuevo, costo: 20000 }).expect(400);
    expect(res2.body.errores.costo).toBe('El costo no puede ser mayor que el precio de venta');
  });

  it('marca los que se están acabando y permite filtrarlos', async () => {
    await crearProducto(ctx, tienda.id, { nombre: 'Panela', stock: 3, stockMinimo: 6 });
    await crearProducto(ctx, tienda.id, { nombre: 'Arroz', stock: 40, stockMinimo: 10 });
    const res = await ctx.http().get('/api/productos?bajoStock=true').set(conToken(tienda.cajero)).expect(200);
    expect(res.body.map((p: { nombre: string }) => p.nombre)).toEqual(['Panela']);
    expect(res.body[0].bajoStock).toBe(true);
  });

  it('la entrada de mercancía suma al stock', async () => {
    const p = await crearProducto(ctx, tienda.id, { stock: 3 });
    const res = await ctx.http().patch(`/api/productos/${p.id}/entrada`).set(conToken(tienda.dueno)).send({ cantidad: 24 }).expect(200);
    expect(res.body.stock).toBe(27);
  });

  it('un producto con ventas se desactiva en lugar de borrarse', async () => {
    const vendido = await crearProducto(ctx, tienda.id, { nombre: 'Vendido' });
    const nuevoSinVentas = await crearProducto(ctx, tienda.id, { nombre: 'Sin ventas' });
    await ctx.http().post('/api/ventas').set(conToken(tienda.cajero)).send({ medio: 'EFECTIVO', items: [{ productoId: vendido.id, cantidad: 1 }] }).expect(201);

    const r1 = await ctx.http().delete(`/api/productos/${vendido.id}`).set(conToken(tienda.dueno)).expect(200);
    const r2 = await ctx.http().delete(`/api/productos/${nuevoSinVentas.id}`).set(conToken(tienda.dueno)).expect(200);
    expect(r1.body.desactivado).toBe(true);
    expect(r2.body.desactivado).toBe(false);

    const activos = await ctx.http().get('/api/productos').set(conToken(tienda.dueno)).expect(200);
    expect(activos.body).toHaveLength(0);
    const todos = await ctx.http().get('/api/productos?todos=true').set(conToken(tienda.dueno)).expect(200);
    expect(todos.body).toHaveLength(1);
  });

  it('no se puede tocar un producto de otra tienda', async () => {
    const otra = await crearTienda(ctx, 'Otra');
    const ajeno = await crearProducto(ctx, otra.id);
    await ctx.http().put(`/api/productos/${ajeno.id}`).set(conToken(tienda.dueno)).send(nuevo).expect(404);
    await ctx.http().delete(`/api/productos/${ajeno.id}`).set(conToken(tienda.dueno)).expect(404);
    const lista = await ctx.http().get('/api/productos').set(conToken(tienda.dueno)).expect(200);
    expect(lista.body).toHaveLength(0);
  });
});
