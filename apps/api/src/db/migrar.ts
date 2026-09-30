// Aplica las migraciones pendientes (carpeta drizzle/). Se ejecuta al arrancar en Render.
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { join } from 'node:path';
import { config } from '../config';

export async function migrar(url = config.databaseUrl) {
  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: join(__dirname, '..', '..', 'drizzle') });
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  migrar()
    .then(() => console.log('Migraciones aplicadas'))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
