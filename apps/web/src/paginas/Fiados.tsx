// Fiados: quién debe, cuánto, su historial y el registro de abonos.
import { abonoSchema, clienteSchema, formatearPesos, type Cliente } from '@elcuaderno/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Phone, UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, ErrorApi } from '../api/cliente';
import { Aviso, Boton, Campo, Cargando, Encabezado, Modal, Tarjeta } from '../componentes/ui';
import { useSesion } from '../sesion';

interface Detalle extends Cliente {
  movimientos: { tipo: 'FIADO' | 'ABONO'; id: number; monto: number; fecha: string }[];
}

const fecha = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date(iso));

export function Fiados() {
  const { esDueno } = useSesion();
  const [soloDeudores, setSoloDeudores] = useState(true);
  const [abierto, setAbierto] = useState<number | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const clientes = useQuery({ queryKey: ['clientes'], queryFn: () => api<Cliente[]>('/clientes') });

  const lista = (clientes.data ?? [])
    .filter((c) => !soloDeudores || c.deuda > 0)
    .sort((a, b) => (soloDeudores ? b.deuda - a.deuda : a.nombre.localeCompare(b.nombre)));
  const totalFiado = (clientes.data ?? []).reduce((s, c) => s + c.deuda, 0);

  return (
    <>
      <Encabezado
        titulo="Fiados"
        detalle={`En la calle: ${formatearPesos(totalFiado)}`}
        accion={
          esDueno && (
            <Boton onClick={() => setNuevo(true)}>
              <UserPlus size={18} /> <span className="hidden sm:inline">Nuevo cliente</span>
            </Boton>
          )
        }
      />
      <div className="mb-4 flex gap-2">
        <Boton variante={soloDeudores ? 'principal' : 'secundario'} onClick={() => setSoloDeudores(true)}>
          Me deben
        </Boton>
        <Boton variante={soloDeudores ? 'secundario' : 'principal'} onClick={() => setSoloDeudores(false)}>
          Todos los clientes
        </Boton>
      </div>

      {clientes.isLoading ? (
        <Cargando />
      ) : (
        <ul className="space-y-2">
          {lista.map((c) => {
            const uso = c.cupo ? Math.min(100, Math.round((c.deuda / c.cupo) * 100)) : 0;
            return (
              <li key={c.id}>
                <button onClick={() => setAbierto(c.id)} className="w-full text-left">
                  <Tarjeta className="flex items-center gap-3 transition hover:border-amber-300">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-stone-900">{c.nombre}</p>
                      <div className="mt-1.5 h-1.5 w-full max-w-xs rounded-full bg-stone-100">
                        <div
                          className={`h-full rounded-full ${uso >= 90 ? 'bg-red-500' : uso >= 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${uso}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-stone-500">
                        Cupo {formatearPesos(c.cupo)} · disponible {formatearPesos(c.disponible)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${c.deuda > 0 ? 'text-stone-900' : 'text-emerald-600'}`}>{c.deuda > 0 ? formatearPesos(c.deuda) : 'Al día'}</p>
                    </div>
                    <ChevronRight size={18} className="text-stone-300" />
                  </Tarjeta>
                </button>
              </li>
            );
          })}
          {lista.length === 0 && <p className="py-10 text-center text-stone-400">Nadie debe nada. ¡Qué belleza!</p>}
        </ul>
      )}

      {abierto !== null && <DetalleCliente id={abierto} alCerrar={() => setAbierto(null)} />}
      {nuevo && <NuevoCliente alCerrar={() => setNuevo(false)} />}
    </>
  );
}

function DetalleCliente({ id, alCerrar }: { id: number; alCerrar: () => void }) {
  const queryClient = useQueryClient();
  const detalle = useQuery({ queryKey: ['clientes', id], queryFn: () => api<Detalle>(`/clientes/${id}`) });
  const [monto, setMonto] = useState('');
  const [error, setError] = useState('');
  const [listo, setListo] = useState('');

  const abonar = useMutation({
    mutationFn: (datos: { monto: number }) => api<Detalle>(`/clientes/${id}/abonos`, { metodo: 'POST', cuerpo: datos }),
    onSuccess: (actualizado) => {
      queryClient.setQueryData(['clientes', id], actualizado);
      void queryClient.invalidateQueries({ queryKey: ['clientes'] });
      void queryClient.invalidateQueries({ queryKey: ['caja'] });
      setListo(`Abono registrado. Ahora debe ${formatearPesos(actualizado.deuda)}.`);
      setMonto('');
    },
    onError: (e) => setError(e instanceof ErrorApi ? e.message : 'No se pudo registrar'),
  });

  function alAbonar(e: FormEvent) {
    e.preventDefault();
    setError('');
    setListo('');
    const resultado = abonoSchema.safeParse({ monto: Number(monto.replace(/\./g, '')) });
    if (!resultado.success) return setError(resultado.error.issues[0].message);
    abonar.mutate(resultado.data);
  }

  const c = detalle.data;
  return (
    <Modal titulo={c?.nombre ?? 'Cliente'} abierto alCerrar={alCerrar}>
      {!c ? (
        <Cargando />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-stone-100 p-3">
              <p className="text-xs text-stone-500">Debe</p>
              <p className="text-xl font-bold text-stone-900">{formatearPesos(c.deuda)}</p>
            </div>
            <div className="rounded-xl bg-stone-100 p-3">
              <p className="text-xs text-stone-500">Le queda de cupo</p>
              <p className="text-xl font-bold text-stone-900">{formatearPesos(c.disponible)}</p>
            </div>
          </div>
          {c.telefono && (
            <a href={`tel:${c.telefono}`} className="flex items-center gap-2 text-sm text-amber-700">
              <Phone size={15} /> {c.telefono}
            </a>
          )}

          {c.deuda > 0 && (
            <form onSubmit={alAbonar} className="flex items-end gap-2" noValidate>
              <div className="flex-1">
                <Campo etiqueta="Registrar abono" type="number" inputMode="numeric" placeholder="10000" value={monto} onChange={(e) => setMonto(e.target.value)} />
              </div>
              <Boton type="submit" disabled={abonar.isPending}>
                Abonar
              </Boton>
            </form>
          )}
          {error && <Aviso>{error}</Aviso>}
          {listo && <Aviso tipo="exito">{listo}</Aviso>}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-stone-700">Movimientos</h3>
            <ul className="max-h-64 divide-y divide-stone-100 overflow-y-auto">
              {c.movimientos.map((m) => (
                <li key={`${m.tipo}-${m.id}`} className="flex justify-between py-2 text-sm">
                  <span className="text-stone-500">
                    {m.tipo === 'FIADO' ? 'Fiado' : 'Abono'} · {fecha(m.fecha)}
                  </span>
                  <span className={`font-semibold ${m.tipo === 'ABONO' ? 'text-emerald-600' : 'text-stone-900'}`}>
                    {m.tipo === 'ABONO' ? '−' : '+'} {formatearPesos(m.monto)}
                  </span>
                </li>
              ))}
              {c.movimientos.length === 0 && <li className="py-4 text-center text-sm text-stone-400">Sin movimientos todavía.</li>}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  );
}

function NuevoCliente({ alCerrar }: { alCerrar: () => void }) {
  const queryClient = useQueryClient();
  const [valores, setValores] = useState({ nombre: '', telefono: '', cupo: '' });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const crear = useMutation({
    mutationFn: (datos: unknown) => api<Cliente>('/clientes', { metodo: 'POST', cuerpo: datos }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clientes'] });
      alCerrar();
    },
    onError: (e) => e instanceof ErrorApi && setErrores({ general: e.message, ...e.errores }),
  });

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    const resultado = clienteSchema.safeParse({ ...valores, cupo: Number(valores.cupo.replace(/\./g, '')) });
    if (!resultado.success) {
      setErrores(Object.fromEntries(resultado.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    crear.mutate(resultado.data);
  }

  return (
    <Modal titulo="Nuevo cliente" abierto alCerrar={alCerrar}>
      <form onSubmit={alEnviar} className="space-y-3" noValidate>
        <Campo etiqueta="Nombre" value={valores.nombre} onChange={(e) => setValores({ ...valores, nombre: e.target.value })} error={errores.nombre} />
        <Campo etiqueta="Celular (opcional)" inputMode="tel" value={valores.telefono} onChange={(e) => setValores({ ...valores, telefono: e.target.value })} error={errores.telefono} />
        <Campo etiqueta="Cupo de fiado" type="number" inputMode="numeric" value={valores.cupo} onChange={(e) => setValores({ ...valores, cupo: e.target.value })} error={errores.cupo} />
        {errores.general && <Aviso>{errores.general}</Aviso>}
        <Boton type="submit" disabled={crear.isPending} className="w-full">
          Guardar cliente
        </Boton>
      </form>
    </Modal>
  );
}
