// Caja del día (solo la dueña): cuánto entró por cada medio, la ganancia y las ventas.
import { formatearPesos, type ResumenCaja, type Venta } from '@elcuaderno/shared';
import { useQuery } from '@tanstack/react-query';
import { Banknote, BookOpen, ChevronLeft, ChevronRight, HandCoins, Smartphone, TrendingUp, Wallet } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api/cliente';
import { Cargando, Encabezado, Tarjeta } from '../componentes/ui';

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
  const r = resumen.data;

  return (
    <>
      <Encabezado titulo="Caja del día" detalle={nombreDia(dia)} />
      <div className="mb-5 flex items-center gap-2">
        <button onClick={() => setDia(moverDia(dia, -1))} className="rounded-lg border-2 border-stone-300 bg-stone-50 hover:border-stone-900 p-2" aria-label="Día anterior">
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
              <p className="text-xs text-amber-900">Ventas en efectivo + abonos</p>
            </Tarjeta>
            <Dato icono={TrendingUp} titulo="Ganancia" valor={r.ganancia} nota={`${r.ventas} ventas`} />
            <Dato icono={Banknote} titulo="Efectivo" valor={r.porMedio.EFECTIVO} />
            <Dato icono={Smartphone} titulo="Nequi" valor={r.porMedio.NEQUI} />
            <Dato icono={BookOpen} titulo="Se fió" valor={r.porMedio.FIADO} />
            <Dato icono={HandCoins} titulo="Abonos recibidos" valor={r.abonos} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <section>
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

            <section>
              <h2 className="mb-2 font-bold text-stone-900">Ventas</h2>
              <Tarjeta className="p-0!">
                <ul className="max-h-96 divide-y divide-stone-100 overflow-y-auto">
                  {(ventas.data ?? []).map((v) => (
                    <li key={v.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <span className="w-20 shrink-0 whitespace-nowrap text-stone-400">{hora(v.creadaEn)}</span>
                      <span className="flex-1 truncate text-stone-700">{v.items.map((i) => `${i.cantidad} ${i.producto}`).join(', ')}</span>
                      <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${etiquetaMedio[v.medio]}`}>
                        {v.medio === 'FIADO' ? `Fiado · ${v.cliente}` : v.medio === 'NEQUI' ? 'Nequi' : 'Efectivo'}
                      </span>
                      <span className="w-20 text-right font-semibold text-stone-900">{formatearPesos(v.total)}</span>
                    </li>
                  ))}
                  {ventas.data?.length === 0 && <li className="px-4 py-6 text-center text-sm text-stone-400">Sin ventas este día.</li>}
                </ul>
              </Tarjeta>
            </section>
          </div>
        </>
      )}
    </>
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
