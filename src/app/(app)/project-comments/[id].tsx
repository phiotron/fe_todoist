import { useLocalSearchParams } from 'expo-router';
import { ProjectCommentsScreen } from '../../../features/comments/ProjectCommentsScreen';

export default function ProjectCommentsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProjectCommentsScreen projectId={String(id)} />;
}
