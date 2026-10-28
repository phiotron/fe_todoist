import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { getGoogleIdToken } from '../../lib/googleSignIn';
import { useIsOnline } from '../../lib/useIsOnline';
import { describeGoogleAuthError, describeGoogleSignInFailure } from './googleErrors';
import { useSession } from './session';
import { useAuthStyles } from './styles';

interface GoogleSignInButtonProps {
  /** `<testID>` on the button, `<testID>-error` on the message under it. */
  testID: string;
  /** True while the surrounding form is submitting. */
  disabled?: boolean;
  onBusyChange?(busy: boolean): void;
  onSignedIn(): void;
  /** POST auth/google answered 409 link-required; the session now holds the pending link. */
  onLinkRequired(): void;
  /** POST auth/google answered 401 two-factor-required; the M3 two-factor step now holds the token. */
  onTwoFactorRequired(): void;
}

/** "or" between the Google button and the email form (approved design M-Auth). */
export function OrDivider() {
  const { t } = useTranslation();
  const styles = useAuthStyles();
  return (
    <View style={styles.orRow}>
      <View style={styles.orLine} />
      <Text style={styles.orText}>{t('google.or')}</Text>
      <View style={styles.orLine} />
    </View>
  );
}

export function GoogleSignInButton({
  testID,
  disabled = false,
  onBusyChange,
  onSignedIn,
  onLinkRequired,
  onTwoFactorRequired,
}: GoogleSignInButtonProps) {
  const { t } = useTranslation();
  const styles = useAuthStyles();
  const { signInWithGoogle } = useSession();
  const isOnline = useIsOnline();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Synchronous lock: state updates are async, so two quick presses could both pass a state check.
  const inFlight = useRef(false);

  function updateBusy(next: boolean) {
    setBusy(next);
    onBusyChange?.(next);
  }

  async function onPress() {
    if (inFlight.current || disabled) return;
    inFlight.current = true;
    setError(null);
    updateBusy(true);
    let leaving = false;
    try {
      const result = await getGoogleIdToken();
      // Cancelled in the account picker: no request, nothing changes.
      if (result.type === 'cancelled') return;
      if (result.type === 'error') {
        setError(describeGoogleSignInFailure(result.reason));
        return;
      }
      const outcome = await signInWithGoogle({ idToken: result.idToken, email: result.email });
      if (outcome === 'signedIn') {
        leaving = true;
        onSignedIn();
      } else if (outcome === 'twoFactorRequired') {
        onTwoFactorRequired();
      } else {
        onLinkRequired();
      }
    } catch (caught) {
      setError(describeGoogleAuthError(caught, isOnline));
    } finally {
      // After a successful sign-in the screen is being replaced: keep the lock, like the password form does.
      if (!leaving) {
        inFlight.current = false;
        updateBusy(false);
      }
    }
  }

  return (
    <View>
      {/* Design `.btn.full`: the plain outlined button, full width (AppButton "outline" + full). */}
      <AppButton
        testID={testID}
        variant="outline"
        full
        label={t('google.continue')}
        busy={busy}
        disabled={disabled}
        onPress={() => void onPress()}
      />
      {error ? (
        <Text
          testID={`${testID}-error`}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.formError}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
