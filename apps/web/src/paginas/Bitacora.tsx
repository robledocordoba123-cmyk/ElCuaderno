// Bitácora (solo la dueña): quién vendió, abonó o cambió algo, y cuándo. No se puede editar.
import type { RegistroBitacora } from '@elcuaderno/shared';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api/cliente';
import { Boton, Cargando, Encabezado, Tarjeta } from '../componentes/ui';

const POR_PAGINA = 50;

const cuando = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  }).format(new Date(iso));

export function Bitacora() {
  const [pagina, setPagina] = useState(1);
  const registros = useQuery({
    queryKey: ['bitacora', pagina],
    queryFn: () => api<RegistroBitacora[]>(`/bitacora?pagina=${pagina}`),
  });
  const filas = registros.data ?? [];

  return (
    <>
      <Link to="/caja" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-stone-600 hover:text-stone-900">
        <ArrowLeft size={15} /> Caja
      </Link>
      <Encabezado titulo="Bitácora" detalle="Quién hizo cada movimiento. Nadie puede editarla ni borrarla." />
      {registros.isLoading ? (
        <Cargando />
      ) : (
        <Tarjeta className="p-0">
          <ul className="divide-y divide-dashed divide-stone-300">
            {filas.map((r) => (
              <li key={r.id} className="grid gap-0.5 px-4 py-3 sm:grid-cols-[13rem_1fr] sm:gap-4">
                <span className="whitespace-nowrap font-mono text-xs text-stone-500">{cuando(r.fecha)}</span>
                <span className="text-sm text-stone-800">
                  <strong>{r.usuario}</strong> · {r.accion}
                  {r.detalle && <span className="text-stone-500"> — {r.detalle}</span>}
                </span>
              </li>
            ))}
            {filas.length === 0 && <li className="px-4 py-10 text-center text-stone-500">Todavía no hay movimientos.</li>}
          </ul>
        </Tarjeta>
      )}
      <div className="mt-4 flex justify-between">
        <Boton variante="secundario" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>
          <ChevronLeft size={16} /> Más recientes
        </Boton>
        <Boton variante="secundario" disabled={filas.length < POR_PAGINA} onClick={() => setPagina((p) => p + 1)}>
          Anteriores <ChevronRight size={16} />
        </Boton>
      </div>
    </>
  );
}
