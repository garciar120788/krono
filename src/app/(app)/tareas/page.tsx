import type { Metadata } from 'next';
import { TasksView } from '@/components/TasksView';

export const metadata: Metadata = { title: 'Tareas' };

export default function TareasPage() {
  return <TasksView />;
}
