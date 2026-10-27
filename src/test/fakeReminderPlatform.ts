import type { ReminderActionLabels, ReminderPlatform, ReminderTap } from '../features/reminders/platform';
import type { ReminderPermission } from '../features/reminders/types';
import { FakeReminderScheduler } from './fakeReminderScheduler';

export function fakePermission(
  status: ReminderPermission['status'],
  canAskAgain = status !== 'denied',
): ReminderPermission {
  return { status, granted: status === 'granted', canAskAgain };
}

/** In-memory ReminderPlatform for tests: records calls, lets a test choose the permission and push taps. */
export class FakeReminderPlatform implements ReminderPlatform {
  readonly scheduler = new FakeReminderScheduler();
  permission: ReminderPermission = fakePermission('granted');
  /** What requestPermission() answers (and then becomes the current permission). */
  permissionAfterRequest: ReminderPermission = fakePermission('granted');
  exactAlarmNeeded = false;
  channels: string[] = [];
  actionLabels: ReminderActionLabels[] = [];
  presentationConfigured = 0;
  requestCalls = 0;
  exactAlarmOpened = 0;
  dismissed: string[] = [];
  cancelAllCalls = 0;
  launchTap: ReminderTap | null = null;
  private readonly listeners = new Set<(tap: ReminderTap) => void>();

  async ensureChannel(name: string): Promise<void> {
    this.channels.push(name);
  }

  async configureActions(labels: ReminderActionLabels): Promise<void> {
    this.actionLabels.push(labels);
  }

  configurePresentation(): void {
    this.presentationConfigured += 1;
  }

  async getPermission(): Promise<ReminderPermission> {
    return this.permission;
  }

  async requestPermission(): Promise<ReminderPermission> {
    this.requestCalls += 1;
    this.permission = this.permissionAfterRequest;
    return this.permission;
  }

  needsExactAlarmGrant(): boolean {
    return this.exactAlarmNeeded;
  }

  async openExactAlarmSettings(): Promise<void> {
    this.exactAlarmOpened += 1;
  }

  takeLastTap(): ReminderTap | null {
    const tap = this.launchTap;
    this.launchTap = null;
    return tap;
  }

  addTapListener(onTap: (tap: ReminderTap) => void): () => void {
    this.listeners.add(onTap);
    return () => {
      this.listeners.delete(onTap);
    };
  }

  /** Simulates the user pressing the notification or one of its buttons while the app runs. */
  tap(tap: ReminderTap): void {
    for (const listener of [...this.listeners]) listener(tap);
  }

  async dismiss(notificationId: string): Promise<void> {
    this.dismissed.push(notificationId);
  }

  async cancelAll(): Promise<void> {
    this.cancelAllCalls += 1;
    await this.scheduler.cancelAll();
  }
}
