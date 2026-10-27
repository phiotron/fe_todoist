import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { describeError } from '../../api/describeError';
import { ApiError } from '../../api/errors';
import { passwordResetApi } from '../../api/passwordReset';
import { KeyboardScreen } from '../../components/KeyboardScreen';
import { useTheme } from '../../theme';
import { AuthLogo } from './AuthLogo';
import { AuthTextField } from './AuthTextField';
import { useAuthStyles } from './styles';
import { newPasswordError } from './validation';

interface ResetErrors {
  form?: string;
  code?: string;
  newPassword?: string;
}

/** initialCode: the token from a taskly://reset-password/<token> link (development build opens it directly). */
export function ResetPasswordScreen({ initialCode = '' }: { initialCode?: string }) {
  const { t } = useTranslation();
  const styles = useAuthStyles();
  const { palette } = useTheme();
  const [values, setValues] = useState({ code: initialCode, newPassword: '' });
  const [errors, setErrors] = useState<ResetErrors>({});
  const [expired, setExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const inFlight = useRef(false);

  async function onSubmit() {
    if (inFlight.current) return;
    inFlight.current = true;
    const fieldErrors: ResetErrors = {};
    if (!values.code.trim()) fieldErrors.code = t('passwordReset.reset.codeRequired');
    const passwordMessage = newPasswordError(values.newPassword);
    if (passwordMessage) fieldErrors.newPassword = passwordMessage;
    if (fieldErrors.code || fieldErrors.newPassword) {
      setErrors(fieldErrors);
      inFlight.current = false;
      return;
    }
    setErrors({});
    setExpired(false);
    setSubmitting(true);
    try {
      await passwordResetApi.confirm({ token: values.code.trim(), newPassword: values.newPassword });
      // Spec 12.1: a successful reset does not sign the user in.
      setDone(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setErrors({ code: t('passwordReset.reset.codeInvalid') });
      } else if (error instanceof ApiError && error.status === 410) {
        setExpired(true);
        setErrors({ form: t('passwordReset.reset.codeExpired') });
      } else {
        const view = describeError(error);
        // The API calls the pasted code "token".
        const code = view.fields.token;
        const newPassword = view.fields.newPassword;
        setErrors(code || newPassword ? { code, newPassword } : { form: view.message });
      }
    } finally {
      setSubmitting(false);
      inFlight.current = false;
    }
  }

  if (done) {
    return (
      <KeyboardScreen contentStyle={styles.screen}>
        <AuthLogo />
        <Text accessibilityRole="header" style={styles.title}>
          {t('passwordReset.reset.title')}
        </Text>
        <Text testID="reset-success" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.successText}>
          {t('passwordReset.reset.success')}
        </Text>
        <Pressable
          testID="reset-go-login"
          accessibilityRole="button"
          accessibilityLabel={t('passwordReset.reset.goToLogin')}
          onPress={() => router.dismissTo('/login')}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{t('passwordReset.reset.goToLogin')}</Text>
        </Pressable>
      </KeyboardScreen>
    );
  }

  return (
    <KeyboardScreen contentStyle={styles.screen}>
      <AuthLogo />
      <Text accessibilityRole="header" style={styles.title}>
        {t('passwordReset.reset.title')}
      </Text>
      <Text style={styles.intro}>{t('passwordReset.reset.intro')}</Text>
      <AuthTextField
        testID="reset-code"
        label={t('passwordReset.reset.code')}
        value={values.code}
        onChangeText={(code) => setValues((current) => ({ ...current, code }))}
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.code}
      />
      <AuthTextField
        testID="reset-newPassword"
        label={t('passwordReset.reset.newPassword')}
        value={values.newPassword}
        onChangeText={(newPassword) => setValues((current) => ({ ...current, newPassword }))}
        autoCapitalize="none"
        autoComplete="new-password"
        autoCorrect={false}
        secureTextEntry
        returnKeyType="go"
        onSubmitEditing={() => void onSubmit()}
        error={errors.newPassword}
      />
      {errors.form ? (
        <Text testID="reset-form-error" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.formError}>
          {errors.form}
        </Text>
      ) : null}
      {expired ? (
        <Pressable
          testID="reset-request-new"
          accessibilityRole="link"
          onPress={() => router.dismissTo('/forgot-password')}
        >
          <Text style={styles.ghostLink}>{t('passwordReset.reset.requestNewCode')}</Text>
        </Pressable>
      ) : null}
      <Pressable
        testID="reset-submit"
        accessibilityRole="button"
        accessibilityLabel={t('passwordReset.reset.submit')}
        accessibilityState={{ busy: submitting, disabled: submitting }}
        disabled={submitting}
        onPress={onSubmit}
        style={[styles.button, submitting && styles.buttonDisabled]}
      >
        {submitting ? (
          <ActivityIndicator color={palette.onacc} />
        ) : (
          <Text style={styles.buttonText}>{t('passwordReset.reset.submit')}</Text>
        )}
      </Pressable>
    </KeyboardScreen>
  );
}
