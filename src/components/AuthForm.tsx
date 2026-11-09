'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/client';

export function AuthForm({ mode, allowRegistration }: { mode: 'login' | 'register'; allowRegistration: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isLogin = mode === 'login';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isLogin) await api('/api/auth/login', { method: 'POST', body: { email, password } });
      else await api('/api/auth/register', { method: 'POST', body: { name, email, password } });
      const next = params.get('next');
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="auth-wrap">
      <form className="card auth-card" onSubmit={submit} noValidate>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="brand-mark" aria-hidden="true">K</span>
          <span className="brand-name">Krono</span>
        </div>
        <div>
          <h1 className="page-title" style={{ fontSize: 30 }}>{isLogin ? 'Inicia sesión' : 'Crea tu cuenta'}</h1>
          <p className="page-sub">{isLogin ? 'Tu organizador personal te espera.' : 'Tareas, notas, hábitos y calendario en un solo lugar.'}</p>
        </div>

        {error && <div className="alert" role="alert">{error}</div>}

        {!isLogin && (
          <div className="field">
            <label className="label" htmlFor="name">Nombre</label>
            <input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
        )}
        <div className="field">
          <label className="label" htmlFor="email">Correo</label>
          <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label className="label" htmlFor="password">Contraseña</label>
          <input
            id="password"
            className="input"
            type="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            minLength={isLogin ? undefined : 8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {!isLogin && <span className="xsmall muted">Mínimo 8 caracteres.</span>}
        </div>

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Un momento…' : isLogin ? 'Entrar' : 'Crear cuenta'}
        </button>

        {isLogin && allowRegistration && (
          <p className="small muted" style={{ margin: 0, textAlign: 'center' }}>
            ¿No tienes cuenta? <Link href="/registro">Regístrate</Link>
          </p>
        )}
        {!isLogin && (
          <p className="small muted" style={{ margin: 0, textAlign: 'center' }}>
            ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
          </p>
        )}
      </form>
    </main>
  );
}
