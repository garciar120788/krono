import { and, asc, desc, eq, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { taskLists, tasks } from '@/db/schema';
import { HttpError, authRoute, json, parseBody } from '@/lib/http';
import { withSubtasks } from '@/lib/tasks';
import { shortText, uuid } from '@/lib/validation';

const STATUSES = ['todo', 'doing', 'done'] as const;

/**
 * GET /api/tasks?listId=...&status=todo|doing|done
 * Devuelve las tareas del usuario con sus subtareas.
 */
export const GET = authRoute(async (req, { user }) => {
  const url = new URL(req.url);
  const listId = url.searchParams.get('listId');
  const status = url.searchParams.get('status');

  const where: SQL[] = [eq(tasks.userId, user.id)];
  if (listId && uuid.safeParse(listId).success) where.push(eq(tasks.listId, listId));
  if (status && (STATUSES as readonly string[]).includes(status)) where.push(eq(tasks.status, status as (typeof STATUSES)[number]));

  const rows = await getDb()
    .select()
    .from(tasks)
    .where(and(...where))
    .orderBy(asc(tasks.status), asc(tasks.priority), desc(tasks.createdAt));

  return json({ tasks: await withSubtasks(rows) });
});

const createSchema = z.object({
  title: shortText(300),
  listId: uuid,
  priority: z.enum(['alta', 'media', 'baja']).default('media'),
  status: z.enum(STATUSES).default('todo'),
  notes: z.string().max(50_000).optional(),
});

export const POST = authRoute(async (req, { user }) => {
  const body = await parseBody(req, createSchema);
  const db = getDb();

  const [list] = await db
    .select({ id: taskLists.id })
    .from(taskLists)
    .where(and(eq(taskLists.id, body.listId), eq(taskLists.userId, user.id)))
    .limit(1);
  if (!list) throw new HttpError(400, 'La lista no existe');

  const [task] = await db
    .insert(tasks)
    .values({
      userId: user.id,
      listId: body.listId,
      title: body.title,
      priority: body.priority,
      status: body.status,
      notes: body.notes ?? '',
      completedAt: body.status === 'done' ? new Date() : null,
    })
    .returning();

  return json({ task: { ...task, subtasks: [] } }, 201);
});
