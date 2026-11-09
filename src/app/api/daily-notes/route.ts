import { and, desc, eq, ilike, lte } from 'drizzle-orm';
import { getDb } from '@/db';
import { dailyNotes } from '@/db/schema';
import { authRoute, json } from '@/lib/http';
import { isoDate } from '@/lib/validation';

/**
 * GET /api/daily-notes?until=AAAA-MM-DD&limit=90&q=texto
 * Lista las notas diarias (más recientes primero).
 */
export const GET = authRoute(async (req, { user }) => {
  const url = new URL(req.url);
  const until = url.searchParams.get('until');
  const q = url.searchParams.get('q')?.trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 90, 1), 366);

  const where = [eq(dailyNotes.userId, user.id)];
  if (until && isoDate.safeParse(until).success) where.push(lte(dailyNotes.date, until));
  if (q) where.push(ilike(dailyNotes.content, `%${q.replace(/[%_\\]/g, '\\$&')}%`));

  const notes = await getDb()
    .select()
    .from(dailyNotes)
    .where(and(...where))
    .orderBy(desc(dailyNotes.date))
    .limit(limit);

  return json({ notes });
});
