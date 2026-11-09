import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { taskLists } from '@/db/schema';
import { assertId, authRoute, json, notFound, parseBody } from '@/lib/http';
import { color, shortText } from '@/lib/validation';

type P = { id: string };

const patchSchema = z.object({
  name: shortText(60).optional(),
  color: color.optional(),
  position: z.number().int().min(0).optional(),
});

export const PATCH = authRoute<P>(async (req, { user, params }) => {
  const id = assertId(params.id, 'Lista');
  const body = await parseBody(req, patchSchema);
  const [list] = await getDb()
    .update(taskLists)
    .set(body)
    .where(and(eq(taskLists.id, id), eq(taskLists.userId, user.id)))
    .returning();
  if (!list) throw notFound('Lista');
  return json({ list });
});

/** Elimina la lista y todas sus tareas. */
export const DELETE = authRoute<P>(async (_req, { user, params }) => {
  const id = assertId(params.id, 'Lista');
  const [list] = await getDb()
    .delete(taskLists)
    .where(and(eq(taskLists.id, id), eq(taskLists.userId, user.id)))
    .returning({ id: taskLists.id });
  if (!list) throw notFound('Lista');
  return json({ ok: true });
});
