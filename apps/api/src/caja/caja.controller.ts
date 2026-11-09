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
import { ReglaDeNegocio } from '../comun/errores';
import { diaLocal } from '../tiempo';
import { validarDia } from './validar-dia';

const DIA_MS = 24 * 60 * 60 * 1000;
const moverDia = (dia: string, delta: number) => new Date(Date.parse(`${dia}T12:00:00Z`) + delta * DIA_MS).toISOString().slice(0, 10);
/** Días del rango contando los dos extremos: del 1 al 7 son 7. */
const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / DIA_MS) + 1;

@Controller('caja')
export class CajaController {
  constructor(private readonly caja: CajaService) {}

  @Roles('DUENO')
  @Get('resumen')
  resumen(@Usuario() u: UsuarioToken, @Query('dia') dia?: string) {
    return this.caja.resumen(u.tiendaId, validarDia(dia));
  }

  /** Reporte de un rango: por defecto los últimos 7 días; máximo 92 días (un trimestre). */
  @Roles('DUENO')
  @Get('reporte')
  reporte(@Usuario() u: UsuarioToken, @Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    const hoy = diaLocal();
    const fin = validarDia(hasta) ?? hoy;
    const inicio = validarDia(desde) ?? moverDia(fin, -6);
    if (inicio > fin) throw new ReglaDeNegocio('La fecha inicial no puede ser después de la final');
    if (fin > hoy) throw new ReglaDeNegocio('El reporte no puede incluir días que no han llegado');
    if (diasEntre(inicio, fin) > 92) throw new ReglaDeNegocio('El rango máximo es de 92 días');
    return this.caja.reporte(u.tiendaId, inicio, fin);
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
