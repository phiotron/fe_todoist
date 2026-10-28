import { useLocalSearchParams } from 'expo-router';
import { TeamPeopleScreen } from '../../../features/team/TeamPeopleScreen';

/** People of a team workspace (M8a). */
export default function TeamPeopleRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TeamPeopleScreen workspaceId={String(id)} />;
}
