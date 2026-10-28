import { describeError } from '../../api/describeError';
import { ApiError, NetworkError, OfflineError, TimeoutError } from '../../api/errors';
import i18n from '../../i18n';

/** ProblemDetail codes of M13b Calendar. */
export const CALENDAR_ALREADY_CONNECTED = 'calendar-already-connected';
export const CALENDAR_NOT_CONFIGURED = 'calendar-not-configured';
export const CALENDAR_UNAVAILABLE = 'calendar-unavailable';

function isPlainNetworkError(error: unknown): boolean {
  return error instanceof NetworkError && !(error instanceof TimeoutError) && !(error instanceof OfflineError);
}

/** Any Calendar request (connect, update, sync, feed...). */
export function describeCalendarError(error: unknown, isOnline: boolean): string {
  if (isPlainNetworkError(error)) return isOnline ? i18n.t('errors.network') : i18n.t('errors.offline');
  if (error instanceof ApiError) {
    if (error.status === 409 && error.code === CALENDAR_ALREADY_CONNECTED) return i18n.t('calendar.errors.alreadyConnected');
    if (error.status === 503 && error.code === CALENDAR_NOT_CONFIGURED) return i18n.t('calendar.errors.notConfigured');
    if (error.status === 503 && error.code === CALENDAR_UNAVAILABLE) return i18n.t('calendar.errors.unavailable');
  }
  return describeError(error).message;
}

/** The `error` of taskly://calendar/connected?error=<code> (backend CalendarConnectionService.ERROR_*). */
export function describeConnectDeepLinkError(code: string): string {
  switch (code) {
    case 'denied':
      return i18n.t('calendar.errors.denied');
    case 'invalid-state':
      return i18n.t('calendar.errors.invalidState');
    case 'already-connected':
      return i18n.t('calendar.errors.alreadyConnected');
    case 'unavailable':
      return i18n.t('calendar.errors.unavailable');
    default:
      return i18n.t('calendar.errors.connectFailed');
  }
}
