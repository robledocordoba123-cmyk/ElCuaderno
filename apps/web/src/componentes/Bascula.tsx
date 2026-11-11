// Báscula: al tocar un producto por peso se escoge cuánto llevar. Se puede pedir por peso
// (cuarto, media libra, libra, kilo o los gramos exactos) o por plata ("deme 2.000 de queso").
import { formatearCantidad, formatearPesos, gramosPorPlata, PESO_MAXIMO_GRAMOS, subtotalLinea, type Producto } from '@elcuaderno/shared';
import { useState } from 'react';
import { Boton, Modal } from './ui';

const RAPIDOS = [
  { gramos: 125, texto: '¼ lb' },
  { gramos: 250, texto: '½ lb' },
  { gramos: 500, texto: '1 lb' },
  { gramos: 1000, texto: '1 kg' },
];

export function Bascula({
  producto,
  inicial,
  alListo,
  alCerrar,
}: {
  producto: Producto;
  /** Gramos que ya hay en la venta (para corregirlos), o 0 si es nuevo. */
  inicial: number;
  alListo: (gramos: number) => void;
  alCerrar: () => void;
}) {
  const [modo, setModo] = useState<'peso' | 'plata'>('peso');
  const [texto, setTexto] = useState(inicial ? String(inicial) : '');
  const valor = Number.parseInt(texto.replace(/\D/g, ''), 10) || 0;
  const gramos = modo === 'peso' ? valor : gramosPorPlata(producto.precio, valor);
  const cobro = subtotalLinea(producto.precio, gramos, true);

  let problema = '';
  if (gramos > producto.stock) problema = `Solo quedan ${formatearCantidad(producto.stock, true)}`;
  else if (gramos > PESO_MAXIMO_GRAMOS) problema = 'Máximo 50 kg por venta';
  else if (valor > 0 && cobro === 0) problema = 'Es muy poquito: no alcanza ni a $ 50';
  const sirve = gramos > 0 && !problema;

  return (
    <Modal titulo={producto.nombre} abierto alCerrar={alCerrar}>
      <p className="-mt-2 mb-4 text-sm text-stone-500">
        {formatearPesos(producto.precio)} el kilo · quedan {formatearCantidad(producto.stock, true)}
      </p>

      <div className="mb-4 grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Cómo lo pide">
        {(
          [
            ['peso', 'Por peso'],
            ['plata', 'Por plata'],
          ] as const
        ).map(([m, t]) => (
          <button
            key={m}
            role="radio"
            aria-checked={modo === m}
            onClick={() => {
              setModo(m);
              setTexto('');
            }}
            className={`rounded-md border-2 py-1.5 text-sm font-bold transition ${
              modo === m ? 'border-stone-900 bg-stone-900 text-amber-300' : 'border-stone-200 text-stone-500 hover:border-stone-400'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {modo === 'peso' && (
        <div className="mb-3 grid grid-cols-4 gap-2">
          {RAPIDOS.map((r) => (
            <button
              key={r.gramos}
              onClick={() => setTexto(String(r.gramos))}
              disabled={r.gramos > producto.stock}
              className={`rounded-lg border-2 py-2 text-sm font-bold transition disabled:opacity-40 ${
                gramos === r.gramos
                  ? 'border-stone-900 bg-amber-300 text-stone-900'
                  : 'border-stone-300 bg-stone-50 text-stone-700 hover:border-stone-900'
              }`}
            >
              {r.texto}
              <span className="block text-[10px] font-normal text-stone-500">{r.gramos} g</span>
            </button>
          ))}
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-stone-700">{modo === 'peso' ? 'Gramos' : '¿Cuánta plata?'}</span>
        <div className="flex items-center rounded-lg border-2 border-stone-300 bg-stone-50 focus-within:border-stone-900 focus-within:bg-white">
          {modo === 'plata' && <span className="pl-3 font-mono text-stone-500">$</span>}
          <input
            inputMode="numeric"
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value.replace(/\D/g, '').slice(0, 7))}
            onKeyDown={(e) => e.key === 'Enter' && sirve && alListo(gramos)}
            placeholder={modo === 'peso' ? 'Ej.: 250' : 'Ej.: 2000'}
            className="w-full bg-transparent px-3 py-2.5 font-mono text-lg outline-none"
          />
          {modo === 'peso' && <span className="pr-3 font-mono text-stone-500">g</span>}
        </div>
      </label>

      {/* Lo que marca la báscula: peso y cuánto se cobra. */}
      <div className="mt-4 flex items-baseline justify-between rounded-lg border-2 border-dashed border-stone-300 bg-white px-4 py-3 font-mono">
        <span className="text-stone-600">{gramos > 0 ? formatearCantidad(gramos, true) : '— g'}</span>
        <span className="text-2xl font-bold text-stone-900">{formatearPesos(cobro)}</span>
      </div>
      <p className="mt-1 text-xs text-stone-500">Se redondea a los $ 50 más cercanos.</p>
      {problema && <p className="mt-2 text-sm font-semibold text-margen-tinta">{problema}</p>}

      <div className="mt-5 flex gap-2">
        <Boton variante="secundario" onClick={alCerrar} className="flex-1">
          Cancelar
        </Boton>
        <Boton onClick={() => alListo(gramos)} disabled={!sirve} className="flex-1">
          {inicial ? 'Cambiar' : 'Agregar'}
        </Boton>
      </div>
    </Modal>
  );
}
