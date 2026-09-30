import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/esquema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgresql://elcuaderno:elcuaderno_dev@localhost:5434/elcuaderno' },
});
