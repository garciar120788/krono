/** Íconos de trazo (SVG en línea, heredan el color del texto). */

type Name =
  | 'search' | 'settings' | 'plus' | 'check' | 'left' | 'right' | 'close' | 'trash'
  | 'flag' | 'subtasks' | 'note' | 'eye' | 'logout';

const PATHS: Record<Name, React.ReactNode> = {
  search: (<><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></>),
  settings: (<><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="17" x2="20" y2="17" /><circle cx="9" cy="7" r="2.4" fill="var(--sheet)" /><circle cx="15" cy="17" r="2.4" fill="var(--sheet)" /></>),
  plus: (<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>),
  check: <polyline points="5 12.5 10 17 19 7" />,
  left: <polyline points="15 5 8 12 15 19" />,
  right: <polyline points="9 5 16 12 9 19" />,
  close: (<><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>),
  trash: (<><polyline points="4 7 20 7" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></>),
  flag: <path d="M5 21V4h11l-2 4 2 4H5" />,
  subtasks: (<><polyline points="4 6 6 8 9 4" /><line x1="12" y1="6" x2="20" y2="6" /><polyline points="4 15 6 17 9 13" /><line x1="12" y1="15" x2="20" y2="15" /></>),
  note: (<><path d="M6 3h9l4 4v14H6z" /><line x1="9" y1="12" x2="16" y2="12" /><line x1="9" y1="16" x2="14" y2="16" /></>),
  eye: (<><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>),
  logout: (<><path d="M15 4h4v16h-4" /><polyline points="10 8 6 12 10 16" /><line x1="6" y1="12" x2="15" y2="12" /></>),
};

export function Icon({ name, size = 18, stroke = 2 }: { name: Name; size?: number; stroke?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
