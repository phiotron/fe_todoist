import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

/**
 * M12 — JS side of the local Expo module `TasklyAndroid` (modules/taskly-android, Kotlin). The module exists only in a
 * development build made after M12 (`npx expo prebuild` + `expo run:android`); in Expo Go, on iOS and in Jest it is
 * missing, so every helper below degrades to "not available" instead of throwing.
 */

/** Material You accent colours of the system (Android 12+), as #RRGGBB. */
export interface SystemAccentColors {
  /** system_accent1_600 (light theme accent). */
  accentLight: string;
  /** system_accent1_700 (pressed / darker accent). */
  accentLightStrong: string;
  /** system_accent1_100 (soft background tint). */
  accentLightSoft: string;
  /** system_accent1_200 (dark theme accent). */
  accentDark: string;
  /** system_accent1_100 (dark theme pressed). */
  accentDarkStrong: string;
  /** system_accent1_800 (dark theme soft tint). */
  accentDarkSoft: string;
}

export interface UrgentAlarmRequest {
  id: string;
  taskId: string;
  fireAtMs: number;
  title: string;
  body: string;
  signature: string;
}

export interface ScheduledUrgentAlarm {
  id: string;
  taskId: string;
  signature: string;
}

export interface TasklyAndroidModule {
  getDynamicColors(): SystemAccentColors | null;
  /** Android 14+: whether the user allows full-screen notifications for Taskly (always true below 14). */
  canUseFullScreenIntent(): boolean;
  openFullScreenIntentSettings(): Promise<void>;
  /** Name of the enabled launcher alias ("default" when only the main one is on). */
  getAppIcon(): string;
  setAppIcon(name: string): Promise<void>;
  playCompletionTone(): void;
  scheduleUrgentAlarm(request: UrgentAlarmRequest): Promise<void>;
  cancelUrgentAlarm(id: string): Promise<void>;
  listUrgentAlarms(): Promise<ScheduledUrgentAlarm[]>;
  /** Stops the ringing alarm of a task (the full-screen notification). */
  stopUrgentAlarm(taskId: string): void;
  /** Text of the share intent that started / resumed the app, consumed once. */
  takeSharedText(): string | null;
  addListener(event: 'onSharedText', listener: (event: { text: string }) => void): { remove(): void };
}

let override: TasklyAndroidModule | null | undefined;

/** null when the native module is not in this build. */
export function getTasklyAndroid(): TasklyAndroidModule | null {
  if (override !== undefined) return override;
  if (Platform.OS !== 'android') return null;
  return requireOptionalNativeModule<TasklyAndroidModule>('TasklyAndroid');
}

/** Tests only: install a fake (or null = missing); undefined restores the real lookup. */
export function setTasklyAndroidForTests(module: TasklyAndroidModule | null | undefined): void {
  override = module;
}

/** Android 12 (API 31) introduced the system accent palette used by Dynamic Color. */
export function supportsDynamicColor(os: string = Platform.OS, version: string | number = Platform.Version): boolean {
  return os === 'android' && Number(version) >= 31 && getTasklyAndroid() !== null;
}

/** Never throws: the sound is a nicety. */
export function playCompletionTone(): void {
  try {
    getTasklyAndroid()?.playCompletionTone();
  } catch {
    // no sound
  }
}
