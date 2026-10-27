import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import { accountApi } from '../../api/account';
import { describeError } from '../../api/describeError';
import { ApiError } from '../../api/errors';
import { AppButton } from '../../components/AppButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { TextField } from '../../components/TextField';
import i18n from '../../i18n';
import { useTheme } from '../../theme';
import { useSession } from '../auth/session';
import { useTwoFactorStatus } from '../two-factor/useTwoFactorStatus';
import { SettingsSection, useSettingsStyles } from './ui';

/** Message of a failed DELETE me: wrong password / code (400), no password yet (409 password-required), the rest shared. */
export function describeDeleteError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409 && error.code === 'password-required') return i18n.t('settings.deleteAccount.passwordRequired');
    if (error.status === 400) return i18n.t('settings.deleteAccount.wrongCredentials');
  }
  return describeError(error).message;
}

/** Delete account (spec 5.9, BR-11): a confirmation that says "cannot be undone" plus the current password (+ 2FA code). */
export function DeleteAccountSection() {
  const { t } = useTranslation();
  const styles = useSettingsStyles();
  const { palette } = useTheme();
  const { endLocalSession } = useSession();
  const twoFactor = useTwoFactorStatus();
  const needsCode = twoFactor.data?.enabled === true;
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const inFlight = useRef(false);

  function openDialog() {
    setPassword('');
    setCode('');
    setError(undefined);
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setPassword('');
    setCode('');
    setError(undefined);
  }

  async function onConfirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    if (!password) {
      setError(t('auth.validation.passwordRequired'));
      inFlight.current = false;
      return;
    }
    if (needsCode && !code.trim()) {
      setError(t('settings.deleteAccount.codeRequired'));
      inFlight.current = false;
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await accountApi.deleteAccount(needsCode ? { password, code: code.trim() } : { password });
      // The account and every session are gone server side: only this device is left to clear.
      await endLocalSession();
    } catch (caught) {
      setError(describeDeleteError(caught));
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <SettingsSection testID="settings-section-deleteAccount" title={t('settings.deleteAccount.title')}>
      <Text style={styles.hint}>{t('settings.deleteAccount.description')}</Text>
      <AppButton
        testID="delete-account-open"
        variant="outline"
        color={palette.warn}
        full
        label={t('settings.deleteAccount.button')}
        requiresOnline
        onPress={openDialog}
      />
      <ConfirmDialog
        testID="delete-account-dialog"
        visible={open}
        title={t('settings.deleteAccount.confirmTitle')}
        message={t('settings.deleteAccount.confirmMessage')}
        confirmLabel={t('settings.deleteAccount.confirm')}
        busy={busy}
        error={error}
        onConfirm={() => void onConfirm()}
        onCancel={closeDialog}
      >
        <TextField
          testID="delete-account-password"
          label={t('settings.deleteAccount.password')}
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoComplete="current-password"
          autoCorrect={false}
          secureTextEntry
        />
        {needsCode ? (
          <TextField
            testID="delete-account-code"
            label={t('settings.deleteAccount.code')}
            value={code}
            onChangeText={setCode}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
          />
        ) : null}
      </ConfirmDialog>
    </SettingsSection>
  );
}
