// Datos de demostración: "Tienda Doña Rosa" con productos, vecinos que fían y una semana de ventas.
// Se puede ejecutar muchas veces: borra y recrea solo la tienda de demo.
import { hashSync } from 'bcryptjs';
import { eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config';
import * as esquema from '../db/esquema';
import { abonos, clientes, detallesVenta, productos, tiendas, usuarios, ventas } from '../db/esquema';
import { diaLocal, limitesDelDia } from '../tiempo';

export const DEMO = {
  tienda: 'Tienda Doña Rosa',
  dueno: { email: 'rosa@elcuaderno.co', nombre: 'Rosa (demo)' },
  cajero: { email: 'cajero@elcuaderno.co', nombre: 'Santiago (demo)' },
  password: 'Demo2026!',
};

const PRODUCTOS = [
  { nombre: 'Arroz Diana 500 g', precio: 3200, costo: 2600, stock: 48, stockMinimo: 10 },
  { nombre: 'Aceite Premier 1 L', precio: 11900, costo: 9800, stock: 14, stockMinimo: 5 },
  { nombre: 'Huevo AA (unidad)', precio: 700, costo: 520, stock: 90, stockMinimo: 30 },
  { nombre: 'Leche Alquería 1 L', precio: 4600, costo: 3900, stock: 22, stockMinimo: 8 },
  { nombre: 'Pan tajado Bimbo', precio: 7500, costo: 6100, stock: 6, stockMinimo: 5 },
  { nombre: 'Café Sello Rojo 250 g', precio: 10500, costo: 8700, stock: 12, stockMinimo: 4 },
  { nombre: 'Panela 500 g', precio: 3800, costo: 2900, stock: 3, stockMinimo: 6 },
  { nombre: 'Azúcar Manuelita 1 kg', precio: 5200, costo: 4300, stock: 18, stockMinimo: 5 },
  { nombre: 'Gaseosa Postobón 400 ml', precio: 2500, costo: 1800, stock: 40, stockMinimo: 12 },
  { nombre: 'Coca-Cola 1,5 L', precio: 6500, costo: 5200, stock: 15, stockMinimo: 6 },
  { nombre: 'Papas Margarita', precio: 2800, costo: 2100, stock: 30, stockMinimo: 10 },
  { nombre: 'Chocoramo', precio: 2600, costo: 1950, stock: 4, stockMinimo: 8 },
  { nombre: 'Atún Van Camp’s', precio: 8900, costo: 7300, stock: 10, stockMinimo: 4 },
  { nombre: 'Jabón Rey', precio: 3500, costo: 2700, stock: 20, stockMinimo: 6 },
  { nombre: 'Cerveza Águila lata', precio: 3300, costo: 2500, stock: 60, stockMinimo: 24 },
  { nombre: 'Agua Cristal 600 ml', precio: 2000, costo: 1300, stock: 2, stockMinimo: 10 },
];

const CLIENTES = [
  { nombre: 'Don Jairo', telefono: '3104567890', cupo: 150000 },
  { nombre: 'Doña Marta', telefono: '3157778899', cupo: 100000 },
  { nombre: 'Carmenza', telefono: '3001234567', cupo: 80000 },
  { nombre: 'Pedro el taxista', telefono: '3209876543', cupo: 60000 },
  { nombre: 'Luisito (2.º piso)', telefono: '', cupo: 30000 },
];

/** Generador pseudoaleatorio con semilla: la demo sale igual cada vez. */
function aleatorio(semilla: number) {
  return () => {
    semilla = (semilla * 1664525 + 1013904223) % 4294967296;
    return semilla / 4294967296;
  };
}

export async function sembrarDemo(db = drizzle(new Pool({ connectionString: config.databaseUrl }), { schema: esquema })) {
  const azar = aleatorio(2026);
  const entre = (min: number, max: number) => min + Math.floor(azar() * (max - min + 1));

  await db.transaction(async (tx) => {
    // Borra la tienda de demo anterior (y todo lo suyo) para empezar limpio.
    const anteriores = await tx.select({ id: tiendas.id }).from(tiendas).where(eq(tiendas.nombre, DEMO.tienda));
    const ids = anteriores.map((t) => t.id);
    if (ids.length) {
      const ventasViejas = await tx.select({ id: ventas.id }).from(ventas).where(inArray(ventas.tiendaId, ids));
      if (ventasViejas.length) {
        await tx.delete(detallesVenta).where(inArray(detallesVenta.ventaId, ventasViejas.map((v) => v.id)));
      }
      await tx.delete(ventas).where(inArray(ventas.tiendaId, ids));
      await tx.delete(abonos).where(inArray(abonos.tiendaId, ids));
      await tx.delete(clientes).where(inArray(clientes.tiendaId, ids));
      await tx.delete(productos).where(inArray(productos.tiendaId, ids));
      await tx.delete(usuarios).where(inArray(usuarios.tiendaId, ids));
      await tx.delete(tiendas).where(inArray(tiendas.id, ids));
    }

    const [tienda] = await tx.insert(tiendas).values({ nombre: DEMO.tienda }).returning();
    const hash = hashSync(DEMO.password, 10);
    const [dueno, cajero] = await tx
      .insert(usuarios)
      .values([
        { tiendaId: tienda.id, ...DEMO.dueno, passwordHash: hash, rol: 'DUENO' as const },
        { tiendaId: tienda.id, ...DEMO.cajero, passwordHash: hash, rol: 'CAJERO' as const },
      ])
      .returning();

    // El stock de la lista es el que queda HOY; al histórico de ventas se le suma lo vendido.
    const listaProductos = await tx
      .insert(productos)
      .values(PRODUCTOS.map((p) => ({ ...p, tiendaId: tienda.id })))
      .returning();
    const listaClientes = await tx
      .insert(clientes)
      .values(CLIENTES.map((c) => ({ ...c, telefono: c.telefono || null, tiendaId: tienda.id })))
      .returning();

    const deuda = new Map<number, number>(listaClientes.map((c) => [c.id, 0]));
    const ahora = Date.now();
    const DIA = 24 * 60 * 60 * 1000;

    for (let diasAtras = 6; diasAtras >= 0; diasAtras--) {
      const cantidad = entre(14, 22);
      for (let n = 0; n < cantidad; n++) {
        // Hora entre 7:00 a. m. y 9:00 p. m. de Colombia.
        const { desde } = limitesDelDia(diaLocal(new Date(ahora - diasAtras * DIA)));
        const momento = desde.getTime() + (7 * 60 + entre(0, 14 * 60)) * 60 * 1000;
        if (momento > ahora) continue;

        const items = new Map<number, number>();
        for (let k = 0, lineas = entre(1, 4); k < lineas; k++) {
          const p = listaProductos[entre(0, listaProductos.length - 1)];
          items.set(p.id, (items.get(p.id) ?? 0) + entre(1, 3));
        }
        const detalles = [...items].map(([id, cant]) => {
          const p = listaProductos.find((x) => x.id === id)!;
          return { productoId: id, cantidad: cant, precioUnitario: p.precio, costoUnitario: p.costo };
        });
        const total = detalles.reduce((s, d) => s + d.precioUnitario * d.cantidad, 0);

        const dado = azar();
        let medio: 'EFECTIVO' | 'NEQUI' | 'FIADO' = dado < 0.55 ? 'EFECTIVO' : dado < 0.8 ? 'NEQUI' : 'FIADO';
        let clienteId: number | null = null;
        if (medio === 'FIADO') {
          const c = listaClientes[entre(0, listaClientes.length - 1)];
          if (deuda.get(c.id)! + total <= c.cupo) {
            clienteId = c.id;
            deuda.set(c.id, deuda.get(c.id)! + total);
          } else {
            medio = 'EFECTIVO';
          }
        }

        const [venta] = await tx
          .insert(ventas)
          .values({
            tiendaId: tienda.id,
            usuarioId: n % 3 === 0 ? dueno.id : cajero.id,
            clienteId,
            medio,
            total,
            creadaEn: new Date(momento),
          })
          .returning({ id: ventas.id });
        await tx.insert(detallesVenta).values(detalles.map((d) => ({ ...d, ventaId: venta.id })));
      }

      // Algunos vecinos abonan al final del día.
      for (const c of listaClientes) {
        const debe = deuda.get(c.id)!;
        if (debe > 20000 && azar() < 0.35) {
          const monto = Math.min(debe, entre(1, 4) * 10000);
          const momento = Math.min(ahora - 60 * 1000, ahora - diasAtras * DIA);
          await tx.insert(abonos).values({ tiendaId: tienda.id, clienteId: c.id, usuarioId: cajero.id, monto, creadoEn: new Date(momento) });
          deuda.set(c.id, debe - monto);
        }
      }
    }
  });
}

if (require.main === module) {
  sembrarDemo()
    .then(() => {
      console.log(`Demo lista: ${DEMO.tienda} (${DEMO.dueno.email} / ${DEMO.password})`);
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
