import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { KeyboardScreen } from '../../components/KeyboardScreen';
import { useTheme } from '../../theme';
import { useIsOnline } from '../../lib/useIsOnline';
import { AuthLogo } from './AuthLogo';
import { AuthTextField, type TextInputHandle } from './AuthTextField';
import { describeAuthError, type AuthErrorView } from './authErrors';
import { useSession } from './session';
import { useAuthStyles } from './styles';
import { hasErrors, validateLogin, type LoginValues } from './validation';

/** Leaves the auth screens for good: drop them from the stack so Android Back cannot return here. */
export function goHomeAfterAuth() {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/');
}

export function LoginScreen() {
  const { t } = useTranslation();
  const styles = useAuthStyles();
  const { palette } = useTheme();
  const { signIn, expired } = useSession();
  const isOnline = useIsOnline();
  const [values, setValues] = useState<LoginValues>({ email: '', password: '' });
  const [errors, setErrors] = useState<AuthErrorView>({ fields: {} });
  const [submitting, setSubmitting] = useState(false);
  // Synchronous lock: state updates are async, so two quick presses could both pass a state check.
  const inFlight = useRef(false);
  const passwordRef = useRef<TextInputHandle>(null);

  async function onSubmit() {
    if (inFlight.current) return;
    inFlight.current = true;
    const fieldErrors = validateLogin(values);
    if (hasErrors(fieldErrors)) {
      setErrors({ fields: fieldErrors });
      inFlight.current = false;
      return;
    }
    setErrors({ fields: {} });
    setSubmitting(true);
    try {
      await signIn({ email: values.email.trim(), password: values.password });
      // On success keep the lock and the busy state until navigation unmounts this screen.
      goHomeAfterAuth();
    } catch (error) {
      setErrors(describeAuthError(error, 'login', isOnline));
      setSubmitting(false);
      inFlight.current = false;
    }
  }

  return (
    <KeyboardScreen contentStyle={styles.screen}>
      <AuthLogo />
      <Text style={styles.title}>{t('auth.login.title')}</Text>
      {expired ? (
        <Text
          testID="login-expired-notice"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.notice}
        >
          {t('auth.errors.sessionExpired')}
        </Text>
      ) : null}
      <AuthTextField
        testID="login-email"
        label={t('auth.fields.email')}
        value={values.email}
        onChangeText={(email) => setValues((current) => ({ ...current, email }))}
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={errors.fields.email}
      />
      <AuthTextField
        ref={passwordRef}
        testID="login-password"
        label={t('auth.fields.password')}
        value={values.password}
        onChangeText={(password) => setValues((current) => ({ ...current, password }))}
        autoCapitalize="none"
        autoComplete="password"
        autoCorrect={false}
        secureTextEntry
        returnKeyType="go"
        onSubmitEditing={() => void onSubmit()}
        error={errors.fields.password}
      />
      {errors.form ? (
        <Text
          testID="login-form-error"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.formError}
        >
          {errors.form}
        </Text>
      ) : null}
      <Pressable
        testID="login-submit"
        accessibilityRole="button"
        accessibilityLabel={t('auth.login.submit')}
        accessibilityState={{ busy: submitting, disabled: submitting }}
        disabled={submitting}
        onPress={onSubmit}
        style={[styles.button, submitting && styles.buttonDisabled]}
      >
        {submitting ? (
          <ActivityIndicator color={palette.onacc} />
        ) : (
          <Text style={styles.buttonText}>{t('auth.login.submit')}</Text>
        )}
      </Pressable>
      <Pressable
        testID="login-go-forgot"
        accessibilityRole="link"
        disabled={submitting}
        onPress={() => router.push('/forgot-password')}
      >
        <Text style={styles.ghostLink}>{t('auth.login.forgotPassword')}</Text>
      </Pressable>
      <Pressable
        testID="login-go-register"
        accessibilityRole="link"
        disabled={submitting}
        onPress={() => router.push('/register')}
      >
        <Text style={styles.link}>{t('auth.login.goToRegister')}</Text>
      </Pressable>
    </KeyboardScreen>
  );
}
