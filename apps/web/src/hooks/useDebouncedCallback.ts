import { useCallback, useEffect, useRef } from "react";

/**
 * Debounces `fn`. Pending calls run on `flush()` and when the component unmounts,
 * so closing the panel never loses an edit.
 */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delay: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<A | null>(null);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const args = pending.current;
    pending.current = null;
    if (args) fnRef.current(...args);
  }, []);

  const call = useCallback(
    (...args: A) => {
      pending.current = args;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [delay, flush],
  );

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
  }, []);

  useEffect(() => flush, [flush]);

  return { call, flush, cancel };
}
