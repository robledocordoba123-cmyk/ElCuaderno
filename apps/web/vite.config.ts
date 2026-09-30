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
  // En desarrollo, /api se redirige a la API local (NestJS en el puerto 3100).
  server: { proxy: { '/api': process.env.API_URL ?? 'http://localhost:3100' } },
});
