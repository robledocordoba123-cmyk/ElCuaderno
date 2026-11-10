import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Respuesta para los errores que nadie esperaba (un fallo de la base, un bug): la persona ve un
 * mensaje claro en español y el detalle técnico queda solo en el registro del servidor, con un
 * número para encontrarlo. Los errores conocidos (400, 401, 404, 422...) pasan tal cual.
 */
@Catch()
export class FiltroErrores implements ExceptionFilter {
  private readonly log = new Logger('Errores');

  catch(error: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (error instanceof HttpException) {
      res.status(error.getStatus()).json(error.getResponse());
      return;
    }

    const referencia = Math.random().toString(36).slice(2, 8).toUpperCase();
    // Solo método y ruta: nunca el cuerpo, que puede traer contraseñas o datos de vecinos.
    this.log.error(`[${referencia}] ${req.method} ${req.path}`, error instanceof Error ? error.stack : String(error));
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      message: `Algo falló en el servidor. Intenta de nuevo; si sigue pasando, avisa con el código ${referencia}.`,
      referencia,
    });
  }
}
