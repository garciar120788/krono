import 'server-only';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { getDb } from '@/db';
import { users, type User } from '@/db/schema';

export const SESSION_COOKIE = 'krono_session';
const SESSION_DAYS = 30;

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? '';
  if (secret.length < 32) {
    throw new Error('AUTH_SECRET debe tener al menos 32 caracteres (openssl rand -base64 48)');
  }
  return new TextEncoder().encode(secret);
}

export const registrationEnabled = () => (process.env.ALLOW_REGISTRATION ?? 'true').toLowerCase() !== 'false';

/* ---------------- Contraseñas ---------------- */

export function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

/* ---------------- Sesión (JWT firmado en una cookie httpOnly) ---------------- */

export async function createSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Devuelve el id del usuario si la cookie de sesión es válida. */
export async function getSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

/** Usuario de la sesión actual (o null). */
export async function getCurrentUser(): Promise<User | null> {
  const id = await getSessionUserId();
  if (!id) return null;
  const [user] = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

/** Igual que getCurrentUser, pero lanza 401 si no hay sesión. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    const { HttpError } = await import('./http');
    throw new HttpError(401, 'Inicia sesión para continuar');
  }
  return user;
}

export function publicUser(u: User) {
  return { id: u.id, name: u.name, email: u.email, createdAt: u.createdAt };
}
