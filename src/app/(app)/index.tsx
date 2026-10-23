import { SafeAreaView } from 'react-native-safe-area-context';
import { HomeScreen } from '../../features/home/HomeScreen';

export default function HomeRoute() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <HomeScreen />
    </SafeAreaView>
  );
}
