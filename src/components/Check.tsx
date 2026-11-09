'use client';

import { Icon } from './Icon';

/** Casilla para marcar tareas y subtareas (botón accesible con aria-pressed). */
export function Check({
  checked,
  onToggle,
  label,
  small,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  small?: boolean;
}) {
  return (
    <button type="button" className={`check${small ? ' sm' : ''}`} aria-pressed={checked} aria-label={label} onClick={onToggle}>
      <span className="box">{checked && <Icon name="check" size={small ? 12 : 14} stroke={3.2} />}</span>
    </button>
  );
}
