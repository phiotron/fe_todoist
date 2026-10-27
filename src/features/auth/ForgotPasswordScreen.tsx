import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { describeError } from '../../api/describeError';
import { ApiError } from '../../api/errors';
import { passwordResetApi } from '../../api/passwordReset';
import { KeyboardScreen } from '../../components/KeyboardScreen';
import { useTheme } from '../../theme';
import { AuthLogo } from './AuthLogo';
import { AuthTextField } from './AuthTextField';
import { useAuthStyles } from './styles';
import { emailError } from './validation';

interface ForgotErrors {
  form?: string;
  email?: string;
}

/** "Forgot your password?" and "Check your email" states of the approved M-Auth frame. */
export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const styles = useAuthStyles();
  const { palette } = useTheme();
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<ForgotErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  // Synchronous lock: state updates are async, so two quick presses could both pass a state check.
  const inFlight = useRef(false);

  async function onSubmit() {
    if (inFlight.current) return;
    inFlight.current = true;
    const message = emailError(email);
    if (message) {
      setErrors({ email: message });
      inFlight.current = false;
      return;
    }
    setErrors({});
    setSubmitting(true);
    const address = email.trim();
    try {
      await passwordResetApi.request({ email: address });
      // Same neutral state whether or not the account exists (spec 12.1).
      setSentTo(address);
    } catch (error) {
      if (error instanceof ApiError && error.status === 503) {
        setErrors({ form: t('passwordReset.forgot.mailUnavailable') });
      } else {
        const view = describeError(error);
        setErrors(view.fields.email ? { email: view.fields.email } : { form: view.message });
      }
    } finally {
      setSubmitting(false);
      inFlight.current = false;
    }
  }

  if (sentTo !== null) {
    return (
      <KeyboardScreen contentStyle={styles.screen}>
        <AuthLogo />
        <View style={styles.mailIcon}>
          <Feather name="mail" size={24} color={palette.acc2} />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {t('passwordReset.forgot.sentTitle')}
        </Text>
        <Text testID="forgot-sent" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.successText}>
          {t('passwordReset.forgot.sent', { email: sentTo })}
        </Text>
        <Pressable
          testID="forgot-have-code"
          accessibilityRole="button"
          accessibilityLabel={t('passwordReset.forgot.haveCode')}
          onPress={() => router.push('/reset-password')}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{t('passwordReset.forgot.haveCode')}</Text>
        </Pressable>
        <Pressable
          testID="forgot-back-login"
          accessibilityRole="button"
          accessibilityLabel={t('passwordReset.forgot.backToLogin')}
          onPress={() => router.back()}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>{t('passwordReset.forgot.backToLogin')}</Text>
        </Pressable>
        <Pressable
          testID="forgot-resend"
          accessibilityRole="link"
          accessibilityLabel={t('passwordReset.forgot.resend')}
          accessibilityState={{ busy: submitting, disabled: submitting }}
          disabled={submitting}
          onPress={onSubmit}
          style={{ marginTop: 16 }}
        >
          <Text style={styles.muted}>
            {t('passwordReset.forgot.notReceived')} <Text style={styles.link}>{t('passwordReset.forgot.resend')}</Text>
          </Text>
        </Pressable>
      </KeyboardScreen>
    );
  }

  return (
    <KeyboardScreen contentStyle={styles.screen}>
      <AuthLogo />
      <Pressable
        testID="forgot-back"
        accessibilityRole="button"
        accessibilityLabel={t('passwordReset.forgot.back')}
        onPress={() => router.back()}
        style={styles.backRow}
      >
        <Feather name="chevron-left" size={20} color={palette.ink2} />
        <Text style={styles.secondaryButtonText}>{t('passwordReset.forgot.back')}</Text>
      </Pressable>
      <Text accessibilityRole="header" style={[styles.title, { marginBottom: 8 }]}>
        {t('passwordReset.forgot.title')}
      </Text>
      <Text style={styles.intro}>{t('passwordReset.forgot.intro')}</Text>
      <AuthTextField
        testID="forgot-email"
        label={t('auth.fields.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        returnKeyType="send"
        onSubmitEditing={() => void onSubmit()}
        error={errors.email}
      />
      {errors.form ? (
        <Text testID="forgot-form-error" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.formError}>
          {errors.form}
        </Text>
      ) : null}
      <Pressable
        testID="forgot-submit"
        accessibilityRole="button"
        accessibilityLabel={t('passwordReset.forgot.submit')}
        accessibilityState={{ busy: submitting, disabled: submitting }}
        disabled={submitting}
        onPress={onSubmit}
        style={[styles.button, submitting && styles.buttonDisabled]}
      >
        {submitting ? (
          <ActivityIndicator color={palette.onacc} />
        ) : (
          <Text style={styles.buttonText}>{t('passwordReset.forgot.submit')}</Text>
        )}
      </Pressable>
    </KeyboardScreen>
  );
}
