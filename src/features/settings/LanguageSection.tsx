import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorText } from '../../components/ErrorText';
import type { AppLanguage } from './settingsModel';
import { describeSettingsSaveError } from './settingsErrors';
import { ChoiceList, SettingsSection } from './ui';
import { useSettings } from './useSettings';

export function LanguageSection() {
  const { t } = useTranslation();
  const { settings, update } = useSettings();
  const [error, setError] = useState<string>();

  async function onSelect(locale: AppLanguage) {
    if (locale === settings.locale) return;
    setError(undefined);
    try {
      // Every text switches at once; Accept-Language follows, so server messages switch too.
      await update({ locale });
    } catch (saveError) {
      setError(describeSettingsSaveError(saveError));
    }
  }

  return (
    <SettingsSection testID="settings-section-language" title={t('settings.language.title')}>
      <ChoiceList
        testIDPrefix="language"
        selected={settings.locale}
        onSelect={(locale) => void onSelect(locale)}
        choices={[
          { value: 'vi', label: t('settings.language.vi') },
          { value: 'en', label: t('settings.language.en') },
        ]}
      />
      <ErrorText testID="language-error" message={error} />
    </SettingsSection>
  );
}
