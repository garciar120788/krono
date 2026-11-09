import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '@/db';

export const dynamic = 'force-dynamic';

/** Revisión de salud usada por Docker (HEALTHCHECK). */
export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({ status: 'ok' });
  } catch {
    return NextResponse.json({ status: 'error', db: 'sin conexión' }, { status: 503 });
  }
}
