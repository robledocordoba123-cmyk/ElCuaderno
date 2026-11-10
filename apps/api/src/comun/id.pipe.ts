import { BadRequestException, PipeTransform } from '@nestjs/common';

/** El id más grande que cabe en una columna `serial` (integer) de PostgreSQL. */
const MAXIMO_ID = 2_147_483_647;

/**
 * Valida el `:id` de la ruta: entero positivo que quepa en la base. ParseIntPipe dejaba pasar
 * 99999999999, PostgreSQL lo rechazaba por fuera de rango y la API respondía 500.
 */
export class IdPipe implements PipeTransform<string, number> {
  transform(valor: string): number {
    const id = Number(valor);
    if (!/^\d+$/.test(valor) || id < 1 || id > MAXIMO_ID) {
      throw new BadRequestException({ statusCode: 400, message: 'El número de registro no es válido' });
    }
    return id;
  }
}
