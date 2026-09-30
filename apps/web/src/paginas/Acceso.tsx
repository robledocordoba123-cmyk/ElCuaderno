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
          <h1 className="mt-10 text-3xl font-bold tracking-tight text-stone-900">Abre tu cuaderno</h1>
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
            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">¿Solo quieres probarla?</p>
              <p className="mb-3 text-xs text-amber-800">Entra a la Tienda Doña Rosa con una semana de ventas de ejemplo.</p>
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

      <div className="relative hidden overflow-hidden bg-amber-400 md:block">
        {/* Renglones de cuaderno */}
        <div
          className="absolute inset-0 opacity-60"
          style={{ backgroundImage: 'repeating-linear-gradient(transparent 0 38px, rgba(120,53,15,.25) 38px 40px)' }}
        />
        <div className="absolute inset-y-0 left-16 w-0.5 bg-red-500/60" />
        <div className="relative flex h-full flex-col justify-end p-12 text-stone-950">
          <p className="max-w-md text-3xl font-bold leading-tight">"Anótemelo en el cuaderno, vecina."</p>
          <p className="mt-3 max-w-md text-stone-800">
            Ahora el cuaderno sabe cuánto debe cada quien, qué se está acabando y cuánto se ganó hoy.
          </p>
        </div>
      </div>
    </div>
  );
}
