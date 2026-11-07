import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { config } from './config';

/** Configuración común a la app real y a las pruebas: prefijo /api, cabeceras de seguridad, cookies y CORS. */
export function configurar(app: INestApplication) {
  // helmet agrega cabeceras de seguridad y quita x-powered-by (no anunciamos que es Express).
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableCors({ origin: config.corsOrigen, credentials: true });
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
