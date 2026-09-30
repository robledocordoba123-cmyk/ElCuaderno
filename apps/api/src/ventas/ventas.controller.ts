import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ventaSchema, type VentaDto } from '@elcuaderno/shared';
import { Usuario, type UsuarioToken } from '../auth/decoradores';
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

  @Get()
  listar(@Usuario() u: UsuarioToken, @Query('dia') dia?: string) {
    return this.ventas.listar(u.tiendaId, { dia: validarDia(dia) });
  }
}
