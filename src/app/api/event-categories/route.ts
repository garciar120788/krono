import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { eventCategories } from '@/db/schema';
import { PALETTE } from '@/lib/defaults';
import { authRoute, json, parseBody } from '@/lib/http';
import { color, shortText } from '@/lib/validation';

export const GET = authRoute(async (_req, { user }) => {
  const categories = await getDb()
    .select()
    .from(eventCategories)
    .where(eq(eventCategories.userId, user.id))
    .orderBy(asc(eventCategories.position), asc(eventCategories.createdAt));
  return json({ categories });
});

export const POST = authRoute(async (req, { user }) => {
  const body = await parseBody(req, z.object({ name: shortText(60), color: color.optional() }));
  const db = getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(eventCategories)
    .where(eq(eventCategories.userId, user.id));
  const [category] = await db
    .insert(eventCategories)
    .values({ userId: user.id, name: body.name, color: body.color ?? PALETTE[count % PALETTE.length], position: count })
    .returning();
  return json({ category }, 201);
});
