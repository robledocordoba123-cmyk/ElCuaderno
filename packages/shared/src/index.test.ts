// Pruebas unitarias de la lógica compartida: lo que calcula el navegador tiene que dar
// exactamente lo mismo que calcula el servidor, porque ambos usan estas funciones.
import { describe, expect, it } from 'vitest';
import {
  cajeroSchema,
  claveNueva,
  clienteSchema,
  formatearCantidad,
  formatearPesos,
  gramosPorPlata,
  productoSchema,
  registroSchema,
  subtotalLinea,
  ventaSchema,
} from './index';

describe('subtotalLinea', () => {
  it('por unidad multiplica precio por cantidad', () => {
    expect(subtotalLinea(3200, 3, false)).toBe(9600);
  });

  it('por peso cobra el kilo proporcional y redondea a 50 pesos', () => {
    expect(subtotalLinea(24000, 250, true)).toBe(6000); // media libra de queso
    expect(subtotalLinea(12000, 125, true)).toBe(1500);
    // 4.800 el kilo × 333 g = 1.598,4 → 1.600
    expect(subtotalLinea(4800, 333, true)).toBe(1600);
    // 4.800 × 330 g = 1.584 → 1.600; 4.800 × 320 g = 1.536 → 1.550
    expect(subtotalLinea(4800, 320, true)).toBe(1550);
  });

  it('el resultado por peso siempre es múltiplo de 50', () => {
    for (let gramos = 1; gramos <= 2000; gramos += 37) {
      expect(subtotalLinea(19900, gramos, true) % 50).toBe(0);
    }
  });
});

describe('gramosPorPlata', () => {
  it('"deme 2.000 de queso" a 24.000 el kilo son 83 g (nunca se pasa de la plata)', () => {
    expect(gramosPorPlata(24000, 2000)).toBe(83);
    expect(subtotalLinea(24000, gramosPorPlata(24000, 2000), true)).toBeLessThanOrEqual(2000);
  });
});

describe('formatearCantidad y formatearPesos', () => {
  it('muestra unidades, gramos y kilos como en la tienda', () => {
    expect(formatearCantidad(3, false)).toBe('3 und.');
    expect(formatearCantidad(250, true)).toBe('250 g');
    expect(formatearCantidad(1500, true)).toBe('1,5 kg');
  });

  it('pesos colombianos sin decimales', () => {
    expect(formatearPesos(12500).replace(/\s/g, ' ')).toBe('$ 12.500');
  });
});

describe('esquemas', () => {
  it('un producto no puede costar más de lo que se vende', () => {
    const r = productoSchema.safeParse({ nombre: 'Arroz', precio: 3000, costo: 3500, stock: 1, stockMinimo: 0 });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(['costo']);
  });

  it('el dinero no acepta decimales', () => {
    expect(productoSchema.safeParse({ nombre: 'Arroz', precio: 3000.5, costo: 2000, stock: 1, stockMinimo: 0 }).success).toBe(false);
  });

  it('para fiar hay que escoger el cliente y no se repiten productos', () => {
    expect(ventaSchema.safeParse({ medio: 'FIADO', items: [{ productoId: 1, cantidad: 1 }] }).success).toBe(false);
    expect(
      ventaSchema.safeParse({ medio: 'EFECTIVO', items: [{ productoId: 1, cantidad: 1 }, { productoId: 1, cantidad: 2 }] }).success,
    ).toBe(false);
    expect(ventaSchema.safeParse({ medio: 'FIADO', clienteId: 4, items: [{ productoId: 1, cantidad: 1 }] }).success).toBe(true);
  });

  it('sin la autorización del vecino no se guarda el cliente (Ley 1581)', () => {
    expect(clienteSchema.safeParse({ nombre: 'Don Jairo', cupo: 0, autorizaDatos: false }).success).toBe(false);
    expect(clienteSchema.safeParse({ nombre: 'Don Jairo', cupo: 0, telefono: '', autorizaDatos: true }).success).toBe(true);
  });

  it('la contraseña nueva pide 8 caracteres, letras y números', () => {
    expect(claveNueva.safeParse('corta1').success).toBe(false);
    expect(claveNueva.safeParse('soloLetras').success).toBe(false);
    expect(claveNueva.safeParse('12345678').success).toBe(false);
    expect(claveNueva.safeParse('Cuaderno2026').success).toBe(true);
  });

  it('el registro exige aceptar la política y normaliza el correo', () => {
    const base = { tienda: 'Granero', nombre: 'Gloria', email: '  Gloria@Prueba.CO ', password: 'Cuaderno2026' };
    expect(registroSchema.safeParse({ ...base, aceptaPolitica: false }).success).toBe(false);
    const ok = registroSchema.safeParse({ ...base, aceptaPolitica: true });
    expect(ok.success && ok.data.email).toBe('gloria@prueba.co');
    expect(cajeroSchema.safeParse({ nombre: 'V', email: 'v@p.co', password: 'Cuaderno2026' }).success).toBe(false);
  });
});
