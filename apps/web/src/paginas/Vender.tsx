// Pantalla principal del mostrador: tocar productos para agregarlos, escoger cómo paga y cobrar.
import { formatearPesos, ventaSchema, type Cliente, type MedioDePago, type Producto, type Venta } from '@elcuaderno/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api, ErrorApi } from '../api/cliente';
import { Aviso, Boton, Cargando, Encabezado } from '../componentes/ui';

const MEDIOS: { valor: MedioDePago; texto: string }[] = [
  { valor: 'EFECTIVO', texto: 'Efectivo' },
  { valor: 'NEQUI', texto: 'Nequi' },
  { valor: 'FIADO', texto: 'Fiado' },
];

export function Vender() {
  const queryClient = useQueryClient();
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
    <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-6">
      <section>
        <Encabezado titulo="Vender" detalle="Toca un producto para agregarlo" />
        <label className="relative mb-4 block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto…"
            aria-label="Buscar producto"
            className="w-full rounded-xl border border-stone-200 bg-white py-3 pl-10 pr-3 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
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
                  <button
                    onClick={() => cambiar(p.id, 1)}
                    disabled={agotado || enCarrito >= p.stock}
                    className={`relative flex h-full w-full flex-col rounded-2xl border bg-white p-3 text-left shadow-sm transition active:scale-[.98] disabled:opacity-50 ${
                      enCarrito ? 'border-amber-400 ring-2 ring-amber-200' : 'border-stone-200 hover:border-amber-300'
                    }`}
                  >
                    {enCarrito > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-stone-950">
                        {enCarrito}
                      </span>
                    )}
                    <span className="line-clamp-2 text-sm font-medium text-stone-800">{p.nombre}</span>
                    <span className="mt-auto pt-2 text-base font-bold text-stone-900">{formatearPesos(p.precio)}</span>
                    <span className={`text-xs ${p.bajoStock ? 'font-medium text-red-600' : 'text-stone-400'}`}>
                      {agotado ? 'Agotado' : `Quedan ${p.stock}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <aside className="mt-6 lg:mt-0">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm lg:sticky lg:top-8">
          <h2 className="mb-3 flex items-center gap-2 font-bold text-stone-900">
            <ShoppingCart size={18} /> Venta actual
          </h2>

          {ultimaVenta && (
            <div className="mb-3">
              <Aviso tipo="exito">
                Venta #{ultimaVenta.id} registrada por {formatearPesos(ultimaVenta.total)}
                {ultimaVenta.cliente ? ` · fiado a ${ultimaVenta.cliente}` : ''}.
              </Aviso>
            </div>
          )}

          {lineas.length === 0 ? (
            <p className="py-6 text-center text-sm text-stone-400">Todavía no hay productos.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {lineas.map(({ producto, cantidad }) => (
                <li key={producto.id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-800">{producto.nombre}</p>
                    <p className="text-xs text-stone-500">{formatearPesos(producto.precio * cantidad)}</p>
                  </div>
                  <button onClick={() => cambiar(producto.id, -1)} className="rounded-lg border border-stone-200 p-1.5" aria-label={`Quitar uno de ${producto.nombre}`}>
                    {cantidad === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{cantidad}</span>
                  <button
                    onClick={() => cambiar(producto.id, 1)}
                    disabled={cantidad >= producto.stock}
                    className="rounded-lg border border-stone-200 p-1.5 disabled:opacity-40"
                    aria-label={`Agregar uno de ${producto.nombre}`}
                  >
                    <Plus size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1" role="radiogroup" aria-label="Forma de pago">
            {MEDIOS.map((m) => (
              <button
                key={m.valor}
                role="radio"
                aria-checked={medio === m.valor}
                onClick={() => setMedio(m.valor)}
                className={`rounded-lg py-2 text-sm font-semibold transition ${medio === m.valor ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}
              >
                {m.texto}
              </button>
            ))}
          </div>

          {medio === 'FIADO' && (
            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-medium text-stone-700">¿A quién se le fía?</span>
              <select
                value={clienteId ?? ''}
                onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5"
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
            <div className="mt-3">
              <Aviso>{error}</Aviso>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-stone-500">Total</span>
            <span className="text-2xl font-bold text-stone-900">{formatearPesos(total)}</span>
          </div>
          <Boton onClick={alCobrar} disabled={lineas.length === 0 || cobrar.isPending} className="mt-3 w-full py-3 text-base">
            {cobrar.isPending ? 'Registrando…' : medio === 'FIADO' ? 'Anotar en el cuaderno' : 'Cobrar'}
          </Boton>
        </div>
      </aside>
    </div>
  );
}
