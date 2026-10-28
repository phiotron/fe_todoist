import { useLocalSearchParams } from 'expo-router';
import { ProjectFormScreen } from '../../features/projects/ProjectFormScreen';

export default function ProjectFormRoute() {
  const { projectId, parentId, workspaceId } = useLocalSearchParams<{ projectId?: string; parentId?: string; workspaceId?: string }>();
  return (
    <ProjectFormScreen
      projectId={projectId ? String(projectId) : undefined}
      parentId={parentId ? String(parentId) : undefined}
      workspaceId={workspaceId ? String(workspaceId) : undefined}
    />
  );
}
