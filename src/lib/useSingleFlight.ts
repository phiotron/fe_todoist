import { useCallback, useRef, useState } from 'react';

/**
 * Runs one async task at a time: calls made while one is running are ignored. The ref blocks a double press
 * synchronously; `busy` is for the UI (state updates one render too late to guard on its own).
 */
export function useSingleFlight() {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T>(task: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    try {
      return await task();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);
  return { run, busy };
}
