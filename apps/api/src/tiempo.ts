// RN-09: "hoy" es el día en hora de Colombia, no en UTC.
import { config } from './config';

/** Día calendario (AAAA-MM-DD) de una fecha en la zona horaria de la tienda. */
export function diaLocal(fecha: Date = new Date(), zona = config.zonaHoraria): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha);
}

/** Inicio y fin (instantes UTC) de un día local. Colombia no tiene horario de verano: siempre UTC-5. */
export function limitesDelDia(dia: string): { desde: Date; hasta: Date } {
  const desde = new Date(`${dia}T00:00:00-05:00`);
  const hasta = new Date(desde.getTime() + 24 * 60 * 60 * 1000);
  return { desde, hasta };
}
