import { useLocalSearchParams } from 'expo-router';
import { LabelScreen } from '../../../features/labels/LabelScreen';

export default function LabelRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LabelScreen labelId={String(id)} />;
}
