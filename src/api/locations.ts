import { apiFetch } from './client';

/**
 * M12 — saved places for location reminders. Hand-written to match the backend DTOs (LocationResponse,
 * CreateLocationRequest, LocationReminderResponse) until types.gen.ts is regenerated at integration.
 */
export type LocationTrigger = 'ON_ENTER' | 'ON_LEAVE';

export interface LocationResponse {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Meters, 100–5000. */
  radius: number;
  createdAt: string;
}

export interface CreateLocationRequest {
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}

/** Item of GET /api/v1/tasks/location-reminders: one geofence the device should watch. */
export interface LocationReminderResponse {
  reminderId: string;
  taskId: string;
  content: string;
  locationId: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  trigger: LocationTrigger;
}

export const LOCATIONS_PATH = '/api/v1/locations';

export const locationsApi = {
  list: () => apiFetch<LocationResponse[]>(LOCATIONS_PATH),
  create: (body: CreateLocationRequest) => apiFetch<LocationResponse>(LOCATIONS_PATH, { method: 'POST', body }),
  remove: (locationId: string) =>
    apiFetch<void>(`${LOCATIONS_PATH}/${encodeURIComponent(locationId)}`, { method: 'DELETE' }),
  reminders: () => apiFetch<LocationReminderResponse[]>('/api/v1/tasks/location-reminders'),
};
