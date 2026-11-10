// Equipo de la tienda: la dueña crea cajeros, los desactiva cuando se van y les pone una
// contraseña temporal si la olvidan. Nada se borra: las ventas siguen nombrando a quien las hizo.
import { Body, Controller, ForbiddenException, Get, HttpCode, Injectable, Module, Param, Patch, Post } from '@nestjs/common';
import { IdPipe } from '../comun/id.pipe';
import { hash } from 'bcryptjs';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import {
  cajeroSchema,
  claveTemporalSchema,
  estadoUsuarioSchema,
  MAXIMO_CAJEROS,
  type CajeroDto,
  type MiembroEquipo,
} from '@elcuaderno/shared';
import { COSTO_BCRYPT } from '../auth/auth.service';
import { Roles, Usuario, type UsuarioToken } from '../auth/decoradores';
import { BitacoraService } from '../bitacora/bitacora';
import { NoEncontrado, ReglaDeNegocio } from '../comun/errores';
import { ZodPipe } from '../comun/zod.pipe';
import { BaseDeDatos, InjectDb } from '../db/db.module';
import { usuarios } from '../db/esquema';
import { esCuentaDemo } from '../demo/cuentas';

const ES_DUPLICADO = (e: unknown) => {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === '23505' || err?.cause?.code === '23505';
};

@Injectable()
export class UsuariosService {
  constructor(
    @InjectDb() private readonly db: BaseDeDatos,
    private readonly bitacora: BitacoraService,
  ) {}

  async listar(quien: UsuarioToken): Promise<MiembroEquipo[]> {
    const filas = await this.db
      .select()
      .from(usuarios)
      .where(eq(usuarios.tiendaId, quien.tiendaId))
      .orderBy(asc(usuarios.rol), sql`${usuarios.activo} DESC`, asc(usuarios.nombre));
    return filas.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      activo: u.activo,
      esUsted: u.id === quien.id,
      deDemo: esCuentaDemo(u.email),
      creadoEn: u.creadoEn.toISOString(),
    }));
  }

  async crearCajero(quien: UsuarioToken, datos: CajeroDto) {
    const [{ activos }] = await this.db
      .select({ activos: count() })
      .from(usuarios)
      .where(and(eq(usuarios.tiendaId, quien.tiendaId), eq(usuarios.rol, 'CAJERO'), eq(usuarios.activo, true)));
    if (activos >= MAXIMO_CAJEROS) throw new ReglaDeNegocio(`La tienda ya tiene ${MAXIMO_CAJEROS} cajeros activos. Desactiva uno para crear otro.`);

    try {
      const [nuevo] = await this.db
        .insert(usuarios)
        .values({ tiendaId: quien.tiendaId, nombre: datos.nombre, email: datos.email, passwordHash: await hash(datos.password, COSTO_BCRYPT), rol: 'CAJERO' })
        .returning();
      await this.bitacora.registrar(quien, 'Creó un cajero', nuevo.nombre);
      return { id: nuevo.id, nombre: nuevo.nombre };
    } catch (e) {
      if (ES_DUPLICADO(e)) throw new ReglaDeNegocio('Ese correo ya tiene una cuenta en ElCuaderno');
      throw e;
    }
  }

  async cambiarEstado(quien: UsuarioToken, id: number, activo: boolean) {
    const cajero = await this.cajeroDeLaTienda(quien, id);
    if (cajero.activo === activo) return { id, activo };
    if (activo) {
      const [{ activos }] = await this.db
        .select({ activos: count() })
        .from(usuarios)
        .where(and(eq(usuarios.tiendaId, quien.tiendaId), eq(usuarios.rol, 'CAJERO'), eq(usuarios.activo, true)));
      if (activos >= MAXIMO_CAJEROS) throw new ReglaDeNegocio(`La tienda ya tiene ${MAXIMO_CAJEROS} cajeros activos.`);
    }
    // Al desactivar se sube la versión de sesión: si tenía la app abierta, se le cierra ya.
    await this.db
      .update(usuarios)
      .set({ activo, versionSesion: sql`${usuarios.versionSesion} + 1` })
      .where(eq(usuarios.id, id));
    await this.bitacora.registrar(quien, activo ? 'Reactivó a un cajero' : 'Desactivó a un cajero', cajero.nombre);
    return { id, activo };
  }

  /** Contraseña temporal para un cajero que olvidó la suya. Sus sesiones abiertas se cierran. */
  async ponerClave(quien: UsuarioToken, id: number, password: string) {
    const cajero = await this.cajeroDeLaTienda(quien, id);
    await this.db
      .update(usuarios)
      .set({ passwordHash: await hash(password, COSTO_BCRYPT), versionSesion: sql`${usuarios.versionSesion} + 1` })
      .where(eq(usuarios.id, id));
    await this.bitacora.registrar(quien, 'Puso una contraseña temporal', cajero.nombre);
  }

  /** Solo se manejan cajeros de la propia tienda; la dueña no se desactiva a sí misma. */
  private async cajeroDeLaTienda(quien: UsuarioToken, id: number) {
    const [u] = await this.db.select().from(usuarios).where(and(eq(usuarios.id, id), eq(usuarios.tiendaId, quien.tiendaId)));
    if (!u) throw new NoEncontrado('El usuario');
    if (u.rol !== 'CAJERO') throw new ReglaDeNegocio('Desde aquí solo se manejan los cajeros');
    if (esCuentaDemo(u.email)) throw new ForbiddenException('El cajero de la demostración no se puede cambiar: otras personas lo están usando');
    return u;
  }
}

@Controller('usuarios')
@Roles('DUENO')
export class UsuariosController {
  constructor(private readonly servicio: UsuariosService) {}

  @Get()
  listar(@Usuario() quien: UsuarioToken) {
    return this.servicio.listar(quien);
  }

  @Post()
  crear(@Usuario() quien: UsuarioToken, @Body(new ZodPipe(cajeroSchema)) datos: CajeroDto) {
    return this.servicio.crearCajero(quien, datos);
  }

  @Patch(':id/estado')
  estado(@Usuario() quien: UsuarioToken, @Param('id', IdPipe) id: number, @Body(new ZodPipe(estadoUsuarioSchema)) datos: { activo: boolean }) {
    return this.servicio.cambiarEstado(quien, id, datos.activo);
  }

  @Post(':id/clave')
  @HttpCode(204)
  clave(@Usuario() quien: UsuarioToken, @Param('id', IdPipe) id: number, @Body(new ZodPipe(claveTemporalSchema)) datos: { password: string }) {
    return this.servicio.ponerClave(quien, id, datos.password);
  }
}

@Module({ controllers: [UsuariosController], providers: [UsuariosService] })
export class UsuariosModule {}
