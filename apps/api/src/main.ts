import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { json, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { FiltroErrores } from './comun/filtro-errores';
import { config } from './config';

/** Configuración común a la app real y a las pruebas: prefijo /api, cabeceras de seguridad, cookies y CORS. */
export function configurar(app: INestApplication) {
  // helmet agrega cabeceras de seguridad y quita x-powered-by (no anunciamos que es Express).
  app.use(helmet());
  app.use(cookieParser());
  // El JSON se lee aquí (antes que Nest) para poder responder en español si viene mal escrito.
  app.use(json({ limit: '100kb' }));
  app.use(errorDeCuerpo);
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new FiltroErrores());
  app.enableCors({ origin: config.corsOrigen, credentials: true });
  app.enableShutdownHooks();
  return app;
}

/** Errores al leer el cuerpo: JSON mal escrito o demasiado grande. */
function errorDeCuerpo(error: { type?: string } | undefined, _req: Request, res: Response, siguiente: NextFunction) {
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ statusCode: 400, message: 'El cuerpo de la petición no es JSON válido' });
  } else if (error?.type === 'entity.too.large') {
    res.status(413).json({ statusCode: 413, message: 'La petición es demasiado grande' });
  } else {
    siguiente(error);
  }
}

async function arrancar() {
  const app = configurar(await NestFactory.create(AppModule));
  await app.listen(config.puerto);
  console.log(`ElCuaderno API escuchando en http://localhost:${config.puerto}/api`);
}

if (require.main === module) {
  void arrancar();
}
