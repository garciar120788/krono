import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { requireUser } from './auth';
import type { User } from '@/db/schema';

/** Error con código HTTP que la API devuelve como JSON { error }. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Recurso') => new HttpError(404, `${what}: no existe`);

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/** Lee y valida el cuerpo JSON de la petición. */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, 'El cuerpo de la petición no es JSON válido');
  }
  return schema.parse(raw);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida que un id de la URL sea un UUID (si no, responde 404). */
export function assertId(id: string, what?: string): string {
  if (!UUID_RE.test(id)) throw notFound(what);
  return id;
}

function handleError(err: unknown) {
  if (err instanceof HttpError) return json({ error: err.message }, err.status);
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const field = first?.path?.join('.') || 'datos';
    return json({ error: `Dato inválido (${field}): ${first?.message ?? 'revisa los campos'}` }, 400);
  }
  console.error('[krono] Error no controlado en la API:', err);
  return json({ error: 'Error interno del servidor' }, 500);
}

type Ctx<P> = { params: Promise<P> };

/** Envuelve una ruta pública: maneja errores de validación y HTTP. */
export function publicRoute<P = Record<string, string>>(
  handler: (req: NextRequest, params: P) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      return await handler(req, ((await ctx?.params) ?? {}) as P);
    } catch (err) {
      return handleError(err);
    }
  };
}

/** Envuelve una ruta que requiere sesión iniciada; entrega el usuario actual. */
export function authRoute<P = Record<string, string>>(
  handler: (req: NextRequest, ctx: { user: User; params: P }) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      const user = await requireUser();
      return await handler(req, { user, params: ((await ctx?.params) ?? {}) as P });
    } catch (err) {
      return handleError(err);
    }
  };
}
