import { formatearPesos } from '@elcuaderno/shared';
import { sql } from 'drizzle-orm';
import { conCookie, conToken, Contexto, crearApp, crearCliente, crearProducto, crearTienda, limpiar, tokenDeCookie } from './soporte';

describe('Seguridad de la sesión', () => {
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

  it('bloquea el correo tras 5 intentos fallidos, aunque luego pongan la clave correcta', async () => {
    const email = `cajero${tienda.id}@prueba.co`;
    for (let i = 0; i < 5; i++) {
      await ctx.http().post('/api/auth/login').send({ email, password: 'adivinando' }).expect(401);
    }
    const res = await ctx.http().post('/api/auth/login').send({ email, password: 'Clave123!' }).expect(429);
    expect(res.body.message).toMatch(/Demasiados intentos/);
    // El bloqueo es por correo: la dueña de la misma tienda sigue entrando.
    await ctx.http().post('/api/auth/login').send({ email: `dueno${tienda.id}@prueba.co`, password: 'Clave123!' }).expect(200);
  });

  it('un inicio de sesión correcto reinicia la cuenta de fallos', async () => {
    const email = `dueno${tienda.id}@prueba.co`;
    for (let i = 0; i < 4; i++) await ctx.http().post('/api/auth/login').send({ email, password: 'otra' }).expect(401);
    await ctx.http().post('/api/auth/login').send({ email, password: 'Clave123!' }).expect(200);
    for (let i = 0; i < 4; i++) await ctx.http().post('/api/auth/login').send({ email, password: 'otra' }).expect(401);
    await ctx.http().post('/api/auth/login').send({ email, password: 'Clave123!' }).expect(200);
  });

  it('salir borra la cookie de sesión', async () => {
    const res = await ctx.http().post('/api/auth/salir').set(conCookie(tienda.dueno)).expect(204);
    const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).join(';');
    expect(cookie).toMatch(/elcuaderno_sesion=;/);
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it('manda cabeceras de seguridad y no anuncia que usa Express', async () => {
    const res = await ctx.http().get('/api/salud').expect(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
  });
});

describe('Datos personales de los vecinos (Ley 1581)', () => {
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

  it('no guarda un cliente sin la autorización del vecino', async () => {
    const res = await ctx
      .http()
      .post('/api/clientes')
      .set(conToken(tienda.dueno))
      .send({ nombre: 'Vecina nueva', telefono: '3001234567', cupo: 20000, autorizaDatos: false })
      .expect(400);
    expect(res.body.errores.autorizaDatos).toBe('El vecino debe autorizar que se guarden sus datos');
  });

  it('no borra los datos de quien todavía debe', async () => {
    const cliente = await crearCliente(ctx, tienda.id, 50000);
    const producto = await crearProducto(ctx, tienda.id);
    await ctx
      .http()
      .post('/api/ventas')
      .set(conToken(tienda.cajero))
      .send({ medio: 'FIADO', clienteId: cliente.id, items: [{ productoId: producto.id, cantidad: 1 }] })
      .expect(201);
    const res = await ctx.http().post(`/api/clientes/${cliente.id}/suprimir`).set(conToken(tienda.dueno)).expect(422);
    expect(res.body.message).toBe('No se pueden borrar sus datos mientras tenga deuda');
  });

  it('suprime nombre y teléfono, conserva el historial y lo quita de la lista', async () => {
    const res = await ctx
      .http()
      .post('/api/clientes')
      .set(conToken(tienda.dueno))
      .send({ nombre: 'Doña Marta', telefono: '3001112233', cupo: 30000, autorizaDatos: true })
      .expect(201);
    const id = res.body.id as number;
    await ctx.http().post(`/api/clientes/${id}/suprimir`).set(conToken(tienda.cajero)).expect(403);
    await ctx.http().post(`/api/clientes/${id}/suprimir`).set(conToken(tienda.dueno)).expect(200);
    // La bitácora tampoco guarda su nombre.
    const bitacora = await ctx.http().get('/api/bitacora').set(conToken(tienda.dueno)).expect(200);
    expect(JSON.stringify(bitacora.body)).not.toContain('Doña Marta');
    expect(bitacora.body[0]).toMatchObject({ accion: 'Suprimió los datos de un cliente', detalle: `Cliente #${id}` });

    const lista = await ctx.http().get('/api/clientes').set(conToken(tienda.dueno)).expect(200);
    expect(lista.body).toHaveLength(0);
    const fila = await ctx.db.execute(sql`SELECT nombre, telefono, autoriza_datos FROM clientes WHERE id = ${id}`);
    expect(fila.rows[0]).toEqual({ nombre: `Cliente retirado #${id}`, telefono: null, autoriza_datos: false });
    // Ya suprimido, no se puede editar para volver a cargar sus datos.
    await ctx
      .http()
      .put(`/api/clientes/${id}`)
      .set(conToken(tienda.dueno))
      .send({ nombre: 'Doña Marta', cupo: 0, autorizaDatos: true })
      .expect(404);
  });
});

describe('Bitácora', () => {
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

  it('anota quién inició sesión, vendió y cambió precios; solo la dueña la ve', async () => {
    const producto = await crearProducto(ctx, tienda.id, { nombre: 'Panela', precio: 3800, costo: 3000 });
    await ctx
      .http()
      .post('/api/ventas')
      .set(conToken(tienda.cajero))
      .send({ medio: 'EFECTIVO', items: [{ productoId: producto.id, cantidad: 2 }] })
      .expect(201);
    await ctx
      .http()
      .put(`/api/productos/${producto.id}`)
      .set(conToken(tienda.dueno))
      .send({ nombre: 'Panela', precio: 4000, costo: 3000, stock: 8, stockMinimo: 2 })
      .expect(200);
    // Las consultas no se anotan, solo los cambios.
    await ctx.http().get('/api/productos').set(conToken(tienda.dueno)).expect(200);

    await ctx.http().get('/api/bitacora').set(conToken(tienda.cajero)).expect(403);
    const res = await ctx.http().get('/api/bitacora').set(conToken(tienda.dueno)).expect(200);
    const acciones = res.body.map((r: { usuario: string; accion: string }) => `${r.usuario}: ${r.accion}`);
    expect(acciones).toEqual([
      'Dueña: Editó un producto',
      'Cajero: Registró una venta',
      'Cajero: Inició sesión',
      'Dueña: Inició sesión',
    ]);
    expect(res.body[0].detalle).toBe(`Panela · ${formatearPesos(4000)}`);
    expect(res.body[1].detalle).toMatch(/^Venta #\d+ · EFECTIVO · /);
    expect(res.body[1].detalle.endsWith(formatearPesos(7600))).toBe(true);
  });

  it('una petición que falla no se anota', async () => {
    await ctx.http().post('/api/productos').set(conToken(tienda.dueno)).send({ nombre: 'X' }).expect(400);
    const res = await ctx.http().get('/api/bitacora').set(conToken(tienda.dueno)).expect(200);
    expect(res.body.map((r: { accion: string }) => r.accion)).not.toContain('Creó un producto');
  });

  it('no se puede editar ni borrar, ni siquiera desde la base de datos', async () => {
    await expect(ctx.db.execute(sql`UPDATE bitacora SET accion = 'Nada'`)).rejects.toThrow();
    await expect(ctx.db.execute(sql`DELETE FROM bitacora`)).rejects.toThrow();
    const res = await ctx.http().get('/api/bitacora').set(conToken(tienda.dueno)).expect(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('cada tienda ve solo su bitácora', async () => {
    const otra = await crearTienda(ctx, 'Otra');
    const res = await ctx.http().get('/api/bitacora').set(conToken(otra.dueno)).expect(200);
    expect(res.body.every((r: { usuario: string }) => r.usuario === 'Dueña' || r.usuario === 'Cajero')).toBe(true);
    expect(res.body).toHaveLength(2);
  });

  it('la sesión también funciona con la cookie', async () => {
    const res = await ctx.http().post('/api/auth/login').send({ email: `dueno${tienda.id}@prueba.co`, password: 'Clave123!' }).expect(200);
    await ctx.http().get('/api/bitacora').set(conCookie(tokenDeCookie(res))).expect(200);
  });
});
