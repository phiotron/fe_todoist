import { useLocalSearchParams } from 'expo-router';
import { QuickAddSheet } from '../../features/quickAdd/QuickAddSheet';
import { parseQuickAddParams } from '../../features/quickAdd/quickAddTarget';

export default function QuickAddRoute() {
  const raw = useLocalSearchParams<Record<string, string | string[]>>();
  return <QuickAddSheet params={parseQuickAddParams(raw)} />;
}
