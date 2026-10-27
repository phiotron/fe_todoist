import { SafeAreaView } from 'react-native-safe-area-context';
import { ResetPasswordScreen } from '../../../features/auth/ResetPasswordScreen';

export default function ResetPasswordRoute() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ResetPasswordScreen />
    </SafeAreaView>
  );
}
