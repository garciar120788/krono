import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { noteFolders, notes } from '@/db/schema';
import { HttpError, assertId, authRoute, json, notFound, parseBody } from '@/lib/http';
import { longText, uuid } from '@/lib/validation';

type P = { id: string };

const patchSchema = z.object({
  title: z.string().max(300).optional(),
  content: longText.optional(),
  folderId: uuid.nullable().optional(),
});

export const PATCH = authRoute<P>(async (req, { user, params }) => {
  const id = assertId(params.id, 'Nota');
  const body = await parseBody(req, patchSchema);
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
    .update(notes)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(notes.id, id), eq(notes.userId, user.id)))
    .returning();
  if (!note) throw notFound('Nota');
  return json({ note });
});

export const DELETE = authRoute<P>(async (_req, { user, params }) => {
  const id = assertId(params.id, 'Nota');
  const [note] = await getDb()
    .delete(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, user.id)))
    .returning({ id: notes.id });
  if (!note) throw notFound('Nota');
  return json({ ok: true });
});
