import type { GeofencePlan } from './geofencePlan';

export type GeofencePermission = 'granted' | 'foregroundOnly' | 'denied';

/**
 * Everything location reminders need from the OS (expo-location geofencing + expo-task-manager). The app talks only to
 * this port; the Expo implementation is installed at startup (installGeofencePlatform). Until then — Expo Go, tests —
 * the unavailable platform keeps the rest of the feature working without native code.
 */
export interface GeofencePlatform {
  /** Current permission without asking. */
  getPermission(): Promise<GeofencePermission>;
  /** Shows the system prompts (foreground, then background). */
  requestPermission(): Promise<GeofencePermission>;
  /** Replaces the registered regions and the data the handler reads; an empty plan stops geofencing. */
  apply(plan: GeofencePlan): Promise<void>;
  /** Sign-out / reminders off. Never throws. */
  stop(): Promise<void>;
  /** Current position, for "use my current location". null when unavailable or not allowed. */
  getCurrentPosition(): Promise<{ latitude: number; longitude: number } | null>;
}

export const unavailableGeofencePlatform: GeofencePlatform = {
  getPermission: async () => 'denied',
  requestPermission: async () => 'denied',
  apply: async () => undefined,
  stop: async () => undefined,
  getCurrentPosition: async () => null,
};

let current: GeofencePlatform = unavailableGeofencePlatform;

export function getGeofencePlatform(): GeofencePlatform {
  return current;
}

/** Install the real implementation (startup) or a fake (tests). null restores the unavailable platform. */
export function setGeofencePlatform(platform: GeofencePlatform | null): void {
  current = platform ?? unavailableGeofencePlatform;
}
