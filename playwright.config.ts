// Pruebas de punta a punta: la API real (con la tienda de demostración sembrada) y la web
// compilada, como en producción. En el computador usa el Chrome instalado; en el CI, Chromium.
import { defineConfig, devices } from '@playwright/test';

const BD = process.env.DATABASE_URL_E2E ?? 'postgresql://elcuaderno:elcuaderno_dev@localhost:5434/elcuaderno_e2e';
const navegador = process.env.CI ? {} : { channel: 'chrome' as const };

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4174', trace: 'retain-on-failure', ...navegador },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], ...navegador } },
    { name: 'celular', use: { ...devices['Pixel 7'], ...navegador } },
  ],
  webServer: [
    {
      // Migra, siembra la demo y arranca la API en un puerto propio para no chocar con la de desarrollo.
      command: 'node apps/api/dist/db/migrar.js && node apps/api/dist/demo/sembrar.js && node apps/api/dist/main.js',
      url: 'http://localhost:3199/api/salud',
      env: { DATABASE_URL: BD, PORT: '3199', JWT_SECRET: 'secreto-solo-para-e2e-0123456789-abcdefghij', CORS_ORIGIN: 'http://localhost:4174' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run preview -w @elcuaderno/web -- --port 4174 --strictPort',
      url: 'http://localhost:4174',
      env: { API_URL: 'http://localhost:3199' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
