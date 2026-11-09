'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { api, mix, type Habit } from '@/lib/client';
import {
  DOW_LONG,
  DOW_SHORT,
  MONTHS,
  MONTHS_SHORT,
  addDays,
  addMonths,
  dayOfMonth,
  daysInMonth,
  diffDays,
  formatMonth,
  makeISO,
  parts,
  startOfMonth,
  startOfWeek,
  weekday,
} from '@/lib/dates';
import { useToday } from '@/lib/hooks';

type MapView = 'mes' | 'anio';

export function HabitsView() {
  const toast = useToast();
  const today = useToday();
  const thisYear = parts(today).y;
  const rangeStart = `${thisYear - 1}-01-01`;

  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [month, setMonth] = useState(() => startOfMonth(today));
  const [year, setYear] = useState(thisYear);
  const [mapView, setMapView] = useState<MapView>('mes');
  const [mapHabit, setMapHabit] = useState<'all' | string>('all');

  useEffect(() => {
    api<{ habits: Habit[] }>(`/api/habits?from=${rangeStart}&to=${today}`)
      .then((r) => setHabits(r.habits))
      .catch(toast.fail)
      .finally(() => setLoading(false));
  }, [rangeStart, today, toast.fail]);

  const doneSets = useMemo(() => new Map(habits.map((h) => [h.id, new Set(h.done)])), [habits]);
  const isDone = (h: Habit, d: string) => doneSets.get(h.id)?.has(d) ?? false;

  async function toggle(h: Habit, date: string) {
    if (date > today) return;
    const done = !isDone(h, date);
    setHabits((prev) =>
      prev.map((x) => (x.id === h.id ? { ...x, done: done ? [...x.done, date] : x.done.filter((d) => d !== date) } : x)),
    );
    try {
      await api(`/api/habits/${h.id}/logs`, { method: 'PUT', body: { date, done } });
    } catch (err) {
      toast.fail(err);
      setHabits((prev) =>
        prev.map((x) => (x.id === h.id ? { ...x, done: done ? x.done.filter((d) => d !== date) : [...x.done, date] } : x)),
      );
    }
  }

  async function addHabit() {
    const name = draft.trim();
    if (!name) return;
    try {
      const r = await api<{ habit: Habit }>('/api/habits', { method: 'POST', body: { name } });
      setHabits((prev) => [...prev, r.habit]);
      setDraft('');
    } catch (err) {
      toast.fail(err);
    }
  }

  async function removeHabit(h: Habit) {
    if (!window.confirm(`¿Eliminar el hábito "${h.name}" y todo su historial?`)) return;
    try {
      await api(`/api/habits/${h.id}`, { method: 'DELETE' });
      setHabits((prev) => prev.filter((x) => x.id !== h.id));
      if (mapHabit === h.id) setMapHabit('all');
    } catch (err) {
      toast.fail(err);
    }
  }

  /* ---------- Semana ---------- */
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = weekDays[6];
  const canPrevWeek = weekStart > rangeStart;
  const canNextWeek = weekEnd < today;
  const weekTitle = (() => {
    const a = parts(weekStart);
    const b = parts(weekEnd);
    return a.m === b.m
      ? `Semana del ${a.d} al ${b.d} de ${MONTHS[b.m]}`
      : `Semana del ${a.d} de ${MONTHS[a.m]} al ${b.d} de ${MONTHS[b.m]}`;
  })();

  /* ---------- Mapa ---------- */
  const selected = mapHabit === 'all' ? habits : habits.filter((h) => h.id === mapHabit);
  const single = selected.length === 1;
  const accent = '#2C4A6E';
  const shades = ['#EDE4D3', mix('#FFFBF3', accent, 0.28), mix('#FFFBF3', accent, 0.52), mix('#FFFBF3', accent, 0.76), accent];

  const level = (d: string) => {
    if (!selected.length) return 0;
    const n = selected.filter((h) => isDone(h, d)).length;
    if (n === 0) return 0;
    if (single) return 4;
    const f = n / selected.length;
    return f <= 0.34 ? 1 : f <= 0.67 ? 2 : f < 1 ? 3 : 4;
  };
  const titleFor = (d: string) => {
    const { m, d: day } = parts(d);
    const base = `${day} de ${MONTHS[m]}`;
    if (d > today) return `${base}: todavía no llega`;
    const n = selected.filter((h) => isDone(h, d)).length;
    if (single) return `${base}: ${n ? 'hecho' : 'no hecho'}`;
    return `${base}: ${n} de ${selected.length} hábitos`;
  };

  const monthCells = (() => {
    const lead = weekday(month);
    const cells: ({ date: string } | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= daysInMonth(month); d++) {
      const { y, m } = parts(month);
      cells.push({ date: makeISO(y, m, d) });
    }
    return cells;
  })();
  const canPrevMonth = month > rangeStart;
  const canNextMonth = addMonths(month, 1) <= today;

  const yearStart = `${year}-01-01`;
  const gridStart = startOfWeek(yearStart);
  const yearEnd = `${year}-12-31`;
  const weeks = Math.ceil((diffDays(gridStart, yearEnd) + 1) / 7);
  const yearCells = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));
  const monthCols = MONTHS_SHORT.map((label, k) => ({
    label,
    col: Math.floor(diffDays(gridStart, makeISO(year, k, 1)) / 7) + 1,
  }));

  return (
    <main className="page page-narrow stack" style={{ gap: 24 }}>
      <div className="between" style={{ alignItems: 'flex-end' }}>
        <div>
          <h1 className="page-title">Hábitos</h1>
          <p className="page-sub">Todos tus hábitos son diarios. Marca cada día que lo cumpliste.</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void addHabit();
          }}
          style={{ display: 'flex', gap: 8, flex: '0 1 460px', minWidth: 0 }}
        >
          <label htmlFor="nuevo-habito" className="sr-only">Nuevo hábito</label>
          <input
            id="nuevo-habito"
            className="input"
            style={{ flex: 1, background: 'var(--sheet)' }}
            placeholder="Nuevo hábito, ej. Caminar 30 minutos"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="btn btn-primary" type="submit">
            <Icon name="plus" size={16} stroke={2.4} />
            Agregar
          </button>
        </form>
      </div>

      {/* ---------- Semana ---------- */}
      <section className="card" aria-labelledby="h-semana">
        <div className="between" style={{ marginBottom: 12 }}>
          <h2 id="h-semana" className="card-title">{weekTitle}</h2>
          <div style={{ display: 'flex', gap: 4 }}>
            <button type="button" className="icon-btn bordered" aria-label="Semana anterior" disabled={!canPrevWeek} onClick={() => setWeekStart(addDays(weekStart, -7))}>
              <Icon name="left" />
            </button>
            <button type="button" className="btn" style={{ borderRadius: 999 }} onClick={() => setWeekStart(startOfWeek(today))}>Esta semana</button>
            <button type="button" className="icon-btn bordered" aria-label="Semana siguiente" disabled={!canNextWeek} onClick={() => setWeekStart(addDays(weekStart, 7))}>
              <Icon name="right" />
            </button>
          </div>
        </div>

        {loading ? (
          <p className="muted">Cargando…</p>
        ) : habits.length === 0 ? (
          <p className="empty">Aún no tienes hábitos. Agrega el primero arriba.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 680, borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th scope="col" style={{ textAlign: 'left', fontSize: 13, fontWeight: 600, color: 'var(--muted)', padding: '8px 8px 8px 0', width: '32%' }}>Hábito</th>
                  {weekDays.map((d, i) => {
                    const isToday = d === today;
                    return (
                      <th key={d} scope="col" style={{ padding: '6px 4px', background: isToday ? 'var(--paper)' : undefined, borderRadius: '10px 10px 0 0', textAlign: 'center' }}>
                        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: isToday ? 'var(--terra)' : 'var(--muted)' }}>{DOW_SHORT[i]}</span>
                        <span className="serif" style={{ display: 'block', fontSize: 18, fontWeight: 600, color: isToday ? 'var(--terra)' : 'var(--ink)' }}>{dayOfMonth(d)}</span>
                      </th>
                    );
                  })}
                  <th scope="col" style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', padding: '8px 4px', width: 72 }}>Semana</th>
                  <th scope="col" style={{ width: 48 }}><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {habits.map((h) => {
                  const possible = weekDays.filter((d) => d <= today).length;
                  const count = weekDays.filter((d) => d <= today && isDone(h, d)).length;
                  return (
                    <tr key={h.id}>
                      <th scope="row" style={{ textAlign: 'left', fontWeight: 600, padding: '6px 8px 6px 0', borderTop: '1px solid var(--line-soft)' }}>{h.name}</th>
                      {weekDays.map((d, i) => {
                        const future = d > today;
                        const done = !future && isDone(h, d);
                        const cls = done ? 'done' : d === today ? 'today' : future ? 'future' : 'past';
                        return (
                          <td key={d} style={{ padding: '6px 4px', borderTop: '1px solid var(--line-soft)', background: d === today ? 'var(--paper)' : undefined, textAlign: 'center' }}>
                            <button
                              type="button"
                              className={`habit-cell ${cls}`}
                              disabled={future}
                              aria-pressed={done}
                              aria-label={`${h.name}, ${DOW_LONG[i]} ${dayOfMonth(d)}: ${done ? 'hecho' : future ? 'día futuro' : 'sin marcar'}`}
                              onClick={() => toggle(h, d)}
                            >
                              {done && <Icon name="check" size={18} stroke={3} />}
                            </button>
                          </td>
                        );
                      })}
                      <td style={{ padding: '6px 4px', borderTop: '1px solid var(--line-soft)', textAlign: 'center', fontWeight: 600, color: 'var(--ink-2)' }}>
                        {count}/{possible}
                      </td>
                      <td style={{ padding: '6px 0', borderTop: '1px solid var(--line-soft)', textAlign: 'right' }}>
                        <button type="button" className="icon-btn muted" aria-label={`Eliminar hábito: ${h.name}`} onClick={() => removeHabit(h)}>
                          <Icon name="trash" stroke={1.8} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------- Mapa de progreso ---------- */}
      <section className="card stack" aria-labelledby="h-mapa">
        <div className="between">
          <h2 id="h-mapa" className="card-title">{mapView === 'mes' ? formatMonth(month) : `Año ${year}`}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {mapView === 'mes' ? (
                <>
                  <button type="button" className="icon-btn bordered" aria-label="Mes anterior" disabled={!canPrevMonth} onClick={() => setMonth(addMonths(month, -1))}>
                    <Icon name="left" />
                  </button>
                  <button type="button" className="icon-btn bordered" aria-label="Mes siguiente" disabled={!canNextMonth} onClick={() => setMonth(addMonths(month, 1))}>
                    <Icon name="right" />
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="icon-btn bordered" aria-label="Año anterior" disabled={year <= thisYear - 1} onClick={() => setYear(year - 1)}>
                    <Icon name="left" />
                  </button>
                  <button type="button" className="icon-btn bordered" aria-label="Año siguiente" disabled={year >= thisYear} onClick={() => setYear(year + 1)}>
                    <Icon name="right" />
                  </button>
                </>
              )}
            </div>
            <div className="seg" role="group" aria-label="Periodo">
              <button type="button" aria-pressed={mapView === 'mes'} onClick={() => setMapView('mes')}>Mes</button>
              <button type="button" aria-pressed={mapView === 'anio'} onClick={() => setMapView('anio')}>Año</button>
            </div>
          </div>
        </div>

        <div role="group" aria-label="Mostrar hábito" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button type="button" className="pill" aria-pressed={mapHabit === 'all'} onClick={() => setMapHabit('all')}>Todos los hábitos</button>
          {habits.map((h) => (
            <button key={h.id} type="button" className="pill" aria-pressed={mapHabit === h.id} onClick={() => setMapHabit(h.id)}>
              {h.name}
            </button>
          ))}
        </div>

        {mapView === 'mes' ? (
          <div style={{ maxWidth: 640 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, textAlign: 'center' }}>
              {DOW_SHORT.map((w) => (
                <div key={w} style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', padding: '2px 0' }}>{w}</div>
              ))}
              {monthCells.map((c, i) => {
                if (!c) return <div key={`b${i}`} />;
                const future = c.date > today;
                const lv = future ? -1 : level(c.date);
                return (
                  <div
                    key={c.date}
                    title={titleFor(c.date)}
                    style={{
                      height: 52,
                      borderRadius: 10,
                      border: c.date === today ? '2px solid var(--terra)' : future ? '1.5px dashed var(--line)' : 0,
                      background: future ? 'transparent' : shades[lv],
                      color: future ? 'var(--faint)' : lv >= 3 ? 'var(--sheet)' : 'var(--ink)',
                      fontSize: 15,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span aria-hidden="true">{dayOfMonth(c.date)}</span>
                    <span className="sr-only">{titleFor(c.date)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
            <div style={{ display: 'flex', gap: 8, width: 'max-content' }}>
              <div style={{ display: 'grid', gridTemplateRows: '16px repeat(7, 14px)', rowGap: 3, fontSize: 11, color: 'var(--muted)', lineHeight: '14px' }}>
                <span /><span>Lun</span><span /><span>Mié</span><span /><span>Vie</span><span /><span>Dom</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weeks}, 14px)`, columnGap: 3, height: 16, fontSize: 11, color: 'var(--muted)', lineHeight: '16px' }}>
                  {monthCols.map((m) => (
                    <span key={m.label} style={{ gridColumn: `${m.col} / span 3`, gridRow: 1, whiteSpace: 'nowrap' }}>{m.label}</span>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 14px)', gridAutoFlow: 'column', gridAutoColumns: '14px', gap: 3 }}>
                  {yearCells.map((d) => {
                    const inYear = d >= yearStart && d <= yearEnd;
                    const future = d > today;
                    return (
                      <span
                        key={d}
                        title={inYear ? titleFor(d) : undefined}
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 3,
                          background: !inYear || future ? 'transparent' : shades[level(d)],
                          border: !inYear ? 0 : d === today ? '2px solid var(--terra)' : future ? '1px solid var(--line)' : 0,
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', flexWrap: 'wrap' }}>
          <span>{single ? 'No hecho' : 'Ninguno'}</span>
          {(single ? [shades[0], shades[4]] : shades).map((c) => (
            <span key={c} aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 3, background: c }} />
          ))}
          <span>{single ? 'Hecho' : 'Todos'}</span>
        </div>
      </section>
      {toast.node}
    </main>
  );
}
