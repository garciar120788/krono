import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { taskLists, tasks } from '@/db/schema';
import { PALETTE } from '@/lib/defaults';
import { authRoute, json, parseBody } from '@/lib/http';
import { color, shortText } from '@/lib/validation';

/** Listas de tareas del usuario con el número de tareas pendientes. */
export const GET = authRoute(async (_req, { user }) => {
  const db = getDb();
  const rows = await db
    .select({
      id: taskLists.id,
      name: taskLists.name,
      color: taskLists.color,
      position: taskLists.position,
      pending: sql<number>`count(${tasks.id}) filter (where ${tasks.status} <> 'done')`.mapWith(Number),
    })
    .from(taskLists)
    .leftJoin(tasks, eq(tasks.listId, taskLists.id))
    .where(eq(taskLists.userId, user.id))
    .groupBy(taskLists.id)
    .orderBy(asc(taskLists.position), asc(taskLists.createdAt));
  return json({ lists: rows });
});

const createSchema = z.object({ name: shortText(60), color: color.optional() });

export const POST = authRoute(async (req, { user }) => {
  const body = await parseBody(req, createSchema);
  const db = getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(taskLists)
    .where(eq(taskLists.userId, user.id));
  const [list] = await db
    .insert(taskLists)
    .values({ userId: user.id, name: body.name, color: body.color ?? PALETTE[count % PALETTE.length], position: count })
    .returning();
  return json({ list: { ...list, pending: 0 } }, 201);
});
