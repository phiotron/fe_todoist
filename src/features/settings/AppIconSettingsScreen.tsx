import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorText } from '../../components/ErrorText';
import { setDeviceSettings, useDeviceSettings } from '../../lib/device/deviceSettings';
import { APP_ICON_NAMES, type AppIconName } from '../../lib/native/appIcons';
import { getTasklyAndroid } from '../../lib/native/tasklyAndroid';
import { SettingsPage } from './SettingsPage';
import { ChoiceList, SettingsSection, useSettingsStyles } from './ui';

/**
 * Settings › App icon (M12; Todoist "Activate custom icons"): the user first activates custom icons (the launcher may
 * restart the app), then picks one. Without the TasklyAndroid native module (Expo Go, older build) it says so.
 */
export function AppIconSettingsScreen() {
  const { t } = useTranslation();
  const styles = useSettingsStyles();
  const { appIcon, customIconsActive } = useDeviceSettings();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const native = getTasklyAndroid();

  async function choose(name: AppIconName) {
    setError(undefined);
    try {
      await native?.setAppIcon(name);
      await setDeviceSettings({ appIcon: name });
    } catch {
      setError(t('android.appIcon.failed'));
    }
  }

  return (
    <SettingsPage testID="app-icon-screen" title={t('android.appIcon.title')}>
      <SettingsSection testID="settings-section-appIcon">
        <Text style={styles.hint}>{t('android.appIcon.intro')}</Text>
        {native === null ? (
          <Text testID="app-icon-unsupported" style={styles.notice}>
            {t('android.appIcon.unsupported')}
          </Text>
        ) : customIconsActive ? (
          <>
            <Text style={styles.hint}>{t('android.appIcon.activeHint')}</Text>
            <ChoiceList
              testIDPrefix="app-icon-option"
              selected={appIcon}
              onSelect={(name) => void choose(name as AppIconName)}
              choices={APP_ICON_NAMES.map((name) => ({ value: name, label: t(`android.appIcon.names.${name}`) }))}
            />
          </>
        ) : (
          <AppButton
            testID="app-icon-activate"
            variant="outline"
            full
            label={t('android.appIcon.activate')}
            onPress={() => setConfirming(true)}
          />
        )}
        <ErrorText testID="app-icon-error" message={error} />
      </SettingsSection>
      <ConfirmDialog
        visible={confirming}
        title={t('android.appIcon.confirmTitle')}
        message={t('android.appIcon.confirmMessage')}
        confirmLabel={t('android.appIcon.confirm')}
        destructive={false}
        onConfirm={() => {
          setConfirming(false);
          void setDeviceSettings({ customIconsActive: true });
        }}
        onCancel={() => setConfirming(false)}
        testID="app-icon-confirm"
      />
    </SettingsPage>
  );
}
