import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SettingsView } from '@/components/SettingsView';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Ajustes' };

export default async function AjustesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <SettingsView user={{ name: user.name, email: user.email }} />;
}
