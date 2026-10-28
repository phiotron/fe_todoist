import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { describeError } from '../../api/describeError';
import { pushTokensApi } from '../../api/pushTokens';
import { AppButton } from '../../components/AppButton';
import { useSnackbar } from '../../components/Snackbar';
import { SettingsSection, useSettingsStyles } from '../settings/ui';

/** M13c F6: asks the server to push a test notification to every registered device and says how many it reached. */
export function TestPushSection() {
  const { t } = useTranslation();
  const styles = useSettingsStyles();
  const snackbar = useSnackbar();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  async function sendTest() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const { devices } = await pushTokensApi.test();
      snackbar.show({
        message: devices > 0 ? t('notificationPrefs.testSent', { devices }) : t('notificationPrefs.testNoDevice'),
        durationMs: devices > 0 ? undefined : 8000,
      });
    } catch (error) {
      snackbar.show({ message: describeError(error).message, tone: 'error' });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <SettingsSection testID="notification-prefs-section-test" title={t('notificationPrefs.testSection')}>
      <Text style={styles.hint}>{t('notificationPrefs.testHint')}</Text>
      <AppButton
        testID="notification-prefs-test-push"
        variant="outline"
        icon="send"
        full
        busy={busy}
        requiresOnline
        label={t('notificationPrefs.testButton')}
        onPress={() => void sendTest()}
      />
    </SettingsSection>
  );
}
