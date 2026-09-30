import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Valida el cuerpo de la petición con el mismo esquema Zod que usa el frontend
 * (paquete @elcuaderno/shared). Si falla, responde 400 con el error de cada campo.
 */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly esquema: ZodType<T>) {}

  transform(valor: unknown): T {
    const resultado = this.esquema.safeParse(valor);
    if (resultado.success) return resultado.data;
    const errores: Record<string, string> = {};
    for (const issue of resultado.error.issues) {
      const campo = issue.path.join('.') || 'general';
      errores[campo] ??= issue.message;
    }
    throw new BadRequestException({ statusCode: 400, message: 'Hay datos por corregir', errores });
  }
}
