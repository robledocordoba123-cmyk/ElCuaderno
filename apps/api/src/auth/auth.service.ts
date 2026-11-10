import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash, hashSync } from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import type { CambioClaveDto, LoginDto, RegistroDto, Sesion } from '@elcuaderno/shared';
import { BitacoraService } from '../bitacora/bitacora';
import { BaseDeDatos, InjectDb } from '../db/db.module';
import { tiendas, usuarios } from '../db/esquema';
import { esCuentaDemo } from '../demo/cuentas';
import type { ContenidoToken } from './auth.guard';
import type { UsuarioToken } from './decoradores';
import { IntentosLogin, LimiteRegistros } from './intentos';

// Hash de relleno: si el correo no existe igual se compara, para que el tiempo de respuesta
// no revele qué correos están registrados.
const HASH_FALSO = hashSync('no-es-una-clave-real', 10);
export const COSTO_BCRYPT = 10;

/** Código de Postgres para "ya existe un valor igual" (el correo es único). */
const ES_DUPLICADO = (e: unknown) => (e as { code?: string; cause?: { code?: string } })?.code === '23505' || (e as { cause?: { code?: string } })?.cause?.code === '23505';

@Injectable()
export class AuthService {
  constructor(
    @InjectDb() private readonly db: BaseDeDatos,
    private readonly jwt: JwtService,
    private readonly intentos: IntentosLogin,
    private readonly registros: LimiteRegistros,
    private readonly bitacora: BitacoraService,
  ) {}

  /** Devuelve el token (va en la cookie) y la sesión (va en el cuerpo, sin el token). */
  async login({ email, password }: LoginDto): Promise<{ token: string; sesion: Sesion }> {
    this.intentos.revisar(email);

    const [fila] = await this.db
      .select({ usuario: usuarios, tienda: tiendas.nombre })
      .from(usuarios)
      .innerJoin(tiendas, eq(tiendas.id, usuarios.tiendaId))
      .where(eq(usuarios.email, email));

    const valida = await compare(password, fila?.usuario.passwordHash ?? HASH_FALSO);
    if (!fila || !valida) {
      this.intentos.fallo(email);
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }
    this.intentos.exito(email);
    // Solo se dice después de comprobar la clave: así no sirve para averiguar quién trabaja ahí.
    if (!fila.usuario.activo) {
      throw new ForbiddenException('Tu usuario está desactivado. Habla con la dueña de la tienda.');
    }

    const { usuario, tienda } = fila;
    const datos: UsuarioToken = { id: usuario.id, tiendaId: usuario.tiendaId, nombre: usuario.nombre, rol: usuario.rol, tienda };
    await this.bitacora.registrar(datos, 'Inició sesión');
    return { token: await this.firmar(datos, usuario.versionSesion), sesion: aSesion(datos) };
  }

  /** Una tienda nueva con su dueña, que queda con la sesión abierta. */
  async registrar(datos: RegistroDto): Promise<{ token: string; sesion: Sesion }> {
    this.registros.revisar();
    const passwordHash = await hash(datos.password, COSTO_BCRYPT);
    let usuario: UsuarioToken;
    try {
      usuario = await this.db.transaction(async (tx) => {
        const [tienda] = await tx.insert(tiendas).values({ nombre: datos.tienda, politicaAceptadaEn: new Date() }).returning();
        const [dueno] = await tx
          .insert(usuarios)
          .values({ tiendaId: tienda.id, nombre: datos.nombre, email: datos.email, passwordHash, rol: 'DUENO' })
          .returning();
        return { id: dueno.id, tiendaId: tienda.id, nombre: dueno.nombre, rol: 'DUENO' as const, tienda: tienda.nombre };
      });
    } catch (e) {
      if (ES_DUPLICADO(e)) throw new ConflictException('Ese correo ya tiene una cuenta. Inicia sesión.');
      throw e;
    }
    this.registros.anotar();
    await this.bitacora.registrar(usuario, 'Registró la tienda', usuario.tienda);
    return { token: await this.firmar(usuario, 1), sesion: aSesion(usuario) };
  }

  /**
   * Cada quien cambia su propia clave con la actual. Las demás sesiones abiertas (otro celular)
   * se cierran; la de este navegador sigue con un token nuevo.
   */
  async cambiarClave(quien: UsuarioToken, { actual, nueva }: CambioClaveDto): Promise<string> {
    const [fila] = await this.db.select().from(usuarios).where(eq(usuarios.id, quien.id));
    if (!fila || !(await compare(actual, fila.passwordHash))) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }
    if (esCuentaDemo(fila.email)) throw new ForbiddenException('La clave de la cuenta de demostración no se puede cambiar');
    const [cambiado] = await this.db
      .update(usuarios)
      .set({ passwordHash: await hash(nueva, COSTO_BCRYPT), versionSesion: sql`${usuarios.versionSesion} + 1` })
      .where(eq(usuarios.id, quien.id))
      .returning({ version: usuarios.versionSesion });
    await this.bitacora.registrar(quien, 'Cambió su contraseña');
    return this.firmar(quien, cambiado.version);
  }

  private firmar(u: UsuarioToken, version: number) {
    const contenido: ContenidoToken = { sub: u.id, tiendaId: u.tiendaId, nombre: u.nombre, rol: u.rol, tienda: u.tienda, v: version };
    return this.jwt.signAsync(contenido);
  }
}

export const aSesion = (u: UsuarioToken): Sesion => ({ usuario: { id: u.id, nombre: u.nombre, rol: u.rol, tienda: u.tienda } });
