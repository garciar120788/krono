import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AuthForm } from '@/components/AuthForm';
import { getCurrentUser, registrationEnabled } from '@/lib/auth';

export const metadata: Metadata = { title: 'Iniciar sesión' };
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/');
  return (
    <Suspense>
      <AuthForm mode="login" allowRegistration={registrationEnabled()} />
    </Suspense>
  );
}
