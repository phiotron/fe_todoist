import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorText } from '../../components/ErrorText';
import { describeSettingsSaveError } from '../settings/settingsErrors';
import { SettingsSection, SwitchRow } from '../settings/ui';
import { useHomeView } from './useHomeView';

/** Settings › General, under the start page: "Sync home view" (Todoist). */
export function SyncHomeViewSection() {
  const { t } = useTranslation();
  const { sync, setSync } = useHomeView();
  const [error, setError] = useState<string>();

  async function onChange(on: boolean) {
    setError(undefined);
    try {
      await setSync(on);
    } catch (saveError) {
      setError(describeSettingsSaveError(saveError));
    }
  }

  return (
    <SettingsSection testID="settings-section-syncHomeView">
      <SwitchRow
        testID="sync-home-view"
        label={t('navMenu.syncHomeView.title')}
        hint={t('navMenu.syncHomeView.hint')}
        value={sync}
        onChange={(value) => void onChange(value)}
      />
      <ErrorText testID="sync-home-view-error" message={error} />
    </SettingsSection>
  );
}
