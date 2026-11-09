import 'server-only';
import { getDb } from '@/db';
import { eventCategories, noteFolders, taskLists } from '@/db/schema';

/** Paleta de colores de Krono (la misma del diseño). */
export const PALETTE = ['#2C4A6E', '#A8492A', '#6B7A36', '#6B4E7A', '#8A6A1F', '#3E6B6B'];

/** Crea las listas, carpetas y categorías iniciales de un usuario nuevo. */
export async function seedUserDefaults(userId: string) {
  const db = getDb();
  await db.insert(taskLists).values([
    { userId, name: 'Trabajo', color: '#2C4A6E', position: 0 },
    { userId, name: 'Personal', color: '#A8492A', position: 1 },
    { userId, name: 'Casa', color: '#6B7A36', position: 2 },
    { userId, name: 'Finanzas', color: '#6B4E7A', position: 3 },
  ]);
  await db.insert(noteFolders).values([
    { userId, name: 'Ideas', color: '#2C4A6E', position: 0 },
    { userId, name: 'Recetas', color: '#A8492A', position: 1 },
    { userId, name: 'Apuntes', color: '#6B7A36', position: 2 },
  ]);
  await db.insert(eventCategories).values([
    { userId, name: 'Trabajo', color: '#2C4A6E', position: 0 },
    { userId, name: 'Personal', color: '#A8492A', position: 1 },
    { userId, name: 'Salud', color: '#6B7A36', position: 2 },
    { userId, name: 'Social', color: '#6B4E7A', position: 3 },
  ]);
}
