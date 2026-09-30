import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { Marco } from './componentes/Marco';
import './estilos.css';
import { Acceso } from './paginas/Acceso';
import { Caja } from './paginas/Caja';
import { Fiados } from './paginas/Fiados';
import { Inventario } from './paginas/Inventario';
import { Vender } from './paginas/Vender';
import { ProveedorSesion, useSesion } from './sesion';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true } },
});

function Rutas() {
  const { sesion, esDueno } = useSesion();
  if (!sesion) return <Acceso />;
  return (
    <Routes>
      <Route element={<Marco />}>
        <Route index element={<Vender />} />
        <Route path="inventario" element={<Inventario />} />
        <Route path="fiados" element={<Fiados />} />
        {esDueno && <Route path="caja" element={<Caja />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ProveedorSesion>
          <Rutas />
        </ProveedorSesion>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
