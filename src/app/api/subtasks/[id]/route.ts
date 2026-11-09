import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { subtasks, tasks } from '@/db/schema';
import { assertId, authRoute, json, notFound, parseBody } from '@/lib/http';
import { shortText } from '@/lib/validation';

type P = { id: string };

/** Busca la subtarea verificando que la tarea pertenece al usuario. */
async function getOwnedSubtask(userId: string, id: string) {
  const [row] = await getDb()
    .select({ subtask: subtasks })
    .from(subtasks)
    .innerJoin(tasks, eq(tasks.id, subtasks.taskId))
    .where(and(eq(subtasks.id, id), eq(tasks.userId, userId)))
    .limit(1);
  if (!row) throw notFound('Subtarea');
  return row.subtask;
}

const patchSchema = z.object({
  text: shortText(300).optional(),
  done: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

export const PATCH = authRoute<P>(async (req, { user, params }) => {
  const current = await getOwnedSubtask(user.id, assertId(params.id, 'Subtarea'));
  const body = await parseBody(req, patchSchema);
  const [subtask] = await getDb().update(subtasks).set(body).where(eq(subtasks.id, current.id)).returning();
  return json({ subtask });
});

export const DELETE = authRoute<P>(async (_req, { user, params }) => {
  const current = await getOwnedSubtask(user.id, assertId(params.id, 'Subtarea'));
  await getDb().delete(subtasks).where(eq(subtasks.id, current.id));
  return json({ ok: true });
});
