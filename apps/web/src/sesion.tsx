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

  const olvidar = useCallback(() => {
    guardarSesion(null);
    setSesion(null);
    queryClient.clear();
  }, [queryClient]);

  // Pide a la API que borre la cookie; aunque falle la red, en este navegador se cierra igual.
  const salir = useCallback(() => {
    void api('/auth/salir', { metodo: 'POST' }).catch(() => undefined);
    olvidar();
  }, [olvidar]);

  useEffect(() => cuandoVenzaLaSesion(olvidar), [olvidar]);

  // Al abrir, confirma con la API que la cookie sigue siendo válida (puede haber vencido).
  useEffect(() => {
    if (!sesionGuardada()) return;
    api<Sesion>('/auth/yo')
      .then((s) => {
        guardarSesion(s);
        setSesion(s);
      })
      .catch(() => undefined);
  }, []);

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
