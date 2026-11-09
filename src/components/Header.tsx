'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from './Icon';

const LINKS = [
  { href: '/', label: 'Hoy' },
  { href: '/tareas', label: 'Tareas' },
  { href: '/notas', label: 'Notas' },
  { href: '/habitos', label: 'Hábitos' },
  { href: '/calendario', label: 'Calendario' },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState('');

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header className="app-header">
      <div className="header-inner">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden="true">K</span>
          <span className="brand-name">Krono</span>
        </Link>

        <nav className="nav" aria-label="Secciones">
          <ul>
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} aria-current={isActive(l.href) ? 'page' : undefined}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="header-tools">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) router.push(`/buscar?q=${encodeURIComponent(q.trim())}`);
            }}
          >
            <label htmlFor="buscar-global" className="sr-only">Buscar</label>
            <div className="search-box">
              <Icon name="search" stroke={1.8} />
              <input
                id="buscar-global"
                type="search"
                placeholder="Buscar en Krono"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </form>
          <Link href="/ajustes" className="icon-btn bordered" aria-label="Ajustes" aria-current={pathname === '/ajustes' ? 'page' : undefined}>
            <Icon name="settings" size={20} stroke={1.8} />
          </Link>
        </div>
      </div>
    </header>
  );
}
