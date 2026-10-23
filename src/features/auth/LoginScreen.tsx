import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { colors } from '../../lib/theme';
import { useIsOnline } from '../../lib/useIsOnline';
import { AuthTextField } from './AuthTextField';
import { describeAuthError, type AuthErrorView } from './authErrors';
import { useSession } from './session';
import { authStyles as styles } from './styles';
import { hasErrors, validateLogin, type LoginValues } from './validation';

export function LoginScreen() {
  const { t } = useTranslation();
  const { signIn, expired } = useSession();
  const isOnline = useIsOnline();
  const [values, setValues] = useState<LoginValues>({ email: '', password: '' });
  const [errors, setErrors] = useState<AuthErrorView>({ fields: {} });
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    const fieldErrors = validateLogin(values);
    if (hasErrors(fieldErrors)) {
      setErrors({ fields: fieldErrors });
      return;
    }
    setErrors({ fields: {} });
    setSubmitting(true);
    try {
      await signIn({ email: values.email.trim(), password: values.password });
      router.replace('/');
    } catch (error) {
      setErrors(describeAuthError(error, 'login', isOnline));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{t('auth.login.title')}</Text>
      {expired ? <Text style={styles.notice}>{t('auth.errors.sessionExpired')}</Text> : null}
      <AuthTextField
        testID="login-email"
        label={t('auth.fields.email')}
        value={values.email}
        onChangeText={(email) => setValues((current) => ({ ...current, email }))}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        error={errors.fields.email}
      />
      <AuthTextField
        testID="login-password"
        label={t('auth.fields.password')}
        value={values.password}
        onChangeText={(password) => setValues((current) => ({ ...current, password }))}
        autoCapitalize="none"
        autoComplete="password"
        secureTextEntry
        error={errors.fields.password}
      />
      {errors.form ? (
        <Text testID="login-form-error" style={styles.formError}>
          {errors.form}
        </Text>
      ) : null}
      <Pressable
        testID="login-submit"
        accessibilityRole="button"
        disabled={submitting}
        onPress={onSubmit}
        style={[styles.button, submitting && styles.buttonDisabled]}
      >
        {submitting ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.buttonText}>{t('auth.login.submit')}</Text>
        )}
      </Pressable>
      <Pressable testID="login-go-register" accessibilityRole="link" onPress={() => router.push('/register')}>
        <Text style={styles.link}>{t('auth.login.goToRegister')}</Text>
      </Pressable>
    </View>
  );
}
