// Piezas de interfaz reutilizables, con el estilo del cuaderno: papel, tinta y resaltador.
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function Boton({
  variante = 'principal',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'principal' | 'secundario' | 'peligro' | 'fantasma' }) {
  const estilos = {
    principal: 'border-2 border-stone-900 bg-amber-400 text-stone-900 sombra-tinta hover:bg-amber-300',
    secundario: 'border-2 border-stone-900 bg-stone-50 text-stone-900 sombra-tinta hover:bg-white',
    peligro: 'border-2 border-stone-900 bg-margen text-white sombra-tinta hover:brightness-110',
    fantasma: 'text-stone-600 hover:bg-stone-200/60',
  }[variante];
  const presionar = variante === 'fantasma' ? '' : 'active:translate-x-[3px] active:translate-y-[3px] active:shadow-none';
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-x-0 disabled:active:translate-y-0 ${estilos} ${presionar} ${className}`}
    />
  );
}

export function Campo({
  etiqueta,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; error?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-stone-700">{etiqueta}</span>
      <input
        {...props}
        aria-invalid={Boolean(error)}
        className={`w-full rounded-lg border-2 bg-stone-50 px-3 py-2.5 text-stone-900 outline-none transition focus:bg-white ${
          error ? 'border-margen' : 'border-stone-300 focus:border-stone-900'
        }`}
      />
      {error && <span className="mt-1 block text-xs font-medium text-margen">{error}</span>}
    </label>
  );
}

export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-stone-300 bg-stone-50 p-4 sombra-papel ${className}`}>{children}</div>;
}

export function Aviso({ tipo = 'error', children }: { tipo?: 'error' | 'exito' | 'info'; children: ReactNode }) {
  const estilos = {
    error: 'border-margen bg-red-50 text-red-800',
    exito: 'border-emerald-600 bg-emerald-50 text-emerald-800',
    info: 'border-amber-500 bg-amber-100 text-stone-800',
  }[tipo];
  return (
    <p role={tipo === 'error' ? 'alert' : 'status'} className={`rounded-md border-l-4 px-3 py-2 text-sm font-medium ${estilos}`}>
      {children}
    </p>
  );
}

export function Encabezado({ titulo, detalle, accion }: { titulo: string; detalle?: string; accion?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-3">
      <div>
        {/* El título va "resaltado", como se subraya en un cuaderno. */}
        <h1 className="inline bg-[linear-gradient(transparent_55%,var(--color-amber-300)_55%)] text-3xl font-extrabold tracking-tight text-stone-900">
          {titulo}
        </h1>
        {detalle && <p className="mt-1 text-sm text-stone-500 first-letter:uppercase">{detalle}</p>}
      </div>
      {accion}
    </div>
  );
}

export function Cargando() {
  return (
    <div className="space-y-3" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg bg-stone-200/80" />
      ))}
    </div>
  );
}

export function Modal({ titulo, abierto, alCerrar, children }: { titulo: string; abierto: boolean; alCerrar: () => void; children: ReactNode }) {
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-stone-950/50 p-0 sm:items-center sm:p-4" onClick={alCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border-2 border-stone-900 bg-stone-50 p-5 sombra-tinta sm:max-w-md sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-stone-900">{titulo}</h2>
          <button onClick={alCerrar} className="rounded-lg px-2 py-1 text-stone-500 hover:bg-stone-200" aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
