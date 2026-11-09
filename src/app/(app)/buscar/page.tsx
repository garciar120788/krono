import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SearchView } from '@/components/SearchView';

export const metadata: Metadata = { title: 'Buscar' };

export default function BuscarPage() {
  return (
    <Suspense>
      <SearchView />
    </Suspense>
  );
}
