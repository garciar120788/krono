import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db';
import { noteFolders } from '@/db/schema';
import { assertId, authRoute, json, notFound, parseBody } from '@/lib/http';
import { color, shortText } from '@/lib/validation';

type P = { id: string };

export const PATCH = authRoute<P>(async (req, { user, params }) => {
  const id = assertId(params.id, 'Carpeta');
  const body = await parseBody(
    req,
    z.object({ name: shortText(60).optional(), color: color.optional(), position: z.number().int().min(0).optional() }),
  );
  const [folder] = await getDb()
    .update(noteFolders)
    .set(body)
    .where(and(eq(noteFolders.id, id), eq(noteFolders.userId, user.id)))
    .returning();
  if (!folder) throw notFound('Carpeta');
  return json({ folder });
});

/** Elimina la carpeta. Sus notas NO se borran: quedan "Sin carpeta". */
export const DELETE = authRoute<P>(async (_req, { user, params }) => {
  const id = assertId(params.id, 'Carpeta');
  const [folder] = await getDb()
    .delete(noteFolders)
    .where(and(eq(noteFolders.id, id), eq(noteFolders.userId, user.id)))
    .returning({ id: noteFolders.id });
  if (!folder) throw notFound('Carpeta');
  return json({ ok: true });
});
