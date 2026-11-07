import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Rol } from '@elcuaderno/shared';
import { config } from '../config';
import { ES_PUBLICO, ROLES, UsuarioToken } from './decoradores';

/** Guarda global: toda ruta exige token salvo las marcadas con @Publico(), y respeta @Roles(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const destinos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, destinos)) return true;

    const req = ctx.switchToHttp().getRequest();
    // La web manda la cookie httpOnly; el encabezado Bearer queda para scripts y pruebas.
    const [tipo, bearer] = (req.headers.authorization ?? '').split(' ');
    const token: string | undefined = req.cookies?.[config.cookieSesion] ?? (tipo === 'Bearer' ? bearer : undefined);
    if (!token) throw new UnauthorizedException('Inicia sesión para continuar');

    try {
      const datos = await this.jwt.verifyAsync<UsuarioToken & { sub: number }>(token);
      req.usuario = { id: datos.sub, tiendaId: datos.tiendaId, nombre: datos.nombre, rol: datos.rol, tienda: datos.tienda } satisfies UsuarioToken;
    } catch {
      throw new UnauthorizedException('La sesión venció, vuelve a iniciar sesión');
    }

    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES, destinos);
    if (roles && !roles.includes(req.usuario.rol)) {
      throw new ForbiddenException('Solo el dueño de la tienda puede hacer esto');
    }
    return true;
  }
}
