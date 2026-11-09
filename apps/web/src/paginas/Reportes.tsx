// Reportes (solo la dueña): cuánto se vendió y se ganó en una semana, un mes o un rango.
// La gráfica es una sola serie (lo vendido por día), con su tabla para quien no quiera leerla.
import { formatearCantidad, formatearPesos, type ReportePeriodo } from '@elcuaderno/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api/cliente';
import { Cargando, Encabezado, Tarjeta } from '../componentes/ui';

const hoyEnColombia = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function moverDia(dia: string, delta: number) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Rangos de un toque: la dueña casi siempre quiere la semana o el mes. */
function rangos(hoy: string) {
  const inicioMes = `${hoy.slice(0, 8)}01`;
  const finMesPasado = moverDia(inicioMes, -1);
  return [
    { id: 'semana', texto: 'Últimos 7 días', desde: moverDia(hoy, -6), hasta: hoy },
    { id: 'treinta', texto: 'Últimos 30 días', desde: moverDia(hoy, -29), hasta: hoy },
    { id: 'mes', texto: 'Este mes', desde: inicioMes, hasta: hoy },
    { id: 'pasado', texto: 'Mes pasado', desde: `${finMesPasado.slice(0, 8)}01`, hasta: finMesPasado },
  ];
}

const diaLargo = (dia: string) =>
  new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${dia}T12:00:00Z`));
const diaCorto = (dia: string) =>
  new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${dia}T12:00:00Z`));

/** Ticks del eje en números redondos y compactos ($ 50 mil, $ 100 mil). */
function ticks(maximo: number) {
  if (maximo <= 0) return [0];
  const paso = Math.pow(10, Math.floor(Math.log10(maximo)));
  const opciones = [1, 2, 2.5, 5, 10].map((m) => m * paso);
  const elegido = opciones.find((o) => maximo / o <= 4) ?? opciones[opciones.length - 1];
  const tope = Math.ceil(maximo / elegido) * elegido;
  return Array.from({ length: Math.round(tope / elegido) + 1 }, (_, i) => i * elegido);
}
const compacto = (valor: number) => (valor >= 1_000_000 ? `$ ${valor / 1_000_000} M` : valor >= 1000 ? `$ ${valor / 1000} mil` : `$ ${valor}`);

export function Reportes() {
  const hoy = hoyEnColombia();
  const opciones = rangos(hoy);
  const [elegido, setElegido] = useState(opciones[0]);
  const reporte = useQuery({
    queryKey: ['reporte', elegido.desde, elegido.hasta],
    queryFn: () => api<ReportePeriodo>(`/caja/reporte?desde=${elegido.desde}&hasta=${elegido.hasta}`),
  });
  const r = reporte.data;

  return (
    <>
      <Link to="/caja" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-stone-600 hover:text-stone-900">
        <ArrowLeft size={15} /> Caja
      </Link>
      <Encabezado titulo="Reportes" detalle="Cuánto se vendió y se ganó en el tiempo." />

      {/* Filtro de rango: una sola fila, arriba de todo lo que afecta. */}
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Rango de días">
        {opciones.map((o) => (
          <button
            key={o.id}
            onClick={() => setElegido(o)}
            aria-pressed={elegido.id === o.id}
            className={`rounded-lg border-2 px-3 py-1.5 text-sm font-semibold transition ${
              elegido.id === o.id
                ? 'border-stone-900 bg-amber-300 text-stone-900'
                : 'border-stone-300 bg-stone-50 text-stone-600 hover:border-stone-900'
            }`}
          >
            {o.texto}
          </button>
        ))}
      </div>

      {!r ? (
        <Cargando />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Cifra titulo="Vendido" valor={r.totales.vendido} nota={`${r.totales.ventas} ventas`} />
            <Cifra
              titulo="Ganancia"
              valor={r.totales.ganancia}
              nota={r.totales.vendido ? `${Math.round((r.totales.ganancia / r.totales.vendido) * 100)} % de lo vendido` : undefined}
            />
            <Cifra titulo="Se fió" valor={r.totales.porMedio.FIADO} nota={`Abonaron ${formatearPesos(r.totales.abonos)}`} />
            <Cifra titulo="Gastos del cajón" valor={r.totales.gastos} />
          </div>

          <section className="mt-6">
            <h2 className="font-bold text-stone-900">Vendido por día</h2>
            <p className="mb-2 text-xs text-stone-500">
              {diaLargo(r.desde)} a {diaLargo(r.hasta)}. Las ventas anuladas no cuentan.
            </p>
            <Tarjeta>
              <GraficaVentas dias={r.dias} />
              <details className="mt-4 border-t border-dashed border-stone-300 pt-3 text-sm">
                <summary className="cursor-pointer font-semibold text-stone-700">Ver los números en una tabla</summary>
                <table className="mt-3 w-full text-left">
                  <thead className="text-xs uppercase tracking-wide text-stone-500">
                    <tr>
                      <th className="py-1 font-semibold">Día</th>
                      <th className="py-1 text-right font-semibold">Ventas</th>
                      <th className="py-1 text-right font-semibold">Vendido</th>
                      <th className="py-1 text-right font-semibold">Ganancia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {r.dias.map((d) => (
                      <tr key={d.dia}>
                        <td className="py-1.5 text-stone-700 first-letter:uppercase">{diaCorto(d.dia)}</td>
                        <td className="py-1.5 text-right font-mono text-stone-600">{d.ventas}</td>
                        <td className="py-1.5 text-right font-mono text-stone-900">{formatearPesos(d.vendido)}</td>
                        <td className="py-1.5 text-right font-mono text-stone-600">{formatearPesos(d.ganancia)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </Tarjeta>
          </section>

          <section className="mt-6">
            <h2 className="mb-2 font-bold text-stone-900">Lo más vendido</h2>
            <Tarjeta>
              {r.masVendidos.length === 0 ? (
                <p className="text-sm text-stone-400">Sin ventas en este rango.</p>
              ) : (
                <ol className="divide-y divide-dashed divide-stone-300">
                  {r.masVendidos.map((m, i) => (
                    <li key={m.producto} className="flex items-center gap-3 py-2 text-sm">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-stone-900">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-stone-800">{m.producto}</span>
                        {/* En el celular las unidades van debajo, para que el nombre quepa. */}
                        <span className="block text-xs text-stone-500 sm:hidden">{formatearCantidad(m.unidades, m.porPeso)}</span>
                      </span>
                      <span className="hidden shrink-0 font-mono text-stone-500 sm:block">{formatearCantidad(m.unidades, m.porPeso)}</span>
                      <span className="w-24 shrink-0 text-right font-mono font-semibold text-stone-900">{formatearPesos(m.vendido)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Tarjeta>
          </section>
        </>
      )}
    </>
  );
}

function Cifra({ titulo, valor, nota }: { titulo: string; valor: number; nota?: string }) {
  return (
    <Tarjeta>
      <p className="text-sm text-stone-500">{titulo}</p>
      <p className="mt-1 font-mono text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">{formatearPesos(valor)}</p>
      {nota && <p className="text-xs text-stone-500">{nota}</p>}
    </Tarjeta>
  );
}

/**
 * Columnas de una sola serie: tinta de bolígrafo, máximo 24 px de ancho, punta redondeada
 * de 4 px y base recta. Cada columna entera es el área del tooltip (más grande que la barra)
 * y se puede enfocar con el teclado. Solo se rotula el día de mayor venta.
 */
function GraficaVentas({ dias }: { dias: ReportePeriodo['dias'] }) {
  const [activo, setActivo] = useState<number | null>(null);
  const maximo = Math.max(...dias.map((d) => d.vendido), 0);
  const marcas = ticks(maximo);
  const tope = marcas[marcas.length - 1] || 1;
  const indiceMaximo = maximo > 0 ? dias.findIndex((d) => d.vendido === maximo) : -1;
  // Con muchos días no caben todas las etiquetas: se muestra una de cada tantas.
  const cadaCuanto = dias.length <= 14 ? 1 : dias.length <= 31 ? 5 : 15;
  const ALTO = 192;

  return (
    <div className="flex gap-2 pt-3">
      {/* Eje Y: números redondos, gris y discreto. */}
      <div className="relative w-14 shrink-0 text-right font-mono text-[10px] text-stone-500" style={{ height: ALTO }} aria-hidden>
        {marcas.map((m) => (
          <span key={m} className="absolute right-0 -translate-y-1/2" style={{ bottom: (m / tope) * ALTO }}>
            {compacto(m)}
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height: ALTO }}>
          {marcas.map((m) => (
            <div key={m} className="absolute inset-x-0 h-px bg-stone-200" style={{ bottom: (m / tope) * ALTO }} aria-hidden />
          ))}
          <div className="absolute inset-0 flex items-end gap-0.5" onPointerLeave={() => setActivo(null)}>
            {dias.map((d, i) => {
              const alto = (d.vendido / tope) * ALTO;
              return (
                <button
                  key={d.dia}
                  type="button"
                  className="group relative flex h-full min-w-0 flex-1 items-end justify-center outline-none"
                  onPointerEnter={() => setActivo(i)}
                  onFocus={() => setActivo(i)}
                  onBlur={() => setActivo(null)}
                  aria-label={`${diaLargo(d.dia)}: vendido ${formatearPesos(d.vendido)}, ganancia ${formatearPesos(d.ganancia)}, ${d.ventas} ventas`}
                >
                  {d.vendido > 0 && (
                    <span
                      className={`block w-full max-w-6 rounded-t-[4px] transition ${activo === i ? 'opacity-75' : ''}`}
                      style={{ height: Math.max(alto, 2), backgroundColor: 'var(--color-boligrafo)' }}
                    />
                  )}
                  {i === indiceMaximo && activo === null && (
                    <span
                      className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] font-semibold text-stone-700"
                      style={{ bottom: alto + 4 }}
                    >
                      {compacto(d.vendido)}
                    </span>
                  )}
                  {activo === i && (
                    <span
                      role="tooltip"
                      className={`pointer-events-none absolute z-10 w-max rounded-md border border-stone-900 bg-stone-50 px-2.5 py-1.5 text-left text-xs shadow-[2px_2px_0_0_var(--color-stone-900)] ${
                        i > dias.length / 2 ? 'right-1/2' : 'left-1/2'
                      }`}
                      style={{ bottom: Math.min(alto + 8, ALTO - 8) }}
                    >
                      <strong className="block font-mono text-sm text-stone-900">{formatearPesos(d.vendido)}</strong>
                      <span className="block text-stone-500 first-letter:uppercase">{diaCorto(d.dia)}</span>
                      <span className="block text-stone-500">
                        Ganancia {formatearPesos(d.ganancia)} · {d.ventas} ventas
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-1 flex gap-0.5" aria-hidden>
          {dias.map((d, i) => (
            <span key={d.dia} className="min-w-0 flex-1 truncate text-center text-[10px] text-stone-500">
              {i % cadaCuanto === 0 || i === dias.length - 1 ? (dias.length <= 14 ? diaCorto(d.dia) : d.dia.slice(8)) : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
