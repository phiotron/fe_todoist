import { useLocalSearchParams } from 'expo-router';
import { ActivityScreen } from '../../features/activity/ActivityScreen';

/** `/activity?taskId=…` or `?projectId=…` (View activity); no param = everything (Today / Upcoming). */
export default function ActivityRoute() {
  const { projectId, taskId } = useLocalSearchParams<{ projectId?: string; taskId?: string }>();
  return <ActivityScreen projectId={projectId ? String(projectId) : undefined} taskId={taskId ? String(taskId) : undefined} />;
}
