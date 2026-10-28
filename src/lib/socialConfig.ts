/** Public identifiers of the Apple Services ID and the Facebook app; null = that sign-in is not configured in this build. */
export interface SocialConfig {
  appleServiceId: string | null;
  /** Public HTTPS URL of POST /api/v1/auth/apple/callback on the backend (registered at Apple). */
  appleRedirectUri: string | null;
  facebookAppId: string | null;
  /** Public HTTPS URL of GET /api/v1/auth/facebook/callback on the backend (registered at Meta). */
  facebookRedirectUri: string | null;
}

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

// Dot notation on purpose: Expo inlines EXPO_PUBLIC_* only in this form. Values come from .env (see .env.example).
export const SOCIAL_CONFIG: SocialConfig = {
  appleServiceId: clean(process.env.EXPO_PUBLIC_APPLE_SERVICE_ID),
  appleRedirectUri: clean(process.env.EXPO_PUBLIC_APPLE_REDIRECT_URI),
  facebookAppId: clean(process.env.EXPO_PUBLIC_FACEBOOK_APP_ID),
  facebookRedirectUri: clean(process.env.EXPO_PUBLIC_FACEBOOK_REDIRECT_URI),
};
