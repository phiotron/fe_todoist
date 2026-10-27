import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { accountApi } from '../../api/account';
import { describeError } from '../../api/describeError';
import { AppButton } from '../../components/AppButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useSession } from '../auth/session';
import { SettingsSection, useSettingsStyles } from './ui';

/** "Log out of all devices": ends every session, this one included (spec 12.1 `me/logout-all`). */
export function LogoutAllSection() {
  const { t } = useTranslation();
  const styles = useSettingsStyles();
  const { endLocalSession } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const inFlight = useRef(false);

  async function onConfirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await accountApi.logoutAll();
      // Every refresh token is revoked server side: just clear this device, calling auth/logout would only 401.
      await endLocalSession();
    } catch (caught) {
      setError(describeError(caught).message);
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <SettingsSection testID="settings-section-logoutAll" title={t('settings.logoutAll.title')}>
      <Text style={styles.hint}>{t('settings.logoutAll.description')}</Text>
      <AppButton
        testID="logout-all-open"
        variant="outline"
        full
        label={t('settings.logoutAll.button')}
        requiresOnline
        onPress={() => {
          setError(undefined);
          setConfirming(true);
        }}
      />
      <ConfirmDialog
        testID="logout-all-dialog"
        visible={confirming}
        title={t('settings.logoutAll.confirmTitle')}
        message={t('settings.logoutAll.confirmMessage')}
        confirmLabel={t('settings.logoutAll.confirm')}
        destructive={false}
        busy={busy}
        error={error}
        onConfirm={() => void onConfirm()}
        onCancel={() => setConfirming(false)}
      />
    </SettingsSection>
  );
}
