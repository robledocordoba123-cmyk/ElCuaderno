import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { abonoSchema, clienteSchema, type AbonoDto, type ClienteDto } from '@elcuaderno/shared';
import { Roles, Usuario, type UsuarioToken } from '../auth/decoradores';
import { ZodPipe } from '../comun/zod.pipe';
import { ClientesService } from './clientes.service';

@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  @Get()
  listar(@Usuario() u: UsuarioToken, @Query('deudores') deudores?: string) {
    return this.clientes.listar(u.tiendaId, deudores === 'true');
  }

  @Get(':id')
  obtener(@Usuario() u: UsuarioToken, @Param('id', ParseIntPipe) id: number) {
    return this.clientes.obtener(u.tiendaId, id);
  }

  @Roles('DUENO')
  @Post()
  crear(@Usuario() u: UsuarioToken, @Body(new ZodPipe(clienteSchema)) datos: ClienteDto) {
    return this.clientes.crear(u.tiendaId, datos);
  }

  @Roles('DUENO')
  @Put(':id')
  actualizar(@Usuario() u: UsuarioToken, @Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(clienteSchema)) datos: ClienteDto) {
    return this.clientes.actualizar(u.tiendaId, id, datos);
  }

  @Post(':id/abonos')
  abonar(@Usuario() u: UsuarioToken, @Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(abonoSchema)) datos: AbonoDto) {
    return this.clientes.abonar(u.tiendaId, u.id, id, datos);
  }
}
