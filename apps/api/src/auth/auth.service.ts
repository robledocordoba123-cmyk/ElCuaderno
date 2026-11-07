import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hashSync } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { LoginDto, Sesion } from '@elcuaderno/shared';
import { BitacoraService } from '../bitacora/bitacora';
import { BaseDeDatos, InjectDb } from '../db/db.module';
import { tiendas, usuarios } from '../db/esquema';
import type { UsuarioToken } from './decoradores';
import { IntentosLogin } from './intentos';

// Hash de relleno: si el correo no existe igual se compara, para que el tiempo de respuesta
// no revele qué correos están registrados.
const HASH_FALSO = hashSync('no-es-una-clave-real', 10);

@Injectable()
export class AuthService {
  constructor(
    @InjectDb() private readonly db: BaseDeDatos,
    private readonly jwt: JwtService,
    private readonly intentos: IntentosLogin,
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

    const { usuario, tienda } = fila;
    const datos: UsuarioToken = { id: usuario.id, tiendaId: usuario.tiendaId, nombre: usuario.nombre, rol: usuario.rol, tienda };
    const token = await this.jwt.signAsync({ sub: usuario.id, tiendaId: datos.tiendaId, nombre: datos.nombre, rol: datos.rol, tienda });
    await this.bitacora.registrar(datos, 'Inició sesión');
    return { token, sesion: aSesion(datos) };
  }
}

export const aSesion = (u: UsuarioToken): Sesion => ({ usuario: { id: u.id, nombre: u.nombre, rol: u.rol, tienda: u.tienda } });
