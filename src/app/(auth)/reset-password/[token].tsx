import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ResetPasswordScreen } from '../../../features/auth/ResetPasswordScreen';

/** taskly://reset-password/<token> from the email (spec 12.1) opens here with the code filled in. */
export default function ResetPasswordLinkRoute() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ResetPasswordScreen initialCode={typeof token === 'string' ? token : ''} />
    </SafeAreaView>
  );
}
