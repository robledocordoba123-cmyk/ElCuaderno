// Política de tratamiento de datos (Ley 1581 de 2012). Se puede leer sin iniciar sesión.
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';
import { Logo } from '../componentes/Marco';

const SECCIONES: [string, string][] = [
  [
    'Quién es responsable',
    'Cada tienda que usa ElCuaderno es la responsable de los datos de sus clientes y de su equipo. ElCuaderno es la herramienta con la que la tienda los guarda: solo los usa para que la aplicación funcione.',
  ],
  [
    'Qué datos se guardan',
    'De los vecinos que fían: nombre, celular (si lo dan), el cupo de fiado, lo que fían y lo que abonan. De la dueña y los cajeros: nombre, correo y lo que registran en la aplicación (ventas, abonos y cambios), con fecha y hora.',
  ],
  [
    'Para qué se usan',
    'Para llevar la cuenta del fiado, saber cuánto debe cada quien, cuadrar la caja del día y dejar constancia de quién hizo cada movimiento. No se venden, no se comparten con terceros y no se usan para publicidad.',
  ],
  [
    'La autorización',
    'La tienda solo puede guardar los datos de un vecino si él lo autoriza. La aplicación lo pide al crear cada cliente y guarda la fecha.',
  ],
  [
    'Sus derechos',
    'Todo vecino puede conocer qué datos tiene la tienda sobre él, pedir que se corrijan y pedir que se borren. Para borrarlos no puede tener deuda pendiente. Al borrarlos se eliminan su nombre y su celular, y sus compras pasadas quedan en la caja sin datos personales.',
  ],
  [
    'Cómo pedirlo',
    'Directamente a la dueña de la tienda, que lo hace desde Fiados. La tienda tiene 15 días hábiles para responder, como dice la ley.',
  ],
  [
    'Seguridad',
    'Las contraseñas se guardan cifradas, la sesión viaja en una cookie que el navegador protege y cada tienda solo ve sus propios datos.',
  ],
];

export function Privacidad() {
  return (
    <div className="min-h-dvh px-4 py-10">
      <article className="mx-auto max-w-2xl rounded-md border-2 border-stone-900 bg-stone-50 p-6 sombra-papel sm:p-10">
        <Logo />
        <p className="mt-8 font-mono text-xs uppercase tracking-[0.2em] text-stone-500">Ley 1581 de 2012 · versión 1.0</p>
        <h1 className="mt-1 text-3xl font-extrabold text-stone-900">Política de tratamiento de datos</h1>
        <div className="mt-6 space-y-5">
          {SECCIONES.map(([titulo, texto]) => (
            <section key={titulo}>
              <h2 className="font-bold text-stone-900">{titulo}</h2>
              <p className="mt-1 text-stone-700">{texto}</p>
            </section>
          ))}
        </div>
        <Link to="/" className="mt-8 inline-flex items-center gap-1 text-sm font-semibold text-stone-900 underline">
          <ArrowLeft size={15} /> Volver a ElCuaderno
        </Link>
      </article>
    </div>
  );
}
