import type { LoginDto, Sesion } from '@elcuaderno/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, cuandoVenzaLaSesion, guardarSesion, sesionGuardada } from './api/cliente';

interface ValorSesion {
  sesion: Sesion | null;
  esDueno: boolean;
  entrar: (datos: LoginDto) => Promise<void>;
  salir: () => void;
}

const ContextoSesion = createContext<ValorSesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(sesionGuardada);
  const queryClient = useQueryClient();

  const salir = useCallback(() => {
    guardarSesion(null);
    setSesion(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => cuandoVenzaLaSesion(salir), [salir]);

  const entrar = useCallback(async (datos: LoginDto) => {
    const nueva = await api<Sesion>('/auth/login', { metodo: 'POST', cuerpo: datos });
    guardarSesion(nueva);
    setSesion(nueva);
  }, []);

  const valor = useMemo(
    () => ({ sesion, esDueno: sesion?.usuario.rol === 'DUENO', entrar, salir }),
    [sesion, entrar, salir],
  );
  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

export function useSesion() {
  const valor = useContext(ContextoSesion);
  if (!valor) throw new Error('useSesion debe usarse dentro de ProveedorSesion');
  return valor;
}
