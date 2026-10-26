const listeners = new Set<() => void>();

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
