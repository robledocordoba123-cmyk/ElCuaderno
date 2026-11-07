import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import {
  baseCajaSchema,
  cierreSchema,
  gastoSchema,
  type BaseCajaDto,
  type CierreDto,
  type GastoDto,
} from '@elcuaderno/shared';
import { Roles, Usuario, type UsuarioToken } from '../auth/decoradores';
import { ZodPipe } from '../comun/zod.pipe';
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

  @Roles('DUENO')
  @Put('base')
  fijarBase(@Usuario() u: UsuarioToken, @Body(new ZodPipe(baseCajaSchema)) datos: BaseCajaDto) {
    return this.caja.fijarBase(u.tiendaId, u.id, datos);
  }

  /** El cajero también anota gastos: muchas veces es quien le paga al proveedor. */
  @Post('gastos')
  registrarGasto(@Usuario() u: UsuarioToken, @Body(new ZodPipe(gastoSchema)) datos: GastoDto) {
    return this.caja.registrarGasto(u.tiendaId, u.id, datos);
  }

  @Roles('DUENO')
  @Delete('gastos/:id')
  quitarGasto(@Usuario() u: UsuarioToken, @Param('id', ParseIntPipe) id: number) {
    return this.caja.quitarGasto(u.tiendaId, id);
  }

  @Roles('DUENO')
  @Post('cierre')
  @HttpCode(201)
  cerrar(@Usuario() u: UsuarioToken, @Body(new ZodPipe(cierreSchema)) datos: CierreDto, @Query('dia') dia?: string) {
    return this.caja.cerrar(u.tiendaId, u.id, datos, validarDia(dia));
  }
}
