import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { entradaStockSchema, productoSchema, type EntradaStockDto, type ProductoDto } from '@elcuaderno/shared';
import { Roles, Usuario, type UsuarioToken } from '../auth/decoradores';
import { ZodPipe } from '../comun/zod.pipe';
import { ProductosService } from './productos.service';

@Controller('productos')
export class ProductosController {
  constructor(private readonly productos: ProductosService) {}

  @Get()
  listar(
    @Usuario() u: UsuarioToken,
    @Query('q') q?: string,
    @Query('bajoStock') bajoStock?: string,
    @Query('todos') todos?: string,
  ) {
    return this.productos.listar(u.tiendaId, { q: q?.trim() || undefined, bajoStock: bajoStock === 'true', incluirInactivos: todos === 'true' });
  }

  @Roles('DUENO')
  @Post()
  crear(@Usuario() u: UsuarioToken, @Body(new ZodPipe(productoSchema)) datos: ProductoDto) {
    return this.productos.crear(u.tiendaId, datos);
  }

  @Roles('DUENO')
  @Put(':id')
  actualizar(@Usuario() u: UsuarioToken, @Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(productoSchema)) datos: ProductoDto) {
    return this.productos.actualizar(u.tiendaId, id, datos);
  }

  @Roles('DUENO')
  @Patch(':id/entrada')
  entrada(@Usuario() u: UsuarioToken, @Param('id', ParseIntPipe) id: number, @Body(new ZodPipe(entradaStockSchema)) datos: EntradaStockDto) {
    return this.productos.entrada(u.tiendaId, id, datos);
  }

  @Roles('DUENO')
  @Delete(':id')
  @HttpCode(200)
  eliminar(@Usuario() u: UsuarioToken, @Param('id', ParseIntPipe) id: number) {
    return this.productos.eliminar(u.tiendaId, id);
  }
}
