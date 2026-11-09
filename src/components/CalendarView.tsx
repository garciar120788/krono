'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { api, darken, mix, type CalEvent, type Category } from '@/lib/client';
import {
  DOW_SHORT,
  addDays,
  addMonths,
  dayOfMonth,
  formatLong,
  formatMonth,
  formatWeekRange,
  parts,
  startOfMonth,
  startOfWeek,
  toMinutes,
  weekday,
} from '@/lib/dates';
import { useDebouncedSave, useToday } from '@/lib/hooks';
import { REPEAT_LABELS, occursOn, type Repeat } from '@/lib/recurrence';

type View = 'mes' | 'semana';
type EditableText = 'title' | 'place' | 'description';

const HOUR_START = 7;
const HOUR_END = 23; // la cuadrícula termina a las 23:00
const HOUR_PX = 48;
const NO_CAT = { id: '', name: 'Sin categoría', color: '#776B5D', position: 99 };

export function CalendarView() {
  const toast = useToast();
  const params = useSearchParams();
  const today = useToday();

  const initialDate = params.get('fecha') && /^\d{4}-\d{2}-\d{2}$/.test(params.get('fecha')!) ? params.get('fecha')! : today;
  const [view, setView] = useState<View>(params.get('fecha') ? 'semana' : 'mes');
  const [month, setMonth] = useState(() => startOfMonth(initialDate));
  const [weekStart, setWeekStart] = useState(() => startOfWeek(initialDate));
  const [events, setEvents] = useState<Map<string, CalEvent>>(new Map());
  const [categories, setCategories] = useState<Category[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(params.get('evento'));
  const [nowMin, setNowMin] = useState<number | null>(null);
  const [addingCat, setAddingCat] = useState(false);
  const [catDraft, setCatDraft] = useState('');

  // Línea de "ahora" en la vista semanal.
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setNowMin(n.getHours() * 60 + n.getMinutes());
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const gridStart = startOfWeek(month);
  const range = view === 'mes' ? { from: gridStart, to: addDays(gridStart, 41) } : { from: weekStart, to: addDays(weekStart, 6) };

  useEffect(() => {
    api<{ categories: Category[] }>('/api/event-categories')
      .then((r) => setCategories(r.categories))
      .catch(toast.fail);
    const wanted = params.get('evento');
    if (wanted) {
      api<{ event: CalEvent }>(`/api/events/${wanted}`)
        .then((r) => {
          setEvents((prev) => new Map(prev).set(r.event.id, r.event));
          setWeekStart(startOfWeek(r.event.startDate));
          setMonth(startOfMonth(r.event.startDate));
        })
        .catch(() => setSelectedId(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api<{ events: CalEvent[] }>(`/api/events?from=${range.from}&to=${range.to}`)
      .then((r) =>
        setEvents((prev) => {
          const next = new Map(prev);
          for (const e of r.events) {
            const local = prev.get(e.id);
            // No pisamos lo que el usuario está escribiendo en el evento abierto.
            next.set(e.id, local && e.id === selectedId ? { ...e, title: local.title, place: local.place, description: local.description } : e);
          }
          return next;
        }),
      )
      .catch(toast.fail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const catOf = (e: CalEvent) => (e.categoryId && catById.get(e.categoryId)) || NO_CAT;
  const visibleEvents = [...events.values()].filter((e) => !hidden.has(e.categoryId ?? ''));
  const eventsOn = (d: string) =>
    visibleEvents
      .filter((e) => occursOn(e, d))
      .sort((a, b) => Number(b.allDay) - Number(a.allDay) || toMinutes(a.startTime) - toMinutes(b.startTime));

  const selected = selectedId ? events.get(selectedId) ?? null : null;

  /* ---------- Edición ---------- */
  const textSaver = useDebouncedSave<{ id: string; patch: Partial<Record<EditableText, string>> }>(async ({ id, patch }) => {
    try {
      await api(`/api/events/${id}`, { method: 'PATCH', body: patch });
    } catch (err) {
      toast.fail(err);
    }
  });

  const setLocal = (id: string, patch: Partial<CalEvent>) =>
    setEvents((prev) => {
      const e = prev.get(id);
      if (!e) return prev;
      return new Map(prev).set(id, { ...e, ...patch });
    });

  function editText(field: EditableText, value: string) {
    if (!selected) return;
    setLocal(selected.id, { [field]: value });
    const current = { title: selected.title, place: selected.place, description: selected.description, [field]: value };
    textSaver.schedule({ id: selected.id, patch: current });
  }

  async function patchEvent(patch: Partial<CalEvent>) {
    if (!selected) return;
    const id = selected.id;
    setLocal(id, patch);
    try {
      await textSaver.flush();
      const r = await api<{ event: CalEvent }>(`/api/events/${id}`, { method: 'PATCH', body: patch });
      setEvents((prev) => {
        const local = prev.get(id);
        return new Map(prev).set(id, local ? { ...r.event, title: local.title, place: local.place, description: local.description } : r.event);
      });
    } catch (err) {
      toast.fail(err);
    }
  }

  async function newEvent() {
    const inRange = today >= range.from && today <= range.to;
    const date = inRange ? today : view === 'mes' ? month : weekStart;
    try {
      const r = await api<{ event: CalEvent }>('/api/events', {
        method: 'POST',
        body: { title: '', startDate: date, startTime: '10:00', endTime: '11:00', categoryId: categories[0]?.id ?? null },
      });
      setEvents((prev) => new Map(prev).set(r.event.id, r.event));
      setSelectedId(r.event.id);
    } catch (err) {
      toast.fail(err);
    }
  }

  async function deleteEvent() {
    if (!selected) return;
    const label = selected.title || 'Sin título';
    const extra = selected.repeat !== 'nunca' ? ' (y todas sus repeticiones)' : '';
    if (!window.confirm(`¿Eliminar "${label}"${extra}?`)) return;
    try {
      await api(`/api/events/${selected.id}`, { method: 'DELETE' });
      setEvents((prev) => {
        const next = new Map(prev);
        next.delete(selected.id);
        return next;
      });
      setSelectedId(null);
    } catch (err) {
      toast.fail(err);
    }
  }

  async function addCategory() {
    const name = catDraft.trim();
    if (!name) {
      setAddingCat(false);
      return;
    }
    try {
      const r = await api<{ category: Category }>('/api/event-categories', { method: 'POST', body: { name } });
      setCategories((prev) => [...prev, r.category]);
      setCatDraft('');
      setAddingCat(false);
    } catch (err) {
      toast.fail(err);
    }
  }

  async function deleteCategory(c: Category) {
    if (!window.confirm(`¿Eliminar la categoría "${c.name}"? Sus eventos se conservan sin categoría.`)) return;
    try {
      await api(`/api/event-categories/${c.id}`, { method: 'DELETE' });
      setCategories((prev) => prev.filter((x) => x.id !== c.id));
      setEvents((prev) => {
        const next = new Map(prev);
        for (const [id, e] of next) if (e.categoryId === c.id) next.set(id, { ...e, categoryId: null });
        return next;
      });
    } catch (err) {
      toast.fail(err);
    }
  }

  const toggleHidden = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* ---------- Estilos por evento ---------- */
  const look = (e: CalEvent) => {
    const c = catOf(e).color;
    const sel = e.id === selectedId;
    return {
      background: mix('#FFFBF3', c, e.allDay ? 0.24 : 0.12),
      color: darken(c),
      border: `1px solid ${mix('#FFFBF3', c, 0.4)}`,
      boxShadow: sel ? `0 0 0 2px ${c}` : 'none',
      dot: c,
    };
  };

  /* ---------- Navegación ---------- */
  const isMonth = view === 'mes';
  const goPrev = () => (isMonth ? setMonth(addMonths(month, -1)) : setWeekStart(addDays(weekStart, -7)));
  const goNext = () => (isMonth ? setMonth(addMonths(month, 1)) : setWeekStart(addDays(weekStart, 7)));
  const goToday = () => {
    setMonth(startOfMonth(today));
    setWeekStart(startOfWeek(today));
  };
  const title = isMonth ? formatMonth(month) : `${formatWeekRange(weekStart)} ${parts(addDays(weekStart, 6)).y}`;

  /* ---------- Semana: columnas para eventos que se enciman ---------- */
  function layoutDay(list: CalEvent[]) {
    const timed = list
      .filter((e) => !e.allDay)
      .map((e) => {
        const s = Math.max(HOUR_START * 60, toMinutes(e.startTime));
        const en = Math.min(HOUR_END * 60, Math.max(s + 20, toMinutes(e.endTime)));
        return { e, s, en, col: 0, cols: 1 };
      })
      .sort((a, b) => a.s - b.s || b.en - a.en);
    let group: typeof timed = [];
    let groupEnd = -1;
    const flush = () => {
      const n = Math.max(1, ...group.map((g) => g.col + 1));
      group.forEach((g) => (g.cols = n));
      group = [];
    };
    for (const item of timed) {
      if (item.s >= groupEnd && group.length) flush();
      const used = new Set(group.filter((g) => g.en > item.s).map((g) => g.col));
      let col = 0;
      while (used.has(col)) col++;
      item.col = col;
      group.push(item);
      groupEnd = Math.max(groupEnd, item.en);
    }
    if (group.length) flush();
    return timed;
  }

  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => `${String(HOUR_START + i).padStart(2, '0')}:00`);
  const gridHeight = (HOUR_END - HOUR_START) * HOUR_PX;

  return (
    <main className="page row">
      <section className="col-main stack" aria-labelledby="h-cal" style={{ flexBasis: 640 }}>
        <div className="between">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <h1 id="h-cal" className="page-title" style={{ fontSize: 36, marginRight: 12 }}>{title}</h1>
            <button type="button" className="icon-btn bordered" aria-label={isMonth ? 'Mes anterior' : 'Semana anterior'} onClick={goPrev}>
              <Icon name="left" />
            </button>
            <button type="button" className="btn" style={{ borderRadius: 999 }} onClick={goToday}>Hoy</button>
            <button type="button" className="icon-btn bordered" aria-label={isMonth ? 'Mes siguiente' : 'Semana siguiente'} onClick={goNext}>
              <Icon name="right" />
            </button>
          </div>
          <div className="seg" role="group" aria-label="Vista">
            <button type="button" aria-pressed={isMonth} onClick={() => setView('mes')}>Mes</button>
            <button type="button" aria-pressed={!isMonth} onClick={() => setView('semana')}>Semana</button>
          </div>
        </div>

        {isMonth ? (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="month-grid" style={{ borderBottom: '1px solid var(--line)' }}>
              {DOW_SHORT.map((w) => (
                <div key={w} style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>{w}</div>
              ))}
            </div>
            <div className="month-grid">
              {Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)).map((d) => {
                const inMonth = parts(d).m === parts(month).m;
                const list = eventsOn(d);
                return (
                  <div key={d} className={`month-cell${inMonth ? '' : ' out'}`}>
                    <button
                      type="button"
                      className={`day-num${d === today ? ' today' : ''}`}
                      aria-label={`Ver la semana del ${formatLong(d)}${list.length ? `, ${list.length} eventos` : ''}`}
                      onClick={() => {
                        setWeekStart(startOfWeek(d));
                        setView('semana');
                      }}
                    >
                      {dayOfMonth(d)}
                    </button>
                    {list.slice(0, 3).map((e) => {
                      const l = look(e);
                      return (
                        <button
                          key={e.id}
                          type="button"
                          className="ev-chip"
                          onClick={() => setSelectedId(e.id)}
                          style={{ background: l.background, color: l.color, boxShadow: l.boxShadow }}
                        >
                          <span className="dot" style={{ background: l.dot }} aria-hidden="true" />
                          <span className="ellipsis">
                            {!e.allDay && <strong>{e.startTime} </strong>}
                            {e.title || 'Sin título'}
                          </span>
                        </button>
                      );
                    })}
                    {list.length > 3 && (
                      <button
                        type="button"
                        onClick={() => {
                          setWeekStart(startOfWeek(d));
                          setView('semana');
                        }}
                        style={{ alignSelf: 'flex-start', border: 0, background: 'transparent', padding: '2px 6px', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}
                      >
                        +{list.length - 3} más
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <div style={{ minWidth: 760 }}>
              <div className="week-grid" style={{ borderBottom: '1px solid var(--line)' }}>
                <div />
                {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d, i) => {
                  const isToday = d === today;
                  return (
                    <div key={d} style={{ padding: '10px 8px', textAlign: 'center', borderLeft: '1px solid var(--line-soft)' }}>
                      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: isToday ? 'var(--terra)' : 'var(--muted)' }}>{DOW_SHORT[i]}</span>
                      <span
                        className="serif"
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 34, height: 34, borderRadius: 999, background: isToday ? 'var(--terra)' : 'transparent', color: isToday ? 'var(--sheet)' : 'var(--ink)', fontSize: 18, fontWeight: 600 }}
                      >
                        {dayOfMonth(d)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="week-grid" style={{ borderBottom: '1px solid var(--line)' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', padding: '6px 4px', textAlign: 'right', lineHeight: 1.2 }}>Todo el día</div>
                {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d) => (
                  <div key={d} style={{ padding: 4, borderLeft: '1px solid var(--line-soft)', display: 'flex', flexDirection: 'column', gap: 3, minHeight: 32, minWidth: 0 }}>
                    {eventsOn(d)
                      .filter((e) => e.allDay)
                      .map((e) => {
                        const l = look(e);
                        return (
                          <button key={e.id} type="button" className="ev-chip ellipsis" onClick={() => setSelectedId(e.id)} style={{ background: l.background, color: l.color, boxShadow: l.boxShadow, fontWeight: 600, display: 'block' }}>
                            {e.title || 'Sin título'}
                          </button>
                        );
                      })}
                  </div>
                ))}
              </div>
              <div className="week-grid">
                <div style={{ position: 'relative', height: gridHeight }}>
                  {hours.map((h, i) => (
                    <div key={h} style={{ height: HOUR_PX, fontSize: 12, color: 'var(--muted)', textAlign: 'right', paddingRight: 8, transform: i ? 'translateY(-8px)' : 'translateY(2px)' }}>{h}</div>
                  ))}
                </div>
                {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d) => {
                  const isToday = d === today;
                  const laid = layoutDay(eventsOn(d));
                  const showNow = isToday && nowMin !== null && nowMin >= HOUR_START * 60 && nowMin <= HOUR_END * 60;
                  const nowTop = nowMin !== null ? ((nowMin - HOUR_START * 60) / 60) * HOUR_PX : 0;
                  return (
                    <div key={d} className="week-col" style={{ height: gridHeight, backgroundColor: isToday ? '#FCF6EC' : undefined }}>
                      {laid.map(({ e, s, en, col, cols }) => {
                        const l = look(e);
                        const top = ((s - HOUR_START * 60) / 60) * HOUR_PX;
                        const height = Math.max(22, ((en - s) / 60) * HOUR_PX - 2);
                        return (
                          <button
                            key={e.id}
                            type="button"
                            className="ev-block"
                            onClick={() => setSelectedId(e.id)}
                            style={{
                              top,
                              height,
                              left: `calc(${(col / cols) * 100}% + 3px)`,
                              width: `calc(${100 / cols}% - 6px)`,
                              background: l.background,
                              color: l.color,
                              border: l.border,
                              boxShadow: l.boxShadow,
                            }}
                          >
                            <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{e.title || 'Sin título'}</span>
                            <span style={{ fontSize: 12, lineHeight: 1.3 }}>{e.startTime} – {e.endTime}</span>
                          </button>
                        );
                      })}
                      {showNow && (
                        <>
                          <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: nowTop, height: 2, background: 'var(--terra)' }} />
                          <div aria-hidden="true" style={{ position: 'absolute', left: -5, top: nowTop - 4, width: 10, height: 10, borderRadius: 999, background: 'var(--terra)' }} />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      <aside className="col-detail stack" aria-label="Eventos">
        <button type="button" className="btn btn-primary" style={{ height: 48, borderRadius: 12, fontSize: 16 }} onClick={newEvent}>
          <Icon name="plus" stroke={2.4} />
          Nuevo evento
        </button>

        <div className="card" style={{ padding: '16px 16px 10px' }}>
          <h2 className="eyebrow" style={{ marginBottom: 6 }}>Categorías</h2>
          {categories.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 40, cursor: 'pointer', flex: 1 }}>
                <input type="checkbox" checked={!hidden.has(c.id)} onChange={() => toggleHidden(c.id)} style={{ width: 18, height: 18, margin: 0, accentColor: c.color }} />
                <span className="swatch" style={{ width: 10, height: 10, background: c.color }} aria-hidden="true" />
                <span>{c.name}</span>
              </label>
              <button type="button" className="icon-btn muted" aria-label={`Eliminar categoría ${c.name}`} onClick={() => deleteCategory(c)} style={{ width: 36, height: 36, minWidth: 36 }}>
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
          {[...events.values()].some((e) => !e.categoryId) ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 40, cursor: 'pointer' }}>
              <input type="checkbox" checked={!hidden.has('')} onChange={() => toggleHidden('')} style={{ width: 18, height: 18, margin: 0, accentColor: NO_CAT.color }} />
              <span className="swatch" style={{ width: 10, height: 10, background: NO_CAT.color }} aria-hidden="true" />
              <span>Sin categoría</span>
            </label>
          ) : null}
          {addingCat ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void addCategory();
              }}
              style={{ display: 'flex', gap: 6, margin: '6px 0' }}
            >
              <label htmlFor="nueva-cat" className="sr-only">Nombre de la categoría</label>
              <input id="nueva-cat" className="input" autoFocus style={{ flex: 1, height: 40 }} placeholder="Nueva categoría" value={catDraft} onChange={(e) => setCatDraft(e.target.value)} onBlur={() => !catDraft.trim() && setAddingCat(false)} />
            </form>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" style={{ color: 'var(--muted)', paddingLeft: 0 }} onClick={() => setAddingCat(true)}>
              <Icon name="plus" size={14} /> Categoría
            </button>
          )}
        </div>

        {!selected ? (
          <div className="empty">Selecciona un evento para ver o editar sus detalles.</div>
        ) : (
          <div className="card stack" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <label htmlFor="ev-titulo" className="sr-only">Título del evento</label>
              <textarea
                id="ev-titulo"
                className="title-input"
                rows={Math.min(4, Math.max(1, Math.ceil(selected.title.length / 16)))}
                placeholder="Nuevo evento"
                value={selected.title}
                onChange={(e) => editText('title', e.target.value.replace(/\n/g, ' '))}
              />
              <button type="button" className="icon-btn muted" aria-label="Cerrar detalle" onClick={() => setSelectedId(null)}>
                <Icon name="close" />
              </button>
            </div>

            <div className="field" style={{ gap: 8 }}>
              <span className="label">Categoría</span>
              <div role="group" aria-label="Categoría" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
                {categories.map((c) => {
                  const on = selected.categoryId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => patchEvent({ categoryId: on ? null : c.id })}
                      style={{ height: 40, borderRadius: 10, border: `1.5px solid ${on ? c.color : 'var(--line)'}`, background: on ? mix('#FFFBF3', c.color, 0.16) : 'var(--sheet)', color: on ? darken(c.color) : 'var(--ink)', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    >
                      <span className="swatch" style={{ background: c.color }} aria-hidden="true" />
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, cursor: 'pointer', fontWeight: 600 }}>
              <input type="checkbox" checked={selected.allDay} onChange={(e) => patchEvent({ allDay: e.target.checked, ...(e.target.checked ? {} : { startTime: '10:00', endTime: '11:00' }) })} style={{ width: 18, height: 18, margin: 0, accentColor: 'var(--accent)' }} />
              Todo el día
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label className="label" htmlFor="ev-fecha">{selected.allDay ? 'Desde' : 'Fecha'}</label>
                <input id="ev-fecha" className="input" type="date" value={selected.startDate} onChange={(e) => e.target.value && patchEvent({ startDate: e.target.value })} />
              </div>
              {selected.allDay ? (
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  <label className="label" htmlFor="ev-hasta">Hasta</label>
                  <input id="ev-hasta" className="input" type="date" min={selected.startDate} value={selected.endDate} onChange={(e) => e.target.value && patchEvent({ endDate: e.target.value })} />
                </div>
              ) : (
                <>
                  <div className="field">
                    <label className="label" htmlFor="ev-inicio">Inicio</label>
                    <input
                      id="ev-inicio"
                      className="input"
                      type="time"
                      value={selected.startTime ?? '10:00'}
                      onChange={(e) => {
                        const s = e.target.value;
                        if (!s) return;
                        // Si el inicio queda después del fin, movemos el fin para conservar la duración.
                        const dur = Math.max(30, toMinutes(selected.endTime) - toMinutes(selected.startTime));
                        const endMin = Math.min(23 * 60 + 59, toMinutes(s) + dur);
                        const end = toMinutes(selected.endTime) <= toMinutes(s) ? `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}` : selected.endTime;
                        void patchEvent({ startTime: s, endTime: end });
                      }}
                    />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor="ev-fin">Fin</label>
                    <input id="ev-fin" className="input" type="time" min={selected.startTime ?? undefined} value={selected.endTime ?? '11:00'} onChange={(e) => e.target.value && e.target.value >= (selected.startTime ?? '00:00') && patchEvent({ endTime: e.target.value })} />
                  </div>
                </>
              )}
            </div>

            <div className="field">
              <label className="label" htmlFor="ev-repetir">Repetir</label>
              <select id="ev-repetir" className="select" value={selected.repeat} onChange={(e) => patchEvent({ repeat: e.target.value as Repeat })}>
                {(Object.keys(REPEAT_LABELS) as Repeat[]).map((r) => (
                  <option key={r} value={r}>{REPEAT_LABELS[r]}</option>
                ))}
              </select>
              {selected.repeat !== 'nunca' && (
                <span className="xsmall muted">
                  Los cambios se aplican a todas las repeticiones. Empieza el {formatLong(selected.startDate)} ({DOW_SHORT[weekday(selected.startDate)]}).
                </span>
              )}
            </div>

            <div className="field">
              <label className="label" htmlFor="ev-lugar">Lugar</label>
              <input id="ev-lugar" className="input" placeholder="Agregar lugar" value={selected.place} onChange={(e) => editText('place', e.target.value)} />
            </div>

            <div className="field">
              <label className="label" htmlFor="ev-desc">Descripción</label>
              <textarea id="ev-desc" className="paper sm" rows={4} placeholder="Notas del evento" value={selected.description} onChange={(e) => editText('description', e.target.value)} />
            </div>

            <button type="button" className="btn btn-danger" style={{ alignSelf: 'flex-start' }} onClick={deleteEvent}>Eliminar evento</button>
          </div>
        )}
      </aside>
      {toast.node}
    </main>
  );
}
