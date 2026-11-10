import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import type { Rol } from '@elcuaderno/shared';
import { config } from '../config';
import { BaseDeDatos, InjectDb } from '../db/db.module';
import { usuarios } from '../db/esquema';
import { ES_PUBLICO, ROLES, UsuarioToken } from './decoradores';

/** Lo que va dentro del token. `v` es la versión de sesión del usuario cuando entró. */
export interface ContenidoToken {
  sub: number;
  tiendaId: number;
  nombre: string;
  rol: Rol;
  tienda: string;
  v?: number;
}

/**
 * Guarda global: toda ruta exige token salvo las marcadas con @Publico(), y respeta @Roles().
 * Además confirma en la base que el usuario sigue activo y que su sesión no se cerró
 * (desactivarlo o cambiarle la clave sube `version_sesion` y los tokens viejos dejan de servir).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    @InjectDb() private readonly db: BaseDeDatos,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const destinos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, destinos)) return true;

    const req = ctx.switchToHttp().getRequest();
    // La web manda la cookie httpOnly; el encabezado Bearer queda para scripts y pruebas.
    const [tipo, bearer] = (req.headers.authorization ?? '').split(' ');
    const token: string | undefined = req.cookies?.[config.cookieSesion] ?? (tipo === 'Bearer' ? bearer : undefined);
    if (!token) throw new UnauthorizedException('Inicia sesión para continuar');

    let datos: ContenidoToken;
    try {
      datos = await this.jwt.verifyAsync<ContenidoToken>(token);
    } catch {
      throw new UnauthorizedException('La sesión venció, vuelve a iniciar sesión');
    }

    const [actual] = await this.db
      .select({ activo: usuarios.activo, version: usuarios.versionSesion, nombre: usuarios.nombre })
      .from(usuarios)
      .where(eq(usuarios.id, datos.sub));
    // Los tokens de antes de esta versión no traen `v`: valen como versión 1.
    if (!actual || !actual.activo || actual.version !== (datos.v ?? 1)) {
      throw new UnauthorizedException('Tu sesión se cerró. Vuelve a iniciar sesión');
    }

    req.usuario = { id: datos.sub, tiendaId: datos.tiendaId, nombre: actual.nombre, rol: datos.rol, tienda: datos.tienda } satisfies UsuarioToken;

    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES, destinos);
    if (roles && !roles.includes(req.usuario.rol)) {
      throw new ForbiddenException('Solo el dueño de la tienda puede hacer esto');
    }
    return true;
  }
}
