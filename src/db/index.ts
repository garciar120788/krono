import 'server-only';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

type DB = NodePgDatabase<typeof schema>;

// En desarrollo Next recarga módulos; guardamos el pool en globalThis para no abrir conexiones de más.
const globalForDb = globalThis as unknown as { kronoPool?: Pool; kronoDb?: DB };

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta la variable de entorno DATABASE_URL');
  return new Pool({ connectionString: url, max: 10 });
}

export function getPool(): Pool {
  if (!globalForDb.kronoPool) globalForDb.kronoPool = createPool();
  return globalForDb.kronoPool;
}

export function getDb(): DB {
  if (!globalForDb.kronoDb) globalForDb.kronoDb = drizzle(getPool(), { schema });
  return globalForDb.kronoDb;
}

export { schema };
