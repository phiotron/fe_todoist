import { useLocalSearchParams } from 'expo-router';
import { ProjectFormScreen } from '../../features/projects/ProjectFormScreen';

export default function ProjectFormRoute() {
  const { projectId, parentId } = useLocalSearchParams<{ projectId?: string; parentId?: string }>();
  return <ProjectFormScreen projectId={projectId ? String(projectId) : undefined} parentId={parentId ? String(parentId) : undefined} />;
}
