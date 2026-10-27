/**
 * IANA zones offered in the picker. Hermes may lack Intl.supportedValuesOf, so the list is fixed;
 * the account zone and the device zone are always added (timeZoneOptions).
 */
export const COMMON_TIME_ZONES: readonly string[] = [
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Sao_Paulo',
  'Atlantic/Azores',
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Dhaka',
  'Asia/Bangkok',
  'Asia/Ho_Chi_Minh',
  'Asia/Jakarta',
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
  'Asia/Manila',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Taipei',
  'Asia/Seoul',
  'Asia/Tokyo',
  'Australia/Perth',
  'Australia/Sydney',
  'Pacific/Auckland',
];

export function timeZoneOptions(current: string, device: string | null): string[] {
  const zones = new Set<string>(COMMON_TIME_ZONES);
  zones.add(current);
  if (device) zones.add(device);
  return [...zones].sort((a, b) => a.localeCompare(b));
}

/** Every word of the query must appear; "ho chi" and "ho_chi" both find Asia/Ho_Chi_Minh. */
export function filterTimeZones(zones: readonly string[], query: string): string[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...zones];
  return zones.filter((zone) => {
    const lower = zone.toLowerCase();
    const haystack = `${lower} ${lower.replace(/_/g, ' ')}`;
    return words.every((word) => haystack.includes(word));
  });
}
