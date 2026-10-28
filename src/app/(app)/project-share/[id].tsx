import { useLocalSearchParams } from 'expo-router';
import { ShareProjectScreen } from '../../../features/sharing/ShareProjectScreen';

/** Share screen of a project (M8a): Copy link, Access, "In this project", invite. */
export default function ProjectShareRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ShareProjectScreen projectId={String(id)} />;
}
