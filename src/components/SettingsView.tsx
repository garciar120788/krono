'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from './Icon';
import { api } from '@/lib/client';

export function SettingsView({ user }: { user: { name: string; email: string } }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [deletePw, setDeletePw] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api('/api/auth/me', {
        method: 'PATCH',
        body: { name, ...(next ? { currentPassword: current, newPassword: next } : {}) },
      });
      setCurrent('');
      setNext('');
      setMsg({ ok: true, text: 'Cambios guardados.' });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
    router.refresh();
  }

  async function deleteAccount() {
    if (!window.confirm('Se borrarán tu cuenta y TODOS tus datos. Esta acción no se puede deshacer. ¿Continuar?')) return;
    try {
      await api('/api/auth/me', { method: 'DELETE', body: { password: deletePw } });
      router.replace('/registro');
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  }

  return (
    <main className="page stack" style={{ maxWidth: 640, gap: 24 }}>
      <div>
        <h1 className="page-title">Ajustes</h1>
        <p className="page-sub">{user.email}</p>
      </div>

      {msg && <div className={msg.ok ? 'ok' : 'alert'} role="status">{msg.text}</div>}

      <form className="card stack" onSubmit={save}>
        <h2 className="card-title">Tu cuenta</h2>
        <div className="field">
          <label className="label" htmlFor="aj-nombre">Nombre</label>
          <input id="aj-nombre" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="field">
          <label className="label" htmlFor="aj-actual">Contraseña actual</label>
          <input id="aj-actual" className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="aj-nueva">Nueva contraseña</label>
          <input id="aj-nueva" className="input" type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
          <span className="xsmall muted">Déjala vacía si no quieres cambiarla.</span>
        </div>
        <button className="btn btn-primary" type="submit" style={{ alignSelf: 'flex-start' }}>Guardar cambios</button>
      </form>

      <div className="card between">
        <div>
          <h2 className="card-title" style={{ fontSize: 20 }}>Cerrar sesión</h2>
          <p className="small muted" style={{ margin: '4px 0 0' }}>Sal de Krono en este navegador.</p>
        </div>
        <button type="button" className="btn" onClick={logout}>
          <Icon name="logout" />
          Cerrar sesión
        </button>
      </div>

      <div className="card stack">
        <h2 className="card-title" style={{ fontSize: 20, color: 'var(--danger)' }}>Eliminar cuenta</h2>
        <p className="small muted" style={{ margin: 0 }}>Borra tu cuenta con todas tus tareas, notas, hábitos y eventos.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label htmlFor="aj-borrar" className="sr-only">Contraseña para confirmar</label>
          <input id="aj-borrar" className="input" type="password" placeholder="Tu contraseña" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} style={{ flex: '1 1 200px' }} />
          <button type="button" className="btn btn-danger" disabled={!deletePw} onClick={deleteAccount}>Eliminar mi cuenta</button>
        </div>
      </div>
    </main>
  );
}
