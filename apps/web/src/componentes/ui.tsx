// Piezas de interfaz reutilizables.
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function Boton({
  variante = 'principal',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'principal' | 'secundario' | 'peligro' | 'fantasma' }) {
  const estilos = {
    principal: 'bg-amber-500 text-stone-950 hover:bg-amber-400 shadow-sm shadow-amber-500/30',
    secundario: 'bg-white text-stone-800 border border-stone-200 hover:bg-stone-50',
    peligro: 'bg-red-600 text-white hover:bg-red-500',
    fantasma: 'text-stone-600 hover:bg-stone-100',
  }[variante];
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${estilos} ${className}`}
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
      <span className="mb-1 block text-sm font-medium text-stone-700">{etiqueta}</span>
      <input
        {...props}
        aria-invalid={Boolean(error)}
        className={`w-full rounded-xl border bg-white px-3 py-2.5 text-stone-900 outline-none transition focus:ring-2 ${
          error ? 'border-red-400 focus:ring-red-200' : 'border-stone-200 focus:border-amber-400 focus:ring-amber-100'
        }`}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-stone-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

export function Aviso({ tipo = 'error', children }: { tipo?: 'error' | 'exito' | 'info'; children: ReactNode }) {
  const estilos = {
    error: 'bg-red-50 text-red-700 border-red-200',
    exito: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    info: 'bg-amber-50 text-amber-800 border-amber-200',
  }[tipo];
  return (
    <p role={tipo === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-3 py-2 text-sm ${estilos}`}>
      {children}
    </p>
  );
}

export function Encabezado({ titulo, detalle, accion }: { titulo: string; detalle?: string; accion?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">{titulo}</h1>
        {detalle && <p className="text-sm text-stone-500">{detalle}</p>}
      </div>
      {accion}
    </div>
  );
}

export function Cargando() {
  return (
    <div className="space-y-3" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl bg-stone-200/70" />
      ))}
    </div>
  );
}

export function Modal({ titulo, abierto, alCerrar, children }: { titulo: string; abierto: boolean; alCerrar: () => void; children: ReactNode }) {
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-stone-950/40 p-0 sm:items-center sm:p-4" onClick={alCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-stone-900">{titulo}</h2>
          <button onClick={alCerrar} className="rounded-lg px-2 py-1 text-stone-500 hover:bg-stone-100" aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
