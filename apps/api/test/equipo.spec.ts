import { hashSync } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { usuarios } from '../src/db/esquema';
import { DEMO } from '../src/demo/cuentas';
import { LimiteRegistros } from '../src/auth/intentos';
import { conCookie, conToken, Contexto, crearApp, crearTienda, limpiar, tokenDeCookie } from './soporte';

const CLAVE = 'Cuaderno2026';

describe('Equipo de la tienda y registro de tiendas', () => {
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

  const entrar = (email: string, password = CLAVE) => ctx.http().post('/api/auth/login').send({ email, password });
  const crearCajero = (email = 'nuevo@prueba.co', nombre = 'Valentina') =>
    ctx.http().post('/api/usuarios').set(conToken(tienda.dueno)).send({ nombre, email, password: CLAVE });

  describe('cajeros', () => {
    it('la dueña crea un cajero que puede entrar, y aparece en la lista', async () => {
      await crearCajero().expect(201);
      const res = await entrar('nuevo@prueba.co').expect(200);
      expect(res.body.usuario).toMatchObject({ nombre: 'Valentina', rol: 'CAJERO', tienda: 'Tienda de prueba' });

      const lista = await ctx.http().get('/api/usuarios').set(conToken(tienda.dueno)).expect(200);
      expect(lista.body.map((u: { nombre: string }) => u.nombre)).toEqual(['Dueña', 'Cajero', 'Valentina']);
      expect(lista.body[0]).toMatchObject({ esUsted: true, activo: true, deDemo: false });
    });

    it('el cajero no puede ver ni manejar el equipo', async () => {
      await ctx.http().get('/api/usuarios').set(conToken(tienda.cajero)).expect(403);
      await ctx.http().post('/api/usuarios').set(conToken(tienda.cajero)).send({ nombre: 'X', email: 'x@prueba.co', password: CLAVE }).expect(403);
    });

    it('pide una contraseña con letras y números, y no repite correos', async () => {
      const corta = await ctx.http().post('/api/usuarios').set(conToken(tienda.dueno)).send({ nombre: 'Ana', email: 'ana@prueba.co', password: 'solotexto' });
      expect(corta.status).toBe(400);
      await crearCajero(`cajero${tienda.id}@prueba.co`).expect(422);
    });

    it('al desactivar un cajero se le cierra la sesión y ya no puede entrar', async () => {
      const lista = await ctx.http().get('/api/usuarios').set(conToken(tienda.dueno)).expect(200);
      const cajero = lista.body.find((u: { rol: string }) => u.rol === 'CAJERO');

      await ctx.http().patch(`/api/usuarios/${cajero.id}/estado`).set(conToken(tienda.dueno)).send({ activo: false }).expect(200);
      // El token que ya tenía deja de servir de inmediato.
      const cerrada = await ctx.http().get('/api/productos').set(conToken(tienda.cajero)).expect(401);
      expect(cerrada.body.message).toMatch(/sesión se cerró/);
      const login = await ctx.http().post('/api/auth/login').send({ email: cajero.email, password: 'Clave123!' }).expect(403);
      expect(login.body.message).toMatch(/desactivado/);

      // Reactivado vuelve a entrar con su misma clave.
      await ctx.http().patch(`/api/usuarios/${cajero.id}/estado`).set(conToken(tienda.dueno)).send({ activo: true }).expect(200);
      await ctx.http().post('/api/auth/login').send({ email: cajero.email, password: 'Clave123!' }).expect(200);
    });

    it('la dueña no se desactiva a sí misma ni toca cajeros de otra tienda', async () => {
      const lista = await ctx.http().get('/api/usuarios').set(conToken(tienda.dueno)).expect(200);
      const yo = lista.body.find((u: { esUsted: boolean }) => u.esUsted);
      await ctx.http().patch(`/api/usuarios/${yo.id}/estado`).set(conToken(tienda.dueno)).send({ activo: false }).expect(422);

      const otra = await crearTienda(ctx, 'Otra tienda');
      const ajena = await ctx.http().get('/api/usuarios').set(conToken(otra.dueno)).expect(200);
      const cajeroAjeno = ajena.body.find((u: { rol: string }) => u.rol === 'CAJERO');
      await ctx.http().patch(`/api/usuarios/${cajeroAjeno.id}/estado`).set(conToken(tienda.dueno)).send({ activo: false }).expect(404);
    });

    it('la contraseña temporal reemplaza la vieja y cierra la sesión abierta', async () => {
      const lista = await ctx.http().get('/api/usuarios').set(conToken(tienda.dueno)).expect(200);
      const cajero = lista.body.find((u: { rol: string }) => u.rol === 'CAJERO');
      await ctx.http().post(`/api/usuarios/${cajero.id}/clave`).set(conToken(tienda.dueno)).send({ password: CLAVE }).expect(204);
      await ctx.http().get('/api/productos').set(conToken(tienda.cajero)).expect(401);
      await ctx.http().post('/api/auth/login').send({ email: cajero.email, password: 'Clave123!' }).expect(401);
      await entrar(cajero.email).expect(200);
    });

    it('las cuentas de la demostración no se pueden desactivar', async () => {
      const [demo] = await ctx.db
        .insert(usuarios)
        .values({ tiendaId: tienda.id, nombre: 'Santiago (demo)', email: DEMO.cajero.email, passwordHash: hashSync('x', 4), rol: 'CAJERO' })
        .returning();
      await ctx.http().patch(`/api/usuarios/${demo.id}/estado`).set(conToken(tienda.dueno)).send({ activo: false }).expect(403);
      await ctx.http().post(`/api/usuarios/${demo.id}/clave`).set(conToken(tienda.dueno)).send({ password: CLAVE }).expect(403);
    });

    it('anota en la bitácora lo que hace la dueña con su equipo', async () => {
      await crearCajero().expect(201);
      const res = await ctx.http().get('/api/bitacora').set(conToken(tienda.dueno)).expect(200);
      expect(res.body[0]).toMatchObject({ accion: 'Creó un cajero', detalle: 'Valentina' });
    });
  });

  describe('cambio de la propia contraseña', () => {
    it('pide la actual, deja este navegador adentro y cierra las otras sesiones', async () => {
      const email = `cajero${tienda.id}@prueba.co`;
      const otroCelular = tokenDeCookie(await ctx.http().post('/api/auth/login').send({ email, password: 'Clave123!' }).expect(200));

      await ctx.http().put('/api/auth/clave').set(conToken(tienda.cajero)).send({ actual: 'equivocada', nueva: CLAVE }).expect(401);
      const res = await ctx.http().put('/api/auth/clave').set(conToken(tienda.cajero)).send({ actual: 'Clave123!', nueva: CLAVE }).expect(204);

      const nuevo = tokenDeCookie(res);
      await ctx.http().get('/api/auth/yo').set(conCookie(nuevo)).expect(200);
      await ctx.http().get('/api/auth/yo').set(conToken(otroCelular)).expect(401);
      await entrar(email).expect(200);
    });
  });

  describe('registro de tiendas', () => {
    const registro = (datos: Record<string, unknown> = {}) =>
      ctx.http().post('/api/auth/registro').send({ tienda: 'Granero La Esquina', nombre: 'Gloria', email: 'gloria@prueba.co', password: CLAVE, aceptaPolitica: true, ...datos });

    it('crea la tienda con su dueña y deja la sesión abierta', async () => {
      const res = await registro().expect(201);
      expect(res.body.usuario).toMatchObject({ nombre: 'Gloria', rol: 'DUENO', tienda: 'Granero La Esquina' });
      const token = tokenDeCookie(res);

      // Empieza vacía: no ve nada de las otras tiendas.
      const productos = await ctx.http().get('/api/productos').set(conCookie(token)).expect(200);
      expect(productos.body).toEqual([]);
      const equipo = await ctx.http().get('/api/usuarios').set(conCookie(token)).expect(200);
      expect(equipo.body).toHaveLength(1);

      const [dueno] = await ctx.db.select().from(usuarios).where(eq(usuarios.email, 'gloria@prueba.co'));
      expect(dueno.passwordHash).not.toContain(CLAVE);
    });

    it('exige aceptar la política de datos y no repite correos', async () => {
      await registro({ aceptaPolitica: false }).expect(400);
      await registro().expect(201);
      const repetido = await registro({ tienda: 'Otra' }).expect(409);
      expect(repetido.body.message).toMatch(/ya tiene una cuenta/);
    });

    it('frena a quien registra muchas tiendas seguidas', async () => {
      const limite = ctx.app.get(LimiteRegistros);
      for (let i = 0; i < 20; i++) limite.anotar();
      await registro().expect(429);
    });
  });
});
