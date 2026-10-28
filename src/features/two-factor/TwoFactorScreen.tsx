import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { describeError } from '../../api/describeError';
import { ApiError } from '../../api/errors';
import { KeyboardScreen } from '../../components/KeyboardScreen';
import { useTheme } from '../../theme';
import { AuthLogo } from '../auth/AuthLogo';
import { AuthTextField } from '../auth/AuthTextField';
import { goHomeAfterAuth } from '../auth/LoginScreen';
import { useSession } from '../auth/session';
import { useAuthStyles } from '../auth/styles';
import { useFinishGoogleLink } from '../auth/useFinishGoogleLink';
import { TwoFactorExpiredError, TwoFactorMissingError, isChallengeSpent, isCodeRejected } from './twoFactorToken';

type Mode = 'app' | 'recovery';

/** Code step of a two-factor sign-in (spec 12.1, frame M-Auth): a 6-digit app code or a one-time recovery code. */
export function TwoFactorScreen() {
  const { t } = useTranslation();
  const styles = useAuthStyles();
  const { palette } = useTheme();
  const { pendingTwoFactor, verifyTwoFactor, cancelTwoFactor } = useSession();
  const [mode, setMode] = useState<Mode>('app');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [fieldError, setFieldError] = useState<string>();
  // `expired` ends the form: 5 minutes passed, nothing is waiting, or (with `rejected`) the server answered 401
  // two-factor-token-invalid — the token is gone. The ended view is the same; `rejected` only picks its sentence.
  // A wrong code (401 two-factor-code-invalid), 400, 429 and 5xx do NOT end it. Keep the name `expired`:
  // M5 patches the `if (!submitting && (!pendingTwoFactor || expired))` line below.
  const [expired, setExpired] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Synchronous lock: state updates are async, so two quick presses could both pass a state check.
  const inFlight = useRef(false);
  const finishGoogleLink = useFinishGoogleLink();

  // `submitting` stays true from the press until this screen is unmounted: once the code is accepted the session stops
  // waiting for one (pendingTwoFactor turns false) while a pending Google link may still be sent: no "expired" flash.
  if (!submitting && (!pendingTwoFactor || expired)) {
    return (
      <KeyboardScreen contentStyle={styles.screen}>
        <AuthLogo />
        <Text accessibilityRole="header" style={styles.title}>
          {t('twoFactor.login.title')}
        </Text>
        <Text
          testID={rejected ? 'two-factor-rejected' : 'two-factor-expired'}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.formError}
        >
          {rejected ? t('twoFactor.login.rejected') : t('twoFactor.login.expired')}
        </Text>
        <Pressable
          testID="two-factor-back-login"
          accessibilityRole="button"
          accessibilityLabel={t('twoFactor.login.backToLogin')}
          onPress={() => router.replace('/login')}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{t('twoFactor.login.backToLogin')}</Text>
        </Pressable>
      </KeyboardScreen>
    );
  }

  async function onSubmit() {
    if (inFlight.current) return;
    inFlight.current = true;
    const value = mode === 'app' ? code.replace(/\s/g, '') : code.trim();
    if (!value) {
      setError(t('twoFactor.login.codeRequired'));
      inFlight.current = false;
      return;
    }
    if (mode === 'app' && !/^\d{6}$/.test(value)) {
      // A malformed code is rejected here so it does not use up the 5 tries / 5 minutes of the server.
      setError(t('twoFactor.login.codeFormat'));
      inFlight.current = false;
      return;
    }
    setError(undefined);
    setFieldError(undefined);
    setSubmitting(true);
    try {
      await verifyTwoFactor(value);
      // A Google link waiting since "link-required" is sent only now: password AND code are proven (spec 12.1). Never throws.
      await finishGoogleLink();
      // On success keep the lock and the busy state until navigation unmounts this screen.
      goHomeAfterAuth();
    } catch (caught) {
      if (caught instanceof TwoFactorExpiredError || caught instanceof TwoFactorMissingError) {
        setExpired(true);
      } else if (isChallengeSpent(caught)) {
        // 401 two-factor-token-invalid: expired / already used / not valid — sign in again for a new token.
        setRejected(true);
        setExpired(true);
      } else if (isCodeRejected(caught)) {
        // 401 two-factor-code-invalid: the token is alive, only the code was wrong — keep the form, let the user retype.
        setError(t('twoFactor.login.wrongCode'));
      } else if (caught instanceof ApiError && caught.status === 400) {
        // Validation (empty / over-long code): not a spent token. Show the server's sentence at the field.
        const { message, fields } = describeError(caught);
        setFieldError(fields.code ?? message);
      } else {
        // 429 (5 tries / 5 minutes: "try again in a few minutes"), 5xx, no connection: the challenge stays, send again later.
        setError(describeError(caught).message);
      }
      setSubmitting(false);
      inFlight.current = false;
    }
  }

  function onBack() {
    cancelTwoFactor();
    router.back();
  }

  const recovery = mode === 'recovery';
  return (
    <KeyboardScreen contentStyle={styles.screen}>
      <AuthLogo />
      <Pressable
        testID="two-factor-back"
        accessibilityRole="button"
        accessibilityLabel={t('twoFactor.login.backToLogin')}
        onPress={onBack}
        style={styles.backRow}
      >
        <Text style={styles.secondaryButtonText}>‹ {t('twoFactor.login.backToLogin')}</Text>
      </Pressable>
      <Text accessibilityRole="header" style={[styles.title, { marginBottom: 8 }]}>
        {t('twoFactor.login.title')}
      </Text>
      <Text style={styles.intro}>{recovery ? t('twoFactor.login.introRecovery') : t('twoFactor.login.intro')}</Text>
      <AuthTextField
        testID="two-factor-code"
        label={recovery ? t('twoFactor.login.recoveryCode') : t('twoFactor.login.code')}
        value={code}
        onChangeText={setCode}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={recovery ? 'off' : 'one-time-code'}
        keyboardType={recovery ? 'default' : 'number-pad'}
        maxLength={recovery ? 32 : 7}
        error={fieldError}
        returnKeyType="go"
        onSubmitEditing={() => void onSubmit()}
      />
      {error ? (
        <Text testID="two-factor-error" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.formError}>
          {error}
        </Text>
      ) : null}
      <Pressable
        testID="two-factor-submit"
        accessibilityRole="button"
        accessibilityLabel={t('twoFactor.login.submit')}
        accessibilityState={{ busy: submitting, disabled: submitting }}
        disabled={submitting}
        onPress={onSubmit}
        style={[styles.button, submitting && styles.buttonDisabled]}
      >
        {submitting ? (
          <ActivityIndicator color={palette.onacc} />
        ) : (
          <Text style={styles.buttonText}>{t('twoFactor.login.submit')}</Text>
        )}
      </Pressable>
      <Pressable
        testID="two-factor-toggle-recovery"
        accessibilityRole="link"
        onPress={() => {
          setMode(recovery ? 'app' : 'recovery');
          setCode('');
          setError(undefined);
          setFieldError(undefined);
        }}
      >
        <Text style={styles.ghostLink}>{recovery ? t('twoFactor.login.useApp') : t('twoFactor.login.useRecovery')}</Text>
      </Pressable>
    </KeyboardScreen>
  );
}
