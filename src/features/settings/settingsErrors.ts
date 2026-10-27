import { describeError } from '../../api/describeError';
import i18n from '../../i18n';
import { isRetryableSaveError } from './settingsModel';

/** Message for a failed settings save. Retryable failures keep the choice on the device (UC 11/7a). */
export function describeSettingsSaveError(error: unknown): string {
  if (isRetryableSaveError(error)) return i18n.t('settings.saveFailed');
  const view = describeError(error);
  // A rejected value (400) explains itself better than the generic "invalid data" sentence.
  return Object.values(view.fields)[0] ?? view.message;
}
