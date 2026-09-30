import { Controller, Get, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { Publico } from './auth/decoradores';
import { CajaModule } from './caja/caja.module';
import { ClientesModule } from './clientes/clientes.module';
import { DbModule } from './db/db.module';
import { ProductosModule } from './productos/productos.module';
import { VentasModule } from './ventas/ventas.module';

@Controller('salud')
class SaludController {
  /** Render consulta esta ruta para saber si la API está viva. */
  @Publico()
  @Get()
  salud() {
    return { estado: 'ok' };
  }
}

@Module({
  imports: [DbModule, AuthModule, ProductosModule, ClientesModule, VentasModule, CajaModule],
  controllers: [SaludController],
})
export class AppModule {}
