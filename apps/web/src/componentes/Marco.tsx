// Estructura de la app: barra superior de tinta con pestañas en computador y barra inferior en el celular.
import { BookOpen, Calculator, LogOut, Package, ShoppingCart } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { useSesion } from '../sesion';

export function Marco() {
  const { sesion, esDueno, salir } = useSesion();
  const enlaces = [
    { a: '/', texto: 'Vender', icono: ShoppingCart },
    { a: '/inventario', texto: 'Inventario', icono: Package },
    { a: '/fiados', texto: 'Fiados', icono: BookOpen },
    ...(esDueno ? [{ a: '/caja', texto: 'Caja', icono: Calculator }] : []),
  ];

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 bg-stone-900 text-stone-50">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 md:px-8">
          <div className="py-3">
            <Logo claro />
          </div>

          {/* Pestañas como las de un cuaderno: la activa se "pega" a la hoja. */}
          <nav className="hidden self-end md:flex md:gap-1">
            {enlaces.map(({ a, texto, icono: Icono }) => (
              <NavLink
                key={a}
                to={a}
                end
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-t-lg px-4 pb-2.5 pt-2 text-sm font-semibold transition ${
                    isActive ? 'bg-stone-100 text-stone-900' : 'text-stone-300 hover:bg-stone-800 hover:text-stone-50'
                  }`
                }
              >
                <Icono size={16} /> {texto}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <div className="hidden text-right leading-tight sm:block">
              <p className="font-semibold">{sesion?.usuario.nombre}</p>
              <p className="text-xs text-stone-400">
                {sesion?.usuario.rol === 'DUENO' ? 'Dueña' : 'Cajero'} · {sesion?.usuario.tienda}
              </p>
            </div>
            <button
              onClick={salir}
              className="rounded-lg p-2 text-stone-300 transition hover:bg-stone-800 hover:text-stone-50"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
        <div className="h-1 bg-amber-400" />
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-40 pt-6 md:px-8 md:pb-12 md:pt-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t-2 border-stone-900 bg-stone-50 pb-[env(safe-area-inset-bottom)] md:hidden">
        {enlaces.map(({ a, texto, icono: Icono }) => (
          <NavLink
            key={a}
            to={a}
            end
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${
                isActive ? 'bg-amber-300 text-stone-900' : 'text-stone-500'
              }`
            }
          >
            <Icono size={22} /> {texto}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function Logo({ claro = false }: { claro?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span className={`text-xl font-extrabold tracking-tight ${claro ? 'text-stone-50' : 'text-stone-900'}`}>
        El
        <span className={claro ? 'text-amber-400' : 'bg-amber-300 px-0.5'}>Cuaderno</span>
      </span>
    </div>
  );
}
