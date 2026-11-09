import { NextResponse, type NextRequest } from 'next/server';
import { destroySession } from '@/lib/auth';

export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}

// GET permite cerrar sesión con un enlace y regresa al login.
export async function GET(req: NextRequest) {
  await destroySession();
  return NextResponse.redirect(new URL('/login', req.url), 303);
}
