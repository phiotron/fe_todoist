import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { pushTokensApi } from '../../api/pushTokens';
import { getReminderPlatform } from '../reminders/platform';
import { createPushRegistrar, type PushRegistrar, type PushRegistrarDeps } from './pushRegistrar';

/**
 * FCM registration token of this device (Android only; null elsewhere). Without google-services.json (Firebase not
 * configured) expo-notifications throws: the registrar logs it and skips.
 */
export async function readDevicePushToken(os: string = Platform.OS): Promise<string | null> {
  if (os !== 'android') return null;
  const token = await Notifications.getDevicePushTokenAsync();
  return typeof token.data === 'string' && token.data.length > 0 ? token.data : null;
}

const appDeps: PushRegistrarDeps = {
  // The reminder platform port (installed at startup) already reads the notification permission.
  isPermissionGranted: async () => (await getReminderPlatform().getPermission()).granted,
  getDeviceToken: () => readDevicePushToken(),
  register: (token) => pushTokensApi.register({ token, platform: 'ANDROID' }),
  unregister: (token) => pushTokensApi.unregister({ token }),
  log: (message) => console.warn(message),
};

/** The app's registrar; tests override the OS parts (permission, device token, log). */
export function createAppPushRegistrar(overrides: Partial<PushRegistrarDeps> = {}): PushRegistrar {
  return createPushRegistrar({ ...appDeps, ...overrides });
}

let current: PushRegistrar = createAppPushRegistrar();

export function getPushRegistrar(): PushRegistrar {
  return current;
}

/** Tests: install a registrar with fake OS parts; null restores the app's one (state of the old one is dropped). */
export function setPushRegistrar(registrar: PushRegistrar | null): void {
  current = registrar ?? createAppPushRegistrar();
}

/** Sign-out (M13c F6): tell the server to stop pushing to this device. Best effort, never throws, no need to wait. */
export function unregisterPushTokenOnSignOut(): Promise<void> {
  return current.unregisterCurrent();
}
