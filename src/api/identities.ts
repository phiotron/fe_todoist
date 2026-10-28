import { apiFetch } from './client';
import type { AuthResponse } from './auth';

/** Either a fresh Google ID token (Settings) or the linkToken from a 409 link-required answer. */
export type LinkGoogleRequest = { idToken: string } | { linkToken: string };

const GOOGLE_IDENTITY_PATH = '/api/v1/me/identities/google';

/** M13b: Apple / Facebook next to Google (backend IdentityProvider). */
export type IdentityProvider = 'GOOGLE' | 'APPLE' | 'FACEBOOK';
export type SocialProvider = 'APPLE' | 'FACEBOOK';

/**
 * The providers listed in GET me. The generated type only knows "GOOGLE" until src/api/types.gen.ts is regenerated from
 * the M13b backend (integration step), so the list is read through this helper.
 */
export function linkedProvidersOf(me: { linkedProviders?: readonly string[] }): IdentityProvider[] {
  return (me.linkedProviders ?? []).filter(
    (provider): provider is IdentityProvider => provider === 'GOOGLE' || provider === 'APPLE' || provider === 'FACEBOOK',
  );
}

/** Apple sends an idToken, Facebook an accessToken (backend AppleSignInRequest / FacebookSignInRequest). */
export function socialTokenField(provider: SocialProvider): 'idToken' | 'accessToken' {
  return provider === 'APPLE' ? 'idToken' : 'accessToken';
}

function socialPath(provider: SocialProvider): string {
  return provider === 'APPLE' ? 'apple' : 'facebook';
}

/** POST me/identities/{apple|facebook}: the provider's token (Settings) or the linkToken of a 409 link-required. */
export type LinkSocialRequest = { token: string } | { linkToken: string };

/** POST auth/{apple|facebook}; displayName (Apple only) is the name Apple hands over on first consent. */
export interface SocialSignInInput {
  token: string;
  displayName?: string | null;
}

/**
 * Both answer 204 No Content (spec 12.1): callers refetch GET me afterwards.
 * POST: 400 bad/expired token or email mismatch, 403 email not verified, 409 (no code) Google already linked elsewhere.
 * DELETE: 404 not linked, 409 code "password-required" (the account has no password yet).
 */
export const identitiesApi = {
  linkGoogle: (body: LinkGoogleRequest) => apiFetch<void>(GOOGLE_IDENTITY_PATH, { method: 'POST', body }),
  unlinkGoogle: () => apiFetch<void>(GOOGLE_IDENTITY_PATH, { method: 'DELETE' }),
  /** Same answers as linkGoogle (M13b): 204 | 400 | 403 | 409. */
  linkSocial: (provider: SocialProvider, request: LinkSocialRequest) =>
    apiFetch<void>(`/api/v1/me/identities/${socialPath(provider)}`, {
      method: 'POST',
      body: 'linkToken' in request ? { linkToken: request.linkToken } : { [socialTokenField(provider)]: request.token },
    }),
  /** Same answers as unlinkGoogle. */
  unlinkSocial: (provider: SocialProvider) =>
    apiFetch<void>(`/api/v1/me/identities/${socialPath(provider)}`, { method: 'DELETE' }),
};

/** Public sign-in endpoints of M13b; same outcomes as auth/google: 200 | 401 two-factor-required | 409 link-required. */
export const socialAuthApi = {
  signIn: (provider: SocialProvider, input: SocialSignInInput) =>
    apiFetch<AuthResponse>(`/api/v1/auth/${socialPath(provider)}`, {
      method: 'POST',
      auth: false,
      body:
        provider === 'APPLE'
          ? { idToken: input.token, ...(input.displayName ? { displayName: input.displayName } : {}) }
          : { accessToken: input.token },
    }),
};
