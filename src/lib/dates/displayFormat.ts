import { useSyncExternalStore } from 'react';

export type DateFormat = 'DMY' | 'MDY';
export type TimeFormat = 'H24' | 'H12';

/** How dates and times are written on screen (account settings dateFormat / timeFormat, spec 12.1.1). */
export interface DisplayPrefs {
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
}

export const DEFAULT_DISPLAY_PREFS: DisplayPrefs = { dateFormat: 'DMY', timeFormat: 'H24' };

// A tiny store: M1's pure formatting functions read the current preference through it, so their signatures do not
// change; SettingsProvider writes it (Task 32) and components that show dates subscribe with useDisplayPrefs().
let current: DisplayPrefs = DEFAULT_DISPLAY_PREFS;
const listeners = new Set<() => void>();

export function getDisplayPrefs(): DisplayPrefs {
  return current;
}

export function setDisplayPrefs(next: DisplayPrefs): void {
  if (next.dateFormat === current.dateFormat && next.timeFormat === current.timeFormat) return;
  current = { dateFormat: next.dateFormat, timeFormat: next.timeFormat };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Subscribes the component, so it re-renders when the user changes the date / time format. */
export function useDisplayPrefs(): DisplayPrefs {
  return useSyncExternalStore(subscribe, getDisplayPrefs, getDisplayPrefs);
}

/** "05/03/2026" (DMY) or "03/05/2026" (MDY) from "yyyy-MM-dd"; without the year: "05/03" / "03/05". */
export function formatDate(dateKey: string, withYear: boolean, format: DateFormat = current.dateFormat): string {
  const [year, month, day] = dateKey.split('-');
  const dayMonth = format === 'DMY' ? `${day}/${month}` : `${month}/${day}`;
  return withYear ? `${dayMonth}/${year}` : dayMonth;
}

/** "14:30" (H24) or "2:30 PM" (H12) from "HH:mm" or "HH:mm:ss". */
export function formatTime(time: string, format: TimeFormat = current.timeFormat): string {
  const [hours, minutes] = time.split(':').map(Number);
  const mm = String(minutes).padStart(2, '0');
  if (format === 'H24') return `${String(hours).padStart(2, '0')}:${mm}`;
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${mm} ${hours < 12 ? 'AM' : 'PM'}`;
}
