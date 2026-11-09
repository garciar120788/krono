import 'server-only';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/db';
import { subtasks, tasks, type Subtask, type Task } from '@/db/schema';
import { notFound } from './http';

export type TaskWithSubtasks = Task & { subtasks: Subtask[] };

/** Agrega las subtareas a una lista de tareas. */
export async function withSubtasks(rows: Task[]): Promise<TaskWithSubtasks[]> {
  if (!rows.length) return [];
  const subs = await getDb()
    .select()
    .from(subtasks)
    .where(inArray(
      subtasks.taskId,
      rows.map((t) => t.id),
    ))
    .orderBy(asc(subtasks.position), asc(subtasks.createdAt));
  const byTask = new Map<string, Subtask[]>();
  for (const s of subs) {
    const arr = byTask.get(s.taskId) ?? [];
    arr.push(s);
    byTask.set(s.taskId, arr);
  }
  return rows.map((t) => ({ ...t, subtasks: byTask.get(t.id) ?? [] }));
}

/** Obtiene una tarea del usuario o lanza 404. */
export async function getOwnedTask(userId: string, taskId: string): Promise<Task> {
  const [task] = await getDb()
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);
  if (!task) throw notFound('Tarea');
  return task;
}
