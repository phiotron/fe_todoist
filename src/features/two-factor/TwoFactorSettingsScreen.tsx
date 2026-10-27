import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { describeError } from '../../api/describeError';
import { ApiError } from '../../api/errors';
import { twoFactorApi, type TwoFactorSetupResponse } from '../../api/twoFactor';
import { AppButton } from '../../components/AppButton';
import { ErrorText } from '../../components/ErrorText';
import { QueryStateView } from '../../components/QueryStateView';
import { TextField } from '../../components/TextField';
import { SettingsPage } from '../settings/SettingsPage';
import { SettingsSection, useSettingsStyles } from '../settings/ui';
import { DisableTwoFactor } from './DisableTwoFactor';
import { RecoveryCodesPanel } from './RecoveryCodesPanel';
import { SetupPanel } from './SetupPanel';
import { twoFactorQueryKey, useTwoFactorStatus } from './useTwoFactorStatus';

/** Settings › Two-factor authentication (spec 5.9 / 12.1). Secrets and codes live in this component's state only. */
export function TwoFactorSettingsScreen() {
  const { t } = useTranslation();
  const styles = useSettingsStyles();
  const queryClient = useQueryClient();
  const status = useTwoFactorStatus();
  const [setup, setSetup] = useState<TwoFactorSetupResponse | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [regenCode, setRegenCode] = useState('');
  const [regenError, setRegenError] = useState<string>();
  const [regenBusy, setRegenBusy] = useState(false);
  const inFlight = useRef(false);

  const refreshStatus = () => queryClient.invalidateQueries({ queryKey: twoFactorQueryKey });

  async function onStart() {
    if (inFlight.current) return;
    inFlight.current = true;
    setStarting(true);
    setError(undefined);
    setNotice(undefined);
    try {
      setSetup(await twoFactorApi.setup());
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409 && caught.code === 'two-factor-already-enabled') {
        setNotice(t('twoFactor.settings.alreadyEnabled'));
        await refreshStatus();
      } else {
        setError(describeError(caught).message);
      }
    } finally {
      setStarting(false);
      inFlight.current = false;
    }
  }

  async function onRegenerate() {
    if (inFlight.current) return;
    inFlight.current = true;
    const value = regenCode.replace(/\s/g, '');
    if (!/^\d{6}$/.test(value)) {
      setRegenError(t('twoFactor.login.codeFormat'));
      inFlight.current = false;
      return;
    }
    setRegenError(undefined);
    setRegenBusy(true);
    try {
      const response = await twoFactorApi.regenerateRecoveryCodes({ code: value });
      setCodes(response.recoveryCodes);
      setRegenCode('');
      await refreshStatus();
    } catch (caught) {
      setRegenError(
        caught instanceof ApiError && caught.status === 400 ? t('twoFactor.settings.wrongCode') : describeError(caught).message,
      );
    } finally {
      setRegenBusy(false);
      inFlight.current = false;
    }
  }

  const enabled = status.data?.enabled === true;
  return (
    <SettingsPage testID="two-factor-settings-screen" title={t('twoFactor.settings.title')}>
      {codes ? (
        <SettingsSection testID="settings-section-recoveryCodes">
          <RecoveryCodesPanel codes={codes} onDone={() => setCodes(null)} />
        </SettingsSection>
      ) : setup ? (
        <SettingsSection testID="settings-section-twoFactorSetup">
          <SetupPanel
            setup={setup}
            onCancel={() => setSetup(null)}
            onEnabled={(recoveryCodes) => {
              setSetup(null);
              setCodes(recoveryCodes);
              void refreshStatus();
            }}
            onExpired={() => {
              setSetup(null);
              setNotice(t('twoFactor.settings.notSetup'));
            }}
          />
        </SettingsSection>
      ) : status.data ? (
        <SettingsSection testID="settings-section-twoFactorStatus">
          <Text testID="two-factor-status" style={styles.body}>
            {enabled
              ? t('twoFactor.settings.statusOn', { count: status.data.recoveryCodesLeft })
              : t('twoFactor.settings.statusOff')}
          </Text>
          {notice ? (
            <Text testID="two-factor-notice" accessibilityLiveRegion="polite" style={styles.success}>
              {notice}
            </Text>
          ) : null}
          <ErrorText testID="two-factor-error" message={error} />
          {enabled ? (
            <View>
              <Text style={styles.hint}>{t('twoFactor.settings.regenerateHint')}</Text>
              <TextField
                testID="two-factor-regen-code"
                label={t('twoFactor.settings.code')}
                value={regenCode}
                onChangeText={setRegenCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={7}
              />
              <ErrorText testID="two-factor-regen-error" message={regenError} />
              <AppButton
                testID="two-factor-regen-submit"
                variant="outline"
                full
                label={t('twoFactor.settings.regenerateSubmit')}
                busy={regenBusy}
                requiresOnline
                onPress={() => void onRegenerate()}
              />
              <View style={{ height: 12 }} />
              <DisableTwoFactor onDisabled={() => setNotice(t('twoFactor.settings.disabled'))} />
            </View>
          ) : (
            <AppButton
              testID="two-factor-enable"
              full
              label={t('twoFactor.settings.enable')}
              busy={starting}
              requiresOnline
              onPress={() => void onStart()}
            />
          )}
        </SettingsSection>
      ) : (
        <QueryStateView query={status} testID="two-factor-state" />
      )}
    </SettingsPage>
  );
}
