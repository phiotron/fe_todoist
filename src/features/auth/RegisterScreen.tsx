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
import { GoogleSignInButton, OrDivider } from './GoogleSignInButton';
import { goHomeAfterAuth, goToTwoFactor } from './LoginScreen';
import { useSession } from './session';
import { useAuthStyles } from './styles';
import { hasErrors, validateRegister, type RegisterValues } from './validation';

export function RegisterScreen() {
  const { t } = useTranslation();
  const styles = useAuthStyles();
  const { palette } = useTheme();
  const { signUp } = useSession();
  const isOnline = useIsOnline();
  const [values, setValues] = useState<RegisterValues>({ displayName: '', email: '', password: '' });
  const [errors, setErrors] = useState<AuthErrorView>({ fields: {} });
  const [submitting, setSubmitting] = useState(false);
  // Synchronous lock: state updates are async, so two quick presses could both pass a state check.
  const inFlight = useRef(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const emailRef = useRef<TextInputHandle>(null);
  const passwordRef = useRef<TextInputHandle>(null);

  async function onSubmit() {
    if (inFlight.current) return;
    inFlight.current = true;
    const fieldErrors = validateRegister(values);
    if (hasErrors(fieldErrors)) {
      setErrors({ fields: fieldErrors });
      inFlight.current = false;
      return;
    }
    setErrors({ fields: {} });
    setSubmitting(true);
    try {
      await signUp({
        email: values.email.trim(),
        password: values.password,
        displayName: values.displayName.trim(),
      });
      // On success keep the lock and the busy state until navigation unmounts this screen.
      goHomeAfterAuth();
    } catch (error) {
      setErrors(describeAuthError(error, 'register', isOnline));
      setSubmitting(false);
      inFlight.current = false;
    }
  }

  function goToLogin() {
    // Register is pushed on top of login: going back avoids a [login, login] stack.
    if (router.canGoBack()) router.back();
    else router.replace('/login');
  }

  return (
    <KeyboardScreen contentStyle={styles.screen}>
      <AuthLogo />
      <Text style={styles.title}>{t('auth.register.title')}</Text>
      {/* The design also draws Apple / Microsoft here; only Google exists in M5 (Apple is M13). */}
      <GoogleSignInButton
        testID="register-google"
        disabled={submitting}
        onBusyChange={setGoogleBusy}
        onSignedIn={goHomeAfterAuth}
        onLinkRequired={goToLogin}
        onTwoFactorRequired={goToTwoFactor}
      />
      <OrDivider />
      <AuthTextField
        testID="register-displayName"
        label={t('auth.fields.displayName')}
        value={values.displayName}
        onChangeText={(displayName) => setValues((current) => ({ ...current, displayName }))}
        autoComplete="name"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailRef.current?.focus()}
        error={errors.fields.displayName}
      />
      <AuthTextField
        ref={emailRef}
        testID="register-email"
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
        testID="register-password"
        label={t('auth.fields.password')}
        value={values.password}
        onChangeText={(password) => setValues((current) => ({ ...current, password }))}
        autoCapitalize="none"
        autoComplete="new-password"
        autoCorrect={false}
        secureTextEntry
        returnKeyType="go"
        onSubmitEditing={() => void onSubmit()}
        error={errors.fields.password}
      />
      {errors.form ? (
        <Text
          testID="register-form-error"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.formError}
        >
          {errors.form}
        </Text>
      ) : null}
      <Pressable
        testID="register-submit"
        accessibilityRole="button"
        accessibilityLabel={t('auth.register.submit')}
        accessibilityState={{ busy: submitting, disabled: submitting || googleBusy }}
        disabled={submitting || googleBusy}
        onPress={onSubmit}
        style={[styles.button, submitting && styles.buttonDisabled]}
      >
        {submitting ? (
          <ActivityIndicator color={palette.onacc} />
        ) : (
          <Text style={styles.buttonText}>{t('auth.register.submit')}</Text>
        )}
      </Pressable>
      <Pressable testID="register-go-login" accessibilityRole="link" disabled={submitting} onPress={goToLogin}>
        <Text style={styles.link}>{t('auth.register.goToLogin')}</Text>
      </Pressable>
    </KeyboardScreen>
  );
}
