import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hashSync } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { LoginDto, Sesion } from '@elcuaderno/shared';
import { BaseDeDatos, InjectDb } from '../db/db.module';
import { tiendas, usuarios } from '../db/esquema';

// Hash de relleno: si el correo no existe igual se compara, para que el tiempo de respuesta
// no revele qué correos están registrados.
const HASH_FALSO = hashSync('no-es-una-clave-real', 10);

@Injectable()
export class AuthService {
  constructor(
    @InjectDb() private readonly db: BaseDeDatos,
    private readonly jwt: JwtService,
  ) {}

  async login({ email, password }: LoginDto): Promise<Sesion> {
    const [fila] = await this.db
      .select({ usuario: usuarios, tienda: tiendas.nombre })
      .from(usuarios)
      .innerJoin(tiendas, eq(tiendas.id, usuarios.tiendaId))
      .where(eq(usuarios.email, email));

    const valida = await compare(password, fila?.usuario.passwordHash ?? HASH_FALSO);
    if (!fila || !valida) throw new UnauthorizedException('Correo o contraseña incorrectos');

    const { usuario, tienda } = fila;
    const token = await this.jwt.signAsync({
      sub: usuario.id,
      tiendaId: usuario.tiendaId,
      nombre: usuario.nombre,
      rol: usuario.rol,
    });
    return { token, usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol, tienda } };
  }
}
