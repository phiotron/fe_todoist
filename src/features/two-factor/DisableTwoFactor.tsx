import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeError } from '../../api/describeError';
import { ApiError } from '../../api/errors';
import { twoFactorApi } from '../../api/twoFactor';
import { AppButton } from '../../components/AppButton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { TextField } from '../../components/TextField';
import { useTheme } from '../../theme';
import { useMe } from '../auth/session';
import { googleLinkState } from '../settings/googleLinkState';
import { twoFactorQueryKey } from './useTwoFactorStatus';

/** Turn two-factor off (BR-11): a confirmation plus the password and a current code (spec 12.1 `me/2fa/disable`). */
export function DisableTwoFactor({ onDisabled }: { onDisabled: () => void }) {
  const { t } = useTranslation();
  const { palette } = useTheme();
  const queryClient = useQueryClient();
  const me = useMe();
  // Spec 12.1: me/2fa/disable needs the password only when the account has one (a Google-only account sends just the code).
  const hasPassword = me.data ? googleLinkState(me.data).hasPassword : true;
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const inFlight = useRef(false);

  function close() {
    setOpen(false);
    setPassword('');
    setCode('');
    setError(undefined);
  }

  async function onConfirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    if (hasPassword && !password) {
      setError(t('auth.validation.passwordRequired'));
      inFlight.current = false;
      return;
    }
    if (!code.trim()) {
      setError(t('twoFactor.settings.codeRequired'));
      inFlight.current = false;
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await twoFactorApi.disable(hasPassword ? { password, code: code.trim() } : { code: code.trim() });
      await queryClient.invalidateQueries({ queryKey: twoFactorQueryKey });
      close();
      onDisabled();
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 400 ? t('twoFactor.settings.wrongCredentials') : describeError(caught).message,
      );
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <>
      <AppButton
        testID="two-factor-disable-open"
        variant="outline"
        color={palette.warn}
        full
        label={t('twoFactor.settings.disable')}
        requiresOnline
        onPress={() => setOpen(true)}
      />
      <ConfirmDialog
        testID="two-factor-disable-dialog"
        visible={open}
        title={t('twoFactor.settings.disableTitle')}
        message={t('twoFactor.settings.disableMessage')}
        confirmLabel={t('twoFactor.settings.disableConfirm')}
        busy={busy}
        error={error}
        onConfirm={() => void onConfirm()}
        onCancel={close}
      >
        {hasPassword ? (
          <TextField
            testID="two-factor-disable-password"
            label={t('twoFactor.settings.password')}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoComplete="current-password"
            autoCorrect={false}
            secureTextEntry
          />
        ) : null}
        <TextField
          testID="two-factor-disable-code"
          label={t('twoFactor.settings.code')}
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
        />
      </ConfirmDialog>
    </>
  );
}
