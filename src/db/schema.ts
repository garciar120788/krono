import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/* ------------------------------------------------------------------ */
/*  Enumeraciones                                                      */
/* ------------------------------------------------------------------ */

export const priorityEnum = pgEnum('task_priority', ['alta', 'media', 'baja']);
export const taskStatusEnum = pgEnum('task_status', ['todo', 'doing', 'done']);
export const repeatEnum = pgEnum('event_repeat', ['nunca', 'diario', 'semanal', 'mensual', 'anual']);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

/* ------------------------------------------------------------------ */
/*  Usuarios                                                           */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email)],
);

/* ------------------------------------------------------------------ */
/*  Tareas                                                             */
/* ------------------------------------------------------------------ */

export const taskLists = pgTable(
  'task_lists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull().default('#2C4A6E'),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('task_lists_user_idx').on(t.userId)],
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    listId: uuid('list_id').notNull().references(() => taskLists.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    priority: priorityEnum('priority').notNull().default('media'),
    status: taskStatusEnum('status').notNull().default('todo'),
    notes: text('notes').notNull().default(''),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('tasks_user_idx').on(t.userId), index('tasks_list_idx').on(t.listId)],
);

export const subtasks = pgTable(
  'subtasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    done: boolean('done').notNull().default(false),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('subtasks_task_idx').on(t.taskId)],
);

/* ------------------------------------------------------------------ */
/*  Notas                                                              */
/* ------------------------------------------------------------------ */

/** Una nota por usuario y por día. Se crea sola la primera vez que se abre ese día. */
export const dailyNotes = pgTable(
  'daily_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    content: text('content').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('daily_notes_user_date_idx').on(t.userId, t.date)],
);

export const noteFolders = pgTable(
  'note_folders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull().default('#2C4A6E'),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('note_folders_user_idx').on(t.userId)],
);

export const notes = pgTable(
  'notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    folderId: uuid('folder_id').references(() => noteFolders.id, { onDelete: 'set null' }),
    title: text('title').notNull().default(''),
    content: text('content').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('notes_user_idx').on(t.userId)],
);

/* ------------------------------------------------------------------ */
/*  Hábitos                                                            */
/* ------------------------------------------------------------------ */

export const habits = pgTable(
  'habits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('habits_user_idx').on(t.userId)],
);

/** Un registro = el hábito se cumplió ese día. Si no hay registro, no se cumplió. */
export const habitLogs = pgTable(
  'habit_logs',
  {
    habitId: uuid('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.habitId, t.date] })],
);

/* ------------------------------------------------------------------ */
/*  Calendario                                                         */
/* ------------------------------------------------------------------ */

export const eventCategories = pgTable(
  'event_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull().default('#2C4A6E'),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('event_categories_user_idx').on(t.userId)],
);

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => eventCategories.id, { onDelete: 'set null' }),
    title: text('title').notNull().default(''),
    allDay: boolean('all_day').notNull().default(false),
    /** Fecha del evento (o de la primera repetición). */
    startDate: date('start_date', { mode: 'string' }).notNull(),
    /** Último día (solo eventos de varios días). Igual a startDate en eventos de un día. */
    endDate: date('end_date', { mode: 'string' }).notNull(),
    /** Hora local "HH:MM". Nulo si es de todo el día. */
    startTime: text('start_time'),
    endTime: text('end_time'),
    repeat: repeatEnum('repeat').notNull().default('nunca'),
    place: text('place').notNull().default(''),
    description: text('description').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('events_user_idx').on(t.userId), index('events_start_idx').on(t.startDate)],
);

export type User = typeof users.$inferSelect;
export type TaskList = typeof taskLists.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Subtask = typeof subtasks.$inferSelect;
export type DailyNote = typeof dailyNotes.$inferSelect;
export type NoteFolder = typeof noteFolders.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Habit = typeof habits.$inferSelect;
export type EventCategory = typeof eventCategories.$inferSelect;
export type CalendarEvent = typeof events.$inferSelect;
