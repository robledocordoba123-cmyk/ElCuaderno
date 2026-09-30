import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { loginSchema, type LoginDto } from '@elcuaderno/shared';
import { ZodPipe } from '../comun/zod.pipe';
import { AuthService } from './auth.service';
import { Publico, Usuario, type UsuarioToken } from './decoradores';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Publico()
  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodPipe(loginSchema)) datos: LoginDto) {
    return this.auth.login(datos);
  }

  @Get('yo')
  yo(@Usuario() usuario: UsuarioToken) {
    return usuario;
  }
}
