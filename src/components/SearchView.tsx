'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { cap, formatLong } from '@/lib/dates';

interface Results {
  tasks: { id: string; title: string; status: string }[];
  notes: { id: string; title: string; content: string }[];
  dailyNotes: { date: string; content: string }[];
  events: { id: string; title: string; startDate: string; startTime: string | null }[];
}

const snippet = (text: string, q: string) => {
  const flat = text.replace(/\s+/g, ' ');
  const i = flat.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return flat.slice(0, 120);
  const start = Math.max(0, i - 40);
  return (start > 0 ? '…' : '') + flat.slice(start, i + q.length + 80) + '…';
};

export function SearchView() {
  const q = useSearchParams().get('q')?.trim() ?? '';
  const [r, setR] = useState<Results | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setR(null);
    if (q.length < 2) return;
    api<Results>(`/api/search?q=${encodeURIComponent(q)}`)
      .then(setR)
      .catch((e) => setError((e as Error).message));
  }, [q]);

  const total = r ? r.tasks.length + r.notes.length + r.dailyNotes.length + r.events.length : 0;

  const Section = ({ title, children, count }: { title: string; children: React.ReactNode; count: number }) =>
    count ? (
      <section className="card stack" style={{ gap: 8 }}>
        <h2 className="eyebrow">{title}</h2>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</ul>
      </section>
    ) : null;

  const itemStyle = { display: 'block', padding: '10px 12px', borderRadius: 10, textDecoration: 'none', color: 'var(--ink)', background: 'var(--sheet-2)' } as const;

  return (
    <main className="page stack" style={{ maxWidth: 820, gap: 20 }}>
      <div>
        <h1 className="page-title">Buscar</h1>
        <p className="page-sub">
          {q.length < 2 ? 'Escribe al menos 2 letras en el buscador.' : r ? `${total} resultados para “${q}”` : 'Buscando…'}
        </p>
      </div>
      {error && <div className="alert">{error}</div>}
      {r && total === 0 && <p className="empty">No encontramos nada con “{q}”.</p>}
      {r && (
        <>
          <Section title="Tareas" count={r.tasks.length}>
            {r.tasks.map((t) => (
              <li key={t.id}>
                <Link href="/tareas" style={itemStyle} className={t.status === 'done' ? 'done-text' : undefined}>{t.title}</Link>
              </li>
            ))}
          </Section>
          <Section title="Notas" count={r.notes.length}>
            {r.notes.map((n) => (
              <li key={n.id}>
                <Link href={`/notas?nota=${n.id}`} style={itemStyle}>
                  <strong>{n.title || 'Sin título'}</strong>
                  <span className="small muted" style={{ display: 'block' }}>{snippet(n.content, q)}</span>
                </Link>
              </li>
            ))}
          </Section>
          <Section title="Diario" count={r.dailyNotes.length}>
            {r.dailyNotes.map((n) => (
              <li key={n.date}>
                <Link href={`/notas?fecha=${n.date}`} style={itemStyle}>
                  <strong>{cap(formatLong(n.date, true))}</strong>
                  <span className="small muted" style={{ display: 'block' }}>{snippet(n.content, q)}</span>
                </Link>
              </li>
            ))}
          </Section>
          <Section title="Eventos" count={r.events.length}>
            {r.events.map((e) => (
              <li key={e.id}>
                <Link href={`/calendario?fecha=${e.startDate}&evento=${e.id}`} style={itemStyle}>
                  <strong>{e.title || 'Sin título'}</strong>
                  <span className="small muted" style={{ display: 'block' }}>
                    {cap(formatLong(e.startDate, true))}
                    {e.startTime ? ` · ${e.startTime}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </Section>
        </>
      )}
    </main>
  );
}
