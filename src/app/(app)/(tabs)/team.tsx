import { useLocalSearchParams } from 'expo-router';
import { TeamScreen } from '../../../features/team/TeamScreen';

/** Team tab (M8a): shown in the bar once the user belongs to a team workspace. */
export default function TeamRoute() {
  const { workspaceId } = useLocalSearchParams<{ workspaceId?: string }>();
  return <TeamScreen initialWorkspaceId={typeof workspaceId === 'string' ? workspaceId : undefined} />;
}