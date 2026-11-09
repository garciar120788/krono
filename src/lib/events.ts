import 'server-only';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { eventCategories, type CalendarEvent } from '@/db/schema';
import { HttpError } from './http';
import { hhmm, isoDate, uuid } from './validation';

export const REPEATS = ['nunca', 'diario', 'semanal', 'mensual', 'anual'] as const;

export const eventFields = z.object({
  title: z.string().max(300),
  categoryId: uuid.nullable(),
  allDay: z.boolean(),
  startDate: isoDate,
  endDate: isoDate.optional(),
  startTime: hhmm.nullable().optional(),
  endTime: hhmm.nullable().optional(),
  repeat: z.enum(REPEATS),
  place: z.string().max(300),
  description: z.string().max(20_000),
});

export type EventInput = z.infer<typeof eventFields>;

/** Deja los datos del evento en un estado consistente antes de guardarlos. */
export function normalizeEvent(e: EventInput) {
  if (e.allDay) {
    const endDate = e.endDate && e.endDate >= e.startDate ? e.endDate : e.startDate;
    return { ...e, endDate, startTime: null, endTime: null };
  }
  const startTime = e.startTime ?? '10:00';
  const endTime = e.endTime ?? startTime;
  if (endTime < startTime) throw new HttpError(400, 'La hora de fin debe ser después de la hora de inicio');
  return { ...e, endDate: e.startDate, startTime, endTime };
}

export async function assertCategory(userId: string, categoryId: string | null | undefined) {
  if (!categoryId) return;
  const [c] = await getDb()
    .select({ id: eventCategories.id })
    .from(eventCategories)
    .where(and(eq(eventCategories.id, categoryId), eq(eventCategories.userId, userId)))
    .limit(1);
  if (!c) throw new HttpError(400, 'La categoría no existe');
}

export function toInput(e: CalendarEvent): EventInput {
  return {
    title: e.title,
    categoryId: e.categoryId,
    allDay: e.allDay,
    startDate: e.startDate,
    endDate: e.endDate,
    startTime: e.startTime,
    endTime: e.endTime,
    repeat: e.repeat,
    place: e.place,
    description: e.description,
  };
}
