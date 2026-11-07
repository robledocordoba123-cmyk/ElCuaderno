import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { loginSchema, type LoginDto } from '@elcuaderno/shared';
import { ZodPipe } from '../comun/zod.pipe';
import { config } from '../config';
import { aSesion, AuthService } from './auth.service';
import { Publico, Usuario, type UsuarioToken } from './decoradores';

// httpOnly: JavaScript no puede leer el token, así un script inyectado no se lo lleva.
// sameSite strict: el navegador no la manda desde otros sitios (protege contra CSRF).
const opcionesCookie = (): CookieOptions => ({
  httpOnly: true,
  secure: config.cookieSegura,
  sameSite: 'strict',
  path: '/api',
});
const OCHO_HORAS_MS = 8 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodPipe(loginSchema)) datos: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { token, sesion } = await this.auth.login(datos);
    res.cookie(config.cookieSesion, token, { ...opcionesCookie(), maxAge: OCHO_HORAS_MS });
    return sesion;
  }

  /** La web lo consulta al abrir para saber si la sesión sigue viva. */
  @Get('yo')
  yo(@Usuario() usuario: UsuarioToken) {
    return aSesion(usuario);
  }

  @Publico()
  @Post('salir')
  @HttpCode(204)
  salir(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(config.cookieSesion, opcionesCookie());
  }
}
