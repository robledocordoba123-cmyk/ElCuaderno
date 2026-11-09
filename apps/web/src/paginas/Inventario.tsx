// Inventario: todos pueden ver el stock; solo la dueña crea, edita y registra entradas de mercancía.
import {
  entradaStockSchema,
  formatearCantidad,
  formatearPesos,
  productoSchema,
  type EntradaInventario,
  type Producto,
  type ProductoDto,
} from '@elcuaderno/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, PackagePlus, Pencil, Plus, Scale } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, ErrorApi } from '../api/cliente';
import { Aviso, Boton, Campo, Cargando, Encabezado, Modal, Tarjeta } from '../componentes/ui';
import { useSesion } from '../sesion';

type Formulario = Record<Exclude<keyof ProductoDto, 'porPeso'>, string>;
const VACIO: Formulario = { nombre: '', precio: '', costo: '', stock: '', stockMinimo: '' };

/** Por peso, la dueña escribe kilos ("3,5") y la API guarda gramos (3500). */
const kilosAGramos = (v: string) => (v.trim() === '' ? NaN : Math.round(Number(v.trim().replace(',', '.')) * 1000));
const gramosAKilos = (g: number) => String(g / 1000).replace('.', ',');
/** Stock como se lee: 14 o "3,5 kg". */
const verStock = (p: Producto, valor: number) => (p.porPeso ? formatearCantidad(valor, true) : String(valor));

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
                  <p className="truncate font-semibold text-stone-900">
                    {p.nombre}
                    {p.porPeso && <Scale size={14} className="ml-1.5 inline align-[-2px] text-stone-400" aria-label="Se vende por peso" />}
                  </p>
                  <p className="text-sm text-stone-500">
                    {formatearPesos(p.precio)}
                    {p.porPeso && ' el kilo'}
                    {esDueno && ` · costo ${formatearPesos(p.costo)} · gana ${formatearPesos(p.precio - p.costo)}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-mono text-lg font-bold ${p.bajoStock ? 'text-margen' : 'text-stone-900'}`}>{verStock(p, p.stock)}</p>
                  <p className="text-xs text-stone-400">mín. {verStock(p, p.stockMinimo)}</p>
                </div>
                {esDueno && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEntrada(p)}
                      className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"
                      aria-label={`Entrada de ${p.nombre}`}
                    >
                      <PackagePlus size={18} />
                    </button>
                    <button
                      onClick={() => setEditando(p)}
                      className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"
                      aria-label={`Editar ${p.nombre}`}
                    >
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
  const [porPeso, setPorPeso] = useState(producto?.porPeso ?? false);
  const [valores, setValores] = useState<Formulario>(
    producto
      ? {
          nombre: producto.nombre,
          precio: String(producto.precio),
          costo: String(producto.costo),
          stock: producto.porPeso ? gramosAKilos(producto.stock) : String(producto.stock),
          stockMinimo: producto.porPeso ? gramosAKilos(producto.stockMinimo) : String(producto.stockMinimo),
        }
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
      stock: porPeso ? kilosAGramos(valores.stock) : numero(valores.stock),
      stockMinimo: porPeso ? kilosAGramos(valores.stockMinimo) : numero(valores.stockMinimo),
      porPeso,
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
      type={tipo === 'kilos' ? 'text' : tipo}
      inputMode={tipo === 'number' ? 'numeric' : tipo === 'kilos' ? 'decimal' : undefined}
      placeholder={tipo === 'kilos' ? 'Ej.: 3,5' : undefined}
      value={valores[nombre]}
      onChange={(e) => setValores({ ...valores, [nombre]: e.target.value })}
      error={errores[nombre]}
    />
  );

  return (
    <Modal titulo={producto ? 'Editar producto' : 'Nuevo producto'} abierto alCerrar={alCerrar}>
      <form onSubmit={alEnviar} className="space-y-3" noValidate>
        {campo('nombre', 'Nombre', 'text')}
        <fieldset>
          <legend className="mb-1 text-sm font-semibold text-stone-700">¿Cómo se vende?</legend>
          <div className="grid grid-cols-2 gap-1.5" role="radiogroup">
            {(
              [
                [false, 'Por unidad'],
                [true, 'Por peso (granel)'],
              ] as const
            ).map(([valor, texto]) => (
              <button
                key={texto}
                type="button"
                role="radio"
                aria-checked={porPeso === valor}
                disabled={producto !== null}
                onClick={() => setPorPeso(valor)}
                className={`rounded-md border-2 py-1.5 text-sm font-bold transition disabled:cursor-not-allowed ${
                  porPeso === valor
                    ? 'border-stone-900 bg-stone-900 text-amber-300'
                    : 'border-stone-200 text-stone-500 hover:border-stone-400 disabled:opacity-50'
                }`}
              >
                {texto}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-stone-500">
            {producto
              ? 'Esto no se cambia en un producto que ya existe.'
              : porPeso
                ? 'Queso, arroz suelto, carne: se cobra por el kilo y se vende por gramos o por plata.'
                : 'Paquetes, botellas, latas: se vende de a uno.'}
          </p>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          {campo('precio', porPeso ? 'Precio del kilo' : 'Precio de venta')}
          {campo('costo', porPeso ? 'Costo del kilo' : 'Costo')}
          {campo('stock', porPeso ? 'Hay (kilos)' : 'Stock', porPeso ? 'kilos' : 'number')}
          {campo('stockMinimo', porPeso ? 'Mínimo (kilos)' : 'Stock mínimo', porPeso ? 'kilos' : 'number')}
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
  const [valores, setValores] = useState({ cantidad: '', costo: String(producto.costo), proveedor: '' });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const historial = useQuery({
    queryKey: ['productos', producto.id, 'entradas'],
    queryFn: () => api<EntradaInventario[]>(`/productos/${producto.id}/entradas`),
  });
  const guardar = useMutation({
    mutationFn: (datos: unknown) => api<Producto>(`/productos/${producto.id}/entrada`, { metodo: 'PATCH', cuerpo: datos }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['productos'] });
      alCerrar();
    },
    onError: (e) => setErrores(e instanceof ErrorApi ? { general: e.message, ...e.errores } : { general: 'No se pudo guardar' }),
  });

  const cantidad = producto.porPeso ? kilosAGramos(valores.cantidad) : Number(valores.cantidad);
  const costo = Number(valores.costo.replace(/\./g, ''));
  const stock = Math.max(producto.stock, 0);
  // Vista previa del costo promedio: la misma cuenta que hace la API.
  const costoNuevo = cantidad > 0 && Number.isFinite(costo) ? Math.round((stock * producto.costo + cantidad * costo) / (stock + cantidad)) : null;

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    const resultado = entradaStockSchema.safeParse({ cantidad, costoUnitario: costo, proveedor: valores.proveedor || undefined });
    if (!resultado.success) {
      setErrores(Object.fromEntries(resultado.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrores({});
    guardar.mutate(resultado.data);
  }

  return (
    <Modal titulo={`Llegó mercancía: ${producto.nombre}`} abierto alCerrar={alCerrar}>
      <form onSubmit={alEnviar} className="space-y-3" noValidate>
        <p className="text-sm text-stone-500">
          Hoy hay {verStock(producto, producto.stock)}, con costo de {formatearPesos(producto.costo)} y precio de {formatearPesos(producto.precio)}
          {producto.porPeso && ' el kilo'}.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Campo
            etiqueta={producto.porPeso ? 'Kilos que llegaron' : 'Unidades que llegaron'}
            type={producto.porPeso ? 'text' : 'number'}
            inputMode={producto.porPeso ? 'decimal' : 'numeric'}
            placeholder={producto.porPeso ? 'Ej.: 2,5' : undefined}
            value={valores.cantidad}
            onChange={(e) => setValores({ ...valores, cantidad: e.target.value })}
            error={errores.cantidad}
            autoFocus
          />
          <Campo
            etiqueta={producto.porPeso ? 'Costo del kilo' : 'Costo por unidad'}
            type="number"
            inputMode="numeric"
            value={valores.costo}
            onChange={(e) => setValores({ ...valores, costo: e.target.value })}
            error={errores.costoUnitario}
          />
        </div>
        <Campo
          etiqueta="Proveedor (opcional)"
          placeholder="Ej.: Postobón"
          value={valores.proveedor}
          onChange={(e) => setValores({ ...valores, proveedor: e.target.value })}
          error={errores.proveedor}
          maxLength={60}
        />
        {costoNuevo !== null && (
          <p
            className={`rounded-md border border-dashed px-3 py-2 text-sm ${
              costoNuevo > producto.precio ? 'border-margen bg-red-50 text-red-800' : 'border-stone-300 bg-stone-100 text-stone-700'
            }`}
          >
            El costo quedaría en <strong className="font-mono">{formatearPesos(costoNuevo)}</strong>
            {costoNuevo > producto.precio
              ? ', más que el precio de venta. Sube primero el precio.'
              : ` y la ganancia ${producto.porPeso ? 'por kilo' : 'por unidad'} en ${formatearPesos(producto.precio - costoNuevo)}.`}
          </p>
        )}
        {errores.general && <Aviso>{errores.general}</Aviso>}
        <Boton type="submit" disabled={guardar.isPending} className="w-full">
          Sumar al inventario
        </Boton>
      </form>

      <div className="mt-5 border-t border-dashed border-stone-300 pt-3">
        <h3 className="mb-2 text-sm font-semibold text-stone-700">Llegadas anteriores</h3>
        <ul className="max-h-48 space-y-1.5 overflow-y-auto text-sm">
          {(historial.data ?? []).map((h) => (
            <li key={h.id} className="flex justify-between gap-3">
              <span className="min-w-0 truncate text-stone-500">
                {fechaCorta(h.fecha)} · {h.proveedor ?? 'sin proveedor'}
              </span>
              <span className="shrink-0 font-mono text-stone-900">
                +{verStock(producto, h.cantidad)} a {formatearPesos(h.costoUnitario)}
              </span>
            </li>
          ))}
          {historial.data?.length === 0 && <li className="text-stone-400">Todavía no hay llegadas registradas.</li>}
        </ul>
      </div>
    </Modal>
  );
}

const fechaCorta = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }).format(
    new Date(iso),
  );
