// Cliente HTTP: agrega el token, convierte los errores de la API en mensajes claros
// y cierra la sesión si el token venció.
import type { Sesion } from '@elcuaderno/shared';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) || '/api';
const CLAVE_SESION = 'elcuaderno.sesion';

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
  const token = sesionGuardada()?.token;
  let respuesta: Response;
  try {
    respuesta = await fetch(BASE + ruta, {
      method: opciones.metodo ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
    });
  } catch {
    throw new ErrorApi(0, 'No hay conexión con el servidor. Si es la demo, puede estar despertando: intenta en unos segundos.');
  }

  const texto = await respuesta.text();
  const datos = texto ? JSON.parse(texto) : null;
  if (!respuesta.ok) {
    if (respuesta.status === 401 && token) alVencer();
    const mensaje = Array.isArray(datos?.message) ? datos.message.join(', ') : datos?.message;
    throw new ErrorApi(respuesta.status, mensaje ?? 'Algo salió mal', datos?.errores ?? {});
  }
  return datos as T;
}
