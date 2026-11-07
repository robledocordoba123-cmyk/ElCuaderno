// Cliente HTTP: convierte los errores de la API en mensajes claros y cierra la sesión si venció.
// El token viaja en una cookie httpOnly que pone la API: JavaScript nunca lo ve ni lo guarda.
import type { Sesion } from '@elcuaderno/shared';

// Siempre el mismo origen: en Vercel, /api se reenvía a la API (vercel.json) y en desarrollo
// lo hace el proxy de Vite. Así la cookie es del mismo sitio y puede ser SameSite=Strict.
const BASE = '/api';
// Solo se recuerda quién está (nombre, rol y tienda) para pintar la pantalla al abrir;
// no es un secreto. La API confirma la sesión con /auth/yo.
const CLAVE_SESION = 'elcuaderno.usuario';

// Las versiones anteriores guardaban aquí el token; se borra para que no quede en el navegador.
try {
  localStorage.removeItem('elcuaderno.sesion');
} catch {
  /* Navegación privada. */
}

export class ErrorApi extends Error {
  constructor(
    public status: number,
    mensaje: string,
    public errores: Record<string, string> = {},
  ) {
    super(mensaje);
  }
}

export const sesionGuardada = (): Sesion | null => {
  try {
    const texto = localStorage.getItem(CLAVE_SESION);
    return texto ? (JSON.parse(texto) as Sesion) : null;
  } catch {
    return null;
  }
};

export const guardarSesion = (s: Sesion | null) => {
  try {
    if (s) localStorage.setItem(CLAVE_SESION, JSON.stringify(s));
    else localStorage.removeItem(CLAVE_SESION);
  } catch {
    /* Navegación privada: la sesión solo vive en memoria. */
  }
};

let alVencer: () => void = () => {};
export const cuandoVenzaLaSesion = (fn: () => void) => {
  alVencer = fn;
};

export async function api<T>(ruta: string, opciones: { metodo?: string; cuerpo?: unknown } = {}): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(BASE + ruta, {
      method: opciones.metodo ?? 'GET',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
    });
  } catch {
    throw new ErrorApi(0, 'No hay conexión con el servidor. Si es la demo, puede estar despertando: intenta en unos segundos.');
  }

  const texto = await respuesta.text();
  const datos = texto ? JSON.parse(texto) : null;
  if (!respuesta.ok) {
    if (respuesta.status === 401 && sesionGuardada()) alVencer();
    const mensaje = Array.isArray(datos?.message) ? datos.message.join(', ') : datos?.message;
    throw new ErrorApi(respuesta.status, mensaje ?? 'Algo salió mal', datos?.errores ?? {});
  }
  return datos as T;
}
