import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { dailyNotes } from '@/db/schema';
import { HttpError, authRoute, json, notFound, parseBody } from '@/lib/http';
import { isoDate, longText } from '@/lib/validation';

type P = { date: string };

function parseDate(raw: string) {
  const r = isoDate.safeParse(raw);
  if (!r.success) throw new HttpError(400, 'Fecha inválida (usa AAAA-MM-DD)');
  return r.data;
}

/**
 * GET /api/daily-notes/AAAA-MM-DD[?create=1]
 * Con create=1 crea la nota en blanco si todavía no existe (así se genera la nota de cada día).
 */
export const GET = authRoute<P>(async (req, { user, params }) => {
  const date = parseDate(params.date);
  const create = new URL(req.url).searchParams.get('create') === '1';
  const db = getDb();

  if (create) {
    await db.insert(dailyNotes).values({ userId: user.id, date }).onConflictDoNothing();
  }
  const [note] = await db
    .select()
    .from(dailyNotes)
    .where(and(eq(dailyNotes.userId, user.id), eq(dailyNotes.date, date)))
    .limit(1);
  if (!note) throw notFound('Nota');
  return json({ note });
});

/** PUT /api/daily-notes/AAAA-MM-DD  { content }  (crea o actualiza) */
export const PUT = authRoute<P>(async (req, { user, params }) => {
  const date = parseDate(params.date);
  const body = await parseBody(req, z.object({ content: longText }));
  const [note] = await getDb()
    .insert(dailyNotes)
    .values({ userId: user.id, date, content: body.content })
    .onConflictDoUpdate({
      target: [dailyNotes.userId, dailyNotes.date],
      set: { content: body.content, updatedAt: new Date() },
    })
    .returning();
  return json({ note });
});
