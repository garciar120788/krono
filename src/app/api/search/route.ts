import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { getDb } from '@/db';
import { dailyNotes, events, notes, tasks } from '@/db/schema';
import { authRoute, json } from '@/lib/http';

/** GET /api/search?q=texto — busca en tareas, notas, notas diarias y eventos. */
export const GET = authRoute(async (req, { user }) => {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return json({ tasks: [], notes: [], dailyNotes: [], events: [] });

  const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
  const db = getDb();

  const [t, n, d, e] = await Promise.all([
    db
      .select({ id: tasks.id, title: tasks.title, status: tasks.status, listId: tasks.listId })
      .from(tasks)
      .where(and(eq(tasks.userId, user.id), or(ilike(tasks.title, like), ilike(tasks.notes, like))))
      .orderBy(desc(tasks.updatedAt))
      .limit(20),
    db
      .select({ id: notes.id, title: notes.title, content: notes.content })
      .from(notes)
      .where(and(eq(notes.userId, user.id), or(ilike(notes.title, like), ilike(notes.content, like))))
      .orderBy(desc(notes.updatedAt))
      .limit(20),
    db
      .select({ date: dailyNotes.date, content: dailyNotes.content })
      .from(dailyNotes)
      .where(and(eq(dailyNotes.userId, user.id), ilike(dailyNotes.content, like)))
      .orderBy(desc(dailyNotes.date))
      .limit(20),
    db
      .select({ id: events.id, title: events.title, startDate: events.startDate, startTime: events.startTime })
      .from(events)
      .where(
        and(
          eq(events.userId, user.id),
          or(ilike(events.title, like), ilike(events.place, like), ilike(events.description, like)),
        ),
      )
      .orderBy(desc(events.startDate))
      .limit(20),
  ]);

  return json({ tasks: t, notes: n, dailyNotes: d, events: e });
});
