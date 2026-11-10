// Cuentas de la tienda de demostración. Viven aparte para que la API las reconozca
// (no se pueden desactivar ni cambiarles la clave) sin cargar el script que siembra la demo.
export const DEMO = {
  tienda: 'Tienda Doña Rosa',
  dueno: { email: 'rosa@elcuaderno.co', nombre: 'Rosa (demo)' },
  cajero: { email: 'cajero@elcuaderno.co', nombre: 'Santiago (demo)' },
  password: 'Demo2026!',
};

export const esCuentaDemo = (email: string) => email === DEMO.dueno.email || email === DEMO.cajero.email;

/** Las tiendas que la gente registra para probar la demo se borran solas pasado este tiempo. */
export const DIAS_TIENDAS_DE_PRUEBA = 7;
