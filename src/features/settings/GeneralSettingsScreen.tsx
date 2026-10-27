import { useTranslation } from 'react-i18next';
import { LanguageSection } from './LanguageSection';
import { SettingsPage } from './SettingsPage';
import { SmartDateSection } from './SmartDateSection';
import { StartPageSection } from './StartPageSection';
import { SwipeSection } from './SwipeSection';
import { TimeZoneSection } from './TimeZoneSection';

/** Settings › General (spec 9.5): language, time zone, start page, smart date recognition, swipe actions. */
export function GeneralSettingsScreen() {
  const { t } = useTranslation();
  return (
    <SettingsPage testID="general-settings-screen" title={t('settings.pages.general')}>
      <LanguageSection />
      <TimeZoneSection />
      <StartPageSection />
      <SmartDateSection />
      <SwipeSection />
    </SettingsPage>
  );
}
