import { diffDays, parts } from './dates';

export type Repeat = 'nunca' | 'diario' | 'semanal' | 'mensual' | 'anual';

export interface Occurrable {
  startDate: string;
  endDate: string;
  repeat: Repeat;
}

export const REPEAT_LABELS: Record<Repeat, string> = {
  nunca: 'No se repite',
  diario: 'Cada día',
  semanal: 'Cada semana',
  mensual: 'Cada mes',
  anual: 'Cada año',
};

/** ¿El evento ocurre en la fecha indicada? Considera eventos de varios días y repeticiones. */
export function occursOn(e: Occurrable, iso: string): boolean {
  if (iso < e.startDate) return false;
  if (e.repeat === 'nunca') return iso <= e.endDate;
  if (e.repeat === 'diario') return true;
  if (e.repeat === 'semanal') return diffDays(e.startDate, iso) % 7 === 0;
  const a = parts(iso);
  const b = parts(e.startDate);
  if (e.repeat === 'mensual') return a.d === b.d;
  if (e.repeat === 'anual') return a.d === b.d && a.m === b.m;
  return false;
}
