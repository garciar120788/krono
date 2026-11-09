/**
 * Utilidades de fechas sin hora ("AAAA-MM-DD"), seguras en cliente y servidor.
 * Todas las operaciones se hacen en UTC para evitar problemas de horario de verano.
 */

export const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
export const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
/** Días empezando en lunes. */
export const DOW_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const DOW_LETTER = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const DOW_LONG = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

const DAY_MS = 86_400_000;

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Fecha de hoy según el reloj del navegador/servidor (hora local). */
export function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m: m - 1, d };
}

function toUTC(iso: string) {
  const { y, m, d } = parts(iso);
  return Date.UTC(y, m, d);
}

function fromUTC(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function makeISO(y: number, m: number, d: number): string {
  return fromUTC(Date.UTC(y, m, d));
}

export function addDays(iso: string, n: number): string {
  return fromUTC(toUTC(iso) + n * DAY_MS);
}

export function addMonths(iso: string, n: number): string {
  const { y, m } = parts(iso);
  return makeISO(y, m + n, 1);
}

/** Días entre a y b (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY_MS);
}

/** 0 = lunes … 6 = domingo */
export function weekday(iso: string): number {
  return (new Date(toUTC(iso)).getUTCDay() + 6) % 7;
}

export function startOfWeek(iso: string): string {
  return addDays(iso, -weekday(iso));
}

export function startOfMonth(iso: string): string {
  const { y, m } = parts(iso);
  return makeISO(y, m, 1);
}

export function daysInMonth(iso: string): number {
  const { y, m } = parts(iso);
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

export function dayOfMonth(iso: string): number {
  return parts(iso).d;
}

/** "martes, 3 de noviembre" */
export function formatLong(iso: string, withYear = false): string {
  const { y, m, d } = parts(iso);
  return `${DOW_LONG[weekday(iso)]}, ${d} de ${MONTHS[m]}${withYear ? ` de ${y}` : ''}`;
}

/** "3 nov" */
export function formatShort(iso: string): string {
  const { m, d } = parts(iso);
  return `${d} ${MONTHS[m].slice(0, 3)}`;
}

/** "Noviembre 2026" */
export function formatMonth(iso: string): string {
  const { y, m } = parts(iso);
  return `${cap(MONTHS[m])} ${y}`;
}

/** "2 – 8 de noviembre" o "30 nov – 6 dic" */
export function formatWeekRange(start: string): string {
  const end = addDays(start, 6);
  const a = parts(start);
  const b = parts(end);
  if (a.m === b.m) return `${a.d} – ${b.d} de ${MONTHS[b.m]}`;
  return `${a.d} ${MONTHS[a.m].slice(0, 3)} – ${b.d} ${MONTHS[b.m].slice(0, 3)}`;
}

/** Convierte "HH:MM" a minutos desde medianoche. */
export function toMinutes(t: string | null | undefined): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
