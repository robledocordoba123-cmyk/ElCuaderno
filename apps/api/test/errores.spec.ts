import { conToken, Contexto, crearApp, crearTienda, limpiar } from './soporte';

describe('Errores claros', () => {
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

  it('un JSON mal escrito responde 400 en español', async () => {
    const res = await ctx.http().post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ').expect(400);
    expect(res.body.message).toMatch(/no es JSON válido/);
  });

  it('un id fuera de rango no revienta el servidor', async () => {
    const res = await ctx.http().get('/api/clientes/99999999999').set(conToken(tienda.dueno));
    expect(res.status).toBe(400);
  });

  it('parámetros raros en la dirección no revientan el servidor', async () => {
    const rutas = [
      '/api/bitacora?pagina=abc',
      '/api/bitacora?pagina=-3',
      '/api/bitacora?pagina=99999999999',
      '/api/caja?dia=2026-02-31',
      '/api/caja?dia=hoy',
      '/api/caja/reporte?desde=2026-13-01&hasta=2026-13-05',
      '/api/caja/reporte?desde=abc',
      '/api/clientes/abc',
      '/api/clientes/0',
    ];
    for (const ruta of rutas) {
      const res = await ctx.http().get(ruta).set(conToken(tienda.dueno));
      expect({ ruta, status: res.status < 500 }).toEqual({ ruta, status: true });
    }
  });

  it('las rutas que no existen responden 404', async () => {
    await ctx.http().get('/api/no-existe').set(conToken(tienda.dueno)).expect(404);
  });
});
