import { redirect } from 'next/navigation';
import { Header } from '@/components/Header';
import { getCurrentUser } from '@/lib/auth';

// Todas las páginas internas requieren sesión.
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Si la cookie no es válida (o el usuario ya no existe) la borramos y vamos al login.
  if (!user) redirect('/api/auth/logout');

  return (
    <>
      <Header />
      {children}
    </>
  );
}
