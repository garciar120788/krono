import { z } from 'zod';

/** Validaciones compartidas por la API. */

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'usa el formato AAAA-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(s + 'T00:00:00Z')), 'fecha inválida');

export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'usa el formato HH:MM');

export const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'usa un color como #2C4A6E');

export const uuid = z.string().uuid();

export const shortText = (max = 200) => z.string().trim().min(1, 'no puede estar vacío').max(max);

export const longText = z.string().max(100_000);
