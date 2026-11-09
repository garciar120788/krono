import type { Config } from 'drizzle-kit';

// Configuración de drizzle-kit (solo se usa en desarrollo para generar migraciones).
export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://krono:krono@localhost:5432/krono',
  },
  strict: true,
  verbose: true,
} satisfies Config;
