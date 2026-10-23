export const DEFAULT_API_URL = 'http://10.0.2.2:8080';

export function resolveApiUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return DEFAULT_API_URL;
  return trimmed.replace(/\/+$/, '');
}

// Expo inlines EXPO_PUBLIC_* only when accessed with dot notation.
export const API_URL = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL);
