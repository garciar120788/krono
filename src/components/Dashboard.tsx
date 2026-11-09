'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Check } from './Check';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { PRIORITY, api, darken, mix, type CalEvent, type Category, type DailyNote, type Habit, type Task, type TaskList } from '@/lib/client';
import {
  DOW_LETTER,
  DOW_LONG,
  DOW_SHORT,
  MONTHS,
  addDays,
  addMonths,
  cap,
  dayOfMonth,
  formatLong,
  formatMonth,
  formatShort,
  parts,
  startOfMonth,
  startOfWeek,
  toMinutes,
  weekday,
} from '@/lib/dates';
import { useDebouncedSave, useToday } from '@/lib/hooks';
import { occursOn } from '@/lib/recurrence';

const localDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function Dashboard() {
  const toast = useToast();
  const router = useRouter();
  const today = useToday();

  const [lists, setLists] = useState<TaskList[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [note, setNote] = useState<DailyNote | null>(null);
  const [noteText, setNoteText] = useState('');
  const [pastNotes, setPastNotes] = useState<DailyNote[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [calMonth, setCalMonth] = useState(() => startOfMonth(today));
  const [draft, setDraft] = useState('');

  const calStart = startOfWeek(calMonth);
  const calEnd = addDays(calStart, 41);

  useEffect(() => {
    (async () => {
      try {
        const [l, t, n, past, h, c] = await Promise.all([
          api<{ lists: TaskList[] }>('/api/lists'),
          api<{ tasks: Task[] }>('/api/tasks'),
          api<{ note: DailyNote }>(`/api/daily-notes/${today}?create=1`),
          api<{ notes: DailyNote[] }>(`/api/daily-notes?until=${addDays(today, -1)}&limit=12`),
          api<{ habits: Habit[] }>(`/api/habits?from=${addDays(today, -400)}&to=${today}`),
          api<{ categories: Category[] }>('/api/event-categories'),
        ]);
        setLists(l.lists);
        setTasks(t.tasks);
        setNote(n.note);
        setNoteText(n.note.content);
        setPastNotes(past.notes.filter((x) => x.content.trim()).slice(0, 4));
        setHabits(h.habits);
        setCategories(c.categories);
      } catch (err) {
        toast.fail(err);
      }
    })();
  }, [today, toast.fail]);

  useEffect(() => {
    const from = calStart < today ? calStart : today;
    const to = calEnd > today ? calEnd : today;
    api<{ events: CalEvent[] }>(`/api/events?from=${from}&to=${to}`)
      .then((r) => setEvents(r.events))
      .catch(toast.fail);
  }, [calStart, calEnd, today, toast.fail]);

  /* ---------- Tareas ---------- */
  const listById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);
  const doneToday = tasks.filter((t) => t.status === 'done' && t.completedAt && localDate(t.completedAt) === today);
  const pending = tasks
    .filter((t) => t.status !== 'done')
    .sort((a, b) => PRIORITY[a.priority].rank - PRIORITY[b.priority].rank || b.createdAt.localeCompare(a.createdAt));
  const shown = [...pending.slice(0, 7), ...doneToday];
  const progressTotal = pending.length + doneToday.length;
  const progressPct = progressTotal ? Math.round((doneToday.length / progressTotal) * 100) : 0;

  async function toggleTask(t: Task) {
    const status = t.status === 'done' ? 'todo' : 'done';
    const completedAt = status === 'done' ? new Date().toISOString() : null;
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status, completedAt } : x)));
    try {
      await api(`/api/tasks/${t.id}`, { method: 'PATCH', body: { status } });
    } catch (err) {
      toast.fail(err);
    }
  }

  async function addTask() {
    const title = draft.trim();
    if (!title) return;
    const listId = lists.find((l) => l.name === 'Personal')?.id ?? lists[0]?.id;
    if (!listId) return toast.show('Primero crea una lista en Tareas');
    try {
      const r = await api<{ task: Task }>('/api/tasks', { method: 'POST', body: { title, listId } });
      setTasks((prev) => [r.task, ...prev]);
      setDraft('');
    } catch (err) {
      toast.fail(err);
    }
  }

  /* ---------- Nota del día ---------- */
  const noteSaver = useDebouncedSave<{ date: string; content: string }>(async ({ date, content }) => {
    try {
      await api(`/api/daily-notes/${date}`, { method: 'PUT', body: { content } });
    } catch (err) {
      toast.fail(err);
    }
  });

  /* ---------- Agenda ---------- */
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const eventsOn = (d: string) =>
    events
      .filter((e) => occursOn(e, d))
      .sort((a, b) => Number(b.allDay) - Number(a.allDay) || toMinutes(a.startTime) - toMinutes(b.startTime));
  const todayEvents = eventsOn(today);

  /* ---------- Hábitos ---------- */
  const weekStart = startOfWeek(today);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const doneSets = useMemo(() => new Map(habits.map((h) => [h.id, new Set(h.done)])), [habits]);
  const isDone = (h: Habit, d: string) => doneSets.get(h.id)?.has(d) ?? false;
  const streak = (h: Habit) => {
    let d = isDone(h, today) ? today : addDays(today, -1);
    let n = 0;
    while (isDone(h, d)) {
      n++;
      d = addDays(d, -1);
    }
    return n;
  };
  const habitsDoneToday = habits.filter((h) => isDone(h, today)).length;

  async function toggleHabit(h: Habit, date: string) {
    if (date > today) return;
    const done = !isDone(h, date);
    setHabits((prev) => prev.map((x) => (x.id === h.id ? { ...x, done: done ? [...x.done, date] : x.done.filter((d) => d !== date) } : x)));
    try {
      await api(`/api/habits/${h.id}/logs`, { method: 'PUT', body: { date, done } });
    } catch (err) {
      toast.fail(err);
    }
  }

  const { d: todayDay, m: todayMonth } = parts(today);

  return (
    <main className="page page-narrow stack" style={{ gap: 32, paddingTop: 40 }}>
      <section aria-label="Resumen del día" className="between" style={{ alignItems: 'flex-end', gap: '20px 40px' }}>
        <h1 className="serif" style={{ fontSize: 'clamp(36px, 5vw, 54px)', fontWeight: 600, lineHeight: 1.05, letterSpacing: '-0.015em' }}>
          {cap(formatLong(today))}
        </h1>
        <dl style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: 0 }}>
          {[
            { label: 'Tareas pendientes', value: String(pending.length) },
            { label: 'Eventos hoy', value: String(todayEvents.length) },
            { label: 'Hábitos de hoy', value: `${habitsDoneToday} / ${habits.length}` },
          ].map((s) => (
            <div key={s.label} className="card" style={{ padding: '12px 18px', borderRadius: 12, minWidth: 120 }}>
              <dt className="xsmall muted">{s.label}</dt>
              <dd className="serif" style={{ margin: 0, fontSize: 28, fontWeight: 600 }}>{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="row">
        <div className="col-main stack" style={{ gap: 24 }}>
          {/* ---------- Tareas ---------- */}
          <section className="card" aria-labelledby="h-tareas" style={{ paddingBottom: 20 }}>
            <div className="between" style={{ alignItems: 'baseline' }}>
              <h2 id="h-tareas" className="card-title">Tareas</h2>
              <Link href="/tareas" className="link-more">Ver todas →</Link>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 8px' }}>
              <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--line-soft)', overflow: 'hidden' }}>
                <div style={{ height: 6, borderRadius: 999, background: 'var(--accent)', width: `${progressPct}%`, transition: 'width .3s' }} />
              </div>
              <span className="small muted" style={{ whiteSpace: 'nowrap' }}>
                {doneToday.length} de {progressTotal} completadas hoy
              </span>
            </div>
            {shown.length === 0 ? (
              <p className="muted" style={{ margin: '12px 0' }}>No tienes tareas pendientes. Agrega una abajo.</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {shown.map((t) => {
                  const done = t.status === 'done';
                  const list = listById.get(t.listId);
                  return (
                    <li key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--line-soft)' }}>
                      <Check checked={done} label={(done ? 'Marcar como pendiente: ' : 'Marcar como hecha: ') + t.title} onToggle={() => toggleTask(t)} />
                      <span className={done ? 'done-text' : undefined} style={{ flex: 1, minWidth: 0 }}>{t.title}</span>
                      {t.priority === 'alta' && !done && <span className="xsmall" style={{ fontWeight: 600, color: 'var(--terra)' }}>Prioridad</span>}
                      {list && <span className="tag" style={{ marginRight: 4 }}>{list.name}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
            {pending.length > 7 && (
              <p className="xsmall muted" style={{ margin: '8px 0 0' }}>y {pending.length - 7} más en Tareas.</p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void addTask();
              }}
              style={{ display: 'flex', gap: 8, marginTop: 12 }}
            >
              <label htmlFor="tarea-rapida" className="sr-only">Nueva tarea</label>
              <input id="tarea-rapida" className="input dashed" style={{ flex: 1 }} placeholder="Escribe una tarea y presiona Enter" value={draft} onChange={(e) => setDraft(e.target.value)} />
              <button type="submit" className="btn btn-primary">
                <Icon name="plus" size={16} stroke={2.4} />
                Agregar
              </button>
            </form>
          </section>

          {/* ---------- Nota del día ---------- */}
          <section className="card" aria-labelledby="h-nota" style={{ paddingBottom: 20 }}>
            <div className="between" style={{ alignItems: 'baseline' }}>
              <h2 id="h-nota" className="card-title">Nota del día</h2>
              <Link href={`/notas?fecha=${today}`} className="link-more">Abrir nota →</Link>
            </div>
            <p style={{ margin: '8px 0 0', fontFamily: 'var(--font-hand)', fontSize: 24, color: 'var(--terra)', lineHeight: '32px' }}>
              {todayDay} {MONTHS[todayMonth].slice(0, 3)} · {DOW_LONG[weekday(today)]}
            </p>
            <label htmlFor="nota-hoy" className="sr-only">Nota del día</label>
            <textarea
              id="nota-hoy"
              className="paper"
              style={{ minHeight: 256, marginTop: 4 }}
              placeholder="Hoja en blanco. Escribe lo que quieras sobre tu día…"
              value={noteText}
              disabled={!note}
              onChange={(e) => {
                setNoteText(e.target.value);
                noteSaver.schedule({ date: today, content: e.target.value });
              }}
            />
            {pastNotes.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                <span className="small muted" style={{ marginRight: 4 }}>Días anteriores</span>
                {pastNotes.map((n) => (
                  <Link key={n.date} href={`/notas?fecha=${n.date}`} className="tag" style={{ minHeight: 36, display: 'inline-flex', alignItems: 'center', padding: '0 12px', fontSize: 14, color: 'var(--ink)', textDecoration: 'none' }}>
                    {DOW_SHORT[weekday(n.date)]} {dayOfMonth(n.date)}
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="col-detail stack" style={{ gap: 24 }}>
          {/* ---------- Agenda ---------- */}
          <section className="card" aria-labelledby="h-agenda">
            <div className="between">
              <h2 id="h-agenda" className="card-title">{formatMonth(calMonth)}</h2>
              <div style={{ display: 'flex', gap: 4 }}>
                <button type="button" className="icon-btn" aria-label="Mes anterior" onClick={() => setCalMonth(addMonths(calMonth, -1))}>
                  <Icon name="left" />
                </button>
                <button type="button" className="icon-btn" aria-label="Mes siguiente" onClick={() => setCalMonth(addMonths(calMonth, 1))}>
                  <Icon name="right" />
                </button>
              </div>
            </div>
            <div className="mini-cal" style={{ marginTop: 8 }}>
              {DOW_LETTER.map((w, i) => (
                <div key={i} style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', padding: '4px 0' }}>{w}</div>
              ))}
              {Array.from({ length: 42 }, (_, i) => addDays(calStart, i)).map((d) => {
                const out = parts(d).m !== parts(calMonth).m;
                const has = eventsOn(d).length > 0;
                const isToday = d === today;
                return (
                  <button
                    key={d}
                    type="button"
                    className={`mini-day${isToday ? ' today' : ''}${out ? ' out' : ''}`}
                    aria-label={`${formatLong(d)}${isToday ? ', hoy' : ''}${has ? ', con eventos' : ''}`}
                    onClick={() => router.push(`/calendario?fecha=${d}`)}
                  >
                    <span>{dayOfMonth(d)}</span>
                    <span aria-hidden="true" style={{ width: 4, height: 4, borderRadius: 999, background: has ? (isToday ? 'var(--sheet)' : 'var(--accent)') : 'transparent' }} />
                  </button>
                );
              })}
            </div>
            <div style={{ height: 1, background: 'var(--line-soft)', margin: '18px 0 6px' }} />
            <div className="between" style={{ alignItems: 'baseline' }}>
              <h3 className="eyebrow" style={{ fontSize: 15, letterSpacing: '0.06em' }}>Hoy</h3>
              <Link href={`/calendario?fecha=${today}`} className="link-more">Ver semana →</Link>
            </div>
            {todayEvents.length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>No tienes eventos hoy.</p>
            ) : (
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {todayEvents.map((e) => {
                  const c = (e.categoryId && catById.get(e.categoryId)?.color) || '#776B5D';
                  return (
                    <li key={e.id} style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
                      <span style={{ width: 48, fontSize: 14, fontWeight: 600, paddingTop: 8 }}>{e.allDay ? 'Día' : e.startTime}</span>
                      <Link
                        href={`/calendario?fecha=${today}&evento=${e.id}`}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: 10, background: mix('#FFFBF3', c, 0.14), color: darken(c), textDecoration: 'none' }}
                      >
                        <div style={{ fontWeight: 600 }}>{e.title || 'Sin título'}</div>
                        <div className="small">
                          {e.allDay ? 'Todo el día' : `${e.startTime} – ${e.endTime}`}
                          {e.place ? ` · ${e.place}` : ''}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* ---------- Hábitos ---------- */}
          <section className="card" aria-labelledby="h-habitos">
            <div className="between" style={{ alignItems: 'baseline' }}>
              <h2 id="h-habitos" className="card-title">Hábitos</h2>
              <Link href="/habitos" className="link-more">Ver progreso →</Link>
            </div>
            <p className="small muted" style={{ margin: '0 0 12px' }}>
              Semana del {formatShort(week[0])} al {formatShort(week[6])}
            </p>
            {habits.length === 0 ? (
              <p className="small muted" style={{ margin: 0 }}>
                Aún no tienes hábitos. <Link href="/habitos">Crea el primero</Link>.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {habits.map((h) => (
                  <div key={h.id}>
                    <div className="between" style={{ alignItems: 'baseline', marginBottom: 6, gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{h.name}</span>
                      <span className="xsmall muted" style={{ whiteSpace: 'nowrap' }}>Racha: {streak(h)} {streak(h) === 1 ? 'día' : 'días'}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}>
                      {week.map((d, i) => {
                        const future = d > today;
                        const done = !future && isDone(h, d);
                        const cls = done ? 'done' : d === today ? 'today' : future ? 'future' : 'past';
                        return (
                          <button
                            key={d}
                            type="button"
                            className={`habit-cell mini ${cls}`}
                            disabled={future}
                            aria-pressed={done}
                            aria-label={`${h.name}, ${DOW_LONG[i]}: ${done ? 'hecho' : 'sin marcar'}`}
                            onClick={() => toggleHabit(h, d)}
                          >
                            {DOW_LETTER[i]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
      {toast.node}
    </main>
  );
}
