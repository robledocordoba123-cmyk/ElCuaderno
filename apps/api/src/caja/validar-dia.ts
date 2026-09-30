import { BadRequestException } from '@nestjs/common';

const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Acepta un día AAAA-MM-DD válido o nada (entonces se usa hoy). */
export function validarDia(dia?: string): string | undefined {
  if (!dia) return undefined;
  if (!FORMATO_DIA.test(dia) || Number.isNaN(Date.parse(`${dia}T00:00:00Z`))) {
    throw new BadRequestException({ statusCode: 400, message: 'El día debe tener el formato AAAA-MM-DD' });
  }
  return dia;
}
