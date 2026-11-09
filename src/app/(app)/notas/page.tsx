import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NotesView } from '@/components/NotesView';

export const metadata: Metadata = { title: 'Notas' };

export default function NotasPage() {
  return (
    <Suspense>
      <NotesView />
    </Suspense>
  );
}
