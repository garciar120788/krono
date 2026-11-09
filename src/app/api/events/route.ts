import { and, asc, eq, gte, lte, ne, or } from 'drizzle-orm';
import { getDb } from '@/db';
import { events } from '@/db/schema';
import { assertCategory, eventFields, normalizeEvent } from '@/lib/events';
import { HttpError, authRoute, json, parseBody } from '@/lib/http';
import { isoDate } from '@/lib/validation';

/**
 * GET /api/events?from=AAAA-MM-DD&to=AAAA-MM-DD
 * Devuelve los eventos que PUEDEN aparecer en el rango (incluye los que se repiten).
 * El cliente calcula las repeticiones con src/lib/recurrence.ts.
 */
export const GET = authRoute(async (req, { user }) => {
  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  if (!from || !to || !isoDate.safeParse(from).success || !isoDate.safeParse(to).success) {
    throw new HttpError(400, 'Indica from y to con el formato AAAA-MM-DD');
  }

  const rows = await getDb()
    .select()
    .from(events)
    .where(
      and(
        eq(events.userId, user.id),
        lte(events.startDate, to),
        or(ne(events.repeat, 'nunca'), gte(events.endDate, from)),
      ),
    )
    .orderBy(asc(events.startDate), asc(events.startTime));

  return json({ events: rows });
});

const createSchema = eventFields.partial().required({ startDate: true });

export const POST = authRoute(async (req, { user }) => {
  const raw = await parseBody(req, createSchema);
  const input = eventFields.parse({
    title: '',
    categoryId: null,
    allDay: false,
    repeat: 'nunca',
    place: '',
    description: '',
    startTime: '10:00',
    endTime: '11:00',
    ...raw,
  });
  await assertCategory(user.id, input.categoryId);
  const data = normalizeEvent(input);

  const [event] = await getDb()
    .insert(events)
    .values({ userId: user.id, ...data })
    .returning();
  return json({ event }, 201);
});
