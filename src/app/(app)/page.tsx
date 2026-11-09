import type { Metadata } from 'next';
import { Dashboard } from '@/components/Dashboard';

export const metadata: Metadata = { title: 'Hoy' };

export default function HoyPage() {
  return <Dashboard />;
}
