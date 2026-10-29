import { useRef } from 'react';
import { dateKeyInZone } from './dates';

/**
 * PERF4: `useNow` ticks every minute, but a comment / notification stamp only cares which DAY it is ("HH:mm" today,
 * "dd/MM HH:mm" otherwise). This returns the SAME Date object until the day (in `timeZone`) changes, so memoised rows
 * that receive it do not re-render on every tick.
 */
export function useDayStableNow(now: Date, timeZone: string): Date {
  const key = dateKeyInZone(now, timeZone);
  const kept = useRef({ key, now });
  if (kept.current.key !== key) kept.current = { key, now };
  return kept.current.now;
}
