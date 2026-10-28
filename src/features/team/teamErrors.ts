import i18n from '../../i18n';
import { describeError, errorCode } from '../../api/describeError';

/** Message of a failed Team write: the `last-admin` refusal (409) is worded here in the app language, the rest as usual. */
export function teamErrorMessage(error: unknown): string {
  return errorCode(error) === 'last-admin' ? i18n.t('team.lastAdmin') : describeError(error).message;
}
