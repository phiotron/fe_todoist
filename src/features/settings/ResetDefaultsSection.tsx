import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { describeError } from '../../api/describeError';
import { AppButton } from '../../components/AppButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { SettingsSection, SuccessText, useSettingsStyles } from './ui';
import { useSettings } from './useSettings';

export function ResetDefaultsSection() {
  const { t } = useTranslation();
  const styles = useSettingsStyles();
  const { reset } = useSettings();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const inFlight = useRef(false);

  async function onConfirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await reset();
      setConfirming(false);
      setDone(true);
    } catch (resetError) {
      // Not applied on the device first: on failure nothing changes and the dialog says why.
      setError(describeError(resetError).message);
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <SettingsSection testID="settings-section-reset" title={t('settings.reset.title')}>
      <Text style={styles.hint}>{t('settings.reset.description')}</Text>
      <AppButton
        testID="settings-reset"
        variant="outline"
        label={t('settings.reset.button')}
        full
        requiresOnline
        onPress={() => {
          setDone(false);
          setError(undefined);
          setConfirming(true);
        }}
      />
      <SuccessText testID="settings-reset-done" text={done ? t('settings.reset.done') : undefined} />
      {/* BR-11: restoring defaults needs an explicit confirmation; Cancel calls nothing. */}
      <ConfirmDialog
        testID="settings-reset-dialog"
        visible={confirming}
        title={t('settings.reset.confirmTitle')}
        message={t('settings.reset.confirmMessage')}
        confirmLabel={t('settings.reset.confirm')}
        destructive={false}
        busy={busy}
        error={error}
        onConfirm={() => void onConfirm()}
        onCancel={() => setConfirming(false)}
      />
    </SettingsSection>
  );
}
