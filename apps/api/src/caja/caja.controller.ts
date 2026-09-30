import { Controller, Get, Query } from '@nestjs/common';
import { Roles, Usuario, type UsuarioToken } from '../auth/decoradores';
import { CajaService } from './caja.service';
import { validarDia } from './validar-dia';

@Controller('caja')
export class CajaController {
  constructor(private readonly caja: CajaService) {}

  @Roles('DUENO')
  @Get('resumen')
  resumen(@Usuario() u: UsuarioToken, @Query('dia') dia?: string) {
    return this.caja.resumen(u.tiendaId, validarDia(dia));
  }
}
