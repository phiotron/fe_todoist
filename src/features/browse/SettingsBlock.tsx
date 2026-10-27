import { useTranslation } from 'react-i18next';
import { SettingsLinkRow } from '../settings/SettingsLinkRow';

/** Browse block "Settings" (spec 9.2). */
export function SettingsBlock() {
  const { t } = useTranslation();
  return <SettingsLinkRow testID="browse-settings-row" icon="settings" label={t('settings.title')} href="/settings" />;
}
