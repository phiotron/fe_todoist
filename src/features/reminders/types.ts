/** Kinds of notifications the app schedules: server occurrences (spec 12.8) plus local snoozes. */
export type ScheduledKind = 'AUTO' | 'ABSOLUTE' | 'RELATIVE' | 'SNOOZE';

/** One notification the app wants on the device. `id` is the schedule identifier (occurrence key, spec 5.8). */
export interface DesiredReminder {
  id: string;
  taskId: string;
  kind: ScheduledKind;
  fireAtMs: number;
  title: string;
  body: string;
  /** M12 Pin reminders: the notification stays in the tray until tapped (Android `sticky`). */
  pinned?: boolean;
  /** M12 urgent reminder on the chosen device: full-screen alarm (native) or the urgent channel. */
  urgent?: boolean;
}

/** A desired reminder plus the fingerprint stored in the notification data to detect changes. */
export interface ReminderRequest extends DesiredReminder {
  signature: string;
}

/** What is scheduled on the device now. Null fields = unknown origin (always rescheduled or cancelled). */
export interface ScheduledReminder {
  id: string;
  taskId: string | null;
  kind: ScheduledKind | null;
  signature: string | null;
}

/** Thin port over expo-notifications so the sync logic is testable without native code. */
export interface ReminderScheduler {
  listScheduled(): Promise<ScheduledReminder[]>;
  /** Replaces any notification already scheduled with the same id. */
  schedule(request: ReminderRequest): Promise<void>;
  cancel(id: string): Promise<void>;
  cancelAll(): Promise<void>;
}

export interface ReminderPermission {
  status: 'granted' | 'denied' | 'undetermined';
  granted: boolean;
  /** false = the system will not show the prompt again; the user must open the system settings. */
  canAskAgain: boolean;
}
