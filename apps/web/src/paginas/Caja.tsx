// Caja del día (solo la dueña): cuánto entró por cada medio, la ganancia y las ventas.
import { anulacionSchema, formatearPesos, type ResumenCaja, type Venta } from '@elcuaderno/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, BookOpen, ChevronLeft, ChevronRight, HandCoins, ScrollText, Smartphone, TrendingUp, Undo2, Wallet, BarChart3 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api, ErrorApi } from '../api/cliente';
import { Cajon } from '../componentes/Cajon';
import { Aviso, Boton, Campo, Cargando, Encabezado, Modal, Tarjeta } from '../componentes/ui';

const hoyEnColombia = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function moverDia(dia: string, delta: number) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

const nombreDia = (dia: string) =>
  new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${dia}T12:00:00Z`));

const hora = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date(iso));

export function Caja() {
  const hoy = hoyEnColombia();
  const [dia, setDia] = useState(hoy);
  const resumen = useQuery({ queryKey: ['caja', dia], queryFn: () => api<ResumenCaja>(`/caja/resumen?dia=${dia}`) });
  const ventas = useQuery({ queryKey: ['caja', 'ventas', dia], queryFn: () => api<Venta[]>(`/ventas?dia=${dia}`) });
  const [anulando, setAnulando] = useState<Venta | null>(null);
  const r = resumen.data;

  return (
    <>
      <Encabezado
        titulo="Caja del día"
        detalle={nombreDia(dia)}
        accion={
          <div className="flex flex-wrap justify-end gap-1">
            <Link
              to="/reportes"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-200/60"
            >
              <BarChart3 size={16} /> Reportes
            </Link>
            <Link
              to="/bitacora"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-200/60"
            >
              <ScrollText size={16} /> Bitácora
            </Link>
          </div>
        }
      />
      <div className="mb-5 flex items-center gap-2">
        <button
          onClick={() => setDia(moverDia(dia, -1))}
          className="rounded-lg border-2 border-stone-300 bg-stone-50 hover:border-stone-900 p-2"
          aria-label="Día anterior"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => setDia(hoy)}
          disabled={dia === hoy}
          className="rounded-lg border-2 border-stone-300 bg-stone-50 hover:border-stone-900 px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          Hoy
        </button>
        <button
          onClick={() => setDia(moverDia(dia, 1))}
          disabled={dia >= hoy}
          className="rounded-lg border-2 border-stone-300 bg-stone-50 hover:border-stone-900 p-2 disabled:opacity-40"
          aria-label="Día siguiente"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {!r ? (
        <Cargando />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Tarjeta className="border-2! border-stone-900! bg-amber-400! sombra-tinta sm:col-span-2 lg:col-span-1">
              <p className="flex items-center gap-2 text-sm font-medium text-amber-950">
                <Wallet size={16} /> Debe haber en el cajón
              </p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-tight text-stone-950">{formatearPesos(r.enCaja)}</p>
              <p className="text-xs text-amber-900">Base + efectivo + abonos − gastos</p>
            </Tarjeta>
            <Dato icono={TrendingUp} titulo="Ganancia" valor={r.ganancia} nota={`${r.ventas} ventas`} />
            <Dato icono={Banknote} titulo="Efectivo" valor={r.porMedio.EFECTIVO} />
            <Dato icono={Smartphone} titulo="Nequi" valor={r.porMedio.NEQUI} />
            <Dato icono={BookOpen} titulo="Se fió" valor={r.porMedio.FIADO} />
            <Dato icono={HandCoins} titulo="Abonos recibidos" valor={r.abonos} />
          </div>

          <Cajon resumen={r} esHoy={dia === hoy} />

          {/* min-w-0: sin esto, el texto largo de una venta estira la columna y desborda la página en el celular. */}
          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <section className="min-w-0">
              <h2 className="mb-2 font-bold text-stone-900">Lo más vendido</h2>
              <Tarjeta>
                {r.masVendidos.length === 0 ? (
                  <p className="text-sm text-stone-400">Sin ventas este día.</p>
                ) : (
                  <ol className="space-y-2">
                    {r.masVendidos.map((m, i) => (
                      <li key={m.producto} className="flex items-center gap-3 text-sm">
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-800">{i + 1}</span>
                        <span className="flex-1 text-stone-700">{m.producto}</span>
                        <span className="font-semibold text-stone-900">{m.unidades} und.</span>
                      </li>
                    ))}
                  </ol>
                )}
              </Tarjeta>
            </section>

            <section className="min-w-0">
              <h2 className="mb-2 font-bold text-stone-900">Ventas</h2>
              <Tarjeta className="p-0!">
                <ul className="max-h-96 divide-y divide-stone-100 overflow-y-auto">
                  {(ventas.data ?? []).map((v) => (
                    <li key={v.id} className={`px-4 py-2.5 text-sm ${v.anulada ? 'bg-stone-100/70' : ''}`}>
                      <div className={`flex items-center gap-3 ${v.anulada ? 'opacity-60' : ''}`}>
                        <span className="w-20 shrink-0 whitespace-nowrap text-stone-400">{hora(v.creadaEn)}</span>
                        <span className={`min-w-0 flex-1 truncate text-stone-700 ${v.anulada ? 'line-through' : ''}`}>
                          {v.items.map((i) => `${i.cantidad} ${i.producto}`).join(', ')}
                        </span>
                        <span className={`shrink-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${etiquetaMedio[v.medio]}`}>
                          {v.medio === 'FIADO' ? `Fiado · ${v.cliente}` : v.medio === 'NEQUI' ? 'Nequi' : 'Efectivo'}
                        </span>
                        <span className={`w-20 shrink-0 text-right font-semibold text-stone-900 ${v.anulada ? 'line-through' : ''}`}>
                          {formatearPesos(v.total)}
                        </span>
                        {!v.anulada && dia === hoy && !r.cierre && (
                          <button
                            onClick={() => setAnulando(v)}
                            className="shrink-0 rounded-md p-1 text-stone-400 transition hover:bg-red-50 hover:text-margen"
                            aria-label={`Anular la venta de las ${hora(v.creadaEn)}`}
                            title="Anular venta"
                          >
                            <Undo2 size={15} />
                          </button>
                        )}
                      </div>
                      {v.anulada && (
                        <p className="mt-1 pl-23 text-xs font-medium text-margen">
                          Anulada por {v.anulada.por} a las {hora(v.anulada.en)}: {v.anulada.motivo}
                        </p>
                      )}
                    </li>
                  ))}
                  {ventas.data?.length === 0 && <li className="px-4 py-6 text-center text-sm text-stone-400">Sin ventas este día.</li>}
                </ul>
              </Tarjeta>
            </section>
          </div>
        </>
      )}
      {anulando && <AnularVenta venta={anulando} alCerrar={() => setAnulando(null)} />}
    </>
  );
}

/** La dueña anula una venta de hoy dejando el motivo; las unidades vuelven al inventario. */
function AnularVenta({ venta, alCerrar }: { venta: Venta; alCerrar: () => void }) {
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const anular = useMutation({
    mutationFn: (datos: { motivo: string }) => api<Venta>(`/ventas/${venta.id}/anular`, { metodo: 'POST', cuerpo: datos }),
    onSuccess: () => {
      for (const clave of ['caja', 'productos', 'clientes', 'bitacora']) void queryClient.invalidateQueries({ queryKey: [clave] });
      alCerrar();
    },
    onError: (e) => setError(e instanceof ErrorApi ? e.message : 'No se pudo anular'),
  });

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    const resultado = anulacionSchema.safeParse({ motivo });
    if (!resultado.success) return setError(resultado.error.issues[0].message);
    setError('');
    anular.mutate(resultado.data);
  }

  return (
    <Modal titulo={`Anular la venta de las ${hora(venta.creadaEn)}`} abierto alCerrar={alCerrar}>
      <form onSubmit={alEnviar} className="space-y-4" noValidate>
        <div className="rounded-lg border border-dashed border-stone-300 bg-stone-100 p-3 text-sm">
          <p className="text-stone-700">{venta.items.map((i) => `${i.cantidad} ${i.producto}`).join(', ')}</p>
          <p className="mt-1 font-mono font-bold text-stone-900">
            {formatearPesos(venta.total)} · {venta.medio === 'FIADO' ? `fiado a ${venta.cliente}` : venta.medio === 'NEQUI' ? 'Nequi' : 'efectivo'}
          </p>
        </div>
        <p className="text-sm text-stone-600">
          Las unidades vuelven al inventario y la venta sale de la caja{venta.medio === 'FIADO' ? ' y de la deuda del vecino' : ''}. Queda en la
          bitácora y no se puede deshacer.
        </p>
        <Campo
          etiqueta="¿Por qué se anula?"
          placeholder="Ej.: el cajero la marcó dos veces"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={120}
        />
        {error && <Aviso>{error}</Aviso>}
        <Boton type="submit" variante="peligro" disabled={anular.isPending} className="w-full">
          <Undo2 size={16} /> Anular venta
        </Boton>
      </form>
    </Modal>
  );
}

const etiquetaMedio = {
  EFECTIVO: 'bg-emerald-50 text-emerald-700',
  NEQUI: 'bg-fuchsia-50 text-fuchsia-700',
  FIADO: 'bg-amber-50 text-amber-800',
};

function Dato({ icono: Icono, titulo, valor, nota }: { icono: typeof Wallet; titulo: string; valor: number; nota?: string }) {
  return (
    <Tarjeta>
      <p className="flex items-center gap-2 text-sm text-stone-500">
        <Icono size={16} /> {titulo}
      </p>
      <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-stone-900">{formatearPesos(valor)}</p>
      {nota && <p className="text-xs text-stone-400">{nota}</p>}
    </Tarjeta>
  );
}
