import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { ErrorText } from '../../components/ErrorText';
import { useTopInset } from '../../components/useTopInset';
import { describeSettingsSaveError } from './settingsErrors';
import { useSettingsStyles } from './ui';
import { useSettings } from './useSettings';

/** Spec 5.2: tell the user when the device time zone differs from the account one and offer to update it. */
export function TimeZoneBanner() {
  const { t } = useTranslation();
  const styles = useSettingsStyles();
  // The banner sits at the very top of the signed-in layout: keep it clear of the status bar (clock, wifi icons).
  const topInset = useTopInset();
  const { settings, deviceTimeZone, timeZoneMismatch, update, dismissTimeZoneMismatch } = useSettings();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (!timeZoneMismatch || !deviceTimeZone) return null;
  const deviceZone: string = deviceTimeZone;

  async function onUpdate() {
    setBusy(true);
    setError(undefined);
    try {
      await update({ timeZone: deviceZone });
    } catch (saveError) {
      // Retryable failures keep the new zone on the device (the banner then hides); a rejected zone shows why.
      setError(describeSettingsSaveError(saveError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      testID="tz-banner"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.banner, { paddingTop: styles.banner.paddingVertical + topInset }]}
    >
      <Text style={styles.bannerText}>
        {t('settings.timeZone.mismatch', { device: deviceZone, account: settings.timeZone })}
      </Text>
      <View style={styles.actions}>
        <AppButton
          testID="tz-banner-update"
          variant="outline"
          size="sm"
          label={t('settings.timeZone.update')}
          busy={busy}
          onPress={() => void onUpdate()}
        />
        <AppButton
          testID="tz-banner-dismiss"
          variant="ghost"
          size="sm"
          label={t('settings.timeZone.dismiss')}
          disabled={busy}
          onPress={dismissTimeZoneMismatch}
        />
      </View>
      <ErrorText testID="tz-banner-error" message={error} />
    </View>
  );
}
