import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { habitLogs, habits } from '@/db/schema';
import { HttpError, authRoute, json, parseBody } from '@/lib/http';
import { isoDate, shortText } from '@/lib/validation';

/**
 * GET /api/habits?from=AAAA-MM-DD&to=AAAA-MM-DD
 * Hábitos del usuario con las fechas cumplidas dentro del rango.
 */
export const GET = authRoute(async (req, { user }) => {
  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (!from || !to || !isoDate.safeParse(from).success || !isoDate.safeParse(to).success) {
    throw new HttpError(400, 'Indica from y to con el formato AAAA-MM-DD');
  }

  const db = getDb();
  const list = await db
    .select()
    .from(habits)
    .where(eq(habits.userId, user.id))
    .orderBy(asc(habits.position), asc(habits.createdAt));

  const logs = list.length
    ? await db
        .select({ habitId: habitLogs.habitId, date: habitLogs.date })
        .from(habitLogs)
        .where(
          and(
            inArray(
              habitLogs.habitId,
              list.map((h) => h.id),
            ),
            gte(habitLogs.date, from),
            lte(habitLogs.date, to),
          ),
        )
    : [];

  const byHabit = new Map<string, string[]>();
  for (const l of logs) {
    const arr = byHabit.get(l.habitId) ?? [];
    arr.push(l.date);
    byHabit.set(l.habitId, arr);
  }

  return json({ habits: list.map((h) => ({ ...h, done: (byHabit.get(h.id) ?? []).sort() })) });
});

export const POST = authRoute(async (req, { user }) => {
  const body = await parseBody(req, z.object({ name: shortText(120) }));
  const db = getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(habits)
    .where(eq(habits.userId, user.id));
  const [habit] = await db.insert(habits).values({ userId: user.id, name: body.name, position: count }).returning();
  return json({ habit: { ...habit, done: [] } }, 201);
});
