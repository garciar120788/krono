'use client';

/** Tipos que devuelve la API (fechas como texto). */
export type Priority = 'alta' | 'media' | 'baja';
export type Status = 'todo' | 'doing' | 'done';

export interface TaskList { id: string; name: string; color: string; position: number; pending: number }
export interface Subtask { id: string; taskId: string; text: string; done: boolean; position: number }
export interface Task {
  id: string; listId: string; title: string; priority: Priority; status: Status; notes: string;
  createdAt: string; updatedAt: string; completedAt: string | null; subtasks: Subtask[];
}
export interface DailyNote { id: string; date: string; content: string; updatedAt: string }
export interface Folder { id: string; name: string; color: string; position: number }
export interface Note { id: string; folderId: string | null; title: string; content: string; createdAt: string; updatedAt: string }
export interface Habit { id: string; name: string; position: number; createdAt: string; done: string[] }
export interface Category { id: string; name: string; color: string; position: number }
export interface CalEvent {
  id: string; categoryId: string | null; title: string; allDay: boolean; startDate: string; endDate: string;
  startTime: string | null; endTime: string | null; repeat: 'nunca' | 'diario' | 'semanal' | 'mensual' | 'anual';
  place: string; description: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** fetch con JSON y manejo de errores. Si la sesión expiró, manda al login. */
export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? 'GET',
    headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* respuesta sin cuerpo */
  }
  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/api/auth/')) {
    window.location.href = '/login';
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error ?? `Error ${res.status}`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

/** Mezcla un color hex con otro (t = 0 … 1). Útil para fondos suaves. */
export function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a);
  const B = p(b);
  return '#' + A.map((v, k) => Math.round(v + (B[k] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** Oscurece un color para usarlo como texto sobre su fondo suave. */
export const darken = (c: string, t = 0.22) => mix(c, '#000000', t);

export const PRIORITY: Record<Priority, { label: string; color: string; rank: number }> = {
  alta: { label: 'Alta', color: '#A8492A', rank: 0 },
  media: { label: 'Media', color: '#8A6A1F', rank: 1 },
  baja: { label: 'Baja', color: '#6A5F52', rank: 2 },
};
