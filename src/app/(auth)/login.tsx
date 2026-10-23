import { SafeAreaView } from 'react-native-safe-area-context';
import { LoginScreen } from '../../features/auth/LoginScreen';

export default function LoginRoute() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LoginScreen />
    </SafeAreaView>
  );
}
