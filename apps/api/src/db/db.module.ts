import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config';
import * as esquema from './esquema';

export const DB = Symbol('DB');
export const POOL = Symbol('POOL');
export type BaseDeDatos = NodePgDatabase<typeof esquema>;

/** Decorador corto para inyectar la base de datos: `constructor(@InjectDb() private db: BaseDeDatos)`. */
export const InjectDb = () => Inject(DB);

@Global()
@Module({
  providers: [
    { provide: POOL, useFactory: () => new Pool({ connectionString: config.databaseUrl, max: 10 }) },
    { provide: DB, inject: [POOL], useFactory: (pool: Pool) => drizzle(pool, { schema: esquema }) },
  ],
  exports: [DB, POOL],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(POOL) private readonly pool: Pool) {}

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
