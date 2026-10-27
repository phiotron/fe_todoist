import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { Avatar } from '../../components/Avatar';
import { type, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { useMe } from '../auth/session';
import { ResetDefaultsSection } from './ResetDefaultsSection';
import { SettingsLinkRow } from './SettingsLinkRow';
import { SettingsPage } from './SettingsPage';
import { SignOutSection } from './SignOutSection';
import { THEME_NAME_KEYS } from './themeLabels';
import { useSettingsStyles } from './ui';
import { useSettings } from './useSettings';

/**
 * Settings home (M-Settings). Rows are drawn directly in the JSX, in display order:
 * The "Reminders" row (M4) sits right after "Date & time".
 */
export function SettingsScreen() {
  const { t } = useTranslation();
  const styles = useThemedStyles(createHeroStyles);
  const shared = useSettingsStyles();
  const me = useMe();
  const { settings, hasPending } = useSettings();

  return (
    <SettingsPage testID="settings-screen" title={t('settings.title')}>
      {me.data ? (
        <View style={styles.hero}>
          <Avatar name={me.data.displayName} seed={me.data.id} size="xl" testID="settings-avatar" />
          <View style={styles.heroTexts}>
            <Text style={styles.name} numberOfLines={1}>
              {me.data.displayName}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {me.data.email}
            </Text>
          </View>
          <AppButton
            testID="settings-edit-profile"
            variant="outline"
            size="sm"
            label={t('settings.edit')}
            onPress={() => router.push('/settings/account')}
          />
        </View>
      ) : null}
      {hasPending ? (
        <Text testID="settings-pending-notice" accessibilityLiveRegion="polite" style={shared.notice}>
          {t('settings.pendingNotice')}
        </Text>
      ) : null}
      <SettingsLinkRow testID="settings-row-account" icon="user" label={t('settings.pages.account')} href="/settings/account" />
      <SettingsLinkRow testID="settings-row-general" icon="sliders" label={t('settings.pages.general')} href="/settings/general" />
      <SettingsLinkRow testID="settings-row-date-time" icon="calendar" label={t('settings.pages.dateTime')} href="/settings/date-time" />
      <SettingsLinkRow testID="settings-row-reminders" icon="bell" label={t('reminders.settings.title')} href="/settings/reminders" />
      <SettingsLinkRow
        testID="settings-row-theme"
        icon="droplet"
        label={t('settings.pages.theme')}
        value={t(THEME_NAME_KEYS[settings.theme])}
        href="/settings/theme"
      />
      <SettingsLinkRow testID="settings-row-navigation" icon="layout" label={t('settings.pages.navigation')} href="/settings/navigation" />
      <ResetDefaultsSection />
      <SignOutSection />
    </SettingsPage>
  );
}

function createHeroStyles(palette: Palette) {
  return StyleSheet.create({
    hero: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
    heroTexts: { flex: 1 },
    name: { ...type.dialogTitle, color: palette.ink },
    email: { ...type.meta, color: palette.mute },
  });
}
