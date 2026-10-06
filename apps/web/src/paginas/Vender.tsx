// Pantalla principal del mostrador: tocar productos para agregarlos, escoger cómo paga y cobrar.
import { formatearPesos, ventaSchema, type Cliente, type MedioDePago, type Producto, type Venta } from '@elcuaderno/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api, ErrorApi } from '../api/cliente';
import { Aviso, Boton, Cargando, Encabezado } from '../componentes/ui';
import { useSesion } from '../sesion';

const MEDIOS: { valor: MedioDePago; texto: string }[] = [
  { valor: 'EFECTIVO', texto: 'Efectivo' },
  { valor: 'NEQUI', texto: 'Nequi' },
  { valor: 'FIADO', texto: 'Fiado' },
];

export function Vender() {
  const queryClient = useQueryClient();
  const { sesion } = useSesion();
  const [busqueda, setBusqueda] = useState('');
  const [carrito, setCarrito] = useState<Map<number, number>>(new Map());
  const [medio, setMedio] = useState<MedioDePago>('EFECTIVO');
  const [clienteId, setClienteId] = useState<number | undefined>();
  const [error, setError] = useState('');
  const [ultimaVenta, setUltimaVenta] = useState<Venta | null>(null);

  const productos = useQuery({ queryKey: ['productos'], queryFn: () => api<Producto[]>('/productos') });
  const clientes = useQuery({ queryKey: ['clientes'], queryFn: () => api<Cliente[]>('/clientes'), enabled: medio === 'FIADO' });

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (productos.data ?? []).filter((p) => !q || p.nombre.toLowerCase().includes(q));
  }, [productos.data, busqueda]);

  const lineas = [...carrito].map(([id, cantidad]) => ({ producto: productos.data?.find((p) => p.id === id)!, cantidad })).filter((l) => l.producto);
  const total = lineas.reduce((s, l) => s + l.producto.precio * l.cantidad, 0);
  const cliente = clientes.data?.find((c) => c.id === clienteId);

  const cambiar = (id: number, delta: number) => {
    setUltimaVenta(null);
    setCarrito((actual) => {
      const nuevo = new Map(actual);
      const cantidad = (nuevo.get(id) ?? 0) + delta;
      const stock = productos.data?.find((p) => p.id === id)?.stock ?? 0;
      if (cantidad <= 0) nuevo.delete(id);
      else nuevo.set(id, Math.min(cantidad, stock));
      return nuevo;
    });
  };

  const cobrar = useMutation({
    mutationFn: (cuerpo: unknown) => api<Venta>('/ventas', { metodo: 'POST', cuerpo }),
    onSuccess: (venta) => {
      setUltimaVenta(venta);
      setCarrito(new Map());
      setClienteId(undefined);
      setMedio('EFECTIVO');
      void queryClient.invalidateQueries({ queryKey: ['productos'] });
      void queryClient.invalidateQueries({ queryKey: ['clientes'] });
      void queryClient.invalidateQueries({ queryKey: ['caja'] });
    },
    onError: (e) => setError(e instanceof ErrorApi ? e.message : 'No se pudo registrar la venta'),
  });

  function alCobrar() {
    setError('');
    const venta = { medio, clienteId: medio === 'FIADO' ? clienteId : undefined, items: lineas.map((l) => ({ productoId: l.producto.id, cantidad: l.cantidad })) };
    const validacion = ventaSchema.safeParse(venta);
    if (!validacion.success) {
      setError(validacion.error.issues[0].message);
      return;
    }
    if (medio === 'FIADO' && cliente && total > cliente.disponible) {
      setError(`${cliente.nombre} solo tiene ${formatearPesos(cliente.disponible)} de cupo disponible`);
      return;
    }
    cobrar.mutate(validacion.data);
  }

  return (
    <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-8">
      <section>
        <Encabezado titulo="Vender" detalle="Toca un producto para agregarlo" />
        <label className="relative mb-5 block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" size={18} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto…"
            aria-label="Buscar producto"
            className="w-full rounded-lg border-2 border-stone-300 bg-stone-50 py-3 pl-10 pr-3 outline-none transition focus:border-stone-900 focus:bg-white"
          />
        </label>

        {productos.isLoading ? (
          <Cargando />
        ) : productos.isError ? (
          <Aviso>{(productos.error as Error).message}</Aviso>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visibles.map((p) => {
              const enCarrito = carrito.get(p.id) ?? 0;
              const agotado = p.stock === 0;
              return (
                <li key={p.id}>
                  {/* Cada producto es una etiqueta de precio, con su huequito para colgarla. */}
                  <button
                    onClick={() => cambiar(p.id, 1)}
                    disabled={agotado || enCarrito >= p.stock}
                    className={`relative flex h-full w-full flex-col rounded-lg border-2 p-3 pt-4 text-left transition active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:opacity-50 ${
                      enCarrito ? 'border-stone-900 bg-amber-200 sombra-tinta' : 'border-stone-300 bg-stone-50 sombra-papel hover:border-stone-900'
                    }`}
                  >
                    <span className="absolute left-3 top-2 h-1.5 w-1.5 rounded-full border border-stone-400 bg-stone-100" aria-hidden />
                    {enCarrito > 0 && (
                      <span className="absolute -right-2 -top-2 grid h-7 min-w-7 place-items-center rounded-full border-2 border-stone-900 bg-stone-900 px-1.5 font-mono text-xs font-bold text-amber-300">
                        {enCarrito}
                      </span>
                    )}
                    <span className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-stone-800">{p.nombre}</span>
                    <span className="mt-auto pt-2 font-mono text-lg font-bold tracking-tight text-stone-900">{formatearPesos(p.precio)}</span>
                    <span className={`text-xs ${p.bajoStock ? 'font-semibold text-margen' : 'text-stone-500'}`}>
                      {agotado ? 'Agotado' : `Quedan ${p.stock}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <aside id="venta" className="mt-8 scroll-mt-24 lg:mt-0">
        {/* La venta actual es la tirilla de la caja registradora. */}
        <div className="drop-shadow-[0_8px_16px_rgb(27_35_64/0.16)] lg:sticky lg:top-24">
          <div className="tirilla bg-white px-5 pb-8 pt-5 font-mono text-sm text-stone-900">
            <div className="text-center">
              <p className="flex items-center justify-center gap-2 font-sans text-base font-extrabold">
                <ShoppingCart size={17} /> Venta actual
              </p>
              <p className="text-xs uppercase tracking-wider text-stone-500">{sesion?.usuario.tienda}</p>
            </div>
            <div className="my-3 border-t-2 border-dashed border-stone-300" />

            {ultimaVenta && (
              <div className="mb-3 font-sans">
                <Aviso tipo="exito">
                  Venta #{ultimaVenta.id} registrada por {formatearPesos(ultimaVenta.total)}
                  {ultimaVenta.cliente ? ` · fiado a ${ultimaVenta.cliente}` : ''}.
                </Aviso>
              </div>
            )}

            {lineas.length === 0 ? (
              <p className="py-6 text-center text-xs uppercase tracking-wider text-stone-400">Todavía no hay productos</p>
            ) : (
              <ul className="space-y-2.5">
                {lineas.map(({ producto, cantidad }) => (
                  <li key={producto.id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{producto.nombre}</p>
                      <p className="text-xs text-stone-500">
                        {cantidad} x {formatearPesos(producto.precio)}
                      </p>
                    </div>
                    <span className="text-right text-[13px] font-bold">{formatearPesos(producto.precio * cantidad)}</span>
                    <div className="flex items-center rounded-md border border-stone-300">
                      <button onClick={() => cambiar(producto.id, -1)} className="p-1.5 hover:bg-stone-100" aria-label={`Quitar uno de ${producto.nombre}`}>
                        {cantidad === 1 ? <Trash2 size={13} /> : <Minus size={13} />}
                      </button>
                      <button
                        onClick={() => cambiar(producto.id, 1)}
                        disabled={cantidad >= producto.stock}
                        className="border-l border-stone-300 p-1.5 hover:bg-stone-100 disabled:opacity-40"
                        aria-label={`Agregar uno de ${producto.nombre}`}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="my-4 border-t-2 border-dashed border-stone-300" />

            <div className="grid grid-cols-3 gap-1.5 font-sans" role="radiogroup" aria-label="Forma de pago">
              {MEDIOS.map((m) => (
                <button
                  key={m.valor}
                  role="radio"
                  aria-checked={medio === m.valor}
                  onClick={() => setMedio(m.valor)}
                  className={`rounded-md border-2 py-1.5 text-sm font-bold transition ${
                    medio === m.valor ? 'border-stone-900 bg-stone-900 text-amber-300' : 'border-stone-200 text-stone-500 hover:border-stone-400'
                  }`}
                >
                  {m.texto}
                </button>
              ))}
            </div>

            {medio === 'FIADO' && (
              <label className="mt-3 block font-sans">
                <span className="mb-1 block text-sm font-semibold text-stone-700">¿A quién se le fía?</span>
                <select
                  value={clienteId ?? ''}
                  onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full rounded-lg border-2 border-stone-300 bg-stone-50 px-3 py-2.5 focus:border-stone-900"
                >
                  <option value="">Escoge el cliente…</option>
                  {clientes.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} · disponible {formatearPesos(c.disponible)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {error && (
              <div className="mt-3 font-sans">
                <Aviso>{error}</Aviso>
              </div>
            )}

            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-xs font-bold uppercase tracking-widest">Total</span>
              <span className="text-3xl font-bold tracking-tight">{formatearPesos(total)}</span>
            </div>
            <Boton onClick={alCobrar} disabled={lineas.length === 0 || cobrar.isPending} className="mt-4 w-full py-3 font-sans text-base">
              {cobrar.isPending ? 'Registrando…' : medio === 'FIADO' ? 'Anotar en el cuaderno' : 'Cobrar'}
            </Boton>
          </div>
        </div>
      </aside>

      {/* En el celular el carrito queda abajo: esta barra lleva a él con un toque. */}
      {lineas.length > 0 && (
        <a
          href="#venta"
          className="fixed inset-x-4 bottom-20 z-20 flex items-center justify-between rounded-lg border-2 border-stone-900 bg-amber-400 px-4 py-3 text-stone-900 sombra-tinta lg:hidden"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingCart size={18} /> {lineas.reduce((s, l) => s + l.cantidad, 0)} productos
          </span>
          <span className="font-mono font-bold">{formatearPesos(total)} · Ver venta</span>
        </a>
      )}
    </div>
  );
}
