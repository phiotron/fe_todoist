import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import i18n from '../../i18n';
import { handleGeofenceEvent } from './geofenceHandler';
import type { GeofencePlan } from './geofencePlan';
import { setGeofencePlatform, type GeofencePermission, type GeofencePlatform } from './geofencePlatform';
import { clearGeofenceMeta, loadGeofenceMeta, saveGeofenceMeta } from './geofenceStore';

export const GEOFENCE_TASK_NAME = 'taskly-location-reminders';
export const LOCATION_CHANNEL_ID = 'location-reminders';

async function showLocationNotification(notification: { id: string; taskId: string; title: string; body: string }) {
  await Notifications.setNotificationChannelAsync(LOCATION_CHANNEL_ID, {
    name: i18n.t('reminders.location.channelName'),
    importance: Notifications.AndroidImportance.HIGH,
  });
  await Notifications.scheduleNotificationAsync({
    identifier: notification.id,
    content: { title: notification.title, body: notification.body, data: { taskId: notification.taskId } },
    trigger: { channelId: LOCATION_CHANNEL_ID },
  });
}

// Must be defined when the JS bundle loads, also when Android wakes the app only for a geofence event.
TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error || !data) return;
  const { eventType, region } = data as { eventType: Location.GeofencingEventType; region: { identifier?: string } };
  if (!region.identifier) return;
  await handleGeofenceEvent(eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit', region.identifier, {
    loadMeta: loadGeofenceMeta,
    notify: showLocationNotification,
    text: (key, place) => i18n.t(key, { place }),
  });
});

async function readPermission(): Promise<GeofencePermission> {
  const foreground = await Location.getForegroundPermissionsAsync();
  if (!foreground.granted) return 'denied';
  const background = await Location.getBackgroundPermissionsAsync();
  return background.granted ? 'granted' : 'foregroundOnly';
}

export const expoGeofencePlatform: GeofencePlatform = {
  getPermission: readPermission,

  async requestPermission() {
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (!foreground.granted) return 'denied';
    const background = await Location.requestBackgroundPermissionsAsync();
    return background.granted ? 'granted' : 'foregroundOnly';
  },

  async apply(plan: GeofencePlan) {
    if (plan.regions.length === 0) {
      await expoGeofencePlatform.stop();
      return;
    }
    await saveGeofenceMeta(plan.meta);
    await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, plan.regions);
  },

  async stop() {
    try {
      if (await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME)) {
        await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
      }
      await clearGeofenceMeta();
    } catch {
      // nothing was running
    }
  },

  async getCurrentPosition() {
    try {
      const foreground = await Location.getForegroundPermissionsAsync();
      if (!foreground.granted) return null;
      const { coords } = await Location.getCurrentPositionAsync({});
      return { latitude: coords.latitude, longitude: coords.longitude };
    } catch {
      return null;
    }
  },
};

let installed = false;

/** Startup, once: location reminders use expo-location. Calling it again does nothing. */
export function installGeofencePlatform(): void {
  if (installed) return;
  installed = true;
  setGeofencePlatform(expoGeofencePlatform);
}

/** Test only. */
export function resetGeofenceInstall(): void {
  installed = false;
}
