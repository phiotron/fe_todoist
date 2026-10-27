import { useLocalSearchParams } from 'expo-router';
import { OpenRemindersContext } from '../../../features/reminders/OpenRemindersContext';
import { TaskDetailScreen } from '../../../features/tasks/detail/TaskDetailScreen';

export default function TaskRoute() {
  const { id, reminders } = useLocalSearchParams<{ id: string; reminders?: string }>();
  return (
    <OpenRemindersContext.Provider value={reminders === '1'}>
      <TaskDetailScreen taskId={String(id)} />
    </OpenRemindersContext.Provider>
  );
}
