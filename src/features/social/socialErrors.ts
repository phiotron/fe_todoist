import { describeError } from '../../api/describeError';
import { ApiError, NetworkError, OfflineError, TimeoutError } from '../../api/errors';
import type { SocialProvider } from '../../api/identities';
import i18n from '../../i18n';
import { isPasswordRequired } from '../auth/googleErrors';
import type { BeginResult } from './socialFlow';

export function providerName(provider: SocialProvider): string {
  return i18n.t(`social.names.${provider}`);
}

/** Only a plain NetworkError (no answer at all) gets the offline / unreachable pair; timeouts keep the shared sentences. */
function isPlainNetworkError(error: unknown): boolean {
  return error instanceof NetworkError && !(error instanceof TimeoutError) && !(error instanceof OfflineError);
}

function networkMessage(isOnline: boolean): string {
  return isOnline ? i18n.t('errors.network') : i18n.t('errors.offline');
}

/** Failure before any request to our backend: the page could not be opened, or the build has no app id. */
export function describeBeginFailure(provider: SocialProvider, result: Exclude<BeginResult, 'opened'>): string {
  const name = providerName(provider);
  return result === 'notConfigured'
    ? i18n.t('social.errors.notConfigured', { provider: name })
    : i18n.t('social.errors.openFailed', { provider: name });
}

/** The deep link came back unusable (provider error, forged or stale state). */
export function describeCallbackFailure(provider: SocialProvider, reason: 'stateMismatch' | 'failed'): string {
  const name = providerName(provider);
  return reason === 'stateMismatch'
    ? i18n.t('social.errors.stateMismatch', { provider: name })
    : i18n.t('social.errors.failed', { provider: name });
}

/** POST auth/apple | auth/facebook. 409 link-required and 401 two-factor-required never get here (the session handles them). */
export function describeSocialAuthError(provider: SocialProvider, error: unknown, isOnline: boolean): string {
  if (isPlainNetworkError(error)) return networkMessage(isOnline);
  if (error instanceof ApiError) {
    if (error.status === 401) return i18n.t('social.errors.failed', { provider: providerName(provider) });
    if (error.status === 403) return i18n.t('social.errors.emailProblem', { provider: providerName(provider) });
  }
  return describeError(error).message;
}

/** POST me/identities/{apple|facebook} (spec 12.1: a bad token is 400 here, never 401). */
export function describeSocialLinkError(provider: SocialProvider, error: unknown, isOnline: boolean): string {
  if (isPlainNetworkError(error)) return networkMessage(isOnline);
  const name = providerName(provider);
  if (error instanceof ApiError) {
    if (error.status === 409) return i18n.t('social.errors.linkConflict', { provider: name });
    if (error.status === 403) return i18n.t('social.errors.emailProblem', { provider: name });
    if (error.status === 400) return i18n.t('social.errors.linkRejected', { provider: name });
    if (error.status === 401) return i18n.t('auth.errors.sessionExpired');
  }
  return describeError(error).message;
}

/** DELETE me/identities/{apple|facebook}. 404 never gets here: the section treats it as "already unlinked". */
export function describeSocialUnlinkError(provider: SocialProvider, error: unknown, isOnline: boolean): string {
  if (isPlainNetworkError(error)) return networkMessage(isOnline);
  if (isPasswordRequired(error)) return i18n.t('social.settings.needPassword', { provider: providerName(provider) });
  if (error instanceof ApiError && error.status === 401) return i18n.t('auth.errors.sessionExpired');
  return describeError(error).message;
}
