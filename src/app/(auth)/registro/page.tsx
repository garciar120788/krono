import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AuthForm } from '@/components/AuthForm';
import { getCurrentUser, registrationEnabled } from '@/lib/auth';

export const metadata: Metadata = { title: 'Crear cuenta' };
export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect('/');

  if (!registrationEnabled()) {
    return (
      <main className="auth-wrap">
        <div className="card auth-card">
          <h1 className="page-title" style={{ fontSize: 28 }}>Registro desactivado</h1>
          <p className="muted" style={{ margin: 0 }}>
            El administrador de este Krono desactivó la creación de cuentas nuevas.
          </p>
          <Link href="/login" className="btn btn-primary">Ir a iniciar sesión</Link>
        </div>
      </main>
    );
  }

  return (
    <Suspense>
      <AuthForm mode="register" allowRegistration />
    </Suspense>
  );
}
