'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { todayISO } from './dates';

/**
 * Guarda automáticamente un valor después de una pausa al escribir.
 * Devuelve el estado de guardado para mostrarlo si se quiere.
 */
export function useDebouncedSave<T>(save: (value: T) => Promise<unknown>, delay = 700) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ value: T } | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;
  const [saving, setSaving] = useState(false);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    pending.current = null;
    if (!p) return;
    setSaving(true);
    try {
      await saveRef.current(p.value);
    } finally {
      setSaving(false);
    }
  }, []);

  const schedule = useCallback(
    (value: T) => {
      pending.current = { value };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delay);
    },
    [delay, flush],
  );

  // Al salir de la página o desmontar, guarda lo pendiente.
  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener('beforeunload', onHide);
    return () => {
      window.removeEventListener('beforeunload', onHide);
      void flush();
    };
  }, [flush]);

  return { schedule, flush, saving };
}

/** Fecha de hoy que se actualiza sola al pasar la medianoche. */
export function useToday(): string {
  const [today, setToday] = useState(() => todayISO());
  useEffect(() => {
    const id = setInterval(() => {
      const t = todayISO();
      setToday((prev) => (prev === t ? prev : t));
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  return today;
}
