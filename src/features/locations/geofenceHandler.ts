import { shouldNotify, type GeofenceEventType, type GeofenceMeta } from './geofencePlan';

export interface LocationNotification {
  /** Same id for the same reminder, so a repeated event replaces instead of stacking. */
  id: string;
  taskId: string;
  title: string;
  /** Already translated: "You arrived at X" / "You left X". */
  body: string;
}

export interface GeofenceHandlerDeps {
  loadMeta: () => Promise<Record<string, GeofenceMeta>>;
  notify: (notification: LocationNotification) => Promise<void>;
  /** Translate with the language the app is using. */
  text: (key: 'reminders.location.notificationEnter' | 'reminders.location.notificationLeave', place: string) => string;
}

/**
 * A geofence fired (possibly while the app is closed): notify when the direction matches what the reminder asked for.
 * Returns true when a notification was shown. Never throws (a background task must not crash).
 */
export async function handleGeofenceEvent(
  eventType: GeofenceEventType,
  regionIdentifier: string,
  deps: GeofenceHandlerDeps,
): Promise<boolean> {
  try {
    const meta = (await deps.loadMeta())[regionIdentifier];
    if (!shouldNotify(meta, eventType)) return false;
    await deps.notify({
      id: `location:${meta.reminderId}`,
      taskId: meta.taskId,
      title: meta.title,
      body: deps.text(
        eventType === 'enter' ? 'reminders.location.notificationEnter' : 'reminders.location.notificationLeave',
        meta.placeName,
      ),
    });
    return true;
  } catch {
    return false;
  }
}
