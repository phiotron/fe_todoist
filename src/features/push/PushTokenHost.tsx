import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useMe, useSession } from '../auth/session';
import { getPushRegistrar } from './registerPushToken';

/**
 * M13c F6: mounted once in the signed-in layout; renders nothing. Once the user is known and the notification permission
 * is already granted, registers this device's FCM token with the server (once per user and token per app run). Checked
 * again when the app comes back to the foreground (the permission may have been granted meanwhile).
 */
export function PushTokenHost() {
  const { status } = useSession();
  const me = useMe();
  const userId = status === 'signedIn' ? me.data?.id : undefined;

  useEffect(() => {
    if (!userId) return undefined;
    void getPushRegistrar().registerFor(userId);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void getPushRegistrar().registerFor(userId);
    });
    return () => subscription.remove();
  }, [userId]);

  return null;
}
