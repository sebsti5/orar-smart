import { useEffect, useRef } from 'react';

/** setInterval that always calls the latest callback; null delay = paused. */
export function useInterval(cb: () => void, delay: number | null): void {
  const saved = useRef(cb);
  saved.current = cb;
  useEffect(() => {
    if (delay === null) return undefined;
    const id = window.setInterval(() => saved.current(), delay);
    return () => window.clearInterval(id);
  }, [delay]);
}
