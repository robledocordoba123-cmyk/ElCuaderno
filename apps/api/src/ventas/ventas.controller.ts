import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { IdPipe } from '../comun/id.pipe';
import { anulacionSchema, ventaSchema, type AnulacionDto, type VentaDto } from '@elcuaderno/shared';
import { Roles, Usuario, type UsuarioToken } from '../auth/decoradores';
import { validarDia } from '../caja/validar-dia';
import { ZodPipe } from '../comun/zod.pipe';
import { VentasService } from './ventas.service';

@Controller('ventas')
export class VentasController {
  constructor(private readonly ventas: VentasService) {}

  @Post()
  registrar(@Usuario() u: UsuarioToken, @Body(new ZodPipe(ventaSchema)) datos: VentaDto) {
    return this.ventas.registrar(u.tiendaId, u.id, datos);
  }

  /** Solo la dueña anula, y debe dejar el motivo. */
  @Roles('DUENO')
  @Post(':id/anular')
  @HttpCode(200)
  anular(@Usuario() u: UsuarioToken, @Param('id', IdPipe) id: number, @Body(new ZodPipe(anulacionSchema)) datos: AnulacionDto) {
    return this.ventas.anular(u.tiendaId, u.id, id, datos);
  }

  @Get()
  listar(@Usuario() u: UsuarioToken, @Query('dia') dia?: string) {
    return this.ventas.listar(u.tiendaId, { dia: validarDia(dia) });
  }
}
