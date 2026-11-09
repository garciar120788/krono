import { and, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { noteFolders, notes } from '@/db/schema';
import { HttpError, authRoute, json, parseBody } from '@/lib/http';
import { longText, uuid } from '@/lib/validation';

/** GET /api/notes?folderId=...&q=texto  — notas libres, editadas más recientemente primero. */
export const GET = authRoute(async (req, { user }) => {
  const url = new URL(req.url);
  const folderId = url.searchParams.get('folderId');
  const q = url.searchParams.get('q')?.trim();

  const where: SQL[] = [eq(notes.userId, user.id)];
  if (folderId && uuid.safeParse(folderId).success) where.push(eq(notes.folderId, folderId));
  if (q) {
    const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
    where.push(or(ilike(notes.title, like), ilike(notes.content, like))!);
  }

  const rows = await getDb()
    .select()
    .from(notes)
    .where(and(...where))
    .orderBy(desc(notes.updatedAt))
    .limit(500);
  return json({ notes: rows });
});

const createSchema = z.object({
  title: z.string().max(300).default(''),
  content: longText.default(''),
  folderId: uuid.nullable().optional(),
});

export const POST = authRoute(async (req, { user }) => {
  const body = await parseBody(req, createSchema);
  const db = getDb();

  if (body.folderId) {
    const [f] = await db
      .select({ id: noteFolders.id })
      .from(noteFolders)
      .where(and(eq(noteFolders.id, body.folderId), eq(noteFolders.userId, user.id)))
      .limit(1);
    if (!f) throw new HttpError(400, 'La carpeta no existe');
  }

  const [note] = await db
    .insert(notes)
    .values({ userId: user.id, title: body.title, content: body.content, folderId: body.folderId ?? null })
    .returning();
  return json({ note }, 201);
});
