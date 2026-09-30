import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Rol } from '@elcuaderno/shared';

export interface UsuarioToken {
  id: number;
  tiendaId: number;
  nombre: string;
  rol: Rol;
}

export const ES_PUBLICO = 'es-publico';
/** Ruta abierta: no exige token. */
export const Publico = () => SetMetadata(ES_PUBLICO, true);

export const ROLES = 'roles';
/** RN-08: restringe la ruta a ciertos roles (por ejemplo, solo el dueño cambia precios). */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES, roles);

/** Inyecta el usuario autenticado que viene en el token. */
export const Usuario = createParamDecorator((_: unknown, ctx: ExecutionContext): UsuarioToken => {
  return ctx.switchToHttp().getRequest().usuario;
});
