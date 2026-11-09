import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { noteFolders } from '@/db/schema';
import { PALETTE } from '@/lib/defaults';
import { authRoute, json, parseBody } from '@/lib/http';
import { color, shortText } from '@/lib/validation';

/** Carpetas de notas libres. */
export const GET = authRoute(async (_req, { user }) => {
  const folders = await getDb()
    .select()
    .from(noteFolders)
    .where(eq(noteFolders.userId, user.id))
    .orderBy(asc(noteFolders.position), asc(noteFolders.createdAt));
  return json({ folders });
});

export const POST = authRoute(async (req, { user }) => {
  const body = await parseBody(req, z.object({ name: shortText(60), color: color.optional() }));
  const db = getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(noteFolders)
    .where(eq(noteFolders.userId, user.id));
  const [folder] = await db
    .insert(noteFolders)
    .values({ userId: user.id, name: body.name, color: body.color ?? PALETTE[count % PALETTE.length], position: count })
    .returning();
  return json({ folder }, 201);
});
