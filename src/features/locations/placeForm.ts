import type { CreateLocationRequest } from '../../api/locations';

export const MIN_RADIUS_M = 100;
export const MAX_RADIUS_M = 5000;
export const DEFAULT_RADIUS_M = 200;
export const MAX_PLACE_NAME = 100;

export interface PlaceFormValues {
  name: string;
  latitude: string;
  longitude: string;
  radius: string;
}

/** Error keys (i18n `reminders.places.*`) per field, absent = valid. */
export interface PlaceFormErrors {
  name?: 'reminders.places.invalidName';
  latitude?: 'reminders.places.invalidLatitude';
  longitude?: 'reminders.places.invalidLongitude';
  radius?: 'reminders.places.invalidRadius';
}

/** Accepts "10.77" and "10,77" (Vietnamese keyboards type a comma). NaN when it is not a number. */
export function parseCoordinate(text: string): number {
  const normalised = text.trim().replace(',', '.');
  return normalised === '' ? Number.NaN : Number(normalised);
}

export function validatePlace(values: PlaceFormValues): { request: CreateLocationRequest } | { errors: PlaceFormErrors } {
  const errors: PlaceFormErrors = {};
  const name = values.name.trim();
  if (name.length === 0 || name.length > MAX_PLACE_NAME) errors.name = 'reminders.places.invalidName';
  const latitude = parseCoordinate(values.latitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) errors.latitude = 'reminders.places.invalidLatitude';
  const longitude = parseCoordinate(values.longitude);
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    errors.longitude = 'reminders.places.invalidLongitude';
  }
  const radius = Number(values.radius.trim());
  if (!Number.isInteger(radius) || radius < MIN_RADIUS_M || radius > MAX_RADIUS_M) {
    errors.radius = 'reminders.places.invalidRadius';
  }
  if (Object.keys(errors).length > 0) return { errors };
  return { request: { name, latitude, longitude, radius } };
}

/** Rounds to 6 decimals (about 10 cm) for the text fields. */
export function coordinateText(value: number): string {
  return String(Math.round(value * 1e6) / 1e6);
}
