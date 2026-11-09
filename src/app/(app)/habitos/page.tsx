import type { Metadata } from 'next';
import { HabitsView } from '@/components/HabitsView';

export const metadata: Metadata = { title: 'Hábitos' };

export default function HabitosPage() {
  return <HabitsView />;
}
