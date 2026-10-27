import { SafeAreaView } from 'react-native-safe-area-context';
import { TwoFactorScreen } from '../../features/two-factor/TwoFactorScreen';

export default function TwoFactorRoute() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <TwoFactorScreen />
    </SafeAreaView>
  );
}
