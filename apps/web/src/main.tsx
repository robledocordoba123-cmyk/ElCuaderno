import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Marco } from './componentes/Marco';
import { Tropiezo } from './componentes/Tropiezo';
import './estilos.css';
import { Acceso } from './paginas/Acceso';
import { Bitacora } from './paginas/Bitacora';
import { Caja } from './paginas/Caja';
import { Equipo } from './paginas/Equipo';
import { Fiados } from './paginas/Fiados';
import { Inventario } from './paginas/Inventario';
import { Privacidad } from './paginas/Privacidad';
import { Registro } from './paginas/Registro';
import { Reportes } from './paginas/Reportes';
import { Vender } from './paginas/Vender';
import { ProveedorSesion, useSesion } from './sesion';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true } },
});

function Rutas() {
  const { sesion, esDueno } = useSesion();
  return (
    <Routes>
      {/* La política de datos se puede leer sin iniciar sesión. */}
      <Route path="privacidad" element={<Privacidad />} />
      {!sesion ? (
        <>
          <Route path="registro" element={<Registro />} />
          <Route path="*" element={<Acceso />} />
        </>
      ) : (
        <Route element={<Marco />}>
          <Route index element={<Vender />} />
          <Route path="inventario" element={<Inventario />} />
          <Route path="fiados" element={<Fiados />} />
          <Route path="cuenta" element={<Equipo />} />
          {esDueno && <Route path="caja" element={<Caja />} />}
          {esDueno && <Route path="bitacora" element={<Bitacora />} />}
          {esDueno && <Route path="reportes" element={<Reportes />} />}
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
            <Rutas />
          </Tropiezo>
        </ProveedorSesion>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
