import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { eventCategories } from '@/db/schema';
import { assertId, authRoute, json, notFound, parseBody } from '@/lib/http';
import { color, shortText } from '@/lib/validation';

type P = { id: string };

export const PATCH = authRoute<P>(async (req, { user, params }) => {
  const id = assertId(params.id, 'Categoría');
  const body = await parseBody(
    req,
    z.object({ name: shortText(60).optional(), color: color.optional(), position: z.number().int().min(0).optional() }),
  );
  const [category] = await getDb()
    .update(eventCategories)
    .set(body)
    .where(and(eq(eventCategories.id, id), eq(eventCategories.userId, user.id)))
    .returning();
  if (!category) throw notFound('Categoría');
  return json({ category });
});

/** Elimina la categoría. Sus eventos se conservan sin categoría. */
export const DELETE = authRoute<P>(async (_req, { user, params }) => {
  const id = assertId(params.id, 'Categoría');
  const [category] = await getDb()
    .delete(eventCategories)
    .where(and(eq(eventCategories.id, id), eq(eventCategories.userId, user.id)))
    .returning({ id: eventCategories.id });
  if (!category) throw notFound('Categoría');
  return json({ ok: true });
});
