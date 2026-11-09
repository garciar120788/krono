import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { habitLogs, habits } from '@/db/schema';
import { HttpError, assertId, authRoute, json, notFound, parseBody } from '@/lib/http';
import { isoDate } from '@/lib/validation';

type P = { id: string };

/**
 * PUT /api/habits/:id/logs  { date: "AAAA-MM-DD", done: true|false }
 * Marca o desmarca un día como cumplido.
 */
export const PUT = authRoute<P>(async (req, { user, params }) => {
  const id = assertId(params.id, 'Hábito');
  const body = await parseBody(req, z.object({ date: isoDate, done: z.boolean() }));

  // No se pueden marcar días futuros (damos un día de margen por diferencias de zona horaria).
  const limit = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (body.done && body.date > limit) throw new HttpError(400, 'No puedes marcar días futuros');

  const db = getDb();
  const [habit] = await db
    .select({ id: habits.id })
    .from(habits)
    .where(and(eq(habits.id, id), eq(habits.userId, user.id)))
    .limit(1);
  if (!habit) throw notFound('Hábito');

  if (body.done) {
    await db.insert(habitLogs).values({ habitId: id, date: body.date }).onConflictDoNothing();
  } else {
    await db.delete(habitLogs).where(and(eq(habitLogs.habitId, id), eq(habitLogs.date, body.date)));
  }
  return json({ ok: true, date: body.date, done: body.done });
});
