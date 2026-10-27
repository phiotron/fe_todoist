import { useSyncExternalStore } from 'react';

/** The day selected in the Upcoming week strip (yyyy-MM-dd), read by the + button to add tasks to that day. */
let selectedDay: string | undefined;
const listeners = new Set<() => void>();

export function getUpcomingDay(): string | undefined {
  return selectedDay;
}

export function setUpcomingDay(day: string | undefined): void {
  if (day === selectedDay) return;
  selectedDay = day;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useUpcomingDay(): string | undefined {
  return useSyncExternalStore(subscribe, getUpcomingDay, getUpcomingDay);
}
