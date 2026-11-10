import { loginSchema } from '@elcuaderno/shared';
import { Coffee, LogIn, Store, UserRound } from 'lucide-react';
import { useEffect, useState, type ButtonHTMLAttributes, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ErrorApi } from '../api/cliente';
import { Logo } from '../componentes/Marco';
import { Aviso, Boton } from '../componentes/ui';
import { useSesion } from '../sesion';

const MODO_DEMO = import.meta.env.VITE_MODO_DEMO === 'true';
const DEMO = { dueno: 'rosa@elcuaderno.co', cajero: 'cajero@elcuaderno.co', clave: 'Demo2026!' };

// El acceso es una hoja del cuaderno: espiral arriba, margen rojo, renglones y letra a mano.
// Las cuentas de demostración son dos notas adhesivas pegadas a la hoja.

// El plan gratuito del hosting apaga la API tras un rato sin uso y tarda cerca
// de un minuto en encender: si la respuesta se demora, se explica por qué.
const MS_ANTES_DE_AVISAR = 4000;

export function Acceso() {
  const { entrar } = useSesion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [despertando, setDespertando] = useState(false);

  useEffect(() => {
    if (!enviando) return undefined;
    const temporizador = setTimeout(() => setDespertando(true), MS_ANTES_DE_AVISAR);
    return () => {
      clearTimeout(temporizador);
      setDespertando(false);
    };
  }, [enviando]);

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
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Hoja>

          <div className="flex items-start justify-between gap-3">
            <Logo />
            <p className="hidden -rotate-3 font-mano text-xl leading-none text-stone-500 sm:block">“Anótemelo, vecina”</p>
          </div>

          <h1 className="mt-8 font-mano text-5xl font-bold leading-none text-stone-900">Abre tu cuaderno</h1>
          <p className="mt-2 text-sm text-stone-600">Ventas, inventario y fiados de la tienda, desde el celular.</p>

          <form onSubmit={alEnviar} className="mt-6 space-y-5" noValidate>
            <Renglon etiqueta="Correo" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errores.email} />
            <Renglon
              etiqueta="Contraseña"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errores.password}
            />
            {despertando && (
              <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-sm text-stone-800">
                <Coffee size={16} className="mt-0.5 shrink-0" aria-hidden />
                El servidor estaba en reposo y está encendiendo. La primera entrada puede tardar hasta un minuto.
              </p>
            )}
            {error && <Aviso>{error}</Aviso>}
            <Boton type="submit" disabled={enviando} className="w-full">
              <LogIn size={18} /> {enviando ? 'Abriendo…' : 'Entrar'}
            </Boton>
          </form>

          <p className="mt-6 text-sm text-stone-700">
            ¿Tu tienda todavía no tiene cuaderno?{' '}
            <Link to="/registro" className="font-bold underline decoration-amber-400 decoration-2 underline-offset-2 hover:text-stone-900">
              Regístrala gratis
            </Link>
          </p>
          <p className="mt-3 text-xs text-stone-500">
            <Link to="/privacidad" className="underline hover:text-stone-900">
              Política de tratamiento de datos
            </Link>
          </p>
        </Hoja>

        {MODO_DEMO && (
          <section className="mt-6 px-2" aria-label="Cuentas de demostración">
            <p className="font-mano text-2xl leading-none text-stone-700">¿Solo quieres probarla?</p>
            <p className="mb-3 mt-1 text-xs text-stone-500">Entra a la Tienda Doña Rosa, con una semana de ventas de ejemplo.</p>
            <div className="grid grid-cols-2 gap-4">
              <NotaAdhesiva color="bg-amber-200" giro="-rotate-2" disabled={enviando} onClick={() => void ingresar({ email: DEMO.dueno, password: DEMO.clave })}>
                <Store size={18} /> Como dueña
              </NotaAdhesiva>
              <NotaAdhesiva color="bg-[#fbd9cf]" giro="rotate-2" disabled={enviando} onClick={() => void ingresar({ email: DEMO.cajero, password: DEMO.clave })}>
                <UserRound size={18} /> Como cajero
              </NotaAdhesiva>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/** Hoja del cuaderno: espiral arriba, margen rojo y renglones. La usan el acceso y el registro. */
export function Hoja({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Espiral: los aros pasan por encima del borde de la hoja. */}
      <div className="relative z-10 flex justify-around px-8" aria-hidden>
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="h-7 w-3 translate-y-3 rounded-full border-[3px] border-stone-900 bg-stone-100" />
        ))}
      </div>

      <main className="hoja relative overflow-hidden rounded-md border-2 border-stone-900 bg-stone-50 pb-8 pl-14 pr-6 pt-10 shadow-[6px_6px_0_0_var(--color-stone-900)] sm:pl-16 sm:pr-10">
        <span className="absolute inset-y-0 left-10 w-px bg-margen sm:left-12" aria-hidden />
      {children}
      </main>
    </>
  );
}

/** Campo escrito sobre el renglón: sin caja, solo la línea, como en el papel. */
export function Renglon({ etiqueta, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; error?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-stone-500">{etiqueta}</span>
      <input
        {...props}
        aria-invalid={Boolean(error)}
        className={`w-full border-0 border-b-2 bg-transparent px-0 py-1.5 text-lg text-stone-900 outline-none transition focus:border-stone-900 ${
          error ? 'border-margen' : 'border-stone-300'
        }`}
      />
      {error && <span className="mt-1 block text-xs font-medium text-margen">{error}</span>}
    </label>
  );
}

/** Botón con forma de nota adhesiva pegada al cuaderno. */
function NotaAdhesiva({
  color,
  giro,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { color: string; giro: string }) {
  return (
    <button
      type="button"
      {...props}
      className={`${color} ${giro} relative flex min-h-20 flex-col items-start justify-end gap-1 px-4 pb-3 pt-6 text-left text-sm font-bold text-stone-900 shadow-[2px_4px_0_0_rgb(27_35_64/0.18)] transition hover:rotate-0 hover:-translate-y-0.5 disabled:opacity-50`}
    >
      {/* Cinta que la pega a la hoja */}
      <span className="absolute -top-2 left-1/2 h-4 w-12 -translate-x-1/2 rotate-2 bg-stone-50/70" aria-hidden />
      {children}
    </button>
  );
}
