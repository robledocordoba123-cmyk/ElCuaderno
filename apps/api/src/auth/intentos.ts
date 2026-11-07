import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

const MAXIMO_FALLOS = 5;
const VENTANA_MS = 15 * 60 * 1000;

/**
 * Límite de intentos de inicio de sesión por correo: 5 fallos en 15 minutos bloquean
 * ese correo hasta que pase la ventana. Se cuenta por correo y no por IP porque la web
 * llega a la API a través del proxy de Vercel, y ahí todos los usuarios comparten la IP.
 * Vive en memoria: con una sola instancia de la API es suficiente; con varias, iría a la base.
 */
@Injectable()
export class IntentosLogin {
  private readonly fallos = new Map<string, { cuantos: number; desde: number }>();

  revisar(email: string, ahora = Date.now()) {
    const registro = this.fallos.get(email);
    if (!registro) return;
    if (ahora - registro.desde > VENTANA_MS) {
      this.fallos.delete(email);
      return;
    }
    if (registro.cuantos >= MAXIMO_FALLOS) {
      const minutos = Math.ceil((VENTANA_MS - (ahora - registro.desde)) / 60000);
      throw new HttpException(
        { statusCode: 429, message: `Demasiados intentos. Espera ${minutos} minutos e inténtalo de nuevo.` },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  fallo(email: string, ahora = Date.now()) {
    const registro = this.fallos.get(email);
    if (!registro || ahora - registro.desde > VENTANA_MS) this.fallos.set(email, { cuantos: 1, desde: ahora });
    else registro.cuantos += 1;
  }

  /** Solo para las pruebas: cada prueba empieza sin fallos anotados. */
  reiniciar() {
    this.fallos.clear();
  }

  exito(email: string) {
    this.fallos.delete(email);
  }
}
