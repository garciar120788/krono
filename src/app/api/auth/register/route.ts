import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { createSession, hashPassword, publicUser, registrationEnabled } from '@/lib/auth';
import { seedUserDefaults } from '@/lib/defaults';
import { HttpError, json, parseBody, publicRoute } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/rate-limit';

const schema = z.object({
  name: z.string().trim().min(1, 'escribe tu nombre').max(80),
  email: z.string().trim().toLowerCase().email('correo inválido').max(200),
  password: z.string().min(8, 'mínimo 8 caracteres').max(200),
});

export const POST = publicRoute(async (req) => {
  if (!registrationEnabled()) throw new HttpError(403, 'El registro de cuentas está desactivado');

  const limit = rateLimit(`register:${clientIp(req)}`, 10, 60 * 60 * 1000);
  if (!limit.ok) throw new HttpError(429, 'Demasiados intentos. Intenta más tarde.');

  const body = await parseBody(req, schema);
  const db = getDb();

  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email)).limit(1);
  if (exists) throw new HttpError(409, 'Ya existe una cuenta con ese correo');

  const passwordHash = await hashPassword(body.password);
  const [user] = await db.insert(users).values({ name: body.name, email: body.email, passwordHash }).returning();
  await seedUserDefaults(user.id);
  await createSession(user.id);

  return json({ user: publicUser(user) }, 201);
});
