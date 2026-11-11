// Título, descripción y dirección canónica de cada página. Las públicas se pueden indexar;
// las de adentro de la tienda (piden sesión) se marcan noindex por si un buscador llega a verlas.
import { useEffect } from 'react';

const SITIO = 'https://elcuaderno-demo.vercel.app';

function etiqueta(selector: string, crear: () => HTMLElement) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = crear();
    document.head.appendChild(el);
  }
  return el;
}

export function MetaPagina({ titulo, descripcion, ruta, indexar = false }: { titulo: string; descripcion?: string; ruta?: string; indexar?: boolean }) {
  useEffect(() => {
    document.title = titulo === 'ElCuaderno' ? 'ElCuaderno · La tienda en el celular' : `${titulo} · ElCuaderno`;
    if (descripcion) etiqueta('meta[name="description"]', () => Object.assign(document.createElement('meta'), { name: 'description' })).setAttribute('content', descripcion);

    const canonica = etiqueta('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }));
    if (ruta !== undefined) canonica.setAttribute('href', SITIO + ruta);

    const robots = etiqueta('meta[name="robots"]', () => Object.assign(document.createElement('meta'), { name: 'robots' }));
    robots.setAttribute('content', indexar ? 'index, follow' : 'noindex');
  }, [titulo, descripcion, ruta, indexar]);
  return null;
}
