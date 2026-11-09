'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check } from './Check';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { PRIORITY, api, type Priority, type Status, type Subtask, type Task, type TaskList } from '@/lib/client';
import { useDebouncedSave } from '@/lib/hooks';

type View = 'lista' | 'tablero';
const STATUS_LABEL: Record<Status, string> = { todo: 'Por hacer', doing: 'En progreso', done: 'Hecha' };

function sortTasks(a: Task, b: Task) {
  const d = Number(a.status === 'done') - Number(b.status === 'done');
  if (d) return d;
  const p = PRIORITY[a.priority].rank - PRIORITY[b.priority].rank;
  if (p) return p;
  return b.createdAt.localeCompare(a.createdAt);
}

export function TasksView() {
  const toast = useToast();
  const [lists, setLists] = useState<TaskList[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const [active, setActive] = useState<'all' | string>('all');
  const [view, setView] = useState<View>('lista');
  const [prioFilter, setPrioFilter] = useState<'all' | Priority>('all');
  const [showDone, setShowDone] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [draft, setDraft] = useState('');
  const [draftPrio, setDraftPrio] = useState<Priority>('media');
  const [subDraft, setSubDraft] = useState('');
  const [addingList, setAddingList] = useState(false);
  const [listDraft, setListDraft] = useState('');

  // Recordamos la vista preferida en este navegador.
  useEffect(() => {
    try {
      const v = localStorage.getItem('krono.tasks.view');
      if (v === 'lista' || v === 'tablero') setView(v);
    } catch {
      /* sin almacenamiento */
    }
  }, []);
  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem('krono.tasks.view', v);
    } catch {
      /* sin almacenamiento */
    }
  };

  useEffect(() => {
    Promise.all([api<{ lists: TaskList[] }>('/api/lists'), api<{ tasks: Task[] }>('/api/tasks')])
      .then(([l, t]) => {
        setLists(l.lists);
        setTasks(t.tasks);
      })
      .catch(toast.fail)
      .finally(() => setLoading(false));
  }, [toast.fail]);

  const listById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);
  const pendingCount = useCallback(
    (id: 'all' | string) => tasks.filter((t) => t.status !== 'done' && (id === 'all' || t.listId === id)).length,
    [tasks],
  );

  const inList = tasks.filter((t) => active === 'all' || t.listId === active);
  const filtered = inList.filter((t) => prioFilter === 'all' || t.priority === prioFilter);
  const visible = filtered.filter((t) => showDone || t.status !== 'done').sort(sortTasks);
  const pendingInView = filtered.filter((t) => t.status !== 'done').length;
  const doneInView = filtered.length - pendingInView;
  const selected = tasks.find((t) => t.id === selectedId) ?? null;
  const activeList = active === 'all' ? null : listById.get(active) ?? null;

  /* ---------------- Mutaciones ---------------- */

  const replaceTask = (t: Task) => setTasks((prev) => prev.map((x) => (x.id === t.id ? t : x)));

  const updateTask = useCallback(
    async (id: string, patch: Partial<Pick<Task, 'title' | 'listId' | 'priority' | 'status' | 'notes'>>) => {
      setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      try {
        const r = await api<{ task: Task }>(`/api/tasks/${id}`, { method: 'PATCH', body: patch });
        setTasks((prev) => prev.map((x) => (x.id === id ? { ...r.task, notes: x.notes, title: x.title } : x)));
      } catch (err) {
        toast.fail(err);
      }
    },
    [toast],
  );

  const textSaver = useDebouncedSave<{ id: string; patch: { title?: string; notes?: string } }>(async ({ id, patch }) => {
    try {
      await api(`/api/tasks/${id}`, { method: 'PATCH', body: patch });
    } catch (err) {
      toast.fail(err);
    }
  });

  const editText = (id: string, patch: { title?: string; notes?: string }) => {
    setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (patch.title !== undefined && !patch.title.trim()) return; // no guardamos títulos vacíos
    textSaver.schedule({ id, patch });
  };

  async function addTask() {
    const title = draft.trim();
    if (!title) return;
    const listId = active !== 'all' ? active : lists.find((l) => l.name === 'Personal')?.id ?? lists[0]?.id;
    if (!listId) {
      toast.show('Primero crea una lista');
      return;
    }
    try {
      const r = await api<{ task: Task }>('/api/tasks', { method: 'POST', body: { title, listId, priority: draftPrio } });
      setTasks((prev) => [r.task, ...prev]);
      setDraft('');
      setSelectedId(r.task.id);
    } catch (err) {
      toast.fail(err);
    }
  }

  async function deleteTask(t: Task) {
    if (!window.confirm(`¿Eliminar la tarea "${t.title}"?`)) return;
    try {
      await api(`/api/tasks/${t.id}`, { method: 'DELETE' });
      setTasks((prev) => prev.filter((x) => x.id !== t.id));
      setSelectedId(null);
    } catch (err) {
      toast.fail(err);
    }
  }

  async function addSubtask() {
    const text = subDraft.trim();
    if (!text || !selected) return;
    try {
      const r = await api<{ subtask: Subtask }>(`/api/tasks/${selected.id}/subtasks`, { method: 'POST', body: { text } });
      replaceTask({ ...selected, subtasks: [...selected.subtasks, r.subtask] });
      setSubDraft('');
    } catch (err) {
      toast.fail(err);
    }
  }

  async function patchSubtask(task: Task, sub: Subtask, patch: Partial<Subtask>) {
    replaceTask({ ...task, subtasks: task.subtasks.map((s) => (s.id === sub.id ? { ...s, ...patch } : s)) });
    try {
      await api(`/api/subtasks/${sub.id}`, { method: 'PATCH', body: patch });
    } catch (err) {
      toast.fail(err);
    }
  }

  async function deleteSubtask(task: Task, sub: Subtask) {
    replaceTask({ ...task, subtasks: task.subtasks.filter((s) => s.id !== sub.id) });
    try {
      await api(`/api/subtasks/${sub.id}`, { method: 'DELETE' });
    } catch (err) {
      toast.fail(err);
    }
  }

  async function addList() {
    const name = listDraft.trim();
    if (!name) {
      setAddingList(false);
      return;
    }
    try {
      const r = await api<{ list: TaskList }>('/api/lists', { method: 'POST', body: { name } });
      setLists((prev) => [...prev, r.list]);
      setActive(r.list.id);
      setListDraft('');
      setAddingList(false);
    } catch (err) {
      toast.fail(err);
    }
  }

  async function deleteList(l: TaskList) {
    const n = tasks.filter((t) => t.listId === l.id).length;
    if (!window.confirm(`¿Eliminar la lista "${l.name}"${n ? ` y sus ${n} tareas` : ''}?`)) return;
    try {
      await api(`/api/lists/${l.id}`, { method: 'DELETE' });
      setLists((prev) => prev.filter((x) => x.id !== l.id));
      setTasks((prev) => prev.filter((t) => t.listId !== l.id));
      setActive('all');
    } catch (err) {
      toast.fail(err);
    }
  }

  const nextStatus = (s: Status): Status => (s === 'todo' ? 'doing' : s === 'doing' ? 'done' : 'todo');
  const moveLabel = (s: Status) => (s === 'todo' ? 'Mover a En progreso →' : s === 'doing' ? 'Marcar como hecha ✓' : 'Reabrir');

  /* ---------------- Render ---------------- */

  const taskMeta = (t: Task, compact = false) => {
    const list = listById.get(t.listId);
    const subDone = t.subtasks.filter((s) => s.done).length;
    return (
      <span className="meta">
        <span>
          <span className="swatch" style={{ background: list?.color }} aria-hidden="true" />
          {list?.name ?? 'Sin lista'}
        </span>
        {compact && <span style={{ fontWeight: 600, color: PRIORITY[t.priority].color }}>{PRIORITY[t.priority].label}</span>}
        {!compact && t.status === 'doing' && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>En progreso</span>}
        {t.subtasks.length > 0 && (
          <span>
            <Icon name="subtasks" size={14} />
            {subDone}/{t.subtasks.length}
          </span>
        )}
        {!compact && t.notes.trim() && (
          <span>
            <Icon name="note" size={14} />
            Nota
          </span>
        )}
      </span>
    );
  };

  const columns: { id: Status; name: string }[] = [
    { id: 'todo', name: 'Por hacer' },
    { id: 'doing', name: 'En progreso' },
    ...(showDone ? [{ id: 'done' as Status, name: 'Hecho' }] : []),
  ];

  return (
    <main className="page row">
      {/* ---------- Listas ---------- */}
      <aside className="col-side" aria-label="Listas" style={{ flexBasis: 220, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2 className="eyebrow" style={{ padding: '0 12px', marginBottom: 8 }}>Listas</h2>
        <button type="button" className="side-item" aria-pressed={active === 'all'} onClick={() => setActive('all')}>
          <span className="swatch" style={{ width: 10, height: 10, background: 'var(--ink)' }} aria-hidden="true" />
          Todas
          <span className="count">{pendingCount('all')}</span>
        </button>
        {lists.map((l) => (
          <button key={l.id} type="button" className="side-item" aria-pressed={active === l.id} onClick={() => setActive(l.id)}>
            <span className="swatch" style={{ width: 10, height: 10, background: l.color }} aria-hidden="true" />
            <span className="ellipsis">{l.name}</span>
            <span className="count">{pendingCount(l.id)}</span>
          </button>
        ))}
        {addingList ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void addList();
            }}
            style={{ display: 'flex', gap: 6, marginTop: 4 }}
          >
            <label htmlFor="nueva-lista" className="sr-only">Nombre de la lista</label>
            <input
              id="nueva-lista"
              className="input"
              autoFocus
              placeholder="Nombre de la lista"
              value={listDraft}
              onChange={(e) => setListDraft(e.target.value)}
              onBlur={() => !listDraft.trim() && setAddingList(false)}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" type="submit" aria-label="Crear lista" style={{ padding: '0 12px' }}>
              <Icon name="check" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="side-item"
            onClick={() => setAddingList(true)}
            style={{ border: '1px dashed var(--dash)', color: 'var(--muted)', marginTop: 4, fontSize: 15 }}
          >
            <Icon name="plus" size={16} stroke={2.2} />
            Nueva lista
          </button>
        )}
      </aside>

      {/* ---------- Tareas ---------- */}
      <section className="col-main stack" aria-labelledby="h-lista" style={{ flexBasis: 520 }}>
        <div className="between" style={{ alignItems: 'flex-end' }}>
          <div>
            <h1 id="h-lista" className="page-title">{activeList ? activeList.name : 'Todas las tareas'}</h1>
            <p className="page-sub">
              {pendingInView} {pendingInView === 1 ? 'pendiente' : 'pendientes'} · {doneInView}{' '}
              {doneInView === 1 ? 'completada' : 'completadas'}
              {activeList && (
                <>
                  {' · '}
                  <button type="button" onClick={() => deleteList(activeList)} style={{ border: 0, background: 'none', padding: 0, color: 'var(--danger)', fontWeight: 600, fontSize: 15 }}>
                    Eliminar lista
                  </button>
                </>
              )}
            </p>
          </div>
          <div className="seg" role="group" aria-label="Vista">
            <button type="button" aria-pressed={view === 'lista'} onClick={() => changeView('lista')}>Lista</button>
            <button type="button" aria-pressed={view === 'tablero'} onClick={() => changeView('tablero')}>Tablero</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px' }}>
          <div role="group" aria-label="Filtrar por prioridad" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span className="small muted">Prioridad</span>
            {(['all', 'alta', 'media', 'baja'] as const).map((p) => (
              <button key={p} type="button" className="pill" aria-pressed={prioFilter === p} onClick={() => setPrioFilter(p)}>
                {p === 'all' ? 'Todas' : PRIORITY[p].label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="pill"
            aria-pressed={showDone}
            onClick={() => setShowDone((v) => !v)}
            style={{ marginLeft: 'auto', fontWeight: 400, display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <Icon name="eye" size={16} />
            {showDone ? 'Ocultar completadas' : `Mostrar completadas (${doneInView})`}
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void addTask();
          }}
          className="card"
          style={{ padding: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, borderRadius: 14 }}
        >
          <label htmlFor="nueva-tarea" className="sr-only">Nueva tarea</label>
          <input
            id="nueva-tarea"
            placeholder={activeList ? `Agregar una tarea a ${activeList.name}…` : 'Agregar una tarea…'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            style={{ flex: '1 1 220px', minWidth: 0, height: 44, padding: '0 12px', border: 0, background: 'transparent', outline: 'none' }}
          />
          <label htmlFor="nueva-prio" className="sr-only">Prioridad de la nueva tarea</label>
          <select id="nueva-prio" className="select" value={draftPrio} onChange={(e) => setDraftPrio(e.target.value as Priority)}>
            <option value="alta">Prioridad alta</option>
            <option value="media">Prioridad media</option>
            <option value="baja">Prioridad baja</option>
          </select>
          <button className="btn btn-primary" type="submit">
            <Icon name="plus" size={16} stroke={2.4} />
            Agregar
          </button>
        </form>

        {loading ? (
          <p className="muted">Cargando…</p>
        ) : view === 'lista' ? (
          visible.length === 0 ? (
            <div className="empty" style={{ padding: '48px 24px' }}>
              <p className="serif" style={{ margin: 0, fontSize: 22, color: 'var(--ink)' }}>Nada pendiente por aquí</p>
              <p style={{ margin: '6px 0 0' }}>Agrega una tarea o cambia los filtros.</p>
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {visible.map((t) => {
                const done = t.status === 'done';
                return (
                  <li key={t.id} className={`task-row${t.id === selectedId ? ' selected' : ''}`}>
                    <Check
                      checked={done}
                      label={(done ? 'Reabrir: ' : 'Marcar como hecha: ') + t.title}
                      onToggle={() => updateTask(t.id, { status: done ? 'todo' : 'done' })}
                    />
                    <button type="button" className="task-open" onClick={() => setSelectedId(t.id)} aria-label={`Abrir detalle: ${t.title}`}>
                      <span className={done ? 'done-text' : undefined}>{t.title}</span>
                      {taskMeta(t)}
                    </button>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', color: done ? 'var(--faint)' : PRIORITY[t.priority].color }}>
                      <Icon name="flag" size={14} stroke={2.2} />
                      {PRIORITY[t.priority].label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div className="board" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(220px, 1fr))` }}>
              {columns.map((c) => {
                const cards = filtered.filter((t) => t.status === c.id).sort(sortTasks);
                return (
                  <div key={c.id} className="board-col">
                    <div className="between" style={{ padding: '2px 4px' }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</h3>
                      <span className="count-badge">{cards.length}</span>
                    </div>
                    {cards.map((t) => (
                      <div key={t.id} className={`board-card${t.id === selectedId ? ' selected' : ''}`}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(t.id)}
                          className={t.status === 'done' ? 'done-text' : undefined}
                          style={{ border: 0, background: 'transparent', padding: 0, textAlign: 'left', fontSize: 16, minHeight: 24 }}
                        >
                          {t.title}
                        </button>
                        {taskMeta(t, true)}
                        <button type="button" className="btn btn-sm" style={{ alignSelf: 'flex-start', fontWeight: 400, background: 'var(--sheet-2)' }} onClick={() => updateTask(t.id, { status: nextStatus(t.status) })}>
                          {moveLabel(t.status)}
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ---------- Detalle ---------- */}
      <aside className="col-detail" aria-label="Detalle de la tarea">
        {!selected ? (
          <div className="empty" style={{ padding: '40px 24px' }}>Selecciona una tarea para ver sus subtareas y notas.</div>
        ) : (
          <div className="card stack" style={{ gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="xsmall muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span className="swatch" style={{ background: listById.get(selected.listId)?.color }} aria-hidden="true" />
                  {listById.get(selected.listId)?.name} · {STATUS_LABEL[selected.status]}
                </span>
                <label htmlFor="det-titulo" className="sr-only">Título</label>
                <textarea
                  id="det-titulo"
                  className="title-input"
                  rows={Math.min(4, Math.max(1, Math.ceil(selected.title.length / 16)))}
                  value={selected.title}
                  onChange={(e) => editText(selected.id, { title: e.target.value.replace(/\n/g, ' ') })}
                />
              </div>
              <button type="button" className="icon-btn muted" aria-label="Cerrar detalle" onClick={() => setSelectedId(null)}>
                <Icon name="close" />
              </button>
            </div>

            <div className="field" style={{ gap: 8 }}>
              <span className="label">Prioridad</span>
              <div role="group" aria-label="Prioridad" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
                {(['alta', 'media', 'baja'] as Priority[]).map((p) => {
                  const on = selected.priority === p;
                  const c = PRIORITY[p].color;
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={on}
                      onClick={() => updateTask(selected.id, { priority: p })}
                      style={{ height: 40, borderRadius: 10, border: `1.5px solid ${on ? c : 'var(--line)'}`, background: on ? c : 'var(--sheet)', color: on ? 'var(--sheet)' : c, fontSize: 14, fontWeight: 600 }}
                    >
                      {PRIORITY[p].label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <div className="field">
                <label className="label" htmlFor="det-lista">Lista</label>
                <select id="det-lista" className="select" value={selected.listId} onChange={(e) => updateTask(selected.id, { listId: e.target.value })}>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="label" htmlFor="det-estado">Estado</label>
                <select id="det-estado" className="select" value={selected.status} onChange={(e) => updateTask(selected.id, { status: e.target.value as Status })}>
                  <option value="todo">Por hacer</option>
                  <option value="doing">En progreso</option>
                  <option value="done">Hecha</option>
                </select>
              </div>
            </div>

            <div className="field" style={{ gap: 8 }}>
              <div className="between">
                <span className="label">Subtareas</span>
                <span className="xsmall muted">
                  {selected.subtasks.length
                    ? `${selected.subtasks.filter((s) => s.done).length} de ${selected.subtasks.length}`
                    : 'Sin subtareas'}
                </span>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {selected.subtasks.map((s) => (
                  <li key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4, borderBottom: '1px solid var(--line-soft)' }}>
                    <Check small checked={s.done} label={(s.done ? 'Desmarcar: ' : 'Marcar: ') + s.text} onToggle={() => patchSubtask(selected, s, { done: !s.done })} />
                    <span className={s.done ? 'done-text' : undefined} style={{ flex: 1, fontSize: 15 }}>{s.text}</span>
                    <button type="button" className="icon-btn muted" aria-label={`Eliminar subtarea: ${s.text}`} onClick={() => deleteSubtask(selected, s)}>
                      <Icon name="close" size={14} />
                    </button>
                  </li>
                ))}
              </ul>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void addSubtask();
                }}
                style={{ display: 'flex', gap: 6 }}
              >
                <label htmlFor="nueva-sub" className="sr-only">Nueva subtarea</label>
                <input id="nueva-sub" className="input dashed" placeholder="Agregar subtarea" value={subDraft} onChange={(e) => setSubDraft(e.target.value)} style={{ flex: 1, height: 40 }} />
                <button type="submit" className="btn btn-primary" aria-label="Agregar subtarea" style={{ height: 40, padding: '0 12px' }}>
                  <Icon name="plus" size={16} stroke={2.4} />
                </button>
              </form>
            </div>

            <div className="field">
              <label className="label" htmlFor="det-notas">Notas</label>
              <textarea
                id="det-notas"
                className="paper sm"
                rows={5}
                placeholder="Agrega detalles, enlaces o lo que necesites recordar…"
                value={selected.notes}
                onChange={(e) => editText(selected.id, { notes: e.target.value })}
              />
            </div>

            <div className="between">
              <button type="button" className="btn btn-primary" onClick={() => updateTask(selected.id, { status: selected.status === 'done' ? 'todo' : 'done' })}>
                {selected.status === 'done' ? 'Reabrir tarea' : 'Marcar como hecha'}
              </button>
              <button type="button" className="btn btn-danger" onClick={() => deleteTask(selected)}>Eliminar</button>
            </div>
          </div>
        )}
      </aside>
      {toast.node}
    </main>
  );
}
