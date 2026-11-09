import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CalendarView } from '@/components/CalendarView';

export const metadata: Metadata = { title: 'Calendario' };

export default function CalendarioPage() {
  return (
    <Suspense>
      <CalendarView />
    </Suspense>
  );
}
