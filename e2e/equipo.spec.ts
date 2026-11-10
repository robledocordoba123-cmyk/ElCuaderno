// Una tienda nueva de principio a fin: se registra, crea un cajero, el cajero entra y,
// cuando la dueña lo desactiva, se le cierra la sesión.
import { expect, test } from '@playwright/test';

const CLAVE = 'Cuaderno2026';

test('registrar una tienda y manejar su equipo', async ({ browser, page }, info) => {
  const sufijo = `${Date.now()}${info.project.name}`;

  await page.goto('/');
  await page.getByRole('link', { name: 'Regístrala gratis' }).click();
  await expect(page.getByRole('heading', { name: 'Estrena tu cuaderno' })).toBeVisible();

  // Sin aceptar la política no deja seguir.
  await page.getByRole('button', { name: 'Registrar mi tienda' }).click();
  await expect(page.getByText('Debes aceptar la política de datos')).toBeVisible();

  await page.getByLabel('Nombre de la tienda').fill('Granero La Esquina');
  await page.getByLabel('Tu nombre').fill('Gloria');
  await page.getByLabel('Correo').fill(`gloria${sufijo}@prueba.co`);
  await page.getByLabel(/Contraseña/).fill(CLAVE);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Registrar mi tienda' }).click();
  await expect(page.getByPlaceholder('Buscar producto…')).toBeVisible();

  await page.goto('/cuenta');
  await page.getByRole('button', { name: 'Nuevo cajero' }).click();
  const modal = page.getByRole('dialog', { name: 'Nuevo cajero' });
  await modal.getByLabel('Nombre').fill('Valentina');
  await modal.getByLabel('Correo').fill(`vale${sufijo}@prueba.co`);
  await modal.getByLabel('Contraseña temporal').fill('Temporal123');
  await modal.getByRole('button', { name: 'Crear cajero' }).click();
  await expect(page.getByText(`vale${sufijo}@prueba.co`)).toBeVisible();

  // El cajero entra desde otro navegador.
  const otro = await browser.newContext();
  const cajero = await otro.newPage();
  await cajero.goto('/');
  await cajero.getByLabel('Correo').fill(`vale${sufijo}@prueba.co`);
  await cajero.getByLabel('Contraseña').fill('Temporal123');
  await cajero.getByRole('button', { name: 'Entrar' }).click();
  await expect(cajero.getByPlaceholder('Buscar producto…')).toBeVisible();

  await page.getByRole('button', { name: 'Desactivar' }).click();
  await expect(page.getByText('quedó desactivado')).toBeVisible();

  // Al moverse, al cajero se le cierra la sesión.
  await cajero.goto('/inventario');
  await expect(cajero.getByRole('heading', { name: 'Abre tu cuaderno' })).toBeVisible();
  await otro.close();
});
