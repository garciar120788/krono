'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { api, type DailyNote, type Folder, type Note } from '@/lib/client';
import { DOW_SHORT, MONTHS, cap, dayOfMonth, formatLong, formatMonth, weekday } from '@/lib/dates';
import { useDebouncedSave, useToday } from '@/lib/hooks';

type Mode = 'diario' | 'libres';

const words = (t: string) => {
  const n = t.trim() ? t.trim().split(/\s+/).length : 0;
  return `${n} ${n === 1 ? 'palabra' : 'palabras'}`;
};
const excerpt = (t: string) => t.replace(/\s+/g, ' ').trim();
const fmtUpdated = (iso: string) => {
  const d = new Date(iso);
  return `Editada el ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
};

export function NotesView() {
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const today = useToday();

  const [mode, setMode] = useState<Mode>(params.get('nota') ? 'libres' : 'diario');
  const [search, setSearch] = useState('');

  // Diario
  const [daily, setDaily] = useState<DailyNote[]>([]);
  const [dayDate, setDayDate] = useState<string>(params.get('fecha') ?? today);
  const [dayText, setDayText] = useState<Record<string, string>>({});

  // Notas libres
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [folder, setFolder] = useState<'all' | 'none' | string>('all');
  const [noteId, setNoteId] = useState<string | null>(params.get('nota'));
  const [addingFolder, setAddingFolder] = useState(false);
  const [folderDraft, setFolderDraft] = useState('');

  /* ---------- Carga inicial ---------- */
  useEffect(() => {
    (async () => {
      try {
        // Crea (si no existe) la nota de hoy: así cada día tiene su hoja nueva.
        const [{ note: todayNote }, list, f, n] = await Promise.all([
          api<{ note: DailyNote }>(`/api/daily-notes/${today}?create=1`),
          api<{ notes: DailyNote[] }>(`/api/daily-notes?until=${today}&limit=366`),
          api<{ folders: Folder[] }>('/api/folders'),
          api<{ notes: Note[] }>('/api/notes'),
        ]);
        const merged = [todayNote, ...list.notes.filter((x) => x.date !== todayNote.date)];
        setDaily(merged);
        setDayText(Object.fromEntries(merged.map((x) => [x.date, x.content])));
        setFolders(f.folders);
        setNotes(n.notes);
        const wanted = params.get('fecha');
        if (wanted && /^\d{4}-\d{2}-\d{2}$/.test(wanted)) {
          setDayDate(wanted);
          if (!merged.some((x) => x.date === wanted)) {
            try {
              const r = await api<{ note: DailyNote }>(`/api/daily-notes/${wanted}`);
              setDaily((prev) => [...prev, r.note].sort((a, b) => b.date.localeCompare(a.date)));
              setDayText((prev) => ({ ...prev, [wanted]: r.note.content }));
            } catch {
              /* ese día todavía no tiene nota: se creará al escribir */
            }
          }
        }
      } catch (err) {
        toast.fail(err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  /* ---------- Guardado automático ---------- */
  const daySaver = useDebouncedSave<{ date: string; content: string }>(async ({ date, content }) => {
    try {
      const r = await api<{ note: DailyNote }>(`/api/daily-notes/${date}`, { method: 'PUT', body: { content } });
      setDaily((prev) =>
        prev.some((x) => x.date === date)
          ? prev.map((x) => (x.date === date ? r.note : x))
          : [...prev, r.note].sort((a, b) => b.date.localeCompare(a.date)),
      );
    } catch (err) {
      toast.fail(err);
    }
  });

  const noteSaver = useDebouncedSave<{ id: string; title: string; content: string }>(async ({ id, title, content }) => {
    try {
      const r = await api<{ note: Note }>(`/api/notes/${id}`, { method: 'PATCH', body: { title, content } });
      setNotes((prev) => prev.map((x) => (x.id === id ? { ...x, updatedAt: r.note.updatedAt } : x)));
    } catch (err) {
      toast.fail(err);
    }
  });

  /* ---------- Diario ---------- */
  const q = search.trim().toLowerCase();
  const dailyList = useMemo(() => {
    const all = daily.some((d) => d.date === dayDate) ? daily : [...daily, { id: 'nuevo', date: dayDate, content: '', updatedAt: '' }];
    return all
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((d) => !q || (dayText[d.date] ?? d.content).toLowerCase().includes(q) || formatLong(d.date).includes(q));
  }, [daily, dayDate, dayText, q]);

  const groups = useMemo(() => {
    const out: { month: string; items: DailyNote[] }[] = [];
    for (const d of dailyList) {
      const m = formatMonth(d.date);
      const g = out.find((x) => x.month === m);
      if (g) g.items.push(d);
      else out.push({ month: m, items: [d] });
    }
    return out;
  }, [dailyList]);

  const ordered = useMemo(() => {
    const dates = new Set(daily.map((d) => d.date));
    dates.add(dayDate);
    return [...dates].sort((a, b) => b.localeCompare(a));
  }, [daily, dayDate]);
  const idx = ordered.indexOf(dayDate);
  const olderDate = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;
  const newerDate = idx > 0 ? ordered[idx - 1] : null;
  const currentDayText = dayText[dayDate] ?? '';

  const selectDay = (date: string) => {
    void daySaver.flush();
    setDayDate(date);
    router.replace(`/notas?fecha=${date}`, { scroll: false });
  };

  /* ---------- Notas libres ---------- */
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders]);
  const visibleNotes = notes
    .filter((n) => folder === 'all' || (folder === 'none' ? !n.folderId : n.folderId === folder))
    .filter((n) => !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
  const note = notes.find((n) => n.id === noteId) ?? null;
  const hasUnfiled = notes.some((n) => !n.folderId);

  async function newNote() {
    try {
      const folderId = folder !== 'all' && folder !== 'none' ? folder : null;
      const r = await api<{ note: Note }>('/api/notes', { method: 'POST', body: { title: '', content: '', folderId } });
      setNotes((prev) => [r.note, ...prev]);
      setNoteId(r.note.id);
      setSearch('');
    } catch (err) {
      toast.fail(err);
    }
  }

  function editNote(patch: { title?: string; content?: string }) {
    if (!note) return;
    const next = { ...note, ...patch };
    setNotes((prev) => prev.map((x) => (x.id === note.id ? next : x)));
    noteSaver.schedule({ id: next.id, title: next.title, content: next.content });
  }

  async function moveNote(folderId: string | null) {
    if (!note) return;
    setNotes((prev) => prev.map((x) => (x.id === note.id ? { ...x, folderId } : x)));
    try {
      await api(`/api/notes/${note.id}`, { method: 'PATCH', body: { folderId } });
    } catch (err) {
      toast.fail(err);
    }
  }

  async function deleteNote() {
    if (!note || !window.confirm(`¿Eliminar la nota "${note.title || 'Sin título'}"?`)) return;
    try {
      await api(`/api/notes/${note.id}`, { method: 'DELETE' });
      setNotes((prev) => prev.filter((x) => x.id !== note.id));
      setNoteId(null);
    } catch (err) {
      toast.fail(err);
    }
  }

  async function addFolder() {
    const name = folderDraft.trim();
    if (!name) {
      setAddingFolder(false);
      return;
    }
    try {
      const r = await api<{ folder: Folder }>('/api/folders', { method: 'POST', body: { name } });
      setFolders((prev) => [...prev, r.folder]);
      setFolder(r.folder.id);
      setFolderDraft('');
      setAddingFolder(false);
    } catch (err) {
      toast.fail(err);
    }
  }

  async function deleteFolder(f: Folder) {
    if (!window.confirm(`¿Eliminar la carpeta "${f.name}"? Sus notas se conservan sin carpeta.`)) return;
    try {
      await api(`/api/folders/${f.id}`, { method: 'DELETE' });
      setFolders((prev) => prev.filter((x) => x.id !== f.id));
      setNotes((prev) => prev.map((n) => (n.folderId === f.id ? { ...n, folderId: null } : n)));
      setFolder('all');
    } catch (err) {
      toast.fail(err);
    }
  }

  const activeFolder = folder !== 'all' && folder !== 'none' ? folderById.get(folder) : undefined;

  /* ---------- Render ---------- */
  return (
    <main className="page row">
      <aside className="col-side stack" aria-label="Lista de notas" style={{ flexBasis: 300, gap: 14 }}>
        <div className="seg full" role="group" aria-label="Tipo de nota">
          <button type="button" aria-pressed={mode === 'diario'} onClick={() => setMode('diario')}>Diario</button>
          <button type="button" aria-pressed={mode === 'libres'} onClick={() => setMode('libres')}>Mis notas</button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <label htmlFor="filtro-notas" className="sr-only">Filtrar notas</label>
          <input
            id="filtro-notas"
            type="search"
            className="input"
            style={{ flex: 1, background: 'var(--sheet)' }}
            placeholder={mode === 'diario' ? 'Buscar en tu diario' : 'Buscar en tus notas'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {mode === 'diario' ? (
            <button type="button" className="btn" onClick={() => selectDay(today)}>Ir a hoy</button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={newNote}>
              <Icon name="plus" size={16} stroke={2.4} />
              Nueva
            </button>
          )}
        </div>

        {mode === 'libres' && (
          <div role="group" aria-label="Carpetas" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button type="button" className="pill" aria-pressed={folder === 'all'} onClick={() => setFolder('all')}>Todas</button>
            {folders.map((f) => (
              <button key={f.id} type="button" className="pill" aria-pressed={folder === f.id} onClick={() => setFolder(f.id)}>
                {f.name}
              </button>
            ))}
            {hasUnfiled && (
              <button type="button" className="pill" aria-pressed={folder === 'none'} onClick={() => setFolder('none')}>Sin carpeta</button>
            )}
            {addingFolder ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void addFolder();
                }}
                style={{ display: 'flex', gap: 4 }}
              >
                <label htmlFor="nueva-carpeta" className="sr-only">Nombre de la carpeta</label>
                <input
                  id="nueva-carpeta"
                  className="input"
                  autoFocus
                  style={{ height: 36, width: 140 }}
                  placeholder="Nueva carpeta"
                  value={folderDraft}
                  onChange={(e) => setFolderDraft(e.target.value)}
                  onBlur={() => !folderDraft.trim() && setAddingFolder(false)}
                />
              </form>
            ) : (
              <button type="button" className="pill" aria-label="Nueva carpeta" onClick={() => setAddingFolder(true)} style={{ borderStyle: 'dashed', color: 'var(--muted)' }}>
                + Carpeta
              </button>
            )}
          </div>
        )}

        {mode === 'diario' ? (
          <div className="stack">
            {groups.map((g) => (
              <div key={g.month} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <h2 className="eyebrow" style={{ padding: '0 12px', marginBottom: 4 }}>{g.month}</h2>
                {g.items.map((d) => {
                  const text = dayText[d.date] ?? d.content;
                  const isToday = d.date === today;
                  return (
                    <button key={d.date} type="button" className="item-btn" aria-pressed={d.date === dayDate} onClick={() => selectDay(d.date)}>
                      <span style={{ width: 44, minWidth: 44, textAlign: 'center', lineHeight: 1.1 }}>
                        <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>{DOW_SHORT[weekday(d.date)]}</span>
                        <span className="serif" style={{ display: 'block', fontSize: 24, fontWeight: 600 }}>{dayOfMonth(d.date)}</span>
                      </span>
                      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 15 }}>{cap(formatLong(d.date).split(',')[0])}</span>
                          {isToday && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sheet)', background: 'var(--accent)', padding: '1px 8px', borderRadius: 999 }}>Hoy</span>}
                        </span>
                        <span className="small ellipsis" style={{ color: text ? 'var(--ink-2)' : 'var(--faint)' }}>
                          {text ? excerpt(text) : isToday ? 'Hoja nueva, aún sin escribir' : 'Sin escribir'}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
            {groups.length === 0 && <p className="empty">No hay notas que coincidan.</p>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {visibleNotes.map((n) => {
              const f = n.folderId ? folderById.get(n.folderId) : undefined;
              return (
                <button
                  key={n.id}
                  type="button"
                  className="item-btn"
                  aria-pressed={n.id === noteId}
                  onClick={() => {
                    void noteSaver.flush();
                    setNoteId(n.id);
                  }}
                  style={{ flexDirection: 'column', gap: 2, padding: '12px 14px' }}
                >
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{n.title || 'Sin título'}</span>
                  <span className="small muted ellipsis" style={{ maxWidth: '100%' }}>{n.content ? excerpt(n.content) : 'Vacía'}</span>
                  <span className="meta" style={{ marginTop: 2 }}>
                    <span>
                      <span className="swatch" style={{ background: f?.color ?? 'var(--disabled)', width: 8, height: 8 }} aria-hidden="true" />
                      {f?.name ?? 'Sin carpeta'}
                    </span>
                    <span>{fmtUpdated(n.updatedAt)}</span>
                  </span>
                </button>
              );
            })}
            {visibleNotes.length === 0 && <p className="empty">No hay notas aquí todavía.</p>}
            {activeFolder && (
              <button type="button" className="btn btn-danger btn-sm" style={{ alignSelf: 'flex-start', border: 0 }} onClick={() => deleteFolder(activeFolder)}>
                Eliminar carpeta “{activeFolder.name}”
              </button>
            )}
          </div>
        )}
      </aside>

      <section className="col-main" aria-label="Editor" style={{ flexBasis: 600 }}>
        <div className="card stack" style={{ padding: '24px 28px 20px' }}>
          {mode === 'diario' ? (
            <>
              <div className="between">
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                  <button type="button" className="icon-btn bordered" aria-label="Nota anterior" disabled={!olderDate} onClick={() => olderDate && selectDay(olderDate)}>
                    <Icon name="left" />
                  </button>
                  <button type="button" className="icon-btn bordered" aria-label="Nota siguiente" disabled={!newerDate} onClick={() => newerDate && selectDay(newerDate)}>
                    <Icon name="right" />
                  </button>
                  <h1 className="serif" style={{ marginLeft: 12, fontSize: 30, fontWeight: 600, lineHeight: 1.15 }}>{cap(formatLong(dayDate))}</h1>
                </div>
                <span className="small muted">{words(currentDayText)}</span>
              </div>
              <label htmlFor="texto-dia" className="sr-only">Nota del día</label>
              <textarea
                id="texto-dia"
                className="paper"
                style={{ minHeight: 576 }}
                placeholder="Hoja en blanco. Escribe lo que quieras sobre tu día…"
                value={currentDayText}
                onChange={(e) => {
                  const content = e.target.value;
                  setDayText((prev) => ({ ...prev, [dayDate]: content }));
                  daySaver.schedule({ date: dayDate, content });
                }}
              />
            </>
          ) : note ? (
            <>
              <div className="between">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <label htmlFor="carpeta-nota" className="small muted">Carpeta</label>
                  <select id="carpeta-nota" className="select" style={{ height: 40 }} value={note.folderId ?? ''} onChange={(e) => moveNote(e.target.value || null)}>
                    <option value="">Sin carpeta</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <span className="small muted">· {fmtUpdated(note.updatedAt)} · {words(note.content)}</span>
                </div>
                <button type="button" className="btn btn-danger btn-sm" onClick={deleteNote}>Eliminar</button>
              </div>
              <label htmlFor="titulo-nota" className="sr-only">Título</label>
              <input
                id="titulo-nota"
                className="title-input"
                style={{ fontSize: 30, borderBottom: 0 }}
                placeholder="Sin título"
                value={note.title}
                onChange={(e) => editNote({ title: e.target.value })}
              />
              <label htmlFor="texto-nota" className="sr-only">Contenido</label>
              <textarea
                id="texto-nota"
                className="paper"
                style={{ minHeight: 576 }}
                placeholder="Empieza a escribir…"
                value={note.content}
                onChange={(e) => editNote({ content: e.target.value })}
              />
            </>
          ) : (
            <div style={{ padding: '80px 24px', textAlign: 'center' }} className="muted">
              <p className="serif" style={{ margin: 0, fontSize: 22, color: 'var(--ink)' }}>Ninguna nota abierta</p>
              <p style={{ margin: '6px 0 0' }}>Elige una de la lista o crea una nueva.</p>
            </div>
          )}
        </div>
      </section>
      {toast.node}
    </main>
  );
}
