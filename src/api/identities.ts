import { apiFetch } from './client';

/** Either a fresh Google ID token (Settings) or the linkToken from a 409 link-required answer. */
export type LinkGoogleRequest = { idToken: string } | { linkToken: string };

const GOOGLE_IDENTITY_PATH = '/api/v1/me/identities/google';

/**
 * Both answer 204 No Content (spec 12.1): callers refetch GET me afterwards.
 * POST: 400 bad/expired token or email mismatch, 403 email not verified, 409 (no code) Google already linked elsewhere.
 * DELETE: 404 not linked, 409 code "password-required" (the account has no password yet).
 */
export const identitiesApi = {
  linkGoogle: (body: LinkGoogleRequest) => apiFetch<void>(GOOGLE_IDENTITY_PATH, { method: 'POST', body }),
  unlinkGoogle: () => apiFetch<void>(GOOGLE_IDENTITY_PATH, { method: 'DELETE' }),
};
