import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GeofenceMeta } from './geofencePlan';

export const GEOFENCE_META_KEY = 'taskly.geofenceMeta';

/** The headless handler (app closed) cannot ask React, so the plan's task data lives in AsyncStorage. */
export async function saveGeofenceMeta(meta: Record<string, GeofenceMeta>): Promise<void> {
  await AsyncStorage.setItem(GEOFENCE_META_KEY, JSON.stringify(meta));
}

export async function loadGeofenceMeta(): Promise<Record<string, GeofenceMeta>> {
  try {
    const raw = await AsyncStorage.getItem(GEOFENCE_META_KEY);
    return raw ? (JSON.parse(raw) as Record<string, GeofenceMeta>) : {};
  } catch {
    return {};
  }
}

export async function clearGeofenceMeta(): Promise<void> {
  await AsyncStorage.removeItem(GEOFENCE_META_KEY);
}
