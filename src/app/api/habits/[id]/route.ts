import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { habits } from '@/db/schema';
import { assertId, authRoute, json, notFound, parseBody } from '@/lib/http';
import { shortText } from '@/lib/validation';

type P = { id: string };

export const PATCH = authRoute<P>(async (req, { user, params }) => {
  const id = assertId(params.id, 'Hábito');
  const body = await parseBody(req, z.object({ name: shortText(120).optional(), position: z.number().int().min(0).optional() }));
  const [habit] = await getDb()
    .update(habits)
    .set(body)
    .where(and(eq(habits.id, id), eq(habits.userId, user.id)))
    .returning();
  if (!habit) throw notFound('Hábito');
  return json({ habit });
});

/** Elimina el hábito y todo su historial. */
export const DELETE = authRoute<P>(async (_req, { user, params }) => {
  const id = assertId(params.id, 'Hábito');
  const [habit] = await getDb()
    .delete(habits)
    .where(and(eq(habits.id, id), eq(habits.userId, user.id)))
    .returning({ id: habits.id });
  if (!habit) throw notFound('Hábito');
  return json({ ok: true });
});
