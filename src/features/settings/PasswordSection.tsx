import { useRef, useState } from 'react';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { accountApi } from '../../api/account';
import { apiFetch } from '../../api/client';
import { describeError } from '../../api/describeError';
import { ApiError } from '../../api/errors';
import { AppButton } from '../../components/AppButton';
import { ErrorText } from '../../components/ErrorText';
import { TextField } from '../../components/TextField';
import { tokenStore } from '../../lib/tokenStore';
import { useMe } from '../auth/session';
import { newPasswordError } from '../auth/validation';
import { googleLinkState } from './googleLinkState';
import { SettingsSection, SuccessText, useSettingsStyles } from './ui';

interface PasswordErrors {
  form?: string;
  currentPassword?: string;
  newPassword?: string;
}

const EMPTY = { currentPassword: '', newPassword: '' };

export function PasswordSection() {
  const { t } = useTranslation();
  const styles = useSettingsStyles();
  const me = useMe();
  // Spec 12.1: me/password needs the current password; a Google-only account sets one through "Forgot your password?".
  const hasPassword = me.data ? googleLinkState(me.data).hasPassword : true;
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const inFlight = useRef(false);

  async function onSubmit() {
    if (inFlight.current) return;
    inFlight.current = true;
    setDone(false);
    const fieldErrors: PasswordErrors = {};
    if (!values.currentPassword) fieldErrors.currentPassword = t('auth.validation.passwordRequired');
    const newMessage = newPasswordError(values.newPassword);
    if (newMessage) fieldErrors.newPassword = newMessage;
    if (fieldErrors.currentPassword || fieldErrors.newPassword) {
      setErrors(fieldErrors);
      inFlight.current = false;
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const pair = await accountApi.changePassword(values);
      // Every refresh token was revoked: drop refreshes still running with the old one (M1 epoch), then keep
      // this device signed in with the new pair.
      await apiFetch.resetSession();
      await tokenStore.setTokens({ accessToken: pair.accessToken, refreshToken: pair.refreshToken });
      setValues(EMPTY);
      setDone(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 400 && !error.errors?.length) {
        // Spec 12.8: a wrong current password is a 400 with only a detail (on purpose not 401).
        setErrors({ currentPassword: t('settings.password.wrongCurrent') });
      } else {
        const view = describeError(error);
        const { currentPassword, newPassword } = view.fields;
        setErrors(currentPassword || newPassword ? { currentPassword, newPassword } : { form: view.message });
      }
    } finally {
      setSubmitting(false);
      inFlight.current = false;
    }
  }

  return (
    <SettingsSection testID="settings-section-password" title={t('settings.password.title')}>
      {hasPassword ? (
        <>
          <TextField
            testID="password-current"
            label={t('settings.password.current')}
            value={values.currentPassword}
            onChangeText={(currentPassword) => setValues((current) => ({ ...current, currentPassword }))}
            autoCapitalize="none"
            autoComplete="current-password"
            autoCorrect={false}
            secureTextEntry
            error={errors.currentPassword}
          />
          <TextField
            testID="password-new"
            label={t('settings.password.new')}
            value={values.newPassword}
            onChangeText={(newPassword) => setValues((current) => ({ ...current, newPassword }))}
            autoCapitalize="none"
            autoComplete="new-password"
            autoCorrect={false}
            secureTextEntry
            error={errors.newPassword}
          />
          <ErrorText testID="password-error" message={errors.form} />
          <SuccessText testID="password-success" text={done ? t('settings.password.success') : undefined} />
          <AppButton
            testID="password-submit"
            label={t('settings.password.submit')}
            busy={submitting}
            requiresOnline
            onPress={() => void onSubmit()}
          />
        </>
      ) : (
        <Text testID="password-need-reset" style={styles.hint}>
          {t('google.account.passwordNeedsReset')}
        </Text>
      )}
    </SettingsSection>
  );
}
