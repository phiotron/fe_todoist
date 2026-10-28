import { describeError } from '../../api/describeError';
import { ApiError, NetworkError, OfflineError, TimeoutError } from '../../api/errors';
import i18n from '../../i18n';
import type { GoogleSignInFailure } from '../../lib/googleSignIn';

/** ProblemDetail codes of spec 12.10 that M5 reacts to. */
export const LINK_REQUIRED = 'link-required';
export const PASSWORD_REQUIRED = 'password-required';

/**
 * The linkToken of a 409 link-required answer from POST auth/google, or null for any other error.
 * The token is an opaque string (a backend-signed JWT, typ google-link): the app never decodes or logs it.
 */
export function linkTokenOf(error: unknown): string | null {
  // Spec 12.1: recognised by status 409 AND code "link-required", never by the token alone.
  if (!(error instanceof ApiError) || error.status !== 409 || error.code !== LINK_REQUIRED) return null;
  const token = error.properties.linkToken;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

/** 409 password-required: DELETE me or DELETE me/identities/google on an account that has no password. */
export function isPasswordRequired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409 && error.code === PASSWORD_REQUIRED;
}

/**
 * Only a plain NetworkError (the request never got an answer) gets the "server unreachable / offline" pair chosen by
 * `isOnline`. TimeoutError and OfflineError are NetworkError subclasses with their own sentences in the shared
 * describeError (M1), so they must not be swallowed here.
 */
function isPlainNetworkError(error: unknown): boolean {
  return error instanceof NetworkError && !(error instanceof TimeoutError) && !(error instanceof OfflineError);
}

function networkMessage(isOnline: boolean): string {
  return isOnline ? i18n.t('errors.network') : i18n.t('errors.offline');
}

/** Failures that happen on the device, before any request to our backend. */
export function describeGoogleSignInFailure(reason: GoogleSignInFailure): string {
  switch (reason) {
    case 'notConfigured':
      return i18n.t('google.errors.notConfigured');
    case 'playServices':
      return i18n.t('google.errors.playServices');
    case 'inProgress':
      return i18n.t('google.errors.inProgress');
    case 'failed':
      return i18n.t('google.errors.failed');
  }
}

/**
 * POST auth/google. 409 link-required and 401 two-factor-required never get here:
 * the session turns them into a pending link / the M3 two-factor step.
 */
export function describeGoogleAuthError(error: unknown, isOnline: boolean): string {
  if (isPlainNetworkError(error)) return networkMessage(isOnline);
  if (error instanceof ApiError) {
    if (error.status === 401) return i18n.t('google.errors.failed');
    if (error.status === 403) return i18n.t('google.errors.emailNotVerified');
  }
  // Shared M1 mapping: timeout, offline, 5xx with a short requestId, 429, unknown...
  return describeError(error).message;
}

/** POST me/identities/google, with an ID token (Settings) or a linkToken (right after signing in). */
export function describeGoogleLinkError(error: unknown, isOnline: boolean): string {
  if (isPlainNetworkError(error)) return networkMessage(isOnline);
  if (error instanceof ApiError) {
    // 409 has no code here: Google already linked to another account, or this account has another Google.
    if (error.status === 409) return i18n.t('google.errors.linkConflict');
    if (error.status === 403) return i18n.t('google.errors.emailNotVerified');
    // Spec 12.1: a bad/expired token or email mismatch is 400 here, never 401 (401 means our session expired).
    if (error.status === 400) return i18n.t('google.errors.linkRejected');
    if (error.status === 401) return i18n.t('auth.errors.sessionExpired');
  }
  return describeError(error).message;
}

/** DELETE me/identities/google. 404 never gets here: the Settings section treats it as "already unlinked". */
export function describeGoogleUnlinkError(error: unknown, isOnline: boolean): string {
  if (isPlainNetworkError(error)) return networkMessage(isOnline);
  if (isPasswordRequired(error)) return i18n.t('google.settings.needPassword');
  if (error instanceof ApiError && error.status === 401) return i18n.t('auth.errors.sessionExpired');
  return describeError(error).message;
}
