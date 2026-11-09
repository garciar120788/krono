'use client';

import { useCallback, useEffect, useState } from 'react';

/** Mensaje breve en la parte inferior (para errores o confirmaciones). */
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3500);
    return () => clearTimeout(t);
  }, [msg]);

  const show = useCallback((m: string) => setMsg(m), []);
  const fail = useCallback((err: unknown) => setMsg((err as Error)?.message || 'Algo salió mal'), []);

  const node = msg ? (
    <div className="toast" role="status" aria-live="polite">
      {msg}
    </div>
  ) : null;

  return { node, show, fail };
}
