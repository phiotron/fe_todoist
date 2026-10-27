import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorText } from '../../components/ErrorText';
import { describeSettingsSaveError } from './settingsErrors';
import { SettingsSection, SwitchRow } from './ui';
import { useSettings } from './useSettings';

/** "Smart date recognition": stored only; Quick Add (M6) reads it. */
export function SmartDateSection() {
  const { t } = useTranslation();
  const { settings, update } = useSettings();
  const [error, setError] = useState<string>();

  async function onChange(smartDateRecognition: boolean) {
    setError(undefined);
    try {
      await update({ smartDateRecognition });
    } catch (saveError) {
      setError(describeSettingsSaveError(saveError));
    }
  }

  return (
    <SettingsSection testID="settings-section-smartDate">
      <SwitchRow
        testID="smart-date"
        label={t('settings.smartDate.title')}
        hint={t('settings.smartDate.hint')}
        value={settings.smartDateRecognition}
        onChange={(value) => void onChange(value)}
      />
      <ErrorText testID="smart-date-error" message={error} />
    </SettingsSection>
  );
}
