import { CallHandler, Controller, ExecutionContext, Get, Global, Injectable, Module, NestInterceptor, Query } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { desc, eq } from 'drizzle-orm';
import { tap, type Observable } from 'rxjs';
import { formatearPesos, type RegistroBitacora } from '@elcuaderno/shared';
import { Roles, Usuario, type UsuarioToken } from '../auth/decoradores';
import { BaseDeDatos, InjectDb } from '../db/db.module';
import { bitacora } from '../db/esquema';

const POR_PAGINA = 50;

@Injectable()
export class BitacoraService {
  constructor(@InjectDb() private readonly db: BaseDeDatos) {}

  async registrar(usuario: UsuarioToken, accion: string, detalle?: string) {
    await this.db.insert(bitacora).values({
      tiendaId: usuario.tiendaId,
      usuarioId: usuario.id,
      usuarioNombre: usuario.nombre,
      accion,
      detalle: detalle ?? null,
    });
  }

  async listar(tiendaId: number, pagina = 1): Promise<RegistroBitacora[]> {
    const filas = await this.db
      .select()
      .from(bitacora)
      .where(eq(bitacora.tiendaId, tiendaId))
      .orderBy(desc(bitacora.creadoEn), desc(bitacora.id))
      .limit(POR_PAGINA)
      .offset((pagina - 1) * POR_PAGINA);
    return filas.map((f) => ({
      id: f.id,
      usuario: f.usuarioNombre,
      accion: f.accion,
      detalle: f.detalle,
      fecha: f.creadoEn.toISOString(),
    }));
  }
}

type Peticion = { params: Record<string, string>; body: Record<string, unknown> };
type Describir = (p: Peticion, respuesta: Record<string, unknown>) => string | undefined;

const num = (p: Peticion, nombre = 'id') => `#${p.params[nombre]}`;

/** Acciones que se anotan: método + ruta → texto para la dueña y detalle opcional. */
const ACCIONES: Record<string, [string, Describir?]> = {
  'POST /api/productos': ['Creó un producto', (_, r) => String(r.nombre)],
  'PUT /api/productos/:id': ['Editó un producto', (_, r) => `${r.nombre} · ${formatearPesos(Number(r.precio))}`],
  'PATCH /api/productos/:id/entrada': ['Registró llegada de mercancía', (p, r) => `${r.nombre}: +${p.body.cantidad} und.`],
  'DELETE /api/productos/:id': ['Quitó un producto', (p) => `Producto ${num(p)}`],
  // De los vecinos solo se anota el número, nunca el nombre: si piden borrar sus datos
  // (Ley 1581), la bitácora, que es inmutable, no puede quedarse con su nombre.
  'POST /api/clientes': ['Creó un cliente', (_, r) => `Cliente #${r.id}`],
  'PUT /api/clientes/:id': ['Editó un cliente', (p, r) => `Cliente ${num(p)} · cupo ${formatearPesos(Number(r.cupo))}`],
  'POST /api/clientes/:id/abonos': ['Registró un abono', (p) => `Cliente ${num(p)}: ${formatearPesos(Number(p.body.monto))}`],
  'POST /api/clientes/:id/suprimir': ['Suprimió los datos de un cliente', (p) => `Cliente ${num(p)}`],
  'POST /api/ventas': ['Registró una venta', (_, r) => `Venta #${r.id} · ${r.medio} · ${formatearPesos(Number(r.total))}`],
};

/** Después de cada cambio que salió bien, anota en la bitácora quién lo hizo. */
@Injectable()
export class BitacoraInterceptor implements NestInterceptor {
  constructor(private readonly servicio: BitacoraService) {}

  intercept(ctx: ExecutionContext, siguiente: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const clave = `${req.method} ${req.route?.path ?? ''}`;
    const accion = ACCIONES[clave];
    if (!accion || !req.usuario) return siguiente.handle();
    return siguiente.handle().pipe(
      tap((respuesta) => {
        const [texto, describir] = accion;
        const detalle = describir?.(req, (respuesta ?? {}) as Record<string, unknown>);
        void this.servicio.registrar(req.usuario, texto, detalle).catch((e) => console.error('No se pudo anotar en la bitácora', e));
      }),
    );
  }
}

@Controller('bitacora')
class BitacoraController {
  constructor(private readonly servicio: BitacoraService) {}

  @Roles('DUENO')
  @Get()
  listar(@Usuario() u: UsuarioToken, @Query('pagina') pagina?: string) {
    const n = Math.max(1, Math.min(Number.parseInt(pagina ?? '1', 10) || 1, 1000));
    return this.servicio.listar(u.tiendaId, n);
  }
}

@Global()
@Module({
  controllers: [BitacoraController],
  providers: [BitacoraService, { provide: APP_INTERCEPTOR, useClass: BitacoraInterceptor }],
  exports: [BitacoraService],
})
export class BitacoraModule {}
