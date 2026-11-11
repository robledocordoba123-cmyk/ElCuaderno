// Accesibilidad con axe-core (WCAG 2.1 A y AA) en todas las pantallas, públicas y de la tienda.
// Falla con cualquier problema serio o crítico: contraste, etiquetas, nombres de botones, roles...
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function revisar(page: Page, donde: string) {
  const resultado = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const graves = resultado.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
  expect(graves, `Problemas de accesibilidad en ${donde}`).toEqual([]);
}

test('páginas públicas', async ({ page }) => {
  for (const ruta of ['/', '/registro', '/privacidad']) {
    await page.goto(ruta);
    await page.waitForLoadState('networkidle');
    await revisar(page, ruta);
  }
});

test('pantallas de la dueña, con un modal abierto', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Como dueña' }).click();
  await expect(page.getByPlaceholder('Buscar producto…')).toBeVisible();
  for (const ruta of ['/', '/inventario', '/fiados', '/caja', '/reportes', '/bitacora', '/cuenta']) {
    await page.goto(ruta);
    await page.waitForLoadState('networkidle');
    await revisar(page, ruta);
  }
  await page.getByRole('button', { name: 'Nuevo cajero' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await revisar(page, 'modal Nuevo cajero');
  // Escape lo cierra.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
