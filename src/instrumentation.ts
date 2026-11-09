/**
 * Next.js ejecuta esta función una sola vez al arrancar el servidor.
 * La usamos para validar la configuración y aplicar las migraciones de la base de datos.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const secret = process.env.AUTH_SECRET ?? '';
  if (secret.length < 32) {
    console.warn(
      '[krono] AUTH_SECRET no está definida o es muy corta (mínimo 32 caracteres). ' +
        'Genera una con: openssl rand -base64 48',
    );
  }

  const { runMigrations } = await import('./db/migrate');
  await runMigrations();
}
