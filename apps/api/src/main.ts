import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from './config';

/** Configuración común a la app real y a las pruebas: prefijo /api y CORS solo para el frontend. */
export function configurar(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.corsOrigen });
  app.enableShutdownHooks();
  return app;
}

async function arrancar() {
  const app = configurar(await NestFactory.create(AppModule));
  await app.listen(config.puerto);
  console.log(`ElCuaderno API escuchando en http://localhost:${config.puerto}/api`);
}

if (require.main === module) {
  void arrancar();
}
