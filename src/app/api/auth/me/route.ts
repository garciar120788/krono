import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { users } from '@/db/schema';
import { destroySession, hashPassword, publicUser, verifyPassword } from '@/lib/auth';
import { HttpError, authRoute, json, parseBody } from '@/lib/http';

export const GET = authRoute(async (_req, { user }) => json({ user: publicUser(user) }));

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    currentPassword: z.string().max(200).optional(),
    newPassword: z.string().min(8, 'mínimo 8 caracteres').max(200).optional(),
  })
  .refine((b) => !b.newPassword || !!b.currentPassword, {
    message: 'escribe tu contraseña actual',
    path: ['currentPassword'],
  });

export const PATCH = authRoute(async (req, { user }) => {
  const body = await parseBody(req, patchSchema);
  const update: Partial<typeof users.$inferInsert> = {};

  if (body.name) update.name = body.name;
  if (body.newPassword) {
    const ok = await verifyPassword(body.currentPassword ?? '', user.passwordHash);
    if (!ok) throw new HttpError(400, 'La contraseña actual no es correcta');
    update.passwordHash = await hashPassword(body.newPassword);
  }
  if (!Object.keys(update).length) return json({ user: publicUser(user) });

  const [updated] = await getDb().update(users).set(update).where(eq(users.id, user.id)).returning();
  return json({ user: publicUser(updated) });
});

/** Elimina la cuenta y todos sus datos. Requiere la contraseña. */
export const DELETE = authRoute(async (req, { user }) => {
  const body = await parseBody(req, z.object({ password: z.string().max(200) }));
  const ok = await verifyPassword(body.password, user.passwordHash);
  if (!ok) throw new HttpError(400, 'La contraseña no es correcta');
  await getDb().delete(users).where(eq(users.id, user.id));
  await destroySession();
  return json({ ok: true });
});
