import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { events } from '@/db/schema';
import { assertCategory, eventFields, normalizeEvent, toInput } from '@/lib/events';
import { assertId, authRoute, json, notFound, parseBody } from '@/lib/http';

type P = { id: string };

async function getOwnedEvent(userId: string, id: string) {
  const [event] = await getDb()
    .select()
    .from(events)
    .where(and(eq(events.id, id), eq(events.userId, userId)))
    .limit(1);
  if (!event) throw notFound('Evento');
  return event;
}

export const GET = authRoute<P>(async (_req, { user, params }) => {
  const event = await getOwnedEvent(user.id, assertId(params.id, 'Evento'));
  return json({ event });
});

/** Actualiza el evento (en eventos repetidos aplica a todas las repeticiones). */
export const PATCH = authRoute<P>(async (req, { user, params }) => {
  const current = await getOwnedEvent(user.id, assertId(params.id, 'Evento'));
  const patch = await parseBody(req, eventFields.partial());

  // Si cambia la fecha de inicio de un evento de varios días, conservamos su duración.
  const merged = { ...toInput(current), ...patch };
  if (patch.startDate && !patch.endDate && current.allDay) {
    const span = Date.parse(current.endDate) - Date.parse(current.startDate);
    merged.endDate = new Date(Date.parse(patch.startDate) + span).toISOString().slice(0, 10);
  }
  const input = eventFields.parse(merged);
  if (patch.categoryId !== undefined) await assertCategory(user.id, input.categoryId);
  const data = normalizeEvent(input);

  const [event] = await getDb()
    .update(events)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(events.id, current.id))
    .returning();
  return json({ event });
});

export const DELETE = authRoute<P>(async (_req, { user, params }) => {
  const event = await getOwnedEvent(user.id, assertId(params.id, 'Evento'));
  await getDb().delete(events).where(eq(events.id, event.id));
  return json({ ok: true });
});
