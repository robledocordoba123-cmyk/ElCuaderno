// Recorridos reales de la tienda: entrar con las notas adhesivas, vender y ver la venta en la caja.
import { expect, test, type Page } from '@playwright/test';

async function entrarComo(page: Page, rol: 'dueña' | 'cajero') {
  await page.goto('/');
  await page.getByRole('button', { name: rol === 'dueña' ? 'Como dueña' : 'Como cajero' }).click();
  await expect(page.getByPlaceholder('Buscar producto…')).toBeVisible();
}

test('la dueña entra con un clic y ve todas sus pestañas', async ({ page }) => {
  await entrarComo(page, 'dueña');
  for (const pestaña of ['Inventario', 'Fiados', 'Caja', 'Equipo']) {
    await expect(page.getByRole('link', { name: pestaña }).first()).toBeAttached();
  }
});

test('el cajero no ve la caja ni el equipo', async ({ page }) => {
  await entrarComo(page, 'cajero');
  await expect(page.getByRole('link', { name: 'Mi cuenta' }).first()).toBeAttached();
  await expect(page.getByRole('link', { name: 'Caja' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Equipo' })).toHaveCount(0);
});

test('vende en efectivo y la venta queda registrada', async ({ page }) => {
  await entrarComo(page, 'dueña');
  await page.getByPlaceholder('Buscar producto…').fill('Jabón Rey');
  await page.getByRole('button', { name: /Jabón Rey/ }).click();
  await page.getByRole('button', { name: /Agregar uno de Jabón Rey/ }).click();
  await page.getByRole('button', { name: 'Cobrar' }).click();
  await expect(page.getByText(/Venta #\d+ registrada por \$\s?7\.000/)).toBeVisible();
});

test('una dirección que no existe vuelve a Vender', async ({ page }) => {
  await entrarComo(page, 'cajero');
  await page.goto('/no-existe');
  await expect(page.getByPlaceholder('Buscar producto…')).toBeVisible();
});
