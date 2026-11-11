// Equipo (dueña): quién atiende la tienda. Crea cajeros, los desactiva cuando se van y les pone
// una contraseña temporal si la olvidan. Todos, dueña y cajeros, cambian aquí su propia contraseña.
import { cajeroSchema, cambioClaveSchema, claveTemporalSchema, type MiembroEquipo } from '@elcuaderno/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, UserCheck, UserPlus, UserX } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { api, ErrorApi } from '../api/cliente';
import { Aviso, Boton, Campo, Cargando, Encabezado, Modal, Tarjeta } from '../componentes/ui';
import { useSesion } from '../sesion';

const erroresDe = (issues: { path: PropertyKey[]; message: string }[]) => Object.fromEntries(issues.map((i) => [String(i.path[0]), i.message]));
const mensaje = (e: unknown, porDefecto: string) => (e instanceof ErrorApi ? e.message : porDefecto);

export function Equipo() {
  const { esDueno } = useSesion();
  return (
    <>
      <Encabezado
        titulo={esDueno ? 'Equipo' : 'Mi cuenta'}
        detalle={esDueno ? 'Quién atiende la tienda. Un cajero que se va se desactiva: sus ventas siguen con su nombre.' : 'Cambia tu contraseña cuando quieras.'}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        {esDueno ? <Cajeros /> : null}
        <MiClave />
      </div>
    </>
  );
}

function Cajeros() {
  const queryClient = useQueryClient();
  const equipo = useQuery({ queryKey: ['equipo'], queryFn: () => api<MiembroEquipo[]>('/usuarios') });
  const [creando, setCreando] = useState(false);
  const [clavePara, setClavePara] = useState<MiembroEquipo | null>(null);
  const [error, setError] = useState('');
  const [listo, setListo] = useState('');

  const estado = useMutation({
    mutationFn: (u: MiembroEquipo) => api(`/usuarios/${u.id}/estado`, { metodo: 'PATCH', cuerpo: { activo: !u.activo } }),
    onSuccess: (_, u) => {
      setError('');
      setListo(u.activo ? `${u.nombre} quedó desactivado y se le cerró la sesión.` : `${u.nombre} puede volver a entrar.`);
      void queryClient.invalidateQueries({ queryKey: ['equipo'] });
      void queryClient.invalidateQueries({ queryKey: ['bitacora'] });
    },
    onError: (e) => {
      setListo('');
      setError(mensaje(e, 'No se pudo cambiar'));
    },
  });

  return (
    <section aria-label="Cajeros">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-stone-900">Personas</h2>
        <Boton onClick={() => setCreando(true)}>
          <UserPlus size={16} /> Nuevo cajero
        </Boton>
      </div>
      {listo && <div className="mb-3"><Aviso tipo="exito">{listo}</Aviso></div>}
      {error && <div className="mb-3"><Aviso>{error}</Aviso></div>}
      {equipo.isLoading ? (
        <Cargando />
      ) : (
        <Tarjeta className="p-0">
          <ul className="divide-y divide-dashed divide-stone-300">
            {(equipo.data ?? []).map((u) => (
              <li key={u.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${u.activo ? '' : 'bg-stone-100'}`}>
                <div className="min-w-0 flex-1">
                  <p className={`font-semibold ${u.activo ? 'text-stone-900' : 'text-stone-500 line-through decoration-margen'}`}>
                    {u.nombre}
                    {u.esUsted && <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-xs font-bold text-stone-800">Usted</span>}
                  </p>
                  <p className="truncate text-xs text-stone-600">
                    {u.rol === 'DUENO' ? 'Dueña' : 'Cajero'} · {u.email}
                    {!u.activo && ' · desactivado'}
                  </p>
                </div>
                {u.rol === 'CAJERO' && !u.deDemo && (
                  <div className="flex gap-2">
                    {u.activo && (
                      <Boton variante="secundario" className="px-3" onClick={() => setClavePara(u)} aria-label={`Clave temporal para ${u.nombre}`}>
                        <KeyRound size={16} /> <span className="hidden sm:inline">Clave</span>
                      </Boton>
                    )}
                    <Boton
                      variante={u.activo ? 'peligro' : 'secundario'}
                      className="px-3"
                      disabled={estado.isPending}
                      onClick={() => estado.mutate(u)}
                    >
                      {u.activo ? <UserX size={16} /> : <UserCheck size={16} />} {u.activo ? 'Desactivar' : 'Reactivar'}
                    </Boton>
                  </div>
                )}
                {u.deDemo && u.rol === 'CAJERO' && <span className="text-xs text-stone-500">Cuenta de la demo</span>}
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
      <NuevoCajero
        abierto={creando}
        alCerrar={() => setCreando(false)}
        alCrear={(nombre) => {
          setError('');
          setListo(`${nombre} ya puede entrar con su correo y la contraseña que le pusiste.`);
        }}
      />
      {clavePara && <ClaveTemporal cajero={clavePara} alCerrar={() => setClavePara(null)} alListo={(n) => setListo(`Listo: ${n} ya entra con la contraseña nueva.`)} />}
    </section>
  );
}

function NuevoCajero({ abierto, alCerrar, alCrear }: { abierto: boolean; alCerrar: () => void; alCrear: (nombre: string) => void }) {
  const queryClient = useQueryClient();
  const vacio = { nombre: '', email: '', password: '' };
  const [datos, setDatos] = useState(vacio);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const crear = useMutation({
    mutationFn: (d: typeof datos) => api<{ nombre: string }>('/usuarios', { metodo: 'POST', cuerpo: d }),
    onSuccess: (nuevo) => {
      void queryClient.invalidateQueries({ queryKey: ['equipo'] });
      alCrear(nuevo.nombre);
      setDatos(vacio);
      alCerrar();
    },
    onError: (e) => setError(mensaje(e, 'No se pudo crear el cajero')),
  });

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    const v = cajeroSchema.safeParse(datos);
    if (!v.success) return setErrores(erroresDe(v.error.issues));
    setErrores({});
    setError('');
    crear.mutate(v.data);
  }

  return (
    <Modal titulo="Nuevo cajero" abierto={abierto} alCerrar={alCerrar}>
      <form onSubmit={alEnviar} className="space-y-4" noValidate>
        <Campo etiqueta="Nombre" value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} error={errores.nombre} />
        <Campo etiqueta="Correo" type="email" autoComplete="off" value={datos.email} onChange={(e) => setDatos({ ...datos, email: e.target.value })} error={errores.email} />
        <Campo
          etiqueta="Contraseña temporal"
          type="text"
          autoComplete="off"
          value={datos.password}
          onChange={(e) => setDatos({ ...datos, password: e.target.value })}
          error={errores.password}
        />
        <p className="text-xs text-stone-600">Dásela en persona. Él la cambia en «Mi cuenta» la primera vez que entre.</p>
        {error && <Aviso>{error}</Aviso>}
        <Boton type="submit" disabled={crear.isPending} className="w-full">
          <UserPlus size={16} /> {crear.isPending ? 'Creando…' : 'Crear cajero'}
        </Boton>
      </form>
    </Modal>
  );
}

function ClaveTemporal({ cajero, alCerrar, alListo }: { cajero: MiembroEquipo; alCerrar: () => void; alListo: (nombre: string) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const poner = useMutation({
    mutationFn: () => api(`/usuarios/${cajero.id}/clave`, { metodo: 'POST', cuerpo: { password } }),
    onSuccess: () => {
      alListo(cajero.nombre);
      alCerrar();
    },
    onError: (e) => setError(mensaje(e, 'No se pudo cambiar la contraseña')),
  });

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    const v = claveTemporalSchema.safeParse({ password });
    if (!v.success) return setError(v.error.issues[0].message);
    setError('');
    poner.mutate();
  }

  return (
    <Modal titulo={`Contraseña para ${cajero.nombre}`} abierto alCerrar={alCerrar}>
      <form onSubmit={alEnviar} className="space-y-4" noValidate>
        <Campo etiqueta="Contraseña temporal" type="text" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
        <p className="text-xs text-stone-600">Si tenía la app abierta en otro celular, se le cierra.</p>
        {error && <Aviso>{error}</Aviso>}
        <Boton type="submit" disabled={poner.isPending} className="w-full">
          <KeyRound size={16} /> Guardar contraseña
        </Boton>
      </form>
    </Modal>
  );
}

function MiClave() {
  const vacio = { actual: '', nueva: '' };
  const [datos, setDatos] = useState(vacio);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);

  const cambiar = useMutation({
    mutationFn: (d: typeof datos) => api('/auth/clave', { metodo: 'PUT', cuerpo: d }),
    onSuccess: () => {
      setDatos(vacio);
      setListo(true);
    },
    onError: (e) => setError(mensaje(e, 'No se pudo cambiar la contraseña')),
  });

  function alEnviar(e: FormEvent) {
    e.preventDefault();
    setListo(false);
    const v = cambioClaveSchema.safeParse(datos);
    if (!v.success) return setErrores(erroresDe(v.error.issues));
    setErrores({});
    setError('');
    cambiar.mutate(v.data);
  }

  return (
    <Tarjeta>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-stone-900">
        <KeyRound size={18} /> Mi contraseña
      </h2>
      <form onSubmit={alEnviar} className="space-y-4" noValidate>
        <Campo etiqueta="Contraseña actual" type="password" autoComplete="current-password" value={datos.actual} onChange={(e) => setDatos({ ...datos, actual: e.target.value })} error={errores.actual} />
        <Campo
          etiqueta="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          value={datos.nueva}
          onChange={(e) => setDatos({ ...datos, nueva: e.target.value })}
          error={errores.nueva}
        />
        <p className="text-xs text-stone-600">8 o más caracteres, con letras y números. Se cierra la sesión en tus otros celulares.</p>
        {listo && <Aviso tipo="exito">Contraseña cambiada.</Aviso>}
        {error && <Aviso>{error}</Aviso>}
        <Boton type="submit" variante="secundario" disabled={cambiar.isPending} className="w-full">
          Cambiar contraseña
        </Boton>
      </form>
    </Tarjeta>
  );
}
