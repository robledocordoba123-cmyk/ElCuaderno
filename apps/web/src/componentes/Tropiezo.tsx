// Si una pantalla falla por un error inesperado, en vez de dejar la página en blanco se muestra
// una hoja de "se rompió algo" con un botón para volver a abrir. Lo anotado no se pierde: vive en la API.
import { RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Boton } from './ui';

export class Tropiezo extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error en la pantalla', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto mt-16 max-w-md rounded-md border-2 border-stone-900 bg-stone-50 p-6 text-center sombra-tinta">
        <p className="font-mano text-4xl font-bold text-stone-900">Uy, se corrió la tinta</p>
        <p className="mt-2 text-sm text-stone-600">
          Esta pantalla tuvo un error inesperado. Lo que ya anotaste está guardado; vuelve a abrirla para seguir.
        </p>
        <Boton className="mt-5" onClick={() => window.location.reload()}>
          <RotateCcw size={16} /> Volver a abrir
        </Boton>
      </div>
    );
  }
}
