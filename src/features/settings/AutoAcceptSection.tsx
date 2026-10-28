import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorText } from '../../components/ErrorText';
import { describeSettingsSaveError } from './settingsErrors';
import { SettingsSection, SwitchRow } from './ui';
import { useSettings } from './useSettings';

/** M8a "Auto accept invites": email invitations to this account are accepted by the server at once. */
export function AutoAcceptSection() {
  const { t } = useTranslation();
  const { data, update } = useSettings();
  const [error, setError] = useState<string>();
  const value = data?.autoAcceptInvites ?? false;

  async function onChange(autoAcceptInvites: boolean) {
    setError(undefined);
    try {
      await update({ autoAcceptInvites });
    } catch (saveError) {
      setError(describeSettingsSaveError(saveError));
    }
  }

  return (
    <SettingsSection testID="settings-section-autoAccept">
      <SwitchRow
        testID="auto-accept-invites"
        label={t('settings.autoAccept.title')}
        hint={t('settings.autoAccept.hint')}
        value={value}
        onChange={(next) => void onChange(next)}
      />
      <ErrorText testID="auto-accept-error" message={error} />
    </SettingsSection>
  );
}
