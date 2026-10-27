import { SafeAreaView } from 'react-native-safe-area-context';
import { ForgotPasswordScreen } from '../../features/auth/ForgotPasswordScreen';

export default function ForgotPasswordRoute() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ForgotPasswordScreen />
    </SafeAreaView>
  );
}
