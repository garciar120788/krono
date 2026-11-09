import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { subtasks, tasks } from '@/db/schema';
import { assertId, authRoute, json, parseBody } from '@/lib/http';
import { getOwnedTask } from '@/lib/tasks';
import { shortText } from '@/lib/validation';

type P = { id: string };

/** Agrega una subtarea al final de la tarea. */
export const POST = authRoute<P>(async (req, { user, params }) => {
  const task = await getOwnedTask(user.id, assertId(params.id, 'Tarea'));
  const body = await parseBody(req, z.object({ text: shortText(300) }));
  const db = getDb();

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${subtasks.position}), -1)`.mapWith(Number) })
    .from(subtasks)
    .where(eq(subtasks.taskId, task.id));

  const [subtask] = await db
    .insert(subtasks)
    .values({ taskId: task.id, text: body.text, position: max + 1 })
    .returning();
  await db.update(tasks).set({ updatedAt: new Date() }).where(eq(tasks.id, task.id));

  return json({ subtask }, 201);
});
