import { Redirect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { providerFromRoute } from '../../features/social/socialFlow';
import { SocialCallbackScreen } from '../../features/social/SocialCallbackScreen';

/** taskly://oauth/apple | taskly://oauth/facebook — the web sign-in returns here (M13b). */
export default function SocialCallbackRoute() {
  const query = useLocalSearchParams<{
    provider?: string;
    state?: string;
    idToken?: string;
    accessToken?: string;
    name?: string;
    error?: string;
  }>();
  const provider = providerFromRoute(typeof query.provider === 'string' ? query.provider : undefined);
  if (!provider) return <Redirect href="/" />;
  const text = (value: unknown) => (typeof value === 'string' ? value : undefined);
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <SocialCallbackScreen
        provider={provider}
        params={{
          state: text(query.state),
          idToken: text(query.idToken),
          accessToken: text(query.accessToken),
          name: text(query.name),
          error: text(query.error),
        }}
      />
    </SafeAreaView>
  );
}
