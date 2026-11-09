import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

/**
 * Aplica las migraciones pendientes de la carpeta /drizzle.
 * Se ejecuta automáticamente al arrancar el servidor (ver src/instrumentation.ts).
 */
export async function runMigrations() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[krono] DATABASE_URL no está definida; no se aplicaron migraciones.');
    return;
  }

  const migrationsFolder = path.join(process.cwd(), 'drizzle');
  const maxAttempts = 15;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const pool = new Pool({ connectionString: url, max: 1 });
    try {
      await migrate(drizzle(pool), { migrationsFolder });
      console.log('[krono] Base de datos al día.');
      await pool.end();
      return;
    } catch (err) {
      await pool.end().catch(() => undefined);
      const code = (err as { code?: string }).code;
      const retriable = code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === '57P03' || code === 'EAI_AGAIN';
      if (!retriable || attempt === maxAttempts) {
        console.error('[krono] Error al aplicar migraciones:', err);
        throw err;
      }
      console.log(`[krono] Esperando a la base de datos (intento ${attempt}/${maxAttempts})...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}
