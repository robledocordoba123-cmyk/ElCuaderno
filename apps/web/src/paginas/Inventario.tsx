// Inventario: todos pueden ver el stock; solo la dueña crea, edita y registra entradas de mercancía.
import { entradaStockSchema, formatearPesos, productoSchema, type Producto, type ProductoDto } from '@elcuaderno/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, PackagePlus, Pencil, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, ErrorApi } from '../api/cliente';
import { Aviso, Boton, Campo, Cargando, Encabezado, Modal, Tarjeta } from '../componentes/ui';
import { useSesion } from '../sesion';

type Formulario = Record<keyof ProductoDto, string>;
const VACIO: Formulario = { nombre: '', precio: '', costo: '', stock: '', stockMinimo: '' };

export function Inventario() {
  const { esDueno } = useSesion();
  const [soloBajos, setSoloBajos] = useState(false);
  const [editando, setEditando] = useState<Producto | 'nuevo' | null>(null);
  const [entrada, setEntrada] = useState<Producto | null>(null);
  const productos = useQuery({ queryKey: ['productos'], queryFn: () => api<Producto[]>('/productos') });

  const lista = (productos.data ?? []).filter((p) => !soloBajos || p.bajoStock);
  const bajos = (productos.data ?? []).filter((p) => p.bajoStock).length;

  return (
    <>
      <Encabezado
        titulo="Inventario"
        detalle={`${productos.data?.length ?? 0} productos · ${bajos} por acabarse`}
        accion={
          esDueno && (
            <Boton onClick={() => setEditando('nuevo')}>
              <Plus size={18} /> <span className="hidden sm:inline">Nuevo producto</span>
            </Boton>
          )
        }
      />

      <div className="mb-4 flex gap-2">
        <Boton variante={soloBajos ? 'secundario' : 'principal'} onClick={() => setSoloBajos(false)}>
          Todos
        </Boton>
        <Boton variante={soloBajos ? 'principal' : 'secundario'} onClick={() => setSoloBajos(true)}>
          <AlertTriangle size={16} /> Se están acabando ({bajos})
        </Boton>
      </div>

      {productos.isLoading ? (
        <Cargando />
      ) : (
        <ul className="space-y-2">
          {lista.map((p) => (
            <li key={p.id}>
              <Tarjeta className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-stone-900">{p.nombre}</p>
                  <p className="text-sm text-stone-500">
                    {formatearPesos(p.precio)}
                    {esDueno && ` · costo ${formatearPesos(p.costo)} · gana ${formatearPesos(p.precio - p.costo)}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-mono text-lg font-bold ${p.bajoStock ? 'text-margen' : 'text-stone-900'}`}>{p.stock}</p>
                  <p className="text-xs text-stone-400">mín. {p.stockMinimo}</p>
                </div>
                {esDueno && (
                  <div className="flex gap-1">
                    <button onClick={() => setEntrada(p)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label={`Entrada de ${p.nombre}`}>
                      <PackagePlus size={18} />
                    </button>
                    <button onClick={() => setEditando(p)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label={`Editar ${p.nombre}`}>
                      <Pencil size={18} />
                    </button>
                  </div>
                )}
              </Tarjeta>
            </li>
          ))}
          {lista.length === 0 && <p className="py-10 text-center text-stone-400">Nada por aquí.</p>}
        </ul>
      )}

      {editando && <FormularioProducto producto={editando === 'nuevo' ? null : editando} alCerrar={() => setEditando(null)} />}
      {entrada && <FormularioEntrada producto={entrada} alCerrar={() => setEntrada(null)} />}
    </>
  );
}

function FormularioProducto({ producto, alCerrar }: { producto: Producto | null; alCerrar: () => void }) {
  const queryClient = useQueryClient();
  const [valores, setValores] = useState<Formulario>(
    producto
      ? { nombre: producto.nombre, precio: String(producto.precio), costo: String(producto.costo), stock: String(producto.stock), stockMinimo: String(producto.stockMinimo) }
      : VACIO,
  );
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const guardar = useMutation({
    mutationFn: (datos: ProductoDto) =>
      api<Producto>(producto ? `/productos/${producto.id}` : '/productos', { metodo: producto ? 'PUT' : 'POST', cuerpo: datos }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['productos'] });
      alCerrar();
    },
    onError: (e) => {
      if (e instanceof ErrorApi) {
        setErrores(e.errores);
        setError(Object.keys(e.errores).length ? '' : e.message);
      }
    },
  });

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    // El mismo esquema que valida la API: los errores salen antes de enviar.
    const numero = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(/\./g, '')));
    const resultado = productoSchema.safeParse({
      nombre: valores.nombre,
      precio: numero(valores.precio),
      costo: numero(valores.costo),
      stock: numero(valores.stock),
      stockMinimo: numero(valores.stockMinimo),
    });
    if (!resultado.success) {
      setErrores(Object.fromEntries(resultado.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrores({});
    guardar.mutate(resultado.data);
  }

  const campo = (nombre: keyof Formulario, etiqueta: string, tipo = 'number') => (
    <Campo
      etiqueta={etiqueta}
      type={tipo}
      inputMode={tipo === 'number' ? 'numeric' : undefined}
      value={valores[nombre]}
      onChange={(e) => setValores({ ...valores, [nombre]: e.target.value })}
      error={errores[nombre]}
    />
  );

  return (
    <Modal titulo={producto ? 'Editar producto' : 'Nuevo producto'} abierto alCerrar={alCerrar}>
      <form onSubmit={alEnviar} className="space-y-3" noValidate>
        {campo('nombre', 'Nombre', 'text')}
        <div className="grid grid-cols-2 gap-3">
          {campo('precio', 'Precio de venta')}
          {campo('costo', 'Costo')}
          {campo('stock', 'Stock')}
          {campo('stockMinimo', 'Stock mínimo')}
        </div>
        {error && <Aviso>{error}</Aviso>}
        <Boton type="submit" disabled={guardar.isPending} className="w-full">
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Boton>
      </form>
    </Modal>
  );
}

function FormularioEntrada({ producto, alCerrar }: { producto: Producto; alCerrar: () => void }) {
  const queryClient = useQueryClient();
  const [cantidad, setCantidad] = useState('');
  const [error, setError] = useState('');
  const guardar = useMutation({
    mutationFn: (datos: { cantidad: number }) => api<Producto>(`/productos/${producto.id}/entrada`, { metodo: 'PATCH', cuerpo: datos }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['productos'] });
      alCerrar();
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo guardar'),
  });

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    const resultado = entradaStockSchema.safeParse({ cantidad: Number(cantidad) });
    if (!resultado.success) return setError(resultado.error.issues[0].message);
    guardar.mutate(resultado.data);
  }

  return (
    <Modal titulo={`Llegó mercancía: ${producto.nombre}`} abierto alCerrar={alCerrar}>
      <form onSubmit={alEnviar} className="space-y-3" noValidate>
        <p className="text-sm text-stone-500">Hoy hay {producto.stock}. ¿Cuántas unidades llegaron?</p>
        <Campo etiqueta="Unidades que llegaron" type="number" inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value)} error={error} autoFocus />
        <Boton type="submit" disabled={guardar.isPending} className="w-full">
          Sumar al inventario
        </Boton>
      </form>
    </Modal>
  );
}
