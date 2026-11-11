import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Marco } from './componentes/Marco';
import { MetaPagina } from './componentes/MetaPagina';
import { Tropiezo } from './componentes/Tropiezo';
// Fuentes servidas desde el mismo sitio (antes venían de Google Fonts y frenaban la primera pintura).
// Cada archivo trae solo el alfabeto latino (incluye tildes y ñ).
import '@fontsource-variable/lexend/wght.css';
import '@fontsource/caveat/latin-600.css';
import '@fontsource/caveat/latin-700.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import './estilos.css';
import { Acceso } from './paginas/Acceso';
import { ProveedorSesion, useSesion } from './sesion';

// El acceso va en el paquete inicial (es lo primero que ve quien llega). Las demás pantallas se
// descargan cuando se abren: así la primera carga pesa menos, sobre todo en un celular con datos.
const porNombre = <K extends string>(carga: () => Promise<Record<K, React.ComponentType>>, nombre: K) =>
  lazy(() => carga().then((m) => ({ default: m[nombre] })));
const Bitacora = porNombre(() => import('./paginas/Bitacora'), 'Bitacora');
const Caja = porNombre(() => import('./paginas/Caja'), 'Caja');
const Equipo = porNombre(() => import('./paginas/Equipo'), 'Equipo');
const Fiados = porNombre(() => import('./paginas/Fiados'), 'Fiados');
const Inventario = porNombre(() => import('./paginas/Inventario'), 'Inventario');
const Privacidad = porNombre(() => import('./paginas/Privacidad'), 'Privacidad');
const Registro = porNombre(() => import('./paginas/Registro'), 'Registro');
const Reportes = porNombre(() => import('./paginas/Reportes'), 'Reportes');
const Vender = porNombre(() => import('./paginas/Vender'), 'Vender');

// Si se publicó una versión nueva mientras la app estaba abierta, los pedazos viejos ya no existen:
// se recarga una sola vez para traer los nuevos en lugar de mostrar un error.
window.addEventListener('vite:preloadError', (evento) => {
  try {
    if (sessionStorage.getItem('elcuaderno.recargado')) return;
    sessionStorage.setItem('elcuaderno.recargado', '1');
  } catch {
    /* Sin sessionStorage: se intenta igual. */
  }
  evento.preventDefault();
  window.location.reload();
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true } },
});

function Rutas() {
  const { sesion, esDueno } = useSesion();
  return (
    <Routes>
      {/* La política de datos se puede leer sin iniciar sesión. */}
      <Route
        path="privacidad"
        element={
          <>
            <MetaPagina titulo="Política de tratamiento de datos" descripcion="Cómo ElCuaderno trata los datos de las tiendas y de sus vecinos, según la Ley 1581 de 2012." ruta="/privacidad" indexar />
            <Privacidad />
          </>
        }
      />
      {!sesion ? (
        <>
          <Route
            path="registro"
            element={
              <>
                <MetaPagina titulo="Registra tu tienda" descripcion="Estrena el cuaderno de tu tienda: ventas, inventario y fiados desde el celular. Gratis." ruta="/registro" indexar />
                <Registro />
              </>
            }
          />
          <Route
            path="*"
            element={
              <>
                <MetaPagina titulo="ElCuaderno" ruta="/" indexar />
                <Acceso />
              </>
            }
          />
        </>
      ) : (
        <Route element={<Marco />}>
          <Route index element={<><MetaPagina titulo="Vender" /><Vender /></>} />
          <Route path="inventario" element={<><MetaPagina titulo="Inventario" /><Inventario /></>} />
          <Route path="fiados" element={<><MetaPagina titulo="Fiados" /><Fiados /></>} />
          <Route path="cuenta" element={<><MetaPagina titulo="Equipo" /><Equipo /></>} />
          {esDueno && <Route path="caja" element={<><MetaPagina titulo="Caja" /><Caja /></>} />}
          {esDueno && <Route path="bitacora" element={<><MetaPagina titulo="Bitácora" /><Bitacora /></>} />}
          {esDueno && <Route path="reportes" element={<><MetaPagina titulo="Reportes" /><Reportes /></>} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ProveedorSesion>
          <Tropiezo>
            <Suspense fallback={null}>
              <Rutas />
            </Suspense>
          </Tropiezo>
        </ProveedorSesion>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
