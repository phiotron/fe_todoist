import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { identitiesApi, type SocialProvider } from '../../api/identities';
import { AppButton } from '../../components/AppButton';
import { useIsOnline } from '../../lib/useIsOnline';
import { gutter, type, useTheme, useThemedStyles } from '../../theme';
import type { Palette } from '../../theme/palette';
import { meQueryKey, useSession } from '../auth/session';
import {
  describeCallbackFailure,
  describeSocialAuthError,
  describeSocialLinkError,
  providerName,
} from './socialErrors';
import { takeSocialResult, type SocialCallbackParams } from './socialFlow';

interface SocialCallbackScreenProps {
  provider: SocialProvider;
  params: SocialCallbackParams;
}

type Failure = { text: string; to: 'login' | 'account' };

/**
 * taskly://oauth/{apple|facebook}?state&idToken|accessToken&name|error (M13b): the end of the web sign-in. Checks the state,
 * then either signs in (the login screens started it) or links the account (Settings > Account started it).
 * Runs once per visit; nothing is sent when the state is not one this app generated.
 */
export function SocialCallbackScreen({ provider, params }: SocialCallbackScreenProps) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const { palette } = useTheme();
  const { signInWithSocial } = useSession();
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();
  const [failure, setFailure] = useState<Failure | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    void (async () => {
      const result = takeSocialResult(provider, params);
      if (result.type === 'error') {
        setFailure({ text: describeCallbackFailure(provider, result.reason), to: 'login' });
        return;
      }
      if (result.type === 'cancelled') {
        // Closed at the provider: nothing changes.
        router.replace(result.purpose === 'link' ? '/settings/account' : '/login');
        return;
      }
      if (result.purpose === 'link') {
        try {
          await identitiesApi.linkSocial(provider, { token: result.token });
        } catch (error) {
          setFailure({ text: describeSocialLinkError(provider, error, isOnline), to: 'account' });
          return;
        }
        await queryClient.invalidateQueries({ queryKey: meQueryKey });
        Alert.alert(
          t('social.linkedTitle', { provider: providerName(provider) }),
          t('social.linkedMessage', { provider: providerName(provider) }),
        );
        router.replace('/settings/account');
        return;
      }
      try {
        const outcome = await signInWithSocial({ provider, token: result.token, displayName: result.name });
        if (outcome === 'signedIn') router.replace('/');
        else if (outcome === 'twoFactorRequired') router.replace('/two-factor');
        else router.replace('/login'); // link-required: the login screen shows the notice and finishes the link
      } catch (error) {
        setFailure({ text: describeSocialAuthError(provider, error, isOnline), to: 'login' });
      }
    })();
    // The deep link is handled exactly once; later renders must not replay a single-use state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failure) {
    return (
      <View testID="social-callback-error" style={styles.screen}>
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>
          {failure.text}
        </Text>
        <AppButton
          testID="social-callback-back"
          variant="outline"
          full
          label={t(failure.to === 'account' ? 'social.callback.toAccount' : 'social.callback.toLogin')}
          onPress={() => router.replace(failure.to === 'account' ? '/settings/account' : '/login')}
        />
      </View>
    );
  }
  return (
    <View testID="social-callback-working" style={styles.screen}>
      <ActivityIndicator color={palette.acc} />
      <Text style={styles.working}>{t('social.callback.working')}</Text>
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, justifyContent: 'center', gap: 16, paddingHorizontal: gutter, backgroundColor: palette.bg },
    working: { ...type.body, color: palette.mute, textAlign: 'center' },
    error: { ...type.body, color: palette.warn },
  });
}
