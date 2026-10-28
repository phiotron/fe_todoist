import { useLocalSearchParams } from 'expo-router';
import { JoinScreen } from '../../../features/sharing/JoinScreen';

/** taskly://join/<token> (spec 11.2) opens here with the code filled in; joining still needs the Join button. */
export default function JoinLinkRoute() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  return <JoinScreen initialCode={typeof token === 'string' ? token : ''} />;
}
