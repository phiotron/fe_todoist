import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from './config';
import { setGoogleSignInPlatform } from './googleSignIn';
import type { GoogleSignInPlatform, GoogleSignInResult } from './googleSignIn';

const FAILED: GoogleSignInResult = { type: 'error', reason: 'failed' };
const PLAY_SERVICES: GoogleSignInResult = { type: 'error', reason: 'playServices' };

/** A rejection of the native module: the status code tells why (spec of @react-native-google-signin v16). */
function resultOfError(error: unknown): GoogleSignInResult {
  if (!isErrorWithCode(error)) return FAILED;
  switch (error.code) {
    case statusCodes.SIGN_IN_CANCELLED:
      return { type: 'cancelled' };
    case statusCodes.IN_PROGRESS:
      return { type: 'error', reason: 'inProgress' };
    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
      return PLAY_SERVICES;
    default:
      // Anything else (DEVELOPER_ERROR: wrong SHA-1 / package, network...) is a plain failure.
      return FAILED;
  }
}

/**
 * GoogleSignInPlatform backed by `@react-native-google-signin/google-signin` v16:
 * configure({ webClientId }) -> hasPlayServices() -> signIn() -> signOut() (best effort) -> idToken + email.
 *
 * `webClientId` is the Web application OAuth client (never the Android one): the ID token is issued for it, which is
 * what the backend verifies. null = not configured: nothing native is touched and the screens say so.
 */
export interface GoogleAdapterOptions {
  /** iOS client ID (X5); on iOS the native SDK needs it, so without it Google sign-in is "not configured" there. */
  iosClientId?: string | null;
  /** Defaults to 'android' (the platform the adapter was written for); the app passes Platform.OS. */
  os?: string;
}

export function createGoogleSignInAdapter(webClientId: string | null, options: GoogleAdapterOptions = {}): GoogleSignInPlatform {
  const { iosClientId = null, os = 'android' } = options;
  let configured = false;
  return {
    async signIn() {
      if (!webClientId) return { type: 'error', reason: 'notConfigured' };
      if (os === 'ios' && !iosClientId) return { type: 'error', reason: 'notConfigured' };
      try {
        if (!configured) {
          GoogleSignin.configure(os === 'ios' && iosClientId ? { webClientId, iosClientId } : { webClientId });
          configured = true;
        }
        // v16 normally rejects with PLAY_SERVICES_NOT_AVAILABLE; a plain `false` is treated the same way.
        if (!(await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true }))) return PLAY_SERVICES;

        const response = await GoogleSignin.signIn();
        // v16 reports a closed account picker as a value, older versions as a SIGN_IN_CANCELLED rejection.
        if (response.type !== 'success') return { type: 'cancelled' };

        const { idToken, user } = response.data;
        // Forget the chosen account: Taskly keeps its own session, and the next press must show the picker again.
        try {
          await GoogleSignin.signOut();
        } catch {
          // best effort only
        }
        // No token (the Web client ID is not known to Google) is reported as a failure by getGoogleIdToken().
        if (!idToken) return FAILED;
        return { type: 'success', idToken, email: user?.email ?? null };
      } catch (error) {
        return resultOfError(error);
      }
    },
  };
}

/** Called once at startup (src/app/_layout.tsx): installs the native adapter as the app's Google sign-in platform. */
export function installNativeGoogleSignIn(
  webClientId: string | null = GOOGLE_WEB_CLIENT_ID,
  iosClientId: string | null = GOOGLE_IOS_CLIENT_ID,
  os: string = Platform.OS,
): void {
  setGoogleSignInPlatform(createGoogleSignInAdapter(webClientId, { iosClientId, os }));
}
