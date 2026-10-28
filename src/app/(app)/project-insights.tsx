import { useLocalSearchParams } from 'expo-router';
import { ProjectInsightsScreen } from '../../features/insights/ProjectInsightsScreen';

export default function ProjectInsightsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProjectInsightsScreen projectId={String(id)} />;
}
