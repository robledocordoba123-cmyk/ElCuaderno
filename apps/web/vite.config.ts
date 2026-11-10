import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // El frontend usa el código fuente de los esquemas compartidos (el mismo que valida la API).
    alias: { '@elcuaderno/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)) },
  },
  // En desarrollo (y en "preview", que usan las pruebas e2e) /api se redirige a la API local,
  // igual que hace Vercel en producción. Así la cookie de sesión es del mismo sitio.
  server: { proxy: { '/api': process.env.API_URL ?? 'http://localhost:3100' } },
  preview: { proxy: { '/api': process.env.API_URL ?? 'http://localhost:3100' } },
});
