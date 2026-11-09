import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="auth-wrap">
      <div className="card auth-card" style={{ textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-hand)', fontSize: 32, color: 'var(--accent)', margin: 0 }}>Página en blanco</p>
        <h1 className="page-title" style={{ fontSize: 28 }}>No encontramos esta página</h1>
        <Link href="/" className="btn btn-primary">Volver a Hoy</Link>
      </div>
    </main>
  );
}
