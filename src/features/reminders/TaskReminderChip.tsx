import { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Task } from '../../api/models';
import { Chip } from '../../components/Chip';
import { DEFAULT_TIME_ZONE } from '../../lib/reminders';
import { useLocations } from '../locations/useLocations';
import { OpenRemindersContext } from './OpenRemindersContext';
import { ReminderEditorModal } from './ReminderEditorModal';
import { reminderChipLabel, reminderLabel } from './reminderLabel';
import { useReminderFormats } from './useReminderFormats';
import { useReminderMutations, useTaskReminders } from './useTaskReminders';

export type ReminderChipTask = Pick<Task, 'id' | 'dueDatetime'>;

interface TaskReminderChipProps {
  task: ReminderChipTask;
  /** Account time zone (the task screen already has it). */
  timeZone?: string;
  /** Completed task / archived project or section (`useTaskAccess(task).readOnly`): list only. */
  readOnly?: boolean;
}

/**
 * "Reminders" chip of the task screen (spec 9.2, design M-TaskDetail): shows the reminder value, opens the editor.
 */
export function TaskReminderChip({ task, timeZone = DEFAULT_TIME_ZONE, readOnly = false }: TaskReminderChipProps) {
  const { t } = useTranslation();
  const openedBySwipe = useContext(OpenRemindersContext);
  const [open, setOpen] = useState(openedBySwipe);
  const formats = useReminderFormats();
  const { data } = useTaskReminders(task.id);
  const mutations = useReminderMutations(task.id);

  // M12: saved places, fetched once the editor is open or a location reminder needs its place name.
  const hasLocationReminder = (data ?? []).some((reminder) => reminder.type === 'LOCATION');
  const places = useLocations(open || hasLocationReminder).data;
  const placeName = (id?: string | null) => places?.find((place) => place.id === id)?.name;
  const items = (data ?? []).map((reminder) => ({
    id: reminder.id,
    label: reminderLabel({ ...reminder, locationName: placeName(reminder.locationId) }, t, formats),
  }));
  const label = reminderChipLabel(items.map((item) => item.label), t);

  return (
    <>
      <Chip large testID="task-reminder-chip" icon="bell" label={label} onPress={() => setOpen(true)} />
      <ReminderEditorModal
        visible={open}
        onClose={() => setOpen(false)}
        items={items}
        onAdd={(draft) => void mutations.add(draft)}
        onRemove={(id) => void mutations.remove(id)}
        hasTime={Boolean(task.dueDatetime)}
        timeZone={timeZone}
        timeFormat={formats.timeFormat}
        readOnly={readOnly}
        busy={mutations.busy}
        error={mutations.error}
        requiresOnline
        places={places ?? []}
      />
    </>
  );
}
