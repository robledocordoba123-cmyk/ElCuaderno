// Utilidades de las pruebas: levantan la app real (NestJS) sobre la base de pruebas y crean datos.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hashSync } from 'bcryptjs';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { BaseDeDatos, DB } from '../src/db/db.module';
import { clientes, productos, tiendas, usuarios } from '../src/db/esquema';
import { migrar } from '../src/db/migrar';
import { configurar } from '../src/main';

const HASH = hashSync('Clave123!', 4); // Costo bajo: en pruebas importa la velocidad, no la seguridad.

export interface Contexto {
  app: INestApplication;
  db: BaseDeDatos;
  http: () => ReturnType<typeof request>;
}

export async function crearApp(): Promise<Contexto> {
  await migrar();
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configurar(modulo.createNestApplication());
  await app.init();
  return { app, db: app.get<BaseDeDatos>(DB), http: () => request(app.getHttpServer()) };
}

export async function limpiar(db: BaseDeDatos) {
  await db.execute(
    sql`TRUNCATE detalles_venta, ventas, abonos, clientes, productos, usuarios, tiendas RESTART IDENTITY CASCADE`,
  );
}

/** Crea una tienda con un dueño y un cajero, y devuelve sus tokens. */
export async function crearTienda(ctx: Contexto, nombre = 'Tienda de prueba') {
  const [tienda] = await ctx.db.insert(tiendas).values({ nombre }).returning();
  const sufijo = `${tienda.id}@prueba.co`;
  await ctx.db.insert(usuarios).values([
    { tiendaId: tienda.id, nombre: 'Dueña', email: `dueno${sufijo}`, passwordHash: HASH, rol: 'DUENO' },
    { tiendaId: tienda.id, nombre: 'Cajero', email: `cajero${sufijo}`, passwordHash: HASH, rol: 'CAJERO' },
  ]);
  const login = async (email: string) =>
    (await ctx.http().post('/api/auth/login').send({ email, password: 'Clave123!' }).expect(200)).body.token as string;
  return { id: tienda.id, dueno: await login(`dueno${sufijo}`), cajero: await login(`cajero${sufijo}`) };
}

export async function crearProducto(
  ctx: Contexto,
  tiendaId: number,
  datos: Partial<typeof productos.$inferInsert> = {},
) {
  const [p] = await ctx.db
    .insert(productos)
    .values({ tiendaId, nombre: 'Arroz', precio: 3000, costo: 2000, stock: 10, stockMinimo: 2, ...datos })
    .returning();
  return p;
}

export async function crearCliente(ctx: Contexto, tiendaId: number, cupo = 50000, nombre = 'Don Jairo') {
  const [c] = await ctx.db.insert(clientes).values({ tiendaId, nombre, cupo }).returning();
  return c;
}

export const conToken = (token: string) => ({ Authorization: `Bearer ${token}` });
