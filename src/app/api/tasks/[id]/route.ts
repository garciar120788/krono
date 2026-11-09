import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { taskLists, tasks } from '@/db/schema';
import { HttpError, assertId, authRoute, json, parseBody } from '@/lib/http';
import { getOwnedTask, withSubtasks } from '@/lib/tasks';
import { shortText, uuid } from '@/lib/validation';

type P = { id: string };

export const GET = authRoute<P>(async (_req, { user, params }) => {
  const task = await getOwnedTask(user.id, assertId(params.id, 'Tarea'));
  const [full] = await withSubtasks([task]);
  return json({ task: full });
});

const patchSchema = z.object({
  title: shortText(300).optional(),
  listId: uuid.optional(),
  priority: z.enum(['alta', 'media', 'baja']).optional(),
  status: z.enum(['todo', 'doing', 'done']).optional(),
  notes: z.string().max(50_000).optional(),
});

export const PATCH = authRoute<P>(async (req, { user, params }) => {
  const current = await getOwnedTask(user.id, assertId(params.id, 'Tarea'));
  const body = await parseBody(req, patchSchema);
  const db = getDb();

  if (body.listId && body.listId !== current.listId) {
    const [list] = await db
      .select({ id: taskLists.id })
      .from(taskLists)
      .where(and(eq(taskLists.id, body.listId), eq(taskLists.userId, user.id)))
      .limit(1);
    if (!list) throw new HttpError(400, 'La lista no existe');
  }

  const update: Partial<typeof tasks.$inferInsert> = { ...body, updatedAt: new Date() };
  if (body.status && body.status !== current.status) {
    update.completedAt = body.status === 'done' ? new Date() : null;
  }

  const [task] = await db.update(tasks).set(update).where(eq(tasks.id, current.id)).returning();
  const [full] = await withSubtasks([task]);
  return json({ task: full });
});

export const DELETE = authRoute<P>(async (_req, { user, params }) => {
  const task = await getOwnedTask(user.id, assertId(params.id, 'Tarea'));
  await getDb().delete(tasks).where(eq(tasks.id, task.id));
  return json({ ok: true });
});
