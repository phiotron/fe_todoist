import * as Clipboard from 'expo-clipboard';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Text, View } from 'react-native';
import { describeError } from '../../api/describeError';
import { ApiError } from '../../api/errors';
import { twoFactorApi, type TwoFactorSetupResponse } from '../../api/twoFactor';
import { AppButton } from '../../components/AppButton';
import { ErrorText } from '../../components/ErrorText';
import { TextField } from '../../components/TextField';
import { useSettingsStyles } from '../settings/ui';
import { OtpQrCode } from './OtpQrCode';

interface SetupPanelProps {
  setup: TwoFactorSetupResponse;
  /** The server accepted the code: these are the 10 recovery codes (shown once). */
  onEnabled: (recoveryCodes: string[]) => void;
  onCancel: () => void;
  /** The pending secret is gone server side (409 two-factor-not-setup). */
  onExpired: () => void;
}

/** Steps 1 and 2 of turning two-factor on: add the secret to an authenticator app, then confirm with its 6-digit code. */
export function SetupPanel({ setup, onEnabled, onCancel, onExpired }: SetupPanelProps) {
  const { t } = useTranslation();
  const styles = useSettingsStyles();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  async function onCopy() {
    await Clipboard.setStringAsync(setup.secret);
    setCopied(true);
  }

  async function onConfirm() {
    if (inFlight.current) return;
    inFlight.current = true;
    const value = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(value)) {
      setError(t('twoFactor.login.codeFormat'));
      inFlight.current = false;
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      const response = await twoFactorApi.enable({ code: value });
      onEnabled(response.recoveryCodes);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409 && caught.code === 'two-factor-not-setup') {
        onExpired();
      } else if (caught instanceof ApiError && caught.status === 400) {
        setError(t('twoFactor.settings.wrongCode'));
      } else {
        setError(describeError(caught).message);
      }
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <View>
      <Text accessibilityRole="header" style={styles.body}>
        {t('twoFactor.settings.scanTitle')}
      </Text>
      <Text style={styles.hint}>{t('twoFactor.settings.scanHint')}</Text>
      <OtpQrCode value={setup.otpauthUri} />
      <Text style={styles.hint}>{t('twoFactor.settings.secret')}</Text>
      <Text testID="two-factor-secret" selectable style={styles.body}>
        {setup.secret}
      </Text>
      <View style={styles.actions}>
        <AppButton testID="two-factor-copy-secret" variant="outline" size="sm" label={t('twoFactor.settings.copySecret')} onPress={() => void onCopy()} />
        <AppButton
          testID="two-factor-open-app"
          variant="ghost"
          size="sm"
          label={t('twoFactor.settings.openApp')}
          onPress={() => void Linking.openURL(setup.otpauthUri).catch(() => undefined)}
        />
      </View>
      {copied ? (
        <Text accessibilityLiveRegion="polite" style={styles.success}>
          {t('twoFactor.settings.copied')}
        </Text>
      ) : null}
      <Text accessibilityRole="header" style={[styles.body, { marginTop: 16 }]}>
        {t('twoFactor.settings.confirmTitle')}
      </Text>
      <TextField
        testID="two-factor-setup-code"
        label={t('twoFactor.settings.code')}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        maxLength={7}
      />
      <ErrorText testID="two-factor-setup-error" message={error} />
      <View style={styles.actions}>
        <AppButton testID="two-factor-setup-confirm" label={t('twoFactor.settings.confirm')} busy={busy} requiresOnline onPress={() => void onConfirm()} />
        <AppButton testID="two-factor-setup-cancel" variant="ghost" label={t('twoFactor.settings.cancel')} disabled={busy} onPress={onCancel} />
      </View>
    </View>
  );
}
