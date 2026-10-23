import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { colors } from '../../lib/theme';
import { useIsOnline } from '../../lib/useIsOnline';
import { AuthTextField } from './AuthTextField';
import { describeAuthError, type AuthErrorView } from './authErrors';
import { useSession } from './session';
import { authStyles as styles } from './styles';
import { hasErrors, validateRegister, type RegisterValues } from './validation';

export function RegisterScreen() {
  const { t } = useTranslation();
  const { signUp } = useSession();
  const isOnline = useIsOnline();
  const [values, setValues] = useState<RegisterValues>({ displayName: '', email: '', password: '' });
  const [errors, setErrors] = useState<AuthErrorView>({ fields: {} });
  const [submitting, setSubmitting] = useState(false);
  // Synchronous lock: state updates are async, so two quick presses could both pass a state check.
  const inFlight = useRef(false);

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
      // On success keep the lock and the busy state until router.replace unmounts this screen.
      router.replace('/');
    } catch (error) {
      setErrors(describeAuthError(error, 'register', isOnline));
      setSubmitting(false);
      inFlight.current = false;
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{t('auth.register.title')}</Text>
      <AuthTextField
        testID="register-displayName"
        label={t('auth.fields.displayName')}
        value={values.displayName}
        onChangeText={(displayName) => setValues((current) => ({ ...current, displayName }))}
        autoComplete="name"
        error={errors.fields.displayName}
      />
      <AuthTextField
        testID="register-email"
        label={t('auth.fields.email')}
        value={values.email}
        onChangeText={(email) => setValues((current) => ({ ...current, email }))}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        error={errors.fields.email}
      />
      <AuthTextField
        testID="register-password"
        label={t('auth.fields.password')}
        value={values.password}
        onChangeText={(password) => setValues((current) => ({ ...current, password }))}
        autoCapitalize="none"
        autoComplete="new-password"
        secureTextEntry
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
        accessibilityState={{ busy: submitting, disabled: submitting }}
        disabled={submitting}
        onPress={onSubmit}
        style={[styles.button, submitting && styles.buttonDisabled]}
      >
        {submitting ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.buttonText}>{t('auth.register.submit')}</Text>
        )}
      </Pressable>
      <Pressable testID="register-go-login" accessibilityRole="link" onPress={() => router.replace('/login')}>
        <Text style={styles.link}>{t('auth.register.goToLogin')}</Text>
      </Pressable>
    </View>
  );
}
