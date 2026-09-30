// Estructura de la app: barra lateral en computador y barra inferior en el celular.
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
    <div className="min-h-dvh bg-stone-100 md:flex">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-stone-200 bg-white p-4 md:flex">
        <Logo />
        <nav className="mt-8 space-y-1">
          {enlaces.map(({ a, texto, icono: Icono }) => (
            <NavLink
              key={a}
              to={a}
              end
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-amber-100 text-amber-900' : 'text-stone-600 hover:bg-stone-100'
                }`
              }
            >
              <Icono size={18} /> {texto}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-stone-100 pt-4 text-sm">
          <p className="font-semibold text-stone-800">{sesion?.usuario.nombre}</p>
          <p className="text-stone-500">
            {sesion?.usuario.rol === 'DUENO' ? 'Dueña' : 'Cajero'} · {sesion?.usuario.tienda}
          </p>
          <button onClick={salir} className="mt-3 flex items-center gap-2 text-stone-500 hover:text-stone-800">
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <Logo />
        <button onClick={salir} className="rounded-lg p-2 text-stone-500" aria-label="Cerrar sesión">
          <LogOut size={18} />
        </button>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-40 pt-5 md:px-8 md:pb-10 md:pt-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {enlaces.map(({ a, texto, icono: Icono }) => (
          <NavLink
            key={a}
            to={a}
            end
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${isActive ? 'text-amber-600' : 'text-stone-500'}`
            }
          >
            <Icono size={22} /> {texto}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span className="text-lg font-bold tracking-tight text-stone-900">
        El<span className="text-amber-600">Cuaderno</span>
      </span>
    </div>
  );
}
