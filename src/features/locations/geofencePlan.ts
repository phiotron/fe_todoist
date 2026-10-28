import type { LocationReminderResponse, LocationTrigger } from '../../api/locations';

/** Android allows 100 geofences per app (spec M12, contract: the server also returns at most 100). */
export const MAX_GEOFENCES = 100;
/** iOS (CoreLocation) monitors at most 20 regions per app (X5). */
export const MAX_GEOFENCES_IOS = 20;

/** Region budget of the OS: 20 on iOS, 100 elsewhere. */
export function maxGeofences(os: string): number {
  return os === 'ios' ? MAX_GEOFENCES_IOS : MAX_GEOFENCES;
}

/** One circular region the device watches; `identifier` is the reminder id. */
export interface GeofenceRegion {
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number;
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
}

/** What the background handler needs to build the notification once a region fires. */
export interface GeofenceMeta {
  reminderId: string;
  taskId: string;
  title: string;
  placeName: string;
  trigger: LocationTrigger;
}

export interface GeofencePlan {
  regions: GeofenceRegion[];
  meta: Record<string, GeofenceMeta>;
}

/**
 * The geofences that should be registered now: nothing while reminders are off, otherwise one region per location
 * reminder (the server already left out completed tasks and archived projects), one per reminder id, at most `limit`.
 * ON_ENTER watches arrivals only, ON_LEAVE watches departures only.
 */
export function planGeofences(
  items: readonly LocationReminderResponse[],
  enabled: boolean,
  limit: number = MAX_GEOFENCES,
): GeofencePlan {
  const plan: GeofencePlan = { regions: [], meta: {} };
  if (!enabled) return plan;
  for (const item of items) {
    if (plan.regions.length >= limit) break;
    if (plan.meta[item.reminderId]) continue;
    plan.regions.push({
      identifier: item.reminderId,
      latitude: item.latitude,
      longitude: item.longitude,
      radius: item.radius,
      notifyOnEnter: item.trigger === 'ON_ENTER',
      notifyOnExit: item.trigger === 'ON_LEAVE',
    });
    plan.meta[item.reminderId] = {
      reminderId: item.reminderId,
      taskId: item.taskId,
      title: item.content,
      placeName: item.name,
      trigger: item.trigger,
    };
  }
  return plan;
}

/** Stable text of a plan: equal text = nothing to re-register. */
export function planSignature(plan: GeofencePlan): string {
  return plan.regions
    .map((r) => `${r.identifier}|${r.latitude}|${r.longitude}|${r.radius}|${r.notifyOnEnter ? 'E' : 'L'}`)
    .join(';');
}

export type GeofenceEventType = 'enter' | 'exit';

/** Fires only when the event matches what the reminder asked for (a region can report the other direction). */
export function shouldNotify(meta: GeofenceMeta | undefined, event: GeofenceEventType): meta is GeofenceMeta {
  if (!meta) return false;
  return (meta.trigger === 'ON_ENTER' && event === 'enter') || (meta.trigger === 'ON_LEAVE' && event === 'exit');
}
