import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import type { SocialProvider } from '../../api/identities';
import { AppButton } from '../../components/AppButton';
import { beginSocialFlow } from '../social/socialFlow';
import { describeBeginFailure } from '../social/socialErrors';
import { useAuthStyles } from './styles';

interface SocialSignInButtonsProps {
  /** `<testID>-apple` / `<testID>-facebook` on the buttons, `<testID>-message` on the line under them. */
  testID: string;
  /** True while the surrounding form is submitting. */
  disabled?: boolean;
}

const PROVIDERS: readonly SocialProvider[] = ['APPLE', 'FACEBOOK'];

/**
 * "Continue with Apple / Facebook" (M13b). On Android these are web flows: pressing opens the browser; the answer arrives as
 * a deep link handled by src/app/oauth/[provider].tsx, so nothing here waits for a result.
 */
export function SocialSignInButtons({ testID, disabled = false }: SocialSignInButtonsProps) {
  const { t } = useTranslation();
  const styles = useAuthStyles();
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  // Synchronous lock: state updates are async, so two quick presses could both pass a state check.
  const inFlight = useRef(false);

  async function onPress(provider: SocialProvider) {
    if (inFlight.current || disabled) return;
    inFlight.current = true;
    setMessage(null);
    setBusy(provider);
    try {
      const result = await beginSocialFlow(provider, 'signIn');
      setMessage(
        result === 'opened'
          ? { kind: 'info', text: t('social.opening') }
          : { kind: 'error', text: describeBeginFailure(provider, result) },
      );
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      {PROVIDERS.map((provider) => (
        <AppButton
          key={provider}
          testID={`${testID}-${provider.toLowerCase()}`}
          variant="outline"
          full
          label={t(provider === 'APPLE' ? 'social.continueApple' : 'social.continueFacebook')}
          busy={busy === provider}
          disabled={disabled}
          requiresOnline
          onPress={() => void onPress(provider)}
        />
      ))}
      {message ? (
        <Text
          testID={`${testID}-message`}
          accessibilityRole={message.kind === 'error' ? 'alert' : undefined}
          accessibilityLiveRegion="polite"
          style={message.kind === 'error' ? styles.formError : styles.info}
        >
          {message.text}
        </Text>
      ) : null}
    </View>
  );
}
