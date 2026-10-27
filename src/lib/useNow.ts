import { useEffect, useState } from 'react';

/** Current time, refreshed every `intervalMs`, so "overdue" and "today" labels change while a screen is open. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
