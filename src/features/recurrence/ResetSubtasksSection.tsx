import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorText } from '../../components/ErrorText';
import { describeSettingsSaveError } from '../settings/settingsErrors';
import { SettingsSection, SwitchRow } from '../settings/ui';
import { useSettings } from '../settings/useSettings';

/**
 * Settings › General › "Reset sub-tasks" (M6c, Todoist): when a repeating task moves to its next due, its completed direct
 * sub-tasks (≤ 30) are reopened. Saved as `me/settings.resetSubtasks` (default off); the server applies it on close.
 */
export function ResetSubtasksSection() {
  const { t } = useTranslation();
  const { data, update } = useSettings();
  const [error, setError] = useState<string>();

  async function onChange(resetSubtasks: boolean) {
    setError(undefined);
    try {
      await update({ resetSubtasks });
    } catch (saveError) {
      setError(describeSettingsSaveError(saveError));
    }
  }

  return (
    <SettingsSection testID="settings-section-resetSubtasks">
      <SwitchRow
        testID="reset-subtasks"
        label={t('recurrence.settings.resetSubtasks.title')}
        hint={t('recurrence.settings.resetSubtasks.hint')}
        value={data?.resetSubtasks === true}
        onChange={(value) => void onChange(value)}
      />
      <ErrorText testID="reset-subtasks-error" message={error} />
    </SettingsSection>
  );
}
