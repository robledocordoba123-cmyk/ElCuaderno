// El cajón del día (solo la dueña): base con que se abrió, gastos que salieron y el cierre
// con lo que se contó. Después del cierre ya no se mueve nada de ese día.
import { baseCajaSchema, cierreSchema, formatearPesos, gastoSchema, type ResumenCaja } from '@elcuaderno/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, ErrorApi } from '../api/cliente';
import { Aviso, Boton, Campo, Tarjeta } from './ui';

const hora = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date(iso));

/** Convierte lo que se escribe ("50.000", "50000") en pesos enteros. */
const aPesos = (texto: string) => Number(texto.replace(/[.\s$]/g, ''));

export function Cajon({ resumen: r, esHoy }: { resumen: ResumenCaja; esHoy: boolean }) {
  const queryClient = useQueryClient();
  const abierto = !r.cierre;
  const editable = esHoy && abierto;
  const [error, setError] = useState('');

  const mutar = useMutation({
    mutationFn: ({ ruta, metodo, cuerpo }: { ruta: string; metodo: string; cuerpo?: unknown }) =>
      api<ResumenCaja>(`/caja/${ruta}${ruta === 'cierre' && !esHoy ? `?dia=${r.dia}` : ''}`, { metodo, cuerpo }),
    onSuccess: (nuevo) => {
      queryClient.setQueryData(['caja', r.dia], nuevo);
      void queryClient.invalidateQueries({ queryKey: ['bitacora'] });
      setError('');
    },
    onError: (e) => setError(e instanceof ErrorApi ? e.message : 'No se pudo guardar'),
  });

  return (
    <section className="mt-6">
      <h2 className="mb-2 flex items-center gap-2 font-bold text-stone-900">
        El cajón
        {r.cierre && (
          <span className="inline-flex items-center gap-1 rounded-md bg-stone-900 px-2 py-0.5 text-[11px] font-semibold text-stone-50">
            <Lock size={11} /> Cerrado
          </span>
        )}
      </h2>
      <Tarjeta className="grid gap-5 md:grid-cols-3">
        <Base valor={r.base} editable={editable} pendiente={mutar.isPending} guardar={(monto) => mutar.mutate({ ruta: 'base', metodo: 'PUT', cuerpo: { monto } })} />
        <Gastos resumen={r} editable={editable} pendiente={mutar.isPending} mutar={mutar.mutate} />
        <Cierre resumen={r} pendiente={mutar.isPending} cerrar={(cuerpo) => mutar.mutate({ ruta: 'cierre', metodo: 'POST', cuerpo })} />
      </Tarjeta>
      {error && (
        <div className="mt-2">
          <Aviso>{error}</Aviso>
        </div>
      )}
    </section>
  );
}

function Base({ valor, editable, pendiente, guardar }: { valor: number; editable: boolean; pendiente: boolean; guardar: (monto: number) => void }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');

  function alGuardar(e: FormEvent) {
    e.preventDefault();
    const resultado = baseCajaSchema.safeParse({ monto: aPesos(texto) });
    if (!resultado.success) return setError(resultado.error.issues[0].message);
    guardar(resultado.data.monto);
    setEditando(false);
  }

  return (
    <div>
      <p className="text-sm text-stone-500">Base con que se abrió</p>
      {editando ? (
        <form onSubmit={alGuardar} className="mt-1 flex items-end gap-2" noValidate>
          <div className="flex-1">
            <Campo etiqueta="Base" type="number" inputMode="numeric" autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} error={error} />
          </div>
          <Boton type="submit" disabled={pendiente}>
            Guardar
          </Boton>
        </form>
      ) : (
        <div className="mt-1 flex items-center gap-2">
          <p className="font-mono text-2xl font-bold text-stone-900">{formatearPesos(valor)}</p>
          {editable && (
            <button
              onClick={() => {
                setTexto(String(valor || ''));
                setEditando(true);
              }}
              className="rounded-md p-1 text-stone-400 hover:bg-stone-200/60 hover:text-stone-900"
              aria-label="Cambiar la base"
              title="Cambiar la base"
            >
              <Pencil size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Gastos({
  resumen: r,
  editable,
  pendiente,
  mutar,
}: {
  resumen: ResumenCaja;
  editable: boolean;
  pendiente: boolean;
  mutar: (v: { ruta: string; metodo: string; cuerpo?: unknown }) => void;
}) {
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});

  function alAnotar(e: FormEvent) {
    e.preventDefault();
    const resultado = gastoSchema.safeParse({ descripcion, monto: aPesos(monto) });
    if (!resultado.success) {
      setErrores(Object.fromEntries(resultado.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrores({});
    mutar({ ruta: 'gastos', metodo: 'POST', cuerpo: resultado.data });
    setDescripcion('');
    setMonto('');
  }

  return (
    <div className="md:border-x md:border-dashed md:border-stone-300 md:px-5">
      <p className="flex items-center justify-between text-sm text-stone-500">
        Gastos que salieron <span className="font-mono font-bold text-stone-900">− {formatearPesos(r.gastos)}</span>
      </p>
      <ul className="mt-2 space-y-1.5">
        {r.listaGastos.map((g) => (
          <li key={g.id} className="flex items-center gap-2 text-sm">
            <Minus size={13} className="shrink-0 text-margen" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-stone-700" title={`${g.usuario} · ${hora(g.en)}`}>
              {g.descripcion}
            </span>
            <span className="shrink-0 font-mono font-semibold text-stone-900">{formatearPesos(g.monto)}</span>
            {editable && (
              <button
                onClick={() => mutar({ ruta: `gastos/${g.id}`, metodo: 'DELETE' })}
                disabled={pendiente}
                className="shrink-0 rounded p-0.5 text-stone-400 hover:text-margen"
                aria-label={`Quitar el gasto ${g.descripcion}`}
                title="Quitar gasto mal anotado"
              >
                <Trash2 size={14} />
              </button>
            )}
          </li>
        ))}
        {r.listaGastos.length === 0 && <li className="text-sm text-stone-400">Ningún gasto.</li>}
      </ul>
      {editable && (
        <form onSubmit={alAnotar} className="mt-3 space-y-2" noValidate>
          <Campo etiqueta="¿En qué se gastó?" placeholder="Pago al proveedor de pan" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} error={errores.descripcion} />
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Campo etiqueta="Valor" type="number" inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value)} error={errores.monto} />
            </div>
            <Boton type="submit" variante="secundario" disabled={pendiente}>
              <Plus size={16} /> Anotar
            </Boton>
          </div>
        </form>
      )}
    </div>
  );
}

function Cierre({ resumen: r, pendiente, cerrar }: { resumen: ResumenCaja; pendiente: boolean; cerrar: (cuerpo: unknown) => void }) {
  const [contado, setContado] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const c = r.cierre;

  if (c) {
    return (
      <div>
        <p className="text-sm text-stone-500">
          Cierre de {c.por} a las {hora(c.en)}
        </p>
        <p className="mt-1 text-sm text-stone-700">
          Debía haber <strong className="font-mono">{formatearPesos(c.esperado)}</strong> y se contaron{' '}
          <strong className="font-mono">{formatearPesos(c.contado)}</strong>.
        </p>
        <Diferencia valor={c.diferencia} />
        {c.nota && <p className="mt-1 text-xs italic text-stone-500">“{c.nota}”</p>}
        {c.cambioDespues && (
          <p className="mt-2 text-xs font-medium text-amber-800">Ojo: el cajón cambió después del cierre (hubo movimientos más tarde).</p>
        )}
      </div>
    );
  }

  const numero = aPesos(contado);
  const vistaPrevia = contado.trim() !== '' && Number.isFinite(numero) ? numero - r.enCaja : null;

  function alCerrar(e: FormEvent) {
    e.preventDefault();
    const resultado = cierreSchema.safeParse({ contado: numero, nota: nota || undefined });
    if (contado.trim() === '' || !resultado.success) return setError(resultado.success ? 'Escribe cuánto contaste' : resultado.error.issues[0].message);
    setError('');
    cerrar(resultado.data);
  }

  return (
    <form onSubmit={alCerrar} className="space-y-2" noValidate>
      <p className="text-sm text-stone-500">Cerrar la caja</p>
      <Campo etiqueta="¿Cuánto hay en el cajón?" type="number" inputMode="numeric" value={contado} onChange={(e) => setContado(e.target.value)} error={error} />
      {vistaPrevia !== null && <Diferencia valor={vistaPrevia} />}
      <Campo etiqueta="Nota (opcional)" placeholder="Ej.: faltan 2.000 del cambio" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} />
      <Boton type="submit" disabled={pendiente} className="w-full">
        <Lock size={16} /> Cerrar caja
      </Boton>
    </form>
  );
}

function Diferencia({ valor }: { valor: number }) {
  if (valor === 0) return <p className="mt-2 font-semibold text-emerald-700">Cuadra exacto.</p>;
  return (
    <p className={`mt-2 font-semibold ${valor > 0 ? 'text-emerald-700' : 'text-margen'}`}>
      {valor > 0 ? 'Sobran' : 'Faltan'} {formatearPesos(Math.abs(valor))}
    </p>
  );
}
