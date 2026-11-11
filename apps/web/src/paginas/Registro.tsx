// Registro de una tienda nueva: la dueña escribe en la primera hoja del cuaderno el nombre de
// su tienda y sus datos. Queda adentro de una vez, con la tienda vacía lista para empezar.
import { registroSchema } from '@elcuaderno/shared';
import { ArrowLeft, BookPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ErrorApi } from '../api/cliente';
import { Logo } from '../componentes/Marco';
import { Aviso, Boton } from '../componentes/ui';
import { useSesion } from '../sesion';
import { Hoja, Renglon } from './Acceso';

const MODO_DEMO = import.meta.env.VITE_MODO_DEMO === 'true';

export function Registro() {
  const { registrar } = useSesion();
  const [datos, setDatos] = useState({ tienda: '', nombre: '', email: '', password: '' });
  const [acepta, setAcepta] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cambiar = (campo: keyof typeof datos) => (e: { target: { value: string } }) => setDatos((d) => ({ ...d, [campo]: e.target.value }));

  async function alEnviar(e: FormEvent) {
    e.preventDefault();
    const validacion = registroSchema.safeParse({ ...datos, aceptaPolitica: acepta });
    if (!validacion.success) {
      setErrores(Object.fromEntries(validacion.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrores({});
    setError('');
    setEnviando(true);
    try {
      await registrar(validacion.data);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo registrar la tienda');
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Hoja>
          <div className="flex items-start justify-between gap-3">
            <Logo />
            <p className="hidden rotate-2 font-mano text-xl leading-none text-stone-500 sm:block">Hoja n.º 1</p>
          </div>

          <h1 className="mt-8 font-mano text-5xl font-bold leading-none text-stone-900">Estrena tu cuaderno</h1>
          <p className="mt-2 text-sm text-stone-600">Escribe el nombre de tu tienda y tus datos. Después agregas productos y cajeros.</p>

          <form onSubmit={alEnviar} className="mt-6 space-y-5" noValidate>
            <Renglon etiqueta="Nombre de la tienda" autoComplete="organization" value={datos.tienda} onChange={cambiar('tienda')} error={errores.tienda} />
            <Renglon etiqueta="Tu nombre" autoComplete="name" value={datos.nombre} onChange={cambiar('nombre')} error={errores.nombre} />
            <Renglon etiqueta="Correo" type="email" autoComplete="email" value={datos.email} onChange={cambiar('email')} error={errores.email} />
            <Renglon
              etiqueta="Contraseña (8 o más, con letras y números)"
              type="password"
              autoComplete="new-password"
              value={datos.password}
              onChange={cambiar('password')}
              error={errores.password}
            />

            <label className="flex items-start gap-3 text-sm text-stone-700">
              <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} className="mt-0.5 h-5 w-5 accent-stone-900" />
              <span>
                Acepto la{' '}
                <Link to="/privacidad" className="font-semibold underline">
                  política de tratamiento de datos
                </Link>{' '}
                (Ley 1581 de 2012).
                {errores.aceptaPolitica && <span className="mt-1 block text-xs font-medium text-margen-tinta">{errores.aceptaPolitica}</span>}
              </span>
            </label>

            {MODO_DEMO && (
              <Aviso tipo="info">Esto es una demostración: las tiendas que se registran aquí se borran solas a los 7 días.</Aviso>
            )}
            {error && <Aviso>{error}</Aviso>}
            <Boton type="submit" disabled={enviando} className="w-full">
              <BookPlus size={18} /> {enviando ? 'Abriendo el cuaderno…' : 'Registrar mi tienda'}
            </Boton>
          </form>

          <Link to="/" className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-stone-600 hover:text-stone-900">
            <ArrowLeft size={15} /> Ya tengo cuenta
          </Link>
        </Hoja>
      </div>
    </div>
  );
}
