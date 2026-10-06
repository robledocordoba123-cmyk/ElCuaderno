import { loginSchema } from '@elcuaderno/shared';
import { LogIn, Store, UserRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ErrorApi } from '../api/cliente';
import { Logo } from '../componentes/Marco';
import { Aviso, Boton, Campo } from '../componentes/ui';
import { useSesion } from '../sesion';

const MODO_DEMO = import.meta.env.VITE_MODO_DEMO === 'true';
const DEMO = { dueno: 'rosa@elcuaderno.co', cajero: 'cajero@elcuaderno.co', clave: 'Demo2026!' };

export function Acceso() {
  const { entrar } = useSesion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function ingresar(datos: { email: string; password: string }) {
    // Mismo esquema Zod que usa la API: el error aparece antes de enviar.
    const validacion = loginSchema.safeParse(datos);
    if (!validacion.success) {
      setErrores(Object.fromEntries(validacion.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrores({});
    setError('');
    setEnviando(true);
    try {
      await entrar(validacion.data);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo iniciar sesión');
    } finally {
      setEnviando(false);
    }
  }

  const alEnviar = (e: FormEvent) => {
    e.preventDefault();
    void ingresar({ email, password });
  };

  return (
    <div className="grid min-h-dvh md:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Logo />
          <h1 className="mt-10 text-4xl font-extrabold tracking-tight text-stone-900">Abre tu cuaderno</h1>
          <p className="mt-1 text-stone-500">Ventas, inventario y fiados de la tienda, desde el celular.</p>

          <form onSubmit={alEnviar} className="mt-8 space-y-4" noValidate>
            <Campo etiqueta="Correo" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errores.email} />
            <Campo
              etiqueta="Contraseña"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errores.password}
            />
            {error && <Aviso>{error}</Aviso>}
            <Boton type="submit" disabled={enviando} className="w-full">
              <LogIn size={18} /> {enviando ? 'Entrando…' : 'Entrar'}
            </Boton>
          </form>

          {MODO_DEMO && (
            <div className="mt-8 rounded-lg border-2 border-dashed border-stone-400 bg-amber-100 p-4">
              <p className="text-sm font-bold text-stone-900">¿Solo quieres probarla?</p>
              <p className="mb-3 text-xs text-stone-600">Entra a la Tienda Doña Rosa con una semana de ventas de ejemplo.</p>
              <div className="grid grid-cols-2 gap-2">
                <Boton variante="secundario" disabled={enviando} onClick={() => void ingresar({ email: DEMO.dueno, password: DEMO.clave })}>
                  <Store size={16} /> Como dueña
                </Boton>
                <Boton variante="secundario" disabled={enviando} onClick={() => void ingresar({ email: DEMO.cajero, password: DEMO.clave })}>
                  <UserRound size={16} /> Como cajero
                </Boton>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Portada del cuaderno: tapa de tinta, lomo amarillo, resorte y etiqueta. */}
      <div className="relative hidden overflow-hidden bg-stone-900 md:block">
        <div className="absolute inset-y-0 left-0 w-10 bg-amber-400" />
        <div className="absolute inset-y-0 left-10 flex w-6 flex-col justify-around py-6" aria-hidden>
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className="h-2.5 w-6 rounded-full border-2 border-stone-400 bg-stone-950" />
          ))}
        </div>
        <div className="absolute inset-y-0 right-20 w-3 bg-stone-950/60" aria-hidden />
        <div className="relative flex h-full items-center justify-center p-16 pl-24">
          <div className="w-full max-w-md -rotate-2 rounded-md border-2 border-stone-900 bg-stone-50 p-8 shadow-[6px_6px_0_0_var(--color-amber-400)]">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-stone-500">Tienda de barrio · 2026</p>
            <div className="my-4 border-t-2 border-dashed border-stone-300" />
            <p className="text-3xl font-extrabold leading-tight text-stone-900">
              “Anótemelo en el <span className="bg-amber-300 px-1">cuaderno</span>, vecina.”
            </p>
            <p className="mt-4 text-stone-600">
              Ahora el cuaderno sabe cuánto debe cada quien, qué se está acabando y cuánto se ganó hoy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
