import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { createSession, publicUser, verifyPassword } from '@/lib/auth';
import { HttpError, json, parseBody, publicRoute } from '@/lib/http';
import { clientIp, rateLimit } from '@/lib/rate-limit';

const schema = z.object({
  email: z.string().trim().toLowerCase().email('correo inválido'),
  password: z.string().min(1, 'escribe tu contraseña').max(200),
});

// Hash ficticio para que el tiempo de respuesta sea similar exista o no el correo.
const DUMMY_HASH = '$2b$12$o.ieuwyLwxtnMdPGyJU92uVJJlydqwRT76CCZUKUu0AK.xqnVl3iK';

export const POST = publicRoute(async (req) => {
  const body = await parseBody(req, schema);

  const limit = rateLimit(`login:${clientIp(req)}:${body.email}`, 10, 15 * 60 * 1000);
  if (!limit.ok) throw new HttpError(429, `Demasiados intentos. Espera ${Math.ceil(limit.retryAfter / 60)} min.`);

  const [user] = await getDb().select().from(users).where(eq(users.email, body.email)).limit(1);
  const ok = await verifyPassword(body.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    throw new HttpError(401, 'Correo o contraseña incorrectos');
  }

  await createSession(user.id);
  return json({ user: publicUser(user) });
});
