const listeners = new Set<() => void>();
const afterWriteListeners = new Set<() => void>();

/**
 * Ask the mounted reminder runtime to sync now: notification permission just granted, reminder settings
 * saved, reminders created from Quick Add.
 */
export function requestReminderSync(): void {
  for (const listener of [...listeners]) listener();
}

export function onReminderSyncRequested(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * PERF: mutation `meta` of lib/useDataMutation.ts. The reminder runtime no longer re-plans after such a write by itself:
 * the hook calls requestReminderSyncAfterWrite() only when the write can move a reminder (not a label rename, a
 * description edit...). Any other mutation still re-plans as before.
 */
export const DATA_WRITE_META = { remindersHandled: true } as const;

export function isReminderHandledWrite(meta: Record<string, unknown> | undefined): boolean {
  return meta?.remindersHandled === true;
}

/** A write that can move a reminder succeeded: re-plan after the usual write debounce (bursts collapse into one run). */
export function requestReminderSyncAfterWrite(): void {
  for (const listener of [...afterWriteListeners]) listener();
}

export function onReminderSyncAfterWrite(listener: () => void): () => void {
  afterWriteListeners.add(listener);
  return () => {
    afterWriteListeners.delete(listener);
  };
}
