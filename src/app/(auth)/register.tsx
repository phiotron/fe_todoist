import { SafeAreaView } from 'react-native-safe-area-context';
import { RegisterScreen } from '../../features/auth/RegisterScreen';

export default function RegisterRoute() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <RegisterScreen />
    </SafeAreaView>
  );
}
