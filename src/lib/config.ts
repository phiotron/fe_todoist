// Android 17 blocks apps from on-link addresses such as 10.0.2.2 ("local network"), so the emulator reaches the
// backend through `adb reverse tcp:8080 tcp:8080` and localhost instead.
export const DEFAULT_API_URL = 'http://localhost:8080';

export function resolveApiUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return DEFAULT_API_URL;
  return trimmed.replace(/\/+$/, '');
}

// Expo inlines EXPO_PUBLIC_* only when accessed with dot notation.
export const API_URL = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL);

/** Web client ID of the Google OAuth "Web application" client; null = Google sign-in not configured. */
export function resolveGoogleWebClientId(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// Dot notation on purpose: Expo inlines EXPO_PUBLIC_* only in this form. Read by the native Google adapter (src/lib/googleSignInAdapter.ts).
export const GOOGLE_WEB_CLIENT_ID = resolveGoogleWebClientId(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);

/**
 * X5: iOS client ID of the Google OAuth "iOS" client (Bundle ID com.taskly.app); null = Google sign-in is not configured
 * on iOS. Only the iOS build reads it; the matching URL scheme (REVERSED_CLIENT_ID) is set at build time in app.config.js.
 */
export const GOOGLE_IOS_CLIENT_ID = resolveGoogleWebClientId(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
