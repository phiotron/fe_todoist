import { useLocalSearchParams } from 'expo-router';
import { FilterScreen } from '../../../features/filters/FilterScreen';

export default function FilterRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FilterScreen filterId={String(id)} />;
}
