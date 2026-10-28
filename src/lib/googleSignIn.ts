export type GoogleSignInFailure = 'notConfigured' | 'playServices' | 'inProgress' | 'failed';

export type GoogleSignInResult =
  | { type: 'success'; idToken: string; email: string | null }
  | { type: 'cancelled' }
  | { type: 'error'; reason: GoogleSignInFailure };

/**
 * Everything the app needs from the native Google Sign-In. The app talks only to this port. The real adapter
 * (src/lib/googleSignInAdapter.ts, backed by `@react-native-google-signin/google-signin` v16) is installed once at
 * startup in src/app/_layout.tsx via setGoogleSignInPlatform():
 *
 *   configure({ webClientId: GOOGLE_WEB_CLIENT_ID }) -> hasPlayServices() -> signIn() -> signOut() (best effort, so the
 *   next press shows the account picker again) -> `{ type: 'success', idToken, email }`; `cancelled` for a closed picker;
 *   `error` with `playServices` / `inProgress` / `failed` for the other status codes; `notConfigured` when
 *   GOOGLE_WEB_CLIENT_ID (src/lib/config.ts) is null.
 *
 * Tests use the fake (src/test/fakeGoogleSignInPlatform.ts) and never load the native module.
 */
export interface GoogleSignInPlatform {
  /** Opens the Google account picker and returns an ID token for the backend. May throw: getGoogleIdToken() catches. */
  signIn(): Promise<GoogleSignInResult>;
}

/** Used when no native module is installed: nothing can be signed in, the screens report "not configured". */
export const unavailableGoogleSignInPlatform: GoogleSignInPlatform = {
  signIn: async () => ({ type: 'error', reason: 'notConfigured' }),
};

let current: GoogleSignInPlatform = unavailableGoogleSignInPlatform;

export function getGoogleSignInPlatform(): GoogleSignInPlatform {
  return current;
}

/** Install the real adapter (startup) or a fake (tests). Pass null to restore the unavailable platform. */
export function setGoogleSignInPlatform(platform: GoogleSignInPlatform | null): void {
  current = platform ?? unavailableGoogleSignInPlatform;
}

const FAILED: GoogleSignInResult = { type: 'error', reason: 'failed' };

/**
 * Opens the Google account picker and returns an ID token for the backend.
 * Never throws: cancellation and every failure come back as values, so callers cannot forget a branch.
 */
export async function getGoogleIdToken(): Promise<GoogleSignInResult> {
  try {
    const result = await current.signIn();
    // A success without a token cannot sign anyone in (the web client ID is missing on the Google side).
    if (result.type === 'success' && !result.idToken) return FAILED;
    return result;
  } catch {
    return FAILED;
  }
}
