// Configuración leída de variables de entorno. En producción los secretos son obligatorios.
const produccion = process.env.NODE_ENV === 'production';

function requerida(nombre: string, porDefectoEnDesarrollo: string): string {
  const valor = process.env[nombre];
  if (valor) return valor;
  if (produccion) throw new Error(`Falta la variable de entorno ${nombre}`);
  return porDefectoEnDesarrollo;
}

export const config = {
  puerto: Number(process.env.PORT ?? 3100),
  databaseUrl: requerida('DATABASE_URL', 'postgresql://elcuaderno:elcuaderno_dev@localhost:5434/elcuaderno'),
  // Secreto solo para desarrollo: nunca se usa en producción porque ahí es obligatorio.
  jwtSecret: requerida('JWT_SECRET', 'secreto-de-desarrollo-no-usar-en-produccion-0123456789'),
  jwtDuracion: '8h' as const,
  corsOrigen: (process.env.CORS_ORIGIN ?? 'http://localhost:5174').split(',').map((o) => o.trim()).filter(Boolean),
  zonaHoraria: process.env.ZONA_HORARIA ?? 'America/Bogota',
};
