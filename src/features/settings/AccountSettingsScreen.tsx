import { useTranslation } from 'react-i18next';
import { DeleteAccountSection } from './DeleteAccountSection';
import { GoogleLinkSection } from './GoogleLinkSection';
import { LogoutAllSection } from './LogoutAllSection';
import { PasswordSection } from './PasswordSection';
import { ProfileSection } from './ProfileSection';
import { SettingsLinkRow } from './SettingsLinkRow';
import { SettingsPage } from './SettingsPage';
import { SocialLinkSection } from './SocialLinkSection';
import { SettingsSection } from './ui';
import { useTwoFactorStatus } from '../two-factor/useTwoFactorStatus';

/**
 * Settings › Account (spec 9.5). Sections are listed directly in the JSX, in display order:
 * <GoogleLinkSection /> (M5) comes right after <PasswordSection />.
 */
export function AccountSettingsScreen() {
  const { t } = useTranslation();
  const twoFactor = useTwoFactorStatus();
  const status = twoFactor.data
    ? twoFactor.data.enabled
      ? t('settings.account.twoFactorOn')
      : t('settings.account.twoFactorOff')
    : undefined;
  return (
    <SettingsPage testID="account-settings-screen" title={t('settings.pages.account')}>
      <ProfileSection />
      <PasswordSection />
      <GoogleLinkSection />
      <SocialLinkSection provider="APPLE" />
      <SocialLinkSection provider="FACEBOOK" />
      <SettingsSection testID="settings-section-twoFactor">
        <SettingsLinkRow
          testID="settings-row-two-factor"
          icon="shield"
          label={t('settings.account.twoFactor')}
          value={status}
          href="/settings/two-factor"
        />
      </SettingsSection>
      <LogoutAllSection />
      <DeleteAccountSection />
    </SettingsPage>
  );
}
